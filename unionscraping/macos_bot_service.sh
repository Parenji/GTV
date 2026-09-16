#!/bin/bash
# =============================================================================
# GTV Control Panel — servizio macOS (launchd)
# =============================================================================
# Avvia il bot Telegram all'accesso e lo tiene vivo: se il Mac e' sveglio il
# pannello risponde subito; se il Mac dorme, i comandi restano in coda su
# Telegram e vengono processati alla riaccensione.
#
# Uso:
#   ./macos_bot_service.sh install     # installa e avvia il servizio
#   ./macos_bot_service.sh status      # stato + ultime righe di log
#   ./macos_bot_service.sh restart     # riavvia
#   ./macos_bot_service.sh uninstall   # ferma e rimuove il servizio
# =============================================================================

set -euo pipefail

LABEL="com.gtv.unionbot"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="$(command -v python3)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

usage() {
  grep '^#' "$0" | sed 's/^# \{0,1\}//' | sed -n '1,16p'
  exit 1
}

# launchctl cambia sintassi fra le versioni di macOS: proviamo la moderna e
# ricadiamo sulla vecchia.
load_plist() {
  launchctl bootstrap "$DOMAIN" "$PLIST" 2>/dev/null \
    || launchctl load -w "$PLIST"
}

unload_plist() {
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null \
    || launchctl unload -w "$PLIST" 2>/dev/null \
    || true
}

install_service() {
  if [ ! -f "$SCRIPT_DIR/.env.telegram" ]; then
    echo "x Manca $SCRIPT_DIR/.env.telegram con TELEGRAM_BOT_TOKEN." >&2
    exit 2
  fi

  mkdir -p "$HOME/Library/LaunchAgents"

  cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>

  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON</string>
    <string>$SCRIPT_DIR/gtv_bot.py</string>
  </array>

  <key>WorkingDirectory</key>
  <string>$SCRIPT_DIR</string>

  <key>RunAtLoad</key>
  <true/>

  <!-- se il bot crasha, launchd lo riavvia -->
  <key>KeepAlive</key>
  <true/>

  <!-- niente riavvii continui se il token e' sbagliato -->
  <key>ThrottleInterval</key>
  <integer>30</integer>

  <key>StandardOutPath</key>
  <string>$SCRIPT_DIR/bot.log</string>
  <key>StandardErrorPath</key>
  <string>$SCRIPT_DIR/bot.log</string>

  <key>ProcessType</key>
  <string>Background</string>
</dict>
</plist>
PLIST_EOF

  unload_plist
  load_plist
  sleep 1
  echo "OK: servizio installato e avviato."
  echo "   plist: $PLIST"
  echo "   log:   $SCRIPT_DIR/bot.log"
  status_service
}

status_service() {
  echo
  if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
    echo "Stato: ATTIVO"
    launchctl print "$DOMAIN/$LABEL" | grep -E "^\s*(state|pid) " || true
  else
    echo "Stato: NON attivo"
  fi
  if [ -f "$SCRIPT_DIR/bot.log" ]; then
    echo
    echo "--- ultime righe di bot.log ---"
    tail -n 10 "$SCRIPT_DIR/bot.log"
  fi
}

restart_service() {
  unload_plist
  load_plist
  echo "OK: servizio riavviato."
}

uninstall_service() {
  unload_plist
  rm -f "$PLIST"
  echo "OK: servizio rimosso (i log restano in $SCRIPT_DIR/bot.log)."
}

case "${1:-}" in
  install)   install_service ;;
  status)    status_service ;;
  restart)   restart_service ;;
  uninstall) uninstall_service ;;
  *)         usage ;;
esac
