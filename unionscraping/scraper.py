#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HUB UNION scraper
=================
Scarica i dati del sito https://sites.google.com/view/hubunion/home
(Campionato Union 2026 - Round 2) dai fogli Google pubblicati e genera:
  - data.json   : dataset strutturato (lobby + piloti)
  - index.html  : dashboard HTML standalone con i dati incorporati

Nessuna dipendenza esterna: usa solo la libreria standard.
"""

import csv
import io
import json
import re
import sys
import urllib.request
from collections import Counter, OrderedDict

# ---------------------------------------------------------------------------
# Configurazione: fogli pubblicati estratti dalle pagine Google Sites
# ---------------------------------------------------------------------------
SITE = "https://sites.google.com/view/hubunion"

# Foglio delle lobby: un solo spreadsheet con un tab per giorno (gid)
LOBBY_SHEET = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vQqsXv8SpRV0MjEZoAs7FS_D-6x8-vi4Qh3NaZMI8Wv6_7l5omK-XcOTl6yyQfejJjoiZPaVv0alX-K"
    "/pub?output=csv&gid={gid}"
)
LOBBY_GIDS = OrderedDict([
    ("LUNEDI",     0),
    ("MARTEDI",    731349085),
    ("MERCOLEDI",  850936328),
    ("GIOVEDI",    761215394),
    ("VENERDI",    2004422143),
])

# Foglio piloti (lista team, piloti, leghe)
PILOTI_SHEET = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vQXVz_C3lMo6Wa2VfHtNKRPhcKIsffNhLxh4d-KZjlDcZvAAulGxzspdKaeaADxBSNQGmkFrufWZmk2"
    "/pub?output=csv&gid=1560276304"
)

TIME_RE = re.compile(r"^Ore\s+(\d{1,2}:\d{2})$", re.IGNORECASE)
POS_RE = re.compile(r"^\d+$")


# ---------------------------------------------------------------------------
# Download helper
# ---------------------------------------------------------------------------
def fetch_csv(url: str) -> list:
    """Scarica un CSV pubblicato e lo converte in lista di righe."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode("utf-8-sig")
    return list(csv.reader(io.StringIO(raw)))


# ---------------------------------------------------------------------------
# Parsing delle lobby
# ---------------------------------------------------------------------------
def find_blocks(rows: list) -> list:
    """
    Individua tutti i blocchi-lobby nel foglio.
    Ogni blocco inizia con una cella 'Ore HH:MM' seguita (colonna+1) dal nome
    lobby (es. A1) e (colonna+4) dalla categoria. Restituisce:
    [(row_index, col_index, time, name, category), ...]
    """
    blocks = []
    for ri, row in enumerate(rows):
        for ci, cell in enumerate(row):
            m = TIME_RE.match(cell.strip())
            if not m:
                continue
            name = row[ci + 1].strip() if ci + 1 < len(row) else ""
            cat = row[ci + 4].strip() if ci + 4 < len(row) else ""
            # ignora celle di titolo (es. 'Ore 21:00' usate come intestazioni)
            if name and re.match(r"^[A-Z]\d+$", name):
                blocks.append((ri, ci, m.group(1), name, cat))
    return blocks


def parse_block(rows: list, start_row: int, col: int, day: str) -> dict:
    """
    Estrae host, canale live e piloti di un blocco-lobby a partire dalla riga
    di intestazione (start_row) e dalla colonna (col) del blocco.
    """
    lobby = {
        "day": day,
        "time": None,
        "name": None,
        "category": None,
        "host": "",
        "live": "",
        "url": "",
        "pilots": [],
    }

    def cell(r, off):
        i = col + off
        return r[i].strip() if i < len(r) else ""

    # intestazione
    lobby["time"] = cell(rows[start_row], 0)
    lobby["name"] = cell(rows[start_row], 1)
    lobby["category"] = cell(rows[start_row], 4)

    for r in rows[start_row + 1:]:
        t0 = cell(r, 0)
        t1 = cell(r, 1)
        t4 = cell(r, 4)

        if TIME_RE.match(t0):
            break  # inizio di un altro blocco

        if t1 == "HOST":
            lobby["host"] = t4
        elif t1 == "LIVE":
            lobby["live"] = t4
        elif t4.startswith("http"):
            lobby["url"] = t4
        elif t1 == "Team":
            continue  # riga intestazione colonne
        elif POS_RE.match(t1):
            lobby["pilots"].append({
                "pos": int(t1),
                "matricola": cell(r, 2),
                "team": t4,
                "nome": cell(r, 5),
                "auto": cell(r, 6),
            })
        # righe vuote / righe duplicate -> ignorate

    # pulizia: rimuovi eventuali piloti senza nome (righe di riempimento)
    lobby["pilots"] = [p for p in lobby["pilots"] if p["nome"]]
    return lobby


def parse_lobbies() -> list:
    lobbies = []
    for day, gid in LOBBY_GIDS.items():
        rows = fetch_csv(LOBBY_SHEET.format(gid=gid))
        blocks = find_blocks(rows)
        for (ri, ci, time, name, cat) in blocks:
            lb = parse_block(rows, ri, ci, day)
            lobbies.append(lb)
    # ordina per giorno e nome lobby
    day_order = {d: i for i, d in enumerate(LOBBY_GIDS)}
    lobbies.sort(key=lambda lb: (day_order.get(lb["day"], 99), lb["name"]))
    return lobbies


# ---------------------------------------------------------------------------
# Parsing dei piloti (foglio PILOTI)
# ---------------------------------------------------------------------------
def parse_piloti() -> list:
    rows = fetch_csv(PILOTI_SHEET)
    pilots = []
    for r in rows:
        if len(r) >= 7 and POS_RE.match(r[2].strip()):
            pilots.append({
                "prog": int(r[2].strip()),
                "team": r[3].strip(),
                "nome": r[4].strip(),
                "categoria": r[5].strip(),
                "lobby_group": r[6].strip(),
            })
    return pilots


# ---------------------------------------------------------------------------
# Statistiche
# ---------------------------------------------------------------------------
def build_stats(lobbies, pilots):
    teams = Counter(p["team"] for p in pilots)
    cats = Counter(p["categoria"] for p in pilots)
    groups = Counter(p["lobby_group"] for p in pilots)
    return {
        "total_pilots": len(pilots),
        "total_lobbies": len(lobbies),
        "total_teams": len(teams),
        "categories": dict(cats),
        "lobby_groups": dict(groups),
        "pilots_per_day": dict(Counter(lb["day"] for lb in lobbies)),
    }
# ---------------------------------------------------------------------------
# Generazione HTML
# ---------------------------------------------------------------------------
def build_html(data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return HTML_TEMPLATE.replace("__DATA__", payload)


HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HUB UNION — Lobby &amp; Piloti</title>
<style>
  :root{
    --bg:#0b0e14; --panel:#141926; --panel2:#1b2233; --line:#26304a;
    --txt:#e8ecf4; --muted:#8b95ad; --accent:#ff3d3d; --accent2:#ffb800;
    --green:#2ecc71; --blue:#4da3ff;
  }
  *{box-sizing:border-box; margin:0; padding:0;}
  body{background:var(--bg); color:var(--txt);
    font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height:1.45;}
  header{background:linear-gradient(135deg,#1a0f0f 0%,#141926 60%,#0e1424 100%);
    border-bottom:3px solid var(--accent); padding:28px 20px 22px; text-align:center;}
  header h1{font-size:2rem; letter-spacing:2px; text-transform:uppercase;}
  header h1 span{color:var(--accent);}
  header p{color:var(--muted); margin-top:6px; font-size:.95rem;}
  .stats{display:flex; flex-wrap:wrap; gap:14px; justify-content:center;
    margin:22px auto; max-width:1100px; padding:0 14px;}
  .stat{background:var(--panel); border:1px solid var(--line); border-radius:12px;
    padding:14px 26px; text-align:center; min-width:150px;}
  .stat b{display:block; font-size:1.7rem; color:var(--accent2);}
  .stat span{color:var(--muted); font-size:.8rem; text-transform:uppercase; letter-spacing:1px;}
  nav{display:flex; gap:10px; justify-content:center; margin:18px 0 8px; flex-wrap:wrap;}
  nav button{background:var(--panel); color:var(--txt); border:1px solid var(--line);
    border-radius:999px; padding:10px 22px; font-size:.95rem; cursor:pointer;
    transition:.15s;}
  nav button:hover{border-color:var(--accent);}
  nav button.active{background:var(--accent); border-color:var(--accent); color:#fff;}
  main{max-width:1200px; margin:0 auto; padding:10px 16px 60px;}
  .section{display:none;}
  .section.active{display:block;}

  /* ---------- Lobby ---------- */
  .day-block{margin:26px 0;}
  .day-title{font-size:1.4rem; text-transform:uppercase; letter-spacing:2px;
    color:var(--accent2); border-left:5px solid var(--accent); padding-left:12px; margin-bottom:14px;}
  .lobby-grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(540px,1fr)); gap:16px;}
  .lobby{background:var(--panel); border:1px solid var(--line); border-radius:14px; overflow:hidden;}
  .lobby-head{display:flex; align-items:center; gap:12px; padding:12px 16px;
    background:var(--panel2); border-bottom:1px solid var(--line);}
  .lobby-name{font-size:1.15rem; font-weight:700; color:#fff;}
  .badge{background:var(--accent); color:#fff; border-radius:6px; padding:2px 8px;
    font-size:.75rem; font-weight:700; letter-spacing:1px;}
  .badge.cat{background:var(--blue);}
  .lobby-meta{margin-left:auto; text-align:right; color:var(--muted); font-size:.8rem;}
  .lobby-meta a{color:var(--green); text-decoration:none;}
  .lobby-meta a:hover{text-decoration:underline;}
  table{width:100%; border-collapse:collapse; font-size:.88rem;}
  th{background:var(--panel2); color:var(--muted); text-transform:uppercase;
    font-size:.7rem; letter-spacing:1px; padding:8px 10px; text-align:left;}
  td{padding:7px 10px; border-top:1px solid var(--line);}
  tr:hover td{background:rgba(255,255,255,.03);}
  td.pos{color:var(--muted); width:34px;}
  td.mat{color:var(--muted); width:70px;}
  td.team{font-weight:600; color:var(--accent2);}
  .host-line{display:flex; gap:14px; flex-wrap:wrap; padding:8px 16px;
    background:rgba(46,204,113,.06); border-top:1px solid var(--line); font-size:.82rem; color:var(--muted);}
  .host-line b{color:var(--txt);}
/* ---------- Piloti ---------- */
  .toolbar{display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin:18px 0;}
  .toolbar input,.toolbar select{background:var(--panel); color:var(--txt);
    border:1px solid var(--line); border-radius:8px; padding:10px 14px; font-size:.95rem;}
  .toolbar input{flex:1; min-width:220px;}
  .toolbar input:focus,.toolbar select:focus{outline:none; border-color:var(--accent);}
  .pilots-count{color:var(--muted); font-size:.85rem; margin-left:auto;}
  .pilot-table-wrap{overflow:auto; border:1px solid var(--line); border-radius:12px; background:var(--panel);}
  .pilot-table-wrap table{min-width:720px;}
  .pilot-table-wrap td{padding:8px 12px;}
  .group-chip{display:inline-block; background:var(--panel2); border:1px solid var(--line);
    border-radius:999px; padding:1px 10px; font-size:.75rem; color:var(--accent2);}
  .cat-chip{display:inline-block; background:var(--blue); color:#fff; border-radius:6px;
    padding:1px 8px; font-size:.7rem; font-weight:700;}

  footer{text-align:center; color:var(--muted); font-size:.8rem; padding:20px;
    border-top:1px solid var(--line); margin-top:30px;}
  @media (max-width:600px){
    .lobby-grid{grid-template-columns:1fr;}
    header h1{font-size:1.4rem;}
  }
</style>
</head>
<body>
<header>
  <h1>HUB <span>UNION</span></h1>
  <p>Campionato Union 2026 · Round 2 — Lobby e Piloti</p>
</header>

<section class="stats" id="stats"></section>

<nav>
  <button class="active" data-view="lobby">🏁 Lobby</button>
  <button data-view="piloti">👥 Piloti</button>
</nav>

<main>
  <section id="view-lobby" class="section active"></section>
  <section id="view-piloti" class="section"></section>
</main>

<footer>Dati estratti da <a href="https://sites.google.com/view/hubunion/home" style="color:var(--blue)">sites.google.com/view/hubunion</a> · scraping automatico</footer>

<script>
const DATA = __DATA__;
const DAYS = ["LUNEDI","MARTEDI","MERCOLEDI","GIOVEDI","VENERDI"];

/* ---------- stats ---------- */
function renderStats(){
  const s = DATA.stats;
  const el = document.getElementById("stats");
  el.innerHTML = [
    ["🏎️", s.total_pilots, "Piloti"],
    ["🏁", s.total_lobbies, "Lobby"],
    ["🏆", s.total_teams, "Team"],
    ["📅", DAYS.filter(d=>s.pilots_per_day[d]).length, "Giorni"]
  ].map(([e,v,l])=>`<div class="stat"><b>${e} ${v}</b><span>${l}</span></div>`).join("");
}

/* ---------- lobby view ---------- */
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

function lobbyCard(lb){
  const rows = lb.pilots.map(p=>`
    <tr>
      <td class="pos">${p.pos}</td>
      <td class="mat">${esc(p.matricola)}</td>
      <td class="team">${esc(p.team)}</td>
      <td>${esc(p.nome)}</td>
      <td>${esc(p.auto)}</td>
    </tr>`).join("");
  const live = lb.url ? `<a href="${esc(lb.url)}" target="_blank" rel="noopener">▶ ${esc(lb.live||"Canale Live")}</a>` : (lb.live?esc(lb.live):"—");
  return `
  <div class="lobby">
    <div class="lobby-head">
      <span class="lobby-name">Lobby ${esc(lb.name)}</span>
      <span class="badge cat">${esc(lb.category)}</span>
      <span class="badge">${esc(lb.time)}</span>
      <div class="lobby-meta">
        <div>👑 <b>${esc(lb.host||"—")}</b></div>
        <div>${live}</div>
      </div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Matricola</th><th>Team</th><th>Pilota</th><th>Auto</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="5" style="color:var(--muted)">Nessun pilota</td></tr>'}</tbody>
    </table>
  </div>`;
}

function renderLobby(){
  const el = document.getElementById("view-lobby");
  const byDay = {};
  DAYS.forEach(d=>byDay[d]=[]);
  DATA.lobbies.forEach(lb=>{ (byDay[lb.day]=byDay[lb.day]||[]).push(lb); });
  el.innerHTML = DAYS.filter(d=>byDay[d]&&byDay[d].length).map(d=>`
    <div class="day-block">
      <div class="day-title">${d} · ${byDay[d].length} lobby</div>
      <div class="lobby-grid">${byDay[d].map(lobbyCard).join("")}</div>
    </div>`).join("");
}
/* ---------- piloti view ---------- */
let pilotFilter = {q:"", team:"", cat:"", group:""};

function renderPiloti(){
  const el = document.getElementById("view-piloti");
  const q = pilotFilter.q.toLowerCase();
  const list = DATA.pilots.filter(p=>{
    if(q && !(p.nome.toLowerCase().includes(q) || p.team.toLowerCase().includes(q) || String(p.matricola||p.prog).includes(q))) return false;
    if(pilotFilter.team && p.team!==pilotFilter.team) return false;
    if(pilotFilter.cat && p.categoria!==pilotFilter.cat) return false;
    if(pilotFilter.group && p.lobby_group!==pilotFilter.group) return false;
    return true;
  });
  const teams = [...new Set(DATA.pilots.map(p=>p.team))].sort();
  const cats = [...new Set(DATA.pilots.map(p=>p.categoria))].sort();
  const groups = [...new Set(DATA.pilots.map(p=>p.lobby_group))].sort((a,b)=>a-b);
  const sel = (v,cur)=>v===cur?'selected':'';

  el.innerHTML = `
    <div class="toolbar">
      <input id="f-q" type="search" placeholder="🔎 Cerca pilota, team o matricola…" value="${esc(pilotFilter.q)}">
      <select id="f-team">
        <option value="">Tutti i team</option>
        ${teams.map(t=>`<option ${sel(t,pilotFilter.team)}>${esc(t)}</option>`).join("")}
      </select>
      <select id="f-cat">
        <option value="">Tutte le categorie</option>
        ${cats.map(c=>`<option ${sel(c,pilotFilter.cat)}>${esc(c)}</option>`).join("")}
      </select>
      <select id="f-group">
        <option value="">Tutti i gruppi</option>
        ${groups.map(g=>`<option ${sel(g,pilotFilter.group)}>${esc(g)}</option>`).join("")}
      </select>
      <div class="pilots-count">${list.length} / ${DATA.pilots.length} piloti</div>
    </div>
    <div class="pilot-table-wrap">
      <table>
        <thead><tr><th>#</th><th>Pilota</th><th>Team</th><th>Categoria</th><th>Gruppo Lobby</th></tr></thead>
        <tbody>
          ${list.map(p=>`
            <tr>
              <td class="pos">${p.prog}</td>
              <td><b>${esc(p.nome)}</b></td>
              <td class="team">${esc(p.team)}</td>
              <td><span class="cat-chip">${esc(p.categoria)}</span></td>
              <td><span class="group-chip">Lobby ${esc(p.lobby_group)}</span></td>
            </tr>`).join("") || '<tr><td colspan="5" style="color:var(--muted);padding:20px">Nessun risultato</td></tr>'}
        </tbody>
      </table>
    </div>`;

  document.getElementById("f-q").addEventListener("input",e=>{pilotFilter.q=e.target.value; renderPiloti();});
  document.getElementById("f-team").addEventListener("change",e=>{pilotFilter.team=e.target.value; renderPiloti();});
  document.getElementById("f-cat").addEventListener("change",e=>{pilotFilter.cat=e.target.value; renderPiloti();});
  document.getElementById("f-group").addEventListener("change",e=>{pilotFilter.group=e.target.value; renderPiloti();});
}

/* ---------- nav ---------- */
document.querySelectorAll("nav button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll("nav button").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));
    document.getElementById("view-"+btn.dataset.view).classList.add("active");
  });
});

renderStats();
renderLobby();
renderPiloti();
</script>
</body>
</html>
"""
# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("Scarico il foglio PILOTI…")
    pilots = parse_piloti()
    print(f"  {len(pilots)} piloti trovati")

    print("Scarico i fogli LOBBY…")
    lobbies = parse_lobbies()
    print(f"  {len(lobbies)} lobby trovate")
    for lb in lobbies:
        print(f"    {lb['day']:10s} {lb['name']:4s} {lb['category']:10s} "
              f"{lb['time']:8s} host={lb['host'] or '-':20s} piloti={len(lb['pilots'])}")

    stats = build_stats(lobbies, pilots)
    data = {"meta": {"source": SITE, "title": "HUB UNION - Campionato Union 2026 Round 2"},
            "stats": stats, "lobbies": lobbies, "pilots": pilots}

    out_json = "data.json"
    out_html = "index.html"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    with open(out_html, "w", encoding="utf-8") as f:
        f.write(build_html(data))

    print(f"\nOK → {out_json} ({len(pilots)} piloti, {len(lobbies)} lobby)")
    print(f"OK → {out_html} (dashboard HTML standalone)")


if __name__ == "__main__":
    sys.exit(main())