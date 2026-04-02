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
        
        // Scroll al top della pagina prima di scrollare alla sezione
        window.scrollTo({ top: 0, behavior: "smooth" });
        
        // Dopo un breve momento, scroll alla sezione
        setTimeout(() => {
          targetElement.scrollIntoView({ behavior: "smooth" });
        }, 100);

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
    
    // Salva in cache globale per uso in altre funzioni
    if (!window.globalCache) {
      window.globalCache = {};
    }
    window.globalCache.calendar = allDataRows;
    console.log(`loadCalendar: Salvate ${allDataRows.length} gare nella cache globale`);
    console.log(`loadCalendar: Prime 3 gare:`, allDataRows.slice(0, 3).map(row => `${row[0]} - ${row[2]}`));
    
    let html = '';

    // Layout a 2 colonne per desktop
    html += '<div class="calendar-grid-2-columns" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">';

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
        
        circuitLogo = `<img src="images/tracks/${circuitName}.png" alt="${circuito}" style="width: 100%; max-width: 160px; height: 45px; object-fit: contain; display: block; margin: 8px auto 0;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><div style="display: none; text-align: center; color: rgba(255,255,255,0.5); font-size: 0.7em; margin-top: 8px;">🛣️ ${circuito}</div>`;
      }

      // Layout compatto e mobile-friendly per ogni gara
      // Prepara lo sfondo con la bandiera se esiste
      let backgroundStyle = '';
      if (nazione) {
        // Normalizza il nome della nazione per il path del file
        const nationSlug = nazione.toLowerCase().replace(/[^a-z0-9]+/g, "");
        backgroundStyle = `background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url('images/bandiere/flag-icons-main/flags/4x3/${nationSlug}.svg'); background-size: cover; background-position: center; background-repeat: no-repeat;`;
      } else {
        backgroundStyle = 'background: rgba(255,255,255,0.08);';
      }

      html += `
        <div class="race-item" style="${backgroundStyle} backdrop-filter: blur(5px); border: 1px solid rgba(255,255,255,0.3); border-radius: 12px;">
          <div style="text-align: center; padding: 10px;">
            <!-- Header Gara -->
            <div style="margin-bottom: 8px;">
              <div style="font-size: 0.7em; color: rgba(255,255,255,0.95); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; text-shadow: 0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7);">
                Gara
              </div>
              <div style="font-size: 1.1em; font-weight: 700; color: var(--giallogtv); text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 3px 6px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.8);">
                ${gara || 'N/D'}
              </div>
            </div>
            
            <!-- Data -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 8px; background: rgba(0,0,0,0.5); padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.4); backdrop-filter: blur(3px);">
              <span style="font-size: 0.9em;">📅</span>
              <span style="font-size: 0.8em; font-weight: 600; color: rgba(255,255,255,1); text-shadow: 0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7);">${data || 'N/D'}</span>
            </div>
            
            <!-- Logo Circuit -->
            ${circuito ? `
              <div style="margin-bottom: 8px;">
                ${circuitLogo}
              </div>
            ` : ''}
            
            <!-- Info -->
            ${altreInfo && altreInfo.trim() !== '' ? `
              <div style="background: rgba(0,0,0,0.6); padding: 6px 10px; border-radius: 6px; border-left: 3px solid var(--giallogtv); backdrop-filter: blur(3px);">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 0.8em;">ℹ️</span>
                  <span style="font-size: 0.7em; color: rgba(255,255,255,0.95); text-shadow: 0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7);">${altreInfo}</span>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });

    html += '</div>';

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
      // Prepara lo sfondo con la bandiera se esiste
      let backgroundStyle = '';
      if (nazione) {
        // Normalizza il nome della nazione per il path del file
        const nationSlug = nazione.toLowerCase().replace(/[^a-z0-9]+/g, "");
        backgroundStyle = `background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url('images/bandiere/flag-icons-main/flags/4x3/${nationSlug}.svg'); background-size: cover; background-position: center; background-repeat: no-repeat;`;
      } else {
        backgroundStyle = 'background: rgba(255,255,255,0.08);';
      }

      html += `
        <div style="${backgroundStyle} backdrop-filter: blur(5px); border: 1px solid rgba(255,255,255,0.3); border-radius: 12px; padding: 15px; text-align: center;">
          <!-- Header Gara -->
          <div style="margin-bottom: 15px;">
            <div style="font-size: 0.9em; color: rgba(255,255,255,0.95); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; text-shadow: 0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7);">
              Gara
            </div>
            <div style="font-size: 2em; font-weight: 800; color: var(--giallogtv); text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 3px 6px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.8);">
              ${gara || 'N/D'}
            </div>
          </div>
          
          <!-- Data -->
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 15px; background: rgba(0,0,0,0.5); padding: 10px 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.4); backdrop-filter: blur(3px);">
            <span style="font-size: 1.2em;">📅</span>
            <span style="font-size: 1em; font-weight: 600; color: rgba(255,255,255,1); text-shadow: 0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7);">${data || 'N/D'}</span>
          </div>
          
          <!-- Logo Circuit -->
          ${circuito ? `
            <div style="margin-bottom: 15px;">
              ${circuitLogo}
            </div>
          ` : ''}
          
          <!-- Info -->
          ${altreInfo && altreInfo.trim() !== '' ? `
            <div style="background: rgba(0,0,0,0.6); padding: 10px 15px; border-radius: 8px; border-left: 3px solid var(--giallogtv); backdrop-filter: blur(3px);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.1em;">ℹ️</span>
                <span style="font-size: 0.9em; color: rgba(255,255,255,0.95); text-shadow: 0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7);">${altreInfo}</span>
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
            const flagPath = `images/bandiere/flag-icons-main/flags/4x3/${fileSlug}.svg`;

            cellContent = `
                        <img 
                            src="${flagPath}" 
                            alt="${cellValue}" 
                            class="nation-flag"
                            onerror="this.onerror=null; this.style.display='none';" 
                        />
                    `;
          }
          
          // Aggiungi classe speciale per motivazione nelle penalità
          const cellClass = (columnName === "Motivazione" || columnName === "motivazione") ? ' class="motivazione-cell"' : '';
          
          // Aggiungi la cella con il contenuto (testo o HTML dell'immagine)
          innerHTML += `<td data-label="${columnName}"${cellClass}>${cellContent}</td>`;
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
async function loadLobbyCards(spreadsheetUrl, ssu2) {
  const container = document.getElementById("lobby-body");
  
  if (!container) {
    console.error("Container 'lobby-body' non trovato.");
    return;
  }

  try {
    // Carica entrambi i CSV contemporaneamente
    const [optionsResponse, classificationsResponse] = await Promise.all([
      fetch(spreadsheetUrl),
      fetch(ssu2)
    ]);
    
    if (!optionsResponse.ok) {
      throw new Error(`Errore HTTP opzioni: ${optionsResponse.status}`);
    }
    if (!classificationsResponse.ok) {
      throw new Error(`Errore HTTP classifiche: ${classificationsResponse.status}`);
    }

    const [optionsCsvText, classificationsCsvText] = await Promise.all([
      optionsResponse.text(),
      classificationsResponse.text()
    ]);
    
    // Parsing CSV opzioni (per date, time, category, host, live)
    const optionsRows = optionsCsvText
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

    // Parsing CSV classifiche (per piloti)
    const classificationsRows = classificationsCsvText
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

    if (!optionsRows || optionsRows.length === 0) {
      container.innerHTML = '<div class="error-message">Nessuna opzione lobby trovata.</div>';
      return;
    }

    if (!classificationsRows || classificationsRows.length === 0) {
      container.innerHTML = '<div class="error-message">Nessuna classifica trovata.</div>';
      return;
    }

    // Estrai piloti dalle classifiche e raggruppa per lobby
    const lobby1Pilots = [];
    const lobby2Pilots = [];
    
    const classificationData = classificationsRows.slice(1); // Salta l'header
    classificationData.forEach((row) => {
      if (row.length < 9) return; // Deve avere almeno 9 colonne
      
      const position = row[0] || "";
      const pilot = row[1] || "";
      const number = row[2] || "";
      const team = row[3] || "";
      const marchio = row[4] || "";
      const isJgtv = row[6] || "";
      const points = parseInt(row[7]) || 0;
      const lobbyAssignment = row[8] || ""; // Colonna 9: 1 o 2
      
      if (lobbyAssignment === "1") {
        lobby1Pilots.push({ position, pilot, number, team, marchio, points });
      } else if (lobbyAssignment === "2") {
        lobby2Pilots.push({ position, pilot, number, team, marchio, points });
      }
    });

    // Ordina i piloti per posizione (come nelle classifiche)
    lobby1Pilots.sort((a, b) => parseInt(a.position) - parseInt(b.position));
    lobby2Pilots.sort((a, b) => parseInt(a.position) - parseInt(b.position));

    const optionsData = optionsRows.slice(1); // Salta l'header
    let htmlCards = "";
    
    optionsData.forEach((rowData, index) => {
      if (rowData.length < 4) return; // Salta righe incomplete
      
      // Estrai le info della gara (prime 4 colonne)
      const date = rowData[0] || "";
      const time = rowData[1] || "";
      const category = rowData[2] || "";
      const host = rowData[3] || "";
      const live = rowData[4] || "";
      const linklive = rowData[5] || "";
      
      // Determina quali piloti mostrare basandosi sull'indice (0 = Lobby 1, 1 = Lobby 2)
      const currentLobbyPilots = index === 0 ? lobby1Pilots : lobby2Pilots;
      
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
                  <a href="https://profile.playstation.com/${escapeHtml(host)}/add" target="_blank" class="lobby-host-name">${escapeHtml(host)}</a>
                </div>
              </div>
            ` : ''}
            
            ${live ? `
              <div class="lobby-live">
                <div class="lobby-live-icon">🔴</div>
                <div class="lobby-live-content">
                  <div class="lobby-live-label">Live su</div>
                  <a href="${escapeHtml(linklive)}" target="_blank" class="lobby-live-name">${escapeHtml(live)}</a>
                </div>
                <a href="${escapeHtml(live)}" target="_blank" class="lobby-live-badge">LIVE</a>
              </div>
            ` : ''}
          </div>
          
          ${currentLobbyPilots.length > 0 ? `
            <div class="lobby-pilots-section">
              <div class="lobby-pilots-title">Piloti Iscritti (${currentLobbyPilots.length})</div>
              <div class="lobby-pilots-grid">
                ${currentLobbyPilots.map((pilotData, pilotIndex) => {
                  // Normalizza il nome del marchio per il percorso dell'immagine
                  const normalizedMarchio = pilotData.marchio.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
                  
                  return `
                    <div class="lobby-pilot" title="${escapeHtml(pilotData.pilot)}" data-team="${escapeHtml(pilotData.team)}">
                      <div class="lobby-pilot-header">
                        <div class="lobby-pilot-logo-container" data-team="${escapeHtml(pilotData.team)}">
                          <img src="images/marchi-auto/${normalizedMarchio}.svg" alt="${escapeHtml(pilotData.marchio)}" class="lobby-pilot-logo ${pilotData.team === 'Gliscappatidicasa' ? 'invert-colors' : ''}" onerror="this.style.display='none'">
                        </div>
                        <div class="lobby-pilot-info">
                          <div class="lobby-pilot-name">${escapeHtml(pilotData.pilot)}</div>
                          <div class="lobby-pilot-team desktop-only">${escapeHtml(pilotData.team)}</div>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    });

    container.innerHTML = htmlCards || '<div class="error-message">Nessuna lobby trovata.</div>';

  } catch (error) {
    console.error("Errore nel caricamento delle lobby:", error);
    container.innerHTML = `
      <div class="error-message">
        <div>Impossibile caricare le lobby</div>
        <button onclick="location.reload()">Riprova</button>
      </div>
    `;
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
      if (row.length < 8) return;
      
      const position = row[0] || "";
      const pilot = row[1] || "";
      const number = row[2] || "";
      const team = row[3] || "";
      const marchio = row[4] || "";
      const isJgtv = row[6] || "";
      const points = parseInt(row[7]) || 0;
      
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
  
  html += '</div>';
  html += '<div class="next-race-footer">';
  html += '<a href="#classifica" class="menu-link">Classifica completa</a>';
  html += '</div>';
  html += '</div>';
  
  container.innerHTML = html;
}

// Funzione per ottenere colore team
function getTeamColor(teamName) {
  // Mappa team name to CSS variable name
  const teamVariableMap = {
    'Swiffer': 'var(--team-swiffer)',
    'Badboys': 'var(--team-badboys)',
    'Tekkadan': 'var(--team-tekkadan)',
    'Grom': 'var(--team-grom)',
    'Drifter': 'var(--team-drifter)',
    'Lentiviolenti': 'var(--team-lentiviolenti)',
    'Gliscappatidicasa': 'var(--team-gliscappatidicasa)',
    'Rebellion': 'var(--team-rebellion)',
    'Newgeneration': 'var(--team-newgeneration)',
    'Frauzer': 'var(--team-frauzer)',
    'Afmotorsport': 'var(--team-afmotorsport)',
    'Esagerati': 'var(--team-esagerati)',
    'Pasa_racing': 'var(--team-pasa-racing)',
    'Swatclub': 'var(--team-swatclub)',
    'Apex': 'var(--team-apex)',
    'GTVApex': 'var(--team-apex)',
    'Lavazzaracing': 'var(--team-lavazzaracing)',
    'Team15': 'var(--team-team15)'
  };
  return teamVariableMap[teamName] || 'var(--team-team15)';
}

// Funzionalità di search per piloti
function initializePilotSearch() {
  const searchInput = document.getElementById('pilot-search');
  if (!searchInput) return;

  searchInput.addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    const allPilotItems = document.querySelectorAll('.pilot-ranking-item');
    
    allPilotItems.forEach(item => {
      const pilotName = item.querySelector('.pilot-name')?.textContent.toLowerCase() || '';
      const teamName = item.querySelector('.pilot-team')?.textContent.toLowerCase() || '';
      
      if (pilotName.includes(searchTerm) || teamName.includes(searchTerm)) {
        item.style.display = 'flex';
        item.style.opacity = '1';
      } else {
        item.style.display = 'none';
      }
    });
  });
}

// Funzionalità di search per lobby
function initializeLobbySearch() {
  const searchInput = document.getElementById('lobby-search');
  if (!searchInput) return;

  searchInput.addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    const allLobbyPilots = document.querySelectorAll('.lobby-pilot');
    
    allLobbyPilots.forEach(pilot => {
      const pilotName = pilot.querySelector('.lobby-pilot-name')?.textContent.toLowerCase() || '';
      const teamName = pilot.getAttribute('data-team')?.toLowerCase() || '';
      
      if (pilotName.includes(searchTerm) || teamName.includes(searchTerm)) {
        pilot.style.display = 'block';
      } else {
        pilot.style.display = 'none';
      }
    });
  });
}

// Funzione per mostrare notifiche
function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--giallogtv);
    color: #000;
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: bold;
    z-index: 10000;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(0)';
  }, 100);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// Funzione per caricare il podio dell'ultima gara
async function loadPodioUltimaGara(spreadsheetUrl, ultimaGara) {
  const container = document.getElementById("podio-ultima-gara");
  
  if (!container) {
    console.error('Elemento "podio-ultima-gara" non trovato.');
    return;
  }

  try {
    const response = await fetch(spreadsheetUrl);
    
    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status}`);
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
      container.innerHTML = '<div class="loading-message">Nessun risultato trovato.</div>';
      return;
    }

    const header = rows[0];
    const allDataRows = rows.slice(1);
    
    // Debug: mostra la struttura del CSV
    console.log('Struttura CSV risultati:', header);
    console.log('Prime 3 righe dati:', allDataRows.slice(0, 3));
    
    // Usa la stessa logica di loadRisultati per l'ultima gara
    const startCol = 9 + (ultimaGara - 1) * 6; // Stessa formula di loadRisultati
    const endCol = startCol + 6;
    
    console.log(`Podio: Gara ${ultimaGara} - colonne ${startCol}-${endCol}`);
    
    if (startCol >= allDataRows[0].length) {
      container.innerHTML = '<div class="loading-message">Nessun risultato trovato per questa gara.</div>';
      return;
    }
    
    // Estrai i risultati per l'ultima gara
    const raceResults = [];
    allDataRows.forEach((row, index) => {
      if (row.length > startCol) {
        const lobby = row[startCol] || ''; // Colonna 1: lobby
        const position = parseInt(row[startCol + 1]) || 0; // Colonna 2: posizione
        const points = parseInt(row[startCol + 2]) || 0; // Colonna 3: punti
        const pole = parseInt(row[startCol + 3]) || 0; // Colonna 4: pole
        const fastLap = parseInt(row[startCol + 4]) || 0; // Colonna 5: giro veloce
        const totalPoints = parseInt(row[startCol + 5]) || 0; // Colonna 6: punti totali
        
        if (position && position > 0) {
          raceResults.push({
            lobby: lobby,
            position: position,
            points: points,
            pole: pole,
            fastLap: fastLap,
            totalPoints: totalPoints,
            pilotName: row[1] || '', // Colonna pilota
            teamName: row[3] || '', // Colonna team
            originalIndex: index + 1
          });
        }
      }
    });
    
    console.log('Podio: Risultati estratti:', raceResults.length);
    
    // Separa per lobby e prendi i primi 3 di ciascuna
    const lobby1Results = raceResults
      .filter(result => result.lobby === '1')
      .sort((a, b) => a.position - b.position)
      .slice(0, 3);
      
    const lobby2Results = raceResults
      .filter(result => result.lobby === '2')
      .sort((a, b) => a.position - b.position)
      .slice(0, 3);
    
    console.log('Podio: Lobby 1 -', lobby1Results.length, 'piloti');
    console.log('Podio: Lobby 2 -', lobby2Results.length, 'piloti');
    
    let html = '';
    
    // Genera HTML per Lobby 1
    if (lobby1Results.length > 0) {
      html += `
        <div class="podio-lobby">
          <div class="podio-lobby-header">🏆 Lobby 1</div>
          <div class="podio-piloti">
      `;
      
      lobby1Results.forEach((result, index) => {
        const positionClass = index === 0 ? 'podio-primo' : index === 1 ? 'podio-secondo' : 'podio-terzo';
        
        html += `
          <div class="podio-pilota">
            <div class="podio-posizione ${positionClass}">${result.position}°</div>
            <div class="podio-pilota-nome">${escapeHtml(result.pilotName)}</div>
            <div class="podio-pilota-team">${escapeHtml(result.teamName)}</div>
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    }
    
    // Genera HTML per Lobby 2
    if (lobby2Results.length > 0) {
      html += `
        <div class="podio-lobby">
          <div class="podio-lobby-header">🏆 Lobby 2</div>
          <div class="podio-piloti">
      `;
      
      lobby2Results.forEach((result, index) => {
        const positionClass = index === 0 ? 'podio-primo' : index === 1 ? 'podio-secondo' : 'podio-terzo';
        
        html += `
          <div class="podio-pilota">
            <div class="podio-posizione ${positionClass}">${result.position}°</div>
            <div class="podio-pilota-nome">${escapeHtml(result.pilotName)}</div>
            <div class="podio-pilota-team">${escapeHtml(result.teamName)}</div>
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    }
    
    container.innerHTML = html || '<div class="loading-message">Nessun risultato trovato per l\'ultima gara.</div>';
    console.log('Podio caricato:', lobby1Results.length + ' piloti Lobby 1,', lobby2Results.length + ' piloti Lobby 2');

  } catch (error) {
    console.error('Errore nel caricamento del podio:', error);
    container.innerHTML = `
      <div class="error-message">
        <div>Errore nel caricamento del podio</div>
        <button onclick="location.reload()">Riprova</button>
      </div>
    `;
  }
}

// Funzione per caricare i risultati di tutte le gare
async function loadRisultati(spreadsheetUrl) {
  console.log('loadRisultati: Inizio caricamento risultati da', spreadsheetUrl);
  const container = document.getElementById("risultati-body");
  
  if (!container) {
    console.error('Elemento "risultati-body" non trovato.');
    return;
  }

  try {
    const response = await fetch(spreadsheetUrl);
    
    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status} (${response.statusText})`);
    }

    const csvText = await response.text();
    console.log('loadRisultati: CSV ricevuto, lunghezza:', csvText.length);
    
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

    console.log('loadRisultati: Righe parsate:', rows.length);
    
    if (!rows || rows.length === 0) {
      console.log('loadRisultati: Nessuna riga trovata');
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.7);">Nessun risultato trovato.</div>';
      return;
    }

    const header = rows[0];
    const allDataRows = rows.slice(1);
    console.log('loadRisultati: Header:', header);
    console.log('loadRisultati: Dati rows:', allDataRows.length);
    console.log('loadRisultati: Lunghezza header:', header.length);
    
    // Genera HTML per le 8 gare (colonne 10-15, 16-21, 22-27, 28-33, 34-39, 40-45, 46-51, 52-57)
    let html = '';
    
    for (let race = 1; race <= 8; race++) {
      const startCol = 9 + (race - 1) * 6; // 10, 16, 22, 28, 34, 40, 46, 52
      const endCol = startCol + 6; // 15, 21, 27, 33, 39, 45, 51, 57
      

      
      if (startCol >= allDataRows[0].length) {
        console.log(`loadRisultati: Fine colonne - startCol ${startCol} >= lunghezza header ${allDataRows[0].length}`);
        break; // Se non ci sono più colonne
      }
      
      // Estrai i risultati per questa gara
      const raceResults = [];
      allDataRows.forEach((row, index) => {
        if (row.length > startCol) {
          const lobby = row[startCol] || ''; // Colonna 1: lobby
          const position = row[startCol + 1] || ''; // Colonna 2: posizione
          const points = parseInt(row[startCol + 2]) || 0; // Colonna 3: punti
          const pole = parseInt(row[startCol + 3]) || 0; // Colonna 4: pole
          const fastLap = parseInt(row[startCol + 4]) || 0; // Colonna 5: giro veloce
          const totalPoints = parseInt(row[startCol + 5]) || 0; // Colonna 6: punti totali
          
          
          if (position && position !== '') {
            // Usa i dati delle classifiche generali per ottenere info pilota
            const pilotData = {
              position: index + 1,
              pilot: row[1] || '',
              number: row[2] || '',
              team: row[3] || '',
              marchio: row[4] || '',
              points: totalPoints
            };
            
            raceResults.push({
              ...pilotData,
              lobby: lobby,
              racePosition: position,
              racePoints: points,
              pole: pole,
              fastLap: fastLap
            });
          }
        }
      });
      
      // Ordina per posizione
      raceResults.sort((a, b) => parseInt(a.racePosition) - parseInt(b.racePosition));
      
      // Separa per lobby
      const lobby1 = raceResults.filter(r => r.lobby === '1');
      const lobby2 = raceResults.filter(r => r.lobby === '2');
      
      // Prendi dati del tracciato dal calendario (se disponibile)
      let trackLogo = '';
      let trackName = '';
      console.log(`loadRisultati: Gara ${race} - controllo cache calendario`);
      console.log(`loadRisultati: globalCache esiste:`, !!window.globalCache);
      console.log(`loadRisultati: globalCache.calendar esiste:`, !!(window.globalCache && window.globalCache.calendar));
      
      if (window.globalCache && window.globalCache.calendar) {
        console.log(`loadRisultati: calendar array length:`, window.globalCache.calendar.length);
        console.log(`loadRisultati: dati per gara ${race - 1}:`, window.globalCache.calendar[race - 1]);
        
        if (window.globalCache.calendar[race - 1]) {
          const raceData = window.globalCache.calendar[race - 1];
          trackName = raceData[2] || ''; // Colonna circuito
          console.log(`loadRisultati: Tracciato trovato: "${trackName}"`);
          
          if (trackName) {
            const circuitMapping = {
              'daytona': 'daytona', 'autopolis': 'autopolis', 'deep forest': 'deep-forest',
              'dragon trail': 'dragon', 'fuji': 'fuji', 'interlagos': 'interlagos',
              'laguna seca': 'lagunaseca', 'monza': 'monza', 'mount panorama': 'mountpanorama',
              'red bull ring': 'rbr', 'sardegna': 'sardegna', 'spa': 'spa',
              'suzuka': 'suzuka', 'tokyo': 'tokyo', 'watkins glen': 'watkins',
              'yas marina': 'yasmarina'
            };
            const cleanName = trackName.toLowerCase().trim();
            const circuitName = circuitMapping[cleanName] || cleanName.replace(/\s+/g, '_').replace(/[^\w]/g, '');
            console.log(`loadRisultati: Clean name: "${cleanName}" -> Circuit name: "${circuitName}"`);
            
            trackLogo = `<img src="images/tracks/${circuitName}.png" alt="${trackName}" class="track-logo-small" onerror="this.style.display='none'">`;
            console.log(`loadRisultati: Logo generato: ${trackLogo}`);
          }
        } else {
          console.log(`loadRisultati: Nessun dato trovato per indice ${race - 1}`);
        }
      } else {
        console.log(`loadRisultati: Cache calendario non disponibile per gara ${race}`);
      }
      
      html += `
        <div class="classification-accordion">
          <div class="accordion" onclick="toggleAccordion(this)">
            <div class="accordion-header">
              <div class="accordion-title">Gara ${race}</div>
              <div class="track-logo-container">${trackLogo}</div>
              <div class="accordion-subtitle">${raceResults.length > 0 ? 'RISULTATI DISPONIBILI' : ''}</div>
              <i><svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="2" fill="none"/></svg></i>
            </div>
          </div>
          <div class="panel">
            <div class="classification-table">
      `;
      
      // Funzione per generare HTML dei piloti
      const generatePilotHTML = (pilots, lobbyName) => {
        if (pilots.length === 0) return '';
        
        let pilotHTML = '';
        pilots.forEach((item, index) => {
          const normalizedMarchio = item.marchio.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
          
          // Determina lo stile speciale per i punti
          let pointsStyle = '';
          if (item.pole === 1 && item.fastLap === 1) {
            // Entrambi: transizione da giallo fuoco a fucsia
            pointsStyle = 'background: linear-gradient(90deg, #ffd000 0%, #ff00ff 100%);';
          } else if (item.pole === 1) {
            // Solo pole position: giallo fuoco
            pointsStyle = 'background: #ffd000; color: black;';
          } else if (item.fastLap === 1) {
            // Solo giro veloce: fucsia
            pointsStyle = 'background: #ff00ff;';
          }
          
          pilotHTML += `
            <div class="pilot-ranking-item">
              <div class="pilot-position">${item.racePosition}</div>
              <div class="pilot-number-circle" style="background: ${getTeamColor(item.team)}">
                <img src="images/marchi-auto/${normalizedMarchio}.svg" alt="${escapeHtml(item.marchio)}" class="team-logo ${item.team === 'Gliscappatidicasa' ? 'invert-colors' : ''}" onerror="this.style.display='none'">
              </div>
              <div class="pilot-name">${escapeHtml(item.pilot)}</div>
              <div class="pilot-team">${escapeHtml(item.team)}</div>
              <div class="pilot-points" style="${pointsStyle}">${item.points}</div>
            </div>
          `;
        });
        return pilotHTML;
      };
      
      // Aggiungi le lobby se ci sono piloti
      if (lobby1.length > 0) {
        html += `
          <div class="race-lobby-section">
            <div class="race-lobby-title">Lobby 1</div>
            <div class="classification-table">
              ${generatePilotHTML(lobby1, 'Lobby 1')}
            </div>
          </div>
        `;
      }
      
      if (lobby2.length > 0) {
        html += `
          <div class="race-lobby-section">
            <div class="race-lobby-title">Lobby 2</div>
            <div class="classification-table">
              ${generatePilotHTML(lobby2, 'Lobby 2')}
            </div>
          </div>
        `;
      }
      
      html += `
            </div>
          </div>
        </div>
      `;
    }
    
    container.innerHTML = html || '<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.7);">Nessun risultato trovato.</div>';
    console.log('loadRisultati: HTML impostato nel container');

  } catch (error) {
    console.error('Errore nel caricamento dei risultati:', error);
    container.innerHTML = `
      <div class="error-message">
        <div>Errore nel caricamento dei risultati</div>
        <button onclick="location.reload()">Riprova</button>
      </div>
    `;
  }
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
      
      // Use same normalization logic as worldchampionship for car brands
      const brandSlug = it.brand.toLowerCase().replace(/[^a-z0-9]+/g, "");
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
    let ultimaGara = 1; // Cambia questo numero quando vuoi aggiornare la gara
    prossimaGara = ultimaGara + 1;
    document.getElementById(
      "pen-ult-gara"
    ).innerText = `Penalità Gara ${ultimaGara}`;
    document.getElementById("lobby-next-gara").innerText = `Gara ${
      ultimaGara + 1
    }`;
    document.getElementById("info-next-gara").innerText = `Opzioni Stanza `;
        document.getElementById("subinfo-next-gara").innerText = `Gara ${
      ultimaGara + 1
    } (standard)`;

    const URL_LOBBY = config.googleSheets.worldchampionship.lobby;
    const URL_CLASS = config.googleSheets.worldchampionship.classifica;
    loadLobbyCards(URL_LOBBY, URL_CLASS);

    // Carica il podio dell'ultima gara
    loadPodioUltimaGara(URL_CLASS, ultimaGara);

    // const URL_PROMRETR = config.googleSheets.worldchampionship.promoRetro;
    // loadAndCreateHtmlTable(URL_PROMRETR, "proret-body");

    loadAllClassifications(URL_CLASS);

    const URL_PEN = config.googleSheets.worldchampionship.penalita;
    loadAndCreateHtmlTable(URL_PEN, "penalita-body", []);

    const URL_CALENDAR = config.googleSheets.worldchampionship.calendario;
    loadNextRace(URL_CALENDAR, prossimaGara);
    loadCalendar(URL_CALENDAR);

    const URL_OPZIONI = config.googleSheets.worldchampionship.opzioni;
    loadDataAndGenerateCards(URL_OPZIONI);

    // Inizializza funzionalità search
    initializePilotSearch();
    initializeLobbySearch();

    const URL_TEAM_PILOTI = config.googleSheets.worldchampionship.teamPiloti;
    loadTeamAndPiloti(URL_TEAM_PILOTI);

    // Carica risultati DOPO il calendario per avere la cache disponibile
    setTimeout(() => {
      loadRisultati(URL_CLASS);
    }, 1000); // Aspetta 1 secondo per assicurarsi che la cache sia caricata
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
