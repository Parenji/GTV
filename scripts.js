//MENU HAMBURGER
// Seleziona gli elementi del DOM
const menuToggle = document.getElementById("menu-toggle");
const closeMenu = document.getElementById("close-menu");
const sidebar = document.getElementById("sidebar");
const sidebarcontent = document.getElementById("sidebar-content");

/**
 * Funzione per aprire il menu
 */
function openSidebar() {
  sidebar.classList.add("open");
  // Opzionale: Disabilita lo scroll della pagina mentre il menu è aperto
  document.body.style.overflow = "hidden";
}

/**
 * Funzione per chiudere il menu
 */
function closeSidebar() {
  sidebar.classList.remove("open");
  // Opzionale: Riabilita lo scroll
  document.body.style.overflow = "auto";
}

// Collega gli eventi click ai pulsanti
menuToggle.addEventListener("click", openSidebar);
closeMenu.addEventListener("click", closeSidebar);

// Chiudi il menu cliccando fuori da esso (overlay)
document.addEventListener('click', (event) => {
    // Chiudi solo se l'elemento cliccato non è il menu, non è il pulsante, e il menu è aperto
    if (!sidebar.contains(event.target) && !menuToggle.contains(event.target) && sidebar.classList.contains('open')) {
        closeSidebar();
    }
});

// FUNZIONE PER GESTIRE IL FUNZIONAMENTO DELLA BARRA ORIZZONTALE
document.addEventListener("DOMContentLoaded", function () {
  const links = document.querySelectorAll(
    ".navbar-scroll a, .sidebar-content a, .section-link a"
  );
  const sections = document.querySelectorAll(".section");

  const breadcrumbs = {};
  const page = window.location.pathname.split('/').pop() || 'index.html';
  const menuLinks = document.querySelectorAll('.sidebar-content .menu-link');
  menuLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.startsWith('#')) {
      const sectionId = href.substring(1);
      const text = link.textContent.trim();
      if (!breadcrumbs[page]) breadcrumbs[page] = {};
      breadcrumbs[page][sectionId] = text;
    }
  });

  function updateBreadcrumb(sectionId) {
    const currentPath = window.location.pathname;
    let pageName = currentPath.split('/').pop().replace('.html', '');
    // Se il pathname è vuoto o termina con /, usa 'index' come default
    if (!pageName || pageName === '') {
      pageName = 'index';
    }
    const isIndex = pageName === 'index' || pageName === '';
    const sectionName = breadcrumbs[page] && breadcrumbs[page][sectionId] ? breadcrumbs[page][sectionId] : 'Home';
    const breadcrumbEl = document.getElementById('breadcrumb');
    if (breadcrumbEl) {
      let breadcrumbHTML = `<span style="padding: 5px 10px; border-radius: 5px;"><a href="index.html"><img src="images/gtvblack.svg" alt="GTV"></a></span> › `;
      if (!isIndex) {
        const logoSrc = pageName === 'worldchampionship' ? 'images/wc.png' : `images/Campionati/${pageName}.png`;
        const altText = pageName.toUpperCase();
        const logoStyle = pageName === 'worldchampionship' ? 'filter: brightness(0);' : 'filter: invert(1);';
        breadcrumbHTML += `<span style="padding: 5px 10px; border-radius: 5px;"><a href="${pageName}.html"><img src="${logoSrc}" alt="${altText}" style="${logoStyle}"></a></span> › `;
      }
      breadcrumbHTML += `<a href="#${sectionId}">${sectionName}</a>`;
      breadcrumbEl.innerHTML = breadcrumbHTML;
    }
  }

  function hideAllSections() {
    sections.forEach((section) => {
      section.style.display = "none";
    });
  }

  // Funzione per rimuovere la classe 'active' da tutti i link
  function removeActiveClass() {
    links.forEach((link) => {
      link.classList.remove("active");
    });
  }

  // Funzione per centrare il link attivo nella visuale

  links.forEach((link) => {
    link.addEventListener("click", function (event) {
      // event.preventDefault();
      const targetId = this.getAttribute("href").substring(1);
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        hideAllSections();
        targetElement.style.display = "block";
        updateBreadcrumb(targetId);
        sidebarcontent.addEventListener("click", closeSidebar);
        // targetElement.scrollIntoView({ behavior: "smooth" });

        // Rimuovi la classe 'active' da tutti i link e aggiungila al link cliccato
        removeActiveClass();
        this.classList.add("active");
        const linksToActivate = document.querySelectorAll(
          `a[href="#${targetId}"]`
        );

        // Applica la classe 'active' a OGNUNO di essi
        linksToActivate.forEach((linkToActivate) => {
          linkToActivate.classList.add("active");
        });
      }
    });
  });

  // Mostra la sezione iniziale (home)
  const initialSection = document.getElementById('home');
  if (initialSection) {
    initialSection.style.display = 'block';
    updateBreadcrumb('home');
  }

  // menus.forEach((menu) => {
  //   menu.addEventListener("click", function (event) {
  //     event.preventDefault();
  //     const targetId = this.getAttribute("href").substring(1);
  //     const targetElement = document.getElementById(targetId);

  //     if (targetElement) {
  //       hideAllSections();
  //       targetElement.style.display = "block";
  //       sidebarcontent.addEventListener("click", closeSidebar);

  //       // Rimuovi la classe 'active' da tutti i link e aggiungila al link cliccato
  //       removeActiveClass();
  //       this.classList.add("active");
  //     }
  //   });
  // });

  ///Mostra la prima sezione per impostazione predefinita e evidenzia il primo link
  ///Mostra la prima sezione per impostazione predefinita e evidenzia i link "Home"
  if (sections.length > 0) {
    // Controlla se c'è un hash nell'URL
    const hash = window.location.hash.substring(1); // Rimuove il #
    let targetSectionId = hash || 'home'; // Default a home se nessun hash

    // Verifica che la sezione esista
    const targetSection = document.getElementById(targetSectionId);
    
    if (targetSection) {
      // Nascondi tutte le sezioni
      hideAllSections();
      // Mostra la sezione target
      targetSection.style.display = 'block';
      // Aggiorna il breadcrumb
      updateBreadcrumb(targetSectionId);
      // Evidenzia il link attivo nel menu
      removeActiveClass();
      const linksToActivate = document.querySelectorAll(`a[href="#${targetSectionId}"]`);
      linksToActivate.forEach((link) => {
        link.classList.add("active");
      });
    } else {
      // Se la sezione non esiste, mostra la prima
      sections[0].style.display = "block";
      const homeLinks = document.querySelectorAll('a[href="#home"]');
      if (homeLinks.length > 0) {
        homeLinks.forEach((link) => {
          link.classList.add("active");
        });
      }
    }
  }

  // Aggiungi listener per i cambiamenti di hash (quando l'utente usa i pulsanti indietro/avanti)
  window.addEventListener('hashchange', function() {
    const hash = window.location.hash.substring(1);
    if (hash) {
      const targetElement = document.getElementById(hash);
      if (targetElement) {
        hideAllSections();
        targetElement.style.display = 'block';
        updateBreadcrumb(hash);
        removeActiveClass();
        const linksToActivate = document.querySelectorAll(`a[href="#${hash}"]`);
        linksToActivate.forEach((link) => {
          link.classList.add("active");
        });
      }
    }
  });
});

/**
 * Carica i dati CSV da un URL di Foglio Google e li visualizza in una tabella HTML.
 *
 * @param {string} spreadsheetUrl L'URL pubblico del Foglio Google in formato CSV.
 * @param {string} tbodyId L'ID dell'elemento <tbody> dove inserire i dati.
 * @param {number[]} [columnIndices] Gli indici delle colonne (base 0) da visualizzare.
 * Se non specificato, vengono visualizzate TUTTE le colonne.
 */
async function loadAndCreateHtmlTable(
  spreadsheetUrl,
  tbodyId,
  columnIndices,
  options = { maxRows: Infinity }
) {
  const tbody = document.getElementById(tbodyId);

  if (!tbody) {
    console.error(`Elemento <tbody> con ID "${tbodyId}" non trovato.`);
    return;
  }

  // Pulisci il contenitore prima di iniziare
  tbody.innerHTML = "";

  try {
    const response = await fetch(spreadsheetUrl);

    if (!response.ok) {
      throw new Error(
        `Errore HTTP: ${response.status} (${response.statusText})`
      );
    }

    const csvText = await response.text();

    // Funzione di parsing più robusta per CSV (anche se semplificata)
    const rows = csvText
      .trim()
      .split("\n")
      .map((row) =>
        // Suddivide le celle, gestendo le virgolette
        row.split(/,(?=(?:(?:[^\"]*"){2})*[^\"]*$)/).map((cell) =>
          cell
            .trim()
            .replace(/^\"|\"$/g, "")
            .replace(/\"\"/g, '"')
        )
      );

    if (!rows || rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="100%">Nessun dato trovato.</td></tr>`;
      return;
    }

    // La prima riga è l'intestazione
    const header = rows[0];
    // Le righe successive sono i dati, senza intestazione
    const allDataRows = rows.slice(1);

    let dataRows = [];

    // *** INIZIO NUOVA LOGICA DI FILTRAGGIO ***

    if (typeof options === "number" || options.maxRows) {
      // Caso 1: È stata passata la vecchia sintassi (solo numero) o l'opzione maxRows
      const limit = typeof options === "number" ? options : options.maxRows;
      dataRows = allDataRows.slice(0, limit);
    } else if (options.rowIndex) {
      // Caso 2: Vuoi solo una riga specifica
      // Ricorda: l'indice 'rowIndex' è 1-based (riga 1, riga 2, ecc.) e DEVE ignorare l'header.
      // Esempio: se rowIndex è 1, vogliamo allDataRows[0]
      const index0Based = options.rowIndex - 1;

      if (index0Based >= 0 && index0Based < allDataRows.length) {
        dataRows = [allDataRows[index0Based]]; // Inserisci la singola riga in un array
      } else {
        // Indice fuori dai limiti
        console.warn(`Indice riga ${options.rowIndex} non valido.`);
        dataRows = [];
      }
    } else {
      // Caso di default: mostra tutte le righe
      dataRows = allDataRows;
    }
    // 1. Definiamo quali colonne visualizzare (QUESTO BLOCCO ERA MANCANTE)
    let indicesToUse = columnIndices;
    if (!indicesToUse || indicesToUse.length === 0) {
      // Se non specificato, usiamo tutte le colonne disponibili nell'header
      indicesToUse = Array.from({ length: header.length }, (_, i) => i);
    }
    // *** FINE NUOVA LOGICA DI FILTRAGGIO ***
    // 2. Creazione delle righe di dati (<tbody>)
    for (const rowData of dataRows) {
      // Se la prima cella della riga di dati è vuota, salta la riga
      if (rowData.length === 0 || !rowData[indicesToUse[0]]) continue;

      if (tbodyId === "piloti-body") {
        // Creazione card per piloti
        const pilotCard = document.createElement("div");
        pilotCard.className = "pilot-card";
        const name = rowData[indicesToUse[0]] || "";
        const number = rowData[indicesToUse[1]] || "";
        const info = rowData[indicesToUse[2]] || "";
        const isJgtv = info.toLowerCase().includes('jgtv');
        pilotCard.innerHTML = `
          <div class="pilot-left">
            <div class="pilot-name">${name}</div>
            ${isJgtv ? '<div class="pilot-label">jgtv</div>' : ''}
          </div>
          <div class="pilot-number">#${number}</div>
        `;
        // Salva la riga completa e l'header come dataset
        pilotCard.dataset.fullRow = JSON.stringify(rowData);
        pilotCard.dataset.header = JSON.stringify(header);
        tbody.appendChild(pilotCard);
      } else if (tbodyId === "admin-body") {
        // Creazione card per admin
        const adminCard = document.createElement("div");
        adminCard.className = "admin-card";
        const role = rowData[indicesToUse[0]] || "";
        const members = rowData[indicesToUse[1]] || "";
        adminCard.innerHTML = `
          <div class="admin-role">${role}</div>
          <div class="admin-members">${members}</div>
        `;
        tbody.appendChild(adminCard);
      } else {
        // Creazione tradizionale per altre tabelle
        const tr = document.createElement("tr");
        let innerHTML = "";

        // 3. Iteriamo solo sugli indici di colonna che vogliamo visualizzare
        for (const colIndex of indicesToUse) {
          // Prende il valore della cella, o una stringa vuota se la cella non esiste
          const cellValue = rowData[colIndex] || "";
          // Prende il nome della colonna dall'header, o un nome generico
          const columnName = header[colIndex] || "";

          let cellContent = cellValue; // Contenuto di default è il testo

          // 🌟 NUOVA LOGICA PER LA GESTIONE DELLE IMMAGINI 🌟

          // Normalizziamo il valore della cella per creare il path del file
          const fileSlug = cellValue.toLowerCase().replace(/[^a-z0-9]+/g, "");

          if (columnName === "Circuito") {
            // Esempio: images/tracks/autopolis.png (o .svg)
            const imagePath = `images/tracks/${fileSlug}.png`;

            cellContent = `
                        <img 
                            src="${imagePath}" 
                            alt="${cellValue}" 
                            class="circuit-icon"
                            onerror="this.onerror=null; this.src='images/tracks/${fileSlug}.svg'; if(this.alt === 'images/tracks/${fileSlug}.svg') this.style.display='none'; this.alt='images/tracks/${fileSlug}.svg';"                        />
                    `;
          } else if (columnName === "Nazione" || columnName === "Country") {
            // Esempio: images/flags/jp.svg (o .png). Assumiamo bandiere in cartella "flags"
            const flagPath = `images/bandiere/${fileSlug}.svg`;

            cellContent = `
                        <img 
                            src="${flagPath}" 
                            alt="${cellValue}" 
                            class="nation-flag"
                            onerror="this.onerror=null; this.style.display='none';" 
                        />
                    `;
          }
          // Aggiungi la cella con il contenuto (testo o HTML dell'immagine)
          innerHTML += `<td data-label="${columnName}">${cellContent}</td>`;
        }

        tr.innerHTML = innerHTML;
        // Salva la riga completa e l'header come dataset sull'elemento <tr>
        tr.dataset.fullRow = JSON.stringify(rowData);
        tr.dataset.header = JSON.stringify(header);
        tbody.appendChild(tr);
      }
    }

    // Se stiamo popolando la tabella dei piloti, aggiungiamo gli handler di click
    if (tbodyId === "piloti-body") {
      // Aggiungi classe/cursore e listener all'intera card di ogni pilota
      const pilotCards = tbody.querySelectorAll(".pilot-card");
      pilotCards.forEach((card) => {
        card.classList.add("pilota-link");
        card.style.cursor = "pointer";
        // Evitiamo agganciare più volte lo stesso listener
        if (!card._pilotHandlerAttached) {
          card.addEventListener("click", () => {
            let fullRow = [];
            let headerArr = [];
            try {
              fullRow = JSON.parse(card.dataset.fullRow || "[]");
              headerArr = JSON.parse(card.dataset.header || "[]");
            } catch (e) {
              console.error("Errore parsing dataset card pilota", e);
            }
            openPilotModal(fullRow, headerArr);
          });
          card._pilotHandlerAttached = true;
        }
      });
    }
  } catch (error) {
    console.error("Errore nel caricamento dei dati:", error);
    // Calcola colspan in base al numero di colonne che si dovevano usare
    const colspan = columnIndices ? columnIndices.length : 1;

    if (tbodyId === "piloti-body" || tbodyId === "admin-body") {
      tbody.innerHTML = `
        <div style="text-align: center; color: red; padding: 20px;">
          ❌ Errore nel caricamento dei dati.
        </div>
      `;
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="${colspan}" style="text-align: center; color: red; padding: 20px;">
            ❌ Errore nel caricamento dei dati.
          </td>
        </tr>
      `;
    }
  }
}
//Funzione per opzioni stanza
// **!!! IMPORTANTE !!!** Sostituisci questo con il link CSV esportato da Google Fogli
const CSV_URL = "YOUR_CSV_LINK_HERE";
const container = document.getElementById("card-output");

/**
 * Funzione per convertire una riga CSV in un oggetto data.
 * Assumiamo che la colonna 0 sia il Titolo (in alto) e la colonna 1 sia il Corpo (in basso).
 * @param {string} line - La riga CSV come stringa.
 * @returns {{header: string, body: string} | null} L'oggetto dati della card.
 */
function parseCsvLine(line) {
  // Semplice suddivisione per virgola (adatta se i tuoi dati non contengono virgole interne)
  const columns = line.split(",");

  // Controlla se ci sono almeno due colonne
  if (columns.length < 2) {
    return null;
  }

  // Pulisce gli spazi bianchi all'inizio/fine
  const header = columns[0].trim();
  const body = columns[1].trim();

  if (!header || !body) {
    return null; // Salta righe vuote o incomplete
  }

  return { header: header, body: body };
}

/**
 * Funzione per generare il markup HTML di una singola card.
 * @param {{header: string, body: string}} data - I dati della card.
 * @returns {string} Il codice HTML della card.
 */
function generateCardHtml(data) {
  return `
        <div class="opzioni-card">
            <div class="opzioni-card-header">${data.header}</div>
            <div class="opzioni-card-body">${data.body}</div>
        </div>
    `;
}

/**
 * Funzione principale per caricare i dati e popolare il DOM.
 */
async function loadDataAndGenerateCards(spreadsheetUrl) {
  try {
    // 1. Fetch dei dati dal link CSV
    const response = await fetch(spreadsheetUrl);

    // Controlla se la risposta è ok (status 200)
    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status}`);
    }

    const csvText = await response.text();

    // 2. Analisi del CSV
    // Divide il testo in righe e filtra le righe vuote
    const lines = csvText.split("\n").filter((line) => line.trim() !== "");

    // Salta la prima riga se contiene le intestazioni
    const dataLines = lines.slice(1);

    // 3. Generazione e iniezione delle card
    let htmlCards = "";
    dataLines.forEach((line) => {
      const cardData = parseCsvLine(line);
      if (cardData) {
        htmlCards += generateCardHtml(cardData);
      }
    });

    // Inietta tutte le card nel contenitore (ottimizzazione delle performance)
    container.innerHTML = htmlCards;
  } catch (error) {
    console.error(
      "Si è verificato un errore durante il caricamento o l'analisi dei dati:",
      error
    );
    container.innerHTML = `<p style="color: red;">Impossibile caricare i dati. Controlla il link CSV o la console.</p>`;
  }
}

// Funzione per caricare e visualizzare i dati del team e piloti
async function loadTeamAndPiloti(spreadsheetUrl) {
  const container = document.getElementById("team-piloti-container");
  
  if (!container) {
    console.error("Container 'team-piloti-container' non trovato.");
    return;
  }

  try {
    const response = await fetch(spreadsheetUrl);
    
    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status}`);
    }

    const csvText = await response.text();
    
    // Parsing del CSV
    const rows = csvText
      .trim()
      .split("\n")
      .map((row) =>
        row.split(/,(?=(?:(?:[^\"]*"){2})*[^\"]*$)/).map((cell) =>
          cell
            .trim()
            .replace(/^\"|\"$/g, "")
            .replace(/\"\"/g, '"')
        )
      );

    if (!rows || rows.length === 0) {
      container.innerHTML = '<div class="error-message">Nessun dato trovato.</div>';
      return;
    }

    // La prima riga è l'intestazione
    const header = rows[0];
    // Le righe successive sono i dati
    const dataRows = rows.slice(1);

    let htmlTeams = "";
    
    dataRows.forEach((rowData, index) => {
      const team = rowData[0] || "";
      const marchio = rowData[1] || "";
      const auto = rowData[2] || "";
      const pilota1 = rowData[3] || "";
      const pilota2 = rowData[4] || "";

      if (!team) return; // Salta righe vuote

      // Normalizzazione del marchio per trovare il logo
      const marchioSlug = marchio.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const marchioLogoPath = `images/marchi-auto/${marchioSlug}.svg`;
      
      // Normalizzazione del nome auto per l'immagine
      const autoSlug = team.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const autoImagePath = `images/livree/${autoSlug}.png`;

      htmlTeams += `
        <div class="team-card">
          <div class="team-header">
            <div class="team-name">${team}</div>
            <div class="team-brand">
              <img src="${marchioLogoPath}" alt="${marchio}" class="brand-logo" 
                   onerror="this.onerror=null; this.src='images/marchi-auto/${marchioSlug}.png'; if(this.src.endsWith('${marchioSlug}.png') && this.naturalWidth === 0) this.style.display='none';" />
            </div>
          </div>
          <div class="team-car">
            <img src="${autoImagePath}" alt="${auto}" class="car-image" 
                 onerror="this.onerror=null; this.style.display='none';" />
            <div class="car-name">${auto}</div>
          </div>
          <div class="team-pilots">
            <div class="pilot-info">
              <div class="pilot-avatar"></div>
              <div class="pilot-name">${pilota1}</div>
            </div>
            ${pilota2 ? `
              <div class="pilot-info">
                <div class="pilot-avatar"></div>
                <div class="pilot-name">${pilota2}</div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = htmlTeams;

  } catch (error) {
    console.error("Errore nel caricamento dei dati del team:", error);
    container.innerHTML = '<div class="error-message">Impossibile caricare i dati del team. Controlla la console per dettagli.</div>';
  }
}

// ---------- Pilot modal helper functions ----------

function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensurePilotModalExists() {
  let modal = document.getElementById("pilot-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "pilot-modal";
  modal.className = "pilot-modal";
  modal.innerHTML = `
    <div class="pilot-modal-backdrop" id="pilot-modal-backdrop"></div>
    <div class="pilot-modal-content" role="dialog" aria-modal="true">
      <button class="pilot-modal-close" id="pilot-modal-close">×</button>
      <div class="pilot-modal-body" id="pilot-modal-body"></div>
    </div>
  `;
  document.body.appendChild(modal);

  // Close handlers
  modal
    .querySelector("#pilot-modal-close")
    .addEventListener("click", closePilotModal);
  modal
    .querySelector("#pilot-modal-backdrop")
    .addEventListener("click", closePilotModal);

  return modal;
}

function openPilotModal(fullRow, headerArr) {
  if (!fullRow || fullRow.length === 0) return;
  const modal = ensurePilotModalExists();
  const body = modal.querySelector("#pilot-modal-body");

  const name = fullRow[0] || "";
  const number = fullRow[1] || "";
  const info = fullRow[2] || "";

  // Build championships list (groups of 4 starting at index 3)
  const items = [];
  for (let i = 3; i < fullRow.length; i += 4) {
    const participates = (fullRow[i] || "").toString().trim().toLowerCase();
    if (participates === "x" || participates === "✓" || participates === "1") {
      const champName =
        headerArr && headerArr[i]
          ? headerArr[i]
          : `Campionato ${Math.floor((i - 3) / 4) + 1}`;
      const category = fullRow[i + 1] || "";
      const carUsed = fullRow[i + 2] || "";
      const brand = fullRow[i + 3] || "";
      items.push({ champName, category, carUsed, brand });
    }
  }

  // Render HTML
  let html = "";
  html += `<div class="pilot-header"><div class="pilot-name">${escapeHtml(
    name
  )}</div><div class="pilot-number">#${escapeHtml(number)}</div></div>`;
  if (info) html += `<div class="pilot-info">${escapeHtml(info)}</div>`;

  html += `<h4 class="pilot-section-title">Attualmente impegnato in:</h4>`;
  if (items.length === 0) {
    html += `<div class="pilot-no-item">Nessun impegno registrato.</div>`;
  } else {
    html += `<div class="pilot-champ-list">`;
    items.forEach((it) => {
      const champSlug = slugify(it.champName);
      const champImgPng = `images/Campionati/${champSlug}.png`;
      const champImgSvg = `images/Campionati/${champSlug}.svg`;
      const brandSlug = slugify(it.brand);
      const brandImgPng = `images/marchi-auto/${brandSlug}.png`;
      const brandImgSvg = `images/marchi-auto/${brandSlug}.svg`;

      function fixImg(el, fallback) {
        // Evita loop infiniti
        el.onerror = null;
        // Tenta il secondo formato
        el.src = fallback;
        // Se fallisce anche il secondo, nascondi l'immagine
        el.addEventListener(
          "error",
          () => {
            el.style.display = "none";
          },
          { once: true }
        );
      }
      html += `<div class="pilot-champ-item">
<div class="pilot-champ-logo-left">
<img src="${champImgSvg}" 
     alt="${escapeHtml(it.champName)}" 
     class="pilot-champ-logo" 
     onerror="if(this.src.includes('.png')){this.src='${champImgPng}';}else{this.style.display='none';}" />
</div>
                <div class="pilot-champ-center">
                  <div class="pilot-champ-name">${escapeHtml(it.champName)}</div>
                  <div class="pilot-champ-category">${escapeHtml(it.category)}</div>
                  <div class="pilot-champ-car-name">${escapeHtml(it.carUsed)}</div>
                </div>
                <div class="pilot-champ-logo-right">
<img src="${brandImgPng}" 
     alt="${escapeHtml(it.brand)}" 
     class="pilot-brand-logo" 
     onerror="if(this.src.includes('.png')){this.src='${brandImgSvg}';}else{this.style.display='none';}" />           
                </div>
              </div>`;
    });
    html += `</div>`;
  }

  body.innerHTML = html;

  // Show modal
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closePilotModal() {
  const modal = document.getElementById("pilot-modal");
  if (!modal) return;
  modal.classList.remove("open");
  document.body.style.overflow = "auto";
}

function escapeHtml(unsafe) {
  return (unsafe || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
  const config = window.GTV_CONFIG;
  if (!config) {
    console.error(
      "GTV_CONFIG non trovato. Assicurati di caricare config.js prima di scripts.js."
    );
    return;
  }
  // --- 1. Logica per index.html ---

  // Controlla se la pagina ha l'ID 'piloti-body' (il che indica che siamo in index.html)
  const pilotiBody = document.getElementById("piloti-body");

  if (pilotiBody) {
    console.log("Inizializzazione di index.html: Caricamento Piloti e Admin.");

    // --- Tabella Piloti ---
    const URL_PILOTI = config.googleSheets.piloti;
    loadAndCreateHtmlTable(URL_PILOTI, "piloti-body", [0, 1, 2]);

    // --- Tabella Admin ---
    const URL_ADMIN = config.googleSheets.admin;
    loadAndCreateHtmlTable(URL_ADMIN, "admin-body", [0, 1]);
  }

  // --- 2. Logica per gtec.html ---

  // Controlla se la pagina ha l'ID 'gtec' (il che indica che siamo in gtec.html)
  const gtec = document.getElementById("gtec");

  if (gtec) {
    console.log("Inizializzazione di gtec.html: Caricamento...");
    let ultimaGara = 7; // Cambia questo numero quando vuoi aggiornare la gara
    prossimaGara = ultimaGara + 1;
    document.getElementById(
      "pen-ult-gara"
    ).innerText = `Penalità Gara ${ultimaGara}`;
    document.getElementById("lobby-next-gara").innerText = `Gara ${
      ultimaGara + 1
    }`;
    document.getElementById("info-next-gara").innerText = `Opzioni Lobby Gara ${
      ultimaGara + 1
    }`;

    // --- Tabella Lobby ---
    const URL_LOBBY = config.googleSheets.gtec.lobby;
    loadAndCreateHtmlTable(
      URL_LOBBY,
      "lobby-body"
      // [0, 1,] - (Usare l'array vuoto o `null` se si vogliono tutte le colonne,
      // altrimenti specificare quelle che vuoi mostrare)
    );
    // --- Tabella Lobby Promo e retro ---
    const URL_PROMRETR = config.googleSheets.gtec.promoRetro;
    loadAndCreateHtmlTable(
      URL_PROMRETR,
      "proret-body"
      // [0, 1,] - (Usare l'array vuoto o `null` se si vogliono tutte le colonne,
      // altrimenti specificare quelle che vuoi mostrare)
    );
    // --- Tabella classifica ---
    const URL_CLASS = config.googleSheets.gtec.classifica;
    loadAndCreateHtmlTable(
      URL_CLASS,
      "classifica-body"
      // [0, 1,] - (Usare l'array vuoto o `null` se si vogliono tutte le colonne,
      // altrimenti specificare quelle che vuoi mostrare)
    );
    // Tabella top10
    loadAndCreateHtmlTable(
      URL_CLASS,
      "classifica-short-body",
      [],
      10

      //   [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      // altrimenti specificare quelle che vuoi mostrare)
    );
    // Penalità
    const URL_PEN = config.googleSheets.gtec.penalita;
    loadAndCreateHtmlTable(
      URL_PEN,
      "penalita-body"

      //   [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      // altrimenti specificare quelle che vuoi mostrare)
    );

    const URL_CALENDAR = config.googleSheets.gtec.calendario;
    loadAndCreateHtmlTable(
      URL_CALENDAR,
      "prossima-gara-body",
      [0, 3, 2, 1, 4], //(Usare l'array vuoto o `null` se si vogliono tutte le colonne,
      { rowIndex: prossimaGara }
      // altrimenti specificare quelle che vuoi mostrare)
    );

    loadAndCreateHtmlTable(
      URL_CALENDAR,
      "calendar-body",
      [0, 3, 2, 1, 4] //(Usare l'array vuoto o `null` se si vogliono tutte le colonne,
      // altrimenti specificare quelle che vuoi mostrare)
    );

    // Avvia il processo al caricamento della pagina
    const URL_OPZIONI = config.googleSheets.gtec.opzioniLobby;
    loadDataAndGenerateCards(URL_OPZIONI);
  }

  // --- 3. Logica per worldchampionship.html ---

  const worldchampionship = document.getElementById("worldchampionship");

  if (worldchampionship) {
    console.log("Inizializzazione di worldchampionship.html: Caricamento...");
    let ultimaGara = 0; // Cambia questo numero quando vuoi aggiornare la gara
    prossimaGara = ultimaGara + 1;
    document.getElementById(
      "pen-ult-gara"
    ).innerText = `Penalità Gara ${ultimaGara}`;
    document.getElementById("lobby-next-gara").innerText = `Gara ${
      ultimaGara + 1
    }`;
    document.getElementById("info-next-gara").innerText = `Opzioni Lobby Gara ${
      ultimaGara + 1
    }`;

    const URL_LOBBY = config.googleSheets.worldchampionship.lobby;
    loadAndCreateHtmlTable(URL_LOBBY, "lobby-body");

    const URL_PROMRETR = config.googleSheets.worldchampionship.promoRetro;
    loadAndCreateHtmlTable(URL_PROMRETR, "proret-body");

    const URL_CLASS = config.googleSheets.worldchampionship.classifica;
    loadAndCreateHtmlTable(URL_CLASS, "classifica-body");
    loadAndCreateHtmlTable(URL_CLASS, "classifica-short-body", [], 10);

    const URL_PEN = config.googleSheets.worldchampionship.penalita;
    loadAndCreateHtmlTable(URL_PEN, "penalita-body");

    const URL_CALENDAR = config.googleSheets.worldchampionship.calendario;
    loadAndCreateHtmlTable(URL_CALENDAR, "prossima-gara-body", [0, 3, 2, 1, 4], {
      rowIndex: prossimaGara,
    });
    loadAndCreateHtmlTable(URL_CALENDAR, "calendar-body", [0, 3, 2, 1, 4]);

    const URL_OPZIONI = config.googleSheets.worldchampionship.opzioniLobby;
    loadDataAndGenerateCards(URL_OPZIONI);

    const URL_TEAM_PILOTI = config.googleSheets.worldchampionship.teamPiloti;
    loadTeamAndPiloti(URL_TEAM_PILOTI);
  }
  // --- 4. Logica per interno.html ---

  // Controlla se la pagina ha l'ID 'gtec' (il che indica che siamo in gtec.html)
  const interno = document.getElementById("interno");

  if (interno) {
    console.log("Inizializzazione di gtec.html: Caricamento...");

    // --- Tabella calendar ---
    const URL_CALENDAR = config.googleSheets.interno.calendario;
    loadAndCreateHtmlTable(
      URL_CALENDAR,
      "calendar-body",
      [0, 2, 1, 3] //(Usare l'array vuoto o `null` se si vogliono tutte le colonne,
      // altrimenti specificare quelle che vuoi mostrare)
    );
  }
});
