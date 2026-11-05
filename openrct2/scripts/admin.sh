#!/usr/bin/env bash
# Administrator management for the OpenRCT2 server.
#
#   ./scripts/admin.sh players               players the server has seen (name + key hash)
#   ./scripts/admin.sh grant <name|hash>     make a player Admin (identified by key hash)
#   ./scripts/admin.sh revoke <name|hash>    remove Admin again
#   ./scripts/admin.sh list                  registered keys in users.json
#
# A name is resolved to a public-key hash from what the server actually observed
# (the player must have joined once). You can also pass the 40-character hash
# directly, e.g. read from your client's keys/<name>-<hash>.pubkey file.
# Changes take effect when the player reconnects.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh

die() { echo "error: $*" >&2; exit 1; }

resolve() { # name|hash -> "hash<TAB>name" (the dashboard database knows which keys used which names)
    dashboard_exec node server/cli.ts resolve "$1"
}

case "${1:-}" in
    players)
        dashboard_exec node server/cli.ts players
        ;;
    list)
        server_exec /opt/lan/bin/users.sh list
        ;;
    grant)
        [[ -n "${2:-}" ]] || die "usage: admin.sh grant <name|hash>"
        out="$(resolve "$2")" || exit 1
        IFS=$'\t' read -r hash name <<< "$out"
        name="${NAME:-$name}"
        [[ -n "$name" ]] || die "this key has not been seen on the server; set NAME=<player name> in front of the command"
        echo "Granting Admin to '$name' with public key hash $hash"
        server_exec /opt/lan/bin/users.sh grant "$hash" "$name"
        echo "Done. Reconnect to the server as '$name' to receive Admin permissions."
        ;;
    revoke)
        [[ -n "${2:-}" ]] || die "usage: admin.sh revoke <name|hash>"
        out="$(resolve "$2")" || exit 1
        IFS=$'\t' read -r hash name <<< "$out"
        server_exec /opt/lan/bin/users.sh revoke "$hash"
        echo "Done. The change applies when '${name:-$hash}' reconnects."
        ;;
    *)
        sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
        exit 1
        ;;
esac
