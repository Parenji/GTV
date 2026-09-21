# Sport Mode GT7 — dati per le sezioni "Sport" e "Sport Stats"

`gt7_sport.py` raccoglie i risultati dei piloti GTV nella **Sport Mode di
Gran Turismo 7** e produce `sport.json`, che `index.html` legge per disegnare
le due sezioni omonime.

## Cosa contiene `sport.json`

| Blocco | Contenuto |
|---|---|
| `meta` | quando è stato aggiornato, quanti piloti ha il team, quanti hanno dati |
| `time_trial.attivi` | **tutte** le time trial in corso (in GT7 ne sono attive due in contemporanea, sfalsate di una settimana): pista, auto, periodo, leader mondiale, numero iscritti e la classifica dei piloti del team con tempo, posizione tra i compagni, posizione mondiale e distacco % (relativo e assoluto) |
| `time_trial.passati` | le ultime 5 time trial concluse, con la stessa struttura |
| `gare_settimanali` | le **3 gare attive adesso** (Race A/B/C) lette da `/dailies`, con pista, impostazioni e i tempi del team degli **ultimi 7 giorni** (la gara cambia ogni settimana, quindi i tempi delle rotazioni precedenti non valgono e non vengono mostrati) |
| `piloti` | statistiche per pilota: DR, SR, miglior piazzamento mondiale, piazzamento medio e data dell'ultimo evento |
| `grafici.fasce_rank` | quanti eventi del team sono finiti in ciascuna fascia di classifica (per il grafico) |
| `storico` | archivio degli ultimi eventi per pilota (non più mostrato nel sito) |

Le squadre sono due: **GTV** (22 piloti) e **JGTV** (4 piloti). Nel sito i
piloti JGTV hanno un'etichetta accanto al nome.

> ⚠️ Un pilota che non corre da mesi compare **in fondo** allo storico, non in
> cima: è il motivo per cui la tabella è ordinata per data e non per pilota.

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
   - `/explore-events` → nome della pista e dell'auto delle time trial in corso;
   - `/dailies` → le 3 gare settimanali attive (Race A/B/C).

Senza gt-gridstats il rank personale oltre il 100° non sarebbe recuperabile.

## Uso

```bash
cd sportscraping
python3 gt7_sport.py             # aggiorna sport.json (≈60 s per 26 piloti)
python3 gt7_sport.py --limit 4   # prova su 4 piloti
python3 gt7_sport.py --verbose   # mostra anche DR/SR e quanti eventi per pilota
```

## Aggiornamento automatico

`.github/workflows/gt7-sport.yml` gira **ogni 12 ore** (05:00 e 17:00 UTC, cioè
07:00 e 19:00 italiane d'estate), esegue lo script e — se `sport.json` è
cambiato — lo committa: il push fa ripartire il deploy di Vercel e le sezioni
del sito si aggiornano da sole.

### Se cambio l'elenco dei piloti sul foglio del team

**Sì, si aggiorna da solo.** `carica_piloti_gtv()` rilegge il foglio a ogni
giro: aggiungere, togliere o spostare un pilota (GTV ↔ JGTV) nel foglio è
sufficiente, entro 12 ore le sezioni Sport si allineano.

Due cose da sapere:

- un pilota **nuovo** compare solo se ha un profilo Sport Mode pubblico su
  gt-gridstats (`/player/<PSN>` esiste). Chi non ha mai corso in Sport Mode
  non ha dati da mostrare e viene saltato: `meta.piloti_con_dati` dice quanti
  sono stati letti davvero;
- il **PSN deve essere quello vero** (colonna *Pilota* del foglio), non il
  GT7NAME: la ricerca della fonte usa l'ID PlayStation Network.

### Rete di sicurezza

Lo script legge quanti profili aveva il file precedente e, se in un giro ne
legge meno del 60%, **non sovrascrive** `sport.json` (esce con errore). Così
una giornata di rete instabile non può svuotare le sezioni del sito: al
massimo restano i dati del giro prima.

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
  vanno riallineati: i punti da toccare sono `parse_profilo()`,
  `parse_explore_events()` e `parse_dailies()`.

## La trappola delle time trial sovrapposte

In GT7 le time trial durano due settimane e ne parte una a settimana: quindi
**piu' eventi diversi si chiudono lo stesso giorno**. Il 20 agosto 2026 ne
finivano tre (Daytona, Deep Forest Reverse, Lago Maggiore) — raggrupparli per
sola data di fine mescolava piste diverse in un'unica classifica, con lo
stesso pilota ripetuto due volte e distacchi negativi.

Per questo gli eventi si raggruppano per **(data di inizio, data di fine,
pista)**, e quando due eventi ufficiali hanno le stesse date si sceglie quello
il cui leader e' piu' veloce del miglior tempo del team (`scegli_board()`).

La stessa accortezza vale per le **gare settimanali**: contano solo i tempi
degli ultimi 7 giorni, perche' la stessa pista torna in rotazione dopo mesi e
un tempo di agosto non e' il tempo della gara di adesso.

## Perché alcune colonne non ci sono più

- **"Time trial" e "Gare" (conteggi)**: gt-gridstats pubblica al massimo ~10
  righe di storico per tabella, quindi 22 piloti su 25 risultavano avere
  esattamente "10". Era un troncamento della fonte, non un dato: le colonne
  sono state rimosse e sostituite con la **data dell'ultimo evento**, che dice
  davvero chi sta correndo.
- **"Ultimi eventi"**: tabella eliminata perché mescolava eventi recenti e
  vecchi in un unico elenco poco leggibile. Al suo posto c'è un grafico a barre
  che mostra in quali fasce di classifica mondiale finiscono i risultati del
  team.
