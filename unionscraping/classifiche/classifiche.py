#!/usr/bin/env python3
"""
classifiche.py — classifiche generali e risultati di gara dal portale Union.

Fonte principale: il "Portale Classifiche Union" (Round 2)
    https://albixximo-union2026-r2.vercel.app/Classifiche/portal.html

Com'e' fatto il portale (verificato il 2026-09-29):
  - le CLASSIFICHE GENERALI sono pagine HTML incorporate nel portale, una per
    lega, nell'oggetto JavaScript `pages` (colonne POS, TEAM, PILOTA, PUNTI,
    GARA 1..5): si leggono senza OCR;
  - le lobby di ogni lega stanno nell'oggetto `lobbiesByLeague`;
  - i RISULTATI DI GARA sono immagini, una per lobby:
        /Gare/G<n>/<LEGA>/<LOBBY>.png
    accompagnate dai provvedimenti della direzione gara:
        /Gare/G<n>/<LEGA>/<LOBBY>-dg.json   [{pilot, sanction, seconds}]
    Le immagini si leggono con l'OCR di macOS (lo stesso di auto/).

Gli screenshot dell'app UNION SCREENSHOT (cache di auto/) servono SOLO ad
aggiungere dettagli che il portale non da': posizione di qualifica, auto,
distacco e giro veloce. Una gara compare nei risultati solo quando il
portale ne ha pubblicato le classifiche.

Scrive unionscraping/classifiche.json, letto da union.js.

Uso:
    python3 classifiche.py              # aggiorna classifiche.json
    python3 classifiche.py --dry-run    # mostra cosa ha trovato, non scrive
    python3 classifiche.py --no-ocr     # solo classifiche generali (ovunque)
"""

from __future__ import annotations

import argparse
import difflib
import html
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
UNION_DIR = BASE_DIR.parent
OUT_JSON = UNION_DIR / "classifiche.json"
DATA_JSON = UNION_DIR / "data.json"
AUTO_DIR = UNION_DIR / "auto"

# Cache locale (gitignorata) delle immagini delle classifiche di gara e del
# loro testo OCR.
CACHE_DIR = BASE_DIR / ".gare"

PORTALE = "https://albixximo-union2026-r2.vercel.app"
PORTALE_PAGINA = f"{PORTALE}/Classifiche/portal.html"
NUM_GARE = 5
LEGHE = ["STAR", "ELITE", "PRO GOLD", "PRO SILVER", "PRO AMA", "AMA"]


def adesso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def scarica(url: str, binario: bool = False, timeout: int = 60):
    """GET; ritorna None se la risorsa non esiste (404)."""
    richiesta = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(richiesta, timeout=timeout) as risposta:
            corpo = risposta.read()
    except urllib.error.HTTPError as errore:
        if errore.code == 404:
            return None
        raise
    return corpo if binario else corpo.decode("utf-8")


def url_gara(gara: int, lega: str, nome: str) -> str:
    return f"{PORTALE}/Gare/G{gara}/{urllib.parse.quote(lega)}/{nome}"


def normalizza(testo: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (testo or "").lower())


# ---------------------------------------------------------------------------
# Lettura del portale
# ---------------------------------------------------------------------------
def variabile_json(sorgente: str, nome: str):
    """Valore JSON di `const <nome> = {...};` scritto su una riga del portale."""
    for riga in sorgente.splitlines():
        riga = riga.strip()
        if riga.startswith(f"const {nome} = "):
            valore = riga[len(f"const {nome} = "):].rstrip(";")
            return json.loads(valore)
    return None


def lobby_per_lega(sorgente: str) -> dict:
    """`lobbiesByLeague` e' un oggetto JavaScript (chiavi senza virgolette)."""
    blocco = re.search(r"const lobbiesByLeague = \{(.*?)\};", sorgente, re.S)
    if not blocco:
        return {}
    risultato = {}
    for chiave, valori in re.findall(r'("[^"]+"|[A-Z][A-Z ]*)\s*:\s*\[([^\]]*)\]', blocco.group(1)):
        risultato[chiave.strip('"').strip()] = re.findall(r'"([^"]+)"', valori)
    return risultato


class Tabelle(HTMLParser):
    """Raccoglie le tabelle di una pagina: [[ [cella, ...], ... ], ...]."""

    def __init__(self):
        super().__init__()
        self.tabelle, self._riga, self._cella = [], None, None

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self.tabelle.append([])
        elif tag == "tr" and self.tabelle:
            self._riga = []
        elif tag in ("td", "th") and self._riga is not None:
            self._cella = []

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._cella is not None:
            self._riga.append(" ".join("".join(self._cella).split()))
            self._cella = None
        elif tag == "tr" and self._riga is not None:
            if self._riga:
                self.tabelle[-1].append(self._riga)
            self._riga = None

    def handle_data(self, data):
        if self._cella is not None:
            self._cella.append(data)


def numero(testo: str):
    testo = (testo or "").strip().replace(",", ".")
    if re.fullmatch(r"-?\d+(\.\d+)?", testo):
        valore = float(testo)
        return int(valore) if valore.is_integer() else valore
    return None


def classifica_lega(pagina: str) -> list:
    """Righe della classifica generale di una lega.

    Le colonne si riconoscono dall'intestazione (POS, TEAM, PILOTA, PUNTI,
    GARA n), cosi' un cambio di ordine nel portale non rompe la lettura.
    """
    lettore = Tabelle()
    lettore.feed(pagina)
    for tabella in lettore.tabelle:
        intestazione = None
        piloti = []
        for riga in tabella:
            maiuscole = [c.upper() for c in riga]
            if "POS" in maiuscole and "PILOTA" in maiuscole:
                intestazione = maiuscole
                continue
            if not intestazione or not riga or numero(riga[0]) is None:
                continue
            colonna = {nome: i for i, nome in enumerate(intestazione)}

            def cella(nome):
                i = colonna.get(nome)
                return riga[i] if i is not None and i < len(riga) else ""

            gare = []
            for n in range(1, NUM_GARE + 1):
                i = colonna.get(f"GARA {n}")
                gare.append(numero(riga[i]) if i is not None and i < len(riga) else None)
            piloti.append({
                "pos": numero(cella("POS")),
                "team": cella("TEAM"),
                "nome": html.unescape(cella("PILOTA")),
                "punti": numero(cella("PUNTI")) or 0,
                "gare": gare,
            })
        if piloti:
            return piloti
    return []


def posizioni_dopo_ogni_gara(piloti: list) -> None:
    """Aggiunge a ogni pilota la posizione in classifica dopo ogni gara
    (`storico_pos`), ricostruita sommando i punti gara per gara: serve alle
    frecce di movimento senza dover salvare le classifiche precedenti."""
    for p in piloti:
        p["storico_pos"] = []
    for n in range(NUM_GARE):
        # il portale mostra 0 (non vuoto) anche per le gare non ancora corse:
        # una gara conta solo se qualcuno ha preso punti
        if all(not p["gare"][n] for p in piloti):
            break
        parziali = sorted(
            piloti,
            key=lambda p: (-sum(x or 0 for x in p["gare"][: n + 1]), p["pos"] or 999),
        )
        for posizione, p in enumerate(parziali, start=1):
            p["storico_pos"].append(posizione)
    # Le posizioni intermedie sono ricostruite dalle colonne gara e possono
    # scostarsi dal portale (bonus, penalita', spareggi): l'ultima e' sempre
    # la classifica vera.
    for p in piloti:
        if p["storico_pos"] and p["pos"]:
            p["storico_pos"][-1] = p["pos"]


# ---------------------------------------------------------------------------
# Risultati di gara: immagini del portale (OCR) + provvedimenti
# ---------------------------------------------------------------------------
def ocr_disponibile() -> bool:
    return sys.platform == "darwin" and (AUTO_DIR / "ocr.swift").exists()


def modulo_auto():
    """Riusa OCR e lettura delle righe di auto/auto_from_screenshots.py."""
    sys.path.insert(0, str(AUTO_DIR))
    import auto_from_screenshots as auto  # noqa: E402
    return auto


def leggi_immagine_gara(percorso: Path, auto) -> list:
    """Righe della classifica di una lobby dall'immagine del portale.

    IMPALCATURA: il formato dell'immagine non si conosce ancora (al
    2026-09-29 il portale non ha pubblicato nessuna gara). Per ora si prende
    ogni riga che inizia con una posizione e si tiene il resto come testo
    grezzo; il nome del pilota viene poi riconosciuto confrontandolo con i
    piloti della lobby. Da tarare sul primo PNG pubblicato.
    """
    osservazioni = auto.osserva_immagine(percorso)
    righe = []
    for riga in auto.raggruppa_righe(osservazioni):
        celle = [t.strip() for _, t in riga["celle"] if t.strip()]
        if not celle or not re.fullmatch(r"\d{1,2}", celle[0]):
            continue
        righe.append({"pos": int(celle[0]), "celle": celle[1:]})
    return righe


def abbina_nome(celle: list, candidati: list):
    """Il pilota (tra i candidati della lobby) che compare nelle celle."""
    testo = normalizza(" ".join(celle))
    migliore = None
    for c in candidati:
        chiave = normalizza(c["nome"])
        if chiave and chiave in testo and (not migliore or len(chiave) > len(normalizza(migliore["nome"]))):
            migliore = c
    return migliore


def risultati_lobby(gara: int, lega: str, lobby: str, piloti_lega: list, auto, usa_ocr: bool):
    """Classifica di una lobby, o None se il portale non l'ha pubblicata."""
    immagine = scarica(url_gara(gara, lega, f"{lobby}.png"), binario=True)
    if immagine is None:
        return None
    cartella = CACHE_DIR / f"G{gara}" / lega
    cartella.mkdir(parents=True, exist_ok=True)
    percorso = cartella / f"{lobby}.png"
    percorso.write_bytes(immagine)

    provvedimenti = json.loads(scarica(url_gara(gara, lega, f"{lobby}-dg.json")) or "[]")

    classifica = []
    if usa_ocr:
        for riga in leggi_immagine_gara(percorso, auto):
            pilota = abbina_nome(riga["celle"], piloti_lega)
            classifica.append({
                "pos": riga["pos"],
                "nome": pilota["nome"] if pilota else " ".join(riga["celle"][:1]),
                "team": pilota["team"] if pilota else "",
                "grezzo": riga["celle"],
            })
    return {
        "lega": lega,
        "immagine": url_gara(gara, lega, f"{lobby}.png"),
        "classifica": classifica,
        "provvedimenti": [
            {"nome": p.get("pilot", ""), "sanzione": p.get("sanction") or f"+{p.get('seconds', 0)} sec"}
            for p in provvedimenti if isinstance(p, dict)
        ],
    }


# ---------------------------------------------------------------------------
# Dettagli dagli screenshot (solo arricchimento)
# ---------------------------------------------------------------------------
def dettagli_screenshot(gara: int, lobby: str, auto) -> dict:
    """{nome normalizzato: {q, auto, distacco, giro}} dalla cache di auto/.

    Gli screenshot usano il soprannome GT7 con la sigla del team davanti
    ("SMI_Maureddu77"): l'abbinamento ai nomi del portale si fa dopo, per
    contenimento.
    """
    cartella = AUTO_DIR / ".screenshots" / f"GARA {gara}" / lobby
    if not cartella.exists():
        return {}
    dettagli = {}
    for percorso in auto.immagini_da_analizzare(cartella):
        osservazioni = auto.osserva_immagine(percorso)
        tipo = auto.tipo_classifica(osservazioni)
        for riga in auto.raggruppa_righe(osservazioni):
            voce = auto.leggi_riga(riga["celle"], [], percorso.name)
            if not voce:
                continue
            pos, nome, modello, _marca = voce
            # Lo stesso pilota puo' essere letto in modo diverso tra
            # qualifica e gara ("Sunl)own" / "Sun)own"): si riunisce.
            chiave = stessa_chiave(normalizza(nome), dettagli) or normalizza(nome)
            d = dettagli.setdefault(chiave, {"nome_gt7": nome})
            d["auto"] = modello
            if tipo == "gara":
                # Colonne della classifica di gara (frazione di larghezza):
                # TEMPO ~0.66, PENALITA' ~0.76, MIGLIOR GIRO ~0.85. La
                # penalita' ha lo stesso formato di un tempo (0:01.000):
                # le colonne si distinguono solo per posizione.
                d["distacco"] = next(
                    (t for x, t in riga["celle"] if COL_TEMPO[0] <= x < COL_TEMPO[1]), None
                )
                d["giro"] = next(
                    (t for x, t in riga["celle"]
                     if x >= COL_GIRO and re.fullmatch(r"\d:\d{2}\.\d{3}", t)), None
                )
            else:
                d["q"] = pos
    return dettagli


# Colonne della classifica di gara negli screenshot (vedi dettagli_screenshot)
COL_TEMPO = (0.62, 0.74)
COL_GIRO = 0.80


def stessa_chiave(chiave: str, dettagli: dict):
    """Chiave gia' presente che indica lo stesso pilota, se c'e'.

    Vale il contenimento (sigla del team davanti: "smimaureddu77" /
    "maureddu77") o una somiglianza alta (errori dell'OCR di un carattere).
    """
    if not chiave:
        return None
    if chiave in dettagli:
        return chiave
    migliore, punteggio = None, 0.0
    for k in dettagli:
        if len(min(k, chiave, key=len)) >= 4 and (k.endswith(chiave) or chiave.endswith(k)):
            return k
        simile = difflib.SequenceMatcher(None, k, chiave).ratio()
        if simile > punteggio:
            migliore, punteggio = k, simile
    return migliore if punteggio >= 0.8 else None


def arricchisci(lobby_dati: dict, dettagli: dict) -> None:
    for riga in lobby_dati["classifica"]:
        chiave = stessa_chiave(normalizza(riga["nome"]), dettagli)
        trovato = dettagli.get(chiave) if chiave else None
        if trovato:
            for campo in ("q", "auto", "distacco", "giro"):
                if trovato.get(campo) is not None:
                    riga[campo] = trovato[campo]
    righe = lobby_dati["classifica"]
    pole = next((r for r in righe if r.get("q") == 1), None)
    con_giro = [r for r in righe if r.get("giro")]
    lobby_dati["pole"] = pole["nome"] if pole else None
    lobby_dati["giro_veloce"] = min(con_giro, key=lambda r: r["giro"])["nome"] if con_giro else None


def conserva_dettagli(gare: dict, gare_prima: dict) -> None:
    """Non perde mai quello che era gia' stato letto.

    L'OCR e gli screenshot ci sono solo sul Mac: un aggiornamento fatto
    altrove (GitHub Actions, --no-ocr) ritrova le immagini del portale ma
    non sa leggerle. In quel caso la classifica della lobby e i dettagli
    (qualifica, auto, distacco, giro) restano quelli della volta prima.
    """
    for gara, dati_gara in gare.items():
        lobby_prima = gare_prima.get(gara, {}).get("lobby", {})
        for nome, lb in dati_gara["lobby"].items():
            prima = lobby_prima.get(nome)
            if not prima:
                continue
            if not lb["classifica"] and prima.get("classifica"):
                for campo in ("classifica", "pole", "giro_veloce"):
                    lb[campo] = prima.get(campo)
                continue
            righe_prima = {normalizza(r.get("nome")): r for r in prima.get("classifica", [])}
            for riga in lb["classifica"]:
                vecchia = righe_prima.get(normalizza(riga["nome"]), {})
                for campo in ("q", "auto", "distacco", "giro"):
                    if riga.get(campo) is None and vecchia.get(campo) is not None:
                        riga[campo] = vecchia[campo]
            for campo in ("pole", "giro_veloce"):
                if not lb.get(campo):
                    lb[campo] = prima.get(campo)


def senza_meta(dati: dict) -> str:
    """Contenuto confrontabile: senza la data di generazione."""
    copia = dict(dati)
    copia["meta"] = {k: v for k, v in (dati.get("meta") or {}).items() if k != "generated_at"}
    return json.dumps(copia, sort_keys=True, ensure_ascii=False)


# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description="Classifiche e risultati dal portale Union.")
    parser.add_argument("--dry-run", action="store_true", help="non scrive classifiche.json")
    parser.add_argument("--no-ocr", action="store_true", help="salta i risultati di gara (immagini)")
    args = parser.parse_args()

    print(f"· leggo il portale {PORTALE_PAGINA}")
    sorgente = scarica(PORTALE_PAGINA)
    pagine = variabile_json(sorgente, "pages") or {}
    movimenti = variabile_json(sorgente, "movementSummaryByLeague") or {}
    lobby = lobby_per_lega(sorgente)
    if not pagine:
        print("x Nel portale non trovo le classifiche (`pages`): e' cambiato il formato?")
        return 1

    leghe = {}
    for lega in LEGHE:
        piloti = classifica_lega(pagine.get(lega, ""))
        posizioni_dopo_ogni_gara(piloti)
        leghe[lega] = {"piloti": piloti, "lobby": lobby.get(lega, []), "movimenti": movimenti.get(lega, {})}
        gtv = sum(1 for p in piloti if p["team"].upper() == "GTV")
        print(f"  {lega:<10} {len(piloti):3d} piloti, {gtv} GTV, lobby {', '.join(lobby.get(lega, []))}")

    usa_ocr = not args.no_ocr and ocr_disponibile()
    if not args.no_ocr and not usa_ocr:
        print("! OCR non disponibile (serve macOS): risultati di gara senza classifica")
    auto = modulo_auto() if usa_ocr else None

    gare = {}
    for gara in range(1, NUM_GARE + 1):
        lobby_gara = {}
        for lega in LEGHE:
            for nome_lobby in lobby.get(lega, []):
                dati = risultati_lobby(gara, lega, nome_lobby, leghe[lega]["piloti"], auto, usa_ocr)
                if dati is None:
                    continue
                if auto:
                    arricchisci(dati, dettagli_screenshot(gara, nome_lobby, auto))
                lobby_gara[nome_lobby] = dati
        if lobby_gara:
            gare[str(gara)] = {"lobby": lobby_gara}
            print(f"  Gara {gara}: {len(lobby_gara)} lobby pubblicate")
        else:
            print(f"  Gara {gara}: non ancora pubblicata")

    precedente = {}
    if OUT_JSON.exists():
        try:
            precedente = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        except ValueError:
            print("! classifiche.json illeggibile: verra' riscritto da zero")
    conserva_dettagli(gare, precedente.get("gare", {}))

    dati = {
        "meta": {
            "generated_at": adesso(),
            "source": PORTALE_PAGINA,
            "gare_pubblicate": sorted(int(g) for g in gare),
        },
        "leghe": leghe,
        "gare": gare,
    }
    if args.dry_run:
        print("\n(dry-run: classifiche.json NON e' stato scritto)")
        return 0
    if senza_meta(dati) == senza_meta(precedente):
        print("\nNessuna novita' sul portale: classifiche.json invariato")
        return 0
    OUT_JSON.write_text(json.dumps(dati, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"\nOK → {OUT_JSON.relative_to(UNION_DIR.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
