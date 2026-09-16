#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Webhook Telegram per Vercel
===========================
Espone il pannello GTV su un endpoint HTTPS pubblico: Telegram consegna qui i
comandi e i tap sui pulsanti, senza bisogno di un processo sempre acceso sul
computer di casa.

Come funziona:
  - Telegram fa una POST su /api/telegram a ogni comando;
  - la richiesta e' autentica solo se porta l'header
    `X-Telegram-Bot-Api-Secret-Token` (derivato dal token del bot);
  - la logica del pannello e' la stessa di gtv_bot.py, riusata cosi' com'e'.

Variabili d'ambiente da impostare su Vercel:
  TELEGRAM_BOT_TOKEN        token del bot (obbligatorio)
  TELEGRAM_ALLOWED_CHAT_IDS chat_id autorizzati, separati da virgola
                            (in alternativa va bene anche TELEGRAM_CHAT_ID)

Una GET sullo stesso URL risponde con lo stato della funzione (diagnostica,
nessun segreto esposto).
"""

import json
import os
import sys
import tempfile
import time
import traceback
import urllib.request
from http.server import BaseHTTPRequestHandler
from pathlib import Path

# Repository pubblico da cui scaricare i sorgenti se non sono nel bundle
RAW_BASE = os.environ.get(
    "GTV_RAW_BASE", "https://raw.githubusercontent.com/Parenji/GTV/main"
)
CACHE_DIR = Path(tempfile.gettempdir()) / "gtv_sorgenti"
DATA_MAX_AGE = 3600          # secondi: oltre questo, data.json viene riscaricato


# ---------------------------------------------------------------------------
# Individua la cartella con il codice del bot (gtv_bot.py / whatsapp_reminder.py)
# ---------------------------------------------------------------------------
def _find_code_dir():
    here = Path(__file__).resolve()
    candidates = [
        here.parent.parent / "unionscraping",   # /var/task/unionscraping
        Path.cwd() / "unionscraping",
        Path("/var/task/unionscraping"),
        here.parent / "unionscraping",
    ]
    for c in candidates:
        if (c / "gtv_bot.py").exists():
            return c
    return None


CODE_DIR = _find_code_dir()
if CODE_DIR:
    sys.path.insert(0, str(CODE_DIR))


def _log(msg, level="INFO"):
    print(f"[webhook] [{level}] {msg}", flush=True)


# ---------------------------------------------------------------------------
# Sorgenti (union.html + data.json): dal bundle se ci sono, altrimenti da GitHub
# ---------------------------------------------------------------------------
def _download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "gtv-webhook"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)


def ensure_sources(wr):
    """Garantisce che union.html e data.json siano leggibili.

    Con `includeFiles` nel vercel.json i file sono gia' nel bundle; se per
    qualsiasi motivo non ci sono, li scarichiamo dal repo pubblico.
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    sources = (
        ("UNION_HTML", "union.html", "union.html", None),
        ("DATA_JSON", "unionscraping/data.json", "data.json", DATA_MAX_AGE),
    )
    for attr, url_path, name, max_age in sources:
        local = getattr(wr, attr)
        if not local.exists():
            cached = CACHE_DIR / name
            fresh = cached.exists() and (
                max_age is None
                or (time.time() - cached.stat().st_mtime) < max_age
            )
            if not fresh:
                _download(f"{RAW_BASE}/{url_path}", cached)
            setattr(wr, attr, cached)


# ---------------------------------------------------------------------------
# Aiuto: chi e' autorizzato a usare il pannello
# ---------------------------------------------------------------------------
def allowed_chat_ids():
    raw = (os.environ.get("TELEGRAM_ALLOWED_CHAT_IDS")
           or os.environ.get("TELEGRAM_CHAT_ID") or "")
    return [int(x) for x in raw.replace(" ", "").split(",")
            if x.strip().lstrip("-").isdigit()]


# ---------------------------------------------------------------------------
# Elaborazione di un update (stessa logica del bot in polling)
# ---------------------------------------------------------------------------
_BOT = None


def get_bot(token):
    global _BOT
    if _BOT is None:
        import gtv_bot
        _BOT = gtv_bot.GtvBot(token, allowed_chat_ids())
    return _BOT


def process_update(update):
    import gtv_bot
    import whatsapp_reminder as wr

    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        return False, "TELEGRAM_BOT_TOKEN non configurato"

    ensure_sources(wr)
    get_bot(token).handle_update(update)
    return True, "ok"


# ---------------------------------------------------------------------------
# Handler HTTP richiesto da Vercel
# ---------------------------------------------------------------------------
class handler(BaseHTTPRequestHandler):
    def _reply(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        """Diagnostica: nessun segreto, solo cosa e' configurato."""
        import gtv_bot

        token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
        self._reply(200, {
            "ok": True,
            "servizio": "GTV Control Panel webhook",
            "code_dir_trovata": bool(CODE_DIR),
            "token_configurato": bool(token),
            "chat_autorizzate": len(allowed_chat_ids()),
        })

    def do_POST(self):
        import gtv_bot

        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            update = json.loads(raw.decode("utf-8"))
        except Exception:
            _log("body non valido", "WARN")
            return self._reply(400, {"ok": False, "error": "json non valido"})

        token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
        if not token:
            _log("TELEGRAM_BOT_TOKEN mancante", "ERROR")
            return self._reply(200, {"ok": False, "error": "token mancante"})

        # Solo Telegram conosce questo header: senza, la richiesta e' di un estraneo
        if self.headers.get("X-Telegram-Bot-Api-Secret-Token", "") != gtv_bot.webhook_secret(token):
            _log(f"richiesta non autorizzata da {self.client_address[0]}", "WARN")
            return self._reply(401, {"ok": False, "error": "secret non valido"})

        try:
            ok, detail = process_update(update)
        except Exception:
            _log("errore nell'elaborazione:\n" + traceback.format_exc(), "ERROR")
            # Rispondiamo comunque 200: cosi' Telegram non ritenta all'infinito
            return self._reply(200, {"ok": False, "error": "elaborazione fallita"})

        return self._reply(200, {"ok": ok, "detail": detail})
