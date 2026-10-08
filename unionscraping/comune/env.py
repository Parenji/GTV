"""Variabili da file .env locali (git-ignorati), senza dipendenze."""

import os


def carica(*percorsi):
    """Legge righe CHIAVE=valore; le variabili gia' impostate vincono sempre.

    Su GitHub Actions i valori arrivano dai secrets e questi file non
    esistono: vengono semplicemente ignorati.
    """
    for percorso in percorsi:
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
