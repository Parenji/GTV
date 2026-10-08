# Struttura della cartella

Promemoria di cosa serve al sito e cosa no. Vercel pubblica tutto quello che
sta nel repo e non è escluso da `.vercelignore`: il confine tra "sito" e
"lavoro interno" è anche un confine di pubblicazione.

## 1. Il sito

| Percorso | A cosa serve |
|---|---|
| `index.html` | Home: piloti, Sport, Sport Stats, admin, campionati, palmares |
| `union.html` | Campionato Union: lobby, live, risultati, classifiche, Report DG, calendario |
| `styles.css`, `ui.css` | Stile: `styles.css` è la base ereditata (header, menu), `ui.css` i componenti `ui-*` (vetrina: `stile.html`, non pubblicata) |
| `js/comune.js` | Codice comune: menu, navigazione a sezioni, `escapeHtml`, `urlSicuro`, `parseCsv`, fetch |
| `js/home.js`, `js/sport.js` | Logica della home (piloti, admin, scheda pilota, palmares) e delle sezioni Sport |
| `js/union.js` | Logica di `union.html` |
| `config.js` | URL dei fogli Google, percorsi dei dati, fogli del Report DG |
| `dati/` | Dati letti dal sito (vedi sotto) |
| `favicon/`, `font/`, `images/`, `pdf/` | Asset statici |
| `api/telegram.py` | Funzione Vercel: webhook del bot Telegram |
| `api/gt7.py` | Funzione Vercel: proxy verso l'API ufficiale GT7 (che risponde 403 ai server di GitHub), usato da `gt7_sport.py` |
| `vercel.json`, `requirements.txt` | Configurazione del deploy (header no-cache su `dati/`, redirect delle pagine archiviate) |

Ogni pagina carica `config.js`, `js/comune.js` e poi solo i suoi script.

### Dati (`dati/`)

| File | Chi lo scrive | Chi lo legge |
|---|---|---|
| `dati/union/calendario.json` | **a mano** | `js/union.js`, bot, `classifiche.py` |
| `dati/union/lobby.json` | `unionscraping/scraper/scraper.py` (workflow *Union Scraper*) | `js/union.js`, bot |
| `dati/union/classifiche.json` | `unionscraping/classifiche/classifiche.py` (workflow *Union Classifiche*) | `js/union.js` |
| `dati/sport.json` | `sportscraping/gt7_sport.py` (workflow *GT7 Sport Data*) | `js/sport.js` |
| `dati/palmares.json` | **a mano** (campionati conclusi) | `js/home.js` |

I file generati si riscrivono solo se il contenuto cambia, in modo atomico, e
solo dopo controlli di sanità: se una fonte risponde male il file vecchio
resta e il workflow diventa rosso.

## 2. Strumenti (non pubblicati)

| Cartella | Cosa contiene |
|---|---|
| `unionscraping/` | Scraper Union, classifiche, bot e modulo `comune/`. Dettagli in `unionscraping/README.md` |
| `sportscraping/` | `gt7_sport.py` (dati Sport Mode), `diagnostica.py` (controllo delle fonti, solo in locale), note in `ricerca/` |
| `.github/workflows/` | Le automazioni (sotto) |
| `.github/actions/commit-push/` | Passo comune dei workflow: commit solo se cambia, rebase e push con 3 tentativi, rosso se fallisce |

Restano raggiungibili sul sito solo i `.py` di `unionscraping/bot/` e
`unionscraping/comune/`, perché `api/telegram.py` li importa: non contengono
segreti.

### Workflow

| Workflow | Quando (UTC) | Cosa aggiorna |
|---|---|---|
| `union-scrape.yml` | 00:17 e 12:17 | `dati/union/lobby.json` |
| `union-classifiche.yml` | ogni 6 ore (:41) | `dati/union/classifiche.json`; macOS solo se c'è un'immagine nuova da leggere |
| `gt7-sport.yml` | 05:04 (completo), 07:11, 08:23, 17:07 | `dati/sport.json` |
| `union-race-message.yml` | 20:00 (aspetta la mezzanotte italiana) e 05:00 | messaggio Telegram, `unionscraping/bot/.sent_state.json` |

Minuti non tondi apposta: alle ore piene GitHub accumula ritardi di ore.
Ogni push su `main` fa ripartire il deploy di Vercel.

## 3. Regole pratiche

- **I dati del sito vanno in `dati/`**: ha già gli header no-cache.
- **Il materiale personale non va nel repo**: `_locale/` e
  `unionscraping/telecronaca/` sono ignorati da git.
- **Gli script usano percorsi assoluti** basati su
  `Path(__file__).resolve().parent`.
- **Niente credenziali nel repo**: vanno in `unionscraping/.env.telegram`
  (ignorato) o nei secrets di GitHub e Vercel.
- **Nuova gara Union**: si aggiorna `dati/union/calendario.json`; per il
  Report DG si aggiunge la voce in `config.js` → `unionReportDG`.
- **Nuovo titolo**: si aggiunge una voce in cima a `dati/palmares.json`.
