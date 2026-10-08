// ============================================================
// GTV - codice comune a tutte le pagine (index.html, union.html)
// Menu laterale, navigazione a sezioni, escape, CSV, fetch.
// Le pagine caricano: config.js, js/comune.js, poi il loro script.
// ============================================================

// -------------------------------------------------------------
// Utilita'
// -------------------------------------------------------------
function escapeHtml(unsafe) {
  return (unsafe === null || unsafe === undefined ? "" : unsafe)
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// URL sicuro per href/src presi da fogli o scraper: solo http(s), il resto
// (javascript:, data:...) diventa "". Gli indirizzi senza schema
// ("youtube.com/@canale") diventano https.
function urlSicuro(url) {
  var u = String(url || "").trim();
  if (!u) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = "https://" + u.replace(/^\/+/, "");
  return /^https?:\/\//i.test(u) ? u : "";
}

// CSV completo: campi tra virgolette con virgole, "" e a capo dentro.
// Le righe del tutto vuote vengono scartate.
function parseCsv(text) {
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
    return r.some(function (v) {
      return v.trim() !== "";
    });
  });
}

function caricaTesto(url, opzioni) {
  return fetch(url, opzioni).then(function (response) {
    if (!response.ok) throw new Error("Errore HTTP " + response.status);
    return response.text();
  });
}

function caricaJson(url, opzioni) {
  return fetch(url, opzioni).then(function (response) {
    if (!response.ok) throw new Error("Errore HTTP " + response.status);
    return response.json();
  });
}

// Percorso di un file di dati (GTV_CONFIG.dati in config.js)
function datoUrl(chiave, predefinito) {
  var dati = window.GTV_CONFIG && window.GTV_CONFIG.dati;
  return (dati && dati[chiave]) || predefinito;
}

// -------------------------------------------------------------
// Menu laterale (hamburger)
// -------------------------------------------------------------
function initMenu() {
  var toggle = document.getElementById("menu-toggle");
  var chiudi = document.getElementById("close-menu");
  var sidebar = document.getElementById("sidebar");
  if (!toggle || !sidebar) return;

  function apri() {
    sidebar.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }
  function chiudiMenu() {
    sidebar.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  toggle.addEventListener("click", apri);
  if (chiudi) chiudi.addEventListener("click", chiudiMenu);
  // un tocco su una voce o fuori dal menu lo chiude
  sidebar.addEventListener("click", function (e) {
    if (e.target.closest("a")) chiudiMenu();
  });
  document.addEventListener("click", function (e) {
    if (sidebar.classList.contains("open") && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
      chiudiMenu();
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && sidebar.classList.contains("open")) chiudiMenu();
  });
}

// -------------------------------------------------------------
// Navigazione a sezioni: si vede una .section alla volta, scelta
// dall'hash dell'URL (#piloti, #lobby...); senza hash, #home.
// -------------------------------------------------------------
function initSezioni() {
  var sezioni = document.querySelectorAll(".section");
  if (!sezioni.length) return;

  function mostra(id, scorri) {
    var bersaglio = id && document.getElementById(id);
    if (!bersaglio || !bersaglio.classList.contains("section")) {
      bersaglio = document.getElementById("home") || sezioni[0];
    }
    Array.prototype.forEach.call(sezioni, function (s) {
      s.style.display = s === bersaglio ? "block" : "none";
    });
    Array.prototype.forEach.call(document.querySelectorAll('.menu-link[href^="#"]'), function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#" + bersaglio.id);
    });
    if (scorri) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  window.addEventListener("hashchange", function () {
    mostra(window.location.hash.slice(1), true);
  });
  mostra(window.location.hash.slice(1), false);
}

document.addEventListener("DOMContentLoaded", function () {
  initMenu();
  initSezioni();
});
