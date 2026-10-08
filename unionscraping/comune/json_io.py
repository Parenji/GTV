"""Lettura e scrittura sicura dei file json generati."""

import json
import os
import tempfile
from pathlib import Path


def leggi(percorso, predefinito=None):
    """Contenuto del file, o `predefinito` se manca o e' illeggibile."""
    try:
        return json.loads(Path(percorso).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return predefinito
    except ValueError:
        print(f"! {percorso} illeggibile: lo considero vuoto")
        return predefinito


def _senza_date(dati, ignora):
    """Copia confrontabile: senza le chiavi di `meta` che cambiano a ogni giro."""
    if not isinstance(dati, dict):
        return dati
    copia = dict(dati)
    if isinstance(copia.get("meta"), dict):
        copia["meta"] = {k: v for k, v in copia["meta"].items() if k not in ignora}
    return copia


def scrivi(percorso, dati, indent=1):
    """Scrittura atomica: file temporaneo nella stessa cartella e os.replace.

    Se il processo muore a meta', il file vecchio resta intatto: niente json
    troncati committati dai workflow.
    """
    percorso = Path(percorso)
    percorso.parent.mkdir(parents=True, exist_ok=True)
    testo = json.dumps(dati, ensure_ascii=False, indent=indent) + "\n"
    fd, temporaneo = tempfile.mkstemp(dir=percorso.parent, prefix=f".{percorso.name}.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(testo)
        os.chmod(temporaneo, 0o644)  # mkstemp crea i file leggibili solo dal proprietario
        os.replace(temporaneo, percorso)
    except BaseException:
        Path(temporaneo).unlink(missing_ok=True)
        raise


def scrivi_se_cambiato(percorso, dati, ignora=("generated_at", "updated_at"), indent=1):
    """Scrive solo se il contenuto e' cambiato, date di generazione escluse.

    Cosi' un giro senza novita' non produce un commit (e un deploy) che
    cambia solo l'orario. Ritorna True se ha scritto.
    """
    prima = leggi(percorso)
    if prima is not None and _senza_date(prima, ignora) == _senza_date(dati, ignora):
        return False
    scrivi(percorso, dati, indent)
    return True
