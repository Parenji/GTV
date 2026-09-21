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
| `piloti` | statistiche per pilota: DR, SR, miglior piazzamento mondiale, piazzamento medio, data dell'ultimo evento e l'elenco datato degli eventi (`eventi`) |
| | nel sito la tabella "Piloti del team" si filtra su **ALL TIME / Ultimo anno / Ultimi 3 mesi**: il filtro ricalcola rank e conteggi lato browser usando `eventi`, senza riscaricare nulla |
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

## Come facciamo a non far ripresentare gli errori

Tre livelli, dal piu' forte al piu' debole.

### 1. Controlli automatici prima di pubblicare (`valida()`)

Prima di scrivere `sport.json` lo script verifica che i dati stiano in piedi.
Se un controllo fallisce **il file non viene toccato** e il run diventa rosso:

| Controllo | Cosa intercetta |
|---|---|
| Nessun pilota ripetuto nella stessa classifica | eventi fusi insieme |
| Nessun distacco percentuale negativo | leader di un evento sbagliato |
| **Il leader mondiale non puo' essere piu' lento di un pilota del team** | l'evento e' stato mescolato con un altro |
| Coerenza tempo/posizione (chi ha tempo migliore non puo' avere posizione molto peggiore) | classifiche di eventi diversi |

Il terzo e' quello decisivo: il team e' un sottoinsieme dei partecipanti,
quindi il leader assoluto **deve** essere piu' veloce di tutti i piloti del
team. Se non lo e', i tempi vengono da due eventi diversi — esattamente il bug
di Deep Forest del 21/09/2026.

### 2. Rete di sicurezza sulla quantita' di dati

Se in un giro si leggono meno del 60% dei profili del giro precedente, il file
non viene sovrascritto: una giornata di rete instabile non puo' svuotare le
sezioni del sito.

### 3. Come te ne accorgi

- **Run rosso** su GitHub: il passo di raccolta non ha `continue-on-error`,
  quindi un fallimento si vede nella scheda Actions e GitHub manda una mail.
- **Avviso in pagina**: se `sport.json` ha piu' di 24 ore, sotto il titolo
  delle sezioni Sport compare *"⚠️ dati fermi da N ore"*.
- In ogni caso **il sito non si rompe mai**: resta l'ultima versione buona.

### 4. Il parser delle gare settimanali

La pagina `/dailies` cambia layout spesso (il 21/09/2026 e' passata da 3 a 4
schede, con due "Race B" di cui una vecchia). Il parser ora legge le schede in
modo strutturale e, se trova piu' schede per lo stesso codice, **tiene quella
aggiornata piu' di recente** (`Updated: HH:MM / DD/MM/YYYY`).

## Loghi dei circuiti

Nelle card compare il logo ufficiale del circuito. I file stanno in
`images/tracks/` insieme a quelli già usati dal sito: **nessun doppione**,
si riusa quello che c'era.

Fonte: il sito ufficiale GT7 espone i loghi in
`common/dist/gt7/tracklist/assets/<hash>-<hash>.png` (400x200, PNG con canale
alpha, quindi **senza sfondo bianco**). Il bundle `tracklist/assets/index-*.js`
contiene la mappa `hash -> chunk`, e ogni chunk rivela l'URL reale dell'immagine.

Aggiunti l'11/09/2026 (mancavano):

| Circuito | File |
|---|---|
| Willow Springs | `willowsprings.png` |
| Brands Hatch | `brandshatch.png` |
| 24 Heures du Mans (Sarthe) | `lemans.png` |
| Grand Valley Highway-1 | `grandvalley.png` |
| Circuit Gilles-Villeneuve | `gillesvilleneuve.png` |
| Kyoto Driving Park | `kyoto.png` |
| Nürburgring | `nurburgring.png` |
| Fuji Speedway | `fuji.png` |
| Watkins Glen | `watkins.png` |
| Red Bull Ring | `rbr.png` |
| Barcelona-Catalunya | `barcelona.png` |

Gli ultimi cinque avevano in cartella solo la **mappa** del tracciato in SVG
(usata dal calendario di `union.html`): ho aggiunto il logo accanto, senza
toccare le mappe, così le card della sezione Sport sono tutte omogenee.

Per aggiungere un circuito nuovo basta una riga nella tupla `LOGHI` di
`gt7_sport.py` (chiave = pezzo del nome pista, valore = file).
