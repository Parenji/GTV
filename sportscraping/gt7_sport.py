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
from datetime import date, datetime, timezone
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


def time_trial_ufficiale(region_id=REGIONE_EU):
    """Classifica ufficiale del time trial in corso: leader e partecipanti.

    L'API ufficiale espone solo la top 100: il rank personale oltre il 100
    arriva da gt-gridstats. Da qui prendiamo il tempo del leader (per il
    distacco assoluto) e il numero totale di iscritti.
    """
    eventi = post_json("/event/get_folder",
                       {"region_id": region_id,
                        "folder_id": FOLDER_TIME_TRIAL}).get("result") or []
    oggi = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    attivi = []
    for ev in eventi:
        online = (ev.get("parameters") or {}).get("online") or {}
        inizio, fine = online.get("begin_date", ""), online.get("end_date", "")
        if inizio and fine and inizio[:10] <= oggi <= fine[:10]:
            attivi.append((fine, online.get("ranking_id"), ev.get("event_id")))
    if not attivi:
        return None
    attivi.sort()
    fine, ranking_id, event_id = attivi[-1]
    if not ranking_id:
        return None
    res = post_json("/ranking/get_top_list", {"board_id": ranking_id}).get("result") or {}
    top = res.get("list") or []
    leader = top[0] if top else {}
    return {
        "event_id": event_id,
        "ranking_id": ranking_id,
        "fine": fine,
        "partecipanti": res.get("total"),
        "leader": (leader.get("user") or {}).get("np_online_id"),
        "leader_ms": leader.get("score"),
        "top": [{"pos": t.get("display_rank"),
                 "psn": (t.get("user") or {}).get("np_online_id"),
                 "tempo_ms": t.get("score")} for t in top],
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


def parse_explore_events(raw_html):
    """Time trial in corso + classifica mondiale top 100."""
    righe = testo_righe(raw_html)

    attivo = {}
    if "Active Events" in righe:
        i = righe.index("Active Events")
        # la card attiva e' l'ultima: cerca il blocco con "Live"
        for k in range(i, min(i + 60, len(righe))):
            if righe[k].lower() == "live":
                # struttura: time trial | inizio | fine | Live | pista | auto
                if k + 2 < len(righe):
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
    return {"attivo": attivo, "top": classifica}


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
        if len(r) < 6 or r[3].strip().upper() != "GTV":
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
            "categoria": r[6].strip() if len(r) > 6 else "",
        })
    return piloti


# ---------------------------------------------------------------------------
# Costruzione di sport.json
# ---------------------------------------------------------------------------
def build(piloti, profili, esplora, ufficiale=None, verbose=False):
    oggi = date.today()
    attivo = esplora["attivo"]
    top = esplora["top"]
    ufficiale = ufficiale or {}
    # Il tempo del leader viene dall'API ufficiale (esatto); se non c'e',
    # ripiego sulla top 100 letta da gt-gridstats.
    leader_ms = ufficiale.get("leader_ms") or next(
        (t["tempo_ms"] for t in top if t["pos"] == 1 and t["tempo_ms"]), None)
    leader_psn = ufficiale.get("leader") or next(
        (t["psn"] for t in top if t["pos"] == 1), None)
    partecipanti = ufficiale.get("partecipanti")

    # ATTENZIONE: in GT7 due time trial si sovrappongono per una settimana,
    # quindi "copre oggi" non basta a identificare quella corrente. Usiamo la
    # data di fine dell'evento ufficiale come impronta.
    scadenza_iso = (ufficiale.get("fine") or "")[:10] or None
    if not scadenza_iso and attivo.get("fine"):
        d = data_da_testo(attivo["fine"])
        scadenza_iso = d.isoformat() if d else None

    def evento_corrente(prof):
        for e in prof["eventi"]:
            if scadenza_iso and e.get("data_fine") == scadenza_iso:
                return e
        if not scadenza_iso:      # fallback: primo evento che copre oggi
            for e in prof["eventi"]:
                di, df = e.get("data_inizio"), e.get("data_fine")
                if di and df and di <= oggi.isoformat() <= df:
                    return e
        return None

    # --- Time trial in corso: per ogni pilota l'evento ufficiale corrente
    voci_tt = []
    for p in piloti:
        prof = profili.get(p["psn"])
        if not prof:
            continue
        corrente = evento_corrente(prof)
        if not corrente:
            continue
        voci_tt.append({
            "psn": p["psn"],
            "gt7name": p["gt7name"] or prof.get("gt7name") or p["psn"],
            "numero": p["numero"],
            "tempo": corrente["tempo"],
            "tempo_ms": corrente["tempo_ms"],
            "pos_assoluta": corrente["rank_int"],
            "pista": corrente["pista"],
            "auto": corrente["auto"],
        })

    voci_tt.sort(key=lambda v: v["tempo_ms"] or 10 ** 9)
    miglior_gtv = voci_tt[0]["tempo_ms"] if voci_tt else None
    for i, v in enumerate(voci_tt, start=1):
        v["pos_gtv"] = i
        v["distacco_gtv_pct"] = (
            round((v["tempo_ms"] - miglior_gtv) / miglior_gtv * 100, 3)
            if v["tempo_ms"] and miglior_gtv else None
        )
        v["distacco_assoluto_pct"] = (
            round((v["tempo_ms"] - leader_ms) / leader_ms * 100, 3)
            if v["tempo_ms"] and leader_ms else None
        )

    time_trial = None
    if voci_tt or attivo:
        time_trial = {
            "nome": "Time Trial · " + (attivo.get("pista") or (voci_tt[0]["pista"] if voci_tt else "")),
            "pista": attivo.get("pista") or (voci_tt[0]["pista"] if voci_tt else None),
            "auto": attivo.get("auto") or (voci_tt[0]["auto"] if voci_tt else None),
            "scadenza": data_it(attivo.get("fine") or (ufficiale.get("fine") or "")[:10] or None),
            "miglior_tempo": _ms_a_tempo(leader_ms),
            "leader": leader_psn,
            "partecipanti": partecipanti,
            "classifica": voci_tt,
        }

    # --- Gare settimanali: confronto solo fra piloti che hanno corso lo
    #     STESSO evento (stessa gara, stessa pista, stessa data). Confrontare
    #     tempi di piste diverse non avrebbe senso.
    eventi_gara = {}
    for p in piloti:
        prof = profili.get(p["psn"])
        if not prof:
            continue
        for g in prof["gare"]:
            if not g.get("data_iso"):
                continue
            chiave = (g["gara"] or "Daily", g["pista"], g["data_iso"])
            eventi_gara.setdefault(chiave, []).append({
                "psn": p["psn"],
                "gt7name": (p["gt7name"] or p["psn"]),
                "numero": p["numero"],
                "pista": g["pista"],
                "auto": g["auto"],
                "data": data_it(g["data"]),
                "tempo": g["tempo"],
                "tempo_ms": g["tempo_ms"],
                "pos_assoluta": g["rank_int"],
            })

    gare_settimanali = []
    for (gara, pista, data_iso), voci in eventi_gara.items():
        if len(voci) < 2:          # serve almeno un confronto tra GTV
            continue
        voci.sort(key=lambda v: v["tempo_ms"] or 10 ** 9)
        mig = voci[0]["tempo_ms"]
        for i, v in enumerate(voci, start=1):
            v["pos_gtv"] = i
            v["distacco_gtv_pct"] = (
                round((v["tempo_ms"] - mig) / mig * 100, 3)
                if v["tempo_ms"] and mig else None)
            v["distacco_assoluto_pct"] = None   # leader mondiale non pubblico
        gare_settimanali.append({
            "nome": f"{gara} · {pista}",
            "pista": pista,
            "data": data_it(voci[0]["data"]),
            "data_iso": data_iso,
            "classifica": voci,
        })
    gare_settimanali.sort(key=lambda g: g["data_iso"], reverse=True)
    gare_settimanali = gare_settimanali[:6]

    # --- Statistiche e storico per pilota
    statistiche = []
    storico = []
    for p in piloti:
        prof = profili.get(p["psn"])
        if not prof:
            continue
        eventi, gare = prof["eventi"], prof["gare"]
        rank_tt = [e["rank_int"] for e in eventi if e["rank_int"]]
        rank_gare = [g["rank_int"] for g in gare if g["rank_int"]]
        miglior_rank = min(rank_tt + rank_gare) if (rank_tt or rank_gare) else None
        statistiche.append({
            "psn": p["psn"],
            "gt7name": p["gt7name"] or prof.get("gt7name") or p["psn"],
            "numero": p["numero"],
            "categoria": p["categoria"],
            "dr": prof["dr"],
            "sr": prof["sr"],
            "time_trial": len(eventi),
            "gare": len(gare),
            "miglior_rank": miglior_rank,
            "rank_medio": round(sum(rank_tt + rank_gare) / len(rank_tt + rank_gare))
            if (rank_tt or rank_gare) else None,
            "vittorie": prof["vittorie"],
            "pole": prof["pole"],
            "ultimo_evento": eventi[0]["pista"] if eventi else None,
            "ultima_gara": gare[0]["pista"] if gare else None,
        })
        for e in eventi[:6]:
            storico.append({
                "data": data_it(e["fine"]), "psn": p["psn"],
                "gt7name": p["gt7name"] or p["psn"],
                "evento": f"Time Trial · {e['pista']}",
                "pos": e["rank"], "tempo": e["tempo"], "tipo": "time_trial",
            })
        for g in gare[:6]:
            storico.append({
                "data": data_it(g["data"]), "psn": p["psn"],
                "gt7name": p["gt7name"] or p["psn"],
                "evento": f"{g['gara']} · {g['pista']}",
                "pos": g["rank"], "tempo": g["tempo"], "tipo": "gara",
            })

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
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Raccoglie i dati Sport Mode GT7 dei piloti GTV.")
    ap.add_argument("--limit", type=int, help="limita il numero di piloti (per prove)")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    print("Leggo l'elenco dei piloti GTV dal foglio del team...")
    piloti = carica_piloti_gtv()
    if args.limit:
        piloti = piloti[:args.limit]
    print(f"  {len(piloti)} piloti GTV")

    print("Scarico la classifica del time trial in corso...")
    ufficiale = None
    try:
        ufficiale = time_trial_ufficiale()
        if ufficiale:
            print(f"  API ufficiale: {ufficiale['partecipanti']} iscritti · "
                  f"leader {ufficiale['leader']} "
                  f"{_ms_a_tempo(ufficiale['leader_ms'])}")
    except Exception as e:
        print(f"  ! API ufficiale non disponibile: {e}", file=sys.stderr)

    try:
        esplora = parse_explore_events(fetch(f"{GRIDSTATS}/explore-events"))
        print(f"  evento: {esplora['attivo'].get('pista')} "
              f"(scade {esplora['attivo'].get('fine')}) · top {len(esplora['top'])}")
    except Exception as e:
        print(f"  ! classifica non disponibile: {e}", file=sys.stderr)
        esplora = {"attivo": {}, "top": []}

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

    dati = build(piloti, profili, esplora, ufficiale, args.verbose)
    OUT_JSON.write_text(json.dumps(dati, ensure_ascii=False, indent=2), encoding="utf-8")
    tt = dati["time_trial"]
    print(f"\nOK -> {OUT_JSON}")
    print(f"   time trial: {(tt or {}).get('pista')} · "
          f"{len((tt or {}).get('classifica', []))} piloti GTV in classifica")
    print(f"   gare settimanali: {len(dati['gare_settimanali'])} gruppi · "
          f"storico: {len(dati['storico'])} voci · piloti: {len(dati['piloti'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
