"""Nomi dei piloti: normalizzazione, somiglianza, riconoscimento dei GTV."""

import difflib
import re
import unicodedata


def normalizza(testo):
    """Solo lettere e cifre minuscole, senza accenti: "Ñico_GTV" -> "nicogtv"."""
    testo = unicodedata.normalize("NFKD", str(testo or ""))
    testo = "".join(c for c in testo if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", testo.lower())


def somiglianza(a, b):
    """0..1 tra due nomi gia' normalizzati (1 = identici)."""
    if a == b:
        return 1.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def e_gtv(team):
    """Il pilota corre per GTV: nelle fonti Union il team e' la sigla "GTV"."""
    return str(team or "").strip().upper() == "GTV"
