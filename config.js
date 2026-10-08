window.GTV_CONFIG = {
  // Dati generati dagli scraper (GitHub Actions) e calendario: tutto in dati/
  dati: {
    unionCalendario: "dati/union/calendario.json",
    unionLobby: "dati/union/lobby.json",
    unionClassifiche: "dati/union/classifiche.json",
    sport: "dati/sport.json",
    palmares: "dati/palmares.json",
  },

  googleSheets: {
    piloti:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0hWQI6bqzVdr38OpcUlsNHcvuXnjzqdte1skzC8A9KAUFExFzXWqA7MCLbFiL0k1Gw1GMHBAJghCn/pub?gid=0&single=true&output=csv",
    admin:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vRx7dbRJV9vs3dkCo3zycLGxybjzItCLU6NizJLgzdlJXhgErb_HBugUN7wmeEYmilVVUS6nzmoHbhP/pub?gid=1215200164&single=true&output=csv",
  },

  // Report della Direzione Gara Union: per ogni gara due fogli Google (CSV),
  // i reclami dei piloti e le segnalazioni degli host, piu' (facoltativo) i
  // ricorsi sui reclami: se respinti la penalita' raddoppia. Si usa /export e non
  // /gviz: gviz svuota le celle di testo ("RIFIUTATO, ...") in una colonna
  // che e' quasi tutta numerica.
  unionReportDG: {
    1: {
      reclami: "https://docs.google.com/spreadsheets/d/1jHjfXcU7LAV1HvL3pb036rLHzowpvo_ozl9W8q_rmwo/export?format=csv&gid=362234430",
      host: "https://docs.google.com/spreadsheets/d/1Fu1ig6YEzFxJdeSitYcVSgPwUQvDVEe8pCknnJPVzOU/export?format=csv&gid=1180831618",
      ricorsi: "https://docs.google.com/spreadsheets/d/1mlpgbku-aCSEudK4wyIXwzxmX5s1D5XcfSHpIeeWFPY/export?format=csv&gid=88288841",
    },
  },
};
