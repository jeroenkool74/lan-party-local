#!/usr/bin/env bash
# Online backup of everything that matters, into ./backups/<timestamp>.tar.gz:
#   - the complete OpenRCT2 user directory (saves, autosaves, archive, users.json,
#     groups.json, config.ini, plugin.store.json, logs). FFA ownership and
#     balances live inside the .park saves (plugin park storage).
#   - a consistent copy of the dashboard SQLite database (VACUUM INTO).
# Safe to run while the server is up; it asks the server to save first.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh
ts="$(date +%Y%m%d-%H%M%S)"
mkdir -p backups
out="backups/lan-openrct2-$ts.tar.gz"
n=2; while [[ -e "$out" ]]; do out="backups/lan-openrct2-$ts-$n.tar.gz"; n=$((n + 1)); done   # never overwrite a backup

if reply="$(server_exec /opt/lan/bin/control.sh save 2>/dev/null)"; then
    case "$reply" in
        saved*) echo "server: $reply" ;;
        paused) echo "server is paused (nobody online), it cannot save now; the newest existing save is used" ;;
        *)      echo "note: server answered '$reply'; the newest existing save is used" ;;
    esac
else
    echo "note: could not request a save (server stopped?); the newest existing save is used"
fi

if dashboard_exec true 2>/dev/null; then
    dashboard_exec sh -c "rm -f /data/backup-snapshot.sqlite && node server/cli.ts snapshot-db /data/backup-snapshot.sqlite" >/dev/null
fi

# Read the volumes with a throw-away container running as the game server user (owner of
# the game data, e.g. users.json is private to it). The archive is streamed to this
# shell, so the file belongs to you.
trap 'rm -f "$out.partial"' ERR
tool_run -v "$DATA_VOLUME:/data:ro" -v "$DASHBOARD_VOLUME:/dashboard:ro" -- \
    tar -czf - -C / data dashboard > "$out.partial"
mv "$out.partial" "$out"
dashboard_exec rm -f /data/backup-snapshot.sqlite 2>/dev/null || true
echo "backup written to $out ($(du -h "$out" | cut -f1))"
