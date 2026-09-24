# Struttura della cartella

Promemoria di cosa serve al sito e cosa no. **Vercel pubblica tutto quello che
sta nella root**: ogni file qui dentro è raggiungibile su
`granturismotv.vercel.app`. Il confine tra "sito" e "lavoro interno" è quindi
anche un confine di pubblicazione, ed è gestito da `.vercelignore`.

## 1. Serve al sito

Le pagine e i loro asset. Se tocchi qualcosa qui, tocchi il sito.

| Percorso | A cosa serve |
|---|---|
| `index.html` | Home, con le sezioni Sport e Sport Stats |
| `union.html` | Campionato Union (piloti, lobby, calendario) |
| `gtec.html` | GTEC |
| `worldchampionship.html` | World Championship |
| `styles.css`, `scripts.js` | Stile e logica condivisi |
| `union.js`, `gtec.js` | Logica delle singole pagine |
| `config.js` | URL dei fogli Google e degli altri dati |
| `favicon/`, `font/`, `images/`, `pdf/` | Asset statici |
| `api/telegram.py` | Funzione serverless del bot Telegram (Vercel) |
| `requirements.txt`, `vercel.json` | Configurazione del deploy |

### Dati che il sito carica a runtime

Sono file **generati**: si aggiornano da soli, non si modificano a mano.

| File | Chi lo scrive | Chi lo legge |
|---|---|---|
| `unionscraping/data.json` | `unionscraping/scraper.py` (workflow *Union Scraper*) | `union.js` |
| `unionscraping/auto.json` | `unionscraping/auto_from_screenshots.py` | `union.js` |
| `sportscraping/sport.json` | `sportscraping/gt7_sport.py` (workflow *GT7 Sport Data*) | `scripts.js` |

## 2. Strumenti per task correlate (non sono il sito)

Stanno nel repo perché ci girano i workflow o perché servono a rigenerare i
dati qui sopra. Non vengono pubblicati.

### `unionscraping/` — campionato Union

| File | Cosa fa |
|---|---|
| `scraper.py` | Scarica lobby e piloti dal sito HUB Union → `data.json` |
| `auto_from_screenshots.py` | Legge le auto dalle classifiche ufficiali → `auto.json` |
| `ocr.swift` | Helper OCR (framework Vision di macOS) usato dallo script sopra |
| `telecronaca.py` | Genera il foglietto stampabile per la telecronaca di una lobby |
| `gtv_bot.py` | Pannello di controllo su Telegram |
| `whatsapp_reminder.py` | Genera i messaggi promemoria dei giorni di gara |
| `macos_bot_service.sh` | Avvia il bot come servizio locale su macOS |
| `README.md` | Istruzioni dei vari strumenti |

`unionscraping/quali.json` è la memoria dell'ordine di qualifica per lobby:
lo scrive `telecronaca.py` quando usi `--quali "..."`.

### `sportscraping/` — Sport Mode di GT7

`gt7_sport.py` raccoglie i dati Sport Mode → `sport.json`; `ricerca/` contiene
le note sulle API di GT7 GridStats.

### `.github/workflows/` — automazioni

| Workflow | Quando | Cosa aggiorna |
|---|---|---|
| `union-scrape.yml` | ogni 12 ore | `unionscraping/data.json` |
| `gt7-sport.yml` | 4 volte al giorno: 05:00 e 17:00 UTC, più 07:15 UTC (rotazione degli eventi) e 08:20 UTC di controllo | `sportscraping/sport.json` |
| `union-race-message.yml` | la sera dei giorni di gara | messaggio Telegram |

Tutti fanno push su `main`, e ogni push fa ripartire il deploy di Vercel.

## 3. Regole pratiche

- **Non scrivere file generati nella root**: finirebbero pubblicati sul sito.
  Usa una sottocartella dedicata e aggiungila a `.gitignore` e `.vercelignore`
  (esempio: `unionscraping/telecronaca/`).
- **Gli script devono usare percorsi assoluti** basati su
  `Path(__file__).resolve().parent`, non nomi di file relativi alla cartella
  corrente: è così che era nato il `data.json` duplicato nella root.
- **Niente credenziali nel repo**: vanno in `.env.gtv` o `.env.telegram`
  (entrambi ignorati da git).
- **`unionscraping/*.py` non va escluso da `.vercelignore`**: `api/telegram.py`
  li importa a runtime.
