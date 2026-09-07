// ============================================================
// GTV UNION - logica dedicata a union.html
// Carousel delle grafiche di categoria + tabella piloti iscritti
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  initUnionPage();
});

function initUnionPage() {
  initCarousel();
  loadUnionPiloti();
  loadUnionLobby();
}

// -------------------------------------------------------------
// CAROUSEL delle grafiche di categoria
// -------------------------------------------------------------
function initCarousel() {
  var track = document.getElementById("carousel-track");
  var prevBtn = document.getElementById("carousel-prev");
  var nextBtn = document.getElementById("carousel-next");
  var dotsContainer = document.getElementById("carousel-dots");

  if (!track || !prevBtn || !nextBtn) return;

  var slides = Array.from(track.children);
  var total = slides.length;
  var current = 0;
  var autoTimer = null;

  if (total === 0) return;

  dotsContainer.innerHTML = "";
  slides.forEach(function (_, i) {
    var dot = document.createElement("button");
    dot.className = "carousel-dot";
    dot.setAttribute("aria-label", "Vai alla slide " + (i + 1));
    if (i === 0) dot.classList.add("active");
    dot.addEventListener("click", function () {
      goTo(i);
      restartAuto();
    });
    dotsContainer.appendChild(dot);
  });

  var dots = Array.from(dotsContainer.children);

  function goTo(index) {
    current = (index + total) % total;
    track.style.transform = "translateX(-" + current * 100 + "%)";
    dots.forEach(function (d, i) {
      d.classList.toggle("active", i === current);
    });
  }

  function restartAuto() {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(function () {
      goTo(current + 1);
    }, 6000);
  }

  prevBtn.addEventListener("click", function () {
    goTo(current - 1);
    restartAuto();
  });
  nextBtn.addEventListener("click", function () {
    goTo(current + 1);
    restartAuto();
  });

  var carousel = document.getElementById("union-carousel");
  if (carousel) {
    carousel.addEventListener("mouseenter", function () {
      if (autoTimer) clearInterval(autoTimer);
    });
    carousel.addEventListener("mouseleave", restartAuto);
  }

  restartAuto();
}

// -------------------------------------------------------------
// TABELLA PILOTI ISCRITTI (dati dal CSV piloti di index.html)
// Colonna F (indice 5) = partecipazione Union
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

  fetch(url)
    .then(function (response) {
      if (!response.ok) throw new Error("Errore HTTP " + response.status);
      return response.text();
    })
    .then(function (csvText) {
      var rows = parseCsv(csvText);
      if (!rows || rows.length === 0) {
        container.innerHTML = '<div class="error-message">Nessun dato.</div>';
        return;
      }

      var unionRows = rows.filter(function (r) {
        var participa = String(r[5] || "").trim().toLowerCase();
        return participa === "x" || participa === "✓" || participa === "1";
      });

      renderUnionPilotiTable(container, unionRows);
    })
    .catch(function (error) {
      console.error("Errore caricamento piloti Union:", error);
      container.innerHTML =
        '<div class="error-message">Impossibile caricare i piloti Union.</div>';
    });
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
// RENDER della tabella piloti iscritti
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

function renderUnionPilotiTable(container, rows) {
  rows.sort(function (a, b) {
    var tierDiff = unionTierIndex(a[6]) - unionTierIndex(b[6]);
    if (tierDiff !== 0) return tierDiff;
    return String(a[0] || "").localeCompare(String(b[0] || ""));
  });

  var html =
    '<table class="union-lista">' +
    "<thead><tr>" +
    "<th>N°</th><th>PSN</th><th>GT7</th>" +
    "<th>Categoria</th><th>Marca</th><th>Auto</th>" +
    "</tr></thead><tbody>";

  rows.forEach(function (r) {
    var numero = r[2] || "—";
    var psn = r[0] || "—";
    var gt7 = r[1] || "—";
    var cat = r[6] || "—";
    var auto = r[7] || "—";
    var marchio = r[8] || "";

    html +=
      "<tr>" +
      '<td class="union-num" data-label="N°">#' + escapeHtml(numero) + "</td>" +
      '<td data-label="PSN">' + escapeHtml(psn) + "</td>" +
      '<td class="union-gt7" data-label="GT7">' + escapeHtml(gt7) + "</td>" +
      '<td data-label="Categoria"><span class="union-tier">' + escapeHtml(cat) + "</span></td>" +
      brandLogoCell(marchio) +
      '<td data-label="Auto">' + escapeHtml(auto) + "</td>" +
      "</tr>";
  });

  html += "</tbody></table>";

  var count =
    '<div class="union-count">' + rows.length + " piloti iscritti</div>";

  container.innerHTML = html + count;
}

function brandLogoCell(brand) {
  var b = String(brand || "").trim();
  if (!b) {
    return '<td class="union-brand"><span class="union-empty">—</span></td>';
  }
  return (
    '<td class="union-brand">' +
    brandLogoHtml(b) +
    '<div class="union-brand-name">' +
    escapeHtml(b) +
    "</div></td>"
  );
}

// -------------------------------------------------------------
// SEZIONE LOBBY - dati estratti da unionscraping/data.json
// 1) Specchietto riassuntivo dei piloti GTV con link alla lobby
// 2) Tutte le lobby (schieramenti completi) raggruppate per giorno
// -------------------------------------------------------------

// Dati generati dallo scraper (stessi campi di data.json)
var UNION_LOBBY_DAYS = ["LUNEDI", "MARTEDI", "MERCOLEDI", "GIOVEDI", "VENERDI"];

function loadUnionLobby() {
  var specchietto = document.getElementById("union-specchietto-body");
  var body = document.getElementById("union-lobby-body");
  if (!specchietto && !body) return;

  var url =
    window.GTV_CONFIG && window.GTV_CONFIG.unionLobbyData
      ? window.GTV_CONFIG.unionLobbyData
      : "unionscraping/data.json";

  fetch(url)
    .then(function (response) {
      if (!response.ok) throw new Error("Errore HTTP " + response.status);
      return response.json();
    })
    .then(function (data) {
      if (!data || !data.lobbies) {
        throw new Error("Dati non validi");
      }
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
      return (
        "<tr>" +
        '<td class="union-specch-pilot" data-label="Pilota">' + escapeHtml(r.pilot) + "</td>" +
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
    "Clicca sulla <em>Lobby</em> per vedere lo schieramento completo." +
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

  // Link dello specchietto: scrolla alla lobby completa corrispondente
  Array.from(container.querySelectorAll(".union-specch-link")).forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = document.getElementById(btn.getAttribute("data-target"));
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

  return (
    '<div id="' + id + '" class="lobby-card union-lobby-card">' +
    '<div class="lobby-card-header">' +
    '<div class="lobby-datetime">' +
    '<div class="lobby-date">' + escapeHtml(lb.day) + "</div>" +
    '<div class="lobby-time">' + escapeHtml(time) + "</div>" +
    "</div>" +
    '<div class="lobby-category">' + escapeHtml(lb.category) + " · Lobby " + escapeHtml(lb.name) + "</div>" +
    "</div>" +
    '<div class="lobby-info-section">' +
    '<div class="lobby-host"><div class="lobby-host-icon">👑</div>' +
    '<div class="lobby-host-content"><div class="lobby-host-label">Host</div>' +
    hostLink +
    "</div></div>" +
    '<div class="lobby-live"><div class="lobby-live-icon">📺</div>' +
    '<div class="lobby-live-content"><div class="lobby-live-label">Live</div>' +
    liveBlock +
    "</div></div>" +
    "</div>" +
    '<div class="lobby-pilots-section">' +
    '<div class="lobby-pilots-title">Piloti <span class="union-lobby-count">(' + lb.pilots.length + ")</span></div>" +
    '<div class="lobby-pilots-grid">' +
    pilots +
    "</div></div></div>"
  );
}