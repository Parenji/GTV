// ============================================================
// GTV UNION - logica dedicata a union.html
// Piloti iscritti, lobby, risultati e classifiche.
// Il markup usa gli elementi di ui.css (vetrina: stile.html).
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  initUnionPage();
});

function initUnionPage() {
  markUnionCalendario();
  loadUnionPiloti();
  loadUnionLobby();
  loadUnionLive();
  loadUnionStats();
  loadUnionClassifiche();
  loadUnionReportDG();
  initUnionPanel();
  initUnionPilotaLinks();
}

// -------------------------------------------------------------
// Utilita' condivise
// -------------------------------------------------------------
var UNION_LEGHE = ["STAR", "ELITE", "PRO GOLD", "PRO SILVER", "PRO AMA", "AMA"];

// Classe colore della categoria (--cat): stessi colori ovunque
function unionCategoryColorClass(category) {
  var c = String(category || "").trim().toUpperCase().replace(/\s+/g, "");
  switch (c) {
    case "STAR":
      return "ui-cat-star";
    case "ELITE":
      return "ui-cat-elite";
    case "PROGOLD":
      return "ui-cat-gold";
    case "PROSILVER":
      return "ui-cat-silver";
    case "PROAMA":
      return "ui-cat-proama";
    case "AMA":
      return "ui-cat-ama";
    default:
      return "";
  }
}

function unionCatBadge(category) {
  if (!category) return "";
  return (
    '<span class="ui-badge ui-badge--cat ' + unionCategoryColorClass(category) + '">' +
    escapeHtml(category) +
    "</span>"
  );
}

function unionState(testo, tipo) {
  var spinner = tipo === "loading" ? '<span class="ui-spinner" aria-hidden="true"></span>' : "";
  var cls = tipo === "error" ? " ui-state--error" : "";
  return '<div class="ui-state' + cls + '">' + spinner + escapeHtml(testo) + "</div>";
}

// -------------------------------------------------------------
// CALENDARIO: segna la settimana di gara in corso o la prossima
// (le date stanno negli attributi data-dal / data-al delle card)
// -------------------------------------------------------------
function markUnionCalendario() {
  var cards = document.querySelectorAll("#union-calendario .ui-race");
  if (!cards.length) return;
  var oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  var segnata = false;
  Array.prototype.forEach.call(cards, function (card) {
    var dal = new Date(card.getAttribute("data-dal") + "T00:00:00");
    var al = new Date(card.getAttribute("data-al") + "T23:59:59");
    var etichetta = card.querySelector(".ui-race-round");
    if (segnata || isNaN(dal) || isNaN(al) || al < oggi) return;
    card.classList.add("is-next");
    if (etichetta) {
      etichetta.insertAdjacentHTML(
        "beforeend",
        ' <span class="ui-badge ui-badge--accent">' + (dal <= oggi ? "In corso" : "Prossima") + "</span>"
      );
    }
    segnata = true;
  });
}

// -------------------------------------------------------------
// STATS della testata
// - Piloti iscritti totali: data.json stats.total_pilots
// - Piloti GTV: GTV unici presenti nelle lobby
// - Gare: card del calendario
// -------------------------------------------------------------
function loadUnionStats() {
  var gareEl = document.getElementById("union-stat-gare");
  if (gareEl) {
    var gare = document.querySelectorAll("#calendario .ui-race").length;
    if (gare > 0) gareEl.textContent = gare;
  }

  fetchUnionLobbyData()
    .then(function (data) {
      if (!data) return;
      var totalEl = document.getElementById("union-stat-piloti");
      if (totalEl && data.stats && data.stats.total_pilots) {
        totalEl.textContent = data.stats.total_pilots;
      }

      // Piloti GTV: si contano i GTV unici presenti nelle lobby, così il
      // numero della testata coincide con lo specchietto e con la lista
      // iscritti (il roster data.pilots può contenere nomi vecchi/non
      // schierati, es. GTV-legendafluo6 al posto di GTV-Oriano06).
      var gtvEl = document.getElementById("union-stat-gtv");
      if (gtvEl) {
        var gtvNomi = {};
        (data.lobbies || []).forEach(function (lb) {
          (lb.pilots || []).forEach(function (p) {
            if (String(p.team || "").trim().toUpperCase() === "GTV") {
              gtvNomi[String(p.nome || "").trim().toLowerCase()] = true;
            }
          });
        });
        var gtv = Object.keys(gtvNomi).length;
        gtvEl.textContent = gtv > 0 ? gtv : "—";
      }
    })
    .catch(function () {
      // Dati non ancora disponibili: i segnaposto restano visibili
      console.warn("Impossibile caricare le statistiche Union.");
    });
}

// -------------------------------------------------------------
// PILOTI ISCRITTI (dati dal CSV piloti di index.html)
// Colonna F (indice 5) = partecipazione Union
// La matricola viene presa da unionscraping/data.json (il nome in
// lobby corrisponde al PSN r[0] del CSV, con ripiego sul GT7 r[1]).
// -------------------------------------------------------------
function loadUnionPiloti() {
  var container = document.getElementById("union-piloti-body");
  if (!container) return;

  var url =
    window.GTV_CONFIG && window.GTV_CONFIG.googleSheets
      ? window.GTV_CONFIG.googleSheets.piloti
      : "";

  if (!url) {
    container.innerHTML = unionState("Configurazione non trovata.", "error");
    return;
  }

  // Carica in parallelo il CSV piloti, il data.json dello scraper e il
  // file con le auto usate in gara. Gli ultimi due sono opzionali: se
  // mancano, le matricole restano "—" e le auto restano quelle del CSV.
  Promise.all([
    fetchUnionCsvRows(),
    fetchUnionLobbyData().catch(function () {
      return null;
    }),
    fetchUnionAutoData().catch(function () {
      return null;
    }),
  ])
    .then(function (results) {
      var rows = results[0];
      var unionData = results[1];
      var autoData = results[2];

      if (!rows || rows.length === 0) {
        container.innerHTML = unionState("Nessun dato.", "empty");
        return;
      }

      var unionRows = rows.filter(function (r) {
        var participa = String(r[5] || "").trim().toLowerCase();
        return participa === "x" || participa === "✓" || participa === "1";
      });

      renderUnionPilotiCards(container, unionRows, unionData, autoData);
    })
    .catch(function (error) {
      console.error("Errore caricamento piloti Union:", error);
      container.innerHTML = unionState("Impossibile caricare i piloti Union.", "error");
    });
}

// Costruisce una mappa nome (in lobby) -> matricola dai dati dello scraper.
// Il nome viene normalizzato (trim + lowercase) per una corrispondenza
// robusta e case-insensitive; il primo valore trovato ha la precedenza.
function buildUnionMatricolaMap(unionData) {
  var map = {};
  if (!unionData || !unionData.lobbies) return map;
  unionData.lobbies.forEach(function (lb) {
    (lb.pilots || []).forEach(function (p) {
      var nome = String(p.nome || "").trim().toLowerCase();
      if (!nome) return;
      if (map[nome] === undefined) {
        map[nome] = String(p.matricola === undefined ? "" : p.matricola).trim();
      }
    });
  });
  return map;
}

// Cerca la matricola di un pilota: prima per PSN, poi (fallback) per GT7.
function lookupUnionMatricola(map, psn, gt7) {
  var key = String(psn || "").trim().toLowerCase();
  if (!key || map[key] === undefined || map[key] === "") {
    key = String(gt7 || "").trim().toLowerCase();
  }
  if (key && map[key] !== undefined && map[key] !== "") return map[key];
  return "—";
}

// Parser CSV semplice (il CSV di Google non ha campi tra virgolette usati qui)
function parseCsv(csvText) {
  var text = (csvText || "").replace(/^﻿/, "");
  var lines = text.split("\n");
  var rows = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.indexOf("\r") !== -1) {
      line = line.slice(0, line.length - 1);
    }
    var cells = line.split(",");
    var hasContent = false;
    for (var k = 0; k < cells.length; k++) {
      if (cells[k].trim() !== "") {
        hasContent = true;
        break;
      }
    }
    if (hasContent) {
      rows.push(cells);
    }
  }
  return rows;
}

function unionTierIndex(cat) {
  var c = String(cat || "").trim().toUpperCase();
  var i = UNION_LEGHE.indexOf(c);
  return i === -1 ? UNION_LEGHE.length : i;
}

// Nome con cui ordinare le card: quello GT7 se presente, altrimenti il PSN.
function unionNomeOrdinamento(riga) {
  var gt7 = String(riga[1] || "").trim();
  var psn = String(riga[0] || "").trim();
  return (gt7 || psn).toLowerCase();
}

// Logo marca con ripiego PNG -> SVG (come worldchampionship)
function brandLogoHtml(brand) {
  var b = String(brand || "").trim();
  if (!b) return "";
  var slug = b.toLowerCase().replace(/[^a-z0-9]+/g, "");
  var png = "images/marchi-auto/" + slug + ".png";
  var svg = "images/marchi-auto/" + slug + ".svg";
  return (
    '<img src="' + png + '" alt="' + escapeHtml(b) + '" class="ui-pilot-brand"' +
    " onerror=\"if(this.src.indexOf('.png') !== -1){this.src='" + svg + "';}else{this.style.display='none';}\">"
  );
}

function renderUnionPilotiCards(container, rows, unionData, autoData) {
  // Per categoria, poi per il nome mostrato in evidenza (GT7, o PSN)
  rows.sort(function (a, b) {
    var tierDiff = unionTierIndex(a[6]) - unionTierIndex(b[6]);
    if (tierDiff !== 0) return tierDiff;
    return unionNomeOrdinamento(a).localeCompare(unionNomeOrdinamento(b));
  });

  var matricolaMap = buildUnionMatricolaMap(unionData);
  var autoMap = buildUnionAutoMap(autoData);

  var cards = rows
    .map(function (r) {
      var numero = r[2] || "—";
      var psn = String(r[0] || "").trim();
      var gt7 = String(r[1] || "").trim();
      var cat = String(r[6] || "").trim();
      // Auto e marchio: prima il foglio Google, altrimenti il ripiego
      // con le auto lette dalle classifiche ufficiali delle gare.
      var autoRec = lookupUnionAuto(autoMap, psn, gt7);
      var auto = r[7] || (autoRec ? autoRec.auto : "") || "—";
      var marchio = r[8] || (autoRec ? autoRec.marchio : "") || "";
      var matricola = lookupUnionMatricola(matricolaMap, psn, gt7);

      // In evidenza il nome GT7 (quello visto in gioco e nelle classifiche),
      // sotto sempre il PSN, anche quando coincide.
      return (
        '<div class="ui-card ui-pilot ui-card--link" data-pilota="' + escapeHtml(gt7 || psn) + '"' +
        (gt7 && psn ? ' data-pilota-alt="' + escapeHtml(psn) + '"' : "") + ' tabindex="0" role="button">' +
        '<div class="ui-pilot-top"><span class="ui-pilot-num">#' + escapeHtml(numero) + "</span>" +
        unionCatBadge(cat) + "</div>" +
        (marchio ? brandLogoHtml(marchio) : "<span></span>") +
        '<div class="ui-pilot-name">' + escapeHtml(gt7 || psn || "—") + "</div>" +
        '<div class="ui-pilot-sub">' + escapeHtml(psn) + "</div>" +
        '<dl class="ui-kv">' +
        "<div><dt>Matricola</dt><dd>" + escapeHtml(matricola) + "</dd></div>" +
        "<div><dt>Auto</dt><dd>" + escapeHtml(auto) + "</dd></div>" +
        "</dl>" +
        "</div>"
      );
    })
    .join("");

  var meta = document.getElementById("union-piloti-count");
  if (meta) meta.textContent = rows.length + " piloti";

  container.innerHTML = '<div class="ui-grid" style="--ui-grid-min: 260px">' + cards + "</div>";
}

// -------------------------------------------------------------
// LOBBY - dati estratti da unionscraping/data.json
// 1) Specchietto riassuntivo dei piloti GTV con link alla lobby
// 2) Tutte le lobby (schieramenti completi) raggruppate per giorno
// -------------------------------------------------------------
var UNION_LOBBY_DAYS = ["LUNEDI", "MARTEDI", "MERCOLEDI", "GIOVEDI", "VENERDI"];
var UNION_DAY_LABEL = {
  LUNEDI: "Lunedì",
  MARTEDI: "Martedì",
  MERCOLEDI: "Mercoledì",
  GIOVEDI: "Giovedì",
  VENERDI: "Venerdì",
};

// URL dei dati estratti dallo scraper
function unionLobbyDataUrl() {
  return window.GTV_CONFIG && window.GTV_CONFIG.unionLobbyData
    ? window.GTV_CONFIG.unionLobbyData
    : "unionscraping/data.json";
}

// Fetch condiviso e memoizzato: data.json viene scaricato una sola volta
// e riusato da lobby, testata e piloti (colonna Matricola).
var _unionLobbyDataPromise = null;
function fetchUnionLobbyData() {
  if (!_unionLobbyDataPromise) {
    _unionLobbyDataPromise = fetch(unionLobbyDataUrl())
      .then(function (response) {
        if (!response.ok) throw new Error("Errore HTTP " + response.status);
        return response.json();
      })
      .catch(function (err) {
        _unionLobbyDataPromise = null; // consente un nuovo tentativo
        throw err;
      });
  }
  return _unionLobbyDataPromise;
}

// -------------------------------------------------------------
// AUTO USATE IN GARA (unionscraping/auto.json)
// Le colonne Union_auto / Union_marchio del foglio Google restano la
// fonte primaria: questo file interviene solo se sono vuote.
// -------------------------------------------------------------
function unionAutoDataUrl() {
  return window.GTV_CONFIG && window.GTV_CONFIG.unionAutoData
    ? window.GTV_CONFIG.unionAutoData
    : "unionscraping/auto.json";
}

var _unionAutoDataPromise = null;
function fetchUnionAutoData() {
  if (!_unionAutoDataPromise) {
    _unionAutoDataPromise = fetch(unionAutoDataUrl())
      .then(function (response) {
        if (!response.ok) throw new Error("Errore HTTP " + response.status);
        return response.json();
      })
      .catch(function (err) {
        _unionAutoDataPromise = null; // consente un nuovo tentativo
        throw err;
      });
  }
  return _unionAutoDataPromise;
}

// Mappa PSN/GT7 (normalizzati) -> record auto. Ogni pilota è indicizzato
// sia con la chiave dell'oggetto sia con i campi psn e gt7, così la
// corrispondenza con il CSV regge anche se una delle due grafie cambia.
function buildUnionAutoMap(autoData) {
  var map = {};
  if (!autoData || !autoData.piloti) return map;
  Object.keys(autoData.piloti).forEach(function (key) {
    var rec = autoData.piloti[key] || {};
    [key, rec.psn, rec.gt7].forEach(function (alias) {
      var k = String(alias || "").trim().toLowerCase();
      if (k && map[k] === undefined) map[k] = rec;
    });
  });
  return map;
}

// Cerca il record auto di un pilota: prima per PSN, poi per GT7.
function lookupUnionAuto(map, psn, gt7) {
  var k = String(psn || "").trim().toLowerCase();
  if (k && map[k]) return map[k];
  k = String(gt7 || "").trim().toLowerCase();
  if (k && map[k]) return map[k];
  return null;
}

function loadUnionLobby() {
  var specchietto = document.getElementById("union-specchietto-body");
  var body = document.getElementById("union-lobby-body");
  if (!specchietto && !body) return;

  fetchUnionLobbyData()
    .then(function (data) {
      if (!data || !data.lobbies) {
        throw new Error("Dati non validi");
      }
      setUnionLastUpdate(data);
      if (specchietto) renderUnionSpecchietto(specchietto, data);
      if (body) renderUnionLobbyBody(body, data);
    })
    .catch(function (err) {
      console.error("Errore caricamento lobby:", err);
      var msg = unionState("Impossibile caricare le lobby Union.", "error");
      if (specchietto) specchietto.innerHTML = msg;
      if (body) body.innerHTML = msg;
    });
}

// "Ultimo aggiornamento automatico": meta.generated_at (UTC) di data.json
// mostrato in data/ora locali del visitatore.
function setUnionLastUpdate(data) {
  var el = document.getElementById("union-last-update");
  if (!el) return;
  var iso = data && data.meta && data.meta.generated_at;
  if (!iso) return; // assente → elemento resta nascosto
  var d = new Date(iso);
  if (isNaN(d.getTime())) return;
  el.textContent =
    "Ultimo aggiornamento automatico: " +
    d.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  el.hidden = false;
}

// Id univoco di una lobby (per gli ancoraggi dello specchietto)
function lobbyCardId(day, name) {
  return "union-lobby-" + String(day || "").toLowerCase() + "-" + String(name || "").toLowerCase();
}

// Ordina per giorno e poi per nome lobby
function unionDayIndex(day) {
  var i = UNION_LOBBY_DAYS.indexOf(String(day || "").toUpperCase());
  return i === -1 ? UNION_LOBBY_DAYS.length : i;
}

function unionOra(time) {
  return String(time || "").replace("Ore ", "").trim();
}

// Specchietto: i piloti GTV divisi per categoria, con il salto alla lobby
function renderUnionSpecchietto(container, data) {
  var rows = [];
  data.lobbies.forEach(function (lb) {
    lb.pilots.forEach(function (p) {
      if (String(p.team || "").trim().toUpperCase() !== "GTV") return;
      rows.push({ name: lb.name, day: lb.day, time: lb.time, category: lb.category, pilot: p.nome || "" });
    });
  });

  if (!rows.length) {
    container.innerHTML = unionState("Nessun pilota GTV trovato nelle lobby.", "empty");
    return;
  }

  // Dentro ogni categoria: per giorno, poi per lobby
  rows.sort(function (a, b) {
    var diff = unionTierIndex(a.category) - unionTierIndex(b.category);
    if (diff !== 0) return diff;
    diff = unionDayIndex(a.day) - unionDayIndex(b.day);
    if (diff !== 0) return diff;
    return String(a.name).localeCompare(String(b.name), undefined, { numeric: true });
  });

  var html =
"";

  var categorie = [];
  rows.forEach(function (r) {
    if (categorie.indexOf(r.category) === -1) categorie.push(r.category);
  });

  categorie.forEach(function (cat) {
    var righe = rows
      .filter(function (r) {
        return r.category === cat;
      })
      .map(function (r) {
        var giorno = UNION_DAY_LABEL[String(r.day || "").toUpperCase()] || r.day;
        return (
          "<tr>" +
          '<td><span class="ui-strong">' + unionPilotaLink(r.pilot) + "</span></td>" +
          '<td><button type="button" class="ui-btn ui-btn--sm ui-btn--block" data-target="' + lobbyCardId(r.day, r.name) + '">' +
          escapeHtml(r.name) + "</button></td>" +
          "<td>" + escapeHtml(giorno) + "</td>" +
          '<td class="ui-num">' + escapeHtml(unionOra(r.time)) + "</td>" +
          "</tr>"
        );
      })
      .join("");

    html +=
      '<div class="ui-subhead ' + unionCategoryColorClass(cat) + '">' + escapeHtml(cat) + "</div>" +
      '<div class="ui-table-wrap"><table class="ui-table ui-table--fixed">' +
      '<thead><tr><th>Pilota</th><th class="ui-w-sm">Lobby</th><th class="ui-w-md">Giorno</th><th class="ui-num ui-w-xs">Ora</th></tr></thead>' +
      "<tbody>" + righe + "</tbody></table></div>";
  });

  container.innerHTML = html;

  // Apre la lobby e ci scorre sopra (tenendo conto dell'header fisso)
  container.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-target]");
    if (!btn) return;
    var id = btn.getAttribute("data-target");
    openUnionLobby(id);
    var target = document.getElementById(id);
    if (target) {
      var y = target.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: Math.max(y, 0), behavior: "smooth" });
    }
  });
}

// Tutte le lobby, per giorno, come accordion (details/summary)
function renderUnionLobbyBody(container, data) {
  var byDay = {};
  data.lobbies.forEach(function (lb) {
    var d = String(lb.day || "").toUpperCase();
    (byDay[d] = byDay[d] || []).push(lb);
  });

  var html = UNION_LOBBY_DAYS.filter(function (d) {
    return byDay[d] && byDay[d].length;
  })
    .map(function (d) {
      return (
        '<div class="ui-subhead">' + escapeHtml(UNION_DAY_LABEL[d] || d) + "</div>" +
        byDay[d].map(unionLobbyCardHtml).join("")
      );
    })
    .join("");

  container.innerHTML = html || unionState("Nessuna lobby trovata.", "empty");
}

function unionLobbyCardHtml(lb) {
  var gtv = lb.pilots.filter(function (p) {
    return String(p.team || "").trim().toUpperCase() === "GTV";
  }).length;

  var pilots = lb.pilots
    .map(function (p) {
      var isGtv = String(p.team || "").trim().toUpperCase() === "GTV";
      return (
        '<li class="ui-row' + (isGtv ? " is-gtv" : "") + '">' +
        '<span class="ui-pos">' + escapeHtml(p.pos) + "</span>" +
        '<span class="ui-muted">' + escapeHtml(p.team) + "</span>" +
        '<span class="ui-ellipsis' + (isGtv ? " ui-strong" : "") + '">' + unionPilotaLink(p.nome) + "</span>" +
        "</li>"
      );
    })
    .join("");

  var host = lb.host
    ? '<a href="https://profile.playstation.com/' + encodeURIComponent(lb.host) +
      '/add" target="_blank" rel="noopener">' + escapeHtml(lb.host) + "</a>"
    : "—";
  var live = lb.url
    ? '<a href="' + escapeHtml(lb.url) + '" target="_blank" rel="noopener">' +
      escapeHtml(lb.live || "Canale live") + "</a>"
    : "—";

  return (
    '<details class="ui-acc" id="' + lobbyCardId(lb.day, lb.name) + '">' +
    "<summary>" +
    '<span class="ui-badge">' + escapeHtml(unionOra(lb.time)) + "</span>" +
    '<span class="ui-strong">' + escapeHtml(lb.name) + "</span>" +
    unionCatBadge(lb.category) +
    '<span class="ui-muted" style="font-size: var(--ui-fs-xs)">' + lb.pilots.length + " piloti" +
    (gtv ? ", " + gtv + " GTV" : "") + "</span>" +
    "</summary>" +
    '<div class="ui-acc-body">' +
    '<dl class="ui-kv union-lobby-info" style="margin: 0 0 var(--ui-s3)"><div><dt>Host</dt><dd>' + host +
    "</dd></div><div><dt>Live</dt><dd>" + live + "</dd></div></dl>" +
    '<ol class="ui-list" style="--ui-row-cols: 32px 64px 1fr">' + pilots + "</ol>" +
    "</div>" +
    "</details>"
  );
}

// Apre la lobby indicata (usato dallo specchietto)
function openUnionLobby(id) {
  var el = document.getElementById(id);
  if (!el) return false;
  el.open = true;
  return true;
}

// -------------------------------------------------------------
// LIVE: dove seguire i piloti GTV (canale della loro lobby) e le lobby
// in cui un GTV e' host. Dati: lobby di data.json (host, live, url) e
// foglio piloti (per riconoscere gli host GTV dal PSN).
// -------------------------------------------------------------
function unionPiattaforma(url) {
  var u = String(url || "").toLowerCase();
  if (u.indexOf("twitch.tv") !== -1) return "Twitch";
  if (u.indexOf("youtube.com") !== -1 || u.indexOf("youtu.be") !== -1) return "YouTube";
  return "Live";
}

// Giorno di oggi nella forma dei dati ("LUNEDI"...), "" nel fine settimana
function unionOggi() {
  return UNION_LOBBY_DAYS[(new Date().getDay() + 6) % 7] || "";
}

function loadUnionLive() {
  var body = document.getElementById("union-live-body");
  if (!body) return;
  Promise.all([
    fetchUnionLobbyData(),
    fetchUnionCsvRows().catch(function () {
      return [];
    }),
  ])
    .then(function (r) {
      if (!r[0] || !r[0].lobbies) throw new Error("Dati non validi");
      renderUnionLive(body, r[0], r[1] || []);
    })
    .catch(function (err) {
      console.error("Errore caricamento live:", err);
      body.innerHTML = unionState("Impossibile caricare i link live.", "error");
    });
}

function unionLiveBtn(lb) {
  if (!lb.url) return '<span class="ui-muted">—</span>';
  var url = /^https?:\/\//i.test(lb.url) ? lb.url : "https://" + lb.url;
  return (
    '<a class="ui-btn ui-btn--sm ui-btn--block" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' +
    "&#9654; " + unionPiattaforma(url) + "</a>" +
    (lb.live ? '<small class="ui-muted" style="display:block;margin-top:2px">' + escapeHtml(lb.live) + "</small>" : "")
  );
}

function renderUnionLive(container, data, csvRows) {
  // PSN e nome GT7 dei piloti GTV dal foglio (colonna 3 = team)
  var gtvCsv = {};
  csvRows.forEach(function (r) {
    if (String(r[3] || "").trim().toUpperCase() !== "GTV") return;
    var info = { psn: String(r[0] || "").trim(), gt7: String(r[1] || "").trim() };
    [info.psn, info.gt7].forEach(function (n) {
      if (unionNorm(n)) gtvCsv[unionNorm(n)] = info;
    });
  });

  var corrono = []; // GTV che corrono: un link per ogni pilota
  var host = []; // lobby con un GTV in regia
  data.lobbies.forEach(function (lb) {
    var gtv = (lb.pilots || []).filter(function (p) {
      return String(p.team || "").trim().toUpperCase() === "GTV";
    });
    gtv.forEach(function (p) {
      corrono.push({ lb: lb, nome: p.nome, alt: (gtvCsv[unionNorm(p.nome)] || {}).psn });
    });
    var h = gtvCsv[unionNorm(lb.host)];
    if (h) host.push({ lb: lb, nome: h.gt7 || h.psn, alt: h.gt7 ? h.psn : "", corre: gtv.length });
  });

  if (!corrono.length && !host.length) {
    container.innerHTML = unionState("Nessun pilota GTV nelle lobby.", "empty");
    return;
  }

  // Un'unica lista per giorno (come nelle lobby): chi corre e chi fa l'host
  var voci = corrono
    .map(function (x) { return { lb: x.lb, nome: x.nome, alt: x.alt, host: false }; })
    .concat(host.map(function (x) { return { lb: x.lb, nome: x.nome, alt: x.alt, host: true }; }));
  voci.sort(function (a, b) {
    return (
      unionDayIndex(a.lb.day) - unionDayIndex(b.lb.day) ||
      unionOra(a.lb.time).localeCompare(unionOra(b.lb.time)) ||
      String(a.lb.name).localeCompare(String(b.lb.name), undefined, { numeric: true }) ||
      Number(b.host) - Number(a.host) ||
      String(a.nome).localeCompare(String(b.nome))
    );
  });

  var oggi = unionOggi();
  var riga = function (x) {
    var lb = x.lb;
    return (
      "<tr>" +
      '<td><span class="ui-strong">' + unionPilotaLink(x.nome, x.alt) + "</span>" +
      (x.host ? ' <span class="ui-badge ui-badge--accent">Host</span>' : "") + "</td>" +
      "<td>" + escapeHtml(lb.name) + " " + unionCatBadge(lb.category) +
      '<small class="ui-muted" style="display:block">' + escapeHtml(unionOra(lb.time)) + "</small></td>" +
      '<td class="ui-live-cell">' + unionLiveBtn(lb) + "</td>" +
      "</tr>"
    );
  };

  var html = host.length
    ? '<p class="ui-text ui-muted" style="margin-top:0">Il link porta al canale che trasmette la lobby. ' +
      '<span class="ui-badge ui-badge--accent">Host</span> indica un pilota GTV in regia.</p>'
    : '<p class="ui-text ui-muted" style="margin-top:0">Il link porta al canale che trasmette la lobby del pilota.</p>';

  UNION_LOBBY_DAYS.forEach(function (d) {
    var righe = voci.filter(function (x) {
      return String(x.lb.day || "").toUpperCase() === d;
    });
    if (!righe.length) return;
    html +=
      '<div class="ui-subhead">' + escapeHtml(UNION_DAY_LABEL[d] || d) +
      (d === oggi ? ' <span class="ui-badge ui-badge--accent">Oggi</span>' : "") + "</div>" +
      '<div class="ui-table-wrap"><table class="ui-table ui-table--fixed ui-table--live">' +
      '<thead><tr><th>Pilota</th><th class="ui-lobby-col">Lobby</th><th class="ui-live-col">Live</th></tr></thead>' +
      "<tbody>" + righe.map(riga).join("") + "</tbody></table></div>";
  });

  var meta = document.getElementById("union-live-meta");
  if (meta) meta.textContent = corrono.length + " piloti GTV" + (host.length ? ", " + host.length + " host" : "");
  container.innerHTML = html;
}

// =============================================================
// RISULTATI E CLASSIFICHE (unionscraping/classifiche.json)
// Dati dal Portale Classifiche Union (classifiche/classifiche.py);
// la classifica di ogni lobby e' letta (OCR) dalle immagini del portale.
// =============================================================
var UNION_PISTE = ["Red Bull Ring", "Watkins Glen", "Suzuka Circuit", "Autopolis", "Nürburgring GP"];
var UNION_NUM_GARE = 5;

var unionCls = {
  data: null,
  gara: null, // gara mostrata nei risultati
  lega: "STAR", // lega mostrata nelle classifiche
  tutti: {}, // lega -> true se "mostra tutti"
  aperti: {}, // lega -> {indice di inizio del tratto compresso: true}
};

function unionClassificheUrl() {
  return window.GTV_CONFIG && window.GTV_CONFIG.unionClassificheData
    ? window.GTV_CONFIG.unionClassificheData
    : "unionscraping/classifiche.json";
}

function unionNorm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function unionIsGtv(p) {
  return String((p && p.team) || "").trim().toUpperCase() === "GTV";
}

// Stati al posto del piazzamento (A assente, NC, BOX, DSQ): etichetta e sigla
var UNION_STATI = { AG: "assente", AI: "assente", NC: "non classificato", BOX: "ai box", DSQ: "squalificato" };

function unionStato(stato) {
  return UNION_STATI[stato] || "";
}

function unionStatoSigla(stato) {
  return stato === "AG" || stato === "AI" ? "A" : stato;
}

var _unionClsPromise = null;
function fetchUnionClassifiche() {
  if (!_unionClsPromise) {
    _unionClsPromise = fetch(unionClassificheUrl())
      .then(function (response) {
        if (!response.ok) throw new Error("Errore HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.leghe) throw new Error("Dati non validi");
        return data;
      })
      .catch(function (err) {
        _unionClsPromise = null;
        throw err;
      });
  }
  return _unionClsPromise;
}

function loadUnionClassifiche() {
  var resBody = document.getElementById("union-res-body");
  var clsBody = document.getElementById("union-cls-body");
  if (!resBody && !clsBody) return;

  fetchUnionClassifiche()
    .then(function (data) {
      unionCls.data = data;
      var pubblicate = (data.meta && data.meta.gare_pubblicate) || [];
      unionCls.gara = pubblicate.length ? pubblicate[pubblicate.length - 1] : null;
      if (resBody) renderUnionRisultati();
      if (clsBody) renderUnionClassifiche();
    })
    .catch(function (err) {
      console.error("Errore caricamento classifiche:", err);
      var msg = unionState("Impossibile caricare risultati e classifiche.", "error");
      if (resBody) resBody.innerHTML = msg;
      if (clsBody) clsBody.innerHTML = msg;
    });
}

// -------------------------------------------------------------
// Risultati: schede minimal dei piloti GTV, divise per lega
// -------------------------------------------------------------
function unionGaraData(gara) {
  var gare = (unionCls.data && unionCls.data.gare) || {};
  return gare[String(gara)] || null;
}

// Riga del pilota nella classifica di una delle lobby della sua lega
function unionTrovaRisultato(garaData, lega, nome) {
  if (!garaData || !garaData.lobby) return null;
  var chiave = unionNorm(nome);
  var trovato = null;
  Object.keys(garaData.lobby).forEach(function (nomeLobby) {
    var lb = garaData.lobby[nomeLobby];
    if (trovato || lb.lega !== lega) return;
    (lb.classifica || []).forEach(function (riga) {
      // chi e' assente / NC / ai box / squalificato non ha un risultato
      if (!trovato && unionNorm(riga.nome) === chiave && !riga.stato) {
        trovato = { lobby: nomeLobby, lb: lb, riga: riga };
      }
    });
  });
  return trovato;
}

function unionDots(lb, nome) {
  var html = "";
  if (lb.pole && unionNorm(lb.pole) === unionNorm(nome)) {
    html += '<span class="ui-dot ui-dot--pole" title="Pole position nella lobby">P</span>';
  }
  if (lb.giro_veloce && unionNorm(lb.giro_veloce) === unionNorm(nome)) {
    html += '<span class="ui-dot ui-dot--fl" title="Giro più veloce in gara nella lobby"></span>';
  }
  return html;
}

function renderUnionRisultati() {
  var body = document.getElementById("union-res-body");
  var selettore = document.getElementById("union-res-gare");
  var sottotitolo = document.getElementById("union-res-subtitle");
  var data = unionCls.data;
  var pubblicate = (data.meta && data.meta.gare_pubblicate) || [];

  if (selettore) {
    var bottoni = "";
    for (var g = 1; g <= UNION_NUM_GARE; g++) {
      var ok = pubblicate.indexOf(g) !== -1;
      bottoni +=
        '<button type="button" class="ui-seg-btn"' +
        (ok ? ' data-gara="' + g + '"' : " disabled") +
        ' aria-pressed="' + (g === unionCls.gara) + '"' +
        ' title="' + escapeHtml(UNION_PISTE[g - 1] + (ok ? "" : " (non ancora pubblicata)")) + '">G' + g + "</button>";
    }
    selettore.innerHTML = bottoni;
  }

  if (!unionCls.gara) {
    if (sottotitolo) sottotitolo.textContent = "Round 2";
    body.innerHTML = unionState(
      "I risultati compariranno qui appena la Lega pubblica le classifiche di gara sul portale Union.",
      "empty"
    );
    return;
  }

  if (sottotitolo) sottotitolo.textContent = "Gara " + unionCls.gara + ", " + UNION_PISTE[unionCls.gara - 1];
  var garaData = unionGaraData(unionCls.gara);
  var html = "";

  UNION_LEGHE.forEach(function (lega) {
    var legaData = data.leghe[lega];
    var gtv = ((legaData && legaData.piloti) || []).filter(unionIsGtv);
    if (!gtv.length) return;

    var schede = gtv
      .map(function (p) {
        return { p: p, r: unionTrovaRisultato(garaData, lega, p.nome) };
      })
      .sort(function (a, b) {
        return (a.r ? a.r.riga.pos : 999) - (b.r ? b.r.riga.pos : 999);
      })
      .map(function (x) {
        if (!x.r) {
          return (
            '<div class="ui-card is-off">' +
            '<span class="ui-result-top"><span class="ui-result-name">' + escapeHtml(x.p.nome) + "</span></span>" +
            '<span class="ui-result-bottom"><span class="ui-result-pos">—</span>' +
            '<span class="ui-result-lobby">' +
            (unionStato(((x.p.esiti || [])[unionCls.gara - 1] || {}).stato) || "non classificato") +
            "</span></span>" +
            "</div>"
          );
        }
        var riga = x.r.riga;
        return (
          '<button type="button" class="ui-card' + (riga.pos <= 3 ? " is-highlight" : "") + '"' +
          ' data-lobby="' + escapeHtml(x.r.lobby) + '">' +
          '<span class="ui-result-top"><span class="ui-result-name">' + escapeHtml(x.p.nome) + "</span>" +
          '<span class="ui-dots">' + unionDots(x.r.lb, riga.nome) + "</span></span>" +
          '<span class="ui-result-bottom"><span class="ui-result-pos">P' + riga.pos + "</span>" +
          '<span class="ui-result-lobby">' + escapeHtml(x.r.lobby) + "</span></span>" +
          "</button>"
        );
      })
      .join("");

    html +=
      '<div class="ui-subhead ' + unionCategoryColorClass(lega) + '">' + escapeHtml(lega) + "</div>" +
      '<div class="ui-grid">' + schede + "</div>";
  });

  body.innerHTML =
    html +
    '<div class="ui-legend" style="margin-top: var(--ui-s5)">' +
    '<span><span class="ui-dot ui-dot--pole">P</span> pole position</span>' +
    '<span><span class="ui-dot ui-dot--fl"></span> giro più veloce in gara</span>' +
    "</div>";
}

// -------------------------------------------------------------
// Pannello della lobby: classifica di gara + grafico qualifica → gara
// -------------------------------------------------------------
function initUnionPanel() {
  var panel = document.getElementById("union-panel");
  var res = document.getElementById("union-res-body");
  var sel = document.getElementById("union-res-gare");
  if (!panel || panel.dataset.ready) return;
  panel.dataset.ready = "1";

  if (res) {
    res.addEventListener("click", function (e) {
      var card = e.target.closest("[data-lobby]");
      if (card) openUnionPanel(card.getAttribute("data-lobby"), card);
    });
  }
  if (sel) {
    sel.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-gara]");
      if (!btn) return;
      unionCls.gara = Number(btn.getAttribute("data-gara"));
      renderUnionRisultati();
    });
  }
  panel.addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) closeUnionPanel();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.hidden) closeUnionPanel();
  });
}

var _unionPanelOrigin = null;

function openUnionPanel(nomeLobby, origine) {
  var garaData = unionGaraData(unionCls.gara);
  var lb = garaData && garaData.lobby && garaData.lobby[nomeLobby];
  var panel = document.getElementById("union-panel");
  if (!lb || !panel) return;

  showUnionSheet(
    "Lobby " + escapeHtml(nomeLobby) + " " + unionCatBadge(lb.lega),
    "Gara " + unionCls.gara + ", " + UNION_PISTE[unionCls.gara - 1],
    unionLobbyPanelHtml(lb),
    origine
  );
}

// Apre il pannello con titolo, sottotitolo e contenuto dati
function showUnionSheet(titoloHtml, sub, corpoHtml, origine) {
  var panel = document.getElementById("union-panel");
  document.getElementById("union-panel-title").innerHTML = titoloHtml;
  document.getElementById("union-panel-sub").textContent = sub;
  var body = document.getElementById("union-panel-body");
  body.innerHTML = corpoHtml;
  body.scrollTop = 0;
  _unionPanelOrigin = origine || null;
  panel.hidden = false;
  document.body.style.overflow = "hidden";
  var chiudi = panel.querySelector(".ui-icon-btn");
  if (chiudi) chiudi.focus();
}

function closeUnionPanel() {
  var panel = document.getElementById("union-panel");
  if (!panel) return;
  panel.hidden = true;
  document.body.style.overflow = "";
  if (_unionPanelOrigin && document.body.contains(_unionPanelOrigin)) _unionPanelOrigin.focus();
}

function unionLobbyPanelHtml(lb) {
  var righe = (lb.classifica || []).slice().sort(function (a, b) {
    return a.pos - b.pos;
  });

  if (!righe.length) {
    return (
      '<div class="ui-state">Classifica non ancora leggibile.' +
      (lb.immagine
        ? ' <a class="ui-btn ui-btn--sm" href="' + escapeHtml(lb.immagine) + '" target="_blank" rel="noopener">Apri la classifica ufficiale</a>'
        : "") +
      "</div>"
    );
  }

  var tabella =
    '<div class="ui-table-wrap"><table class="ui-table"><thead><tr>' +
    '<th>Pos</th><th>Q</th><th>Pilota</th><th>Team</th><th class="ui-hide-sm">Auto</th><th class="ui-num">Distacco</th>' +
    "</tr></thead><tbody>" +
    righe
      .map(function (r) {
        return (
          '<tr class="' + (unionIsGtv(r) ? "is-gtv" : "") + (r.stato ? " is-off" : "") + '">' +
          '<td class="ui-pos"' + (r.stato ? ' title="' + escapeHtml(unionStato(r.stato)) + '"' : "") + ">" +
          (r.stato ? unionStatoSigla(r.stato) : r.pos) + "</td>" +
          '<td class="ui-muted">' + (r.q ? r.q : "—") + "</td>" +
          '<td><span class="ui-strong">' + unionPilotaLink(r.nome) + "</span> " + unionDots(lb, r.nome) + "</td>" +
          '<td class="ui-muted">' + escapeHtml(r.team || "") + "</td>" +
          '<td class="ui-muted ui-hide-sm">' + escapeHtml(r.auto || "") + "</td>" +
          '<td class="ui-num">' + escapeHtml(r.distacco || "") + "</td>" +
          "</tr>"
        );
      })
      .join("") +
    "</tbody></table></div>";

  return tabella + unionQtoGChart(righe);
}

// Barre divergenti: posizioni guadagnate (giallo) o perse (blu) dalla
// qualifica all'arrivo, per tutti i piloti della lobby con la qualifica nota.
function unionQtoGChart(righe) {
  var dati = righe
    .filter(function (r) {
      return r.q;
    })
    .map(function (r) {
      return { r: r, d: r.q - r.pos };
    })
    .sort(function (a, b) {
      return b.d - a.d || a.r.pos - b.r.pos;
    });
  if (dati.length < 2) return "";

  var max = Math.max.apply(null, dati.map(function (x) { return Math.abs(x.d); }).concat([1]));
  var righeHtml = dati
    .map(function (x) {
      var w = Math.round((Math.abs(x.d) / max) * 100) + "%";
      var neg = "";
      var pos = "";
      if (x.d > 0) pos = '<span class="ui-bar" style="width:' + w + '"></span>+' + x.d;
      else if (x.d < 0) neg = "−" + Math.abs(x.d) + '<span class="ui-bar" style="width:' + w + '"></span>';
      else pos = '<span class="ui-muted">0</span>';
      return (
        '<div class="ui-diverge-row' + (unionIsGtv(x.r) ? " is-gtv" : "") + '">' +
        '<span class="ui-ellipsis">' + unionPilotaLink(x.r.nome) + "<small>P" + x.r.q + " → P" + x.r.pos + "</small></span>" +
        '<span class="ui-diverge-neg">' + neg + "</span>" +
        '<span class="ui-diverge-pos">' + pos + "</span>" +
        "</div>"
      );
    })
    .join("");

  return (
    '<div class="ui-subhead" style="margin-top: var(--ui-s6)">Qualifica → gara</div>' +
    '<div class="ui-legend"><span><i style="background: var(--ui-accent)"></i>posizioni guadagnate</span>' +
    '<span><i style="background: var(--ui-down)"></i>posizioni perse</span></div>' +
    righeHtml
  );
}

// -------------------------------------------------------------
// Classifiche generali: una scheda per lega, finestra sui GTV
// -------------------------------------------------------------
function renderUnionClassifiche() {
  var tabs = document.getElementById("union-cls-leghe");
  var body = document.getElementById("union-cls-body");
  var data = unionCls.data;

  if (tabs) {
    tabs.innerHTML = UNION_LEGHE.map(function (lega) {
      var piloti = (data.leghe[lega] && data.leghe[lega].piloti) || [];
      var gtv = piloti.filter(unionIsGtv).length;
      var attiva = lega === unionCls.lega;
      return (
        '<button type="button" role="tab" class="ui-tab ' + unionCategoryColorClass(lega) + '"' +
        ' aria-selected="' + attiva + '" data-lega="' + escapeHtml(lega) + '">' +
        escapeHtml(lega) + (gtv ? ' <span class="ui-tab-count">' + gtv + "</span>" : "") +
        "</button>"
      );
    }).join("");
    if (!tabs.dataset.ready) {
      tabs.dataset.ready = "1";
      tabs.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-lega]");
        if (!btn) return;
        unionCls.lega = btn.getAttribute("data-lega");
        renderUnionClassifiche();
      });
    }
  }

  if (!body.dataset.ready) {
    body.dataset.ready = "1";
    body.addEventListener("click", function (e) {
      if (e.target.closest("[data-pilota]")) return;
      var gap = e.target.closest("[data-gap]");
      if (gap) {
        var aperti = (unionCls.aperti[unionCls.lega] = unionCls.aperti[unionCls.lega] || {});
        aperti[gap.getAttribute("data-gap")] = true;
        renderUnionClassifiche();
        return;
      }
      if (e.target.closest("[data-tutti]")) {
        unionCls.tutti[unionCls.lega] = !unionCls.tutti[unionCls.lega];
        renderUnionClassifiche();
        return;
      }
      var riga = e.target.closest(".ui-row[aria-expanded]");
      if (riga) {
        riga.classList.toggle("is-open");
        riga.setAttribute("aria-expanded", riga.classList.contains("is-open"));
      }
    });
    body.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches(".ui-row[aria-expanded]")) {
        e.preventDefault();
        e.target.click();
      }
    });
  }

  body.innerHTML = unionClassificaLegaHtml(unionCls.lega);
  setUnionClsUpdate(data);
}

function unionMovimento(p) {
  var s = p.storico_pos || [];
  if (s.length < 2) return "";
  if (s[s.length - 2] === null || s[s.length - 1] === null) return "";
  var d = s[s.length - 2] - s[s.length - 1];
  if (d > 0) return ' <span class="ui-delta ui-delta--up" title="Guadagnate ' + d + ' posizioni">▲' + d + "</span>";
  if (d < 0) return ' <span class="ui-delta ui-delta--down" title="Perse ' + -d + ' posizioni">▼' + -d + "</span>";
  return ' <span class="ui-delta ui-delta--same" title="Stessa posizione">=</span>';
}

// Cella gara di una riga della classifica: piazzamento, segnalini e punti
function unionEsitoHtml(p, i, corsa) {
  var e = p.esiti && p.esiti[i];
  var punti = p.gare && p.gare[i];
  if (!corsa || !e) return "—";
  if (e.stato) return '<span title="' + escapeHtml(unionStato(e.stato)) + '">' + unionStatoSigla(e.stato) + "</span>";
  return (
    e.pos + "°" +
    (e.pole ? ' <span class="ui-dot ui-dot--pole" title="Pole position">P</span>' : "") +
    (e.fl ? ' <span class="ui-dot ui-dot--fl" title="Giro veloce"></span>' : "") +
    (punti === null || punti === undefined ? "" : ' <small class="ui-pts">' + punti + " pt</small>")
  );
}

function unionClsRowHtml(p) {
  var gtv = unionIsGtv(p);
  var gare = "";
  var pubblicate = (unionCls.data.meta && unionCls.data.meta.gare_pubblicate) || [];
  for (var i = 0; i < UNION_NUM_GARE; i++) {
    gare += "<span><small>G" + (i + 1) + "</small>" + unionEsitoHtml(p, i, pubblicate.indexOf(i + 1) !== -1) + "</span>";
  }
  return (
    '<li class="ui-row' + (gtv ? " is-gtv" : "") + '" tabindex="0" aria-expanded="false">' +
    '<span class="ui-pos">' + (p.pos || "") + "</span>" +
    '<span class="ui-muted">' + escapeHtml(p.team || "") + "</span>" +
    '<span class="ui-ellipsis' + (gtv ? " ui-strong" : "") + '">' + unionPilotaLink(p.nome) + (gtv ? unionMovimento(p) : "") + "</span>" +
    '<span class="ui-num">' + (p.punti || 0) + "</span>" +
    '<span class="ui-row-more">' + gare + "</span>" +
    "</li>"
  );
}

function unionClassificaLegaHtml(lega) {
  var piloti = ((unionCls.data.leghe[lega] || {}).piloti || []).slice().sort(function (a, b) {
    return (a.pos || 999) - (b.pos || 999);
  });
  if (!piloti.length) return unionState("Classifica non disponibile.", "empty");

  var nota = piloti.every(function (p) { return !p.punti; })
    ? '<p class="ui-text ui-muted" style="margin-top:0">Il Round 2 non è ancora iniziato: tutti a 0 punti, in ordine alfabetico.</p>'
    : "";
  var tutti = !!unionCls.tutti[lega];
  var aperti = unionCls.aperti[lega] || {};

  // Finestra: podio + ogni GTV con due piloti sopra e due sotto
  var visibile = piloti.map(function (p) { return tutti || (p.pos || 999) <= 3; });
  piloti.forEach(function (p, i) {
    if (!unionIsGtv(p)) return;
    for (var k = Math.max(0, i - 2); k <= Math.min(piloti.length - 1, i + 2); k++) visibile[k] = true;
  });

  var html = "";
  var i = 0;
  while (i < piloti.length) {
    if (visibile[i]) {
      html += unionClsRowHtml(piloti[i]);
      i++;
      continue;
    }
    var inizio = i;
    while (i < piloti.length && !visibile[i]) i++;
    if (aperti[inizio]) {
      for (var k = inizio; k < i; k++) html += unionClsRowHtml(piloti[k]);
    } else {
      var n = i - inizio;
      html +=
        '<li><button type="button" class="ui-row-gap" data-gap="' + inizio + '">Mostra altri ' +
        n + (n === 1 ? " pilota" : " piloti") + "</button></li>";
    }
  }

  return (
    nota +
    '<ol class="ui-list">' +
    '<li class="ui-row ui-row--head"><span>Pos</span><span>Team</span><span>Pilota</span><span class="ui-num">Punti</span></li>' +
    html +
    "</ol>" +
    '<div class="ui-btn-row ui-btn-row--center" style="margin-top: var(--ui-s4)">' +
    '<button type="button" class="ui-btn ui-btn--ghost" data-tutti>' +
    (tutti ? "Mostra solo la finestra sui GTV" : "Mostra tutti i " + piloti.length + " piloti") +
    "</button></div>"
  );
}

function setUnionClsUpdate(data) {
  var el = document.getElementById("union-cls-update");
  var iso = data && data.meta && data.meta.generated_at;
  if (!el || !iso) return;
  var d = new Date(iso);
  if (isNaN(d.getTime())) return;
  el.textContent =
    "Dati dal portale classifiche Union, aggiornati il " +
    d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  el.hidden = false;
}

// =============================================================
// SCHEDA PILOTA
// Ogni nome di pilota con data-pilota apre, nel pannello, la scheda con
// stats, ultimi risultati, lobby della prossima gara e grafici del suo
// campionato. Mette insieme le stesse fonti del resto della pagina:
// foglio piloti (CSV), lobby (data.json), classifiche (classifiche.json).
// =============================================================

// Nome cliccabile: ovunque compare un pilota si usa questo (o data-pilota).
// `alt` e' il secondo nome noto (PSN) per ritrovarlo nelle altre fonti.
function unionPilotaLink(nome, alt) {
  if (!nome) return "";
  return (
    '<span class="ui-plink" role="link" tabindex="0" data-pilota="' + escapeHtml(nome) + '"' +
    (alt ? ' data-pilota-alt="' + escapeHtml(alt) + '"' : "") + ">" +
    escapeHtml(nome) + "</span>"
  );
}

function initUnionPilotaLinks() {
  if (document.body.dataset.pilotaReady) return;
  document.body.dataset.pilotaReady = "1";
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-pilota]");
    if (el) openUnionPilota(el.getAttribute("data-pilota"), el.getAttribute("data-pilota-alt"), el);
  });
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-pilota][tabindex]")) {
      e.preventDefault();
      e.target.click();
    }
  });
}

// Righe del foglio piloti, scaricate una sola volta
var _unionCsvPromise = null;
function fetchUnionCsvRows() {
  if (!_unionCsvPromise) {
    var url = window.GTV_CONFIG && window.GTV_CONFIG.googleSheets ? window.GTV_CONFIG.googleSheets.piloti : "";
    _unionCsvPromise = (url ? fetch(url) : Promise.reject(new Error("Configurazione non trovata")))
      .then(function (r) {
        if (!r.ok) throw new Error("Errore HTTP " + r.status);
        return r.text();
      })
      .then(parseCsv)
      .catch(function (err) {
        _unionCsvPromise = null;
        throw err;
      });
  }
  return _unionCsvPromise;
}

function openUnionPilota(nome, alt, origine) {
  var panel = document.getElementById("union-panel");
  if (!panel || !nome) return;

  // Dal pannello di una lobby si passa alla scheda senza perdere il punto di ritorno
  var origin = panel.hidden ? origine || null : _unionPanelOrigin;
  showUnionSheet(escapeHtml(nome), "", unionState("Carico la scheda…", "loading"), origin);

  var vuoto = function () { return null; };
  Promise.all([
    fetchUnionLobbyData().catch(vuoto),
    fetchUnionClassifiche().catch(vuoto),
    fetchUnionCsvRows().catch(vuoto),
    fetchUnionAutoData().catch(vuoto),
  ]).then(function (r) {
    var p = unionPilotaProfilo([nome, alt], { lobby: r[0], cls: r[1], csv: r[2], auto: r[3] });
    var titolo = escapeHtml(p.nome) + (p.lega ? " " + unionCatBadge(p.lega) : "");
    var sub = [p.numero ? "#" + p.numero : "", p.team, p.psn && unionNorm(p.psn) !== unionNorm(p.nome) ? "PSN " + p.psn : ""]
      .filter(Boolean)
      .join(" · ");
    document.getElementById("union-panel-title").innerHTML = titolo;
    document.getElementById("union-panel-sub").textContent = sub;
    var body = document.getElementById("union-panel-body");
    body.innerHTML = unionPilotaHtml(p);
    body.scrollTop = 0;
  });
}

// Unisce tutte le informazioni note su un pilota (nome di gioco o PSN)
function unionPilotaProfilo(nomi, ctx) {
  var chiavi = nomi.filter(Boolean).map(unionNorm);
  var uguale = function (n) { return chiavi.indexOf(unionNorm(n)) !== -1; };
  var p = { nome: nomi[0], gareValide: [], pubblicate: [] };

  // Foglio piloti: numero, categoria, auto, PSN
  (ctx.csv || []).some(function (r) {
    var iscritto = ["x", "✓", "1"].indexOf(String(r[5] || "").trim().toLowerCase()) !== -1;
    if (!iscritto || !(uguale(r[1]) || uguale(r[0]))) return false;
    p.numero = String(r[2] || "").trim();
    p.psn = String(r[0] || "").trim();
    p.nome = String(r[1] || "").trim() || p.nome;
    p.catCsv = String(r[6] || "").trim();
    p.auto = String(r[7] || "").trim();
    p.marchio = String(r[8] || "").trim();
    return true;
  });
  if (!p.auto) {
    var rec = lookupUnionAuto(buildUnionAutoMap(ctx.auto), p.psn || nomi[1], p.nome);
    if (rec) {
      p.auto = rec.auto || "";
      p.marchio = p.marchio || rec.marchio || "";
    }
  }

  // Lobby della settimana (data.json)
  ((ctx.lobby && ctx.lobby.lobbies) || []).some(function (lb) {
    return lb.pilots.some(function (x) {
      if (!uguale(x.nome)) return false;
      p.lobby = lb;
      p.nome = p.nome || x.nome;
      p.team = p.team || x.team;
      p.numero = p.numero || x.matricola;
      return true;
    });
  });

  // Classifica generale (classifiche.json)
  var data = ctx.cls;
  if (data && data.leghe) {
    UNION_LEGHE.some(function (lega) {
      var lista = (data.leghe[lega] && data.leghe[lega].piloti) || [];
      var trovato = lista.filter(function (x) { return uguale(x.nome); })[0];
      if (!trovato) return false;
      p.lega = lega;
      p.entry = trovato;
      p.lista = lista;
      p.nome = trovato.nome;
      p.team = trovato.team || p.team;
      return true;
    });
    p.pubblicate = (data.meta && data.meta.gare_pubblicate) || [];
  }
  p.lega = p.lega || (p.lobby && p.lobby.category) || p.catCsv || "";

  // Risultati gara per gara
  p.pubblicate.forEach(function (g) {
    var gd = data.gare && data.gare[String(g)];
    var res = p.lega ? unionTrovaRisultato(gd, p.lega, p.nome) : null;
    var punti = p.entry && p.entry.gare ? p.entry.gare[g - 1] : null;
    p.gareValide.push({ g: g, res: res, punti: punti === undefined ? null : punti });
  });
  return p;
}

function unionPilotaHtml(p) {
  var html = unionPilotaInfoHtml(p);
  var giocate = p.gareValide.filter(function (x) { return x.res; });

  if (!p.pubblicate.length) {
    html +=
      '<p class="ui-text ui-muted">Statistiche e grafici dopo la prima gara.</p>';
  } else if (!giocate.length && !(p.entry && p.entry.punti)) {
    html += '<p class="ui-text ui-muted">Ancora nessun risultato.</p>';
  } else {
    html += unionPilotaStatsHtml(p, giocate);
    html += unionPilotaUltimiHtml(p);
    html += unionPilotaGraficiHtml(p, giocate);
  }
  html += unionPilotaLobbyHtml(p);
  return html;
}

function unionPilotaInfoHtml(p) {
  if (!p.marchio && !p.auto && !p.lobby) return "";
  return (
    '<div class="ui-pcar">' +
    (p.marchio ? brandLogoHtml(p.marchio).replace('class="ui-pilot-brand"', 'class="ui-pcar-logo"') : "") +
    (p.auto ? "<span>" + escapeHtml(p.auto) + "</span>" : "") +
    (p.lobby ? '<span class="ui-badge ui-badge--accent ui-pcar-lobby">Lobby ' + escapeHtml(p.lobby.name) + "</span>" : "") +
    "</div>"
  );
}

function unionTile(num, label, nota) {
  return (
    '<div class="ui-ptile"><div class="ui-ptile-num">' + num + "</div>" +
    '<div class="ui-ptile-label">' + label + (nota ? " <small>" + nota + "</small>" : "") + "</div></div>"
  );
}

function unionMedia(v) {
  return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
}

function unionSegno(n) {
  return n > 0 ? "+" + n : n < 0 ? "−" + Math.abs(n) : "0";
}

function unionPilotaStatsHtml(p, giocate) {
  var pos = giocate.map(function (x) { return x.res.riga.pos; });
  var pole = giocate.filter(function (x) {
    return x.res.lb.pole && unionNorm(x.res.lb.pole) === unionNorm(p.nome);
  }).length;
  var fl = giocate.filter(function (x) {
    return x.res.lb.giro_veloce && unionNorm(x.res.lb.giro_veloce) === unionNorm(p.nome);
  }).length;
  var vittorie = pos.filter(function (n) { return n === 1; }).length;
  var podi = pos.filter(function (n) { return n <= 3; }).length;
  var media = unionMedia(pos);
  var e = p.entry;

  var t = "";
  if (e && e.pos) t += unionTile("P" + e.pos, "Classifica");
  if (e) t += unionTile(e.punti || 0, "Punti");
  t += unionTile(giocate.length + "/" + p.pubblicate.length, "Gare");
  if (pos.length) {
    t += unionTile("P" + Math.min.apply(null, pos), "Miglior arrivo");
    t += unionTile(media.toFixed(1).replace(".", ","), "Arrivo medio");
    t += unionTile(podi, "Podi", vittorie ? vittorie + (vittorie === 1 ? " vittoria" : " vittorie") : "");
  }
  if (pole || fl) t += unionTile(pole + " · " + fl, "Pole · giri veloci");

  return '<div class="ui-subhead">Statistiche</div><div class="ui-ptiles">' + t + "</div>";
}

function unionPilotaUltimiHtml(p) {
  var righe = p.gareValide
    .slice()
    .reverse()
    .map(function (x) {
      var pista = UNION_PISTE[x.g - 1];
      if (!x.res) {
        return (
          '<li class="ui-row"><span class="ui-pos">G' + x.g + '</span><span class="ui-ellipsis">' +
          escapeHtml(pista) + '</span><span class="ui-muted">non classificato</span><span class="ui-num">—</span></li>'
        );
      }
      var r = x.res.riga;
      var q = r.q ? "Q" + r.q + " · " : "";
      return (
        '<li class="ui-row' + (r.pos <= 3 ? " is-gtv" : "") + '">' +
        '<span class="ui-pos">G' + x.g + "</span>" +
        '<span class="ui-ellipsis"><span class="ui-strong">P' + r.pos + "</span> " +
        '<span class="ui-muted">' + q + escapeHtml(pista) + ", " + escapeHtml(x.res.lobby) + "</span> " +
        unionDots(x.res.lb, p.nome) + "</span>" +
        '<span class="ui-muted">' + escapeHtml(r.distacco || "") + "</span>" +
        '<span class="ui-num">' + (x.punti === null ? "—" : x.punti + " pt") + "</span>" +
        "</li>"
      );
    })
    .join("");
  return (
    '<div class="ui-subhead">Ultimi risultati</div>' +
    '<ol class="ui-list" style="--ui-row-cols: 32px 1fr auto 56px">' + righe + "</ol>"
  );
}

// ---------- Grafici (SVG in linea, senza librerie) ----------

// Grafico a linee su G1–G5. `serie`: [{valori, classe, etichette}]; l'ultima
// e' quella del pilota. `invert`: il valore piu' basso sta in alto (posizioni).
function unionLineChart(o) {
  var W = 400, H = 190, pl = 30, pr = 18, pt = 18, pb = 26;
  var n = UNION_NUM_GARE;
  var hi = Math.max(o.max, o.min + 1);
  var X = function (i) { return pl + (i * (W - pl - pr)) / (n - 1); };
  var Y = function (v) {
    var t = (v - o.min) / (hi - o.min);
    return pt + (o.invert ? t : 1 - t) * (H - pt - pb);
  };

  var svg = '<svg class="ui-chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + escapeHtml(o.titolo) + '">';
  o.ticks.forEach(function (v) {
    svg +=
      '<line class="ui-ch-grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/>' +
      '<text class="ui-ch-axis" x="' + (pl - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + (o.fmtTick || String)(v) + "</text>";
  });
  for (var i = 0; i < n; i++) {
    svg += '<text class="ui-ch-axis" x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="middle">G' + (i + 1) + "</text>";
  }
  o.serie.forEach(function (s) {
    var d = "";
    var prev = false;
    s.valori.forEach(function (v, i) {
      if (v === null || v === undefined) { prev = false; return; }
      d += (prev ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1);
      prev = true;
    });
    svg += '<path class="ui-ch-line ' + s.classe + '" d="' + d + '"/>';
    s.valori.forEach(function (v, i) {
      if (v === null || v === undefined) return;
      svg += '<circle class="ui-ch-dot ' + s.classe + '" cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="' + (s.etichette ? 4.5 : 2.5) + '"/>';
      if (s.etichette) {
        svg += '<text class="ui-ch-val" x="' + X(i).toFixed(1) + '" y="' + (Y(v) - 9).toFixed(1) + '" text-anchor="middle">' + (o.fmtVal || String)(v) + "</text>";
      }
    });
  });
  return svg + "</svg>";
}

function unionTicks(max, quanti) {
  var passo = Math.max(1, Math.ceil(max / quanti));
  var t = [];
  for (var v = 0; v <= max; v += passo) t.push(v);
  return t;
}

function unionChartBox(titolo, legenda, corpo) {
  return (
    '<div class="ui-chart-box"><div class="ui-chart-title">' + titolo + "</div>" +
    (legenda ? '<div class="ui-legend">' + legenda + "</div>" : "") + corpo + "</div>"
  );
}

function unionPilotaGraficiHtml(p, giocate) {
  var out = "";
  var n = UNION_NUM_GARE;
  var perGara = function (fn) {
    var v = [];
    for (var i = 0; i < n; i++) v.push(null);
    p.gareValide.forEach(function (x) { v[x.g - 1] = fn(x); });
    return v;
  };

  // 1. Piazzamenti di gara
  var arrivi = perGara(function (x) { return x.res ? x.res.riga.pos : null; });
  if (arrivi.some(function (v) { return v !== null; })) {
    var maxPos = Math.max.apply(null, arrivi.concat(
      p.gareValide.map(function (x) { return x.res ? (x.res.lb.classifica || []).length : 0; })
    ).filter(function (v) { return v !== null; }));
    maxPos = Math.max(maxPos, 4);
    var tickPos = [1, Math.round((1 + maxPos) / 2), maxPos].filter(function (v, i, a) { return a.indexOf(v) === i; });
    out += unionChartBox(
      "Piazzamenti di gara",
      "",
      unionLineChart({
        titolo: "Piazzamenti di gara", serie: [{ valori: arrivi, classe: "is-main", etichette: true }],
        invert: true, min: 1, max: maxPos, ticks: tickPos, fmtTick: function (v) { return "P" + v; },
        fmtVal: function (v) { return "P" + v; },
      })
    );
  }

  // 2. Andamento in classifica
  var storico = (p.entry && p.entry.storico_pos) || [];
  if (storico.length && p.lista) {
    var maxLega = p.lista.length;
    var serie = [];
    var ultimaGara = p.pubblicate.length ? Math.max.apply(null, p.pubblicate) : 0;
    for (var i = 0; i < n; i++) serie.push(i < ultimaGara && storico[i] !== undefined ? storico[i] : null);
    if (ultimaGara && p.entry.pos) serie[ultimaGara - 1] = p.entry.pos; // l'ultima e' la classifica vera
    var tickCls = [1, Math.round(maxLega / 2), maxLega].filter(function (v, i, a) { return a.indexOf(v) === i; });
    out += unionChartBox(
      "Posizione in classifica",
      "",
      unionLineChart({
        titolo: "Andamento in classifica", serie: [{ valori: serie, classe: "is-main", etichette: true }],
        invert: true, min: 1, max: maxLega, ticks: tickCls, fmtTick: function (v) { return "P" + v; },
        fmtVal: function (v) { return "P" + v; },
      })
    );
  }

  // 3. Punti progressivi contro leader e media della lega
  if (p.entry && p.lista && p.pubblicate.length) {
    var ultima = Math.max.apply(null, p.pubblicate);
    var cumul = function (gare) {
      var tot = 0;
      var v = [];
      for (var i = 0; i < n; i++) {
        if (i >= ultima) { v.push(null); continue; }
        tot += (gare && gare[i]) || 0;
        v.push(tot);
      }
      return v;
    };
    var suoi = cumul(p.entry.gare);
    var leader = p.lista.slice().sort(function (a, b) { return (b.punti || 0) - (a.punti || 0); })[0];
    var vLeader = cumul(leader.gare);
    var vMedia = suoi.map(function (_, i) {
      if (i >= ultima) return null;
      return unionMedia(p.lista.map(function (x) { return cumul(x.gare)[i]; }));
    });
    var maxPt = Math.max.apply(null, suoi.concat(vLeader).filter(function (v) { return v !== null; }).concat([1]));
    var tickPt = unionTicks(maxPt, 4);
    out += unionChartBox(
      "Punti progressivi",
      '<span><i style="background: var(--ui-accent)"></i>' + escapeHtml(p.nome) + "</span>" +
        '<span><i style="background: var(--ui-text-2)"></i>leader' + (leader.nome === p.nome ? " (è lui)" : "") + "</span>" +
        '<span><i style="background: var(--ui-down)"></i>media della lega</span>',
      unionLineChart({
        titolo: "Punti progressivi",
        serie: [
          { valori: vMedia, classe: "is-avg" },
          { valori: vLeader, classe: "is-ref" },
          { valori: suoi, classe: "is-main", etichette: true },
        ],
        invert: false, min: 0, max: tickPt[tickPt.length - 1], ticks: tickPt,
        fmtVal: function (v) { return Math.round(v); },
      })
    );
  }

  // 4. Qualifica -> gara
  var conQ = giocate.filter(function (x) { return x.res.riga.q; });
  if (conQ.length) out += unionChartBox("Qualifica → gara", "", unionQtoGDumbbell(conQ));

  // 5. Distribuzione degli arrivi
  if (giocate.length > 1) out += unionChartBox("Come chiude le gare", "", unionArriviBar(giocate));

  // 6. Avversari vicini in classifica
  out += unionVicini(p);

  return '<div class="ui-subhead" style="margin-top: var(--ui-s6)">Campionato</div>' + out;
}

// Una riga per gara: pallino vuoto = qualifica, pieno = arrivo
function unionQtoGDumbbell(gare) {
  var W = 400, rh = 30, pl = 30, pr = 18, pt = 10;
  var maxPos = 4;
  gare.forEach(function (x) { maxPos = Math.max(maxPos, x.res.riga.q, x.res.riga.pos); });
  var X = function (v) { return pl + ((v - 1) * (W - pl - pr)) / (maxPos - 1); };
  var H = pt + gare.length * rh + 22;
  var svg = '<svg class="ui-chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Qualifica e gara">';
  var passo = Math.max(1, Math.ceil((maxPos - 1) / 5));
  for (var v = 1; v <= maxPos; v += passo) {
    svg +=
      '<line class="ui-ch-grid" x1="' + X(v) + '" x2="' + X(v) + '" y1="' + pt + '" y2="' + (H - 22) + '"/>' +
      '<text class="ui-ch-axis" x="' + X(v) + '" y="' + (H - 6) + '" text-anchor="middle">P' + v + "</text>";
  }
  gare.forEach(function (x, i) {
    var y = pt + i * rh + rh / 2;
    var q = x.res.riga.q, g = x.res.riga.pos, d = q - g;
    var cls = d > 0 ? "is-up" : d < 0 ? "is-down" : "is-same";
    svg +=
      '<text class="ui-ch-axis" x="0" y="' + (y + 4) + '">G' + x.g + "</text>" +
      '<line class="ui-ch-link ' + cls + '" x1="' + X(q) + '" x2="' + X(g) + '" y1="' + y + '" y2="' + y + '"/>' +
      '<circle class="ui-ch-hollow" cx="' + X(q) + '" cy="' + y + '" r="5"/>' +
      '<circle class="ui-ch-fill ' + cls + '" cx="' + X(g) + '" cy="' + y + '" r="5"/>';
  });
  return (
    '<div class="ui-legend"><span><span class="ui-ch-key is-hollow"></span>qualifica</span>' +
    '<span><span class="ui-ch-key"></span>arrivo</span>' +
    '<span><i style="background: var(--ui-accent)"></i>posizioni guadagnate</span>' +
    '<span><i style="background: var(--ui-down)"></i>perse</span></div>' + svg + "</svg>"
  );
}

function unionArriviBar(giocate) {
  var pos = giocate.map(function (x) { return x.res.riga.pos; });
  var fasce = [
    ["Vittorie", pos.filter(function (n) { return n === 1; }).length, "is-1"],
    ["Podi", pos.filter(function (n) { return n >= 2 && n <= 3; }).length, "is-2"],
    ["Top 5", pos.filter(function (n) { return n >= 4 && n <= 5; }).length, "is-3"],
    ["Top 10", pos.filter(function (n) { return n >= 6 && n <= 10; }).length, "is-4"],
    ["Oltre", pos.filter(function (n) { return n > 10; }).length, "is-5"],
  ].filter(function (f) { return f[1]; });
  return (
    '<div class="ui-seg-bar">' +
    fasce.map(function (f) {
      return '<span class="' + f[2] + '" style="flex:' + f[1] + '" title="' + f[0] + ": " + f[1] + '">' + f[1] + "</span>";
    }).join("") +
    '</div><div class="ui-legend" style="margin: var(--ui-s2) 0 0">' +
    fasce.map(function (f) { return '<span><i class="ui-seg-' + f[2] + '"></i>' + f[0] + "</span>"; }).join("") +
    "</div>"
  );
}

// Piloti vicini in classifica, con il distacco in punti
function unionVicini(p) {
  if (!p.entry || !p.lista || !p.lista.some(function (x) { return x.punti; })) return "";
  var lista = p.lista.slice().sort(function (a, b) { return (a.pos || 999) - (b.pos || 999); });
  var i = lista.findIndex(function (x) { return x.nome === p.entry.nome; });
  var righe = lista.slice(Math.max(0, i - 3), i + 4).map(function (x) {
    var mio = x.nome === p.entry.nome;
    var d = (x.punti || 0) - (p.entry.punti || 0);
    return (
      '<li class="ui-row' + (mio ? " is-gtv" : "") + '">' +
      '<span class="ui-pos">' + x.pos + "</span>" +
      '<span class="ui-muted">' + escapeHtml(x.team || "") + "</span>" +
      '<span class="ui-ellipsis' + (mio ? " ui-strong" : "") + '">' + (mio ? escapeHtml(x.nome) : unionPilotaLink(x.nome)) + "</span>" +
      '<span class="ui-num">' + (x.punti || 0) + ' <small class="ui-muted">' + (mio ? "" : unionSegno(d)) + "</small></span>" +
      "</li>"
    );
  }).join("");
  return unionChartBox(
    "Nei dintorni in classifica",
    "",
    '<ol class="ui-list">' + righe + "</ol>"
  );
}

// Lobby della prossima gara: giorno, ora, host, live e schieramento
function unionPilotaLobbyHtml(p) {
  var prox = unionProssimaGara();
  var testa = '<div class="ui-subhead" style="margin-top: var(--ui-s6)">Prossima gara</div>';
  var gara = prox
    ? '<p class="ui-text" style="margin-top:0"><strong>' + escapeHtml(prox.round) + ", " + escapeHtml(prox.pista) +
      '</strong> <span class="ui-muted">' + escapeHtml(prox.data) + "</span></p>"
    : "";
  var lb = p.lobby;
  if (!lb) {
    return testa + gara + '<p class="ui-text ui-muted">Lobby non ancora assegnata.</p>';
  }
  var giorno = UNION_DAY_LABEL[String(lb.day || "").toUpperCase()] || lb.day;
  var host = lb.host
    ? '<a href="https://profile.playstation.com/' + encodeURIComponent(lb.host) + '/add" target="_blank" rel="noopener">' + escapeHtml(lb.host) + "</a>"
    : "—";
  var live = lb.url
    ? '<a href="' + escapeHtml(lb.url) + '" target="_blank" rel="noopener">' + escapeHtml(lb.live || "Canale live") + "</a>"
    : "—";
  var lista = lb.pilots.map(function (x) {
    var mio = unionNorm(x.nome) === unionNorm(p.nome);
    var gtv = String(x.team || "").trim().toUpperCase() === "GTV";
    return (
      '<li class="ui-row' + (gtv ? " is-gtv" : "") + '">' +
      '<span class="ui-pos">' + escapeHtml(x.pos) + "</span>" +
      '<span class="ui-muted">' + escapeHtml(x.team) + "</span>" +
      '<span class="ui-ellipsis' + (mio || gtv ? " ui-strong" : "") + '">' + (mio ? escapeHtml(x.nome) + " ◂" : unionPilotaLink(x.nome)) + "</span>" +
      "</li>"
    );
  }).join("");
  return (
    testa + gara +
    '<div class="ui-lobbyhead"><span class="ui-strong">Lobby ' + escapeHtml(lb.name) + "</span> " + unionCatBadge(lb.category) + "</div>" +
    '<dl class="ui-kv" style="margin: var(--ui-s2) 0 var(--ui-s3)">' +
    "<div><dt>Giorno</dt><dd>" + escapeHtml(giorno) + "</dd></div>" +
    "<div><dt>Ora</dt><dd>" + escapeHtml(unionOra(lb.time)) + "</dd></div>" +
    "<div><dt>Host</dt><dd>" + host + "</dd></div>" +
    "<div><dt>Live</dt><dd>" + live + "</dd></div></dl>" +
    '<ol class="ui-list" style="--ui-row-cols: 32px 64px 1fr">' + lista + "</ol>"
  );
}

// Prossima gara secondo il calendario della pagina (settimana non ancora finita)
function unionProssimaGara() {
  var oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  var trovata = null;
  Array.prototype.some.call(document.querySelectorAll("#union-calendario .ui-race"), function (card) {
    var al = new Date(card.getAttribute("data-al") + "T23:59:59");
    if (isNaN(al) || al < oggi) return false;
    var testo = function (sel) {
      var el = card.querySelector(sel);
      return el ? el.textContent.replace(/\s+/g, " ").replace(/\b(Prossima|In corso)\b/, "").trim() : "";
    };
    trovata = { round: testo(".ui-race-round"), pista: testo(".ui-race-track"), data: testo(".ui-race-date") };
    return true;
  });
  return trovata;
}

// =============================================================
// REPORT DG: reclami e penalita' della Direzione Gara
// Fonte: un foglio Google per gara (GTV_CONFIG.unionReportDG), le
// risposte al modulo reclami con l'esito nella colonna PENALITA'.
// Del foglio si usano solo richiedente, indagato, lega, lobby, note
// ed esito: i voti dei singoli giudici e i video restano fuori.
// In cima i reclami fatti e ricevuti dai GTV, sotto tutti gli altri.
// =============================================================
var unionDG = {
  gara: null,
  cache: {}, // gara -> Promise dei reclami
};

function unionDGUrls() {
  return (window.GTV_CONFIG && window.GTV_CONFIG.unionReportDG) || {};
}

// CSV con campi tra virgolette (le note contengono virgole e a capo)
function parseCsvQuoted(text) {
  var rows = [];
  var row = [];
  var cell = "";
  var inQuotes = false;
  text = String(text || "").replace(/^﻿/, "");
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(function (r) {
    return r.some(function (x) { return x.trim() !== ""; });
  });
}

// Esito dalla colonna PENALITA': numero = secondi, "RIFIUTATO, motivo" = respinto
function unionDGEsito(testo) {
  var t = String(testo || "").trim();
  if (/^\d+$/.test(t)) {
    var sec = parseInt(t, 10);
    return sec > 0
      ? { tipo: "pen", sec: sec, label: "+" + sec + " s" }
      : { tipo: "zero", sec: 0, label: "Nessuna penalità" };
  }
  var m = t.match(/^(rifiutat|respint)[oa]?\s*[,:\-–]?\s*(.*)$/i);
  if (m) {
    var motivo = m[2].trim();
    return { tipo: "respinto", sec: 0, label: "Respinto", motivo: motivo ? motivo.charAt(0).toUpperCase() + motivo.slice(1) : "" };
  }
  if (!t) return { tipo: "attesa", sec: 0, label: "In valutazione" };
  return { tipo: "altro", sec: 0, label: t };
}

// Esito delle segnalazioni degli host: sanzioni sulla gara successiva
function unionDGHostEsito(testo, gara) {
  var t = String(testo || "").trim();
  var prossima = gara < UNION_NUM_GARE ? "Gara " + (gara + 1) + ", " + UNION_PISTE[gara] : "prossima gara";
  var m;
  if (!t) return { tipo: "attesa", peso: 3, label: "In valutazione" };
  if (/null|annullat/i.test(t)) return { tipo: "nullo", peso: 9, label: "Nulla" };
  if (/squalific/i.test(t)) return { tipo: "squalifica", peso: 0, label: "Squalifica", sub: "Salta " + prossima };
  if ((m = t.match(/(\d+)\s*posizion/i))) {
    return { tipo: "griglia", peso: 1, label: "−" + m[1] + " posizioni", sub: "In griglia a " + prossima };
  }
  if (/^\d+$/.test(t)) return { tipo: "pen", peso: 2, label: "+" + t + " s" };
  return { tipo: "altro", peso: 2, label: t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() };
}

// Un foglio DG (reclami o host) -> righe con i soli campi pubblicati
function fetchUnionDGSheet(url) {
  return fetch(url)
    .then(function (r) {
      if (!r.ok) throw new Error("Errore HTTP " + r.status);
      return r.text();
    })
    .then(function (text) {
      var rows = parseCsvQuoted(text);
      var head = (rows.shift() || []).map(function (h) { return h.trim().toUpperCase(); });
      function col(re) {
        for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i;
        return -1;
      }
      var c = {
        teamR: col(/^TAG TEAM RICHIEDENTE/),
        nomeR: col(/^ID GT7 RICHIEDENTE/),
        teamI: col(/^TAG TEAM INDAGATO/),
        nomeI: col(/^ID GT7 INDAGATO/),
        lega: col(/^RANK/),
        lobby: col(/LOBBY/),
        note: col(/^NOTE/),
        esito: col(/^PENALIT/),
      };
      function v(r, k) {
        return c[k] === -1 ? "" : String(r[c[k]] || "").trim();
      }
      return rows.map(function (r) {
        return {
          teamR: v(r, "teamR").toUpperCase(),
          nomeR: v(r, "nomeR"),
          teamI: v(r, "teamI").toUpperCase(),
          nomeI: v(r, "nomeI"),
          lega: v(r, "lega").toUpperCase().replace(/\s+/g, " "),
          lobby: v(r, "lobby").toUpperCase().replace(/\s+/g, ""),
          note: v(r, "note"),
          esitoRaw: v(r, "esito"),
        };
      }).filter(function (x) {
        return x.nomeR || x.nomeI;
      });
    });
}

// Ricorsi: ogni riga rimanda a un reclamo con il numero di riga del foglio
// reclami (RIGA RELAMO, intestazione = riga 1). Se respinti la penalita'
// raddoppia; PENALITA' FINALE e' quella definitiva.
function fetchUnionDGRicorsi(url) {
  return fetch(url)
    .then(function (r) {
      if (!r.ok) throw new Error("Errore HTTP " + r.status);
      return r.text();
    })
    .then(function (text) {
      var rows = parseCsvQuoted(text);
      var head = (rows.shift() || []).map(function (h) { return h.trim().toUpperCase(); });
      function col(re) {
        for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i;
        return -1;
      }
      var c = {
        riga: col(/^RIGA/),
        nome: col(/RICHIEDENTE RICORSO/),
        valutazione: col(/^VALUTAZIONE/),
        finale: col(/FINALE/),
      };
      function v(r, k) {
        return c[k] === -1 ? "" : String(r[c[k]] || "").trim();
      }
      return rows.map(function (r) {
        var val = v(r, "valutazione");
        var finale = parseInt(v(r, "finale"), 10);
        return {
          riga: parseInt(v(r, "riga"), 10),
          nome: v(r, "nome"),
          valutazione: val,
          finale: isNaN(finale) ? null : finale,
          esito: /respint/i.test(val) ? "respinto" : /accolt/i.test(val) ? "accolto" : "attesa",
        };
      }).filter(function (x) { return x.nome || !isNaN(x.riga); });
    });
}

// Aggancia i ricorsi ai reclami e aggiorna l'esito del reclamo con la penalita' finale
function unionDGApplicaRicorsi(reclami, ricorsi) {
  var trovati = [];
  (ricorsi || []).forEach(function (rc) {
    var x = reclami[rc.riga - 2]; // riga 2 del foglio = primo reclamo
    if (!x || (rc.nome && unionNorm(rc.nome) !== unionNorm(x.nomeI))) {
      x = reclami.filter(function (y) { return !y.ricorso && unionNorm(y.nomeI) === unionNorm(rc.nome); })[0];
    }
    if (!x) return;
    var prima = x.esito;
    rc.reclamo = x;
    rc.prima = prima.tipo === "pen" ? prima.sec : null;
    x.ricorso = rc;
    if (prima.tipo === "pen" && rc.finale !== null && rc.finale !== prima.sec) {
      x.esito = { tipo: "pen", sec: rc.finale, label: "+" + rc.finale + " s",
        sub: rc.esito === "respinto" ? "Ricorso respinto" : "Ricorso accolto", sub2: "era +" + prima.sec + " s" };
    } else if (rc.esito === "respinto") {
      prima.sub = "Ricorso respinto";
    }
    trovati.push(rc);
  });
  return trovati;
}

// Reclami e segnalazioni host di una gara. Le segnalazioni sono facoltative:
// se il foglio manca o non si carica restano null e il blocco lo dice.
function fetchUnionReportDG(gara) {
  if (!unionDG.cache[gara]) {
    var urls = unionDGUrls()[gara] || {};
    unionDG.cache[gara] = Promise.all([
      fetchUnionDGSheet(urls.reclami),
      urls.host
        ? fetchUnionDGSheet(urls.host).catch(function (err) {
            console.warn("Segnalazioni host non disponibili:", err);
            return null;
          })
        : Promise.resolve(null),
      urls.ricorsi
        ? fetchUnionDGRicorsi(urls.ricorsi).catch(function (err) {
            console.warn("Ricorsi non disponibili:", err);
            return null;
          })
        : Promise.resolve(null),
    ])
      .then(function (res) {
        res[0].forEach(function (x) { x.esito = unionDGEsito(x.esitoRaw); });
        (res[1] || []).forEach(function (x) { x.esito = unionDGHostEsito(x.esitoRaw, gara); });
        var ricorsi = unionDGApplicaRicorsi(res[0], res[2]);
        return { reclami: res[0], host: res[1], ricorsi: ricorsi };
      })
      .catch(function (err) {
        delete unionDG.cache[gara];
        throw err;
      });
  }
  return unionDG.cache[gara];
}

function loadUnionReportDG() {
  var body = document.getElementById("union-dg-body");
  var sel = document.getElementById("union-dg-gare");
  if (!body) return;
  var gare = Object.keys(unionDGUrls())
    .map(Number)
    .filter(function (g) { return g >= 1; })
    .sort(function (a, b) { return a - b; });
  unionDG.gara = gare.length ? gare[gare.length - 1] : null;

  body.addEventListener("click", function (e) {
    var btn = e.target.closest(".ui-dg-more");
    if (!btn) return;
    var p = btn.parentNode;
    p.textContent = p.getAttribute("data-dg-full");
    p.removeAttribute("data-dg-full");
  });

  if (sel && !sel.dataset.ready) {
    sel.dataset.ready = "1";
    sel.addEventListener("click", function (e) {
      var b = e.target.closest("[data-gara]");
      if (!b) return;
      unionDG.gara = Number(b.getAttribute("data-gara"));
      renderUnionReportDG();
    });
  }
  renderUnionReportDG();
}

function renderUnionReportDG() {
  var body = document.getElementById("union-dg-body");
  var sel = document.getElementById("union-dg-gare");
  var sottotitolo = document.getElementById("union-dg-subtitle");
  var urls = unionDGUrls();
  var gara = unionDG.gara;

  if (sel) {
    var bottoni = "";
    for (var g = 1; g <= UNION_NUM_GARE; g++) {
      var ok = !!urls[g];
      bottoni +=
        '<button type="button" class="ui-seg-btn"' +
        (ok ? ' data-gara="' + g + '"' : " disabled") +
        ' aria-pressed="' + (g === gara) + '"' +
        ' title="' + escapeHtml(UNION_PISTE[g - 1] + (ok ? "" : " (report non ancora pubblicato)")) + '">G' + g + "</button>";
    }
    sel.innerHTML = bottoni;
  }

  if (!gara) {
    if (sottotitolo) sottotitolo.textContent = "Direzione Gara";
    body.innerHTML = unionState("Il report della Direzione Gara comparirà qui dopo la prima gara.", "empty");
    return;
  }

  if (sottotitolo) sottotitolo.textContent = "Gara " + gara + ", " + UNION_PISTE[gara - 1];
  body.innerHTML = unionState("Caricamento report…", "loading");

  Promise.all([
    fetchUnionReportDG(gara),
    fetchUnionLobbyData().catch(function () { return null; }),
  ])
    .then(function (res) {
      if (unionDG.gara !== gara) return; // nel frattempo e' stata scelta un'altra gara
      body.innerHTML = unionReportDGHtml(res[0].reclami, res[0].host, res[1], res[0].ricorsi);
    })
    .catch(function (err) {
      console.error("Errore caricamento report DG:", err);
      if (unionDG.gara === gara) body.innerHTML = unionState("Impossibile caricare il report della Direzione Gara.", "error");
    });
}

// GTV: tag team GTV oppure nome presente tra i GTV schierati nelle lobby
// (il tag nel modulo lo scrive a mano chi fa il reclamo)
function unionDGGtvSet(lobbyData) {
  var set = {};
  ((lobbyData && lobbyData.lobbies) || []).forEach(function (lb) {
    (lb.pilots || []).forEach(function (p) {
      if (unionIsGtv(p)) set[unionNorm(p.nome)] = true;
    });
  });
  return set;
}

function unionDGLobbyNum(lobby) {
  var n = parseInt(String(lobby || "").replace(/\D/g, ""), 10);
  return isNaN(n) ? 999 : n;
}

function unionDGEsitoHtml(e) {
  var cls = "ui-dg-esito ui-dg-esito--" + e.tipo;
  return '<span class="' + cls + '">' + escapeHtml(e.label) + "</span>";
}

function unionDGCardHtml(x, lato) {
  var e = x.esito;
  var dettaglio = e.tipo === "respinto" && e.motivo ? e.motivo : "";
  return (
    '<article class="ui-card ui-dg-card' + (e.tipo === "pen" ? " is-pen" : "") + '">' +
    '<div class="ui-dg-card-top">' +
    '<span class="ui-dg-sanz">' + unionDGEsitoHtml(e) + (e.sub ? "<small>" + escapeHtml(e.sub + (e.sub2 ? " · " + e.sub2 : "")) + "</small>" : "") + "</span>" +
    '<span class="ui-dg-where">' + unionCatBadge(x.lega) + '<span class="ui-badge">' + escapeHtml(x.lobby || "—") + "</span></span>" +
    "</div>" +
    '<div class="ui-dg-vs">' +
    '<div><span class="ui-dg-role">' + (lato === "fatto" ? "Reclamo di" : "Richiedente") + "</span>" +
    '<span class="' + (x.gtvR ? "ui-dg-name is-gtv" : "ui-dg-name") + '">' + escapeHtml(x.nomeR) + "</span>" +
    '<span class="ui-dg-team">' + escapeHtml(x.teamR) + "</span></div>" +
    '<div><span class="ui-dg-role">' + (lato === "fatto" ? "Contro" : "Indagato") + "</span>" +
    '<span class="' + (x.gtvI ? "ui-dg-name is-gtv" : "ui-dg-name") + '">' + escapeHtml(x.nomeI) + "</span>" +
    '<span class="ui-dg-team">' + escapeHtml(x.teamI) + "</span></div>" +
    "</div>" +
    (dettaglio ? '<p class="ui-dg-note"><span class="ui-muted">Motivo:</span> ' + escapeHtml(dettaglio) + "</p>" : "") +
    unionDGNoteHtml(x.note, true) +
    "</article>"
  );
}

// Il tag team nei moduli lo scrive a mano chi compila e a volte e' sbagliato
// (es. il nome di un altro pilota). Se il pilota e' schierato in quella
// lobby, il team vero e' quello dello schieramento.
function unionDGCorreggiTeam(lista, lobbyData) {
  var teamPerLobby = {};
  ((lobbyData && lobbyData.lobbies) || []).forEach(function (lb) {
    (lb.pilots || []).forEach(function (p) {
      teamPerLobby[String(lb.name || "").toUpperCase().replace(/\s+/g, "") + "|" + unionNorm(p.nome)] =
        String(p.team || "").trim().toUpperCase();
    });
  });
  lista.forEach(function (x) {
    var tr = teamPerLobby[x.lobby + "|" + unionNorm(x.nomeR)];
    var ti = teamPerLobby[x.lobby + "|" + unionNorm(x.nomeI)];
    if (tr) x.teamR = tr;
    if (ti) x.teamI = ti;
  });
}

function unionReportDGHtml(reclami, host, lobbyData, ricorsi) {
  var gtvSet = unionDGGtvSet(lobbyData);
  unionDGCorreggiTeam(reclami.concat(host || []), lobbyData);
  reclami.concat(host || []).forEach(function (x) {
    x.gtvR = x.teamR === "GTV" || !!gtvSet[unionNorm(x.nomeR)];
    x.gtvI = x.teamI === "GTV" || !!gtvSet[unionNorm(x.nomeI)];
  });
  var ordine = function (a, b) {
    return unionTierIndex(a.lega) - unionTierIndex(b.lega) || unionDGLobbyNum(a.lobby) - unionDGLobbyNum(b.lobby);
  };
  reclami.sort(ordine);

  var fatti = reclami.filter(function (x) { return x.gtvR; });
  var ricevuti = reclami.filter(function (x) { return x.gtvI; });

  function gruppo(titolo, lista, lato, vuoto) {
    return (
      '<div class="ui-subhead">' + escapeHtml(titolo) + ' <span class="ui-muted">' + lista.length + "</span></div>" +
      (lista.length
        ? '<div class="ui-grid ui-dg-grid">' + lista.map(function (x) { return unionDGCardHtml(x, lato); }).join("") + "</div>"
        : '<p class="ui-dg-empty">' + escapeHtml(vuoto) + "</p>")
    );
  }

  var html =
    '<div class="ui-dg-gtv">' +
    gruppo("Reclami fatti dai GTV", fatti, "fatto", "Nessun reclamo presentato da piloti GTV.") +
    gruppo("Reclami ricevuti dai GTV", ricevuti, "ricevuto", "Nessun pilota GTV sotto indagine. Pulito così.");
  if (host) {
    var hostGtv = host.filter(function (x) { return x.gtvI; });
    html +=
      '<div class="ui-subhead">Segnalazioni degli host sui GTV <span class="ui-muted">' + hostGtv.length + "</span></div>" +
      (hostGtv.length
        ? '<div class="ui-grid ui-dg-grid">' + hostGtv.map(unionDGHostCardHtml).join("") + "</div>"
        : '<p class="ui-dg-empty">Nessuna segnalazione degli host su piloti GTV.</p>');
  }
  html += "</div>";

  if (!reclami.length) {
    return html + unionState("Nessun reclamo presentato per questa gara.", "empty") + unionDGRicorsiHtml(ricorsi) + unionDGHostHtml(host);
  }

  var perLega = UNION_LEGHE.concat(["ALTRO"]).map(function (lega) {
    var lista = reclami.filter(function (x) {
      return lega === "ALTRO" ? UNION_LEGHE.indexOf(x.lega) === -1 : x.lega === lega;
    });
    if (!lista.length) return "";
    return (
      '<div class="ui-subhead ' + unionCategoryColorClass(lega) + '">' + escapeHtml(lega === "ALTRO" ? "Altro" : lega) +
      ' <span class="ui-muted">' + lista.length + "</span></div>" +
      '<ol class="ui-dg-list">' +
      '<li class="ui-dg-row ui-dg-row--head" aria-hidden="true"><span>Lobby</span>' +
      '<span class="ui-dg-pair"><span>Richiedente</span><span></span><span>Indagato</span></span><span>Esito</span></li>' +
      lista
        .map(function (x) {
          var gtv = x.gtvR || x.gtvI;
          return (
            '<li class="ui-dg-row' + (gtv ? " is-gtv" : "") + '">' +
            '<span class="ui-dg-lobby">' + escapeHtml(x.lobby) + "</span>" +
            '<span class="ui-dg-pair">' +
            '<span class="ui-dg-p"><span class="' + (x.gtvR ? "ui-dg-name is-gtv" : "ui-dg-name") + '">' + escapeHtml(x.nomeR) + '</span> <span class="ui-dg-team">' + escapeHtml(x.teamR) + "</span></span>" +
            '<span class="ui-dg-arrow" aria-label="contro">→</span>' +
            '<span class="ui-dg-p"><span class="' + (x.gtvI ? "ui-dg-name is-gtv" : "ui-dg-name") + '">' + escapeHtml(x.nomeI) + '</span> <span class="ui-dg-team">' + escapeHtml(x.teamI) + "</span></span>" +
            "</span>" +
            '<span class="ui-dg-res"' + (x.esito.motivo ? ' title="' + escapeHtml(x.esito.motivo) + '"' : "") + ">" + unionDGEsitoHtml(x.esito) +
            (x.esito.motivo ? '<small class="ui-dg-motivo">' + escapeHtml(x.esito.motivo) + "</small>" : "") +
            (x.esito.sub ? '<small class="ui-dg-motivo ui-dg-ricorso">' + escapeHtml(x.esito.sub) + "</small>" : "") +
            (x.esito.sub2 ? '<small class="ui-dg-motivo">' + escapeHtml(x.esito.sub2) + "</small>" : "") + "</span>" +
            "</li>"
          );
        })
        .join("") +
      "</ol>"
    );
  }).join("");

  html +=
    '<div class="ui-section-head ui-dg-all-head"><h3 class="ui-section-title">Tutti i reclami</h3>' +
    '<span class="ui-section-meta">Penalità in secondi sul tempo di gara</span></div>' +
    perLega;

  return html + unionDGRicorsiHtml(ricorsi) + unionDGHostHtml(host);
}

// -------------------------------------------------------------
// Ricorsi: la penalita' del reclamo prima e dopo, con la
// motivazione della Direzione Gara
// -------------------------------------------------------------
function unionDGRicorsiHtml(ricorsi) {
  if (!ricorsi || !ricorsi.length) return "";
  var head =
    '<div class="ui-section-head ui-dg-all-head"><h3 class="ui-section-title">Ricorsi</h3>' +
    '<span class="ui-section-meta">Se il ricorso è respinto la penalità raddoppia</span></div>';
  var carte = ricorsi.map(function (rc) {
    var x = rc.reclamo;
    var gtv = x.gtvI || x.gtvR;
    var esito = rc.esito === "respinto" ? "Respinto" : rc.esito === "accolto" ? "Accolto" : "In valutazione";
    var penalita =
      rc.prima !== null && rc.finale !== null
        ? '<span class="ui-dg-pen"><s>+' + rc.prima + " s</s> → <b>+" + rc.finale + " s</b></span>"
        : "";
    return (
      '<article class="ui-card ui-dg-card ui-dg-ric ui-dg-ric--' + rc.esito + (gtv ? " is-gtv" : "") + '">' +
      '<div class="ui-dg-card-top">' +
      '<span class="ui-dg-sanz"><span class="ui-dg-esito ui-dg-esito--' + (rc.esito === "respinto" ? "pen" : "zero") + '">' + esito + "</span>" +
      penalita + "</span>" +
      '<span class="ui-dg-where">' + unionCatBadge(x.lega) + '<span class="ui-badge">' + escapeHtml(x.lobby || "—") + "</span></span>" +
      "</div>" +
      '<div class="ui-dg-host-who"><span class="ui-dg-role">Ricorso di</span> ' +
      '<span class="' + (x.gtvI ? "ui-dg-name is-gtv" : "ui-dg-name") + '">' + escapeHtml(x.nomeI) + "</span> " +
      '<span class="ui-dg-team">' + escapeHtml(x.teamI) + "</span>" +
      '<span class="ui-dg-team"> · reclamo di </span>' +
      '<span class="' + (x.gtvR ? "ui-dg-name is-gtv" : "ui-dg-name") + '">' + escapeHtml(x.nomeR) + "</span></div>" +
      unionDGNoteHtml(rc.valutazione, false) +
      "</article>"
    );
  }).join("");
  return head + '<div class="ui-grid ui-dg-grid">' + carte + "</div>";
}

// Note lunghe: le prime righe e "leggi tutto" (gestito in loadUnionReportDG)
function unionDGNoteHtml(note, virgolette) {
  if (!note) return "";
  var q = virgolette ? ["“", "”"] : ["", ""];
  var max = 170;
  if (note.length <= max) return '<p class="ui-dg-note">' + q[0] + escapeHtml(note) + q[1] + "</p>";
  var corta = note.slice(0, max).replace(/\s+\S*$/, "") + "…";
  return (
    '<p class="ui-dg-note" data-dg-full="' + escapeHtml(q[0] + note + q[1]) + '">' + q[0] + escapeHtml(corta) +
    ' <button type="button" class="ui-dg-more">leggi tutto</button></p>'
  );
}

// -------------------------------------------------------------
// Segnalazioni degli host: condotta in lobby (secondo giro di
// qualifica, sorpassi nel giro veloce, comportamento in chat...),
// non incidenti di gara. Le sanzioni valgono sulla gara successiva.
// -------------------------------------------------------------
function unionDGHostCardHtml(x) {
  var e = x.esito;
  return (
    '<article class="ui-card ui-dg-host ui-dg-host--' + e.tipo + '">' +
    '<div class="ui-dg-card-top">' +
    '<span class="ui-dg-sanz">' + unionDGEsitoHtml(e) + (e.sub ? "<small>" + escapeHtml(e.sub) + "</small>" : "") + "</span>" +
    '<span class="ui-dg-where">' + unionCatBadge(x.lega) + '<span class="ui-badge">' + escapeHtml(x.lobby || "—") + "</span></span>" +
    "</div>" +
    '<div class="ui-dg-host-who">' +
    '<span class="' + (x.gtvI ? "ui-dg-name is-gtv" : "ui-dg-name") + '">' + escapeHtml(x.nomeI) + "</span> " +
    '<span class="ui-dg-team">' + escapeHtml(x.teamI) + "</span></div>" +
    unionDGNoteHtml(x.note, false) +
    "</article>"
  );
}

function unionDGHostHtml(host) {
  var head =
    '<div class="ui-section-head ui-dg-all-head"><h3 class="ui-section-title">Segnalazioni degli host</h3>' +
    '<span class="ui-section-meta">Condotta in lobby, non incidenti di gara</span></div>';
  if (host === null) {
    return unionDGUrls()[unionDG.gara] && unionDGUrls()[unionDG.gara].host
      ? head + unionState("Impossibile caricare le segnalazioni degli host.", "error")
      : "";
  }
  if (!host.length) return head + '<p class="ui-dg-empty">Nessuna segnalazione degli host per questa gara.</p>';

  var valide = host
    .filter(function (x) { return x.esito.tipo !== "nullo"; })
    .sort(function (a, b) {
      return a.esito.peso - b.esito.peso || unionTierIndex(a.lega) - unionTierIndex(b.lega) ||
        unionDGLobbyNum(a.lobby) - unionDGLobbyNum(b.lobby);
    });
  var nulle = host.filter(function (x) { return x.esito.tipo === "nullo"; });

  var html = head;
  html += valide.length
    ? '<div class="ui-grid ui-dg-grid">' + valide.map(unionDGHostCardHtml).join("") + "</div>"
    : '<p class="ui-dg-empty">Nessuna sanzione dalle segnalazioni degli host.</p>';

  if (nulle.length) {
    html +=
      '<details class="ui-acc ui-dg-nulle">' +
      "<summary>" +
      '<span class="ui-badge">' + nulle.length + "</span>" +
      '<span class="ui-muted">' + (nulle.length === 1 ? "Segnalazione nulla" : "Segnalazioni nulle") + "</span>" +
      "</summary>" +
      '<div class="ui-acc-body"><ol class="ui-dg-list">' +
      nulle
        .map(function (x) {
          return (
            '<li class="ui-dg-row' + (x.gtvI ? " is-gtv" : "") + '">' +
            '<span class="ui-dg-lobby">' + escapeHtml(x.lobby) + "</span>" +
            '<span class="ui-dg-p"><span class="' + (x.gtvI ? "ui-dg-name is-gtv" : "ui-dg-name") + '">' + escapeHtml(x.nomeI) + "</span> " +
            '<span class="ui-dg-team">' + escapeHtml(x.teamI) + "</span>" +
            (x.note ? '<small class="ui-dg-motivo ui-dg-rownote">' + escapeHtml(x.note) + "</small>" : "") + "</span>" +
            '<span class="ui-dg-res">' + unionDGEsitoHtml(x.esito) + "</span>" +
            "</li>"
          );
        })
        .join("") +
      "</ol></div></details>";
  }
  return html;
}
