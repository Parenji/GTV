// --- Logica per gtec.html ---

document.addEventListener('DOMContentLoaded', function() {
  // Controlla se la pagina ha l'ID 'gtec' (il che indica che siamo in gtec.html)
  const gtec = document.getElementById("gtec");

  if (gtec) {
    console.log("Inizializzazione di gtec.html: Caricamento...");
    let ultimaGara = 7; // Cambia questo numero quando vuoi aggiornare la gara
    prossimaGara = ultimaGara + 1;
    document.getElementById(
      "prossima-gara-text"
    ).innerText = `Prossima Gara: ${prossimaGara}`;
    document.getElementById("info-next-gara").innerText = `Opzioni Lobby Gara ${
      ultimaGara + 1
    }`;

    // --- Tabella Lobby ---
    const URL_LOBBY = config.googleSheets.gtec.lobby;
    loadAndCreateHtmlTable(
      URL_LOBBY,
      "lobby-body"
      // altrimenti specificare quelle che vuoi mostrare)
    );
    // --- Tabella Lobby Promo e retro ---
    // const URL_PROMRETR = config.googleSheets.gtec.promoRetro;
    // loadAndCreateHtmlTable(
    //   URL_PROMRETR,
    //   "proret-body"
    //   // altrimenti specificare quelle che vuoi mostrare)
    // );
    // --- Tabella classifica ---
    const URL_CLASS = config.googleSheets.gtec.classifica;
    loadAndCreateHtmlTable(
      URL_CLASS,
      "classifica-body"
      // altrimenti specificare quelle che vuoi mostrare)
    );
    // --- Tabella classifica ---
    // const URL_CLASS_ADMIN = config.googleSheets.gtec.classificaAdmin;
    // loadAndCreateHtmlTable(
    //   URL_CLASS_ADMIN,
    //   "classifica-admin-body"
    //   // altrimenti specificare quelle che vuoi mostrare)
    // );
    // Penalità
    const URL_PEN = config.googleSheets.gtec.penalita;
    loadAndCreateHtmlTable(
      URL_PEN,
      "penalita-body"
      // altrimenti specificare quelle che vuoi mostrare)
    );

    const URL_CALENDAR = config.googleSheets.gtec.calendario;
    loadAndCreateHtmlTable(
      URL_CALENDAR,
      "prossima-gara-body",
      [0, 1, 2, 3, 4, 5, 6] // Specifica le colonne da mostrare: Data, Circuito, Orario, Gara, Meteo, Format, Note
    );

    // Avvia il processo al caricamento della pagina
    const URL_OPZIONI = config.googleSheets.gtec.opzioniLobby;
    loadDataAndGenerateCards(URL_OPZIONI);
  }
});
