"""Calendario Union: dati/union/calendario.json (lo legge anche il sito)."""

import json

from . import DATI_DIR

CALENDARIO_JSON = DATI_DIR / "union" / "calendario.json"


def carica(percorso=None):
    cal = json.loads((percorso or CALENDARIO_JSON).read_text(encoding="utf-8"))
    if not cal.get("gare"):
        raise ValueError(f"Calendario senza gare: {percorso or CALENDARIO_JSON}")
    return cal


def gare_di_campionato(cal=None):
    """Gare che contano in classifica generale (la Finale e' a parte)."""
    cal = cal or carica()
    return [g for g in cal["gare"] if g.get("tipo", "gara") == "gara"]
