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
| `gare_settimanali` | le **3 gare attive adesso** (Race A/B/C) lette da `/dailies`, con pista, impostazioni, il periodo (`inizio`/`fine`/`settimana`, calcolato dalla rotazione del lunedì) e i tempi del team degli **ultimi 7 giorni** (la gara cambia ogni settimana, quindi i tempi delle rotazioni precedenti non valgono e non vengono mostrati) |
| `gare_precedenti` | le **3 gare della settimana scorsa**, lette dalla sezione "Previous Week" della stessa pagina, con i tempi di quella settimana |
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
   - `/dailies` → le 3 gare settimanali attive (Race A/B/C) e quelle della
     settimana precedente.

Senza gt-gridstats il rank personale oltre il 100° non sarebbe recuperabile.

## Uso

```bash
cd sportscraping
python3 gt7_sport.py             # aggiorna sport.json (≈60 s per 26 piloti)
python3 gt7_sport.py --limit 4   # prova su 4 piloti
python3 gt7_sport.py --verbose   # mostra anche DR/SR e quanti eventi per pilota
```

## Aggiornamento automatico

`.github/workflows/gt7-sport.yml` gira **quattro volte al giorno** (orari UTC,
perché il reset del gioco è a UTC fisso e non si sposta con l'ora legale):

| Cron | Cosa fa |
|---|---|
| `0 5 * * *` | giro **completo**: scarica tutto lo storico dei piloti (prima della rotazione) |
| `15 7 * * *` | giro **della rotazione**: il gioco chiude gli eventi alle 06:59:59Z e ne apre di nuovi alle 07:00:00Z, quindi qui l'evento chiuso va in archivio e i nuovi entrano in pagina |
| `20 8 * * *` | **controllo post-rotazione**: recupera i nomi dei circuiti se gt-gridstats era ancora indietro |
| `0 17 * * *` | giro **leggero** di fine giornata |

Lo script esegue e — se `sport.json` è cambiato — lo committa: il push fa
ripartire il deploy di Vercel e le sezioni del sito si aggiornano da sole.

> Il reset di GT7 è alle **07:00 UTC** tutto l'anno: le time trial chiudono alle
> 06:59:59Z e i nuovi eventi partono alle 07:00:00Z (in Italia sono le 09:00
> d'estate e le 08:00 d'inverno). Per questo il cron della rotazione è a UTC e
> non a un'ora italiana fissa. GitHub può ritardare le partenze programmate:
> il controllo delle date nel browser (vedi "Il passaggio in archivio è
> automatico") copre anche quel caso, archiviando l'evento all'istante esatto.

### Se cambio l'elenco dei piloti sul foglio del team

**Sì, si aggiorna da solo.** `carica_piloti_gtv()` rilegge il foglio a ogni
giro: aggiungere, togliere o spostare un pilota (GTV ↔ JGTV) nel foglio è
sufficiente, entro poche ore le sezioni Sport si allineano.

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

### Come trovare il logo di un circuito (procedura esatta)

L'id del logo non è il nome del circuito: l'unico modo affidabile di risalire
all'id è la tabella dati del sito ufficiale, che accoppia nome e `baseId`.

1. dalla pagina `gran-turismo.com/<lingua>/gt7/tracklist/` prendi il nome del
   bundle, es. `common/dist/gt7/tracklist/assets/index-D6LP397v.js`;
2. dentro il bundle cerca `track_logos/light/`: c'è la mappa
   `id -> chunk` (es. `"051834.png":()=>import("./051834-Be_Zvqok.js")`);
3. scarica `tracks.it-<hash>.js` dallo stesso bundle: ogni voce ha
   `baseId` (= id del logo), `nameBase` e `nameLong` — è così che si sa che
   **Road Atlanta = 051834**;
4. scarica il chunk `051834-*.js`: contiene una riga sola con l'URL del PNG,
   es. `/common/dist/gt7/tracklist/assets/051834-BK1vS4TT.png`;
5. salva il PNG in `images/tracks/` e aggiungi la riga in `LOGHI`.

Verifica che il file scaricato sia un **400x200 RGBA con il primo pixel
trasparente**: è la firma dei loghi ufficiali (senza sfondo bianco).

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

Aggiunti il 24/09/2026, dopo la segnalazione che **Road Atlanta** (entrata in
rotazione quel giorno) usciva senza logo — l'audit ha trovato altri 12 circuiti
scoperti e una chiave sbagliata:

| Circuito | File |
|---|---|
| Michelin Raceway Road Atlanta | `atlanta.png` |
| Alsace | `alsace.png` |
| BB Raceway | `bb-raceway.png` |
| Blue Moon Bay Speedway | `bluemoonbay.png` |
| Colorado Springs | `coloradosprings.png` |
| Eiger Nordwand | `eiger.png` |
| Fishermans Ranch | `fishermansranch.png` |
| Goodwood | `goodwood.png` |
| High Speed Ring | `highspeedring.png` |
| Lake Louise | `lake louise.png` |
| Northern Isle Speedway | `northernisle.png` |
| Special Stage Route X | `routex.png` |
| Trial Mountain | `trialmountain.png` |
| Tsukuba | `tsukuba.png` |

> **Bug trovato nello stesso giro**: `Circuit Gilles Villeneuve` era mappato
> come `("gilles-villeneuve", ...)`, ma il nome ufficiale non ha il trattino,
> quindi quel logo non è mai comparso. Ora ci sono entrambe le chiavi.
>
> Con questi file **tutti i 41 circuiti dell'elenco ufficiale GT7** hanno un
> logo: la verifica è automatica, basta confrontare i `nameBase` di
> `tracks.it-*.js` con `logo_pista()`.

Per aggiungere un circuito nuovo basta una riga nella tupla `LOGHI` di
`gt7_sport.py` (chiave = pezzo del nome pista in minuscolo, valore = file).

## Struttura della sezione Sport

- **Time trial in corso** (2 card) e **Gare settimanali in corso** (3 card):
  sempre visibili.
- **Archivio**: due pannelli che si alternano per non allungare la pagina —
  *"Ultime N time trial concluse"* e *"Ultime daily"* (le Race A/B/C della
  settimana precedente). Si cambia con i pulsanti in cima all'archivio.

### Il passaggio in archivio e' automatico

Un evento esce da "in corso" ed entra in **Archivio** da solo, senza toccare
nulla a mano, in due momenti che si completano a vicenda:

1. **nello scraper** (`build()`): le time trial chiuse non finiscono piu' in
   `time_trial.attivi`, e le gare settimanali cambiano con la rotazione del
   lunedi' (`gare_settimanali` → `gare_precedenti`);
2. **nel browser** (`sportSeparaEventi()` in `scripts.js`): `sport.json` si
   aggiorna poche volte al giorno, quindi il renderer ricontrolla le date a ogni
   caricamento della pagina e sposta subito in archivio quello che risulta
   scaduto, anche se il file lo elenca ancora fra gli "in corso".

Il confronto e' a **istante**, non a giorno: ogni evento porta un campo
`chiusura` in ISO UTC (es. `2026-09-24T06:59:59Z`) preso dall'API ufficiale.
Le time trial chiudono a meta' mattina dell'ultimo giorno, quindi con la sola
data l'evento resterebbe "in corso" fino a mezzanotte. Quando l'orario ufficiale
non c'e' (evento ricostruito solo dai profili) si usa comunque `06:59:59Z` del
giorno di fine, che e' l'orario con cui chiudono tutte le time trial.

> Le time trial di GT7 durano due settimane e ne partono una o due a settimana:
> nel periodo di sovrapposizione **piu' eventi sono davvero aperti insieme**
> (a settembre 2026 ne sono arrivati a tre), quindi in "Time trial in corso"
> restano piu' card finche' non scadono. Non e' un dato vecchio: e' il
> calendario del gioco. Il codice tiene una **lista** di eventi per data di
> inizio, non un solo nome, altrimenti i due eventi partiti lo stesso giorno
> si sovrascriverebbero e uno sparirebbe dal sito.

## Lo storico dei piloti e' PAGINATO (scoperta del 21/09/2026)

`/player/<PSN>` mostra solo **10 time trial e 10 gare per pagina**. Leggendo
solo la prima pagina, le statistiche "ALL TIME" erano in realta' limitate agli
ultimi ~20 eventi: per questo quasi tutti i piloti risultavano fermi a 20.

La paginazione di Livewire risponde anche via URL:

```
https://gt-gridstats.com/player/<PSN>?eventPage=2
https://gt-gridstats.com/player/<PSN>?dailyPage=2
```

`profilo_completo()` le scorre tutte (max 15 pagine, si ferma quando una
pagina non aggiunge eventi nuovi) e ricostruisce lo storico reale: da ~20 a
~120 eventi per pilota.

### Per non pesare sulla fonte

Scaricare tutto sono ~13 richieste per pilota (~340 per giro). Percio':

- il giro delle **05:00 UTC** usa `--full` e scarica tutte le pagine;
- quelli delle **07:15, 08:20 e 17:00 UTC** leggono solo la prima pagina;
- i dati nuovi vengono **uniti** a quelli gia' salvati, quindi il giro
  leggero non fa mai sparire lo storico profondo.

Il workflow sceglie in base a `github.event.schedule`, che contiene
l'espressione cron che ha avviato il run: per questo le tre schedulazioni sono
tre voci separate e non una sola con `5,17` (con la voce unica il confronto non
scattava mai e il giro completo non partiva).
