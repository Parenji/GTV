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