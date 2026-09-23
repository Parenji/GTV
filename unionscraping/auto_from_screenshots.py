#!/usr/bin/env python3
"""
auto_from_screenshots.py — le auto dei piloti GTV, lette dalle gare vere.

Le classifiche ufficiali di ogni gara sono pubblicate come screenshot
nell'app Apps Script "UNION SCREENSHOT". Questo script:

  1. si autentica all'app e scarica gli screenshot di tutte le gare e lobby;
  2. legge posizione, pilota e auto di ogni riga con l'OCR di macOS (Vision);
  3. tiene solo i piloti del team GTV (elenco dal CSV piloti di config.js);
  4. aggiorna unionscraping/auto.json, che union.js usa come fallback per le
     colonne Auto e Marchio della sezione Piloti di union.html.

L'aggiornamento e' INCREMENTALE: i piloti gia' presenti non vengono mai
cancellati, le gare nuove si aggiungono allo storico e le auto cambiate
vengono segnalate. Con --dry-run non scrive niente.

Dipendenze: solo libreria standard di Python. L'OCR usa il framework Vision
di macOS, compilato al volo (serve Xcode Command Line Tools: `xcode-select
--install`).

Uso:
    python3 auto_from_screenshots.py --dry-run     # anteprima, non scrive
    python3 auto_from_screenshots.py               # aggiorna auto.json
    python3 auto_from_screenshots.py --gara "GARA 2"
    python3 auto_from_screenshots.py --refresh     # riscarica da zero
    python3 auto_from_screenshots.py --keep-images # conserva gli screenshot
"""

from __future__ import annotations

import argparse
import base64
import csv
import difflib
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
AUTO_JSON = BASE_DIR / "auto.json"
CONFIG_JS = ROOT_DIR / "config.js"

# Cache locale (gitignorata): screenshot, testo OCR e binario dell'OCR.
CACHE_DIR = BASE_DIR / ".screenshots"
OCR_SWIFT = BASE_DIR / "ocr.swift"
OCR_BINARY = CACHE_DIR / "ocr"

# Credenziali: prima le variabili d'ambiente, poi il file locale.
ENV_FILES = [BASE_DIR / ".env.gtv", BASE_DIR / ".env"]
ENV_USER = "GTV_SCREENSHOT_USER"
ENV_PASSWORD = "GTV_SCREENSHOT_PASSWORD"

# App "UNION SCREENSHOT" (Apps Script). L'ID identifica il deployment /exec.
DEPLOYMENT_ID = (
    "AKfycbwHrAkGESRER3qYrGJVr3KfukzkNgFUzdEOX0w2dPuhEEjR_-YWbdPwIRZErctykXr3vg"
)
APP_URL = f"https://script.google.com/macros/s/{DEPLOYMENT_ID}"

# Auto ammesse nel campionato -> marca mostrata in union.html.
# La chiave e' la sigla normalizzata (vedi normalizza_auto): senza anno,
# senza spazi e senza punteggiatura, cosi' l'OCR puo' sbagliare un carattere
# senza compromettere il riconoscimento.
AUTO_UFFICIALI = {
    "rs5turbodtm": ("RS 5 Turbo DTM '19", "Audi"),
    "rcfgt500": ("RC F GT500 '16", "Lexus"),
    "gtrnismogt500": ("GT-R NISMO GT500 '16", "Nissan"),
    "nsxconceptgt": ("NSX CONCEPT-GT '16", "Honda"),
}

# Blocchi di testo che le schermate di GT7 lasciano sparsi nelle righe
# (icone dei comandi, cursori, separatori) e che non sono ne' nomi ne' auto.
RUMORE = {
    "+", "-", "--", "---", "•", "·", "|", "O", "o", "*", "&", "X", "x",
    ".", ":", "SGE", "Re", "P", "E", "n", "N", "\\", "/", "^",
}

# Soglia di similarita' per accettare un'auto letta male dall'OCR
# (es. "R$ 5 Turbo DTM '19" per "RS 5 Turbo DTM '19").
SOGLIA_AUTO = 0.80
# Soglia per accettare il nome di un pilota con qualche carattere sbagliato.
SOGLIA_PILOTA = 0.86

# Tolleranza verticale per raggruppare i blocchi nella stessa riga
# (frazione dell'altezza dell'immagine).
TOLLERANZA_RIGA = 0.012

# Colonna dell'auto: frazione di larghezza in cui cade il nome del modello.
X_AUTO = 0.30
# Oltre questa frazione iniziano i tempi: non e' mai un nome.
X_LIMITE_NOME = 0.62


# ---------------------------------------------------------------------------
# Utilita' di testo
# ---------------------------------------------------------------------------
def normalizza(testo: str) -> str:
    """Minuscolo, senza accenti e senza punteggiatura: per confronti robusti."""
    testo = unicodedata.normalize("NFKD", testo or "")
    testo = "".join(c for c in testo if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", testo.lower())


def normalizza_auto(testo: str) -> str:
    """Come normalizza(), ma toglie anche l'anno ('19 / '16) in coda."""
    testo = re.sub(r"['’`]?\s*\d{2}\s*$", "", (testo or "").strip())
    return normalizza(testo)


def tronca(testo: str, larghezza: int) -> str:
    testo = str(testo)
    return testo if len(testo) <= larghezza else testo[: larghezza - 1] + "…"


def chiave_gara(nome: str) -> tuple:
    """Ordina 'GARA 1' < 'GARA 2' < 'GARA 10' (non lessicograficamente)."""
    numero = re.search(r"\d+", nome or "")
    return (int(numero.group()) if numero else 0, nome or "")


# ---------------------------------------------------------------------------
# Client RPC dell'app Apps Script
#
# google.script.run, in modalita' IFRAME_SANDBOX, si riduce a una POST
# urlencoded sull'endpoint /callback del deployment, con l'header
# X-Same-Domain. La risposta e' JSON protetto da prefisso XSSI (" )]}' ").
# Non serve nessun browser: bastano urllib e json.
# ---------------------------------------------------------------------------
class AppError(RuntimeError):
    pass


class AppClient:
    def __init__(self, timeout: int = 120):
        self.timeout = timeout
        self._chiamate = 0

    def _post(self, funzione: str, args: list) -> str:
        self._chiamate += 1
        payload = json.dumps(
            [funzione, json.dumps(args), None, [0], None, None, 1, 0]
        )
        richiesta = urllib.request.Request(
            f"{APP_URL}/callback?nocache_id={self._chiamate}",
            data=urllib.parse.urlencode({"request": payload}).encode("utf-8"),
            headers={
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                "X-Same-Domain": "1",
                "Referer": f"{APP_URL}/exec",
                "User-Agent": "Mozilla/5.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(richiesta, timeout=self.timeout) as risposta:
            return risposta.read().decode("utf-8")

    def chiama(self, funzione: str, *args):
        corpo = self._post(funzione, list(args))
        # La risposta inizia con ")]}'\n" (protezione XSSI di Google)
        corpo = corpo.split("\n", 1)[1] if corpo.startswith(")]}'") else corpo
        try:
            busta = json.loads(corpo)
            valore = json.loads(busta[0][1][1])
        except (ValueError, IndexError, TypeError) as errore:
            raise AppError(
                f"risposta inattesa da {funzione}: {corpo[:200]!r}"
            ) from errore
        return valore

    def login(self, utente: str, password: str) -> None:
        esito = self.chiama("login", utente, password)
        if not isinstance(esito, dict) or not esito.get("success"):
            messaggio = (esito or {}).get("message", "credenziali rifiutate")
            raise AppError(f"login fallito: {messaggio}")

    def gare(self) -> list:
        return self.chiama("getGare") or []

    def lobby(self, gara_id: str) -> list:
        return self.chiama("getLobby", gara_id) or []

    def screenshot(self, lobby_id: str) -> list:
        return self.chiama("getScreenshots", lobby_id) or []

    def screenshot_dati(self, file_id: str, lobby_id: str) -> str:
        esito = self.chiama("getScreenshotData", file_id, lobby_id)
        return (esito or {}).get("dataUrl", "")


# ---------------------------------------------------------------------------
# Credenziali
# ---------------------------------------------------------------------------
def carica_env() -> None:
    """Carica .env.gtv / .env: le variabili gia' presenti hanno la precedenza."""
    for percorso in ENV_FILES:
        if not percorso.exists():
            continue
        for riga in percorso.read_text(encoding="utf-8").splitlines():
            riga = riga.strip()
            if not riga or riga.startswith("#") or "=" not in riga:
                continue
            chiave, _, valore = riga.partition("=")
            chiave = chiave.strip()
            valore = valore.strip().strip('"').strip("'")
            if chiave and chiave not in os.environ:
                os.environ[chiave] = valore


def credenziali(args) -> tuple:
    utente = args.user or os.environ.get(ENV_USER, "").strip()
    password = args.password or os.environ.get(ENV_PASSWORD, "").strip()
    if not utente or not password:
        raise SystemExit(
            "x Servono le credenziali dell'app UNION SCREENSHOT.\n"
            f"  Mettile in {ENV_FILES[0].relative_to(ROOT_DIR)} (ignorato da git):\n"
            f"      {ENV_USER}=GTV\n"
            f"      {ENV_PASSWORD}=...\n"
            f"  oppure passale con --user / --password."
        )
    return utente, password


# ---------------------------------------------------------------------------
# OCR (macOS Vision, compilato al volo e messo in cache)
# ---------------------------------------------------------------------------
def compila_ocr(forza: bool = False) -> Path:
    if sys.platform != "darwin":
        raise SystemExit(
            "x L'OCR usa il framework Vision di macOS e non e' disponibile su "
            f"{sys.platform}.\n  Lancia lo script su un Mac."
        )
    if not OCR_SWIFT.exists():
        raise SystemExit(f"x Manca {OCR_SWIFT}")

    aggiornato = (
        OCR_BINARY.exists()
        and not forza
        and OCR_BINARY.stat().st_mtime >= OCR_SWIFT.stat().st_mtime
    )
    if aggiornato:
        return OCR_BINARY

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_moduli = CACHE_DIR / "modulecache"
    cache_moduli.mkdir(exist_ok=True)
    print("· compilo l'helper OCR (una volta sola)...")
    esito = subprocess.run(
        [
            "swiftc", "-O",
            "-module-cache-path", str(cache_moduli),
            str(OCR_SWIFT), "-o", str(OCR_BINARY),
        ],
        capture_output=True,
        text=True,
    )
    if esito.returncode != 0:
        raise SystemExit(
            "x Compilazione dell'OCR fallita.\n"
            "  Serve Xcode Command Line Tools: xcode-select --install\n"
            + (esito.stderr or "").strip()
        )
    # La cache dei moduli serve solo a compilare e pesa oltre 100 MB:
    # il binario ormai c'e', quindi si butta.
    shutil.rmtree(cache_moduli, ignore_errors=True)
    return OCR_BINARY


def esegui_ocr(immagini: list) -> dict:
    """OCR di un lotto di immagini -> {percorso: [osservazioni]}."""
    if not immagini:
        return {}
    binario = compila_ocr()
    esito = subprocess.run(
        [str(binario), *[str(p) for p in immagini]],
        capture_output=True,
        text=True,
    )
    if esito.returncode != 0 and not esito.stdout:
        raise SystemExit(f"x OCR fallito:\n{esito.stderr.strip()}")

    risultato = {}
    corrente = None
    for riga in esito.stdout.splitlines():
        if riga.startswith("=== "):
            corrente = riga[4:].strip()
            risultato[corrente] = []
            continue
        if corrente is None or not riga.strip():
            continue
        parti = riga.split("\t")
        if len(parti) != 5:
            continue
        try:
            x, y, w, h = (float(v) for v in parti[:4])
        except ValueError:
            continue
        risultato[corrente].append((x, y, w, h, parti[4]))
    return risultato


def percorso_cache(immagine: Path) -> Path:
    return immagine.with_suffix(immagine.suffix + ".ocr.txt")


def cache_valida(immagine: Path) -> bool:
    """True se il testo OCR in cache e' utilizzabile per questa immagine.

    Se lo screenshot e' stato gia' eliminato (comportamento predefinito),
    il solo testo OCR basta e la cache e' valida a prescindere dalla data.
    """
    cache = percorso_cache(immagine)
    if not cache.exists():
        return False
    if not immagine.exists():
        return True
    return cache.stat().st_mtime >= immagine.stat().st_mtime


def immagini_da_analizzare(cartella: Path) -> list:
    """Percorsi .png di una lobby: quelli scaricati e quelli di cui resta
    soltanto il testo OCR (gli screenshot si eliminano dopo la lettura)."""
    nomi = set()
    for percorso in cartella.iterdir():
        if percorso.name.endswith(".png.ocr.txt"):
            nomi.add(percorso.name[: -len(".ocr.txt")])
        elif percorso.suffix.lower() == ".png":
            nomi.add(percorso.name)
    return sorted(cartella / nome for nome in nomi)


def leggi_cache(cache: Path) -> list:
    osservazioni = []
    for riga in cache.read_text(encoding="utf-8").splitlines():
        parti = riga.split("\t")
        if len(parti) != 5:
            continue
        try:
            x, y, w, h = (float(v) for v in parti[:4])
        except ValueError:
            continue
        osservazioni.append((x, y, w, h, parti[4]))
    return osservazioni


def scrivi_cache(cache: Path, osservazioni: list) -> None:
    cache.write_text(
        "\n".join(
            f"{x:.5f}\t{y:.5f}\t{w:.5f}\t{h:.5f}\t{t}"
            for x, y, w, h, t in osservazioni
        ),
        encoding="utf-8",
    )


def prepara_ocr(immagini: list, lotto: int = 12) -> None:
    """Esegue l'OCR solo delle immagini non ancora in cache, a lotti.

    Il binario viene lanciato poche volte invece che una per immagine:
    su una stagione intera (centinaia di screenshot) la differenza e' netta.
    """
    da_fare = [
        percorso
        for percorso in immagini
        if percorso.exists() and not cache_valida(percorso)
    ]
    if not da_fare:
        print(f"   OCR gia' in cache per tutte le {len(immagini)} immagini")
        return

    print(f"   OCR di {len(da_fare)} immagini ({len(immagini) - len(da_fare)} in cache)...")
    for inizio in range(0, len(da_fare), lotto):
        blocco = da_fare[inizio: inizio + lotto]
        risultati = esegui_ocr(blocco)
        for percorso in blocco:
            scrivi_cache(percorso_cache(percorso), risultati.get(str(percorso), []))
        print(f"     {min(inizio + lotto, len(da_fare))}/{len(da_fare)}")


def osserva_immagine(percorso: Path) -> list:
    """Osservazioni OCR di una immagine (dalla cache preparata da prepara_ocr)."""
    cache = percorso_cache(percorso)
    if cache_valida(percorso):
        return leggi_cache(cache)
    if not percorso.exists():
        return []
    osservazioni = esegui_ocr([percorso]).get(str(percorso), [])
    scrivi_cache(cache, osservazioni)
    return osservazioni


# ---------------------------------------------------------------------------
# Interpretazione delle classifiche
# ---------------------------------------------------------------------------
def raggruppa_righe(osservazioni: list) -> list:
    """Raggruppa i blocchi OCR in righe di classifica, dall'alto in basso."""
    righe = []
    for x, y, w, h, testo in osservazioni:
        centro = y + h / 2
        for riga in righe:
            if abs(riga["centro"] - centro) < TOLLERANZA_RIGA:
                riga["celle"].append((x, testo))
                riga["centro"] = (riga["centro"] + centro) / 2
                break
        else:
            righe.append({"centro": centro, "celle": [(x, testo)]})
    for riga in righe:
        riga["celle"].sort(key=lambda c: c[0])
    righe.sort(key=lambda r: -r["centro"])
    return righe


def riconosci_auto(testo: str):
    """(nome ufficiale, marca) se il testo e' un'auto del campionato, altrimenti None."""
    chiave = normalizza_auto(testo)
    if not chiave:
        return None
    if chiave in AUTO_UFFICIALI:
        return AUTO_UFFICIALI[chiave]
    vicini = difflib.get_close_matches(
        chiave, list(AUTO_UFFICIALI), n=1, cutoff=SOGLIA_AUTO
    )
    if vicini:
        return AUTO_UFFICIALI[vicini[0]]
    return None


def e_rumore(testo: str) -> bool:
    t = testo.strip()
    return not t or t in RUMORE or bool(re.fullmatch(r"[^\w]+", t))


def leggi_riga(celle: list, avvisi: list, contesto: str):
    """Estrae (posizione, pilota, auto, marca) da una riga, o None.

    L'auto viene cercata confrontando le celle con l'elenco delle auto
    ammesse: e' il riferimento piu' affidabile, perche' i nomi dei modelli
    sono pochi e noti mentre i soprannomi dei piloti sono liberi. Il pilota
    e' la cella immediatamente a sinistra dell'auto.
    """
    # Posizione: primo numero isolato nella fascia sinistra.
    pos_idx = None
    for i, (x, testo) in enumerate(celle):
        if x < 0.13 and re.fullmatch(r"\d{1,2}", testo.strip()):
            pos_idx = i
            break
    if pos_idx is None:
        return None

    # Auto: cella singola o unita alla successiva (l'anno cade a capo).
    auto = marca = None
    auto_idx = auto_span = None
    for i in range(pos_idx + 1, len(celle)):
        for span in (1, 2):
            if i + span > len(celle):
                continue
            unito = " ".join(celle[j][1].strip() for j in range(i, i + span))
            trovata = riconosci_auto(unito)
            if trovata:
                auto, marca = trovata
                auto_idx, auto_span = i, span
                break
        if auto:
            break

    if auto is None:
        # Auto sconosciuta: ripiego sulla posizione della colonna, che nelle
        # schermate GT7 e' stabile. Va segnalato perche' va aggiunta all'elenco.
        candidate = [
            (i, x, t) for i, (x, t) in enumerate(celle)
            if pos_idx < i and X_AUTO - 0.12 <= x <= X_AUTO + 0.14
        ]
        if not candidate:
            return None
        i, _, testo = candidate[0]
        unito = testo.strip()
        if i + 1 < len(celle) and re.fullmatch(r"['’`]?\d{2}", celle[i + 1][1].strip()):
            unito = f"{unito} {celle[i + 1][1].strip()}"
        auto, marca = unito, ""
        auto_idx, auto_span = i, 1
        avvisi.append(
            f"{contesto}: auto non riconosciuta {unito!r} — "
            "aggiungila a AUTO_UFFICIALI se e' un modello nuovo"
        )

    # Pilota: ultima cella utile prima dell'auto.
    pilota = None
    for i in range(auto_idx - 1, pos_idx, -1):
        x, testo = celle[i]
        if x > X_LIMITE_NOME or e_rumore(testo):
            continue
        pilota = testo.strip()
        break
    if not pilota:
        return None

    posizione = int(celle[pos_idx][1].strip())
    return posizione, pilota, auto, marca


def tipo_classifica(osservazioni: list) -> str:
    """'gara' se la tabella ha la colonna TEMPO, altrimenti 'quali'."""
    testi = normalizza(" ".join(t for *_, t in osservazioni))
    return "gara" if "tempo" in testi and "penalita" in testi else "quali"


def lobby_da_intestazione(osservazioni: list):
    """Lobby scritta nel titolo della classifica ('A7'), se presente.

    Serve a scoprire gli screenshot archiviati nella cartella sbagliata:
    la classifica porta sempre scritto a quale lobby appartiene.
    """
    for _, y, _, _, testo in osservazioni:
        if y < 0.70:  # solo la parte alta dell'immagine (titolo)
            continue
        maiuscolo = testo.upper()
        if "UNION" not in maiuscolo:
            continue
        trovato = re.search(r"\bA\s?(\d{1,2})\b", maiuscolo)
        if trovato:
            return f"A{trovato.group(1)}"
    return None


def analizza_immagine(percorso: Path, avvisi: list) -> dict:
    osservazioni = osserva_immagine(percorso)
    risultato = {
        "file": percorso.name,
        "tipo": tipo_classifica(osservazioni),
        "lobby_etichetta": lobby_da_intestazione(osservazioni),
        "righe": [],
    }
    for riga in raggruppa_righe(osservazioni):
        voce = leggi_riga(riga["celle"], avvisi, percorso.name)
        if voce:
            posizione, pilota, auto, marca = voce
            risultato["righe"].append(
                {"pos": posizione, "pilota": pilota, "auto": auto, "marca": marca}
            )
    return risultato


# ---------------------------------------------------------------------------
# Elenco dei piloti GTV (dal CSV piloti pubblicato dal foglio Google)
# ---------------------------------------------------------------------------
def url_csv_piloti() -> str:
    if not CONFIG_JS.exists():
        raise SystemExit(f"x Non trovo {CONFIG_JS}")
    testo = CONFIG_JS.read_text(encoding="utf-8")
    trovato = re.search(r'piloti:\s*"([^"]+)"', testo)
    if not trovato:
        raise SystemExit("x In config.js non trovo window.GTV_CONFIG.googleSheets.piloti")
    return trovato.group(1)


def scarica_csv(url: str) -> str:
    richiesta = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(richiesta, timeout=60) as risposta:
        return risposta.read().decode("utf-8-sig")


def piloti_gtv(url: str) -> list:
    """[{psn, gt7, categoria}] dei piloti GTV iscritti a Union (colonna Union = x)."""
    righe = list(csv.reader(io.StringIO(scarica_csv(url))))
    piloti = []
    for riga in righe[1:]:
        if len(riga) < 7:
            continue
        if riga[5].strip().lower() not in ("x", "✓", "1"):
            continue
        piloti.append(
            {
                "psn": riga[0].strip(),
                "gt7": riga[1].strip(),
                "categoria": riga[6].strip(),
            }
        )
    return piloti


def abbina_pilota(nome: str, elenco: list):
    """Trova il pilota GTV corrispondente a un nome letto dalla classifica."""
    chiave = normalizza(nome)
    if not chiave:
        return None
    for pilota in elenco:
        if chiave in (normalizza(pilota["psn"]), normalizza(pilota["gt7"])):
            return pilota
    # I soprannomi possono essere troncati nelle schermate ("S. Di Giovanni"):
    # si accetta anche un rapporto di contenimento sufficientemente lungo.
    for pilota in elenco:
        for alias in (pilota["psn"], pilota["gt7"]):
            alias_norm = normalizza(alias)
            if len(alias_norm) < 6:
                continue
            if alias_norm in chiave or chiave in alias_norm:
                return pilota
            if difflib.SequenceMatcher(None, chiave, alias_norm).ratio() >= SOGLIA_PILOTA:
                return pilota
    return None


# ---------------------------------------------------------------------------
# Download degli screenshot (con cache su disco)
# ---------------------------------------------------------------------------
def scarica(percorso: Path, data_url: str) -> None:
    trovato = re.match(r"data:(image/[a-z+]+);base64,(.*)$", data_url, re.S)
    if not trovato:
        raise AppError(f"dataUrl inatteso per {percorso.name}")
    dati = base64.b64decode(trovato.group(2))
    percorso.write_bytes(dati)


def raccogli_screenshot(client: AppClient, args) -> list:
    """Scarica (o riusa dalla cache) tutti gli screenshot. Ritorna l'indice."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    indice = []

    for gara in client.gare():
        if args.gara and normalizza(gara["name"]) != normalizza(args.gara):
            continue
        print(f"\n· {gara['name']}")
        lobby_elenco = client.lobby(gara["id"])
        if args.lobby:
            lobby_elenco = [
                l for l in lobby_elenco
                if normalizza(l["name"]) == normalizza(args.lobby)
            ]
        for lobby in lobby_elenco:
            cartella = CACHE_DIR / gara["name"] / lobby["name"]
            cartella.mkdir(parents=True, exist_ok=True)
            file_elenco = client.screenshot(lobby["id"])
            nuovi = 0
            for file in file_elenco:
                # Il nome arriva dal Drive con estensione a volte sbagliata:
                # il contenuto reale lo decide il download, qui si usa .png.
                destinazione = cartella / (
                    re.sub(r"[^\w.\-]+", "_", file["name"]).rsplit(".", 1)[0] + ".png"
                )
                if cache_valida(destinazione) and not args.refresh:
                    continue
                try:
                    dati = client.screenshot_dati(file["id"], lobby["id"])
                    scarica(destinazione, dati)
                    nuovi += 1
                except Exception as errore:  # noqa: BLE001 - si prosegue sugli altri
                    print(f"    ! {file['name']}: {errore}")
            stato = f"{nuovi} nuovi" if nuovi else "gia' in cache"
            print(f"  {lobby['name']:4s} {len(file_elenco)} screenshot ({stato})")
            indice.append({"gara": gara["name"], "lobby": lobby["name"], "cartella": cartella})
    return indice


def rileva_duplicati(percorsi: list, avvisi: list) -> None:
    """Segnala screenshot identici: in passato una cartella era stata copiata."""
    per_hash = {}
    for percorso in percorsi:
        if not percorso.exists():
            continue
        impronta = hashlib.md5(percorso.read_bytes()).hexdigest()
        per_hash.setdefault(impronta, []).append(percorso)
    for gruppo in per_hash.values():
        if len(gruppo) > 1:
            nomi = ", ".join(sorted(p.parent.name + "/" + p.name for p in gruppo))
            avvisi.append(f"screenshot identici (probabile copia): {nomi}")


# ---------------------------------------------------------------------------
# Costruzione del file auto.json
# ---------------------------------------------------------------------------
def costruisci(indice: list, elenco_piloti: list, args) -> tuple:
    avvisi = []
    # pilota(psn) -> {auto, marca, gara, lobby, pos_quali, pos_gara, fonte}
    trovati = {}
    auto_viste = {}  # psn -> {auto: [contesti]}
    tutti_i_file = []

    for voce in indice:
        percorsi = immagini_da_analizzare(voce["cartella"])
        tutti_i_file.extend(percorsi)
        for percorso in percorsi:
            analisi = analizza_immagine(percorso, avvisi)
            # La lobby scritta nella classifica e' piu' affidabile della
            # cartella: capita che uno screenshot finisca nella cartella sbagliata.
            lobby = analisi["lobby_etichetta"] or voce["lobby"]
            if (
                analisi["lobby_etichetta"]
                and normalizza(analisi["lobby_etichetta"]) != normalizza(voce["lobby"])
            ):
                avvisi.append(
                    f"{percorso.name}: archiviato in {voce['lobby']} ma la classifica "
                    f"dice {analisi['lobby_etichetta']} — uso {analisi['lobby_etichetta']}"
                )
            for riga in analisi["righe"]:
                pilota = abbina_pilota(riga["pilota"], elenco_piloti)
                if not pilota:
                    continue
                chiave = pilota["psn"]
                auto_viste.setdefault(chiave, {}).setdefault(riga["auto"], []).append(
                    f"{voce['gara']}/{lobby} {analisi['tipo']}"
                )
                record = trovati.setdefault(
                    chiave,
                    {
                        "psn": pilota["psn"],
                        "gt7": pilota["gt7"],
                        "categoria": pilota["categoria"],
                        "auto": riga["auto"],
                        "marchio": riga["marca"],
                        "gara": voce["gara"],
                        "lobby": lobby,
                        "pos_quali": None,
                        "pos_gara": None,
                        "fonte": percorso.name,
                    },
                )
                # Vince la gara piu' recente; a pari gara resta la prima lobby
                # incontrata (l'ordine in cui l'app elenca le lobby).
                if chiave_gara(voce["gara"]) > chiave_gara(record["gara"]):
                    record["auto"] = riga["auto"]
                    record["marchio"] = riga["marca"] or record["marchio"]
                    record["gara"] = voce["gara"]
                    record["lobby"] = lobby
                    record["fonte"] = percorso.name
                if analisi["tipo"] == "gara":
                    record["pos_gara"] = riga["pos"]
                else:
                    record["pos_quali"] = riga["pos"]

    rileva_duplicati(tutti_i_file, avvisi)

    for chiave, varianti in auto_viste.items():
        if len(varianti) > 1:
            dettaglio = "; ".join(f"{a} ({', '.join(c)})" for a, c in varianti.items())
            avvisi.append(f"{chiave}: auto diverse tra le schermate — {dettaglio}")

    return trovati, avvisi


def fondi_con_esistente(trovati: dict, gare: list, avvisi: list) -> dict:
    """Unisce i dati nuovi a auto.json senza mai perdere quelli vecchi."""
    esistente = {}
    meta_esistente = {}
    if AUTO_JSON.exists():
        try:
            caricato = json.loads(AUTO_JSON.read_text(encoding="utf-8"))
            esistente = caricato.get("piloti", {})
            meta_esistente = caricato.get("meta", {})
        except ValueError:
            avvisi.append("auto.json illeggibile: verra' riscritto da zero")

    piloti = {}
    for chiave, record in esistente.items():
        piloti[chiave] = dict(record)

    for chiave, nuovo in trovati.items():
        precedente = piloti.get(chiave, {})
        record = dict(precedente)
        record.update({k: v for k, v in nuovo.items() if v not in (None, "")})

        storico = list(precedente.get("storico", []))
        voce = {
            "gara": nuovo["gara"],
            "lobby": nuovo["lobby"],
            "auto": nuovo["auto"],
            "marchio": nuovo["marchio"],
            "pos_quali": nuovo.get("pos_quali"),
            "pos_gara": nuovo.get("pos_gara"),
        }
        for i, vecchia in enumerate(storico):
            if vecchia.get("gara") == voce["gara"]:
                storico[i] = voce
                break
        else:
            storico.append(voce)
        record["storico"] = sorted(storico, key=lambda v: chiave_gara(v.get("gara", "")))
        record["aggiornato_il"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        piloti[chiave] = record

    gare_note = set(meta_esistente.get("gare_esaminate", []))
    gare_note.update(gare)

    meta = {
        "generated_at": meta_esistente.get("generated_at")
        or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "UNION SCREENSHOT — screenshot ufficiali delle classifiche di gara",
        "app": f"{APP_URL}/exec",
        "gare_esaminate": sorted(gare_note, key=chiave_gara),
        "note": (
            "Auto lette dalle classifiche ufficiali (qualifiche + gara) delle gare "
            "finora disputate. Sono elencati solo i piloti GTV che hanno gia' corso: "
            "le colonne Union_auto/Union_marchio del foglio Google restano la fonte "
            "primaria, questo file interviene solo come fallback quando sono vuote."
        ),
        "avvertenze": avvisi,
    }
    return {"meta": meta, "piloti": dict(sorted(piloti.items()))}


# ---------------------------------------------------------------------------
# Programma principale
# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Aggiorna unionscraping/auto.json dalle classifiche ufficiali.",
    )
    parser.add_argument("--user", help=f"utente app (default: ${ENV_USER} o .env.gtv)")
    parser.add_argument("--password", help=f"password app (default: ${ENV_PASSWORD})")
    parser.add_argument("--gara", help='solo una gara, es. "GARA 2" (default: tutte)')
    parser.add_argument("--lobby", help='solo una lobby, es. "A15"')
    parser.add_argument("--dry-run", action="store_true",
                        help="mostra cosa cambierebbe senza scrivere auto.json")
    parser.add_argument("--refresh", action="store_true",
                        help="riscarica gli screenshot anche se gia' in cache")
    parser.add_argument("--keep-images", action="store_true",
                        help="conserva gli screenshot dopo l'OCR (default: li elimina)")
    parser.add_argument("--reocr", action="store_true",
                        help="ripete l'OCR anche se il testo e' gia' in cache")
    args = parser.parse_args()

    carica_env()
    utente, password = credenziali(args)

    if args.reocr:
        for vecchio in CACHE_DIR.rglob("*.ocr.txt"):
            vecchio.unlink()

    print("· accedo all'app UNION SCREENSHOT...")
    client = AppClient()
    client.login(utente, password)

    indice = raccogli_screenshot(client, args)
    if not indice:
        print("x Nessuno screenshot trovato (gara/lobby inesistenti?)")
        return 1

    immagini = sorted(
        percorso
        for voce in indice
        for percorso in immagini_da_analizzare(voce["cartella"])
    )

    print("\n· elenco piloti GTV dal foglio Google...")
    elenco = piloti_gtv(url_csv_piloti())
    print(f"  {len(elenco)} piloti GTV iscritti a Union")

    print("· leggo le classifiche...")
    prepara_ocr(immagini)
    trovati, avvisi = costruisci(indice, elenco, args)

    if not trovati:
        print("x Nessun pilota GTV trovato nelle classifiche.")
        for avviso in avvisi:
            print(f"  ! {avviso}")
        return 1

    gare = sorted({v["gara"] for v in trovati.values()})
    dati = fondi_con_esistente(trovati, gare, avvisi)

    print("\n" + "=" * 78)
    print("PILOTI GTV TROVATI NELLE CLASSIFICHE")
    print("=" * 78)
    print(f"{'Pilota':<24} {'Cat':<11} {'Auto':<24} {'Gara':<8} {'Lobby':<6}")
    print("-" * 78)
    for record in sorted(trovati.values(), key=lambda r: (r["categoria"], r["psn"])):
        print(
            f"{tronca(record['psn'], 23):<24} "
            f"{tronca(record['categoria'], 10):<11} "
            f"{tronca(record['auto'], 23):<24} "
            f"{tronca(record['gara'], 7):<8} "
            f"{tronca(record['lobby'], 5):<6}"
        )

    if avvisi:
        print("\nAVVISI")
        print("-" * 78)
        for avviso in avvisi:
            print(f"  ! {avviso}")

    if args.dry_run:
        print("\n(dry-run: auto.json NON e' stato modificato)")
        return 0

    AUTO_JSON.write_text(
        json.dumps(dati, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"\nOK → {AUTO_JSON.relative_to(ROOT_DIR)} "
          f"({len(dati['piloti'])} piloti, gare: {', '.join(dati['meta']['gare_esaminate'])})")

    if not args.keep_images:
        eliminati = 0
        for percorso in CACHE_DIR.rglob("*.png"):
            percorso.unlink()
            eliminati += 1
        print(f"   {eliminati} screenshot eliminati (testo OCR conservato in cache)")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except AppError as errore:
        print(f"x {errore}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\ninterrotto", file=sys.stderr)
        sys.exit(130)
