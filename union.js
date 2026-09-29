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
  loadUnionStats();
  loadUnionClassifiche();
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
    fetch(url).then(function (response) {
      if (!response.ok) throw new Error("Errore HTTP " + response.status);
      return response.text();
    }),
    fetchUnionLobbyData().catch(function () {
      return null;
    }),
    fetchUnionAutoData().catch(function () {
      return null;
    }),
  ])
    .then(function (results) {
      var csvText = results[0];
      var unionData = results[1];
      var autoData = results[2];

      var rows = parseCsv(csvText);
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
        '<div class="ui-card ui-pilot">' +
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
    '<p class="ui-text" style="margin-top:0">' + rows.length +
    " piloti GTV iscritti. Tocca la lobby per vedere lo schieramento completo, l'host e la live.</p>";

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
          '<td><span class="ui-strong">' + escapeHtml(r.pilot) + "</span></td>" +
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
        '<span class="ui-ellipsis' + (isGtv ? " ui-strong" : "") + '">' + escapeHtml(p.nome) + "</span>" +
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

// =============================================================
// RISULTATI E CLASSIFICHE (unionscraping/classifiche.json)
// Dati dal Portale Classifiche Union (classifiche/classifiche.py);
// qualifica, auto e distacchi arrivano dagli screenshot ufficiali.
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

function loadUnionClassifiche() {
  var resBody = document.getElementById("union-res-body");
  var clsBody = document.getElementById("union-cls-body");
  if (!resBody && !clsBody) return;

  fetch(unionClassificheUrl())
    .then(function (response) {
      if (!response.ok) throw new Error("Errore HTTP " + response.status);
      return response.json();
    })
    .then(function (data) {
      if (!data || !data.leghe) throw new Error("Dati non validi");
      unionCls.data = data;
      var pubblicate = (data.meta && data.meta.gare_pubblicate) || [];
      unionCls.gara = pubblicate.length ? pubblicate[pubblicate.length - 1] : null;
      initUnionPanel();
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
      if (!trovato && unionNorm(riga.nome) === chiave) {
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
            '<span class="ui-result-lobby">non classificato</span></span>' +
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
    "<span>Tocca una scheda per la classifica della lobby</span>" +
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

  document.getElementById("union-panel-title").innerHTML =
    "Lobby " + escapeHtml(nomeLobby) + " " + unionCatBadge(lb.lega);
  document.getElementById("union-panel-sub").textContent =
    "Gara " + unionCls.gara + ", " + UNION_PISTE[unionCls.gara - 1];
  document.getElementById("union-panel-body").innerHTML = unionLobbyPanelHtml(lb);

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
  if (_unionPanelOrigin) _unionPanelOrigin.focus();
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
          '<tr class="' + (unionIsGtv(r) ? "is-gtv" : "") + '">' +
          '<td class="ui-pos">' + r.pos + "</td>" +
          '<td class="ui-muted">' + (r.q ? r.q : "—") + "</td>" +
          '<td><span class="ui-strong">' + escapeHtml(r.nome) + "</span> " + unionDots(lb, r.nome) + "</td>" +
          '<td class="ui-muted">' + escapeHtml(r.team || "") + "</td>" +
          '<td class="ui-muted ui-hide-sm">' + escapeHtml(r.auto || "") + "</td>" +
          '<td class="ui-num">' + escapeHtml(r.distacco || "") + "</td>" +
          "</tr>"
        );
      })
      .join("") +
    "</tbody></table></div>";

  var provv = (lb.provvedimenti || []).length
    ? '<p class="ui-text"><strong>Provvedimenti della direzione gara:</strong> ' +
      lb.provvedimenti
        .map(function (p) {
          return escapeHtml(p.nome) + " (" + escapeHtml(p.sanzione) + ")";
        })
        .join(", ") +
      "</p>"
    : "";

  return tabella + unionQtoGChart(righe) + provv;
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
        '<span class="ui-ellipsis">' + escapeHtml(x.r.nome) + "<small>P" + x.r.q + " → P" + x.r.pos + "</small></span>" +
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
  var d = s[s.length - 2] - s[s.length - 1];
  if (d > 0) return ' <span class="ui-delta ui-delta--up" title="Guadagnate ' + d + ' posizioni">▲' + d + "</span>";
  if (d < 0) return ' <span class="ui-delta ui-delta--down" title="Perse ' + -d + ' posizioni">▼' + -d + "</span>";
  return ' <span class="ui-delta ui-delta--same" title="Stessa posizione">=</span>';
}

function unionClsRowHtml(p) {
  var gtv = unionIsGtv(p);
  var gare = "";
  for (var i = 0; i < UNION_NUM_GARE; i++) {
    var v = p.gare && p.gare[i];
    gare += "<span><small>G" + (i + 1) + "</small>" + (v === null || v === undefined ? "—" : v) + "</span>";
  }
  return (
    '<li class="ui-row' + (gtv ? " is-gtv" : "") + '" tabindex="0" aria-expanded="false">' +
    '<span class="ui-pos">' + (p.pos || "") + "</span>" +
    '<span class="ui-muted">' + escapeHtml(p.team || "") + "</span>" +
    '<span class="ui-ellipsis' + (gtv ? " ui-strong" : "") + '">' + escapeHtml(p.nome) + (gtv ? unionMovimento(p) : "") + "</span>" +
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
  var visibile = piloti.map(function (p, i) { return tutti || i < 3; });
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
