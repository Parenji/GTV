#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Proxy per l'API ufficiale GT7
=============================

Perche' esiste: l'API pubblica di Polyphony risponde **403 Forbidden** agli IP
dei datacenter (verificato il 26/09/2026: dal runner di GitHub Actions sia
`/event/get_folder` sia `/ranking/get_top_list` danno 403, mentre gt-gridstats
e api.github.com rispondono 200). Da li' quindi non arrivano piu' il tempo del
leader mondiale e il numero di partecipanti.

Questo endpoint gira su Vercel e fa da ponte: se l'egress di Vercel non e'
bloccato, il workflow di GitHub puo' leggere i dati ufficiali passando di qui.

Uso (solo lettura, nessun dato dell'utente):
    GET /api/gt7?board=<ranking_id>   -> leader e partecipanti di una classifica
    GET /api/gt7?events=1             -> elenco degli eventi time trial
    GET /api/gt7                      -> stato della funzione

Nessun segreto: gli endpoint Polyphony sono pubblici e non richiedono login.
"""

import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

WEB_API = "https://web-api.gt7.game.gran-turismo.com"
FOLDER_TIME_TRIAL = 249
REGIONE_EU = 2
USER_AGENT = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
              "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
TIMEOUT = 8          # sotto il limite di durata delle funzioni Vercel


def post_json(path, corpo):
    """POST JSON verso l'API ufficiale; solleva RuntimeError con lo stato HTTP."""
    req = urllib.request.Request(
        WEB_API + path,
        data=json.dumps(corpo).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} da {path}") from e
    except Exception as e:
        raise RuntimeError(f"{type(e).__name__} su {path}: {e}") from e


def classifica(board_id):
    """Tempo del leader e numero di partecipanti di una classifica."""
    res = (post_json("/ranking/get_top_list", {"board_id": board_id})
           .get("result") or {})
    top = res.get("list") or []
    leader = top[0] if top else {}
    return {
        "partecipanti": res.get("total"),
        "leader": (leader.get("user") or {}).get("np_online_id"),
        "leader_ms": leader.get("score"),
    }


def eventi():
    """Elenco degli eventi time trial, con date e id classifica."""
    res = (post_json("/event/get_folder",
                     {"region_id": REGIONE_EU, "folder_id": FOLDER_TIME_TRIAL})
           .get("result") or [])
    out = []
    for ev in res:
        online = (ev.get("parameters") or {}).get("online") or {}
        begin = (online.get("begin_date") or "")[:10]
        end = (online.get("end_date") or "")[:10]
        if not begin or not end:
            continue
        out.append({"begin": begin, "end": end,
                    "end_ts": online.get("end_date"),
                    "ranking_id": online.get("ranking_id"),
                    "event_id": ev.get("event_id")})
    out.sort(key=lambda e: e["end"], reverse=True)
    return out


class handler(BaseHTTPRequestHandler):
    def _reply(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("CDN-Cache-Control", "no-store")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        from urllib.parse import parse_qs, urlparse
        query = parse_qs(urlparse(self.path).query)
        inizio = time.time()
        try:
            if query.get("events"):
                dati = {"ok": True, "eventi": eventi()}
            elif query.get("board"):
                dati = {"ok": True, "classifica": classifica(query["board"][0])}
            else:
                dati = {"ok": True, "endpoint": "proxy API ufficiale GT7",
                        "uso": ["?board=<ranking_id>", "?events=1"],
                        "quando": datetime.now(timezone.utc).isoformat(timespec="seconds")}
        except Exception as e:
            return self._reply(502, {"ok": False, "errore": str(e)})
        dati["secondi"] = round(time.time() - inizio, 1)
        return self._reply(200, dati)
