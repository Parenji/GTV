"""OCR locale con il framework Vision di macOS (helper ocr.swift).

L'helper si compila da solo al primo uso in comune/.ocr/ (git-ignorata).
Su Linux l'OCR non c'e': disponibile() lo dice prima di provarci.
"""

import shutil
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
OCR_SWIFT = BASE_DIR / "ocr.swift"
CACHE_DIR = BASE_DIR / ".ocr"
OCR_BINARIO = CACHE_DIR / "ocr"


def disponibile():
    return sys.platform == "darwin" and OCR_SWIFT.exists() and shutil.which("swiftc") is not None


def _compila():
    if OCR_BINARIO.exists() and OCR_BINARIO.stat().st_mtime >= OCR_SWIFT.stat().st_mtime:
        return OCR_BINARIO
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    moduli = CACHE_DIR / "modulecache"
    print("· compilo l'helper OCR (una volta sola)...")
    esito = subprocess.run(
        ["swiftc", "-O", "-module-cache-path", str(moduli), str(OCR_SWIFT), "-o", str(OCR_BINARIO)],
        capture_output=True, text=True,
    )
    # la cache dei moduli serve solo a compilare e pesa oltre 100 MB
    shutil.rmtree(moduli, ignore_errors=True)
    if esito.returncode != 0:
        raise RuntimeError(
            "Compilazione dell'OCR fallita (serve Xcode Command Line Tools: "
            "xcode-select --install)\n" + (esito.stderr or "").strip()
        )
    return OCR_BINARIO


def osserva(immagine):
    """Blocchi di testo di un'immagine: [(x, y, w, h, testo)].

    Coordinate normalizzate 0..1 con origine in BASSO a sinistra
    (convenzione di Vision).
    """
    esito = subprocess.run([str(_compila()), str(immagine)], capture_output=True, text=True)
    if esito.returncode != 0 and not esito.stdout:
        raise RuntimeError(f"OCR fallito: {esito.stderr.strip()}")
    blocchi = []
    for riga in esito.stdout.splitlines():
        parti = riga.split("\t")
        if len(parti) != 5 or riga.startswith(("=== ", "#dim")):
            continue
        try:
            x, y, w, h = (float(v) for v in parti[:4])
        except ValueError:
            continue
        blocchi.append((x, y, w, h, parti[4]))
    return blocchi
