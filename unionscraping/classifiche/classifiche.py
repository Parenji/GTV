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
immagini. Scrive dati/union/classifiche.json, letto da union.js.

Niente stato tra un'esecuzione e l'altra: a ogni giro tutto si ricostruisce
dal portale. I punti gara per gara vengono dalla colonna Punti delle
immagini; la differenza con il totale ufficiale (bonus, penalita') va
sull'ultima gara corsa, cosi' la somma torna sempre. La posizione dopo ogni
gara (`storico_pos`) e' la classifica dei punti cumulati, e per l'ultima
gara quella ufficiale. Un giro saltato o un file azzerato non perdono nulla.

Le immagini gia' lette stanno in cache.json (accanto allo script, committato
ma non pubblicato), indicizzate per ETag: un'immagine invariata non si
rilegge. Su Linux l'OCR non c'e': se serve leggere un'immagine nuova lo
script si ferma senza scrivere (`--controlla` dice prima se serve un Mac).

Uso:
    python3 classifiche.py              # aggiorna classifiche.json
    python3 classifiche.py --dry-run    # mostra cosa ha trovato, non scrive
    python3 classifiche.py --controlla  # serve l'OCR? (per il workflow)
    python3 classifiche.py --rileggi    # rilegge anche le immagini invariate
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import tempfile
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
UNION_DIR = BASE_DIR.parent
REPO_DIR = UNION_DIR.parent
OUT_JSON = REPO_DIR / "dati" / "union" / "classifiche.json"
CACHE_JSON = BASE_DIR / "cache.json"

sys.path.insert(0, str(UNION_DIR))
from comune import calendario, json_io, nomi, ocr, rete  # noqa: E402

PORTALE = "https://albixximo-union2026-r2.vercel.app"
PORTALE_PAGINA = f"{PORTALE}/Classifiche/portal.html"
NUM_GARE = len(calendario.gare_di_campionato())
LEGHE = ["STAR", "ELITE", "PRO GOLD", "PRO SILVER", "PRO AMA", "AMA"]


def adesso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def url_gara(gara: int, lega: str, nome: str) -> str:
    return f"{PORTALE}/Gare/G{gara}/{urllib.parse.quote(lega)}/{nome}"


normalizza = nomi.normalizza


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


def punti_gara(piloti: list, corse: int, gare: dict, lega: str) -> None:
    """Punti di ogni gara (`gare`) dalle immagini del portale.

    Chi ha un esito senza riga nell'immagine (assente, NC) fa 0. La
    differenza tra la somma e il totale ufficiale va sull'ultima gara corsa,
    o sull'unica gara rimasta senza punti: bonus e penalita' finiscono li'.
    """
    righe = {}
    for n, dati_gara in gare.items():
        for lb in dati_gara["lobby"].values():
            if lb["lega"] != lega:
                continue
            for r in lb["classifica"]:
                if r.get("punti") is not None:
                    righe[(int(n), normalizza(r["nome"]))] = r["punti"]
    for p in piloti:
        chiave = normalizza(p["nome"])
        valori = [None] * NUM_GARE
        for n in range(1, corse + 1):
            punti = righe.get((n, chiave))
            if punti is None and p["esiti"][n - 1] and "stato" in p["esiti"][n - 1]:
                punti = 0
            valori[n - 1] = punti
        if corse:
            mancanti = [i for i in range(corse) if valori[i] is None]
            noti = sum(v for v in valori[:corse] if v is not None)
            if not mancanti:
                valori[corse - 1] += p["punti"] - noti
            elif len(mancanti) == 1:
                valori[mancanti[0]] = p["punti"] - noti
        p["gare"] = valori


def storico_posizioni(piloti: list, corse: int) -> None:
    """Posizione in classifica dopo ogni gara (`storico_pos`).

    Per le gare passate: classifica dei punti cumulati, pari merito alla pari
    (1, 1, 3...). Per l'ultima gara: la posizione ufficiale del portale.
    """
    cumulati = []
    for p in piloti:
        somma, serie = 0, []
        for v in p["gare"][:corse]:
            somma = None if somma is None or v is None else somma + v
            serie.append(somma)
        cumulati.append(serie)
    for i, p in enumerate(piloti):
        storico = []
        for n in range(corse):
            mio = cumulati[i][n]
            if n == corse - 1:
                storico.append(p["pos"])
            elif mio is None:
                storico.append(None)
            else:
                storico.append(1 + sum(1 for c in cumulati if c[n] is not None and c[n] > mio))
        p["storico_pos"] = storico


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


def leggi_immagine_gara(percorso: Path) -> list:
    """Righe della classifica di una lobby, dall'alto in basso.

    Ogni riga: {pos, nome, auto, q_tempo, distacco, giro, punti}; i campi che
    il portale lascia vuoti ("---", "NO TIME", "-") sono None.
    """
    osservazioni = ocr.osserva(percorso)
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
        simile = nomi.somiglianza(nome_c, chiave)
        esito = (c.get("esiti") or [None] * NUM_GARE)[gara - 1] or {}
        stessa_pos = esito.get("pos") == pos or ("stato" in esito and not punti)
        if simile < 0.95 and not (simile >= 0.78 and stessa_pos):
            continue
        valore = simile + (0.1 if stessa_pos else 0)
        if valore > punteggio:
            migliore, punteggio = c, valore
    return migliore


class ServeOcr(Exception):
    """Un'immagine nuova va letta, ma qui l'OCR non c'e' (non e' un Mac)."""


def risultati_lobby(gara: int, lega: str, lobby: str, piloti_lega: list, usa_ocr: bool, cache: dict, rileggi: bool):
    """Classifica di una lobby, o None se il portale non l'ha pubblicata.

    `cache` ({"G1/STAR/A1": {...}}) viene aggiornata con quello che si legge.
    """
    url = url_gara(gara, lega, f"{lobby}.png")
    impronta = rete.impronta(url)
    if impronta is None:
        return None
    chiave = f"G{gara}/{lega}/{lobby}"
    prima = cache.get(chiave)
    if prima and prima.get("impronta") == impronta and prima.get("classifica") and not rileggi:
        return prima  # immagine invariata: si riusa quello gia' letto
    if not usa_ocr:
        raise ServeOcr(chiave)

    with tempfile.TemporaryDirectory() as cartella:
        percorso = Path(cartella) / f"{lobby}.png"
        percorso.write_bytes(rete.scarica(url, binario=True))
        righe = leggi_immagine_gara(percorso)

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

    con_giro = [r for r in righe if r["giro"]]
    pole = next((r for r in righe if r["q"] == 1), None)
    cache[chiave] = {
        "lega": lega,
        "immagine": url,
        "impronta": impronta,
        "classifica": righe,
        "pole": pole["nome"] if pole else None,
        "giro_veloce": min(con_giro, key=lambda r: secondi(r["giro"]))["nome"] if con_giro else None,
    }
    return cache[chiave]


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


def carica_cache() -> dict:
    """Immagini gia' lette. La prima volta si riparte da classifiche.json."""
    cache = json_io.leggi(CACHE_JSON)
    if cache is not None:
        return cache
    cache = {}
    for n, dati_gara in ((json_io.leggi(OUT_JSON, {}) or {}).get("gare") or {}).items():
        for lobby, lb in dati_gara.get("lobby", {}).items():
            if lb.get("impronta"):
                cache[f"G{n}/{lb['lega']}/{lobby}"] = lb
    return cache


def scrivi_output_github(chiave: str, valore: str) -> None:
    uscita = os.environ.get("GITHUB_OUTPUT")
    if uscita:
        with open(uscita, "a", encoding="utf-8") as f:
            f.write(f"{chiave}={valore}\n")


def controlla_dati(leghe: dict, precedente: dict) -> list:
    """Problemi che impediscono di scrivere (lista vuota = tutto ok)."""
    problemi = []
    for lega in LEGHE:
        if not leghe[lega]["piloti"]:
            problemi.append(f"{lega}: classifica vuota")
        prima = ((precedente.get("leghe") or {}).get(lega) or {}).get("gare_corse") or 0
        if leghe[lega]["gare_corse"] < prima:
            problemi.append(f"{lega}: gare corse scese da {prima} a {leghe[lega]['gare_corse']}")
    return problemi


# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description="Classifiche e risultati dal portale Union.")
    parser.add_argument("--dry-run", action="store_true", help="non scrive classifiche.json")
    parser.add_argument("--controlla", action="store_true",
                        help="dice solo se ci sono immagini nuove da leggere con l'OCR (serve_ocr=true|false)")
    parser.add_argument("--rileggi", action="store_true", help="rilegge tutte le immagini, anche se invariate")
    parser.add_argument("--forza", action="store_true", help="scrive anche se i controlli di sanita' falliscono")
    args = parser.parse_args()

    precedente = json_io.leggi(OUT_JSON, {}) or {}
    cache = carica_cache()

    print(f"· leggo il portale {PORTALE_PAGINA}")
    sorgente = rete.scarica(PORTALE_PAGINA)
    pagine = variabile_json(sorgente or "", "pages") or {}
    lobby = lobby_per_lega(sorgente or "")
    if not pagine:
        print("x Nel portale non trovo le classifiche (`pages`): e' cambiato il formato?")
        return 1

    leghe = {}
    for lega in LEGHE:
        piloti, corse = classifica_lega(pagine.get(lega, ""))
        leghe[lega] = {"gare_corse": corse, "piloti": piloti}
        gtv = sum(1 for p in piloti if nomi.e_gtv(p["team"]))
        print(f"  {lega:<10} {len(piloti):3d} piloti, {gtv} GTV, dopo la gara {corse}, lobby {', '.join(lobby.get(lega, []))}")

    usa_ocr = ocr.disponibile() and not args.controlla
    gare = {}
    try:
        for gara in range(1, NUM_GARE + 1):
            lobby_gara = {}
            for lega in LEGHE:
                for nome_lobby in lobby.get(lega, []):
                    dati = risultati_lobby(gara, lega, nome_lobby, leghe[lega]["piloti"], usa_ocr, cache, args.rileggi)
                    if dati is not None:
                        lobby_gara[nome_lobby] = {k: v for k, v in dati.items() if k != "impronta"}
            if lobby_gara:
                gare[str(gara)] = {"lobby": lobby_gara}
                print(f"  Gara {gara}: {len(lobby_gara)} lobby pubblicate")
            else:
                print(f"  Gara {gara}: non ancora pubblicata")
    except ServeOcr as nuova:
        print(f"! immagine nuova da leggere ({nuova}): serve l'OCR di macOS")
        scrivi_output_github("serve_ocr", "true")
        return 0 if args.controlla else 3
    if args.controlla:
        print("· nessuna immagine nuova: basta Linux")
        scrivi_output_github("serve_ocr", "false")
        return 0

    for lega in LEGHE:
        corse = leghe[lega]["gare_corse"]
        punti_gara(leghe[lega]["piloti"], corse, gare, lega)
        storico_posizioni(leghe[lega]["piloti"], corse)
    verifica(leghe, gare)

    dati = {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "source": PORTALE_PAGINA,
            "gare_pubblicate": sorted(int(g) for g in gare),
        },
        "leghe": leghe,
        "gare": gare,
    }
    if args.dry_run:
        print("\n(dry-run: classifiche.json NON e' stato scritto)")
        return 0
    problemi = controlla_dati(leghe, precedente)
    if problemi and not args.forza:
        print("\nx Dati sospetti, classifiche.json NON aggiornato (--forza per scrivere comunque):")
        for p in problemi:
            print(f"  - {p}")
        return 1
    json_io.scrivi_se_cambiato(CACHE_JSON, cache)
    if json_io.scrivi_se_cambiato(OUT_JSON, dati):
        print(f"\nOK → {OUT_JSON.relative_to(REPO_DIR)}")
    else:
        print("\nNessuna novita' sul portale: classifiche.json invariato")
    return 0


if __name__ == "__main__":
    sys.exit(main())
