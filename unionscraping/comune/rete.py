"""Download con retry, CSV dei fogli Google, impronta (ETag) di una risorsa."""

import csv
import io
import time
import urllib.error
import urllib.request

USER_AGENT = "Mozilla/5.0 (compatible; GTV-scraper)"


class FonteNonValida(Exception):
    """La risorsa ha risposto, ma con qualcosa che non e' quello atteso."""


def _richiesta(url, metodo="GET"):
    return urllib.request.Request(url, method=metodo, headers={"User-Agent": USER_AGENT})


def scarica(url, binario=False, timeout=60, tentativi=3):
    """GET con qualche nuovo tentativo sugli errori di rete e 5xx.

    Ritorna None se la risorsa non esiste (404); gli altri errori HTTP e un
    timeout ripetuto vengono rilanciati.
    """
    for n in range(1, tentativi + 1):
        try:
            with urllib.request.urlopen(_richiesta(url), timeout=timeout) as risposta:
                corpo = risposta.read()
            return corpo if binario else corpo.decode("utf-8-sig")
        except urllib.error.HTTPError as errore:
            if errore.code == 404:
                return None
            if errore.code < 500 or n == tentativi:
                raise
        except (urllib.error.URLError, TimeoutError):
            if n == tentativi:
                raise
        time.sleep(2 * n)


def scarica_csv(url, **kwargs):
    """Righe di un CSV pubblicato (fogli Google).

    Se Google risponde con una pagina HTML (foglio non piu' pubblicato,
    login) e' un errore: meglio fermarsi che scrivere dati vuoti.
    """
    testo = scarica(url, **kwargs)
    if testo is None:
        raise FonteNonValida(f"CSV non trovato (404): {url}")
    if testo.lstrip()[:15].lower().startswith(("<!doctype", "<html")):
        raise FonteNonValida(f"Al posto del CSV e' arrivata una pagina HTML: {url}")
    return list(csv.reader(io.StringIO(testo)))


def impronta(url, timeout=60):
    """ETag della risorsa senza scaricarla (HEAD), o None se non esiste."""
    try:
        with urllib.request.urlopen(_richiesta(url, "HEAD"), timeout=timeout) as risposta:
            h = risposta.headers
            return h.get("ETag") or f"{h.get('Content-Length')}-{h.get('Last-Modified')}"
    except urllib.error.HTTPError as errore:
        if errore.code == 404:
            return None
        raise
