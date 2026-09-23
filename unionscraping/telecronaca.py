#!/usr/bin/env python3
"""Genera il foglietto per la telecronaca di una lobby Union.

Legge data.json, risolve le sigle dei team nei nomi completi e scrive un
HTML stampabile (una pagina) con:

  * testata gara (lobby, categoria, giorno, orario, host, diretta)
  * gara in programma nella settimana corrente (circuito, giri, meteo)
  * opzioni stanza principali (dall'"Impostazioni Evento Corrente" ufficiale)
  * chicche sul circuito, per riempire i tempi morti in diretta
  * ordine di partenza con nome pilota, matricola e team per esteso
  * rubrica per team presenti nella lobby
  * indice alfabetico dei piloti
  * elenco completo dei team del campionato (nome per esteso)

Uso:
    python3 unionscraping/telecronaca.py A15
    python3 unionscraping/telecronaca.py --list
    python3 unionscraping/telecronaca.py A15 --gara 3      # forza la gara
    python3 unionscraping/telecronaca.py A2 --out /tmp/a2.html
"""
from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_JSON = BASE_DIR / "data.json"
# I foglietti generati finiscono in una cartella dedicata, ignorata da git e
# da Vercel: prima finivano nella root del repo, che e' la cartella pubblicata
# dal sito, quindi ogni foglietto diventava una pagina web raggiungibile.
OUT_DIR = BASE_DIR / "telecronaca"
# Ordine delle qualifiche per lobby (griglia di partenza), ricordato tra un giro e l'altro.
QUALI_JSON = BASE_DIR / "quali.json"

# Nomi completi dei team del campionato Union (ordine alfabetico per sigla).
TEAM_FULL = {
    "A51": "Area51 Garage",
    "ARC": "Atlantis Reparto Corse",
    "BCSC": "Bad Cerbero Scuderia Corse",
    "CBR": "Cobra Racing Gt",
    "DCT": "Dcteam Esport",
    "EVO": "Team Evolution Racing",
    "FFM": "FFM Virtual Motorsport",
    "FMC": "Fratta Motorclub",
    "GTID": "Gran Turismo Italian Drivers",
    "GTRC": "Gladiator Team Road Challenge",
    "GTV": "GTV Corse",
    "MF": "MF Corse",
    "MFC": "MF Corse",
    "MMS": "Team Menegotto Motorsport",
    "OES": "Orion Esports",
    "PBC": "Performance Bear Crew",
    "PHX": "Phoenix Racing Team",
    "PRT": "Poison Racing Team",
    "RCE": "Reparto Corse Evoluzione",
    "RMT": "Racing Monster Team",
    "RRT": "Revolution Racing Team",
    "RSR": "Rush S-Racer",
    "SCGT": "Squadra Corse Gt",
    "SMI": "Shoganai Motorsport Italia",
    "SRT": "Stealth Racing Team",
    "TLM": "Team Lion Motorsport",
    "TRT": "Trinacria Racing Team",
}

# ---------------------------------------------------------------------------
# Calendario Round 2 (fonte: pagina "Calendario" del sito HUB UNION)
# Le impostazioni vengono dal PDF ufficiale "Impostazioni Evento Corrente".
# ---------------------------------------------------------------------------
CALENDARIO = [
    {
        "n": 1, "nome": "Gara 1", "pista": "Red Bull Ring", "giri": 36,
        "dal": date(2026, 9, 21), "al": date(2026, 9, 27),
        "bandiera": "images/bandiere/at.svg", "img": "images/tracks/rbr.svg",
        "usura": "x6", "carburante": "x2", "soste": "0", "gomme_obbl": "NO",
        "scheda": [
            ("Lunghezza", "4,326 km"),
            ("Curve", "10 (giro cortissimo)"),
            ("Dislivello", "forte: sale verso T1-T2, scende verso T7"),
            ("Record F1", "1:07.924 — Oscar Piastri, McLaren, 2025"),
            ("Storia", "Österreichring (1969-87) → A1-Ring → Red Bull Ring (2011)"),
        ],
        "chicche": [
            "Giro da 4,3 km con sole 10 curve: i distacchi restano piccolissimi e la scia vale oro sul rettilineo del traguardo, che è in salita.",
            "Curve con nome: T1 Niki Lauda, T3 Schlossgold, T4 Rauch, T5 Pirelli, T6 A1, T7 Jochen Rindt, T9 Dr. Helmut Marko.",
            "I due punti di sorpasso classici: la staccata della T1 (in salita, si frena forte ma l'uscita è insidiosa) e la T3 Schlossgold, la staccata più violenta del tracciato.",
            "La T4 Rauch si fa quasi in pieno: è lì che in qualifica si guadagna o si perde il giro.",
            "Alla T9 Dr. Helmut Marko si può usare tanto cordolo, ma è la zona dove si prendono i track limits — e qui la penalità taglio è SEVERA.",
            "Con x6 di usura e nessuna sosta obbligatoria, la gara si decide sulla gestione gomme: almeno una sosta è quasi certa, chi allunga guadagna posizioni in pista.",
            "Qualifiche da 3 minuti: circa due giri lanciati. Sbagliare il primo significa partire con un giro solo a disposizione.",
            "Assist: controsterzo e controllo stabilità proibiti, ABS e controllo trazione liberi. BOP attivo e unico settaggio toccabile: il bilanciamento dei freni.",
        ],
    },
    {
        "n": 2, "nome": "Gara 2", "pista": "Watkins Glen", "giri": 11,
        "dal": date(2026, 10, 5), "al": date(2026, 10, 11),
        "bandiera": "images/bandiere/us.svg", "img": "images/tracks/watkins.svg",
        "usura": "x3", "carburante": "x2", "soste": "0", "gomme_obbl": "SÌ",
        "scheda": [
            ("Layout", "Long Course (versione lunga)"),
            ("Curve", "11"),
            ("Tipo", "pista veloce e scorrevole, molto \"flow\""),
        ],
        "chicche": [
            "Undici giri sono una sprint: la partenza e la prima staccata pesano tantissimo, non c'è tempo per rimontare con calma.",
            "Cambio gomme obbligatorio ma nessuna sosta minima imposta: chi si ferma presto può sfruttare il via libera, chi allunga rischia di perdere la finestra.",
            "Le curve veloci in sequenza premiano chi ha il passo costante più che chi fa il singolo giro veloce.",
        ],
    },
    {
        "n": 3, "nome": "Gara 3", "pista": "Suzuka Circuit", "giri": 27,
        "dal": date(2026, 10, 19), "al": date(2026, 10, 25),
        "bandiera": "images/bandiere/jp.svg", "img": "images/tracks/suzuka.png",
        "usura": "x5", "carburante": "x2", "soste": "0", "gomme_obbl": "NO",
        "scheda": [
            ("Curve", "18, con il layout a \"8\""),
            ("Tipo", "tecnica: esse, curve veloci e il degrado di curva 1"),
        ],
        "chicche": [
            "Il layout a 8 è il marchio di Suzuka: si passa sopra e sotto se stessi, e la esse iniziale non perdona errori di traiettoria.",
            "La 130R e la chicane finale (Casio Triangle) sono i due punti dove si vince o si butta via il giro.",
            "Con x5 di usura le gomme anteriori sinistre soffrono: la gestione nei primi giri decide la seconda metà di gara.",
        ],
    },
    {
        "n": 4, "nome": "Gara 4", "pista": "Autopolis", "giri": 20,
        "dal": date(2026, 11, 2), "al": date(2026, 11, 8),
        "bandiera": "images/bandiere/jp.svg", "img": "images/tracks/autopolis.png",
        "usura": "x3", "carburante": "x2", "soste": "0", "gomme_obbl": "—",
        "scheda": [
            ("Curve", "18, su e giù per la montagna"),
            ("Tipo", "pista di montagna, dislivelli marcati"),
        ],
        "chicche": [
            "Autopolis è nel bel mezzo del nulla, in cima a una montagna: pista stretta, poco margine e tanti saliscendi.",
            "Il primo settore in discesa è il più insidioso: si arriva lunghi con facilità e le vie di fuga non perdonano.",
            "Con l'usura a x3 la strategia è più libera: si può provare a girare su un treno solo.",
        ],
    },
    {
        "n": 5, "nome": "Gara 5", "pista": "Nürburgring GP", "giri": 27,
        "dal": date(2026, 11, 16), "al": date(2026, 11, 22),
        "bandiera": "images/bandiere/de.svg", "img": "images/tracks/nurburgring.svg",
        "usura": "x5", "carburante": "x2", "soste": "0", "gomme_obbl": "NO",
        "scheda": [
            ("Layout", "GP-Strecke (non la Nordschleife)"),
            ("Curve", "15"),
            ("Tipo", "misto tecnico con la NGK-Schikane"),
        ],
        "chicche": [
            "È la GP-Strecke, non la Nordschleife: 27 giri su un tracciato corto, con traffico e doppiaggi sempre in agguato.",
            "La chicane NGK e la curva del castello (Castrol-S) sono i punti dove si perde l'anteriore.",
            "Con x5 di usura e tanti curvoni a sinistra, il lato destro delle gomme è quello che detta il ritmo.",
        ],
    },
    {
        "n": 6, "nome": "Finale", "pista": "Barcelona GP (no chicane)", "giri": 22,
        "dal": date(2026, 11, 30), "al": date(2026, 12, 6),
        "bandiera": "images/bandiere/es.svg", "img": "images/tracks/barcelona.svg",
        "usura": "x4", "carburante": "x2", "soste": "0", "gomme_obbl": "SÌ",
        "scheda": [
            ("Layout", "GP Layout senza chicane (curva 14-15 in pieno)"),
            ("Curve", "14"),
            ("Tipo", "trazione e gomme anteriori sotto stress"),
        ],
        "chicche": [
            "Il layout \"no chicane\" è quello storico: l'ultimo settore si fa molto più veloce e la curva 9 (Campsa) si prende in pieno.",
            "È la finale del round: cambio gomme obbligatorio, quindi la sosta non è una scelta ma un appuntamento da gestire bene.",
            "Barcellona è la pista dei test per eccellenza: chi la conosce a memoria ha un vantaggio sui long run.",
        ],
    },
]

# Impostazioni stanza identiche su tutte le gare del round.
STANZA_COMUNI = [
    ("Tipo di gara", "Combattuta · max 16 piloti · partenza automatica no"),
    ("Partenza", "Lanciata · griglia: pole al pilota più veloce"),
    ("BOP", "Sì · opzioni impostazioni: alcuni (bilanciamento freni)"),
    ("Turbo", "Disattivato · intensità scia: realistica"),
    ("Danni", "Visibili: sì · meccanici: realistici"),
    ("Rifornimento", "5 L/sec · carburante iniziale 100 L (predefinito)"),
    ("Aderenza fuori pista", "Realistica · tempo per completare la gara: 180"),
    ("Nitro / molt. sorpasso", "Predefinito"),
    ("Qualifiche", "3 minuti · tempo di qualif. per continuare 180 sec · usura gomme come in gara · consumo carburante: no"),
    ("Regolamento", "Categoria Gr.2 · nessun limite PP, potenza e peso · gomme: corsa · nitro proibito · kart no · cambio: tutto · elaborazione: estreme e inferiori · aero e aspirazione: nessun limite"),
    ("Penalità", "Taglio: severa · taglio corsa box: sì · regole bandiere: sì · collisioni, muretto e doppia collisione: no · trasparenza durante la gara: no"),
    ("Aiuti di guida", "Controsterzo proibito · controllo stabilità proibito · pilota automatico proibito · ABS, controllo trazione e traiettoria assistita: nessun limite"),
]


def gara_corrente(oggi: date | None = None) -> dict | None:
    oggi = oggi or date.today()
    for g in CALENDARIO:
        if g["dal"] <= oggi <= g["al"]:
            return g
    return None


def gara_per_numero(n: int) -> dict | None:
    for g in CALENDARIO:
        if g["n"] == n:
            return g
    return None


HTML = """<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Telecronaca {lobby} - {category}</title>
<style>
  :root {{
    --bg: #14161a;
    --card: #1c1f26;
    --line: #2c313b;
    --txt: #eef1f6;
    --dim: #98a2b3;
    --accent: #ffd166;
    --accent2: #6ec1ff;
    --accent3: #7ee0a8;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    padding: 18px 20px 40px;
    background: var(--bg);
    color: var(--txt);
    font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.35;
  }}
  h1 {{ font-size: 22px; margin: 0 0 2px; letter-spacing: .4px; }}
  h2 {{
    font-size: 12px; text-transform: uppercase; letter-spacing: 1.4px;
    color: var(--dim); margin: 22px 0 8px; font-weight: 600;
  }}
  h3 {{ font-size: 13px; margin: 0 0 4px; }}
  .head {{
    border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px;
    background: var(--card);
  }}
  .head .lobby {{ color: var(--accent); }}
  .facts {{ display: flex; flex-wrap: wrap; gap: 4px 26px; margin-top: 10px; }}
  .facts div {{ font-size: 13px; }}
  .facts b {{ color: var(--dim); font-weight: 500; }}
  a {{ color: var(--accent2); text-decoration: none; }}
  .race {{
    display: flex; gap: 18px; align-items: center; flex-wrap: wrap;
    border: 1px solid #3a4150; border-radius: 10px; padding: 12px 16px;
    background: linear-gradient(180deg, #20242c, #1a1d24);
    margin-top: 8px;
  }}
  .race .big {{ font-size: 20px; font-weight: 700; letter-spacing: .5px; }}
  .race .big span {{ color: var(--accent); }}
  .race .sub {{ color: var(--dim); font-size: 12.5px; margin-top: 2px; }}
  .race img.track {{ width: 150px; height: 46px; object-fit: contain; opacity: .95; }}
  .race img.flag {{ height: 15px; margin-right: 6px; vertical-align: -2px; }}
  .race .when {{
    margin-left: auto; text-align: right; font-size: 12.5px; color: var(--dim);
  }}
  table {{ width: 100%; border-collapse: collapse; }}
  td, th {{
    border-bottom: 1px solid var(--line); padding: 6px 8px;
    text-align: left; vertical-align: middle;
  }}
  th {{
    font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
    color: var(--dim); font-weight: 600; border-bottom-color: #3a4150;
  }}
  .pos {{ width: 38px; color: var(--dim); font-variant-numeric: tabular-nums; }}
  .drv {{ font-weight: 600; font-size: 15.5px; }}
  .team {{ color: var(--dim); font-size: 13px; }}
  .team b {{ color: var(--txt); font-weight: 600; }}
  .mat {{ width: 58px; text-align: right; color: var(--dim); font-variant-numeric: tabular-nums; }}
  .cols {{ display: flex; gap: 26px; align-items: flex-start; flex-wrap: wrap; }}
  .cols > div {{ flex: 1 1 320px; min-width: 300px; }}
  ul {{ margin: 0; padding-left: 0; list-style: none; }}
  li {{ padding: 3px 0; border-bottom: 1px solid var(--line); }}
  li.plain {{ border-bottom: none; padding: 2px 0 2px 14px; position: relative; }}
  li.plain:before {{ content: "▸"; position: absolute; left: 0; color: var(--accent3); }}
  .tag {{
    display: inline-block; min-width: 44px; color: var(--accent);
    font-weight: 700; font-size: 12.5px; letter-spacing: .5px;
  }}
  .n {{ color: var(--dim); font-size: 12px; }}
  .setup {{ display: flex; gap: 26px; flex-wrap: wrap; }}
  .setup > div {{ flex: 1 1 330px; min-width: 300px; }}
  .setup .row {{ display: flex; gap: 10px; padding: 4px 0; border-bottom: 1px solid var(--line); }}
  .setup .row b {{ flex: 0 0 138px; color: var(--dim); font-weight: 500; font-size: 12.5px; }}
  .setup .row span {{ flex: 1; font-size: 12.5px; }}
  .scheda {{ display: flex; flex-wrap: wrap; gap: 4px 22px; }}
  .scheda div {{ font-size: 12.5px; }}
  .scheda b {{ color: var(--dim); font-weight: 500; }}
  footer {{ margin-top: 26px; color: var(--dim); font-size: 11.5px; }}
  @media print {{
    :root {{ --bg: #fff; --card: #fff; --line: #ccc; --txt: #111; --dim: #555; --accent: #92400e; --accent2: #1d4ed8; --accent3: #166534; }}
    body {{ font-size: 10.5px; padding: 0; }}
    @page {{ size: A4; margin: 10mm; }}
    h2 {{ margin: 12px 0 5px; }}
    .race {{ background: none; }}
  }}
</style>
</head>
<body>
  <div class="head">
    <h1>Telecronaca <span class="lobby">{lobby}</span> &middot; {category}</h1>
    <div class="n">{title} &middot; {day} {time}</div>
    <div class="facts">
      <div><b>Host</b> {host}</div>
      <div><b>Live</b> {live}</div>
      <div><b>Link</b> <a href="{url}">{url}</a></div>
      <div><b>Piloti</b> {npiloti}</div>
    </div>
  </div>

  <h2>Gara in programma</h2>
{gara}

  <h2>Chicche sul circuito</h2>
  <ul>
{chicche}
  </ul>

  <h2>Opzioni stanza (le principali)</h2>
  <div class="setup">
{stanza}
  </div>

  <h2>{titolo_tabella}</h2>
{nota_griglia}
{tabella}

  <div class="cols">
    <div>
      <h2>Team in lobby</h2>
      <ul>
{per_team}
      </ul>
    </div>
    <div>
      <h2>Indice alfabetico piloti</h2>
      <ul>
{alfa}
      </ul>
    </div>
  </div>

  <h2>Sigle &rarr; nomi completi (campionato)</h2>
  <div class="cols">
{team_list}
  </div>

  <footer>Foglietto generato da unionscraping/telecronaca.py &middot; piloti da data.json ({aggiornato}) &middot; impostazioni dal PDF ufficiale "Impostazioni Evento Corrente" &middot; calendario dal sito HUB UNION</footer>
</body>
</html>
"""


def carica_lobby(nome: str) -> dict:
    dati = json.loads(DATA_JSON.read_text(encoding="utf-8"))
    lobbies = dati.get("lobbies") or []
    for lob in lobbies:
        if str(lob.get("name", "")).strip().upper() == nome.strip().upper():
            lob = dict(lob)
            lob["_title"] = (dati.get("meta") or {}).get("title", "")
            return lob
    disponibili = ", ".join(str(l.get("name")) for l in lobbies)
    raise SystemExit(f"Lobby '{nome}' non trovata. Disponibili: {disponibili}")


def nome_team(sigla: str) -> str:
    s = (sigla or "").strip().upper()
    if not s:
        return "senza team"
    return TEAM_FULL.get(s, s)


# ---------------------------------------------------------------------------
# Griglia di partenza dalle qualifiche
# ---------------------------------------------------------------------------
def normalizza(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _pilota_esatto(cand: str, piloti: list, usati: set) -> int | None:
    """Indice del primo pilota il cui nome combacia (in un verso o nell'altro)."""
    if not cand:
        return None
    for idx, p in enumerate(piloti):
        if idx in usati:
            continue
        n = normalizza(p.get("nome") or "")
        if cand in n or (n and n in cand):
            return idx
    return None


def _pilota_simile(cand: str, piloti: list, usati: set) -> int | None:
    """Ripiego per i refusi: il nome libero più somigliante al token."""
    if not cand:
        return None
    liberi = {idx: normalizza(p.get("nome") or "") for idx, p in enumerate(piloti) if idx not in usati}
    vicini = difflib.get_close_matches(cand, list(liberi.values()), n=1, cutoff=0.72)
    if not vicini:
        return None
    for idx, n in liberi.items():
        if n == vicini[0]:
            return idx
    return None


def griglia_da_quali(testo: str, piloti: list) -> tuple[list, list]:
    """Trasforma "nello, alerasato, basilio" nella griglia ordinata.

    Ritorna (griglia, non_riconosciuti): griglia è una lista di piloti nell'ordine
    indicato; i piloti della lobby non citati finiscono in coda, marcati _senza_quali.
    """
    tokens = [t for t in re.split(r"[,\n;]+|\s{2,}", testo or "") if t.strip()]
    if len(tokens) <= 1:  # nessuna virgola: divido sulle singole parole
        tokens = [t for t in re.split(r"\s+", (testo or "").strip()) if t]
    tokens = [t.strip("-–—") for t in tokens if t.strip("-–—")]

    usati: set[int] = set()
    griglia: list = []
    ignorati: list[str] = []
    i = 0
    while i < len(tokens):
        idx = None
        quanti = 1
        # 1) due token uniti, solo se combaciano esattamente ("the" + "hammer")
        if i + 1 < len(tokens):
            idx = _pilota_esatto(normalizza(tokens[i] + tokens[i + 1]), piloti, usati)
            if idx is not None:
                quanti = 2
        # 2) token singolo, combaciamento esatto
        if idx is None:
            idx = _pilota_esatto(normalizza(tokens[i]), piloti, usati)
        # 3) token singolo, somiglianza (refusi)
        if idx is None:
            idx = _pilota_simile(normalizza(tokens[i]), piloti, usati)
        if idx is None:
            ignorati.append(tokens[i])
            i += 1
            continue
        usati.add(idx)
        griglia.append(piloti[idx])
        i += quanti

    for idx, p in enumerate(piloti):
        if idx not in usati:
            griglia.append({**p, "_senza_quali": True})
    return griglia, ignorati


def carica_quali(lobby: str) -> str:
    try:
        dati = json.loads(QUALI_JSON.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return ""
    return str(dati.get(lobby.strip().upper(), ""))


def salva_quali(lobby: str, testo: str) -> None:
    try:
        dati = json.loads(QUALI_JSON.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        dati = {}
    dati[lobby.strip().upper()] = testo.strip()
    QUALI_JSON.write_text(json.dumps(dati, ensure_ascii=False, indent=1), encoding="utf-8")


def blocco_gara(g: dict | None) -> str:
    if not g:
        righe = []
        for r in CALENDARIO:
            righe.append(
                f'      <div><b>{r["nome"]}</b> {r["pista"]} &middot; {r["giri"]} giri '
                f'<span class="n">({r["dal"].strftime("%d/%m")} - {r["al"].strftime("%d/%m")})</span></div>'
            )
        return ('      <div class="race"><div>Nessuna gara in corso in questa settimana: '
                'ecco il calendario del Round 2.</div></div>\n'
                '      <div class="scheda" style="margin-top:8px">\n' + "\n".join(righe) + "\n      </div>")

    finestra = f'{g["dal"].strftime("%d %b")} – {g["al"].strftime("%d %b %Y")}'
    scheda = " &middot; ".join(f'<b>{k}</b> {v}' for k, v in g["scheda"])
    corrente = gara_corrente() == g
    when = finestra + (' · settimana corrente' if corrente else '')
    return f"""      <div class="race">
        <div>
          <div class="big"><img class="flag" src="{g['bandiera']}" alt="" onerror="this.style.display='none'">{g['nome']} &middot; <span>{g['pista']}</span></div>
          <div class="sub">{g['giri']} giri &middot; usura gomme {g['usura']} &middot; carburante {g['carburante']} &middot; soste minime {g['soste']} &middot; cambio gomme obbligato {g['gomme_obbl']}</div>
          <div class="scheda" style="margin-top:6px">{scheda}</div>
        </div>
        <img class="track" src="{g['img']}" alt="{g['pista']}" onerror="this.style.display='none'">
        <div class="when">📅 {when}</div>
      </div>"""


def render(lob: dict, gara: dict | None, testo_quali: str = "") -> str:
    piloti = list(lob.get("pilots") or [])
    piloti.sort(key=lambda p: (p.get("pos") or 999, str(p.get("nome") or "")))

    griglia = None
    ignorati: list[str] = []
    if (testo_quali or "").strip():
        griglia, ignorati = griglia_da_quali(testo_quali, piloti)

    if griglia:
        righe = []
        for i, p in enumerate(griglia, start=1):
            sigla = (p.get("team") or "").strip().upper()
            pieno = nome_team(sigla)
            team_html = f'<span class="team"><b>{sigla}</b> &middot; {pieno}</span>' if sigla else f'<span class="team">{pieno}</span>'
            cella = f'<td class="pos"><b>{i}</b></td>' if not p.get("_senza_quali") else '<td class="pos n">n.d.</td>'
            righe.append(
                '      <tr>'
                f'{cella}'
                f'<td class="drv">{p.get("nome") or ""}</td>'
                f'<td>{team_html}</td>'
                f'<td class="mat">{p.get("matricola") or ""}</td>'
                f'<td class="mat">{p.get("pos") or ""}</td>'
                "</tr>"
            )
        mancanti = [str(p.get("nome")) for p in griglia if p.get("_senza_quali")]
        nota = []
        if mancanti:
            nota.append("Senza tempo in qualifica (in coda, ordine da confermare): " + ", ".join(mancanti) + ".")
        if ignorati:
            nota.append("Voci non riconosciute: " + ", ".join(ignorati) + ".")
        nota_griglia = (
            '  <div class="n" style="margin:-2px 0 8px">Griglia dalle qualifiche — con la partenza lanciata '
            'la pole va al pilota più veloce. Ultima colonna: numero di iscrizione in lobby.</div>'
        )
        if nota:
            nota_griglia += '  <div class="n" style="margin:-4px 0 8px">' + " ".join(nota) + "</div>\n"
        titolo_tabella = "Griglia di partenza"
        intestazione = (
            '      <tr><th class="pos">Griglia</th><th>Pilota</th><th>Team</th>'
            '<th class="mat">Matr.</th><th class="mat">Iscr.</th></tr>'
        )
    else:
        righe = []
        for p in piloti:
            sigla = (p.get("team") or "").strip().upper()
            pieno = nome_team(sigla)
            team_html = f'<span class="team"><b>{sigla}</b> &middot; {pieno}</span>' if sigla else f'<span class="team">{pieno}</span>'
            righe.append(
                '      <tr>'
                f'<td class="pos">{p.get("pos") or ""}</td>'
                f'<td class="drv">{p.get("nome") or ""}</td>'
                f'<td>{team_html}</td>'
                f'<td class="mat">{p.get("matricola") or ""}</td>'
                "</tr>"
            )
        nota_griglia = ('  <div class="n" style="margin:-2px 0 8px">Ancora nessuna qualifica registrata: '
                        'qui c\'è l\'ordine di iscrizione. Passa la griglia con <code>--quali "nome1, nome2, ..."</code>.</div>\n')
        titolo_tabella = "Ordine di partenza (iscrizioni)"
        intestazione = (
            '      <tr><th class="pos">#</th><th>Pilota</th><th>Team</th><th class="mat">Matr.</th></tr>'
        )

    tabella = (
        "  <table>\n    <thead>\n" + intestazione + "\n    </thead>\n    <tbody>\n"
        + "\n".join(righe) + "\n    </tbody>\n  </table>"
    )

    gruppi: dict[str, list[str]] = {}
    for p in piloti:
        gruppi.setdefault((p.get("team") or "").strip().upper() or "-", []).append(str(p.get("nome") or ""))
    per_team = []
    for sigla in sorted(gruppi):
        nomi = ", ".join(sorted(gruppi[sigla]))
        pieno = nome_team(sigla)
        extra = f' <span class="n">{pieno}</span>' if pieno != sigla else ""
        per_team.append(
            f'        <li><span class="tag">{sigla}</span> {nomi}{extra} '
            f'<span class="n">({len(gruppi[sigla])})</span></li>'
        )

    alfa = []
    for p in sorted(piloti, key=lambda p: str(p.get("nome") or "").lower()):
        alfa.append(
            f'        <li><span class="tag">{(p.get("team") or "").strip().upper()}</span> '
            f'{p.get("nome") or ""} <span class="n">n. {p.get("pos") or ""}</span></li>'
        )

    voci = [(k, v) for k, v in sorted(TEAM_FULL.items())]
    meta = (len(voci) + 1) // 2
    team_list = []
    for col in (voci[:meta], voci[meta:]):
        items = "\n".join(f'        <li><span class="tag">{k}</span> {v}</li>' for k, v in col)
        team_list.append(f'      <div>\n      <ul>\n{items}\n      </ul>\n      </div>')

    if gara:
        per_gara = [
            ("Tracciato", f'{gara["pista"]} · {gara["giri"]} giri · tempo limite 180'),
            ("Vel. usura gomme", gara["usura"]),
            ("Consumo carburante", gara["carburante"]),
            ("Numero minimo soste ai box", gara["soste"]),
            ("Cambio tipo di gomma obbligato", gara["gomme_obbl"]),
            ("Meteo", "Personalizzato, nessuna pioggia · fase: pomeriggio · velocità avanzamento tempo x3 · pari condizioni: no"),
        ]
        stanza_rows = per_gara + STANZA_COMUNI
        chicche = "\n".join(f'        <li class="plain">{c}</li>' for c in gara["chicche"])
    else:
        stanza_rows = STANZA_COMUNI
        chicche = '        <li class="plain">Nessuna gara in corso: le chicche compaiono nella settimana di gara.</li>'

    blocco_stanza = []
    for k, v in stanza_rows:
        blocco_stanza.append(
            f'      <div class="row"><b>{k}</b><span>{v}</span></div>'
        )

    try:
        aggiornato = datetime.fromtimestamp(DATA_JSON.stat().st_mtime).strftime("%d/%m/%Y %H:%M")
    except OSError:
        aggiornato = "n/d"

    return HTML.format(
        lobby=lob.get("name", ""),
        category=lob.get("category", ""),
        title=lob.get("_title", ""),
        day=lob.get("day", ""),
        time=lob.get("time", ""),
        host=lob.get("host", ""),
        live=lob.get("live", ""),
        url=lob.get("url", ""),
        npiloti=len(piloti),
        gara=blocco_gara(gara),
        chicche=chicche,
        stanza="\n".join(blocco_stanza),
        titolo_tabella=titolo_tabella,
        nota_griglia=nota_griglia,
        tabella=tabella,
        per_team="\n".join(per_team),
        alfa="\n".join(alfa),
        team_list="\n".join(team_list),
        aggiornato=aggiornato,
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Foglietto telecronaca lobby Union")
    ap.add_argument("lobby", nargs="?", help="codice lobby, es. A15")
    ap.add_argument("--list", action="store_true", help="elenca le lobby disponibili")
    ap.add_argument("--gara", type=int, help="forza il numero di gara (1-6) invece di rilevarlo dalla data")
    ap.add_argument("--quali", help='ordine delle qualifiche, es. --quali "nello, alerasato, basilio, gas89" (viene ricordato)')
    ap.add_argument("--no-quali", action="store_true", help="ignora la griglia ricordata e mostra l'ordine di iscrizione")
    ap.add_argument("--out", help="file di uscita (default: unionscraping/telecronaca/telecronaca-<lobby>.html)")
    args = ap.parse_args()

    if args.quali and args.lobby:
        salva_quali(args.lobby, args.quali)

    if args.list or not args.lobby:
        dati = json.loads(DATA_JSON.read_text(encoding="utf-8"))
        for lob in dati.get("lobbies") or []:
            print(f'{lob.get("name"):<4} {lob.get("day",""):<10} {lob.get("time",""):<11} '
                  f'{lob.get("category",""):<11} host={lob.get("host","")}')
        return 0

    if args.gara:
        gara = gara_per_numero(args.gara)
        if not gara:
            raise SystemExit("Numero di gara non valido: usa 1-6")
    else:
        gara = gara_corrente()

    lob = carica_lobby(args.lobby)
    testo_quali = ""
    if not args.no_quali:
        testo_quali = args.quali or carica_quali(lob.get("name", ""))
    html = render(lob, gara, testo_quali)
    if args.out:
        out = Path(args.out)
    else:
        OUT_DIR.mkdir(exist_ok=True)
        out = OUT_DIR / f'telecronaca-{lob.get("name","lobby").lower()}.html'
    out.write_text(html, encoding="utf-8")
    extra = f' · {gara["nome"]}: {gara["pista"]}' if gara else " · nessuna gara in corso"
    griglia = " · griglia dalle qualifiche" if (testo_quali or "").strip() else ""
    print(f"scritto {out} ({len(lob.get('pilots') or [])} piloti{extra}{griglia})")
    if (testo_quali or "").strip():
        ordinati, ignorati = griglia_da_quali(testo_quali, list(lob.get("pilots") or []))
        for i, p in enumerate(ordinati, start=1):
            coda = "   <- senza tempo in qualifica" if p.get("_senza_quali") else ""
            print(f'  {i:>2}. {p.get("nome","")} ({p.get("team","")}){coda}')
        if ignorati:
            print("  voci non riconosciute:", ", ".join(ignorati))
    return 0


if __name__ == "__main__":
    sys.exit(main())
