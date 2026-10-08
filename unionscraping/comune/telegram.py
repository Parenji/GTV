"""Client minimo della Bot API di Telegram (urllib, zero dipendenze)."""

import json
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


class TelegramError(Exception):
    pass


def _multipart(params, files):
    """Body multipart/form-data per l'invio di file."""
    boundary = "----gtv" + uuid.uuid4().hex
    body = bytearray()
    for key, value in (params or {}).items():
        body += (
            f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n'
            f"{value}\r\n"
        ).encode("utf-8")
    for key, path in (files or {}).items():
        path = Path(path)
        body += (
            f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"; '
            f'filename="{path.name}"\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n'
        ).encode("utf-8")
        body += path.read_bytes() + b"\r\n"
    body += f"--{boundary}--\r\n".encode("utf-8")
    return bytes(body), f"multipart/form-data; boundary={boundary}"


def chiama(token, metodo, params=None, files=None, timeout=30):
    """Chiama un metodo della Bot API e ritorna `result`.

    Qualsiasi errore (rete, HTTP, risposta ok=false) diventa TelegramError
    con la descrizione data da Telegram, quando c'e'.
    """
    url = f"https://api.telegram.org/bot{token}/{metodo}"
    if files:
        body, content_type = _multipart(params, files)
        req = urllib.request.Request(url, data=body, headers={"Content-Type": content_type})
    else:
        req = urllib.request.Request(url, data=urllib.parse.urlencode(params or {}).encode("utf-8"))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        # Telegram risponde 4xx con un JSON che spiega l'errore
        try:
            payload = json.loads(e.read().decode("utf-8"))
        except Exception:
            raise TelegramError(f"HTTP {e.code}: {e.reason}") from e
    except Exception as e:  # timeout, DNS, rete assente...
        raise TelegramError(str(e)) from e
    if not payload.get("ok"):
        raise TelegramError(payload.get("description", "errore sconosciuto"))
    return payload.get("result")
