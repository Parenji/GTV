# unionscraping — campionato Union

Ogni strumento sta nella sua cartella. I dati che il sito legge restano qui
in cima, così i loro URL (`/unionscraping/data.json`, `/unionscraping/auto.json`)
non cambiano.

| Cartella | Cosa fa | Scrive |
|---|---|---|
| [`scraper/`](scraper/scraper.py) | Scarica lobby e piloti dal sito HUB Union (workflow *Union Scraper*, ogni 12 ore) | `data.json` |
| [`classifiche/`](classifiche/classifiche.py) | Classifiche generali e risultati di gara dal [Portale Classifiche Union](https://albixximo-union2026-r2.vercel.app/Classifiche/portal.html) (workflow *Union Classifiche*, ogni 6 ore) | `classifiche.json` |
| [`auto/`](auto/README.md) | Legge le auto dei piloti GTV dagli screenshot delle classifiche ufficiali (OCR di macOS) | `auto.json` |
| [`bot/`](bot/README.md) | Promemoria dei giorni di gara (`whatsapp_reminder.py`) e pannello Telegram (`gtv_bot.py`) | `bot/.sent_state.json`, `bot/messaggi/` |
| [`telecronaca/`](telecronaca/telecronaca.py) | Foglietto stampabile per la telecronaca di una lobby | `telecronaca/fogli/`, `telecronaca/quali.json` |

## Dati

| File | Chi lo scrive | Chi lo legge |
|---|---|---|
| `data.json` | `scraper/scraper.py` | `union.js`, `bot/`, `telecronaca/`, `api/telegram.py` |
| `auto.json` | `auto/auto_from_screenshots.py` | `union.js` |
| `classifiche.json` | `classifiche/classifiche.py` | `union.js` (sezioni Risultati e Classifiche) |

Sono file generati: non si modificano a mano.

### Da dove arrivano risultati e classifiche

La fonte e' il portale della Lega. Le classifiche generali sono tabelle
dentro la pagina e si leggono direttamente; i risultati di ogni lobby sono
immagini (`/Gare/G<n>/<LEGA>/<LOBBY>.png`) lette con l'OCR di macOS, piu' i
provvedimenti della direzione gara (`<LOBBY>-dg.json`). Gli screenshot di
`auto/` servono solo ad aggiungere qualifica, auto, distacco e giro veloce.

La lettura delle immagini del portale e' un'impalcatura: il formato non si
conosce finche' la Lega non pubblica la prima gara, e `leggi_immagine_gara()`
andra' tarata su quel PNG.

## Credenziali locali

Restano qui, ignorate da git:

- `.env.telegram`: token del bot Telegram (usato da `bot/`);
- `.env.gtv`: accesso all'app UNION SCREENSHOT (usato da `auto/`).

## Uso rapido

```bash
python3 unionscraping/scraper/scraper.py                     # aggiorna data.json
python3 unionscraping/auto/auto_from_screenshots.py --dry-run
python3 unionscraping/bot/whatsapp_reminder.py --today
python3 unionscraping/telecronaca/telecronaca.py A15
python3 unionscraping/classifiche/classifiche.py --dry-run
```

Gli script usano percorsi assoluti: si possono lanciare da qualunque cartella.
