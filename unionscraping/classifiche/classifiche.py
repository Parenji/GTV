#!/usr/bin/env python3
"""
classifiche.py — classifiche generali e risultati di gara dal portale Union.

Fonte unica: il "Portale Classifiche Union" (Round 2)
    https://albixximo-union2026-r2.vercel.app/Classifiche/portal.html

Com'e' fatto il portale (verificato il 2026-10-03, dopo la Gara 1):
  - le CLASSIFICHE GENERALI sono pagine HTML incorporate nel portale, una per
    lega, nell'oggetto JavaScript `pages`. Colonne: Pos, Team, Pilota, Punti,
    Gara 1..5. Attenzione: i pari merito hanno la Pos VUOTA (valgono la Pos
    della riga sopra), e le celle gara non contengono i punti ma il
    piazzamento ("1°"), le stelle di pole (oro) e giro veloce (viola) oppure
    uno stato (A assenza, NC, BOX, DSQ). Si leggono senza OCR;
  - le lobby di ogni lega stanno nell'oggetto `lobbiesByLeague`;
  - i RISULTATI DI GARA sono immagini 4K, una per lobby:
        /Gare/G<n>/<LEGA>/<LOBBY>.png
    con classifica definitiva completa: pilota, auto, qualifica, tempo gara,
    direzione gara, miglior giro, punti. Si leggono con l'OCR di macOS
    (Vision), riga per riga e colonna per colonna.
    (I provvedimenti della DG non si leggono da qui: il portale non li mostra
    e stanno gia' nel foglio del Report DG.)

Una gara compare nei risultati solo quando il portale ne ha pubblicato le
immagini. Scrive unionscraping/classifiche.json, letto da union.js.

Uso:
    python3 classifiche.py              # aggiorna classifiche.json
    python3 classifiche.py --dry-run    # mostra cosa ha trovato, non scrive
    python3 classifiche.py --no-ocr     # solo classifiche generali (ovunque)
    python3 classifiche.py --rileggi    # rilegge anche le immagini invariate
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


def pulisci(frammento: str) -> str:
    """Testo di un frammento HTML, con gli spazi ripuliti."""
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", frammento)).split())


def numero(testo: str):
    testo = (testo or "").strip().replace(",", ".")
    if re.fullmatch(r"-?\d+(\.\d+)?", testo):
        valore = float(testo)
        return int(valore) if valore.is_integer() else valore
    return None


def esito_gara(cella: str):
    """Esito di un pilota in una gara, dalla cella del portale.

    `{"pos": 3, "pole": True, "fl": True}`, oppure `{"stato": "NC"}` per
    A (AG assenza giustificata, AI ingiustificata), NC, BOX, DSQ. None se il
    pilota non ha ancora corso. Le stelle si distinguono dal colore: oro =
    pole, viola = giro veloce.
    """
    testo = pulisci(cella.replace("★", ""))
    stelle = re.findall(r"color:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)[^\"]*\">\s*★", cella)
    pole = any(int(r) >= 200 and int(b) < 120 for r, _g, b in stelle)
    giro = any(not (int(r) >= 200 and int(b) < 120) for r, _g, b in stelle)

    piazzato = re.fullmatch(r"(\d+)\s*°", testo)
    if piazzato:
        esito = {"pos": int(piazzato.group(1))}
    elif testo == "A":
        # arancione = giustificata, rosso = ingiustificata
        esito = {"stato": "AI" if "220, 53, 69" in cella else "AG"}
    elif testo in ("NC", "BOX", "DSQ"):
        esito = {"stato": testo}
    else:
        return None
    if pole:
        esito["pole"] = True
    if giro:
        esito["fl"] = True
    return esito


def classifica_lega(pagina: str):
    """(righe, gare corse) della classifica generale di una lega.

    Le colonne si riconoscono dall'intestazione, cosi' un cambio di ordine nel
    portale non rompe la lettura. I pari merito hanno la Pos vuota: valgono la
    Pos della riga sopra (`pari`: True), come nella tabella del portale.
    """
    corse = re.search(r"STANDINGS\s*[•·-]\s*GARA\s*(\d+)", pulisci(pagina))
    piloti, colonna, pos_corrente = [], None, None
    for riga in re.findall(r"<tr\b.*?</tr>", pagina, re.S):
        celle = re.findall(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", riga, re.S)
        testi = [pulisci(c) for c in celle]
        if "POS" in [t.upper() for t in testi] and "PILOTA" in [t.upper() for t in testi]:
            colonna = {t.upper(): i for i, t in enumerate(testi)}
            continue
        if colonna is None or len(celle) < len(colonna):
            continue

        def posto(nome):
            i = colonna.get(nome)
            return i if i is not None and i < len(celle) else None

        nome = testi[colonna["PILOTA"]]
        if not nome:
            continue
        pos = numero(testi[colonna["POS"]])
        pari = pos is None
        if pos is not None:
            pos_corrente = pos
        gare, esiti = [], []
        for n in range(1, NUM_GARE + 1):
            i = posto(f"GARA {n}")
            esiti.append(esito_gara(celle[i]) if i is not None else None)
            gare.append(None)
        riga_pilota = {
            "pos": pos_corrente,
            "team": testi[colonna["TEAM"]] if "TEAM" in colonna else "",
            "nome": nome,
            "punti": numero(testi[colonna["PUNTI"]]) or 0,
            "gare": gare,
            "esiti": esiti,
        }
        if pari:
            riga_pilota["pari"] = True
        piloti.append(riga_pilota)
    return piloti, int(corse.group(1)) if corse else 0


def aggiorna_storico(lega: str, piloti: list, corse: int, precedenti: dict) -> None:
    """Punti gara per gara (`gare`) e posizione dopo ogni gara (`storico_pos`).

    Il portale mostra solo la classifica di adesso. Quello che era gia' stato
    letto nelle esecuzioni precedenti si conserva; per la gara piu' recente i
    punti sono la differenza tra il totale di adesso e quello prima, cosi'
    la somma torna sempre con la classifica ufficiale (bonus, penalita').
    """
    for p in piloti:
        prima = precedenti.get((lega, normalizza(p["nome"]))) or {}
        gare = list(prima.get("gare") or [None] * NUM_GARE)
        gare += [None] * (NUM_GARE - len(gare))
        storico = list(prima.get("storico_pos") or [])
        if corse:
            noti = gare[: corse - 1]
            if all(v is not None for v in noti):
                gare[corse - 1] = p["punti"] - sum(noti)
            elif corse == 1:
                gare[0] = p["punti"]
            storico = (storico + [None] * corse)[:corse]
            storico[corse - 1] = p["pos"]
        # le gare non ancora corse non hanno punti
        for n in range(corse, NUM_GARE):
            gare[n] = None
        p["gare"], p["storico_pos"] = gare[:NUM_GARE], storico


# ---------------------------------------------------------------------------
# Risultati di gara: immagini del portale (OCR)
# ---------------------------------------------------------------------------
# Colonne della classifica definitiva, come frazione della larghezza (le
# immagini sono sempre 16:9). A sinistra del nome c'e' solo la medaglia o il
# numero in un cerchio: la posizione si prende dall'ordine delle righe.
COLONNE = {
    "nome": (0.040, 0.175),
    "auto": (0.175, 0.330),
    "qualifica": (0.330, 0.450),
    "tempo": (0.450, 0.545),
    "giro": (0.800, 0.925),
    "punti": (0.925, 1.000),
}
# Raggruppa in una riga i blocchi di testo vicini in verticale (frazione
# dell'altezza). Le righe sono distanti ~0.045: due testi su due righe nella
# stessa cella ("SQUALIFICA" / "PROSSIMA GARA") restano nella stessa riga.
GAP_RIGA = 0.020
TEMPO_GIRO = re.compile(r"\d:\d{2}\.\d{3}")


def ocr_disponibile() -> bool:
    return sys.platform == "darwin" and (AUTO_DIR / "ocr.swift").exists()


def modulo_auto():
    """Riusa l'OCR (Vision di macOS) di auto/auto_from_screenshots.py."""
    sys.path.insert(0, str(AUTO_DIR))
    import auto_from_screenshots as auto  # noqa: E402
    return auto


def leggi_immagine_gara(percorso: Path, auto) -> list:
    """Righe della classifica di una lobby, dall'alto in basso.

    Ogni riga: {pos, nome, auto, q_tempo, distacco, giro, punti}; i campi che
    il portale lascia vuoti ("---", "NO TIME", "-") sono None.
    """
    osservazioni = auto.osserva_immagine(percorso)
    intestazione = next((y + h / 2 for _x, y, _w, h, t in osservazioni if t.strip() == "Pilota"), 0.668)
    corpo = sorted(
        (y + h / 2, x, t.strip()) for x, y, _w, h, t in osservazioni
        if y + h / 2 < intestazione - 0.012 and t.strip()
    )
    corpo.sort(key=lambda o: -o[0])

    gruppi, ultimo = [], None
    for centro, x, testo in corpo:
        if ultimo is None or ultimo - centro > GAP_RIGA:
            gruppi.append([])
        gruppi[-1].append((x, testo))
        ultimo = centro

    righe = []
    for gruppo in gruppi:
        def colonna(nome):
            da, a = COLONNE[nome]
            return " ".join(t for x, t in sorted(gruppo) if da <= x < a).strip()

        nome = colonna("nome")
        if not nome:
            continue  # niente nome: non e' una riga di pilota (sponsor, footer)
        modello = colonna("auto")
        modello = re.sub("[\"’`]", "'", modello)  # l'OCR legge '19 come "19
        q = TEMPO_GIRO.search(colonna("qualifica"))
        giro = TEMPO_GIRO.search(colonna("giro"))
        punti = re.match(r"\d+", colonna("punti"))
        tempo = colonna("tempo")
        righe.append({
            "pos": len(righe) + 1,
            "nome": nome,
            "auto": None if not modello or set(modello) <= {"-"} else modello,
            "q_tempo": q.group(0) if q else None,
            "distacco": tempo if re.search(r"\d|DOPP", tempo) else None,
            "giro": giro.group(0) if giro else None,
            "punti": int(punti.group(0)) if punti else None,
        })
    return righe


def secondi(tempo: str) -> float:
    minuti, resto = tempo.split(":")
    return int(minuti) * 60 + float(resto)


def abbina_pilota(nome: str, pos: int, punti, gara: int, candidati: list, usati: set):
    """Il pilota della classifica generale che corrisponde a una riga di gara.

    Il nome letto dall'OCR puo' avere un carattere sbagliato: si confronta per
    somiglianza e si usa il piazzamento che la classifica generale riporta per
    quella gara come riscontro (un nome quasi uguale e la stessa posizione
    bastano, un nome identico basta da solo). Chi non ha un piazzamento
    (assente, NC, BOX) ha uno stato e 0 punti: vale come riscontro anche quello.
    """
    chiave = normalizza(nome)
    migliore, punteggio = None, 0.0
    for c in candidati:
        if id(c) in usati:
            continue
        nome_c = normalizza(c["nome"])
        simile = 1.0 if nome_c == chiave else difflib.SequenceMatcher(None, nome_c, chiave).ratio()
        esito = (c.get("esiti") or [None] * NUM_GARE)[gara - 1] or {}
        stessa_pos = esito.get("pos") == pos or ("stato" in esito and not punti)
        if simile < 0.95 and not (simile >= 0.78 and stessa_pos):
            continue
        valore = simile + (0.1 if stessa_pos else 0)
        if valore > punteggio:
            migliore, punteggio = c, valore
    return migliore


def info_immagine(url: str):
    """Impronta dell'immagine (ETag) senza scaricarla, o None se non esiste."""
    richiesta = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(richiesta, timeout=60) as risposta:
            return (
                risposta.headers.get("ETag")
                or f"{risposta.headers.get('Content-Length')}-{risposta.headers.get('Last-Modified')}"
            )
    except urllib.error.HTTPError as errore:
        if errore.code == 404:
            return None
        raise


def risultati_lobby(gara: int, lega: str, lobby: str, piloti_lega: list, auto, prima: dict | None):
    """Classifica di una lobby, o None se il portale non l'ha pubblicata."""
    url = url_gara(gara, lega, f"{lobby}.png")
    impronta = info_immagine(url)
    if impronta is None:
        return None
    if prima and prima.get("impronta") == impronta and prima.get("classifica"):
        return prima  # immagine invariata: si riusa quello gia' letto

    classifica = []
    if auto:
        immagine = scarica(url, binario=True)
        cartella = CACHE_DIR / f"G{gara}" / lega
        cartella.mkdir(parents=True, exist_ok=True)
        percorso = cartella / f"{lobby}.png"
        percorso.write_bytes(immagine)
        righe = leggi_immagine_gara(percorso, auto)
        percorso.unlink(missing_ok=True)  # resta solo il testo OCR

        usati = set()
        for riga in righe:
            pilota = abbina_pilota(riga["nome"], riga["pos"], riga["punti"], gara, piloti_lega, usati)
            if pilota:
                usati.add(id(pilota))
            riga["nome"] = pilota["nome"] if pilota else riga["nome"]
            riga["team"] = pilota["team"] if pilota else ""
            stato = ((pilota or {}).get("esiti") or [None] * NUM_GARE)[gara - 1] or {}
            if "stato" in stato:
                riga["stato"] = stato["stato"]  # AG/AI assente, NC, BOX, DSQ
        quali = sorted((secondi(r["q_tempo"]), r["pos"]) for r in righe if r["q_tempo"])
        for q, (_t, pos) in enumerate(quali, start=1):
            righe[pos - 1]["q"] = q
        for r in righe:
            r.pop("q_tempo")
            r.setdefault("q", None)
        classifica = righe
    elif prima and prima.get("classifica"):
        return prima  # niente OCR (non e' un Mac): si tiene quello di prima

    con_giro = [r for r in classifica if r["giro"]]
    pole = next((r for r in classifica if r["q"] == 1), None)
    return {
        "lega": lega,
        "immagine": url,
        "impronta": impronta,
        "classifica": classifica,
        "pole": pole["nome"] if pole else None,
        "giro_veloce": min(con_giro, key=lambda r: secondi(r["giro"]))["nome"] if con_giro else None,
    }


def punti_da_gare(piloti: list, gara: int, lobby_gara: dict, lega: str) -> None:
    """Dove la gara non ha ancora i punti (pilota nuovo nel file), li prende
    dalla colonna Punti dell'immagine."""
    for lb in lobby_gara.values():
        if lb["lega"] != lega:
            continue
        for riga in lb["classifica"]:
            if riga["punti"] is None:
                continue
            for p in piloti:
                if p["nome"] == riga["nome"] and p["gare"][gara - 1] is None:
                    p["gare"][gara - 1] = riga["punti"]


def verifica(leghe: dict, gare: dict) -> None:
    """Segnala quello che non torna (OCR sbagliato, formato cambiato)."""
    for lega, dati in leghe.items():
        piloti = dati["piloti"]
        for n, dati_gara in gare.items():
            lobby = {k: v for k, v in dati_gara["lobby"].items() if v["lega"] == lega}
            attesi = sum(1 for p in piloti if ((p["esiti"][int(n) - 1] or {}).get("pos")))
            letti = sum(1 for lb in lobby.values() for r in lb["classifica"] if r["team"] or r["pos"])
            senza = [r["nome"] for lb in lobby.values() for r in lb["classifica"] if not r["team"] and r["pos"] <= 3]
            print(f"  {lega:<10} G{n}: {len(lobby)} lobby, {letti} righe lette, {attesi} piazzati in classifica generale"
                  + (f"  ! nomi non abbinati: {', '.join(senza)}" if senza else ""))


def senza_meta(dati: dict) -> str:
    """Contenuto confrontabile: senza la data di generazione."""
    copia = dict(dati)
    copia["meta"] = {k: v for k, v in (dati.get("meta") or {}).items() if k != "generated_at"}
    return json.dumps(copia, sort_keys=True, ensure_ascii=False)


# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description="Classifiche e risultati dal portale Union.")
    parser.add_argument("--dry-run", action="store_true", help="non scrive classifiche.json")
    parser.add_argument("--no-ocr", action="store_true", help="salta la lettura delle immagini di gara")
    parser.add_argument("--rileggi", action="store_true", help="rilegge tutte le immagini, anche se invariate")
    args = parser.parse_args()

    precedente = {}
    if OUT_JSON.exists():
        try:
            precedente = json.loads(OUT_JSON.read_text(encoding="utf-8"))
        except ValueError:
            print("! classifiche.json illeggibile: verra' riscritto da zero")
    prima_piloti = {
        (lega, normalizza(p["nome"])): p
        for lega, d in (precedente.get("leghe") or {}).items() for p in d.get("piloti", [])
    }

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
        piloti, corse = classifica_lega(pagine.get(lega, ""))
        aggiorna_storico(lega, piloti, corse, prima_piloti)
        leghe[lega] = {"gare_corse": corse, "piloti": piloti, "lobby": lobby.get(lega, []), "movimenti": movimenti.get(lega, {})}
        gtv = sum(1 for p in piloti if p["team"].upper() == "GTV")
        print(f"  {lega:<10} {len(piloti):3d} piloti, {gtv} GTV, dopo la gara {corse}, lobby {', '.join(lobby.get(lega, []))}")

    usa_ocr = not args.no_ocr and ocr_disponibile()
    if not args.no_ocr and not usa_ocr:
        print("! OCR non disponibile (serve macOS): risultati di gara senza classifica")
    auto = modulo_auto() if usa_ocr else None

    gare = {}
    for gara in range(1, NUM_GARE + 1):
        lobby_gara = {}
        prima_gara = ((precedente.get("gare") or {}).get(str(gara)) or {}).get("lobby", {})
        for lega in LEGHE:
            for nome_lobby in lobby.get(lega, []):
                dati = risultati_lobby(
                    gara, lega, nome_lobby, leghe[lega]["piloti"], auto,
                    None if args.rileggi else prima_gara.get(nome_lobby),
                )
                if dati is not None:
                    lobby_gara[nome_lobby] = dati
        if lobby_gara:
            gare[str(gara)] = {"lobby": lobby_gara}
            print(f"  Gara {gara}: {len(lobby_gara)} lobby pubblicate")
            for lega in LEGHE:
                punti_da_gare(leghe[lega]["piloti"], gara, lobby_gara, lega)
        else:
            print(f"  Gara {gara}: non ancora pubblicata")
    verifica(leghe, gare)

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
