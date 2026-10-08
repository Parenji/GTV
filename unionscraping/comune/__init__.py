"""Funzioni condivise dagli strumenti di unionscraping/ (solo libreria standard).

Gli script stanno in sottocartelle e arrivano qui aggiungendo unionscraping/
al path:

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from comune import rete, nomi, json_io

Il bot (unionscraping/bot/) lo importa anche dalla funzione Vercel
api/telegram.py: per questo comune/ non e' esclusa da .vercelignore.
"""

from pathlib import Path

UNION_DIR = Path(__file__).resolve().parent.parent  # .../unionscraping
REPO_DIR = UNION_DIR.parent
DATI_DIR = REPO_DIR / "dati"
