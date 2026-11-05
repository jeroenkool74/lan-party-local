#!/usr/bin/env bash
# Talks to the lan-stats plugin's container-local control channel (127.0.0.1 only).
#   control.sh save   save the running game to save/lan-latest.park
#   control.sh ping
set -Eeuo pipefail
cmd="${1:-ping}"
exec 3<>"/dev/tcp/127.0.0.1/${CONTROL_PORT:-11780}" || { echo "control channel not reachable (is lan-stats enabled?)" >&2; exit 1; }
printf '%s\n' "$cmd" >&3
read -r -t 30 reply <&3 || true
echo "${reply:-no reply}"
[[ "$reply" == saved* || "$reply" == pong* || "$reply" == paused ]]
