// ============================================================
// GTV UNION - logica dedicata a union.html
// Tabella piloti iscritti + lobby
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  initUnionPage();
});

function initUnionPage() {
  loadUnionPiloti();
  loadUnionLobby();
  loadUnionStats();
}

// -------------------------------------------------------------
// STATS in evidenza nella hero (stile OpenRouter)
// - Piloti iscritti totali: data.json stats.total_pilots
// - Piloti GTV: conteggio team "GTV" in data.json pilots
// - Gare: conteggio delle card .race-item nella sezione Calendario
// I numeri si aggiornano da soli quando vengono caricati i dati.
// -------------------------------------------------------------
function loadUnionStats() {
  var gareEl = document.getElementById("union-stat-gare");
  if (gareEl) {
    var gare = document.querySelectorAll("#calendario .race-item").length;
    if (gare > 0) gareEl.textContent = gare;
  }

  fetchUnionLobbyData()
    .then(function (data) {
      if (!data) return;
      var totalEl = document.getElementById("union-stat-piloti");
      if (totalEl && data.stats && data.stats.total_pilots) {
        totalEl.textContent = data.stats.total_pilots;
      }

      var gtvEl = document.getElementById("union-stat-gtv");
      if (gtvEl) {
        var gtv = 0;
        (data.pilots || []).forEach(function (p) {
          if (String(p.team || "").trim().toUpperCase() === "GTV") gtv++;
        });
        gtvEl.textContent = gtv > 0 ? gtv : "—";
      }
    })
    .catch(function () {
      // Dati non ancora disponibili: i segnaposto restano visibili
      console.warn("Impossibile caricare le statistiche Union.");
    });
}

// -------------------------------------------------------------
// TABELLA PILOTI ISCRITTI (dati dal CSV piloti di index.html)
// Colonna F (indice 5) = partecipazione Union
// La colonna MATRICOLA viene invece presa da unionscraping/data.json
// (ctech: il nome in lobby del JSON corrisponde al PSN r[0] del CSV,
// con fallback sul nickname GT7 r[1]).
// -------------------------------------------------------------
function loadUnionPiloti() {
  var container = document.getElementById("union-piloti-body");
  if (!container) return;

  var url =
    window.GTV_CONFIG && window.GTV_CONFIG.googleSheets
      ? window.GTV_CONFIG.googleSheets.piloti
      : "";

  if (!url) {
    container.innerHTML =
      '<div class="error-message">Configurazione non trovata.</div>';
    return;
  }

  // Carica in parallelo il CSV piloti e il data.json dello scraper
  // (quest'ultimo è opzionale: se manca, le matricole restano "—").
  Promise.all([
    fetch(url).then(function (response) {
      if (!response.ok) throw new Error("Errore HTTP " + response.status);
      return response.text();
    }),
    fetchUnionLobbyData().catch(function () {
      return null;
    }),
  ])
    .then(function (results) {
      var csvText = results[0];
      var unionData = results[1];

      var rows = parseCsv(csvText);
      if (!rows || rows.length === 0) {
        container.innerHTML = '<div class="error-message">Nessun dato.</div>';
        return;
      }

      var unionRows = rows.filter(function (r) {
        var participa = String(r[5] || "").trim().toLowerCase();
        return participa === "x" || participa === "✓" || participa === "1";
      });

      renderUnionPilotiCards(container, unionRows, unionData);
    })
    .catch(function (error) {
      console.error("Errore caricamento piloti Union:", error);
      container.innerHTML =
        '<div class="error-message">Impossibile caricare i piloti Union.</div>';
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
  var text = (csvText || "").replace(/^\uFEFF/, "");
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

// -------------------------------------------------------------
// RENDER card piloti GTV iscritti (mobile-first, niente tabelle)
// Ogni pilota è una card con N°, matricola, PSN, GT7, categoria,
// marca (logo) e auto — tutte le info che prima erano in tabella.
// -------------------------------------------------------------
var UNION_TIERS = ["STAR", "ELITE", "PRO GOLD", "PRO SILVER", "PRO AMA", "AMA"];

function unionTierIndex(cat) {
  var c = String(cat || "").trim().toUpperCase();
  var i = UNION_TIERS.indexOf(c);
  return i === -1 ? UNION_TIERS.length : i;
}

// Logo marca con fallback PNG -> SVG (come worldchampionship)
function brandLogoHtml(brand) {
  var b = String(brand || "").trim();
  if (!b) return "";
  var slug = b.toLowerCase().replace(/[^a-z0-9]+/g, "");
  var png = "images/marchi-auto/" + slug + ".png";
  var svg = "images/marchi-auto/" + slug + ".svg";
  var out =
    '<img src="' + png + '" alt="' + escapeHtml(b) + '" class="union-brand-logo" ';
  out += ' onerror="if(this.src.indexOf(\'.png\') !== -1){this.onerror=null;this.src=\'';
  out += svg;
  out += '\';}" />';
  return out;
}

function renderUnionPilotiCards(container, rows, unionData) {
  rows.sort(function (a, b) {
    var tierDiff = unionTierIndex(a[6]) - unionTierIndex(b[6]);
    if (tierDiff !== 0) return tierDiff;
    return String(a[0] || "").localeCompare(String(b[0] || ""));
  });

  var matricolaMap = buildUnionMatricolaMap(unionData);

  var html = '<div class="union-pilot-cards">';

  rows.forEach(function (r) {
    var numero = r[2] || "—";
    var psn = r[0] || "—";
    var gt7 = r[1] || "—";
    var cat = r[6] || "—";
    var auto = r[7] || "—";
    var marchio = r[8] || "";

    var matricola = lookupUnionMatricola(matricolaMap, psn, gt7);

    var brandBlock = marchio
      ? brandLogoHtml(marchio) +
        '<div class="union-brand-name">' +
        escapeHtml(marchio) +
        "</div>"
      : '<span class="union-empty">—</span>';

    var catPatch =
      cat !== "—"
        ? '<span class="union-specch-patch ' +
          unionCategoryColorClass(cat) +
          '">' +
          escapeHtml(cat) +
          "</span>"
        : "";

    var nicknameBlock =
      gt7 !== "—" && gt7 !== psn
        ? '<div class="union-pilot-nickname">' + escapeHtml(gt7) + "</div>"
        : "";

    html +=
      '<div class="union-pilot-card">' +
      '<div class="union-pilot-head">' +
      '<span class="union-pilot-num">#' + escapeHtml(numero) + "</span>" +
      catPatch +
      '<div class="union-pilot-brand">' + brandBlock + "</div>" +
      "</div>" +
      '<div class="union-pilot-name">' + escapeHtml(psn) + "</div>" +
      nicknameBlock +
      '<div class="union-pilot-meta">' +
      '<span class="union-pilot-meta-item">' +
      '<span class="union-pilot-meta-label">Matricola</span>' +
      escapeHtml(matricola) +
      "</span>" +
      '<span class="union-pilot-meta-item">' +
      '<span class="union-pilot-meta-label">Auto</span>' +
      escapeHtml(auto) +
      "</span>" +
      "</div>" +
      "</div>";
  });

  html += "</div>";

  var count =
    '<div class="union-count">' + rows.length + " piloti iscritti</div>";

  container.innerHTML = count + html;
}

// -------------------------------------------------------------
// SEZIONE LOBBY - dati estratti da unionscraping/data.json
// 1) Specchietto riassuntivo dei piloti GTV con link alla lobby
// 2) Tutte le lobby (schieramenti completi) raggruppate per giorno
// -------------------------------------------------------------

// Dati generati dallo scraper (stessi campi di data.json)
var UNION_LOBBY_DAYS = ["LUNEDI", "MARTEDI", "MERCOLEDI", "GIOVEDI", "VENERDI"];

// URL dei dati estratti dallo scraper
function unionLobbyDataUrl() {
  return window.GTV_CONFIG && window.GTV_CONFIG.unionLobbyData
    ? window.GTV_CONFIG.unionLobbyData
    : "unionscraping/data.json";
}

// Fetch condiviso e memoizzato: data.json viene scaricato una sola volta
// e riusato sia dalle lobby sia dalla tabella piloti (colonna Matricola).
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
      var msg = '<div class="error-message">Impossibile caricare le lobby Union.</div>';
      if (specchietto) specchietto.innerHTML = msg;
      if (body) body.innerHTML = msg;
    });
}

// Scritta "ultimo aggiornamento automatico" nella sezione lobby.
// Legge meta.generated_at (timestamp UTC scritto dallo scraper in data.json)
// e lo mostra in data/ora locali del visitatore.
function setUnionLastUpdate(data) {
  var el = document.getElementById("union-last-update");
  if (!el) return;
  var iso = data && data.meta && data.meta.generated_at;
  if (!iso) return; // assente → elemento resta nascosto
  var d = new Date(iso);
  if (isNaN(d.getTime())) return;
  el.innerHTML =
    "Ultimo aggiornamento automatico: <b>" +
    d.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) +
    "</b>";
  el.hidden = false;
}

// Id univoco di una card-lobby (per gli ancoraggi dello specchietto)
function lobbyCardId(day, name) {
  return "union-lobby-" + String(day || "").toLowerCase() + "-" + String(name || "").toLowerCase();
}

// Ordina per giorno e poi per nome lobby
function unionDayIndex(day) {
  var i = UNION_LOBBY_DAYS.indexOf(String(day || "").toUpperCase());
  return i === -1 ? UNION_LOBBY_DAYS.length : i;
}

// Abbreviazioni per i giorni (per risparmiare spazio su mobile)
var UNION_DAY_SHORT = {
  LUNEDI: "LUN",
  MARTEDI: "MAR",
  MERCOLEDI: "MER",
  GIOVEDI: "GIO",
  VENERDI: "VEN",
};

// Colore della patch in base alla categoria della lobby.
// La normalizzazione elimina spazi/maiuscole: così "PRO GOLD"/"PROGOLD",
// "PRO SILVER"/"PROSILVER" e "PRO AMA"/"PROAMA" coincidono.
function unionCategoryColorClass(category) {
  var c = String(category || "").trim().toUpperCase().replace(/\s+/g, "");
  switch (c) {
    case "STAR":
      return "union-patch-star";
    case "PROGOLD":
      return "union-patch-gold";
    case "PROSILVER":
      return "union-patch-silver";
    case "PROAMA":
      return "union-patch-ama";
    case "ELITE":
      return "union-patch-elite";
    case "AMA":
      return "union-patch-base";
    default:
      return "";
  }
}

// -------------------------------------------------------------
// Specchietto riassuntivo: una riga per ogni pilota GTV iscritto
// -------------------------------------------------------------
function renderUnionSpecchietto(container, data) {
  container.classList.remove("loading-message");

  var rows = [];
  data.lobbies.forEach(function (lb) {
    lb.pilots.forEach(function (p) {
      var team = String(p.team || "").trim().toUpperCase();
      if (team !== "GTV") return;
      rows.push({
        name: lb.name,
        day: lb.day,
        time: lb.time,
        category: lb.category,
        host: lb.host || "",
        pilot: p.nome || "",
      });
    });
  });

  // Ordina per giorno e poi per nome lobby
  rows.sort(function (a, b) {
    var diff = unionDayIndex(a.day) - unionDayIndex(b.day);
    if (diff !== 0) return diff;
    return String(a.name).localeCompare(String(b.name));
  });

  var rowsHtml = rows
    .map(function (r) {
      var id = lobbyCardId(r.day, r.name);
      var dayShort = UNION_DAY_SHORT[String(r.day || "").toUpperCase()] || r.day;
      var hour = String(r.time || "").replace("Ore ", "").trim();
      var patchClass = unionCategoryColorClass(r.category);
      return (
        "<tr>" +
        '<td class="union-specch-pilot" data-label="Pilota">' +
        '<div class="union-specch-pilot-name">' + escapeHtml(r.pilot) + "</div>" +
        '<div class="union-specch-patch ' + patchClass + '">' + escapeHtml(r.category) + "</div>" +
        "</td>" +
        '<td class="union-specch-lobby" data-label="Lobby">' +
        '<button class="union-specch-link" data-target="' + id + '">' + escapeHtml(r.name) + "</button>" +
        "</td>" +
        '<td class="union-specch-day" data-label="Data">' + escapeHtml(dayShort) + "</td>" +
        '<td class="union-specch-time" data-label="Ora">' + escapeHtml(hour) + "</td>" +
        "</tr>"
      );
    })
    .join("");

  var html =
    '<div class="union-specchietto">' +
    '<div class="union-specch-intro">' +
    "Clicca sulla <em>Lobby</em> per vedere lo schieramento completo, gli host e la live." +
    "</div>" +
    '<div class="union-count">' + rows.length + " piloti GTV iscritti</div>" +
    '<div class="union-table-scroll">' +
    '<table class="union-lista union-specch-table">' +
    "<thead><tr>" +
    '<th class="union-specch-th">Pilota</th>' +
    '<th class="union-specch-th">Lobby</th>' +
    '<th class="union-specch-th">Data</th>' +
    '<th class="union-specch-th">Ora</th>' +
    "</tr></thead><tbody>" +
    rowsHtml +
    "</tbody></table></div></div>";

  container.innerHTML =
    html || '<div class="error-message">Nessun pilota GTV trovato nelle lobby.</div>';

  // Link dello specchietto: apri l'accordion della lobby e scrolla ad essa
  Array.from(container.querySelectorAll(".union-specch-link")).forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-target");
      // Apri l'accordion (se esiste) così il contenuto è visibile
      openUnionLobby(id);
      var target = document.getElementById(id);
      if (target) {
        // Offset per l'header sticky: scorrimento più preciso per
        // far comparire la lobby cliccata in cima (non quella precedente)
        var offset = 68;
        var y = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(y, 0), behavior: "smooth" });
      }
    });
  });
}

// -------------------------------------------------------------
// Tutte le lobby, raggruppate per giorno, in stile GTV
// -------------------------------------------------------------
function renderUnionLobbyBody(container, data) {
  container.classList.remove("loading-message");

  var byDay = {};
  UNION_LOBBY_DAYS.forEach(function (d) {
    byDay[d] = [];
  });
  data.lobbies.forEach(function (lb) {
    var d = String(lb.day || "").toUpperCase();
    (byDay[d] = byDay[d] || []).push(lb);
  });

  var daysHtml = UNION_LOBBY_DAYS
    .filter(function (d) {
      return byDay[d] && byDay[d].length;
    })
    .map(function (d) {
      var cards = byDay[d]
        .map(function (lb) {
          return unionLobbyCardHtml(lb);
        })
        .join("");

      return (
        '<div class="union-lobby-day-block">' +
        '<div class="union-lobby-day-title">' + d + "</div>" +
        '<div class="lobby-card-container">' +
        cards +
        "</div></div>"
      );
    })
    .join("");

  container.innerHTML =
    daysHtml || '<div class="error-message">Nessuna lobby trovata.</div>';

  initUnionAccordions(container);
}

function unionLobbyCardHtml(lb) {
  var id = lobbyCardId(lb.day, lb.name);
  var time = String(lb.time || "").replace("Ore ", "");

  var pilots = lb.pilots
    .map(function (p) {
      var isGtv = String(p.team || "").trim().toUpperCase() === "GTV";
      return (
        '<div class="lobby-pilot' + (isGtv ? " union-lobby-pilot-gtv" : "") + '">' +
        '<div class="lobby-pilot-header">' +
        '<div class="union-lobby-pos">' + escapeHtml(p.pos) + "</div>" +
        '<div class="lobby-pilot-info">' +
        '<div class="lobby-pilot-name">' + escapeHtml(p.nome) + "</div>" +
        '<div class="lobby-pilot-team">' + escapeHtml(p.team) + "</div>" +
        "</div></div></div>"
      );
    })
    .join("");

  var hostLink =
    lb.host
      ? '<a href="https://profile.playstation.com/' +
        encodeURIComponent(lb.host) +
        '/add" target="_blank" class="lobby-host-name">' +
        escapeHtml(lb.host) +
        "</a>"
      : '<span class="lobby-host-name">—</span>';

  var liveBlock =
    lb.url
      ? '<a href="' + escapeHtml(lb.url) + '" target="_blank" rel="noopener" class="lobby-live-name">' +
        escapeHtml(lb.live || "Canale live") +
        "</a>"
      : '<span class="lobby-live-name">—</span>';

  // Accordeon: la testata è cliccabile e mostra/espande il corpo
  return (
    '<div id="' + id + '" class="lobby-card union-lobby-card union-acc">' +
    '<button type="button" class="union-acc-head" data-acc-target="' + id + '" aria-expanded="false">' +
    '<div class="union-acc-head-main">' +
    '<div class="lobby-datetime">' +
    '<div class="lobby-date">' + escapeHtml(lb.day) + "</div>" +
    '<div class="lobby-time">' + escapeHtml(time) + "</div>" +
    "</div>" +
    '<div class="lobby-category">' +
     escapeHtml(lb.name) + " · " + '<span class="union-specch-patch ' + unionCategoryColorClass(lb.category) + '">' + escapeHtml(lb.category) + "</span>" + "</div>" +
    "</div>" +
    '<span class="union-acc-count">' + lb.pilots.length + " piloti</span>" +
    '<span class="union-acc-chevron">▾</span>' +
    "</button>" +
    '<div class="union-acc-body">' +
    '<div class="lobby-info-section">' +
    '<div class="lobby-host"><div class="lobby-host-icon"><img src="images/icons/host.svg" alt="Host" class="lobby-icon"></div>' +
    '<div class="lobby-host-content"><div class="lobby-host-label">Host</div>' +
    hostLink +
    "</div></div>" +
    '<div class="lobby-live"><div class="lobby-live-icon"><img src="images/icons/live.svg" alt="Live" class="lobby-icon"></div>' +
    '<div class="lobby-live-content"><div class="lobby-live-label">Live</div>' +
    liveBlock +
    "</div></div>" +
    "</div>" +
    '<div class="lobby-pilots-section">' +
    '<div class="lobby-pilots-title">Piloti <span class="union-lobby-count">(' + lb.pilots.length + ")</span></div>" +
    '<div class="lobby-pilots-grid">' +
    pilots +
    "</div></div>" +
    "</div></div>"
  );
}

// Apre/chiude un accordeon al click sulla testata
function initUnionAccordions(container) {
  Array.from(container.querySelectorAll(".union-acc-head")).forEach(function (head) {
    head.addEventListener("click", function () {
      var card = document.getElementById(head.getAttribute("data-acc-target"));
      if (!card) return;
      var isOpen = card.classList.contains("open");
      card.classList.toggle("open");
      head.setAttribute("aria-expanded", isOpen ? "false" : "true");
    });
  });
}

// Apre l'accordion della lobby indicata (usato dallo specchietto riassuntivo)
function openUnionLobby(id) {
  var card = document.getElementById(id);
  if (!card) return false;
  card.classList.add("open");
  var head = card.querySelector(".union-acc-head");
  if (head) head.setAttribute("aria-expanded", "true");
  return true;
}