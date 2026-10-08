# unionscraping — campionato Union

Strumenti per il campionato Union. Ogni strumento sta nella sua cartella; il
codice condiviso sta in `comune/`. I dati che il sito legge stanno in
`dati/union/` (nella radice del repo), non qui.

| Cartella | Cosa fa | Scrive |
|---|---|---|
| [`scraper/`](scraper/scraper.py) | Lobby e piloti della settimana dai fogli del sito HUB Union (workflow *Union Scraper*, 2 volte al giorno) | `dati/union/lobby.json` |
| [`classifiche/`](classifiche/classifiche.py) | Classifiche generali e risultati di gara dal [Portale Classifiche Union](https://albixximo-union2026-r2.vercel.app/Classifiche/portal.html) (workflow *Union Classifiche*, ogni 6 ore) | `dati/union/classifiche.json`, `classifiche/cache.json` |
| [`bot/`](bot/README.md) | Promemoria dei giorni di gara (`whatsapp_reminder.py`) e pannello Telegram (`gtv_bot.py`) | `bot/.sent_state.json`, `bot/messaggi/` |
| [`comune/`](comune/__init__.py) | Funzioni condivise: download con retry, CSV, nomi dei piloti, json atomici, client Telegram, OCR di macOS, calendario | — |
| `telecronaca/` | Strumento personale per la telecronaca: **non e' nel repo** (ignorato da git) | — |

## Dati

| File | Chi lo scrive | Chi lo legge |
|---|---|---|
| `dati/union/calendario.json` | **a mano** (una voce per gara) | `js/union.js`, `bot/`, `classifiche/`, `api/telegram.py` |
| `dati/union/lobby.json` | `scraper/scraper.py` | `js/union.js`, `bot/`, `api/telegram.py` |
| `dati/union/classifiche.json` | `classifiche/classifiche.py` | `js/union.js` (sezioni Risultati e Classifiche) |

Il calendario e' l'unico da modificare a mano: piste, settimane di gara e
round stanno solo li'. Gli altri sono generati e si riscrivono solo quando il
contenuto cambia davvero (niente commit per il solo orario).

### Controlli prima di scrivere

- `scraper.py` non scrive se i fogli rispondono con meno di 10 lobby o 100
  piloti, o se le lobby calano di oltre la meta' rispetto al file precedente.
- `classifiche.py` non scrive se una lega ha la classifica vuota o se le gare
  corse diminuiscono (`--forza` per scrivere comunque).
- In entrambi i casi il file vecchio resta e il workflow diventa rosso.

### Da dove arrivano risultati e classifiche

La fonte e' solo il portale della Lega. Le classifiche generali sono tabelle
dentro la pagina e si leggono direttamente (anche i pari merito, che hanno la
Pos vuota; le celle gara sono piazzamenti con stelle di pole e giro veloce,
non punti). I risultati di ogni lobby sono immagini 4K
(`/Gare/G<n>/<LEGA>/<LOBBY>.png`) con la classifica definitiva completa
(pilota, auto, qualifica, tempo, giro, punti), lette con l'OCR di macOS riga
per riga e colonna per colonna.

**Senza stato**: a ogni giro tutto si ricostruisce dal portale. I punti gara
per gara vengono dalla colonna Punti delle immagini; la differenza con il
totale ufficiale (bonus, penalita') va sull'ultima gara corsa. La posizione
dopo ogni gara (`storico_pos`) e' la classifica dei punti cumulati. Un giro
saltato o un file azzerato non perdono nulla.

Le immagini gia' lette stanno in `classifiche/cache.json`, per ETag: si
rileggono solo se cambiano (`--rileggi` forza). Il workflow controlla prima
su Linux (`--controlla`) e usa un runner macOS solo quando c'e' un'immagine
nuova da leggere.

I provvedimenti della direzione gara non si leggono dal portale (non li
mostra): stanno nella sezione Report DG, dal foglio dei reclami.

## Credenziali locali

Restano in questa cartella, ignorate da git: `.env.telegram` con il token del
bot Telegram (usato da `bot/`).

## Uso rapido

```bash
python3 unionscraping/scraper/scraper.py                     # aggiorna lobby.json
python3 unionscraping/classifiche/classifiche.py --dry-run
python3 unionscraping/bot/whatsapp_reminder.py --list
python3 unionscraping/bot/whatsapp_reminder.py --today
```

Gli script usano percorsi assoluti: si possono lanciare da qualunque cartella.
