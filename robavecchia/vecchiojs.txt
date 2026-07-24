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

// Opzionale: Chiudi il menu cliccando fuori da esso (overlay)
/* document.addEventListener('click', (event) => {
    // Chiudi solo se l'elemento cliccato non è il menu, non è il pulsante, e il menu è aperto
    if (!sidebar.contains(event.target) && !menuToggle.contains(event.target) && sidebar.classList.contains('open')) {
        closeSidebar();
    }
});
*/

// FUNZIONE PER GESTIRE IL FUNZIONAMENTO DELLA BARRA ORIZZONTALE
document.addEventListener("DOMContentLoaded", function () {
  const links = document.querySelectorAll(
    ".navbar-scroll a, .sidebar-content a, .section-link a"
  );
  const sections = document.querySelectorAll(".section");

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
        sidebarcontent.addEventListener("click", closeSidebar);
        // targetElement.scrollIntoView({ behavior: "smooth" });

        // Rimuovi la classe 'active' da tutti i link e aggiungila al link cliccato
        removeActiveClass();
        this.classList.add("active");
        const linksToActivate = document.querySelectorAll(`a[href="#${targetId}"]`);
            
            // Applica la classe 'active' a OGNUNO di essi
            linksToActivate.forEach(linkToActivate => {
                linkToActivate.classList.add("active");
            });
      }
    });
  });

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
    
    // 1. Mostra la prima sezione (Logica invariata)
    sections[0].style.display = "block"; 
    
    // 2. Seleziona TUTTI i link che puntano alla Home.
    // Usiamo 'a[href="#home"]' come selettore, indipendentemente dal contenitore.
    const homeLinks = document.querySelectorAll('a[href="#page1"]');
    
    // 3. Applica la classe 'active' a tutti i link trovati.
    if (homeLinks.length > 0) {
        homeLinks.forEach(link => {
            link.classList.add("active");
        });
    }
}
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
        row
          .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          .map((cell) => cell.trim().replace(/^"|"$/g, "").replace(/""/g, '"'))
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
  
  if (typeof options === 'number' || options.maxRows) {
      // Caso 1: È stata passata la vecchia sintassi (solo numero) o l'opzione maxRows
      const limit = typeof options === 'number' ? options : options.maxRows;
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
      tbody.appendChild(tr);
    }
  } catch (error) {
    console.error("Errore nel caricamento dei dati:", error);
    // Calcola colspan in base al numero di colonne che si dovevano usare
    const colspan = columnIndices ? columnIndices.length : 1;

    tbody.innerHTML = `
            <tr>
                <td colspan="${colspan}" style="text-align: center; color: red; padding: 20px;">
                    ❌ Errore nel caricamento dei dati.
                </td>
            </tr>
        `;
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

document.addEventListener("DOMContentLoaded", () => {
  // --- 1. Logica per index.html ---

  // Controlla se la pagina ha l'ID 'piloti-body' (il che indica che siamo in index.html)
  const pilotiBody = document.getElementById("piloti-body");

  if (pilotiBody) {
    console.log("Inizializzazione di index.html: Caricamento Piloti e Admin.");

    // --- Tabella Piloti ---
    const URL_PILOTI =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0hWQI6bqzVdr38OpcUlsNHcvuXnjzqdte1skzC8A9KAUFExFzXWqA7MCLbFiL0k1Gw1GMHBAJghCn/pub?gid=0&single=true&output=csv";
    loadAndCreateHtmlTable(URL_PILOTI, "piloti-body", [0, 1, 2]);

    // --- Tabella Admin ---
    const URL_ADMIN =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vRx7dbRJV9vs3dkCo3zycLGxybjzItCLU6NizJLgzdlJXhgErb_HBugUN7wmeEYmilVVUS6nzmoHbhP/pub?gid=1215200164&single=true&output=csv";
    loadAndCreateHtmlTable(URL_ADMIN, "admin-body", [0, 1]);
  }

  // --- 2. Logica per gtec.html ---

  // Controlla se la pagina ha l'ID 'gtec' (il che indica che siamo in gtec.html)
  const gtec = document.getElementById("gtec");

  if (gtec) {
    console.log("Inizializzazione di gtec.html: Caricamento...");
    let ultimaGara = 6; // Cambia questo numero quando vuoi aggiornare la gara
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
    const URL_LOBBY =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQyncPYqAUjekbprRwnUdrOpqYvPDrsohSpmmwedX18L0cQxbiRca3YLfBdbqpg05zr9l92xpv1chrZ/pub?gid=0&single=true&output=csv";
    loadAndCreateHtmlTable(
      URL_LOBBY,
      "lobby-body"
      // [0, 1,] - (Usare l'array vuoto o `null` se si vogliono tutte le colonne,
      // altrimenti specificare quelle che vuoi mostrare)
    );
    // --- Tabella Lobby Promo e retro ---
    const URL_PROMRETR =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQyncPYqAUjekbprRwnUdrOpqYvPDrsohSpmmwedX18L0cQxbiRca3YLfBdbqpg05zr9l92xpv1chrZ/pub?gid=1228545593&single=true&output=csv";
    loadAndCreateHtmlTable(
      URL_PROMRETR,
      "proret-body"
      // [0, 1,] - (Usare l'array vuoto o `null` se si vogliono tutte le colonne,
      // altrimenti specificare quelle che vuoi mostrare)
    );
    // --- Tabella classifica ---
    const URL_CLASS =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQyncPYqAUjekbprRwnUdrOpqYvPDrsohSpmmwedX18L0cQxbiRca3YLfBdbqpg05zr9l92xpv1chrZ/pub?gid=126395538&single=true&output=csv";
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
    const URL_PEN =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQyncPYqAUjekbprRwnUdrOpqYvPDrsohSpmmwedX18L0cQxbiRca3YLfBdbqpg05zr9l92xpv1chrZ/pub?gid=1753268594&single=true&output=csv";
    loadAndCreateHtmlTable(
      URL_PEN,
      "penalita-body"

      //   [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      // altrimenti specificare quelle che vuoi mostrare)
    );

    const URL_CALENDAR =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQyncPYqAUjekbprRwnUdrOpqYvPDrsohSpmmwedX18L0cQxbiRca3YLfBdbqpg05zr9l92xpv1chrZ/pub?gid=912348639&single=true&output=csv";
    loadAndCreateHtmlTable(
      URL_CALENDAR,
      "prossima-gara-body",
      [0, 2, 1, 4], //(Usare l'array vuoto o `null` se si vogliono tutte le colonne,
      { rowIndex: prossimaGara }
      // altrimenti specificare quelle che vuoi mostrare)
    );

    loadAndCreateHtmlTable(
      URL_CALENDAR,
      "calendar-body",
      [0, 2, 1, 4] //(Usare l'array vuoto o `null` se si vogliono tutte le colonne,
      // altrimenti specificare quelle che vuoi mostrare)
    );

    // Avvia il processo al caricamento della pagina
    const URL_OPZIONI =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQyncPYqAUjekbprRwnUdrOpqYvPDrsohSpmmwedX18L0cQxbiRca3YLfBdbqpg05zr9l92xpv1chrZ/pub?gid=1285111450&single=true&output=csv";
    loadDataAndGenerateCards(URL_OPZIONI);
  }
  // --- 3. Logica per interno.html ---

  // Controlla se la pagina ha l'ID 'gtec' (il che indica che siamo in gtec.html)
  const interno = document.getElementById("interno");

  if (interno) {
    console.log("Inizializzazione di gtec.html: Caricamento...");

    // --- Tabella calendar ---
    const URL_CALENDAR =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTjIK9QJjiVNA9MC4opAz426vl9zzl7X6A3OS0P7h8yikDIXoK5tVetXnrQAYYew0Gz7wEMtM2ZtRkl/pub?gid=0&single=true&output=csv";
    loadAndCreateHtmlTable(
      URL_CALENDAR,
      "calendar-body",
      [0, 2, 1, 4] //(Usare l'array vuoto o `null` se si vogliono tutte le colonne,
      // altrimenti specificare quelle che vuoi mostrare)
    );
  }
});
