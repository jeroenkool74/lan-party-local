#!/usr/bin/env bash
# Restore a backup made by backup.sh:  ./scripts/restore.sh backups/lan-openrct2-YYYYmmdd-HHMMSS.tar.gz
# The current data is NOT deleted: it is first saved as a new backup, and the
# volumes are only replaced after you confirm.
set -Eeuo pipefail
archive="${1:-}"
[[ -f "$archive" ]] || { echo "usage: restore.sh <backup.tar.gz>" >&2; exit 1; }
archive="$(cd "$(dirname "$archive")" && pwd)/$(basename "$archive")"
cd "$(dirname "$0")/.."
. scripts/lib.sh

echo "This replaces the game and dashboard data with $archive."
read -r -p "Type 'restore' to continue: " answer
[[ "$answer" == restore ]] || { echo "aborted"; exit 1; }

echo "1/4 safety backup of the current data"
./scripts/backup.sh
echo "2/4 stopping the stack"
stop_stack
echo "3/4 restoring volumes"
tar -tzf "$archive" data/ >/dev/null 2>&1 || { echo "not a backup made by backup.sh" >&2; exit 1; }
# Each volume is written by the user that owns it (no root, no chown needed).
tool_run -v "$archive:/restore.tar.gz:ro" -v "$DATA_VOLUME:/data" -- bash -c '
      set -e
      find /data -mindepth 1 -delete
      tar -xzf /restore.tar.gz -C / data'
tool_run --user 1000:1000 -v "$archive:/restore.tar.gz:ro" -v "$DASHBOARD_VOLUME:/dashboard" -- bash -c '
      set -e
      tmp=$(mktemp -d)
      tar -xzf /restore.tar.gz -C "$tmp" dashboard 2>/dev/null || true
      db="$tmp/dashboard/backup-snapshot.sqlite"
      [ -f "$db" ] || db="$tmp/dashboard/stats.sqlite"
      if [ -f "$db" ]; then
        rm -f /dashboard/stats.sqlite /dashboard/stats.sqlite-wal /dashboard/stats.sqlite-shm
        cp "$db" /dashboard/stats.sqlite
      else
        echo "no dashboard database in the backup; dashboard history left as it is"
      fi
      rm -rf "$tmp"'
echo "4/4 starting the stack"
start_stack
echo "restored. The server resumes from the newest save in the backup."
