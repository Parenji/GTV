#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Promemoria gare UNION -> messaggio per la bacheca del team
=========================================================
Genera, per ogni giorno di gara, un messaggio pronto da inoltrare su WhatsApp
nella bacheca del team GTV: riepilogo dei piloti GTV che corrono quella sera
(lobby, categoria, orario, host e link della live), piu' incitamento e reminder
della richiesta di amicizia all'Host entro le 12:00.

Fonti dati (nessuna duplicazione, nessuna dipendenza esterna):
  - unionscraping/data.json  -> lobby e piloti (generato da scraper.py)
  - union.html               -> calendario Round 2 (pista + settimane di gara)

Comandi utili:
  python3 whatsapp_reminder.py --list                # tutti i giorni di gara a calendario
  python3 whatsapp_reminder.py                      # oggi (se e' giorno di gara)
  python3 whatsapp_reminder.py --date 2026-09-21
  python3 whatsapp_reminder.py --all                # tutti i giorni della 1a settimana
  python3 whatsapp_reminder.py --season             # tutti i giorni di gara della stagione
  python3 whatsapp_reminder.py --all --copy         # genera e copia negli appunti (macOS)
  python3 whatsapp_reminder.py --today --send-telegram
  python3 whatsapp_reminder.py --detect-chat-id

Credenziali Telegram, in ordine di priorita':
  1. --token / --chat-id sulla riga di comando
  2. variabili d'ambiente TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID
     (su GitHub Actions arrivano dai secrets del repository)
  3. file locale git-ignorato unionscraping/.env.telegram:
       TELEGRAM_BOT_TOKEN=123456:AA...
       TELEGRAM_CHAT_ID=-1001234567890
Il token non va MAI committato.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

try:
    from zoneinfo import ZoneInfo

    ROME_TZ = ZoneInfo("Europe/Rome")
except Exception:  # pragma: no cover - fallback se la tzdata non e' disponibile
    ROME_TZ = timezone(timedelta(hours=1))

# ---------------------------------------------------------------------------
# Percorsi
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent          # .../unionscraping
REPO_DIR = BASE_DIR.parent                          # radice del repository
DATA_JSON = BASE_DIR / "data.json"
UNION_HTML = REPO_DIR / "union.html"
OUT_DIR = BASE_DIR / "whatsapp"                     # file .txt generati

# File locali (git-ignorati) da cui leggere token e chat id quando si lancia
# lo script a mano. Su GitHub Actions questi file non esistono: i valori
# arrivano dai secrets del repository.
ENV_FILES = (BASE_DIR / ".env.telegram", BASE_DIR / ".env")


def load_env_file():
    """Carica TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID da .env.telegram o .env.

    Le variabili d'ambiente gia' impostate hanno sempre la precedenza, cosi'
    su GitHub Actions (secrets) il file locale viene semplicemente ignorato.
    """
    for path in ENV_FILES:
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


# ---------------------------------------------------------------------------
# Nomi giorni/mesi in italiano
# ---------------------------------------------------------------------------
DAY_NAMES = [
    "LUNEDI", "MARTEDI", "MERCOLEDI", "GIOVEDI", "VENERDI", "SABATO", "DOMENICA",
]
DAY_NAMES_FULL = {
    "LUNEDI": "Lunedì",
    "MARTEDI": "Martedì",
    "MERCOLEDI": "Mercoledì",
    "GIOVEDI": "Giovedì",
    "VENERDI": "Venerdì",
}
MONTHS_ABBR = {
    "GEN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAG": 5, "GIU": 6,
    "LUG": 7, "AGO": 8, "SET": 9, "OTT": 10, "NOV": 11, "DIC": 12,
}
MONTHS_FULL = {
    1: "GENNAIO", 2: "FEBBRAIO", 3: "MARZO", 4: "APRILE", 5: "MAGGIO",
    6: "GIUGNO", 7: "LUGLIO", 8: "AGOSTO", 9: "SETTEMBRE", 10: "OTTOBRE",
    11: "NOVEMBRE", 12: "DICEMBRE",
}
# I giorni di gara sono lun-ven (sabato/domenica non si corre)
RACE_WEEKDAYS = range(0, 5)

SEP = "━━━━━━━━━━━━━━━━━━━━"


# ---------------------------------------------------------------------------
# Calendario: legge i round direttamente da union.html
# ---------------------------------------------------------------------------
def parse_calendar(html_text):
    """Estrae i round dal calendario di union.html.

    Restituisce una lista di dict:
      {label, track, iso, start, end}
    dove start/end sono datetime.date. Il parsing si basa sulle card
    `.race-item` gia' presenti nella pagina (unica fonte di verita').
    """
    # Ignora il contenuto commentato (es. vecchie sezioni disattivate)
    html_text = re.sub(r"<!--.*?-->", "", html_text, flags=re.DOTALL)

    start_block = html_text.find('class="calendar-title">Round 2')
    end_block = html_text.find('<section id="lobby"')
    if start_block != -1 and end_block != -1:
        html_text = html_text[start_block:end_block]

    rounds = []
    for chunk in html_text.split('<div class="race-item"')[1:]:
        # Etichetta della gara ("Gara 1", "Gara 2", ... oppure "Finale")
        m_label = re.search(
            r"font-size:\s*1\.3em;[^>]*>\s*([^<]+?)\s*<", chunk
        )
        label = m_label.group(1).strip() if m_label else "Gara"

        # Nome pista (span subito dopo la bandierina)
        m_track = re.search(
            r'class="flagtrack"[^>]*>\s*<span[^>]*>([^<]+)</span>', chunk
        )
        track = m_track.group(1).strip() if m_track else ""

        # Codice paese dalla bandiera di sfondo (es. .../4x3/at.svg -> at)
        m_flag = re.search(r"/4x3/([a-z]{2})\.svg", chunk)
        iso = m_flag.group(1).lower() if m_flag else ""

        # Intervallo date, in due formati possibili:
        #   "21 - 27 SET 2026"        (stesso mese)
        #   "30 NOV - 6 DIC 2026"     (mese diverso, es. Finale)
        m_dates = re.search(
            r">\s*(\d{1,2})\s*(?:([A-Za-z]{3}))?\s*[\u2013\u2014-]\s*"
            r"(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*<",
            chunk,
        )
        if not m_dates:
            continue
        d1, mon1, d2, mon2, year = m_dates.groups()
        month1 = MONTHS_ABBR.get((mon1 or mon2).upper())
        month2 = MONTHS_ABBR.get(mon2.upper())
        if not month1 or not month2:
            continue
        start = date(int(year), month1, int(d1))
        end = date(int(year), month2, int(d2))

        rounds.append(
            {
                "index": len(rounds) + 1,   # 1-based, come "Gara 1"
                "label": label,
                "track": track,
                "iso": iso,
                "start": start,
                "end": end,
            }
        )
    return rounds


def race_days(rounds):
    """Restituisce {date: round} per tutti i giorni di gara (lun-ven)."""
    days = {}
    for rd in rounds:
        cur = rd["start"]
        while cur <= rd["end"]:
            if cur.weekday() in RACE_WEEKDAYS:
                days[cur] = rd
            cur += timedelta(days=1)
    return days


def emoji_flag(iso):
    """Converte un codice paese ISO-2 nel relativo emoji-bandiera."""
    if not iso or len(iso) != 2 or not iso.isalpha():
        return ""
    return "".join(chr(0x1F1E6 + ord(c) - ord("a")) for c in iso.lower())



# ---------------------------------------------------------------------------
# Dati lobby/piloti
# ---------------------------------------------------------------------------
def load_unions_data():
    with open(DATA_JSON, encoding="utf-8") as f:
        return json.load(f)


def _lobby_sort_key(name):
    m = re.match(r"^[A-Za-z]*(\d+)$", name)
    return (int(m.group(1)) if m else 9999, name)


def gtv_lobbies_for_day(data, day_name):
    """Lobby del giorno che contengono almeno un pilota GTV, ordinate per nome."""
    out = []
    for lb in data.get("lobbies", []):
        if str(lb.get("day", "")).strip().upper() != day_name:
            continue
        pilots = [
            p for p in lb.get("pilots", [])
            if str(p.get("team", "")).strip().upper() == "GTV"
        ]
        if not pilots:
            continue
        out.append(
            {
                "name": str(lb.get("name", "")).strip(),
                "category": str(lb.get("category", "")).strip(),
                "time": str(lb.get("time", "")).replace("Ore ", "").strip(),
                "host": str(lb.get("host", "")).strip(),
                "live": str(lb.get("live", "")).strip(),
                "url": str(lb.get("url", "")).strip(),
                "pilots": sorted(
                    pilots, key=lambda p: int(p.get("pos") or 999)
                ),
            }
        )
    out.sort(key=lambda lb: _lobby_sort_key(lb["name"]))
    return out


# ---------------------------------------------------------------------------
# Costruzione del messaggio
# ---------------------------------------------------------------------------
def italian_full_date(dt):
    return (
        f"{DAY_NAMES_FULL.get(DAY_NAMES[dt.weekday()], DAY_NAMES[dt.weekday()])} "
        f"{dt.day} {MONTHS_FULL[dt.month]} {dt.year}"
    )


def round_badge_label(html_text):
    """Legge il badge in hero (es. 'ROUND 2 - 2026') da union.html."""
    m = re.search(r'union-hero-badge">([^<]+)<', html_text)
    return m.group(1).strip() if m else "ROUND 2 - 2026"


def build_message(round_info, dt, day_name, lobbies, badge):
    """Compone il testo del messaggio (markdown WhatsApp: *grassetto*)."""
    flag = emoji_flag(round_info.get("iso", ""))
    race_label = str(round_info.get("label", "")).strip().upper()
    track = str(round_info.get("track", "")).strip().upper()
    total = sum(len(lb["pilots"]) for lb in lobbies)

    lines = []
    lines.append(f"🏁 *LEGA UNION · {badge}*")
    lines.append((f"🏆 *{race_label} · {track}* {flag}").rstrip())
    lines.append(f"📅 *{italian_full_date(dt).upper()}*")
    lines.append("")
    lines.append("Stasera scendono in pista i colori GTV! 💛🖤")
    lines.append("Ecco chi corre e dove seguirlo 👇")
    lines.append("")

    for lb in lobbies:
        lines.append(SEP)
        lines.append(
            f"🏁 *Lobby {lb['name']}* · *{lb['category'].upper()}* · "
            f"🕘 ore {lb['time']}"
        )
        for p in lb["pilots"]:
            matricola = str(p.get("matricola", "")).strip()
            nome = str(p.get("nome", "")).strip()
            suffix = f" (matricola {matricola})" if matricola else ""
            lines.append(f"👤 {nome}{suffix}")
        if lb["host"]:
            lines.append(f"🤝 Host: {lb['host']}")
        if lb["url"]:
            lines.append(f"📺 Live: {lb['url']}")
    lines.append(SEP)
    lines.append("")

    lines.append(f"🎽 *Piloti GTV in pista stasera: {total}*")
    lines.append("")
    lines.append(
        "⚠️ *IMPORTANTE:* invia la *richiesta di amicizia all'Host* entro le "
        "*12:00* del giorno di gara, altrimenti rischi di restare fuori dalla lobby!"
    )
    lines.append("🎧 Sintonizzati sulla live e riempite la chat: ogni tifoso conta!")
    lines.append("💪 Forza GTV, portiamo a casa il risultato! 🔥")
    return "\n".join(lines)



# ---------------------------------------------------------------------------
# Output locale
# ---------------------------------------------------------------------------
def write_message_file(dt, day_name, text):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{dt.isoformat()}_{day_name.lower()}.txt"
    path.write_text(text, encoding="utf-8")
    return path


def copy_to_clipboard(text):
    """Copia negli appunti su macOS (pbcopy). Silenzioso se non disponibile."""
    try:
        subprocess.run(["pbcopy"], input=text.encode("utf-8"), check=True)
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Invio Telegram
# ---------------------------------------------------------------------------
def telegram_api(token, method, params=None):
    url = f"https://api.telegram.org/bot{token}/{method}"
    data = urllib.parse.urlencode(params or {}).encode("utf-8")
    req = urllib.request.Request(url, data=data)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        # L'API Telegram risponde 4xx con un JSON che spiega l'errore
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            return {"ok": False, "description": f"HTTP {e.code}: {e.reason}"}
    except Exception as e:  # errori di rete/timeout
        return {"ok": False, "description": str(e)}


def telegram_send(token, chat_id, text):
    """Invia il testo in chat. Senza parse_mode: gli asterischi restano nel
    testo, cosi' il copia/incolla su WhatsApp mantiene il grassetto."""
    return telegram_api(
        token,
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": text,
            "disable_web_page_preview": "true",
        },
    )


def telegram_detect_chat_id(token):
    """Mostra le chat da cui il bot ha ricevuto messaggi (per trovare il gruppo)."""
    res = telegram_api(token, "getUpdates")
    chats = {}
    for upd in res.get("result", []):
        for key in ("message", "channel_post", "my_chat_member"):
            obj = upd.get(key)
            if obj and "chat" in obj:
                c = obj["chat"]
                chats[c["id"]] = (
                    c.get("title") or c.get("username") or c.get("first_name")
                )
    return chats


# ---------------------------------------------------------------------------
# Scelta della data / dei giorni
# ---------------------------------------------------------------------------
def italian_today():
    return datetime.now(ROME_TZ).date()


def pick_round(rounds, days_map, round_no=None):
    """Sceglie il round di riferimento.

    - Se round_no e' indicato, prende quello (1-based, come "Gara 1"...).
    - Altrimenti il round in cui cade oggi, o il prossimo in calendario.
    """
    if not rounds:
        return None
    if round_no:
        for rd in rounds:
            m = re.search(r"(\d+)", rd["label"])
            if m and int(m.group(1)) == round_no:
                return rd
        # Fallback posizionale: la "Finale" non ha un numero nel nome
        if 1 <= round_no <= len(rounds):
            return rounds[round_no - 1]
        return None
    today = italian_today()
    upcoming = [rd for rd in sorted(rounds, key=lambda r: r["start"])
                if rd["end"] >= today]
    return upcoming[0] if upcoming else sorted(rounds, key=lambda r: r["start"])[0]


def resolve_target_days(args, rounds, days_map):
    """Determina la lista di date da generare in base agli argomenti CLI."""
    if args.date:
        try:
            return [date.fromisoformat(args.date)]
        except ValueError:
            print(f"x Data non valida: {args.date} (usa YYYY-MM-DD)", file=sys.stderr)
            sys.exit(2)
    if args.season:
        return sorted(days_map.keys())
    if args.all:
        rd = pick_round(rounds, days_map, args.round)
        if not rd:
            print("x Nessun round trovato per --all.", file=sys.stderr)
            sys.exit(2)
        return [d for d in sorted(days_map.keys())
                if rd["start"] <= d <= rd["end"]]
    return [italian_today()]



# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Genera i messaggi promemoria gare UNION per la bacheca del team."
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--today", action="store_true",
                       help="usa la data odierna (default)")
    group.add_argument("--date", help="data specifica in formato YYYY-MM-DD")
    group.add_argument("--all", action="store_true",
                       help="tutti i giorni della settimana di gara selezionata")
    group.add_argument("--season", action="store_true",
                       help="tutti i giorni di gara di tutti i round in calendario")
    group.add_argument("--list", action="store_true",
                       help="elenca i giorni di gara del calendario ed esce")
    parser.add_argument("--round", type=int,
                        help="numero del round da usare con --all (default: prossimo in calendario)")
    parser.add_argument("--copy", action="store_true",
                        help="copia il messaggio negli appunti (macOS)")
    parser.add_argument("--send-telegram", action="store_true",
                        help="invia il messaggio su Telegram")
    parser.add_argument("--force", action="store_true",
                        help="invia ora, ignorando la finestra di mezzanotte")
    parser.add_argument("--detect-chat-id", action="store_true",
                        help="mostra i chat_id visibili al bot")
    parser.add_argument("--token",
                        help="token del bot (default: env TELEGRAM_BOT_TOKEN)")
    parser.add_argument("--chat-id",
                        help="id della chat/gruppo (default: env TELEGRAM_CHAT_ID)")
    args = parser.parse_args()

    # Token/chat id: file locale (uso manuale) -> variabili d'ambiente (CI)
    load_env_file()

    token = args.token or os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = args.chat_id or os.environ.get("TELEGRAM_CHAT_ID", "").strip()

    # Utility: rileva il chat_id e termina
    if args.detect_chat_id:
        if not token:
            print("x Serve il token: --token oppure TELEGRAM_BOT_TOKEN",
                  file=sys.stderr)
            sys.exit(2)
        chats = telegram_detect_chat_id(token)
        if not chats:
            print("Nessuna chat trovata. Aggiungi il bot al gruppo e scrivi un messaggio li'.")
        else:
            print("Chat viste dal bot (usa l'id come TELEGRAM_CHAT_ID):")
            for cid, title in chats.items():
                print(f"  {cid}  ->  {title}")
        return 0

    if not DATA_JSON.exists():
        print(f"x File dati non trovato: {DATA_JSON}", file=sys.stderr)
        return 2
    if not UNION_HTML.exists():
        print(f"x Calendario non trovato: {UNION_HTML}", file=sys.stderr)
        return 2

    html_text = UNION_HTML.read_text(encoding="utf-8")
    rounds = parse_calendar(html_text)
    days_map = race_days(rounds)
    badge = round_badge_label(html_text)
    data = load_unions_data()

    # --list: panoramica dei giorni di gara, senza generare nulla
    if args.list:
        today = italian_today()
        print(f"{badge} — giorni di gara (lun-ven)")
        for d in sorted(days_map):
            rd = days_map[d]
            day_name = DAY_NAMES[d.weekday()]
            n = sum(len(lb["pilots"])
                    for lb in gtv_lobbies_for_day(data, day_name))
            mark = "  <-- oggi" if d == today else ""
            print(f"  {d.isoformat()}  {day_name:9s}  {rd['label']:7s} "
                  f"{rd['track']:18s} piloti GTV: {n}{mark}")
        return 0

    target_days = resolve_target_days(args, rounds, days_map)

    # Finestra di invio automatico: solo intorno alla mezzanotte italiana,
    # cosi' il cron (22:00 e 23:00 UTC) copre sia ora legale sia ora solare.
    now_ro = datetime.now(ROME_TZ)

    generated = 0
    sent = 0
    for dt in target_days:
        day_name = DAY_NAMES[dt.weekday()]
        round_info = days_map.get(dt)
        if not round_info:
            print(f"- {dt.isoformat()} ({day_name}): nessuna gara in calendario.")
            continue

        lobbies = gtv_lobbies_for_day(data, day_name)
        if not lobbies:
            print(f"- {dt.isoformat()} ({day_name}): nessun pilota GTV in pista.")
            continue

        text = build_message(round_info, dt, day_name, lobbies, badge)
        path = write_message_file(dt, day_name, text)
        generated += 1
        print(f"\n===== {dt.isoformat()} · {day_name} · {round_info['label']} "
              f"({round_info['track']}) =====")
        print(text)
        print(f"\n-> salvato in {path}")

        if args.copy and len(target_days) == 1:
            if copy_to_clipboard(text):
                print("-> copiato negli appunti OK")

        if args.send_telegram and len(target_days) == 1:
            if not token or not chat_id:
                print("x Invio Telegram richiede TELEGRAM_BOT_TOKEN e "
                      "TELEGRAM_CHAT_ID.", file=sys.stderr)
                return 2
            if not args.force and now_ro.hour != 0:
                print(f"- Invio saltato: ora italiana {now_ro.hour:02d}:"
                      f"{now_ro.minute:02d} fuori dalla finestra di mezzanotte "
                      f"(usa --force per forzare).")
                continue
            res = telegram_send(token, chat_id, text)
            if res.get("ok"):
                sent += 1
                print("-> inviato su Telegram OK")
            else:
                print(f"x Errore Telegram: {res}", file=sys.stderr)
                return 1

    print(f"\nMessaggi generati: {generated} · inviati su Telegram: {sent}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

