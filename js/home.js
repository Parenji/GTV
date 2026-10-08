// ============================================================
// GTV - Home (index.html): piloti, admin, scheda pilota, palmares
// Dati: foglio piloti e foglio admin (config.js), dati/palmares.json
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  var fogli = (window.GTV_CONFIG && window.GTV_CONFIG.googleSheets) || {};
  loadHomePiloti(fogli.piloti);
  loadHomeAdmin(fogli.admin);
  loadPalmares();
});

function homeErrore(el, testo) {
  el.innerHTML = '<div class="ui-state ui-state--error">' + escapeHtml(testo) + "</div>";
}

// -------------------------------------------------------------
// PILOTI: una card per pilota; un tocco apre la scheda
// Colonne del foglio: 0 nome, 1 nickname, 2 numero, 3 info (JGTV),
// 4 periferica, poi gruppi di 4 colonne per campionato.
// -------------------------------------------------------------
function loadHomePiloti(url) {
  var body = document.getElementById("piloti-body");
  if (!body) return;
  if (!url) return homeErrore(body, "Configurazione non trovata.");

  caricaTesto(url)
    .then(function (testo) {
      var righe = parseCsv(testo);
      var header = righe[0] || [];
      var piloti = righe.slice(1).filter(function (r) {
        return (r[0] || "").trim();
      });
      body.innerHTML = piloti
        .map(function (r, i) {
          var isJgtv = (r[3] || "").toLowerCase().indexOf("jgtv") !== -1;
          return (
            '<button type="button" class="ui-card ui-pilot" data-indice="' + i + '">' +
            '<div class="ui-pilot-top"><span class="ui-pilot-num">#' + escapeHtml(r[2]) + "</span>" +
            (isJgtv ? '<span class="ui-badge">JGTV</span>' : "") + "</div>" +
            perifericaIconHtml(r[4], "ui-pilot-brand") +
            '<div class="ui-pilot-name">' + escapeHtml(r[0]) + "</div>" +
            (r[1] ? '<div class="ui-pilot-sub">' + escapeHtml(r[1]) + "</div>" : "") +
            "</button>"
          );
        })
        .join("");
      var conteggio = document.getElementById("piloti-count");
      if (conteggio) conteggio.textContent = piloti.length + " piloti";
      body.addEventListener("click", function (e) {
        var card = e.target.closest(".ui-pilot[data-indice]");
        if (card) openPilotModal(piloti[Number(card.dataset.indice)], header);
      });
    })
    .catch(function () {
      homeErrore(body, "Errore nel caricamento dei piloti.");
    });
}

// ADMIN: ruolo e persone, una riga per ruolo
function loadHomeAdmin(url) {
  var body = document.getElementById("admin-body");
  if (!body) return;
  if (!url) return homeErrore(body, "Configurazione non trovata.");

  caricaTesto(url)
    .then(function (testo) {
      body.innerHTML = parseCsv(testo)
        .slice(1)
        .filter(function (r) {
          return (r[0] || "").trim();
        })
        .map(function (r) {
          return (
            '<div class="ui-row" style="--ui-row-cols: minmax(110px, 30%) 1fr">' +
            '<span class="ui-muted" style="font-size: var(--ui-fs-xs); letter-spacing: 1px; text-transform: uppercase">' +
            escapeHtml(r[0]) + "</span>" +
            '<span class="ui-strong">' + escapeHtml(r[1]) + "</span></div>"
          );
        })
        .join("");
    })
    .catch(function () {
      homeErrore(body, "Errore nel caricamento degli admin.");
    });
}

// -------------------------------------------------------------
// SCHEDA PILOTA: pannello #pilot-modal
// -------------------------------------------------------------
function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Icona della periferica (volante / pad) di un pilota
function perifericaIconHtml(periferica, className) {
  var p = String(periferica || "").toLowerCase();
  var src = "images/icons/social.svg";
  var alt = "Periferica";
  if (p.indexOf("volante") !== -1 || p.indexOf("wheel") !== -1 || p.indexOf("steering") !== -1) {
    src = "images/icons/volante.svg";
    alt = "Volante";
  } else if (p.indexOf("pad") !== -1 || p.indexOf("joystick") !== -1 || p.indexOf("controller") !== -1) {
    src = "images/icons/pad.svg";
    alt = "Pad";
  }
  return '<img src="' + src + '" alt="' + alt + '" title="' + alt + '" class="' + className + '">';
}

function ensurePilotModal() {
  var modal = document.getElementById("pilot-modal");
  if (modal && !modal.dataset.ready) {
    modal.dataset.ready = "1";
    modal.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) closePilotModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closePilotModal();
    });
  }
  return modal;
}

function openPilotModal(r, header) {
  var modal = ensurePilotModal();
  if (!modal || !r) return;

  // Campionati: gruppi di 4 colonne dall'indice 5 (partecipa, categoria, auto, marca)
  var impegni = [];
  for (var i = 5; i < r.length; i += 4) {
    var partecipa = String(r[i] || "").trim().toLowerCase();
    if (partecipa === "x" || partecipa === "✓" || partecipa === "1") {
      impegni.push({
        campionato: header[i] || "Campionato " + (Math.floor((i - 3) / 4) + 1),
        categoria: r[i + 1] || "",
        auto: r[i + 2] || "",
        marca: r[i + 3] || "",
      });
    }
  }

  modal.querySelector("#pilot-modal-head").innerHTML =
    '<div class="ui-pilot-top"><span class="ui-pilot-num">#' + escapeHtml(r[2]) + "</span></div>" +
    '<div class="ui-pilot-name" id="pilot-modal-title" style="font-size: var(--ui-fs-lg)">' + escapeHtml(r[0]) + "</div>" +
    (r[1] ? '<div class="ui-pilot-sub">' + escapeHtml(r[1]) + "</div>" : "");

  var html =
    '<div class="ui-kv" style="margin-top:0; align-items:center">' +
    "<div><dt>Periferica</dt><dd>" + perifericaIconHtml(r[4], "ui-icon-img") + "</dd></div>" +
    (r[3] ? "<div><dt>Info</dt><dd>" + escapeHtml(r[3]) + "</dd></div>" : "") +
    "</div>" +
    '<div class="ui-subhead" style="margin-top: var(--ui-s5)">Attualmente impegnato in</div>';

  if (!impegni.length) {
    html += '<div class="ui-state">Nessun impegno registrato.</div>';
  }
  impegni.forEach(function (it) {
    var champ = slugify(it.campionato);
    var marca = it.marca.toLowerCase().replace(/[^a-z0-9]+/g, "");
    html +=
      '<div class="ui-link" style="cursor:default">' +
      '<span class="ui-link-media"><img src="images/Campionati/' + champ + '.svg" alt=""' +
      " onerror=\"if(this.src.indexOf('.svg')!==-1){this.src='images/Campionati/" + champ + ".png'}else{this.style.display='none'}\"></span>" +
      '<span class="ui-link-body"><span class="ui-link-title">' + escapeHtml(it.campionato) +
      (it.categoria ? ' <span class="ui-badge">' + escapeHtml(it.categoria) + "</span>" : "") + "</span>" +
      '<span class="ui-link-sub" style="display:block">' + escapeHtml(it.auto) + "</span></span>" +
      (marca
        ? '<img class="ui-pilot-brand" src="images/marchi-auto/' + marca + '.svg" alt="' + escapeHtml(it.marca) + '"' +
          " onerror=\"if(this.src.indexOf('.svg')!==-1){this.src='images/marchi-auto/" + marca + ".png'}else{this.style.display='none'}\">"
        : "") +
      "</div>";
  });

  modal.querySelector("#pilot-modal-body").innerHTML = html;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  var chiudi = modal.querySelector(".ui-icon-btn");
  if (chiudi) chiudi.focus();
}

function closePilotModal() {
  var modal = document.getElementById("pilot-modal");
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
}

// -------------------------------------------------------------
// PALMARES: campionati conclusi (dati/palmares.json, scritto a mano)
// -------------------------------------------------------------
function palmaresPunti(n) {
  return String(n === null || n === undefined ? "" : n).replace(".", ",");
}

function palmaresRiga(v, campionato) {
  var gtv = !campionato.interno && v.gtv;
  return (
    '<li class="ui-row' + (gtv ? " is-gtv" : "") + '">' +
    '<span class="ui-pos">' + escapeHtml(v.pos) + "</span>" +
    (campionato.conTeam ? '<span class="ui-muted ui-ellipsis">' + escapeHtml(v.team) + "</span>" : "") +
    '<span class="ui-ellipsis' + (gtv ? " ui-strong" : "") + '">' + escapeHtml(v.pilota) +
    (v.squadra ? ' <span class="ui-badge">' + escapeHtml(v.squadra) + "</span>" : "") + "</span>" +
    '<span class="ui-num">' + palmaresPunti(v.punti) + "</span></li>"
  );
}

function palmaresLista(voci, campionato) {
  var colonne = campionato.conTeam ? "32px minmax(0, 32%) 1fr auto" : "32px 1fr auto";
  return (
    '<ol class="ui-list" style="--ui-row-cols: ' + colonne + '">' +
    voci.map(function (v) {
      return palmaresRiga(v, campionato);
    }).join("") +
    "</ol>"
  );
}

function palmaresCampionatoHtml(c) {
  var classifica = c.classifica || [];
  c.conTeam = classifica.some(function (v) {
    return v.team;
  });
  var campione = classifica.filter(function (v) {
    return v.pos === 1;
  });
  var podio = classifica.filter(function (v) {
    return v.pos <= 3;
  });
  var gtv = c.interno
    ? []
    : classifica.filter(function (v) {
        return v.gtv;
      });
  var meta = [c.stagione, c.sottotitolo].filter(Boolean).join(" · ");
  var logo = escapeHtml(c.logo || ""); // percorso locale, da palmares.json

  return (
    '<section class="ui-section">' +
    '<div class="ui-section-head"><h2 class="ui-section-title">' + escapeHtml(c.nome) + "</h2>" +
    '<span class="ui-section-meta">' + escapeHtml(meta) + "</span></div>" +
    '<div class="ui-link" style="cursor:default">' +
    (logo ? '<span class="ui-link-media"><img src="' + logo + '" alt=""></span>' : "") +
    '<span class="ui-link-body"><span class="ui-link-sub" style="display:block">Campione</span>' +
    '<span class="ui-link-title">' +
    escapeHtml(campione.map(function (v) { return v.pilota; }).join(", ") || "—") +
    "</span></span>" +
    (campione[0] ? '<span class="ui-num ui-strong">' + palmaresPunti(campione[0].punti) + " pt</span>" : "") +
    "</div>" +
    '<div class="ui-subhead" style="margin-top: var(--ui-s4)">Podio</div>' +
    palmaresLista(podio, c) +
    (gtv.length
      ? '<div class="ui-subhead" style="margin-top: var(--ui-s4)">I GTV in classifica</div>' + palmaresLista(gtv, c)
      : "") +
    '<details class="ui-acc" style="margin-top: var(--ui-s4)"><summary><span class="ui-strong">Classifica completa</span>' +
    '<span class="ui-muted" style="font-size: var(--ui-fs-xs)">' + classifica.length + " piloti</span></summary>" +
    '<div class="ui-acc-body">' + palmaresLista(classifica, c) + "</div></details>" +
    (c.regolamento
      ? '<div class="ui-btn-row" style="margin-top: var(--ui-s4)"><a class="ui-btn ui-btn--ghost" href="' +
        escapeHtml(encodeURI(c.regolamento)) + '" target="_blank" rel="noopener"><svg><use href="#i-doc"/></svg>Regolamento</a></div>'
      : "") +
    "</section>"
  );
}

function loadPalmares() {
  var body = document.getElementById("palmares-body");
  if (!body) return;
  caricaJson(datoUrl("palmares", "dati/palmares.json"))
    .then(function (dati) {
      var campionati = (dati && dati.campionati) || [];
      body.innerHTML = campionati.length
        ? campionati.map(palmaresCampionatoHtml).join("")
        : '<div class="ui-state">Nessun campionato concluso.</div>';
    })
    .catch(function () {
      homeErrore(body, "Errore nel caricamento del palmares.");
    });
}
