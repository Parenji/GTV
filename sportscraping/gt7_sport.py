#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sport Mode GT7 — raccolta dati per i piloti GTV
===============================================
Costruisce `sportscraping/sport.json`, il file che alimenta le sezioni
"Sport" e "Sport Stats" di index.html.

Fonti (pubbliche, nessuna autenticazione):
  - https://gt-gridstats.com/player/<PSN>
      * Driver Rating / Sportsmanship Rating
      * Event History   -> le "Lap Time Challenge" (time trial) con rank
                           globale e tempo sul giro
      * Daily Race History -> le gare settimanali con rank globale e best lap
  - https://gt-gridstats.com/explore-events
      * time trial in corso (pista, auto, scadenza)
  - API ufficiale Polyphony (endpoint pubblici, servono solo per la classifica
    mondiale del time trial in corso):
      * POST /event/get_folder   -> elenco degli eventi time trial
      * POST /ranking/get_top_list -> top 100 + numero totale di partecipanti
    Da qui prendiamo il tempo del leader (per il distacco assoluto) e il numero
    di iscritti; il rank personale oltre il 100 non e' pubblico e arriva da
    gt-gridstats.

gt-gridstats.com e' un sito non ufficiale della community (non affiliato a
Polyphony Digital / Sony): i dati arrivano dal loro sync con i server del
gioco. Lo scraping e' volutamente gentile (una richiesta alla volta con pausa)
e il file viene rigenerato 2 volte al giorno.

Uso:
    python3 gt7_sport.py                # aggiorna sport.json
    python3 gt7_sport.py --limit 3      # prova rapida su 3 piloti
    python3 gt7_sport.py --verbose
"""

import argparse
import csv
import html
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
OUT_JSON = BASE_DIR / "sport.json"

USER_AGENT = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
              "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36")
PAUSA = 1.2                 # secondi fra una richiesta e l'altra (gentile)
TIMEOUT = 30

PILOTI_URL = ("https://docs.google.com/spreadsheets/d/e/"
              "2PACX-1vQ0hWQI6bqzVdr38OpcUlsNHcvuXnjzqdte1skzC8A9KAUFExFzXWqA7MCLbFiL0k1Gw1GMHBAJghCn"
              "/pub?gid=0&single=true&output=csv")

GRIDSTATS = "https://gt-gridstats.com"
WEB_API = "https://web-api.gt7.game.gran-turismo.com"
REGIONE_EU = 2          # 2 = Europa (i piloti GTV corrono in questa regione)
FOLDER_TIME_TRIAL = 249

MESI = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}

MESI_IT = {"Jan": "Gen", "Feb": "Feb", "Mar": "Mar", "Apr": "Apr", "May": "Mag",
           "Jun": "Giu", "Jul": "Lug", "Aug": "Ago", "Sep": "Set", "Oct": "Ott",
           "Nov": "Nov", "Dec": "Dic"}


def data_it(valore):
    """'01 Oct 2026' -> '01 Ott 2026' (il sito e' in italiano)."""
    if not valore:
        return valore
    return re.sub(
        r"(\d{1,2}\s+)([A-Za-z]{3})(\s+\d{4})",
        lambda m: m.group(1) + MESI_IT.get(m.group(2).title(), m.group(2)) + m.group(3),
        str(valore),
    )


MESI_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
             "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _iso_a_it(iso):
    """'2026-10-01' -> '01 Oct 2026' (poi data_it() lo rende '01 Ott 2026')."""
    if not iso:
        return None
    try:
        d = date.fromisoformat(str(iso)[:10])
    except ValueError:
        return iso
    return f"{d.day:02d} {MESI_ABBR[d.month - 1]} {d.year}"


# ---------------------------------------------------------------------------
# Rete
# ---------------------------------------------------------------------------
def fetch(url, tentativi=3):
    """Scarica una pagina con un paio di ritentativi."""
    ultimo = None
    for n in range(tentativi):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": USER_AGENT,
                "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
            })
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise
            ultimo = e
        except Exception as e:      # rete, timeout...
            ultimo = e
        time.sleep(1.5 * (n + 1))
    raise RuntimeError(f"impossibile scaricare {url}: {ultimo}")


def post_json(path, body, timeout=TIMEOUT):
    """POST JSON verso l'API ufficiale Polyphony (endpoint pubblici)."""
    req = urllib.request.Request(
        WEB_API + path,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def eventi_ufficiali(region_id=REGIONE_EU):
    """Tutti gli eventi time trial pubblicati (passati e in corso).

    Ritorna [{begin, end, ranking_id, event_id}] con date ISO.
    """
    eventi = post_json("/event/get_folder",
                       {"region_id": region_id,
                        "folder_id": FOLDER_TIME_TRIAL}).get("result") or []
    out = []
    for ev in eventi:
        online = (ev.get("parameters") or {}).get("online") or {}
        begin, end = (online.get("begin_date") or "")[:10], (online.get("end_date") or "")[:10]
        if not begin or not end:
            continue
        out.append({"begin": begin, "end": end,
                    "ranking_id": online.get("ranking_id"),
                    "event_id": ev.get("event_id")})
    out.sort(key=lambda e: e["end"], reverse=True)
    return out


def board_ufficiale(ranking_id):
    """Leader mondiale e numero di iscritti di una classifica ufficiale."""
    if not ranking_id:
        return {}
    res = post_json("/ranking/get_top_list", {"board_id": ranking_id}).get("result") or {}
    top = res.get("list") or []
    leader = top[0] if top else {}
    return {
        "partecipanti": res.get("total"),
        "leader": (leader.get("user") or {}).get("np_online_id"),
        "leader_ms": leader.get("score"),
    }


def testo_righe(raw_html):
    """HTML -> lista di righe di testo (una per nodo), come le legge l'occhio."""
    senza_script = re.sub(r"<script.*?</script>|<style.*?</style>", " ",
                          raw_html, flags=re.S | re.I)
    testo = html.unescape(re.sub(r"<[^>]+>", "\n", senza_script))
    return [r.strip() for r in testo.splitlines() if r.strip()]


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------
def tempo_in_ms(valore):
    """'1:40.576' -> 100576 · '40.576' -> 40576."""
    m = re.match(r"^(?:(\d+):)?(\d+)\.(\d+)$", valore.strip())
    if not m:
        return None
    minuti = int(m.group(1) or 0)
    return (minuti * 60 + int(m.group(2))) * 1000 + int(m.group(3).ljust(3, "0"))


def _ms_a_tempo(ms):
    """112486 -> '1:52.486'."""
    if not ms:
        return None
    ms = int(ms)
    return f"{ms // 60000}:{(ms // 1000) % 60:02d}.{ms % 1000:03d}"


def rank_in_int(valore):
    """'#40,619' -> 40619."""
    m = re.search(r"([\d.,]+)", valore or "")
    if not m:
        return None
    try:
        return int(m.group(1).replace(".", "").replace(",", ""))
    except ValueError:
        return None


def data_da_testo(valore):
    """'17 Sep 2026 -' -> date(2026,9,17)."""
    pulito = re.sub(r"[\s\-–—]+$", "", (valore or "").strip())
    pulito = re.sub(r"^[\s\-–—]+", "", pulito)
    m = re.match(r"^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$", pulito)
    if not m:
        return None
    mese = MESI.get(m.group(2).lower())
    if not mese:
        return None
    return date(int(m.group(3)), mese, int(m.group(1)))


def _righe_tabella(righe, inizio, fini, n_campi):
    """Estrae le righe di una tabella del profilo.

    Ogni riga termina con il rank ('#12,345') seguito dal tempo: usiamo quella
    coppia come ancora. `n_campi` e' il numero di campi che precedono il rank
    (le righe di intestazione della tabella vengono scartate tenendo solo gli
    ultimi `n_campi` elementi accumulati).
    """
    try:
        i = righe.index(inizio)
    except ValueError:
        return []
    j = len(righe)
    for fine in fini:
        if fine in righe[i + 1:]:
            j = min(j, righe.index(fine, i + 1))
    corpo = righe[i + 1:j]

    out, buffer = [], []
    k = 0
    while k < len(corpo):
        riga = corpo[k]
        if (riga.startswith("#") and k + 1 < len(corpo)
                and re.match(r"^[\d:.]+$", corpo[k + 1])):
            campi = buffer[-n_campi:] if n_campi else list(buffer)
            out.append(campi + [riga, corpo[k + 1]])
            buffer = []
            k += 2
            continue
        buffer.append(riga)
        k += 1
    return out


def parse_profilo(raw_html):
    """Estrae i dati di un profilo /player/<PSN>."""
    righe = testo_righe(raw_html)

    # Intestazione: nome GT7, PSN, poi la coppia DR / SR
    dr = sr = None
    if "Driver Rating" in righe:
        i = righe.index("Driver Rating")
        valori = [r for r in righe[i + 1:i + 4] if r != "/"]
        if valori:
            dr = valori[0]
        if len(valori) > 1:
            sr = valori[1]

    def contatore(etichetta):
        if etichetta in righe:
            i = righe.index(etichetta)
            for r in righe[i + 1:i + 3]:
                if re.match(r"^[\d.,]+$", r):
                    return int(r.replace(".", "").replace(",", ""))
        return None

    # Nome GT7 e PSN: le due righe subito prima di "New Search"
    gt7name = psn = None
    if "New Search" in righe:
        i = righe.index("New Search")
        precedenti = [r for r in righe[max(0, i - 3):i] if r != "•"]
        if len(precedenti) >= 2:
            gt7name, psn = precedenti[-2], precedenti[-1]

    # --- Event History = time trial (Lap Time Challenge)
    eventi = []
    for campi in _righe_tabella(righe, "Event History", ["Daily Race History"], 5):
        if len(campi) < 7:
            continue
        pista, tipo, auto_, inizio, fine, rank, tempo = campi[:7]
        eventi.append({
            "pista": pista,
            "tipo": tipo,
            "auto": auto_,
            "inizio": inizio,
            "fine": fine,
            "data_inizio": (data_da_testo(inizio).isoformat()
                            if data_da_testo(inizio) else None),
            "data_fine": (data_da_testo(fine).isoformat()
                          if data_da_testo(fine) else None),
            "rank": rank,
            "rank_int": rank_in_int(rank),
            "tempo": tempo,
            "tempo_ms": tempo_in_ms(tempo or ""),
        })

    # --- Daily Race History = gare settimanali
    gare = []
    for campi in _righe_tabella(righe, "Daily Race History",
                                ["Event History", "Championship"], 4):
        if len(campi) < 6:
            continue
        pista, gara, auto_, quando, rank, tempo = campi[:6]
        gare.append({
            "pista": pista,
            "gara": gara,
            "auto": auto_,
            "data": quando,
            "data_iso": (data_da_testo(quando).isoformat()
                         if data_da_testo(quando) else None),
            "rank": rank,
            "rank_int": rank_in_int(rank),
            "tempo": tempo,
            "tempo_ms": tempo_in_ms(tempo or ""),
        })

    return {
        "psn": psn,
        "gt7name": gt7name,
        "dr": dr,
        "sr": sr,
        "entries": contatore("Total Entries"),
        "vittorie": contatore("Victories"),
        "pole": contatore("Poles"),
        "eventi": eventi,
        "gare": gare,
    }


def parse_dailies(raw_html):
    """Le 3 gare settimanali attive (Race A/B/C) con pista e impostazioni."""
    righe = testo_righe(raw_html)
    try:
        i = righe.index("Current Races")
    except ValueError:
        return []
    # la sezione finisce dove iniziano gli archivi delle settimane precedenti
    fine = righe.index("Previous Week") if "Previous Week" in righe[i:] else len(righe)
    gare = []
    k = i + 1
    while k < fine:
        m = re.match(r"^Race ([ABC])$", righe[k])
        if not m:
            k += 1
            continue
        if k + 1 >= fine:
            break
        pista = righe[k + 1]
        pezzi = []
        j = k + 2
        while (j < fine and righe[j] not in ("Top 100", "Close")
               and not righe[j].startswith("Race ")):
            if righe[j] != "|" and "Pending first scrape" not in righe[j]:
                pezzi.append(righe[j])
            j += 1
        # le righe vanno a coppie: "Comfort S", "Fuel x1", "Tires x1"...
        impostazioni = [f"{a} {b}" if b else a
                        for a, b in zip(pezzi[0::2], pezzi[1::2] + [""])]
        gare.append({
            "nome": f"Race {m.group(1)}",
            "pista": pista,
            "impostazioni": " · ".join(impostazioni[:6]) or None,
        })
        k = j + 1
    return gare


def parse_explore_events(raw_html):
    """Eventi time trial attivi (nome pista e auto) + classifica mondiale top 100."""
    righe = testo_righe(raw_html)

    # In cima ci sono TUTTE le time trial attive (di norma 2 in contemporanea)
    eventi = []
    if "Active Events" in righe:
        k = righe.index("Active Events") + 1
        while k + 3 < len(righe) and righe[k].lower() == "time trial":
            inizio, pista, auto_ = righe[k + 1], righe[k + 2], righe[k + 3]
            if not data_da_testo(inizio):
                break
            eventi.append({"inizio": inizio, "pista": pista, "auto": auto_})
            k += 4

    # Il blocco marcato "Live" e' quello in evidenza (con la classifica sotto)
    attivo = {}
    for k, r in enumerate(righe):
        if r.lower() == "live" and k >= 3 and k + 2 < len(righe):
            attivo = {"inizio": righe[k - 3], "fine": righe[k - 1],
                      "pista": righe[k + 1], "auto": righe[k + 2]}
            break

    classifica = []
    if "Pos" in righe and "Driver" in righe:
        i = righe.index("Driver", righe.index("Pos"))
        k = i + 1
        # salta le intestazioni residue ("Time", "Gap") fino alla prima posizione
        while k < len(righe) and not re.match(r"^\d+$", righe[k]):
            k += 1
        while k + 4 < len(righe) and re.match(r"^\d+$", righe[k]):
            pos, driver, drsr, tempo = righe[k], righe[k + 1], righe[k + 2], righe[k + 3]
            distacco = righe[k + 4]
            m = re.search(r"DR:\s*([\w+]+).*?SR:\s*([\w+]+)", drsr)
            classifica.append({
                "pos": int(pos),
                "psn": driver,
                "dr": m.group(1) if m else None,
                "sr": m.group(2) if m else None,
                "tempo": tempo,
                "tempo_ms": tempo_in_ms(tempo),
                "distacco_leader": distacco if distacco.startswith("+") else None,
            })
            k += 5
    return {"eventi": eventi, "attivo": attivo, "top": classifica}


# ---------------------------------------------------------------------------
# Piloti GTV (dal foglio pubblico del team)
# ---------------------------------------------------------------------------
def carica_piloti_gtv():
    req = urllib.request.Request(PILOTI_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=40) as resp:
        raw = resp.read().decode("utf-8-sig")
    righe = list(csv.reader(io.StringIO(raw)))
    piloti = []
    for r in righe[1:]:
        squadra = r[3].strip().upper() if len(r) > 3 else ""
        # il team schiera due formazioni: GTV (principale) e JGTV (junior)
        if squadra not in ("GTV", "JGTV"):
            continue
        psn = r[0].strip()
        if not psn:
            continue
        nome_gt7 = r[1].strip()
        if nome_gt7.upper() in ("#N/A", "N/A", "NA", "-"):
            nome_gt7 = ""
        piloti.append({
            "psn": psn,
            "gt7name": nome_gt7,
            "numero": r[2].strip(),
            "squadra": squadra,
            "categoria": r[6].strip() if len(r) > 6 else "",
        })
    return piloti


# ---------------------------------------------------------------------------
# Costruzione di sport.json
# ---------------------------------------------------------------------------
def build(piloti, profili, esplora, ufficiali, board_info, gare_attive=None, n_passati=5):
    """Costruisce il contenuto di sport.json.

    board_info(ranking_id) -> {leader, leader_ms, partecipanti}
    """
    gare_attive = gare_attive or []
    oggi = date.today().isoformat()

    # nomi (pista/auto) degli eventi attivi, presi dall'elenco di gt-gridstats
    nomi_per_inizio = {}
    for ev in esplora.get("eventi", []):
        d = data_da_testo(ev.get("inizio"))
        if d:
            nomi_per_inizio[d.isoformat()] = ev

    # Raggruppo le time trial dei piloti per EVENTO: (inizio, fine, pista).
    # La sola data di fine non basta: piu' time trial si chiudono lo stesso
    # giorno (partono a settimane sfalsate) e raggrupparle per data mescolava
    # eventi diversi nella stessa classifica, con lo stesso pilota due volte e
    # tempi di piste diverse a confronto.
    per_evento = {}
    for p in piloti:
        prof = profili.get(p["psn"])
        if not prof:
            continue
        for e in prof["eventi"]:
            if not (e.get("data_inizio") and e.get("data_fine")):
                continue
            per_evento.setdefault(
                (e["data_inizio"], e["data_fine"], e["pista"]), []).append((p, e))

    def scegli_board(begin, end, migliore_ms):
        """Fra piu' eventi ufficiali con le stesse date sceglie quello giusto.

        Le date da sole non bastano a identificarli: il leader dell'evento
        corretto deve essere piu' veloce del miglior tempo del team, quindi
        scelgo il piu' lento fra quelli ancora piu' veloci del team.
        """
        schede = []
        for u in ufficiali:
            if u["begin"] != begin or u["end"] != end:
                continue
            info = board_info(u.get("ranking_id"))
            if info.get("leader_ms"):
                schede.append(info)
        if not schede:
            return {}
        if migliore_ms:
            plausibili = [s for s in schede if s["leader_ms"] <= migliore_ms]
            if plausibili:
                return max(plausibili, key=lambda s: s["leader_ms"])
        return min(schede, key=lambda s: abs(s["leader_ms"] - (migliore_ms or s["leader_ms"])))

    def scheda_evento(chiave, conclusa):
        inizio, fine, pista = chiave
        sorgente = per_evento.get(chiave, [])
        nome = nomi_per_inizio.get(inizio) or {}
        if not pista:
            pista = nome.get("pista")
        auto_ = nome.get("auto") or (sorgente[0][1]["auto"] if sorgente else None)

        voci = [{
            "psn": p["psn"],
            "gt7name": p["gt7name"] or p["psn"],
            "numero": p["numero"],
            "squadra": p.get("squadra", "GTV"),
            "tempo": e["tempo"],
            "tempo_ms": e["tempo_ms"],
            "pos_assoluta": e["rank_int"],
        } for p, e in sorgente]

        voci.sort(key=lambda v: v["tempo_ms"] or 10 ** 9)
        mig = voci[0]["tempo_ms"] if voci else None
        info = scegli_board(inizio, fine, mig)
        leader_ms = info.get("leader_ms")
        for i, v in enumerate(voci, start=1):
            v["pos_gtv"] = i
            v["distacco_gtv_pct"] = (
                round((v["tempo_ms"] - mig) / mig * 100, 3)
                if v["tempo_ms"] and mig else None)
            v["distacco_assoluto_pct"] = (
                round((v["tempo_ms"] - leader_ms) / leader_ms * 100, 3)
                if v["tempo_ms"] and leader_ms else None)

        etichetta = _iso_a_it(fine)
        return {
            "nome": f"Time Trial · {pista or 'evento'}",
            "pista": pista,
            "auto": auto_,
            "inizio": data_it(_iso_a_it(inizio)),
            "fine": data_it(etichetta),
            "scadenza": data_it(etichetta),
            "miglior_tempo": _ms_a_tempo(leader_ms),
            "leader": info.get("leader"),
            "partecipanti": info.get("partecipanti"),
            "conclusa": conclusa,
            "classifica": voci,
        }

    # Eventi in corso: quelli ufficiali (anche se nessuno del team ha girato)
    attivi, usate = [], set()
    for u in ufficiali:
        if u["end"] < oggi:
            continue
        nome = nomi_per_inizio.get(u["begin"]) or {}
        chiavi = [k for k in per_evento if k[0] == u["begin"] and k[1] == u["end"]]
        if nome.get("pista"):
            preferite = [k for k in chiavi if k[2] == nome["pista"]]
            chiavi = preferite or chiavi
        chiave = chiavi[0] if chiavi else (u["begin"], u["end"], nome.get("pista"))
        if chiave in usate:
            continue
        usate.add(chiave)
        attivi.append(scheda_evento(chiave, False))

    # Eventi conclusi: quelli per cui il team ha davvero dei tempi
    passati = []
    for chiave in sorted(per_evento, key=lambda k: (k[1], k[0]), reverse=True):
        if chiave[1] >= oggi or chiave in usate:
            continue
        usate.add(chiave)
        passati.append(scheda_evento(chiave, True))
        if len(passati) >= n_passati:
            break

    # rete di sicurezza: se l'API ufficiale non risponde, gli eventi in corso
    # si ricavano dalle date viste nei profili
    if not attivi:
        for chiave in sorted(per_evento, key=lambda k: (k[1], k[0]), reverse=True):
            if chiave[1] >= oggi and chiave not in usate:
                usate.add(chiave)
                attivi.append(scheda_evento(chiave, False))

    time_trial = {"attivi": attivi, "passati": passati}

    # --- Gare settimanali: le 3 gare ATTIVE adesso (Race A/B/C), con i tempi
    #     del team. Una gara cambia ogni settimana, quindi i tempi vecchi sulla
    #     stessa pista non valgono: contano solo quelli degli ultimi 7 giorni.
    def codice_gara(valore):
        m = re.search(r"([ABC])\s*$", (valore or "").strip())
        return m.group(1) if m else None

    limite_settimana = (date.today() - timedelta(days=7)).isoformat()
    gare_settimanali = []
    for gara in gare_attive:
        codice = codice_gara(gara["nome"])
        voci = []
        for p in piloti:
            prof = profili.get(p["psn"])
            if not prof:
                continue
            for g in prof["gare"]:
                if codice_gara(g.get("gara")) != codice or g.get("pista") != gara["pista"]:
                    continue
                if (g.get("data_iso") or "") >= limite_settimana:
                    voci.append({
                        "psn": p["psn"],
                        "gt7name": p["gt7name"] or p["psn"],
                        "numero": p["numero"],
                        "squadra": p.get("squadra", "GTV"),
                        "auto": g["auto"],
                        "data": data_it(g["data"]),
                        "tempo": g["tempo"],
                        "tempo_ms": g["tempo_ms"],
                        "pos_assoluta": g["rank_int"],
                    })

        voci.sort(key=lambda v: v["tempo_ms"] or 10 ** 9)
        mig = voci[0]["tempo_ms"] if voci else None
        for i, v in enumerate(voci, start=1):
            v["pos_gtv"] = i
            v["distacco_gtv_pct"] = (
                round((v["tempo_ms"] - mig) / mig * 100, 3)
                if v["tempo_ms"] and mig else None)
            v["distacco_assoluto_pct"] = None   # leader mondiale non pubblico

        gare_settimanali.append({
            "nome": f"{gara['nome']} · {gara['pista']}",
            "pista": gara["pista"],
            "impostazioni": gara.get("impostazioni"),
            "classifica": voci,
        })

    # --- Statistiche e storico per pilota
    statistiche = []
    storico = []
    rank_del_team = []
    for p in piloti:
        prof = profili.get(p["psn"])
        if not prof:
            continue
        eventi, gare = prof["eventi"], prof["gare"]
        rank_tt = [e["rank_int"] for e in eventi if e["rank_int"]]
        rank_gare = [g["rank_int"] for g in gare if g["rank_int"]]
        tutti_i_rank = rank_tt + rank_gare
        rank_del_team.extend(tutti_i_rank)
        miglior_rank = min(tutti_i_rank) if tutti_i_rank else None
        ultima_data = max([d for d in
                           ([e.get("data_fine") for e in eventi] +
                            [g.get("data_iso") for g in gare]) if d] or [None])
        statistiche.append({
            "psn": p["psn"],
            "gt7name": p["gt7name"] or prof.get("gt7name") or p["psn"],
            "numero": p["numero"],
            "squadra": p.get("squadra", "GTV"),
            "categoria": p["categoria"],
            "dr": prof["dr"],
            "sr": prof["sr"],
            "miglior_rank": miglior_rank,
            "rank_medio": round(sum(tutti_i_rank) / len(tutti_i_rank))
            if tutti_i_rank else None,
            "eventi_pubblicati": len(tutti_i_rank),
            "ultimo_evento_data": ultima_data,
            "ultimo_evento": eventi[0]["pista"] if eventi else None,
            "ultima_gara": gare[0]["pista"] if gare else None,
        })
        for e in eventi[:8]:
            storico.append({
                "data": data_it(e["fine"]), "data_iso": e.get("data_fine"),
                "psn": p["psn"],
                "gt7name": p["gt7name"] or p["psn"],
                "squadra": p.get("squadra", "GTV"),
                "evento": f"Time Trial · {e['pista']}",
                "pos": e["rank"], "tempo": e["tempo"], "tipo": "time_trial",
            })
        for g in gare[:8]:
            storico.append({
                "data": data_it(g["data"]), "data_iso": g.get("data_iso"),
                "psn": p["psn"],
                "gt7name": p["gt7name"] or p["psn"],
                "squadra": p.get("squadra", "GTV"),
                "evento": f"{g['gara']} · {g['pista']}",
                "pos": g["rank"], "tempo": g["tempo"], "tipo": "gara",
            })

    # lo storico si legge dal piu' recente al piu' vecchio
    storico.sort(key=lambda s: (s.get("data_iso") or ""), reverse=True)

    # --- Grafico: come si distribuiscono i piazzamenti mondiali del team
    fasce = [("Top 100", 0, 100), ("101 – 500", 101, 500),
             ("501 – 1.000", 501, 1000), ("1.001 – 5.000", 1001, 5000),
             ("5.001 – 20.000", 5001, 20000), ("oltre 20.000", 20001, None)]
    grafico_rank = []
    for etichetta, minimo, massimo in fasce:
        n = sum(1 for r in rank_del_team
                if r >= minimo and (massimo is None or r <= massimo))
        grafico_rank.append({"etichetta": etichetta, "conteggio": n})
        for e in eventi[:8]:
            storico.append({
                "data": data_it(e["fine"]), "data_iso": e.get("data_fine"),
                "psn": p["psn"],
                "gt7name": p["gt7name"] or p["psn"],
                "squadra": p.get("squadra", "GTV"),
                "evento": f"Time Trial · {e['pista']}",
                "pos": e["rank"], "tempo": e["tempo"], "tipo": "time_trial",
            })
        for g in gare[:8]:
            storico.append({
                "data": data_it(g["data"]), "data_iso": g.get("data_iso"),
                "psn": p["psn"],
                "gt7name": p["gt7name"] or p["psn"],
                "squadra": p.get("squadra", "GTV"),
                "evento": f"{g['gara']} · {g['pista']}",
                "pos": g["rank"], "tempo": g["tempo"], "tipo": "gara",
            })

    # lo storico si legge dal piu' recente al piu' vecchio
    storico.sort(key=lambda s: (s.get("data_iso") or ""), reverse=True)

    return {
        "meta": {
            "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "fonte": "gt-gridstats.com (dati Sport Mode Gran Turismo 7)",
            "piloti_gtv": len(piloti),
            "piloti_con_dati": len(profili),
            "nota": "Sito non ufficiale della community, non affiliato a Polyphony Digital/Sony.",
        },
        "time_trial": time_trial,
        "gare_settimanali": gare_settimanali,
        "piloti": statistiche,
        "storico": storico,
        "grafici": {
            "fasce_rank": grafico_rank,
            "eventi_totali": len(rank_del_team),
        },
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Raccoglie i dati Sport Mode GT7 dei piloti GTV.")
    ap.add_argument("--limit", type=int, help="limita il numero di piloti (per prove)")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    print("Leggo l'elenco dei piloti del team dal foglio...")
    piloti = carica_piloti_gtv()
    if args.limit:
        piloti = piloti[:args.limit]
    squadre = {}
    for p in piloti:
        squadre[p.get("squadra", "GTV")] = squadre.get(p.get("squadra", "GTV"), 0) + 1
    print(f"  {len(piloti)} piloti " + " + ".join(f"{n} {s}" for s, n in sorted(squadre.items())))

    print("Scarico l'elenco ufficiale delle time trial...")
    ufficiali = []
    try:
        ufficiali = eventi_ufficiali()
        attivi = [e for e in ufficiali if e["end"] >= date.today().isoformat()]
        print(f"  {len(ufficiali)} eventi totali · {len(attivi)} in corso")
        for e in attivi:
            print(f"     in corso: {e['begin']} -> {e['end']}")
    except Exception as e:
        print(f"  ! API ufficiale non disponibile: {e}", file=sys.stderr)

    cache_board = {}

    def board_info(ranking_id):
        if not ranking_id:
            return {}
        if ranking_id not in cache_board:
            try:
                cache_board[ranking_id] = board_ufficiale(ranking_id)
                time.sleep(0.4)
            except Exception as e:
                print(f"  ! classifica {ranking_id}: {e}", file=sys.stderr)
                cache_board[ranking_id] = {}
        return cache_board[ranking_id]

    try:
        esplora = parse_explore_events(fetch(f"{GRIDSTATS}/explore-events"))
        print(f"  time trial attive su gt-gridstats: "
              f"{', '.join(e['pista'] for e in esplora['eventi'])}")
    except Exception as e:
        print(f"  ! pagina eventi non disponibile: {e}", file=sys.stderr)
        esplora = {"eventi": [], "attivo": {}, "top": []}

    print("Scarico le gare settimanali attive...")
    gare_attive = []
    try:
        gare_attive = parse_dailies(fetch(f"{GRIDSTATS}/dailies"))
        print(f"  {len(gare_attive)} gare attive: "
              + ", ".join(f"{g['nome']} ({g['pista']})" for g in gare_attive))
    except Exception as e:
        print(f"  ! pagina gare non disponibile: {e}", file=sys.stderr)

    profili = {}
    for i, p in enumerate(piloti, start=1):
        url = f"{GRIDSTATS}/player/{urllib.parse.quote(p['psn'])}"
        try:
            prof = parse_profilo(fetch(url))
            prof["psn"] = prof.get("psn") or p["psn"]
            profili[p["psn"]] = prof
            if args.verbose:
                print(f"  [{i}/{len(piloti)}] {p['psn']:<22} "
                      f"DR={prof['dr']} SR={prof['sr']} "
                      f"TT={len(prof['eventi'])} gare={len(prof['gare'])}")
            else:
                print(f"  [{i}/{len(piloti)}] {p['psn']}")
        except urllib.error.HTTPError as e:
            print(f"  [{i}/{len(piloti)}] {p['psn']}: HTTP {e.code} (saltato)")
        except Exception as e:
            print(f"  [{i}/{len(piloti)}] {p['psn']}: {e} (saltato)")
        time.sleep(PAUSA)

    # Rete di sicurezza: se la fonte risponde male e leggiamo molti meno
    # profili del giro precedente, NON sovrascriviamo un file buono con uno
    # quasi vuoto (il workflow committa solo se il file cambia).
    precedenti = 0
    if OUT_JSON.exists():
        try:
            precedenti = json.loads(OUT_JSON.read_text(encoding="utf-8")) \
                .get("meta", {}).get("piloti_con_dati", 0)
        except Exception:
            precedenti = 0
    if precedenti and len(profili) < precedenti * 0.6:
        print(f"x Letti {len(profili)} profili su {len(piloti)} (nel giro precedente "
              f"erano {precedenti}): non sovrascrivo {OUT_JSON.name}.",
              file=sys.stderr)
        return 1

    dati = build(piloti, profili, esplora, ufficiali, board_info, gare_attive)
    OUT_JSON.write_text(json.dumps(dati, ensure_ascii=False, indent=2), encoding="utf-8")
    tt = dati["time_trial"]
    print(f"\nOK -> {OUT_JSON}")
    print(f"   time trial in corso: {len(tt['attivi'])}")
    for e in tt["attivi"]:
        print(f"     {e['pista']} (scade {e['scadenza']}) · "
              f"{len(e['classifica'])} piloti del team in classifica")
    print(f"   time trial passate: {len(tt['passati'])}")
    print(f"   gare settimanali: {len(dati['gare_settimanali'])} eventi · "
          f"storico: {len(dati['storico'])} voci · piloti: {len(dati['piloti'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
