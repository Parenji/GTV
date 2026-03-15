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
/**
 * Carica e visualizza l'intero calendario con stile next-race
 * @param {string} spreadsheetUrl URL del Google Sheet CSV
 */
async function loadCalendar(spreadsheetUrl) {
  const container = document.getElementById("calendar-body");

  if (!container) {
    console.error('Elemento "calendar-body" non trovato.');
    return;
  }

  try {
    const response = await fetch(spreadsheetUrl);

    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status} (${response.statusText})`);
    }

    const csvText = await response.text();

    // Parsing CSV
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
      container.innerHTML = '<div class="race-item"><div style="text-align: center; padding: 15px;">Nessuna gara trovata</div></div>';
      return;
    }

    const allDataRows = rows.slice(1); // Salta l'intestazione
    let html = '';

    // Genera HTML per ogni gara
    allDataRows.forEach((raceData, index) => {
      // Colonne: [0]gara, [1]data, [2]circuito, [3]nazione, [4]altre info
      const gara = raceData[0] || '';
      const data = raceData[1] || '';
      const circuito = raceData[2] || '';
      const nazione = raceData[3] || '';
      const altreInfo = raceData[4] || '';

      let circuitLogo = '';

      // Prepara il logo del circuito se esiste
      if (circuito) {
        // Mapping per nomi comuni che potrebbero non corrispondere
        const circuitMapping = {
          'daytona': 'daytona',
          'autopolis': 'autopolis', 
          'deep forest': 'deep-forest',
          'dragon trail': 'dragon',
          'fuji': 'fuji',
          'interlagos': 'interlagos',
          'laguna seca': 'lagunaseca',
          'laguna seca': 'lagunaseca',
          'monza': 'monza',
          'mount panorama': 'mountpanorama',
          'mount panorama': 'mountpanorama',
          'red bull ring': 'rbr',
          'rbr': 'rbr',
          'sardegna': 'sardegna',
          'spa': 'spa',
          'spa francorchamps': 'spa',
          'suzuka': 'suzuka',
          'tokyo': 'tokyo',
          'watkins glen': 'watkins',
          'watkins': 'watkins',
          'yas marina': 'yasmarina',
          'yas marina': 'yasmarina'
        };

        // Pulisci e normalizza il nome del circuito
        const cleanName = circuito.toLowerCase().trim();
        const circuitName = circuitMapping[cleanName] || cleanName.replace(/\s+/g, '_').replace(/[^\w]/g, '');
        
        circuitLogo = `<img src="images/tracks/${circuitName}.png" alt="${circuito}" style="width: 100%; max-width: 180px; height: 50px; object-fit: contain; display: block; margin: 10px auto 0;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><div style="display: none; text-align: center; color: rgba(255,255,255,0.5); font-size: 0.8em; margin-top: 10px;">🛣️ ${circuito}</div>`;
      }

      // Layout compatto e mobile-friendly per ogni gara
      html += `
        <div class="race-item">
          <div style="text-align: center; padding: 8px;">
            <!-- Header Gara -->
            <div style="margin-bottom: 8px;">
              <div style="font-size: 0.8em; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
                Gara ${index + 1}
              </div>
              <div style="font-size: 1.4em; font-weight: 700; color: var(--giallogtv); text-transform: uppercase; letter-spacing: 1px;">
                ${gara || 'N/D'}
              </div>
            </div>
            
            <!-- Data -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px; background: rgba(191,239,255,0.1); padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(191,239,255,0.2);">
              <span style="font-size: 1em;">📅</span>
              <span style="font-size: 0.9em; font-weight: 600; color: rgba(255,255,255,0.9);">${data || 'N/D'}</span>
            </div>
            
            <!-- Logo Circuit -->
            ${circuito ? `
              <div style="margin-bottom: 8px;">
                ${circuitLogo}
              </div>
            ` : ''}
            
            <!-- Info -->
            ${altreInfo && altreInfo.trim() !== '' ? `
              <div style="background: rgba(255,255,255,0.05); padding: 6px 10px; border-radius: 6px; border-left: 2px solid var(--giallogtv);">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 0.9em;">ℹ️</span>
                  <span style="font-size: 0.8em; color: rgba(255,255,255,0.8);">${altreInfo}</span>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

  } catch (error) {
    console.error('Errore nel caricamento del calendario:', error);
    container.innerHTML = '<div class="race-item"><div style="text-align: center; padding: 15px;">Errore nel caricamento</div></div>';
  }
}

/**
 * Carica e visualizza la prossima gara con stile top10
 * @param {string} spreadsheetUrl URL del Google Sheet CSV
 * @param {number} rowIndex Indice della riga (1-based)
 */
async function loadNextRace(spreadsheetUrl, rowIndex) {
  const container = document.getElementById("prossima-gara-body");

  if (!container) {
    console.error('Elemento "prossima-gara-body" non trovato.');
    return;
  }

  try {
    const response = await fetch(spreadsheetUrl);

    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status} (${response.statusText})`);
    }

    const csvText = await response.text();

    // Parsing CSV
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
      container.innerHTML = '<div class="race-info-item"><div class="race-info-content"><div class="race-info-value">Nessuna gara trovata</div></div></div>';
      return;
    }

    const header = rows[0];
    const allDataRows = rows.slice(1);
    const index0Based = rowIndex - 1;

    if (index0Based >= 0 && index0Based < allDataRows.length) {
      const raceData = allDataRows[index0Based];
      
      // Colonne: [0]gara, [1]data, [2]circuito, [3]nazione, [4]altre info
      const gara = raceData[0] || '';
      const data = raceData[1] || '';
      const circuito = raceData[2] || '';
      const nazione = raceData[3] || '';
      const altreInfo = raceData[4] || '';

      // Genera HTML con stile top10 - Layout mobile-first moderno
      let html = '';
      let circuitLogo = '';

      // Prepara il logo del circuito se esiste
      if (circuito) {
        // Mapping per nomi comuni che potrebbero non corrispondere
        const circuitMapping = {
          'daytona': 'daytona',
          'autopolis': 'autopolis', 
          'deep forest': 'deep-forest',
          'dragon trail': 'dragon',
          'fuji': 'fuji',
          'interlagos': 'interlagos',
          'laguna seca': 'lagunaseca',
          'laguna seca': 'lagunaseca',
          'monza': 'monza',
          'mount panorama': 'mountpanorama',
          'mount panorama': 'mountpanorama',
          'red bull ring': 'rbr',
          'rbr': 'rbr',
          'sardegna': 'sardegna',
          'spa': 'spa',
          'spa francorchamps': 'spa',
          'suzuka': 'suzuka',
          'tokyo': 'tokyo',
          'watkins glen': 'watkins',
          'watkins': 'watkins',
          'yas marina': 'yasmarina',
          'yas marina': 'yasmarina'
        };

        // Pulisci e normalizza il nome del circuito
        const cleanName = circuito.toLowerCase().trim();
        const circuitName = circuitMapping[cleanName] || cleanName.replace(/\s+/g, '_').replace(/[^\w]/g, '');
        
        circuitLogo = `<img src="images/tracks/${circuitName}.png" alt="${circuito}" style="width: 100%; max-width: 200px; height: 60px; object-fit: contain; display: block; margin: 15px auto 0;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><div style="display: none; text-align: center; color: rgba(255,255,255,0.5); font-size: 0.9em; margin-top: 10px;">🛣️ ${circuito}</div>`;
      }

      // Layout compatto e mobile-friendly
      html += `
        <div style="text-align: center; padding: 10px;">
          <!-- Header Gara -->
          <div style="margin-bottom: 10px;">
            <div style="font-size: 0.9em; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
              Gara
            </div>
            <div style="font-size: 2em; font-weight: 800; color: var(--giallogtv); text-transform: uppercase; letter-spacing: 1px;">
              ${gara || 'N/D'}
            </div>
          </div>
          
          <!-- Data -->
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 10px; background: rgba(191,239,255,0.1); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(191,239,255,0.2);">
            <span style="font-size: 1.2em;">📅</span>
            <span style="font-size: 1em; font-weight: 600; color: rgba(255,255,255,0.9);">${data || 'N/D'}</span>
          </div>
          
          <!-- Logo Circuit -->
          ${circuito ? `
            <div style="margin-bottom: 10px;">
              ${circuitLogo}
            </div>
          ` : ''}
          
          <!-- Info -->
          ${altreInfo && altreInfo.trim() !== '' ? `
            <div style="background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 8px; border-left: 3px solid var(--giallogtv);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.1em;">ℹ️</span>
                <span style="font-size: 0.9em; color: rgba(255,255,255,0.8);">${altreInfo}</span>
              </div>
            </div>
          ` : ''}
        </div>
      `;

      container.innerHTML = html;
    } else {
      container.innerHTML = '<div class="race-info-item"><div class="race-info-content"><div class="race-info-value">Gara non trovata</div></div></div>';
    }

  } catch (error) {
    console.error('Errore nel caricamento della prossima gara:', error);
    container.innerHTML = '<div class="race-info-item"><div class="race-info-content"><div class="race-info-value">Errore nel caricamento</div></div></div>';
  }
}

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

  // Rimuovi la classe loading se presente
  const tableContainer = tbody.closest('.table-container');
  if (tableContainer && tableContainer.classList.contains('loading')) {
    tableContainer.classList.remove('loading');
  }

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

// Funzione per caricare e visualizzare le lobby in formato card
async function loadLobbyCards(spreadsheetUrl) {
  const container = document.getElementById("lobby-body");
  
  if (!container) {
    console.error("Container 'lobby-body' non trovato.");
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

    const dataRows = rows.slice(1); // Salta l'header
    let htmlCards = "";
    
    dataRows.forEach((rowData, index) => {
      if (rowData.length < 4) return; // Salta righe incomplete
      
      // Estrai le info della gara (prime 4 colonne)
      const date = rowData[0] || "";
      const time = rowData[1] || "";
      const category = rowData[2] || "";
      const host = rowData[3] || "";
      const live = rowData[4] || "";
      
      // Estrai i piloti (dalla colonna 5 in poi)
      const pilots = rowData.slice(5).filter(pilot => pilot && pilot.trim() !== "");
      
      if (!date || !time || !category) return; // Salta righe senza dati essenziali
      
      // Genera la card
      htmlCards += `
        <div class="lobby-card">
          <div class="lobby-card-header">
            <div class="lobby-datetime">
              <div class="lobby-date">${escapeHtml(date)}</div>
              <div class="lobby-time">${escapeHtml(time)}</div>
            </div>
            <div class="lobby-category">${escapeHtml(category)}</div>
          </div>
          
          <div class="lobby-info-section">
            ${host ? `
              <div class="lobby-host">
                <div class="lobby-host-icon">👤</div>
                <div class="lobby-host-content">
                  <div class="lobby-host-label">Host</div>
                  <div class="lobby-host-name">${escapeHtml(host)}</div>
                </div>
              </div>
            ` : ''}
            
            ${live ? `
              <div class="lobby-live">
                <div class="lobby-live-icon">🔴</div>
                <div class="lobby-live-content">
                  <div class="lobby-live-label">Live su</div>
                  <div class="lobby-live-name">${escapeHtml(live)}</div>
                </div>
                <div class="lobby-live-badge">LIVE</div>
              </div>
            ` : ''}
          </div>
          
          ${pilots.length > 0 ? `
            <div class="lobby-pilots-section">
              <div class="lobby-pilots-title">Piloti Iscritti (${pilots.length})</div>
              <div class="lobby-pilots-grid">
                ${pilots.map((pilot, pilotIndex) => `
                  <div class="lobby-pilot" title="${escapeHtml(pilot)}">
                    <div class="lobby-pilot-name">${escapeHtml(pilot)}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    });

    container.innerHTML = htmlCards || '<div class="error-message">Nessuna lobby trovata.</div>';

  } catch (error) {
    console.error("Errore nel caricamento delle lobby:", error);
    container.innerHTML = '<div class="error-message">Impossibile caricare le lobby. Controlla la console per dettagli.</div>';
  }
}

// Funzione per creare le 4 classifiche rivoluzionate
async function loadAllClassifications(spreadsheetUrl) {
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
      return;
    }

    const dataRows = rows.slice(1); // Salta l'header
    
    // Separa i dati per tipo di classifica
    const allPilots = [];
    const jgtvPilots = [];
    const nonJgtvPilots = [];
    const teams = {};
    
    dataRows.forEach((row) => {
      if (row.length < 7) return;
      
      const position = row[0] || "";
      const pilot = row[1] || "";
      const number = row[2] || "";
      const team = row[3] || "";
      const marchio = row[4] || "";
      const isJgtv = row[5] || "";
      const points = parseInt(row[6]) || 0;
      
      const pilotData = { position, pilot, number, team, marchio, points };
      
      // Aggiungi a tutti i piloti
      allPilots.push(pilotData);
      
      // Separa per JGTV e non-JGTV
      if (isJgtv.toLowerCase() === 'jgtv') {
        jgtvPilots.push(pilotData);
      } else {
        nonJgtvPilots.push(pilotData);
      }
      
      // Calcola punti per team
      if (team) {
        if (!teams[team]) {
          teams[team] = { team, points: 0, pilots: [], marchio: marchio };
        }
        teams[team].points += points;
        teams[team].pilots.push(pilotData);
      }
    });
    
    // Ordina tutte le classifiche
    allPilots.sort((a, b) => b.points - a.points);
    jgtvPilots.sort((a, b) => b.points - a.points);
    nonJgtvPilots.sort((a, b) => b.points - a.points);
    
    const teamRanking = Object.values(teams).sort((a, b) => b.points - a.points);
    
    // Genera HTML per le 4 classifiche
    generateClassificationHTML('classifica-generale-piloti', allPilots, 'Classifica Piloti');
    generateClassificationHTML('classifica-generale-team', teamRanking, 'Classifica Team', true);
    generateClassificationHTML('classifica-jgtv-piloti', jgtvPilots, 'Classifica Piloti JGTV');
    generateClassificationHTML('classifica-non-jgtv-piloti', nonJgtvPilots, 'Classifica Piloti GTV');
    
    // Genera Top 10 per la home
    generateTop10Home(allPilots.slice(0, 10));

  } catch (error) {
    console.error("Errore nel caricamento delle classifiche:", error);
  }
}

// Funzione per generare HTML delle classifiche
function generateClassificationHTML(containerId, data, title, isTeam = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  let html = `
    <div class="classification-accordion">
      <div class="accordion" onclick="toggleAccordion(this)">
        <div class="accordion-header">
          <div class="accordion-title">${title}</div>
          <div class="accordion-subtitle">${data.length} ${isTeam ? 'team' : 'piloti'}</div>
          <i><svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="2" fill="none"/></svg></i>
        </div>
      </div>
      <div class="panel">
        <div class="classification-table">
  `;
  
  data.forEach((item, index) => {
    // Normalizza il nome del marchio per il percorso dell'immagine
    const normalizedMarchio = item.marchio.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
    
    if (isTeam) {
      html += `
        <div class="pilot-ranking-item">
          <div class="pilot-position">${index + 1}</div>
          <div class="pilot-number-circle" style="background: ${getTeamColor(item.team)}">
            <img src="images/marchi-auto/${normalizedMarchio}.svg" alt="${escapeHtml(item.marchio)}" class="team-logo ${item.team === 'Gliscappatidicasa' ? 'invert-colors' : ''}" onerror="this.style.display='none'">
          </div>
          <div class="pilot-name">${escapeHtml(item.team)}</div>
          <div class="pilot-team">${item.pilots.map(p => escapeHtml(p.number)).join(', ')}</div>
          <div class="pilot-points">${item.points}</div>
        </div>
      `;
    } else {
      html += `
        <div class="pilot-ranking-item">
          <div class="pilot-position">${index + 1}</div>
          <div class="pilot-number-circle" style="background: ${getTeamColor(item.team)}">
            <img src="images/marchi-auto/${normalizedMarchio}.svg" alt="${escapeHtml(item.marchio)}" class="team-logo ${item.team === 'Gliscappatidicasa' ? 'invert-colors' : ''}" onerror="this.style.display='none'">
          </div>
          <div class="pilot-name">${escapeHtml(item.pilot)}</div>
          <div class="pilot-team">${escapeHtml(item.team)}</div>
          <div class="pilot-points">${item.points}</div>
        </div>
      `;
    }
  });
  
  html += `
        </div>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

// Funzione per generare Top 10 Home
function generateTop10Home(data) {
  const container = document.getElementById("classifica-short-body");
  if (!container) return;
  
  let html = '<div class="top10-home">';
  html += '<div class="top10-header"><div class="top10-title">Top 10</div><div class="top10-subtitle">Classifica Generale</div></div>';
  html += '<div class="classification-table">';
  
  data.forEach((item, index) => {
    // Normalizza il nome del marchio per il percorso dell'immagine
    const normalizedMarchio = item.marchio.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
    html += `
      <div class="pilot-ranking-item">
        <div class="pilot-position">${index + 1}</div>
        <div class="pilot-number-circle" style="background: ${getTeamColor(item.team)}">
          <img src="images/marchi-auto/${normalizedMarchio}.svg" alt="${escapeHtml(item.marchio)}" class="team-logo ${item.team === 'Gliscappatidicasa' ? 'invert-colors' : ''}" onerror="this.style.display='none'">
        </div>
        <div class="pilot-name">${escapeHtml(item.pilot)}</div>
        <div class="pilot-team">${escapeHtml(item.team)}</div>
        <div class="pilot-points">${item.points}</div>
      </div>
    `;
  });
  
  html += '</div></div>';
  container.innerHTML = html;
}

// Funzione per ottenere colore team
function getTeamColor(teamName) {
  const teamColors = {
    'Swiffer': '#8B7500',
    'Badboys': '#4B0082',
    'Tekkadan': '#FFFFFF',
    'Grom': '#8B0000',
    'Drifter': '#26b3ff',
    'Lentiviolenti': '#00FF7F',
    'Gliscappatidicasa': '#FFFF00',
    'Rebellion': '#FF1493',
    'Newgeneration': '#0096d6',
    'Frauzer': '#D3D3D3',
    'Afmotorsport': '#191970',
    'Esagerati': '#FF4500',
    'Pasa_racing': '#8A2BE2',
    'Swatclub': '#87CEFA',
    'Team15': 'var(--giallogtv)'
  };
  return teamColors[teamName] || 'var(--giallogtv)';
}

// Funzione per toggle accordion
function toggleAccordion(element) {
  element.classList.toggle('active');
  const panel = element.nextElementSibling;
  if (panel.style.display === 'block') {
    panel.style.display = 'none';
  } else {
    panel.style.display = 'block';
  }
}
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
      const num1 = rowData[5] || "";
      const num2 = rowData[6] || "";
      
      if (!team) return; // Salta righe vuote

      // Normalizzazione del marchio per trovare il logo
      const marchioSlug = marchio.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const marchioLogoPath = `images/marchi-auto/${marchioSlug}.svg`;
      
      // Normalizzazione del nome auto per l'immagine
      const autoSlug = team.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const autoImagePath = `images/livree/${autoSlug}.jpeg`;

      // Normalizzazione del nome del team per l'attributo data-team
      const teamSlug = team.toLowerCase().replace(/[^a-z0-9_]+/g, "");

      htmlTeams += `
        <div class="team-card" data-team="${escapeHtml(teamSlug)}">
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
            <div class="pilot-info" data-team-color="${escapeHtml(teamSlug)}">
              <div class="pilot-number" data-team-color="${escapeHtml(teamSlug)}">${escapeHtml(num1)}</div>
              <div class="pilot-name">${pilota1}</div>
            </div>
            ${pilota2 ? `
              <div class="pilot-info" data-team-color="${escapeHtml(teamSlug)}">
                <div class="pilot-number" data-team-color="${escapeHtml(teamSlug)}">${escapeHtml(num2)}</div>
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
    // const URL_PROMRETR = config.googleSheets.gtec.promoRetro;
    // loadAndCreateHtmlTable(
    //   URL_PROMRETR,
    //   "proret-body"
      // [0, 1,] - (Usare l'array vuoto o `null` se si vogliono tutte le colonne,
      // altrimenti specificare quelle che vuoi mostrare)
    // );
    // --- Tabella classifica ---
    const URL_CLASS = config.googleSheets.gtec.classifica;
    loadAndCreateHtmlTable(
      URL_CLASS,
      "classifica-body"
      // [0, 1,] - (Usare l'array vuoto o `null` se si vogliono tutte le colonne,
      // altrimenti specificare quelle che vuoi mostrare)
    );
    // Tabella top10
    // loadAndCreateHtmlTable(
    //   URL_CLASS,
    //   "classifica-short-body",
    //   [],
    //   10

      //   [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      // altrimenti specificare quelle che vuoi mostrare)
    // );
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
    loadLobbyCards(URL_LOBBY);

    // const URL_PROMRETR = config.googleSheets.worldchampionship.promoRetro;
    // loadAndCreateHtmlTable(URL_PROMRETR, "proret-body");

    const URL_CLASS = config.googleSheets.worldchampionship.classifica;
    loadAllClassifications(URL_CLASS);

    const URL_PEN = config.googleSheets.worldchampionship.penalita;
    loadAndCreateHtmlTable(URL_PEN, "penalita-body", []);

    const URL_CALENDAR = config.googleSheets.worldchampionship.calendario;
    loadNextRace(URL_CALENDAR, prossimaGara);
    loadCalendar(URL_CALENDAR);

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
