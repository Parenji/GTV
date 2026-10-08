/* ==========================================================================
   SPORT MODE · GRAN TURISMO 7
   --------------------------------------------------------------------------
   Legge dati/sport.json (rigenerato 4 volte al giorno dal workflow
   gt7-sport.yml) e disegna due sezioni di index.html:
     #sport       -> time trial in corso + gare settimanali, con tempo,
                     posizione tra i GTV, posizione assoluta e distacchi %
     #sportstats  -> statistiche aggregate e storico dei piloti GTV
   Il renderer e' difensivo: qualunque campo mancante diventa "—".
   ========================================================================== */

const SPORT_DATA_URL = datoUrl("sport", "dati/sport.json");

function sportEscape(value) {
  if (value === null || value === undefined || value === "") return "—";
  return escapeHtml(String(value));
}

function sportNum(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    return value.toLocaleString("it-IT") + suffix;
  }
  return String(value) + suffix;
}

function sportPct(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  if (n === 0) return '<span class="ui-muted" title="Riferimento: miglior tempo">rif.</span>';
  return (n > 0 ? "+" : "") + n.toFixed(3) + "%";
}

/* --------------------------------------------------------------------------
   Ciclo di vita degli eventi (in corso -> archivio)
   Le date in sport.json sono in italiano ("01 Ott 2026") e `chiusura` e'
   l'istante esatto in ISO UTC. Lo scraper sposta gia' gli eventi chiusi, ma
   gira poche volte al giorno: qui il controllo viene fatto anche nel browser,
   cosi' un evento chiuso passa in archivio subito, senza aspettare il
   prossimo aggiornamento dei dati (e anche se GitHub ritarda il workflow).
   -------------------------------------------------------------------------- */
const SPORT_MESI = {
  gen: 0, feb: 1, mar: 2, apr: 3, mag: 4, giu: 5,
  lug: 6, ago: 7, set: 8, ott: 9, nov: 10, dic: 11,
};

function sportDataISO(valore) {
  if (!valore) return null;
  const m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/.exec(
    String(valore).trim()
  );
  if (!m) return null;
  const mese = SPORT_MESI[m[2].toLowerCase()];
  if (mese === undefined) return null;
  const d = new Date(Number(m[3]), mese, Number(m[1]));
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/* Scaduto quando l'istante di chiusura e' passato.

   `chiusura` e' l'orario esatto scritto dallo scraper ("2026-09-24T06:59:59Z"):
   le time trial chiudono a meta' mattina dell'ultimo giorno, quindi la sola
   data non basta e l'evento resterebbe "in corso" fino a mezzanotte. Se il
   campo manca (file vecchio, evento senza orario ufficiale) si ripiega sul
   giorno: vale fino a fine giornata. */
function sportEventoConcluso(evento) {
  if (!evento) return false;
  if (evento.conclusa === true) return true;
  if (evento.chiusura) {
    const quando = Date.parse(evento.chiusura);
    if (!Number.isNaN(quando)) return Date.now() >= quando;
  }
  const fine = sportDataISO(evento.scadenza || evento.fine);
  if (!fine) return false;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  return fine.getTime() < oggi.getTime();
}

function sportChiaveEvento(evento) {
  return [
    evento.nome || evento.pista || "",
    evento.fine || evento.scadenza || "",
    evento.settimana || "",
  ].join("|");
}

/* Divide gli eventi elencati come "in corso" da quelli ormai scaduti, che
   finiscono in testa all'archivio (senza duplicare quelli gia' archiviati
   dallo scraper). */
function sportSeparaEventi(inCorso, archivio) {
  const attivi = [];
  const scaduti = [];
  const vecchi = (archivio || []).slice();
  const visti = new Set(vecchi.map(sportChiaveEvento));
  (inCorso || []).forEach((evento) => {
    if (!sportEventoConcluso(evento)) {
      attivi.push(evento);
      return;
    }
    const chiave = sportChiaveEvento(evento);
    if (visti.has(chiave)) return;
    visti.add(chiave);
    scaduti.push(Object.assign({}, evento, { conclusa: true }));
  });
  return { attivi: attivi, archivio: scaduti.concat(vecchi) };
}

/* Riga di classifica: tempo + posizioni + distacchi */
function sportEventTable(entries, partecipanti, messaggioVuoto) {
  if (!entries || entries.length === 0) {
    return `<div class="ui-state">${
      messaggioVuoto || "Nessun pilota del team in classifica."
    }</div>`;
  }
  let html = '<div class="ui-table-wrap"><table class="ui-table">';
  html += "<thead><tr>";
  html += "<th title='Posizione tra i piloti del team'>#</th>";
  html += "<th>Pilota</th><th class='ui-num'>Tempo</th>";
  html += "<th class='ui-num' title='Posizione nella classifica mondiale'>Rank</th>";
  html += "<th class='ui-num ui-hide-sm' title='Distacco percentuale dal miglior tempo del team'>Dist. team</th>";
  html += "<th class='ui-num' title='Distacco percentuale dal miglior tempo assoluto'>Dist.</th>";
  html += "</tr></thead><tbody>";

  entries.forEach((e, i) => {
    const posGtv = e.pos_gtv || i + 1;
    const posAbs = e.pos_assoluta ?? e.pos_abs;
    const posAbsLabel = posAbs
      ? "#" + Number(posAbs).toLocaleString("it-IT")
      : "—";
    html += "<tr>";
    html += `<td class="ui-pos">${sportNum(posGtv)}</td>`;
    html += `<td class="ui-cell-name" title="${sportEscape(e.gt7name || e.psn)}">${sportDriverLabel(e)}</td>`;
    html += `<td class="ui-num ui-strong">${sportEscape(e.tempo || e.time)}</td>`;
    html += `<td class="ui-num">${posAbsLabel}</td>`;
    html += `<td class="ui-num ui-muted ui-hide-sm">${sportPct(e.distacco_gtv_pct)}</td>`;
    html += `<td class="ui-num ui-muted">${sportPct(e.distacco_assoluto_pct ?? e.distacco_abs_pct)}</td>`;
    html += "</tr>";
  });

  html += "</tbody></table></div>";
  if (partecipanti) {
    html += `<div class="ui-updated" style="margin-top: var(--ui-s2)">Classifica mondiale su ${sportNum(partecipanti)} partecipanti.</div>`;
  }
  return html;
}

function sportDriverLabel(e) {
  const nome = '<span class="ui-strong">' + sportEscape(e.gt7name || e.psn) + "</span>";
  const badge = e.squadra === "JGTV" ? ' <span class="ui-badge">JGTV</span>' : "";
  return nome + badge;
}

/* Un evento: logo + nome, dettagli su una riga, poi la classifica GTV */
function sportEventCard(evento) {
  if (!evento) return "";
  const nome = sportEscape(evento.nome || evento.titolo || "Evento");
  // Dettagli con etichetta (Pista, Auto, Periodo, Leader...)
  const dettagli = [];
  if (evento.pista && !String(evento.nome || "").includes(evento.pista)) {
    dettagli.push(["Pista", sportEscape(evento.pista)]);
  }
  if (evento.auto) dettagli.push(["Auto", sportEscape(evento.auto)]);
  if (evento.impostazioni) dettagli.push(["Regole", sportEscape(evento.impostazioni)]);
  if (evento.inizio || evento.fine) {
    dettagli.push(["Periodo", sportEscape([evento.inizio, evento.fine].filter(Boolean).join(" → "))]);
  }
  if (evento.miglior_tempo) {
    const chi = evento.leader ? " (" + sportEscape(evento.leader) + ")" : "";
    dettagli.push(["Leader", sportEscape(evento.miglior_tempo) + chi]);
  }

  const vuoto = evento.settimana
    ? "Nessun pilota del team ha corso questa gara."
    : "Nessun pilota del team ha girato qui questa settimana.";

  let html = '<div class="ui-event">';
  html += '<div class="ui-event-head">';
  if (evento.logo) {
    html +=
      '<img src="' +
      sportEscape(evento.logo) +
      '" alt="" loading="lazy"' +
      " onerror=\"this.style.display='none'\">";
  }
  html += `<div><div class="ui-strong">${nome}</div>`;
  if (dettagli.length) {
    html +=
      '<dl class="ui-kv" style="margin-top: var(--ui-s1)">' +
      dettagli.map((d) => `<div><dt>${d[0]}</dt><dd>${d[1]}</dd></div>`).join("") +
      "</dl>";
  }
  html += "</div></div>";
  html += sportEventTable(evento.classifica, evento.partecipanti, vuoto);
  html += "</div>";
  return html;
}

let sportDatiSport = null;
let sportPannello = "tt";

function renderSportSection(data) {
  const body = document.getElementById("sport-body");
  if (!body) return;

  if (data) sportDatiSport = data;
  const d = sportDatiSport || {};
  const tt = d.time_trial || {};

  // Un evento chiuso va in archivio anche se sport.json lo elenca ancora fra
  // gli "in corso" (i dati si aggiornano poche volte al giorno, la chiusura e' netta).
  const ttDivisi = sportSeparaEventi(tt.attivi, tt.passati);
  const attivi = ttDivisi.attivi;
  const passati = ttDivisi.archivio;
  const gareDivise = sportSeparaEventi(d.gare_settimanali, d.gare_precedenti);
  const inCorso = gareDivise.attivi;
  const precedenti = gareDivise.archivio;

  if (!attivi.length && !passati.length && !inCorso.length && !precedenti.length) {
    body.innerHTML =
      '<div class="ui-state">Nessun dato Sport Mode disponibile al momento.</div>';
    return;
  }

  let html = "";
  if (attivi.length) {
    html += '<div class="ui-subhead">Time trial in corso</div>';
    html += attivi.map(sportEventCard).join("");
  }
  if (inCorso.length) {
    html += '<div class="ui-subhead">Gare settimanali in corso</div>';
    html += inCorso.map(sportEventCard).join("");
  }

  // Le due sezioni "passate" si alternano per non allungare troppo la pagina
  const pannelli = [];
  if (passati.length) {
    pannelli.push({
      id: "tt",
      etichetta: "Ultime " + passati.length + " time trial concluse",
      eventi: passati,
      nota: null,
    });
  }
  if (precedenti.length) {
    // Se nell'archivio ci sono piu' settimane (perche' le daily appena scadute
    // si sono aggiunte a quelle della settimana scorsa) la nota non vale piu'.
    const settimane = Array.from(
      new Set(precedenti.map((e) => e.settimana).filter(Boolean))
    );
    pannelli.push({
      id: "daily",
      etichetta: "Ultime daily",
      eventi: precedenti,
      nota:
        settimane.length === 1
          ? "Gare della settimana del " + settimane[0] + "."
          : null,
    });
  }

  if (pannelli.length) {
    const scelto =
      pannelli.filter((p) => p.id === sportPannello)[0] || pannelli[0];
    html += '<div class="ui-subhead">Archivio</div>';
    html += '<div class="ui-seg" role="group" aria-label="Archivio">';
    pannelli.forEach((p) => {
      html +=
        '<button type="button" class="ui-seg-btn" aria-pressed="' +
        (p.id === scelto.id) +
        '" data-pannello="' +
        p.id +
        '">' +
        p.etichetta +
        "</button>";
    });
    html += "</div>";
    if (scelto.nota) {
      html += '<p class="ui-text">' + sportEscape(scelto.nota) + "</p>";
    }
    html += scelto.eventi.map(sportEventCard).join("");
  }

  body.innerHTML = html;

  body.querySelectorAll("[data-pannello]").forEach((bottone) => {
    bottone.addEventListener("click", () => {
      if (sportPannello === bottone.dataset.pannello) return;
      sportPannello = bottone.dataset.pannello;
      renderSportSection();
    });
  });
}

/* Filtri temporali della tabella piloti */
const SPORT_FINESTRE = [
  { id: "all", etichetta: "ALL TIME", giorni: null },
  { id: "anno", etichetta: "Ultimo anno", giorni: 365 },
  { id: "trimestre", etichetta: "Ultimi 3 mesi", giorni: 90 },
];

let sportDati = null;
let sportFinestra = "all";

function sportData(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* Grafico: distribuzione dei piazzamenti mondiali del team */
function sportRankChart(grafici) {
  const fasce = (grafici && grafici.fasce_rank) || [];
  const totale = (grafici && grafici.eventi_totali) || 0;
  if (!fasce.length || !totale) return "";
  const massimo = Math.max(...fasce.map((f) => f.conteggio), 1);

  let html = '<div class="ui-subhead">Dove si piazzano i piloti del team</div>';
  html +=
    '<p class="ui-text" style="margin-top:0">' +
    sportNum(totale) +
    " eventi registrati, divisi per posizione nella classifica mondiale.</p>";
  html += '<div class="ui-bars">';
  fasce.forEach((f) => {
    const pct = f.conteggio ? Math.max(Math.round((f.conteggio / massimo) * 100), 2) : 0;
    html += '<div class="ui-bar-row">';
    html += `<span>${sportEscape(f.etichetta)}</span>`;
    html +=
      '<span class="ui-bar-track"><span class="ui-bar ui-bar--accent" style="width:' +
      pct +
      '%"></span></span>';
    html += `<span class="ui-num">${sportNum(f.conteggio)}</span>`;
    html += "</div>";
  });
  html += "</div>";
  return html;
}

/* Ricalcola le statistiche di ogni pilota sugli eventi del periodo scelto */
function sportStatistichePeriodo(piloti, giorni) {
  const limite = giorni ? Date.now() - giorni * 86400000 : null;
  return piloti.map((p) => {
    const eventi = (p.eventi || []).filter((e) => {
      if (!limite) return true;
      const t = Date.parse(e.data);
      return !Number.isNaN(t) && t >= limite;
    });
    const rank = eventi.map((e) => e.rank).filter((r) => typeof r === "number");
    return Object.assign({}, p, {
      _eventi: eventi.length,
      _miglior: rank.length ? Math.min.apply(null, rank) : null,
      _medio: rank.length
        ? Math.round(rank.reduce((a, b) => a + b, 0) / rank.length)
        : null,
    });
  });
}

function renderSportStats(data) {
  const body = document.getElementById("sport-stats-body");
  if (!body) return;

  if (data) sportDati = data;
  const dati = sportDati;
  const piloti = (dati && dati.piloti) || [];
  if (piloti.length === 0) {
    body.innerHTML =
      '<div class="ui-state">Nessuna statistica disponibile al momento.</div>';
    return;
  }

  const finestra =
    SPORT_FINESTRE.filter((f) => f.id === sportFinestra)[0] || SPORT_FINESTRE[0];
  const righe = sportStatistichePeriodo(piloti, finestra.giorni).sort((a, b) => {
    const ra = a._miglior === null ? Number.MAX_SAFE_INTEGER : a._miglior;
    const rb = b._miglior === null ? Number.MAX_SAFE_INTEGER : b._miglior;
    return ra - rb;
  });
  const eventiPeriodo = righe.reduce((t, p) => t + p._eventi, 0);

  let html = sportRankChart(dati.grafici);

  html += '<div class="ui-subhead" style="margin-top: var(--ui-s6)">Piloti del team</div>';
  html += '<div class="ui-seg" role="group" aria-label="Periodo">';
  SPORT_FINESTRE.forEach((f) => {
    html +=
      '<button type="button" class="ui-seg-btn" aria-pressed="' +
      (f.id === sportFinestra) +
      '" data-finestra="' +
      f.id +
      '">' +
      f.etichetta +
      "</button>";
  });
  html += "</div>";
  html +=
    '<p class="ui-text">' +
    sportNum(eventiPeriodo) +
    " eventi del team nel periodo" +
    (finestra.giorni ? "" : " (tutti quelli pubblicati dalla fonte)") +
    ".</p>";

  html += '<div class="ui-table-wrap"><table class="ui-table">';
  html += "<thead><tr>";
  html += "<th>#</th><th>Pilota</th><th class='ui-hide-sm'>DR</th><th class='ui-hide-sm'>SR</th>";
  html += "<th class='ui-num' title='Miglior posizione mondiale nel periodo'>Miglior</th>";
  html += "<th class='ui-num ui-hide-sm' title='Posizione mondiale media nel periodo'>Medio</th>";
  html += "<th class='ui-num' title='Eventi considerati nel periodo'>Eventi</th>";
  html += "<th class='ui-num ui-hide-sm' title=\"Data dell'ultimo evento registrato\">Ultimo</th>";
  html += "</tr></thead><tbody>";

  const rank = (v) =>
    v === null || v === undefined ? "\u2014" : "#" + Number(v).toLocaleString("it-IT");

  righe.forEach((p, i) => {
    html += "<tr>";
    html += `<td class="ui-pos">${i + 1}</td>`;
    html += `<td class="ui-cell-name" title="${sportEscape(p.gt7name || p.psn)}">${sportDriverLabel(p)}</td>`;
    html += `<td class="ui-muted ui-hide-sm">${sportEscape(p.dr)}</td>`;
    html += `<td class="ui-muted ui-hide-sm">${sportEscape(p.sr)}</td>`;
    html += `<td class="ui-num">${rank(p._miglior)}</td>`;
    html += `<td class="ui-num ui-hide-sm">${rank(p._medio)}</td>`;
    html += `<td class="ui-num">${sportNum(p._eventi)}</td>`;
    html += `<td class="ui-num ui-muted ui-hide-sm">${sportData(p.ultimo_evento_data)}</td>`;
    html += "</tr>";
  });

  html += "</tbody></table></div>";
  body.innerHTML = html;

  body.querySelectorAll("[data-finestra]").forEach((bottone) => {
    bottone.addEventListener("click", () => {
      if (sportFinestra === bottone.dataset.finestra) return;
      sportFinestra = bottone.dataset.finestra;
      renderSportStats();
    });
  });
}

async function loadSportData() {
  const sportBody = document.getElementById("sport-body");
  const statsBody = document.getElementById("sport-stats-body");
  if (!sportBody && !statsBody) return;

  try {
    // cache: "no-store" perche' l'edge di Vercel tiene i file statici per
    // percorso e ignora la query string: senza questo il browser puo' ricevere
    // una copia vecchia di sport.json anche con il "?v=" nuovo (visto il
    // 26/09/2026, con la pagina ferma al file del giorno prima).
    const response = await fetch(SPORT_DATA_URL + "?v=" + Date.now(), {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();

    if (sportBody) renderSportSection(data);
    if (statsBody) renderSportStats(data);

    const when = data.meta && data.meta.updated_at ? data.meta.updated_at : null;
    let label = "";
    let vecchi = false;
    if (when) {
      const d = new Date(when);
      const ore = (Date.now() - d.getTime()) / 3600000;
      vecchi = ore > 24;
      label =
        "Ultimo aggiornamento: " +
        d.toLocaleString("it-IT", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
      if (vecchi) {
        label +=
          " ⚠️ dati fermi da " + Math.floor(ore) + " ore (l'aggiornamento automatico non sta girando)";
      }
    }
    ["sport-updated", "sport-stats-updated"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = label;
      el.style.color = vecchi && label ? "var(--ui-danger)" : "";
    });
  } catch (err) {
    console.error("Errore nel caricamento dei dati Sport:", err);
    const msg =
      '<div class="ui-state ui-state--error">Dati Sport Mode non disponibili al momento.</div>';
    if (sportBody) sportBody.innerHTML = msg;
    if (statsBody) statsBody.innerHTML = msg;
  }
}

document.addEventListener("DOMContentLoaded", loadSportData);
