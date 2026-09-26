#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Diagnostica delle fonti di dati Sport Mode
==========================================

Serve a capire perche' i giri automatici (GitHub Actions) non riescono a
leggere l'API ufficiale Polyphony: senza di quella mancano il tempo del leader
mondiale e il numero di partecipanti, mentre i piazzamenti dei piloti (che
arrivano da gt-gridstats) continuano a funzionare.

Uso:
    python3 diagnostica.py            # stampa il referto
    python3 diagnostica.py --scrivi   # lo salva anche in diagnostica.txt

Il referto non contiene credenziali: solo esiti HTTP e messaggi d'errore.
"""

import argparse
import json
import os
import platform
import socket
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

WEB_API = "https://web-api.gt7.game.gran-turismo.com"
GRIDSTATS = "https://gt-gridstats.com"
PROXY_GT7 = os.environ.get("GTV_GT7_PROXY",
                           "https://granturismotv.vercel.app/api/gt7")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
BOARD = "p_rt_1014922_001"          # una classifica time trial qualsiasi


def _post(url, corpo, timeout=20):
    """POST JSON: ritorna una riga di referto (mai solleva)."""
    req = urllib.request.Request(
        url, data=json.dumps(corpo).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": UA})
    inizio = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            dati = resp.read()
            return (f"HTTP {resp.status} · {len(dati)} byte · "
                    f"{time.time() - inizio:.1f}s · inizio risposta: "
                    f"{dati[:80].decode('utf-8', 'replace')!r}")
    except urllib.error.HTTPError as e:
        corpo_err = e.read()[:200].decode("utf-8", "replace")
        return f"HTTPError {e.code} ({e.reason}) · risposta: {corpo_err!r}"
    except Exception as e:
        return f"{type(e).__name__}: {e}"


def _get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    inizio = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return f"HTTP {resp.status} · {len(resp.read())} byte · {time.time() - inizio:.1f}s"
    except urllib.error.HTTPError as e:
        return f"HTTPError {e.code} ({e.reason})"
    except Exception as e:
        return f"{type(e).__name__}: {e}"


def referto():
    righe = []
    def scrivi(t=""):
        righe.append(t)
        print(t)

    scrivi("Diagnostica fonti Sport Mode GT7")
    scrivi(f"  quando:  {datetime.now(timezone.utc).isoformat(timespec='seconds')}")
    scrivi(f"  macchina: {platform.platform()} · Python {platform.python_version()}")
    scrivi(f"  OpenSSL: {ssl.OPENSSL_VERSION}")
    scrivi()

    host = "web-api.gt7.game.gran-turismo.com"
    scrivi(f"1. DNS di {host}")
    try:
        indirizzi = sorted({a[4][0] for a in socket.getaddrinfo(host, 443)})
        scrivi(f"   risolto in: {', '.join(indirizzi)}")
    except Exception as e:
        scrivi(f"   {type(e).__name__}: {e}")
    scrivi()

    scrivi("2. Controllo di rete generico (deve funzionare)")
    scrivi(f"   gt-gridstats.com/explore-events -> {_get(f'{GRIDSTATS}/explore-events')}")
    scrivi(f"   api.github.com                  -> {_get('https://api.github.com')}")
    scrivi()

    scrivi("3. API ufficiale Polyphony (bloccata dai datacenter)")
    scrivi("   POST /event/get_folder    -> " + _post(
        f"{WEB_API}/event/get_folder", {"region_id": 2, "folder_id": 249}, timeout=30))
    scrivi("   POST /ranking/get_top_list -> " + _post(
        f"{WEB_API}/ranking/get_top_list", {"board_id": BOARD}))
    scrivi()

    scrivi("4. Proxy su Vercel (api/gt7.py: e' la strada usata dai runner)")
    scrivi(f"   GET /api/gt7?board={BOARD} -> " + _get(
        f"{PROXY_GT7}?board={BOARD}"))
    scrivi()
    scrivi("Se al punto 3 compare HTTPError 403 e al punto 4 un 200, tutto")
    scrivi("regolare: l'API ufficiale blocca gli IP dei datacenter e i dati")
    scrivi("ufficiali arrivano dal proxy.")
    return "\n".join(righe) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--scrivi", action="store_true",
                    help="salva il referto in diagnostica.txt")
    args = ap.parse_args()
    testo = referto()
    if args.scrivi:
        from pathlib import Path
        (Path(__file__).resolve().parent / "diagnostica.txt").write_text(
            testo, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
