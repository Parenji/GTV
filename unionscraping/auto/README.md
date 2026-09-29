# Auto dei piloti GTV dalle classifiche (`auto_from_screenshots.py`)

La sezione **Piloti** di `union.html` mostra, per ogni pilota GTV, l'auto usata
in campionato. I dati arrivano da `unionscraping/auto.json`, che viene letto dalle
**classifiche ufficiali** delle gare: le colonne `Union_auto` / `Union_marchio`
del foglio Google restano la fonte primaria e `auto.json` interviene solo
quando sono vuote.

```bash
cd unionscraping/auto
python3 auto_from_screenshots.py --dry-run   # anteprima: non scrive niente
python3 auto_from_screenshots.py             # aggiorna auto.json
```

Come funziona:

1. si autentica all'app Apps Script **UNION SCREENSHOT** (quella con gli
   screenshot delle classifiche di ogni lobby);
2. scarica gli screenshot di tutte le gare e lobby in una cache locale
   (`unionscraping/auto/.screenshots/`, ignorata da git);
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
