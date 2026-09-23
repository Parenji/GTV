# Promemoria gare UNION → WhatsApp / Telegram

Tre pezzi che condividono gli stessi dati (`data.json` + `union.html`):

| | cosa fa |
|---|---|
| `whatsapp_reminder.py` | genera i messaggi (e li invia su Telegram) — usato dal cron |
| `gtv_bot.py` | **pannello di controllo su Telegram** con menu interattivo |
| `api/telegram.py` | webhook per Vercel: rende il pannello sempre attivo, senza Mac acceso |

Genera, per **ogni giorno di gara**, il messaggio pronto da inoltrare nella
bacheca WhatsApp del team GTV: riepilogo dei piloti GTV che corrono quella sera
(lobby, categoria, orario, host, link della live), incitamento e promemoria
della richiesta di amicizia all'Host **entro le 12:00**.

## Come funziona

```
union.html  ──►  calendario Round 2 (pista + settimane di gara)
data.json   ──►  lobby + piloti (generato da scraper.py dai fogli Union)
                          │
              ┌───────────┴────────────┐
              ▼                        ▼
  whatsapp_reminder.py          gtv_bot.py (pannello Telegram)
  • cron a mezzanotte           • in locale: polling (Mac accesso)
  • file .txt + invio           • su Vercel: api/telegram.py (sempre attivo)
```

- I giorni di gara sono **lunedì–venerdì** delle settimane indicate in
  `union.html` (sabato e domenica non si corre).
- Vengono elencate solo le lobby con almeno un pilota con `team == "GTV"`.
- Nei giorni non di gara non viene generato né inviato nulla.

## Uso manuale

```bash
cd unionscraping

python3 whatsapp_reminder.py --list          # elenca tutti i giorni di gara
python3 whatsapp_reminder.py                 # messaggio di oggi (se è giorno di gara)
python3 whatsapp_reminder.py --date 2026-09-21
python3 whatsapp_reminder.py --all           # tutti i giorni del prossimo round
python3 whatsapp_reminder.py --round 2 --all # tutti i giorni della Gara 2
python3 whatsapp_reminder.py --season        # tutta la stagione (30 messaggi)
python3 whatsapp_reminder.py --all --copy    # e copia negli appunti (macOS)

# Anteprima di quello che partirebbe a mezzanotte, senza inviare:
python3 whatsapp_reminder.py --today

# Invio Telegram reale (richiede le credenziali, vedi sotto):
python3 whatsapp_reminder.py --date 2026-09-21 --send-telegram --force
```

I messaggi generati finiscono in `unionscraping/whatsapp/` (cartella ignorata da git).

## Pannello di controllo (`gtv_bot.py`)

Un bot Telegram con menu a pulsanti: apri **@GTVadminbot** e premi **Start**,
poi `/menu`.

```
🎛 GTV Control Panel
   🏁 Union
      📤 Messaggio di oggi            (se oggi è giorno di gara)
      📅 Gara 1 · Red Bull Ring       → Lun / Mar / Mer / Gio / Ven
                                       → 📦 Tutta la settimana
      🏆 Scegli un'altra gara         → Gara 1 … Finale
      📋 Calendario giorni di gara
```

Ogni messaggio generato arriva in chat già formattato per WhatsApp
(`*grassetto*`), con il pulsante **📄 Invia come file .txt** se preferisci
il file. Comandi disponibili: `/start`, `/menu`, `/union`, `/oggi`, `/id`,
`/help`.

Il bot è progettato per crescere: i futuri task diventano nuovi moduli nel
menu principale (in `gtv_bot.py`, metodo `build_main_menu`).

### Avvio manuale

```bash
cd unionscraping
python3 gtv_bot.py                 # long polling: il pannello risponde
python3 gtv_bot.py --set-commands  # registra i comandi nel menu di Telegram
python3 gtv_bot.py --once          # processa i comandi in sospeso ed esce
```

### Sempre attivo su Vercel (webhook) — consigliato

Il pannello gira su Vercel e risponde **anche a Mac spento**. Non c'è nessun
processo da tenere acceso: Telegram consegna i comandi direttamente
all'indirizzo pubblico della funzione.

```
https://granturismotv.vercel.app/api/telegram
```

**Variabili d'ambiente da impostare su Vercel** (Project → Settings →
Environment Variables, per *tutti* gli ambienti):

| Nome | Valore |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token di @BotFather |
| `TELEGRAM_ALLOWED_CHAT_IDS` | il tuo `chat_id` (es. `75176189`) |

**Attivare il webhook** (una volta sola, dopo il deploy):

```bash
cd unionscraping
python3 gtv_bot.py --set-webhook https://granturismotv.vercel.app/api/telegram
python3 gtv_bot.py --webhook-info     # controlla che sia tutto a posto
```

> ⚠️ Telegram non permette di usare polling e webhook insieme: dopo
> `--set-webhook` il bot lanciato sul Mac smette di ricevere i comandi. Per
> tornare alla modalità locale: `python3 gtv_bot.py --delete-webhook`.

**Diagnostica**: una GET sullo stesso URL risponde con lo stato della funzione
(non espone segreti):

```bash
curl https://granturismotv.vercel.app/api/telegram
```

**Come è protetto**: ogni richiesta deve portare l'header
`X-Telegram-Bot-Api-Secret-Token`, un segreto derivato dal token del bot
(`webhook_secret()` in `gtv_bot.py`). Le chiamate senza header valido
ricevono `401`, quindi nessun estraneo può far parlare il bot.

Se per qualche motivo `unionscraping/` non finisse nel bundle della funzione,
`api/telegram.py` scarica `union.html` e `data.json` dal repo pubblico
(`includeFiles` in `vercel.json` è la strada normale, il download è la rete di
sicurezza).

### Avvio automatico su macOS (alternativa al webhook)

```bash
cd unionscraping
./macos_bot_service.sh install     # avvia il bot a ogni login e lo tiene vivo
./macos_bot_service.sh status      # stato + ultime righe di log
./macos_bot_service.sh restart
./macos_bot_service.sh uninstall
```

Il servizio (launchd) riavvia il bot se crasha. Se il Mac è spento o in
letargo il pannello non risponde, ma i comandi restano in coda su Telegram e
vengono eseguiti appena il Mac si riaccende. **L'invio automatico di
mezzanotte resta su GitHub Actions e funziona anche a Mac spento.**

Usa questa modalità **solo se non attivi il webhook**: sono alternative.

### Limitare l'accesso

Il bot risponde a chiunque finché non imposti l'allowlist. Mandagli `/id` per
vedere il tuo `chat_id`, poi aggiungilo in `.env.telegram`:

```ini
TELEGRAM_ALLOWED_CHAT_IDS=123456789
```

## Credenziali Telegram

Ordine di priorità:

1. `--token` / `--chat-id` sulla riga di comando;
2. variabili d'ambiente `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`;
3. file locale **git-ignorato** `unionscraping/.env.telegram`.

```ini
# unionscraping/.env.telegram
TELEGRAM_BOT_TOKEN=123456789:AA...
TELEGRAM_CHAT_ID=-1001234567890   # gruppo (id negativo) o chat privata
```

Il token **non va mai committato**: il file è già in `.gitignore`.

### Setup del bot (una volta sola)

1. Su Telegram apri **@BotFather** → `/newbot` → copia il token.
2. **Apri il bot e premi Start** (chat privata) — oppure aggiungilo a un
   gruppo e scrivi lì un messaggio.
3. Ricava l'id della destinazione:

   ```bash
   cd unionscraping
   python3 whatsapp_reminder.py --detect-chat-id
   ```

4. Incolla l'id in `unionscraping/.env.telegram` (`TELEGRAM_CHAT_ID=...`).
5. Prova subito con un invio forzato:

   ```bash
   python3 whatsapp_reminder.py --date 2026-09-21 --send-telegram --force
   ```

### Sicurezza del token

Il token è l'unica credenziale del bot: chi lo possiede può scrivere a nome
del bot. Se viene condiviso o sospetti una fuga, su **@BotFather** →
`/revoke` → scegli il bot: ottieni un token nuovo da sostituire in
`.env.telegram` e nel secret GitHub.

## Automazione (GitHub Actions)

Il workflow `.github/workflows/union-race-message.yml` invia il messaggio a
**mezzanotte italiana** nei giorni di gara:

- il job parte la sera (20:00 UTC = 22:00 italiane d'estate / 21:00 d'inverno),
  controlla che il giorno target sia davvero un giorno di gara, **aspetta la
  mezzanotte italiana** e solo allora invia (`--auto`);
- un secondo cron la mattina (05:00 UTC = 07:00 italiane) fa da **rete di
  sicurezza** se il primo giro non è mai partito;
- `unionscraping/.sent_state.json` registra i giorni già inviati: **lo stesso
  giorno non parte mai due volte**;
- aggiorna prima `data.json` con `scraper.py` (se lo scraping fallisce usa
  quello già nel repo);
- nei giorni non di gara esce subito, senza aspettare e senza inviare;
- si può lanciare a mano da **Actions → Union Race Message → Run workflow**
  (con una data esplicita per un invio immediato);
- salva i `.txt` generati come artifact del run.

> **Perché l'attesa e non un semplice cron a mezzanotte.** I cron di GitHub
> Actions non sono puntuali: il 21/09/2026 i due job previsti per le 22:00 e
> 23:00 UTC sono partiti con ~1h50m di ritardo (01:50 e 02:47 italiane) e il
> vecchio controllo "invia solo se sono le 00:xx" li ha scartati entrambi,
> **in silenzio**. Ora il job non si fida dell'orario di partenza: aspetta lui
> la mezzanotte. Un ritardo del cron non può più far saltare un invio.

### Secrets da configurare sul repo GitHub

Un *secret* è una variabile segreta che GitHub inietta nel workflow: serve
perché il token non può stare nel codice (chiunque lo leggerebbe).

**Settings → Secrets and variables → Actions → New repository secret**

| Nome | Valore |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token di @BotFather |
| `TELEGRAM_CHAT_ID` | id della chat privata con il bot (da `--detect-chat-id`) |

I secrets non finiscono mai nel repository e non sono visibili nemmeno dopo
il salvataggio (GitHub li mostra solo come `***`).

## WhatsApp: si può automatizzare?

No, non in modo sicuro: WhatsApp non offre un'API ufficiale per gli account
personali e le librerie non ufficiali (whatsapp-web.js, Baileys…) violano i
termini di servizio e possono far **bannare il numero**. Per questo il flusso
scelto è: Telegram come "sveglia" a mezzanotte → tu inoltri il messaggio nella
bacheca WhatsApp con due tap. Il messaggio è scritto con la sintassi
`*grassetto*` di WhatsApp, quindi il copia/incolla conserva la formattazione.

## Auto dei piloti GTV dalle classifiche (`auto_from_screenshots.py`)

La sezione **Piloti** di `union.html` mostra, per ogni pilota GTV, l'auto usata
in campionato. I dati arrivano da `auto.json`, che viene letto dalle
**classifiche ufficiali** delle gare: le colonne `Union_auto` / `Union_marchio`
del foglio Google restano la fonte primaria e `auto.json` interviene solo
quando sono vuote.

```bash
cd unionscraping
python3 auto_from_screenshots.py --dry-run   # anteprima: non scrive niente
python3 auto_from_screenshots.py             # aggiorna auto.json
```

Come funziona:

1. si autentica all'app Apps Script **UNION SCREENSHOT** (quella con gli
   screenshot delle classifiche di ogni lobby);
2. scarica gli screenshot di tutte le gare e lobby in una cache locale
   (`unionscraping/.screenshots/`, ignorata da git);
3. legge posizione, pilota e auto di ogni riga con l'**OCR di macOS**;
4. tiene solo i piloti GTV, prendendo l'elenco dal CSV piloti di `config.js`;
5. aggiorna `auto.json` **in modo incrementale**: i piloti già presenti non
   vengono mai cancellati, le gare nuove si aggiungono a `storico` e le auto
   cambiate vengono segnalate.

Opzioni utili:

| Opzione | Effetto |
|---|---|
| `--dry-run` | mostra la tabella e gli avvisi senza scrivere |
| `--gara "GARA 2"` | elabora solo una gara |
| `--lobby A15` | elabora solo una lobby |
| `--refresh` | riscarica gli screenshot anche se in cache |
| `--reocr` | ripete l'OCR da zero |
| `--keep-images` | conserva gli screenshot dopo la lettura |

Credenziali in `unionscraping/.env.gtv` (ignorato da git):

```
GTV_SCREENSHOT_USER=GTV
GTV_SCREENSHOT_PASSWORD=...
```

Non serve nessun browser e nessuna libreria esterna: il programma parla
direttamente con l'app via `urllib`. L'unico requisito è macOS con Xcode
Command Line Tools (`xcode-select --install`), perché l'OCR usa il framework
Vision di sistema. L'helper `ocr.swift` viene compilato al primo avvio e messo
in cache.

Lo script **segnala da solo le anomalie** che trova, invece di ignorarle: per
esempio gli screenshot archiviati nella cartella di un'altra lobby (è successo
con la A9, che conteneva copie della A7) e i piloti visti con auto diverse tra
qualifiche e gara.

## Note

- I link delle live e gli host arrivano dai fogli Union: se cambiano, si
  aggiornano da soli al giro di scraping successivo.
- L'assegnazione lobby/piloti è quella per giorno della settimana pubblicata
  dalla lega (vale per tutti i round).
- `python3 whatsapp_reminder.py --help` per tutte le opzioni.
