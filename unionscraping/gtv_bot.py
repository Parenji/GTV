#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GTV Control Panel — bot Telegram
================================
Un pannello di controllo su Telegram per il team GTV. Il primo modulo e' la
sezione **Union**: genera al volo il messaggio promemoria dei piloti che
corrono in un certo giorno di gara (lobby, categoria, orario, host, link
della live, incitamento e reminder amicizia host entro le 12:00), pronto da
inoltrare nella bacheca WhatsApp del team.

Il bot e' pensato per crescere: ogni futuro "task" e' un modulo con il suo
sottomenu', registrato in `MODULES` (vedi `build_main_menu`).

Avvio:
    python3 gtv_bot.py                # long polling (uso normale / launchd)
    python3 gtv_bot.py --once         # processa gli update in sospeso ed esce
    python3 gtv_bot.py --set-commands # registra i comandi nel menu di Telegram

Credenziali (stesso file di whatsapp_reminder.py, git-ignorato):
    unionscraping/.env.telegram
        TELEGRAM_BOT_TOKEN=123456:AA...
        TELEGRAM_ALLOWED_CHAT_IDS=123456789   # opzionale: chi puo' usare il bot
                                              # (se assente, il bot risponde a tutti)

Nessuna dipendenza esterna: solo libreria standard.
"""

import argparse
import json
import os
import signal
import sys
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import date, datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

import whatsapp_reminder as wr  # noqa: E402  (modulo generatore dei messaggi)

STATE_FILE = BASE_DIR / ".bot_state.json"
LOG_FILE = BASE_DIR / "bot.log"

API_TIMEOUT = 35          # secondi per le chiamate normali
LONG_POLL_TIMEOUT = 25    # secondi di attesa lato Telegram su getUpdates
BACKOFF = 3               # secondi di pausa dopo un errore di rete

BOT_COMMANDS = [
    ("start", "apre il pannello di controllo"),
    ("menu", "mostra il menu principale"),
    ("union", "riepilogo piloti e messaggi gara"),
    ("oggi", "messaggio del giorno di gara odierno"),
    ("id", "mostra il tuo chat_id (per l'allowlist)"),
    ("help", "aiuto"),
]


# ---------------------------------------------------------------------------
# Logging minimale (stdout + file, utile per launchd)
# ---------------------------------------------------------------------------
def log(msg, level="INFO"):
    line = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} [{level}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Livello Telegram (Bot API via urllib, zero dipendenze)
# ---------------------------------------------------------------------------
def _multipart(params, files):
    """Costruisce un body multipart/form-data per l'upload di file."""
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


class TelegramError(Exception):
    pass


class Telegram:
    def __init__(self, token):
        self.token = token

    def call(self, method, params=None, files=None, timeout=API_TIMEOUT):
        url = f"https://api.telegram.org/bot{self.token}/{method}"
        if files:
            body, content_type = _multipart(params, files)
            req = urllib.request.Request(
                url, data=body, headers={"Content-Type": content_type}
            )
        else:
            data = urllib.parse.urlencode(params or {}).encode("utf-8")
            req = urllib.request.Request(url, data=data)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                payload = json.loads(e.read().decode("utf-8"))
            except Exception:
                raise TelegramError(f"HTTP {e.code}: {e.reason}") from e
        except Exception as e:  # timeout, DNS, rete assente...
            raise TelegramError(str(e)) from e

        if not payload.get("ok"):
            raise TelegramError(payload.get("description", "errore sconosciuto"))
        return payload.get("result")


# ---------------------------------------------------------------------------
# Tastiere
# ---------------------------------------------------------------------------
def kb(rows):
    return {"inline_keyboard": rows}


def btn(text, data):
    return {"text": text, "callback_data": data}


# ---------------------------------------------------------------------------
# Bot
# ---------------------------------------------------------------------------
class GtvBot:
    def __init__(self, token, allowed_chat_ids=None):
        self.tg = Telegram(token)
        self.allowed = set(allowed_chat_ids or [])
        self.running = True
        self.offset = self._load_offset()

    # -- stato ------------------------------------------------------------
    def _load_offset(self):
        try:
            return int(json.loads(STATE_FILE.read_text(encoding="utf-8"))["offset"])
        except Exception:
            return 0

    def _save_offset(self):
        try:
            STATE_FILE.write_text(
                json.dumps({"offset": self.offset}), encoding="utf-8"
            )
        except OSError as e:
            log(f"impossibile salvare lo stato: {e}", "WARN")

    def authorized(self, chat_id):
        return not self.allowed or chat_id in self.allowed

    # -- invio ------------------------------------------------------------
    def send(self, chat_id, text, keyboard=None):
        params = {
            "chat_id": chat_id,
            "text": text,
            "disable_web_page_preview": "true",
        }
        if keyboard:
            params["reply_markup"] = json.dumps(keyboard)
        return self.tg.call("sendMessage", params)

    def edit(self, chat_id, message_id, text, keyboard=None):
        params = {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
            "disable_web_page_preview": "true",
        }
        if keyboard:
            params["reply_markup"] = json.dumps(keyboard)
        try:
            return self.tg.call("editMessageText", params)
        except TelegramError as e:
            # "message is not modified" e' innocuo quando si ripreme lo stesso tasto
            if "not modified" not in str(e):
                log(f"editMessageText: {e}", "WARN")
            return None

    def answer_callback(self, callback_id, text=""):
        try:
            self.tg.call(
                "answerCallbackQuery",
                {"callback_query_id": callback_id, "text": text[:200]},
            )
        except TelegramError as e:
            log(f"answerCallbackQuery: {e}", "WARN")

    def send_document(self, chat_id, path, caption=""):
        return self.tg.call(
            "sendDocument",
            {"chat_id": chat_id, "caption": caption[:1000]},
            files={"document": path},
        )

    # -- dati -------------------------------------------------------------
    def race_context(self):
        """Rilegge calendario e dati a ogni richiesta: sempre aggiornati."""
        html_text = wr.UNION_HTML.read_text(encoding="utf-8")
        rounds = wr.parse_calendar(html_text)
        days_map = wr.race_days(rounds)
        badge = wr.round_badge_label(html_text)
        data = wr.load_unions_data()
        return rounds, days_map, badge, data

    def next_round(self, rounds):
        return wr.pick_round(rounds, {})

    def round_days(self, days_map, rd):
        return [d for d in sorted(days_map) if rd["start"] <= d <= rd["end"]]

    def build_for(self, dt):
        """Ritorna (testo, path) oppure (None, motivo)."""
        rounds, days_map, badge, data = self.race_context()
        rd = days_map.get(dt)
        if not rd:
            return None, f"Nessuna gara in calendario il {dt.strftime('%d/%m/%Y')}."
        day_name = wr.DAY_NAMES[dt.weekday()]
        lobbies = wr.gtv_lobbies_for_day(data, day_name)
        if not lobbies:
            return None, (
                f"Nessun pilota GTV in pista {wr.DAY_NAMES_FULL.get(day_name, day_name)} "
                f"{dt.day} {wr.MONTHS_FULL[dt.month].lower()}."
            )
        text = wr.build_message(rd, dt, day_name, lobbies, badge)
        path = wr.write_message_file(dt, day_name, text)
        return text, path

    # -- menu -------------------------------------------------------------
    def build_main_menu(self):
        """Menu principale: qui si aggiungono i futuri moduli/task."""
        return (
            "🎛 *GTV Control Panel*\n\nScegli una sezione:",
            kb([[btn("🏁 Union", "m:union")], [btn("ℹ️ Aiuto", "m:help")]]),
        )

    def build_union_menu(self):
        rounds, days_map, badge, _ = self.race_context()
        rd = self.next_round(rounds)
        today = wr.italian_today()
        is_race_day = today in days_map
        rows = []
        if is_race_day:
            rows.append([btn("📤 Messaggio di oggi", "a:today")])
        rows.append([btn(f"📅 {rd['label']} · {rd['track']}", f"m:days:{rd['index']}")])
        rows.append([btn("🏆 Scegli un'altra gara", "m:rounds")])
        rows.append([btn("📋 Calendario giorni di gara", "a:list")])
        rows.append([btn("⬅️ Menu principale", "m:main")])
        return (
            f"🏁 *Union · {badge}*\n\n"
            f"Genero il riepilogo dei piloti GTV in pista per ogni giorno di gara: "
            f"lobby, categoria, orario, host, link della live e reminder per "
            f"l'amicizia all'Host entro le 12:00.\n\n"
            f"Prossima gara: *{rd['label']} · {rd['track']}* "
            f"({rd['start'].strftime('%d/%m')} – {rd['end'].strftime('%d/%m')})",
            kb(rows),
        )

    def build_rounds_menu(self):
        rounds, _, _, _ = self.race_context()
        rows = []
        for rd in rounds:
            rows.append([btn(f"{rd['label']} · {rd['track']}", f"m:days:{rd['index']}")])
        rows.append([btn("⬅️ Union", "m:union")])
        return "🏆 *Scegli la gara:*", kb(rows)

    def build_days_menu(self, index):
        rounds, days_map, badge, _ = self.race_context()
        rd = next((r for r in rounds if r["index"] == index), None)
        if not rd:
            return "Gara non trovata.", kb([[btn("⬅️ Union", "m:union")]])
        days = self.round_days(days_map, rd)
        rows = []
        for d in days:
            name = wr.DAY_NAMES_FULL[wr.DAY_NAMES[d.weekday()]][:3]
            rows.append([btn(f"{name} {d.day} {wr.MONTHS_FULL[d.month][:3].lower()}",
                             f"a:day:{d.isoformat()}")])
        rows.append([btn("📦 Tutta la settimana", f"a:week:{index}")])
        rows.append([btn("⬅️ Union", "m:union")])
        return (
            f"📅 *{rd['label']} · {rd['track']}*\n"
            f"Settimana {rd['start'].strftime('%d/%m')} – {rd['end'].strftime('%d/%m')}\n\n"
            f"Tocca un giorno per generare il messaggio:",
            kb(rows),
        )

    def build_message_keyboard(self, dt):
        return kb([
            [btn("📄 Invia come file .txt", f"a:file:{dt.isoformat()}")],
            [btn("⬅️ Union", "m:union"), btn("🏠 Menu", "m:main")],
        ])

    # -- azioni -----------------------------------------------------------
    def action_send_day(self, chat_id, dt, as_file=False):
        text, extra = self.build_for(dt)
        if text is None:
            self.send(chat_id, f"⚠️ {extra}")
            return
        if as_file:
            self.send_document(chat_id, extra, caption=f"Messaggio {dt.strftime('%d/%m/%Y')}")
        else:
            self.send(chat_id, text, self.build_message_keyboard(dt))

    def action_send_week(self, chat_id, index):
        rounds, days_map, _, _ = self.race_context()
        rd = next((r for r in rounds if r["index"] == index), None)
        if not rd:
            self.send(chat_id, "Gara non trovata.")
            return
        self.send(chat_id, f"📦 *{rd['label']} · {rd['track']}* — genero i messaggi dei 5 giorni…")
        sent = 0
        for d in self.round_days(days_map, rd):
            text, _ = self.build_for(d)
            if text:
                self.send(chat_id, text)
                sent += 1
                time.sleep(0.5)
        if not sent:
            self.send(chat_id, "⚠️ Nessun pilota GTV in pista in questa settimana.")

    def action_list(self, chat_id):
        _, days_map, badge, data = self.race_context()
        today = wr.italian_today()
        lines = [f"📋 *{badge} — giorni di gara*", ""]
        for d in sorted(days_map):
            rd = days_map[d]
            day_name = wr.DAY_NAMES[d.weekday()]
            n = sum(len(lb["pilots"]) for lb in wr.gtv_lobbies_for_day(data, day_name))
            mark = " ← oggi" if d == today else ""
            lines.append(
                f"• {wr.DAY_NAMES_FULL[day_name][:3]} {d.day} "
                f"{wr.MONTHS_FULL[d.month][:3].lower()} — {rd['label']} "
                f"({rd['track']}) — {n} piloti GTV{mark}"
            )
        self.send(chat_id, "\n".join(lines), kb([[btn("⬅️ Union", "m:union")]]))

    # -- update handling --------------------------------------------------
    def handle_message(self, msg):
        chat_id = msg["chat"]["id"]
        text = (msg.get("text") or "").strip()
        log(f"msg da chat {chat_id} ({msg['chat'].get('type')}): {text[:60]!r}")
        if not text:
            return

        cmd = text.split()[0].lower().lstrip("/").split("@")[0]

        if cmd == "id":
            self.send(
                chat_id,
                f"🆔 chat_id: `{chat_id}`\n"
                f"user_id: `{msg['from']['id']}`\n\n"
                f"Aggiungi il chat_id in `TELEGRAM_ALLOWED_CHAT_IDS` per limitare l'accesso.",
            )
            return

        if not self.authorized(chat_id):
            log(f"accesso negato a chat_id {chat_id}", "WARN")
            self.send(
                chat_id,
                f"⛔ Non sei autorizzato.\nIl tuo chat_id è `{chat_id}`.",
            )
            return

        if cmd in ("start", "menu", "help"):
            title, keyboard = self.build_main_menu()
            if cmd == "help":
                title += (
                    "\n\nComandi:\n"
                    + "\n".join(f"/{c} — {d}" for c, d in BOT_COMMANDS)
                )
            self.send(chat_id, title, keyboard)
            return

        if cmd == "union":
            title, keyboard = self.build_union_menu()
            self.send(chat_id, title, keyboard)
            return

        if cmd == "oggi":
            self.action_send_day(chat_id, wr.italian_today())
            return

        self.send(chat_id, "Non ho capito 🤔 Usa /menu.", kb([[btn("🏠 Menu", "m:main")]]))

    def handle_callback(self, cb):
        chat_id = cb["message"]["chat"]["id"]
        message_id = cb["message"]["message_id"]
        data = cb.get("data", "")
        log(f"callback da chat {chat_id}: {data}")
        self.answer_callback(cb["id"])

        if not self.authorized(chat_id):
            self.send(chat_id, f"⛔ Non sei autorizzato.\nIl tuo chat_id è `{chat_id}`.")
            return

        parts = data.split(":")
        kind = parts[0]

        if kind == "m":                      # navigazione menu
            page = parts[1] if len(parts) > 1 else "main"
            if page == "main":
                title, keyboard = self.build_main_menu()
            elif page == "union":
                title, keyboard = self.build_union_menu()
            elif page == "rounds":
                title, keyboard = self.build_rounds_menu()
            elif page == "days":
                title, keyboard = self.build_days_menu(int(parts[2]))
            elif page == "help":
                title, keyboard = self.build_main_menu()
                title += "\n\nComandi:\n" + "\n".join(
                    f"/{c} — {d}" for c, d in BOT_COMMANDS
                )
            else:
                title, keyboard = self.build_main_menu()
            self.edit(chat_id, message_id, title, keyboard)
            return

        if kind == "a":                      # azioni
            action = parts[1] if len(parts) > 1 else ""
            if action == "today":
                self.action_send_day(chat_id, wr.italian_today())
            elif action == "day":
                self.action_send_day(chat_id, date.fromisoformat(parts[2]))
            elif action == "file":
                self.action_send_day(chat_id, date.fromisoformat(parts[2]), as_file=True)
            elif action == "week":
                self.action_send_week(chat_id, int(parts[2]))
            elif action == "list":
                self.action_list(chat_id)
            return

    def handle_update(self, update):
        if "message" in update:
            self.handle_message(update["message"])
        elif "callback_query" in update:
            self.handle_callback(update["callback_query"])

    # -- loop -------------------------------------------------------------
    def get_updates(self):
        return self.tg.call(
            "getUpdates",
            {
                "offset": self.offset,
                "timeout": LONG_POLL_TIMEOUT,
                "allowed_updates": json.dumps(["message", "callback_query"]),
            },
            timeout=LONG_POLL_TIMEOUT + 10,
        )

    def set_commands(self):
        self.tg.call(
            "setMyCommands",
            {
                "commands": json.dumps(
                    [{"command": c, "description": d} for c, d in BOT_COMMANDS]
                )
            },
        )

    def stop(self, *_):
        self.running = False
        log("arresto richiesto, chiudo…")

    def run_once(self):
        updates = self.get_updates()
        for u in updates:
            self.offset = u["update_id"] + 1
            try:
                self.handle_update(u)
            except Exception:
                log("errore su update:\n" + traceback.format_exc(), "ERROR")
        if updates:
            self._save_offset()
        return len(updates)

    def run(self):
        signal.signal(signal.SIGINT, self.stop)
        signal.signal(signal.SIGTERM, self.stop)
        log(f"GTV Control Panel avviato (offset={self.offset}, "
            f"allowlist={'tutti' if not self.allowed else sorted(self.allowed)})")
        if not self.allowed:
            log("ATTENZIONE: nessuna allowlist configurata, il bot risponde a chiunque. "
                "Imposta TELEGRAM_ALLOWED_CHAT_IDS in .env.telegram", "WARN")
        while self.running:
            try:
                n = self.run_once()
                if n:
                    log(f"processati {n} update")
            except TelegramError as e:
                log(f"errore Telegram: {e} (riprovo fra {BACKOFF}s)", "WARN")
                time.sleep(BACKOFF)
            except Exception:
                log("errore inatteso:\n" + traceback.format_exc(), "ERROR")
                time.sleep(BACKOFF)
        log("bot terminato.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def build_bot_from_env(args):
    wr.load_env_file()
    token = args.token or os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        print("x Serve il token: --token oppure TELEGRAM_BOT_TOKEN in .env.telegram",
              file=sys.stderr)
        sys.exit(2)
    raw = args.allowed_chat_ids or os.environ.get("TELEGRAM_ALLOWED_CHAT_IDS", "")
    allowed = [int(x) for x in raw.replace(" ", "").split(",") if x.strip().lstrip("-").isdigit()]
    return GtvBot(token, allowed)


def main():
    parser = argparse.ArgumentParser(description="GTV Control Panel — bot Telegram.")
    parser.add_argument("--token", help="token del bot (default: env TELEGRAM_BOT_TOKEN)")
    parser.add_argument("--allowed-chat-ids",
                       help="chat_id autorizzati, separati da virgola (default: env)")
    parser.add_argument("--once", action="store_true",
                       help="processa gli update in sospeso ed esce")
    parser.add_argument("--set-commands", action="store_true",
                       help="registra i comandi nel menu di Telegram ed esce")
    args = parser.parse_args()

    bot = build_bot_from_env(args)

    if args.set_commands:
        bot.set_commands()
        print("Comandi registrati.")
        return 0
    if args.once:
        n = bot.run_once()
        print(f"Update processati: {n}")
        return 0
    bot.run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
