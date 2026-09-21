# Sport Mode GT7 — dati per le sezioni "Sport" e "Sport Stats"

`gt7_sport.py` raccoglie i risultati dei piloti GTV nella **Sport Mode di
Gran Turismo 7** e produce `sport.json`, che `index.html` legge per disegnare
le due sezioni omonime.

## Cosa contiene `sport.json`

| Blocco | Contenuto |
|---|---|
| `meta` | quando è stato aggiornato, quante fonti hanno risposto |
| `time_trial` | time trial in corso: pista, auto, scadenza, leader mondiale, numero iscritti e la classifica dei piloti GTV con tempo, posizione tra i GTV, posizione mondiale e distacco % (relativo e assoluto) |
| `gare_settimanali` | le gare settimanali, raggruppate **per evento identico** (stessa gara, pista e data), con rank mondiale, tempo e distacco tra i GTV |
| `piloti` | statistiche per pilota: DR, SR, time trial e gare registrate, miglior piazzamento mondiale, piazzamento medio |
| `storico` | ultimi eventi di ogni pilota (time trial e gare) |

## Da dove arrivano i dati

1. **API ufficiale Polyphony** (`web-api.gt7.game.gran-turismo.com`, endpoint
   pubblici, nessun login):
   - `POST /event/get_folder` → l'elenco degli eventi time trial;
   - `POST /ranking/get_top_list` → tempo del leader mondiale e numero totale
     di partecipanti.
   Serve perché l'API ufficiale pubblica solo la **top 100**: chi sta oltre il
   100° non è visibile da lì.
2. **gt-gridstats.com** (sito della community, non ufficiale):
   - `/player/<PSN>` → DR, SR e le tabelle *Event History* (time trial) e
     *Daily Race History* (gare settimanali) con rank mondiale e tempo;
   - `/explore-events` → nome della pista e dell'auto del time trial in corso.

Senza gt-gridstats il rank personale oltre il 100° non sarebbe recuperabile.

## Uso

```bash
cd sportscraping
python3 gt7_sport.py             # aggiorna sport.json (≈45 s per 22 piloti)
python3 gt7_sport.py --limit 4   # prova su 4 piloti
python3 gt7_sport.py --verbose   # mostra anche DR/SR e quanti eventi per pilota
```

## Aggiornamento automatico

`.github/workflows/gt7-sport.yml` gira **ogni 12 ore** (05:00 e 17:00 UTC),
esegue lo script, e se `sport.json` è cambiato lo committa: il push fa
ripartire il deploy di Vercel e le sezioni del sito si aggiornano da sole.
Nei giorni in cui una fonte non risponde il file precedente resta in piedi,
quindi la sezione non si svuota.

## Note e limiti (onesti)

- **gt-gridstats non è un sito ufficiale** e i suoi dati dipendono dal loro
  sync con i server del gioco: possono essere indietro di qualche ora. Il
  nostro script scarica una pagina alla volta con una pausa di 1,2 s.
- **Le gare settimanali non esistono nell'API ufficiale**: l'unica fonte è
  gt-gridstats. Per il distacco assoluto delle gare il riferimento (tempo del
  leader mondiale) non è pubblico: la colonna resta vuota.
- **La top 100 ufficiale** è l'unica classifica mondiale consultabile senza
  login; tutto ciò che è specifico di un giocatore (profilo, storico, DR/SR
  aggiornati) richiede un accesso PSN, che non usiamo.
- Se gt-gridstats cambia l'HTML delle sue pagine, i parser in `gt7_sport.py`
  vanno riallineati: i punti da toccare sono `parse_profilo()` e
  `parse_explore_events()`.
