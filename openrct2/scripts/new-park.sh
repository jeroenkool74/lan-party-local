#!/usr/bin/env bash
# Start over with the initial park from ../lan-data/openrct2-park (PARK_PATH). Existing saves are NOT deleted:
# they are moved to save/retired-<timestamp>/ inside the data volume (and a
# backup is made first). Dashboard history is kept; attractions that no longer
# exist are shown as demolished.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh
read -r -p "Retire all current saves and start a new game from ../lan-data/openrct2-park (PARK_PATH)? Type 'new park': " answer
[[ "$answer" == "new park" ]] || { echo "aborted"; exit 1; }
./scripts/backup.sh
docker stop "$SERVER" >/dev/null
tool_run -v "$DATA_VOLUME:/data" -- bash -c '
  set -e
  dest="/data/save/retired-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$dest"
  find /data/save -maxdepth 2 -name "*.park" -not -path "*/retired-*" -exec mv -t "$dest" {} +
  : > /data/.lan/unloadable-saves.txt
  echo "saves moved to $dest"'
docker start "$SERVER" >/dev/null
echo "started $SERVER"
