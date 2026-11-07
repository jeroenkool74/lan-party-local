#!/usr/bin/env bash
# Ask the running server to save immediately (to save/lan-latest.park).
# Answers "paused" when nobody is online: the game is frozen then and the
# autosave already covers the current state.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh
server_exec /opt/lan/bin/control.sh save
