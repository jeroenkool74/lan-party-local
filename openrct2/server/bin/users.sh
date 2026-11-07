#!/usr/bin/env bash
# Edits OpenRCT2's users.json (public-key hash -> registered name + group).
# OpenRCT2 re-reads this file whenever a player joins, so changes apply on the
# player's next (re)connect; no server restart is needed.
#   users.sh list
#   users.sh grant  <hash> <name>   register the key as Admin (group 0)
#   users.sh revoke <hash>          move the key back to the default group
set -Eeuo pipefail
FILE="${OPENRCT2_DATA:-/data}/users.json"
ADMIN_GROUP=0

[[ -f "$FILE" ]] || echo '[]' > "$FILE"
jq -e 'type == "array"' "$FILE" >/dev/null || { echo "users.json is not a JSON array; not touching it" >&2; exit 1; }

valid_hash() { [[ "$1" =~ ^[0-9a-f]{40}$ ]] || { echo "not a public key hash (40 hex characters): $1" >&2; exit 1; }; }
write() { # jq filter + args, applied atomically with a backup of the previous version
    local tmp
    tmp="$(mktemp "$FILE.XXXXXX")"
    jq "$@" "$FILE" > "$tmp"
    cp -p "$FILE" "$FILE.bak"
    mv "$tmp" "$FILE"
}

case "${1:-}" in
    list)
        jq -r '.[] | select(.hash != "") | "\(.name)\t\(.hash)\tgroup \(.groupId // "default")"' "$FILE"
        ;;
    grant)
        hash="${2:-}"; name="${3:-}"
        valid_hash "$hash"
        [[ -n "$name" ]] || { echo "usage: users.sh grant <hash> <name>" >&2; exit 1; }
        clash="$(jq -r --arg h "$hash" --arg n "$name" '.[] | select(.hash != $h and (.name | ascii_downcase) == ($n | ascii_downcase)) | .hash' "$FILE")"
        [[ -z "$clash" ]] || { echo "the name '$name' is already registered to another key ($clash)" >&2; exit 1; }
        write --arg h "$hash" --arg n "$name" --argjson g "$ADMIN_GROUP" '
            if any(.[]; .hash == $h) then map(if .hash == $h then .groupId = $g | .name = $n else . end)
            else . + [{hash: $h, name: $n, groupId: $g}] end'
        echo "registered $name ($hash) as Admin"
        ;;
    revoke)
        hash="${2:-}"
        valid_hash "$hash"
        jq -e --arg h "$hash" 'any(.[]; .hash == $h)' "$FILE" >/dev/null || { echo "$hash is not registered" >&2; exit 1; }
        write --arg h "$hash" 'map(if .hash == $h then .groupId = null else . end)'
        echo "$hash moved back to the default group"
        ;;
    *)
        echo "usage: users.sh list | grant <hash> <name> | revoke <hash>" >&2
        exit 1
        ;;
esac
