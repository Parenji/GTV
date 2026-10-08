#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HUB UNION scraper
=================
Scarica i dati del sito https://sites.google.com/view/hubunion/home
(Campionato Union 2026 - Round 2) dai fogli Google pubblicati e genera
dati/union/lobby.json: le lobby della settimana (giorno, ora, host, live,
piloti) e i totali di iscritti, lobby e team.

Prima di scrivere controlla che i fogli abbiano risposto con dati sensati:
se il foglio non e' piu' pubblicato o cambia formato, il file vecchio resta
com'e' e lo script esce con errore (il workflow diventa rosso). Se cambia
solo l'orario di generazione il file non viene riscritto.

Nessuna dipendenza esterna: usa solo la libreria standard.
"""

import re
import sys
from collections import Counter, OrderedDict
from datetime import datetime, timezone
from pathlib import Path

# Percorsi assoluti, da qualunque directory venga lanciato: l'output va
# sempre in dati/union/lobby.json, che e' il file letto dal sito.
BASE_DIR = Path(__file__).resolve().parent
UNION_DIR = BASE_DIR.parent
REPO_DIR = UNION_DIR.parent
OUT_JSON = REPO_DIR / "dati" / "union" / "lobby.json"

sys.path.insert(0, str(UNION_DIR))
from comune import json_io, rete  # noqa: E402

# Sotto queste soglie i fogli hanno risposto male: meglio non scrivere
MIN_LOBBY = 10
MIN_PILOTI = 100
CALO_MASSIMO = 0.5  # rispetto al file precedente

# ---------------------------------------------------------------------------
# Configurazione: fogli pubblicati estratti dalle pagine Google Sites
# ---------------------------------------------------------------------------
SITE = "https://sites.google.com/view/hubunion"

# Foglio delle lobby: un solo spreadsheet con un tab per giorno (gid)
LOBBY_SHEET = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vQqsXv8SpRV0MjEZoAs7FS_D-6x8-vi4Qh3NaZMI8Wv6_7l5omK-XcOTl6yyQfejJjoiZPaVv0alX-K"
    "/pub?output=csv&gid={gid}"
)
LOBBY_GIDS = OrderedDict([
    ("LUNEDI",     0),
    ("MARTEDI",    731349085),
    ("MERCOLEDI",  850936328),
    ("GIOVEDI",    761215394),
    ("VENERDI",    2004422143),
])

# Foglio piloti (lista team, piloti, leghe)
PILOTI_SHEET = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vQXVz_C3lMo6Wa2VfHtNKRPhcKIsffNhLxh4d-KZjlDcZvAAulGxzspdKaeaADxBSNQGmkFrufWZmk2"
    "/pub?output=csv&gid=1560276304"
)

TIME_RE = re.compile(r"^Ore\s+(\d{1,2}:\d{2})$", re.IGNORECASE)
POS_RE = re.compile(r"^\d+$")


# ---------------------------------------------------------------------------
# Download helper
# ---------------------------------------------------------------------------
def fetch_csv(url: str) -> list:
    """Scarica un CSV pubblicato e lo converte in lista di righe."""
    return rete.scarica_csv(url)


# ---------------------------------------------------------------------------
# Parsing delle lobby
# ---------------------------------------------------------------------------
def find_blocks(rows: list) -> list:
    """
    Individua tutti i blocchi-lobby nel foglio.
    Ogni blocco inizia con una cella 'Ore HH:MM' seguita (colonna+1) dal nome
    lobby (es. A1) e (colonna+4) dalla categoria. Restituisce:
    [(row_index, col_index, time, name, category), ...]
    """
    blocks = []
    for ri, row in enumerate(rows):
        for ci, cell in enumerate(row):
            m = TIME_RE.match(cell.strip())
            if not m:
                continue
            name = row[ci + 1].strip() if ci + 1 < len(row) else ""
            cat = row[ci + 4].strip() if ci + 4 < len(row) else ""
            # ignora celle di titolo (es. 'Ore 21:00' usate come intestazioni)
            if name and re.match(r"^[A-Z]\d+$", name):
                blocks.append((ri, ci, m.group(1), name, cat))
    return blocks


def parse_block(rows: list, start_row: int, col: int, day: str) -> dict:
    """
    Estrae host, canale live e piloti di un blocco-lobby a partire dalla riga
    di intestazione (start_row) e dalla colonna (col) del blocco.
    """
    lobby = {
        "day": day,
        "time": None,
        "name": None,
        "category": None,
        "host": "",
        "live": "",
        "url": "",
        "pilots": [],
    }

    def cell(r, off):
        i = col + off
        return r[i].strip() if i < len(r) else ""

    # intestazione
    lobby["time"] = cell(rows[start_row], 0)
    lobby["name"] = cell(rows[start_row], 1)
    lobby["category"] = cell(rows[start_row], 4)

    for r in rows[start_row + 1:]:
        t0 = cell(r, 0)
        t1 = cell(r, 1)
        t4 = cell(r, 4)

        if TIME_RE.match(t0):
            break  # inizio di un altro blocco

        if t1 == "HOST":
            lobby["host"] = t4
        elif t1 == "LIVE":
            lobby["live"] = t4
        elif t4.startswith("http"):
            lobby["url"] = t4
        elif t1 == "Team":
            continue  # riga intestazione colonne
        elif POS_RE.match(t1):
            lobby["pilots"].append({
                "pos": int(t1),
                "matricola": cell(r, 2),
                "team": t4,
                "nome": cell(r, 5),
                "auto": cell(r, 6),
            })
        # righe vuote / righe duplicate -> ignorate

    # pulizia: rimuovi eventuali piloti senza nome (righe di riempimento)
    lobby["pilots"] = [p for p in lobby["pilots"] if p["nome"]]
    return lobby


def parse_lobbies() -> list:
    lobbies = []
    for day, gid in LOBBY_GIDS.items():
        rows = fetch_csv(LOBBY_SHEET.format(gid=gid))
        blocks = find_blocks(rows)
        for (ri, ci, time, name, cat) in blocks:
            lb = parse_block(rows, ri, ci, day)
            lobbies.append(lb)
    # ordina per giorno e nome lobby
    day_order = {d: i for i, d in enumerate(LOBBY_GIDS)}
    lobbies.sort(key=lambda lb: (day_order.get(lb["day"], 99), lb["name"]))
    return lobbies


# ---------------------------------------------------------------------------
# Parsing dei piloti (foglio PILOTI)
# ---------------------------------------------------------------------------
def parse_piloti() -> list:
    rows = fetch_csv(PILOTI_SHEET)
    pilots = []
    for r in rows:
        if len(r) >= 7 and POS_RE.match(r[2].strip()):
            pilots.append({
                "prog": int(r[2].strip()),
                "team": r[3].strip(),
                "nome": r[4].strip(),
                "categoria": r[5].strip(),
                "lobby_group": r[6].strip(),
            })
    return pilots


# ---------------------------------------------------------------------------
# Statistiche
# ---------------------------------------------------------------------------
def build_stats(lobbies, pilots):
    return {
        "total_pilots": len(pilots),
        "total_lobbies": len(lobbies),
        "total_teams": len(Counter(p["team"] for p in pilots)),
        "lobbies_per_day": dict(Counter(lb["day"] for lb in lobbies)),
    }


def controlla(lobbies, pilots):
    """Problemi che impediscono di scrivere il file (lista vuota = tutto ok)."""
    problemi = []
    if len(lobbies) < MIN_LOBBY:
        problemi.append(f"solo {len(lobbies)} lobby (minimo {MIN_LOBBY})")
    if len(pilots) < MIN_PILOTI:
        problemi.append(f"solo {len(pilots)} piloti iscritti (minimo {MIN_PILOTI})")
    prima = json_io.leggi(OUT_JSON, {}) or {}
    lobby_prima = len(prima.get("lobbies") or [])
    if lobby_prima and len(lobbies) < lobby_prima * CALO_MASSIMO:
        problemi.append(f"le lobby sono scese da {lobby_prima} a {len(lobbies)}")
    return problemi
# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("Scarico il foglio PILOTI…")
    pilots = parse_piloti()
    print(f"  {len(pilots)} piloti trovati")

    print("Scarico i fogli LOBBY…")
    lobbies = parse_lobbies()
    print(f"  {len(lobbies)} lobby trovate")
    for lb in lobbies:
        print(f"    {lb['day']:10s} {lb['name']:4s} {lb['category']:10s} "
              f"{lb['time']:8s} host={lb['host'] or '-':20s} piloti={len(lb['pilots'])}")

    problemi = controlla(lobbies, pilots)
    if problemi:
        print("\nx Dati sospetti, " + OUT_JSON.name + " NON aggiornato:", file=sys.stderr)
        for p in problemi:
            print(f"  - {p}", file=sys.stderr)
        return 1

    data = {
        "meta": {
            "source": SITE,
            "title": "HUB UNION - Campionato Union 2026 Round 2",
            # Momento (UTC) dell'ultima generazione con dati cambiati
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "stats": build_stats(lobbies, pilots),
        "lobbies": lobbies,
    }

    if json_io.scrivi_se_cambiato(OUT_JSON, data, indent=2):
        print(f"\nOK → {OUT_JSON.relative_to(REPO_DIR)} ({len(pilots)} piloti, {len(lobbies)} lobby)")
    else:
        print("\nNessuna novita' nei fogli: file invariato")
    return 0


if __name__ == "__main__":
    sys.exit(main())