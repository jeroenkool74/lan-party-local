#!/usr/bin/env bash
# Supervisor for the OpenRCT2 dedicated server.
#
#  1. Applies the managed config.ini keys (pause when empty, autosave, LAN only, ...)
#  2. Creates groups.json with sane defaults if it does not exist (never overwrites)
#  3. Installs the enabled plugins into plugin/managed/
#  4. Picks the newest valid save (autosave / shutdown save / archive) and falls
#     back to older saves if one fails to load. The initial park is only used
#     when no save exists at all.
#  5. Keeps hourly archive copies of the newest autosave
#  6. On SIGTERM asks the lan-stats plugin to save, then stops the server.
set -Eeuo pipefail

DATA="${OPENRCT2_DATA:-/data}"
PARK_DIR="${PARK_DIR:-/park}"
SAVE="$DATA/save"
LAN_STATE="$DATA/.lan"
BAD_LIST="$LAN_STATE/unloadable-saves.txt"
READY_FLAG="/tmp/openrct2.ready"
CONTROL_PORT="${CONTROL_PORT:-11780}"
STARTUP_TIMEOUT="${STARTUP_TIMEOUT:-180}"
ARCHIVE_INTERVAL_MINUTES="${ARCHIVE_INTERVAL_MINUTES:-60}"
ARCHIVE_KEEP="${ARCHIVE_KEEP:-48}"
SERVER_PID=""
ARCHIVER_PID=""

log() { printf '[entrypoint] %s\n' "$*" >&2; }
die() { log "FATAL: $*"; sleep "${FATAL_SLEEP:-30}"; exit 1; }
bool() { case "${1,,}" in 1|true|yes|on) echo true ;; *) echo false ;; esac; }

# ------------------------------------------------------------------ config.ini
ini_set() { # section key raw_value
    local file="$DATA/config.ini" tmp
    tmp="$(mktemp)"
    awk -v sec="[$1]" -v key="$2" -v val="$3" '
        BEGIN { insec = 0; done = 0 }
        /^\[/ {
            if (insec && !done) { print key " = " val; done = 1 }
            insec = ($0 == sec); print; next
        }
        insec && $0 ~ ("^" key "[ \t]*=") { if (!done) { print key " = " val; done = 1 } next }
        { print }
        END { if (!done) { if (!insec) print sec; print key " = " val } }
    ' "$file" > "$tmp"
    cat "$tmp" > "$file" && rm -f "$tmp"
}
ini_str() { local v="${3//\"/}"; ini_set "$1" "$2" "\"$v\""; }

configure() {
    mkdir -p "$SAVE/autosave" "$SAVE/archive" "$DATA/plugin" "$LAN_STATE"
    touch "$DATA/config.ini" "$BAD_LIST"

    ini_set general autosave "${AUTOSAVE_FREQUENCY:-1}"   # 1 = every 5 minutes
    ini_set general autosave_amount "${AUTOSAVE_AMOUNT:-24}"
    ini_set general save_plugin_data true
    ini_str network player_name "${SERVER_PLAYER_NAME:-Server}"
    ini_str network server_name "${SERVER_NAME:-LAN Tycoon}"
    ini_str network server_description "${SERVER_DESCRIPTION:-}"
    ini_str network server_greeting "${SERVER_GREETING:-}"
    ini_set network maxplayers "${MAX_PLAYERS:-16}"
    ini_set network pause_server_if_no_clients "$(bool "${PAUSE_WHEN_EMPTY:-true}")"
    ini_set network advertise false                      # LAN only: never register on the master server
    ini_set network known_keys_only "$(bool "${KNOWN_KEYS_ONLY:-false}")"
    ini_set network log_chat true
    ini_set network log_server_actions true
    ini_set network desync_debugging false
    ini_set plugin enable_hot_reloading false
    # The plugin socket API only allows localhost or hosts in this list.
    ini_str plugin allowed_hosts "${STATS_HOST:-dashboard}"

    if [[ ! -f "$DATA/groups.json" ]]; then
        cp /opt/lan/defaults/groups.json "$DATA/groups.json"
        log "created groups.json (Admin / Spectator / Player, new players join as Player)"
    elif [[ "$(jq -r '.default_group' "$DATA/groups.json" 2>/dev/null)" == "1" ]]; then
        log "WARNING: groups.json default_group is 1 (Spectator): new players can only chat"
    fi
}

# ------------------------------------------------------------------ plugins
plugin_source() {
    case "$1" in
        lan-stats) echo /opt/lan/plugins/lan-stats/lan-stats.js ;;
        ffa-*) echo "/opt/lan/plugins/ffa/${1#ffa-}.js" ;;
        *) echo "" ;;
    esac
}

install_plugins() {
    local managed="$DATA/plugin/managed" name src
    # plugin/managed/ is owned by this script; other files in plugin/ are left alone.
    rm -rf "$managed"
    mkdir -p "$managed"
    IFS=',' read -ra names <<< "${ENABLED_PLUGINS:-ffa-ownership,ffa-individual-economy,ffa-anti-grief,ffa-rate-limit,ffa-disable-track-designs,ffa-cheat-toggle,lan-stats}"
    for name in "${names[@]}"; do
        name="$(echo "$name" | tr -d '[:space:]')"
        [[ -z "$name" ]] && continue
        src="$(plugin_source "$name")"
        if [[ -z "$src" || ! -f "$src" ]]; then
            log "WARNING: unknown plugin '$name' in ENABLED_PLUGINS, skipped"
            continue
        fi
        cp "$src" "$managed/$name.js"
        log "plugin enabled: $name"
    done
    local extra
    extra="$(find "$DATA/plugin" -name '*.js' -not -path "$managed/*" 2>/dev/null | wc -l)"
    [[ "$extra" -gt 0 ]] && log "plus $extra custom plugin file(s) in plugin/"
    return 0
}

# Merge our settings into plugin.store.json (context.sharedStorage), keeping all other keys.
write_plugin_store() {
    local store="$DATA/plugin.store.json" cfg tmp
    if [[ -f "$store" ]] && ! jq -e 'type == "object"' "$store" >/dev/null 2>&1; then
        mv "$store" "$store.unreadable-$(date +%Y%m%d-%H%M%S)"
        log "WARNING: plugin.store.json was not valid JSON; kept a copy and started a new one"
    fi
    [[ -f "$store" ]] || echo '{}' > "$store"
    cfg="$(jq -n \
        --arg host "${STATS_HOST:-dashboard}" \
        --argjson port "${STATS_PORT:-9000}" \
        --argjson interval "${STATS_INTERVAL_MS:-10000}" \
        --argjson control "$CONTROL_PORT" \
        --argjson safety "${SAFETY_SAVE_SECONDS:-60}" \
        --argjson vandalism "$(bool "${CHEAT_DISABLE_VANDALISM:-true}")" \
        --argjson plants "$(bool "${CHEAT_DISABLE_PLANT_AGING:-true}")" \
        --argjson breakdowns "$(bool "${CHEAT_DISABLE_BREAKDOWNS:-true}")" \
        --argjson value "$(bool "${CHEAT_DISABLE_RIDE_VALUE_AGING:-true}")" \
        --argjson unlock "$(bool "${CHEAT_UNLOCK_ALL_RIDES:-true}")" \
        --argjson litter "$(bool "${CHEAT_DISABLE_LITTERING:-true}")" \
        --argjson grass "$(bool "${CHEAT_MOW_GRASS:-true}")" \
        '{
          "lan-stats": {host: $host, port: $port, intervalMs: $interval, controlPort: $control, safetySaveSeconds: $safety},
          "cheat-toggle": {disableVandalism: $vandalism, disablePlantAging: $plants,
                           disableAllBreakdowns: $breakdowns, disableRideValueAging: $value,
                           unlockAllRides: $unlock, disableLittering: $litter, mowGrass: $grass}
        }')"
    tmp="$(mktemp)"
    jq --argjson cfg "$cfg" '. * $cfg' "$store" > "$tmp" && cat "$tmp" > "$store" && rm -f "$tmp"
}

# ------------------------------------------------------------------ park selection
file_id() { stat -c '%n|%s|%Y' "$1"; }
is_marked_bad() { grep -Fqx -- "$(file_id "$1")" "$BAD_LIST"; }
looks_valid() { [[ -s "$1" ]] && [[ "$(head -c 4 "$1")" == "PARK" ]]; }

list_saves() { # all .park saves, newest first
    find "$SAVE/autosave" "$SAVE" "$SAVE/archive" -maxdepth 1 -type f -name '*.park' -printf '%T@ %p\n' 2>/dev/null \
        | sort -rn | cut -d' ' -f2- | awk '!seen[$0]++'
}

initial_park() {
    local name="${INITIAL_PARK:-}" found=()
    if [[ -n "$name" ]]; then
        [[ -f "$PARK_DIR/$name" ]] || die "INITIAL_PARK=$name not found in the park directory"
        echo "$PARK_DIR/$name"; return
    fi
    mapfile -t found < <(find "$PARK_DIR" -maxdepth 1 -type f \( -iname '*.park' -o -iname '*.sv6' -o -iname '*.sc6' -o -iname '*.sv4' -o -iname '*.sc4' \) 2>/dev/null | sort)
    if [[ ${#found[@]} -eq 1 ]]; then echo "${found[0]}"; return; fi
    if [[ ${#found[@]} -gt 1 ]]; then die "several parks in park/; set INITIAL_PARK to choose one: ${found[*]##*/}"; fi
    die "no saves and no initial park. Put a .park/.sv6/.sc6 file in the park/ directory (see README)."
}

# ------------------------------------------------------------------ server process
start_server() { # file -> 0 when listening, 1 when it failed to load
    local file="$1" waited=0
    rm -f "$READY_FLAG"
    local args=(host "$file" --user-data-path "$DATA" --port 11753)
    [[ -n "${SERVER_PASSWORD:-}" ]] && args+=(--password "$SERVER_PASSWORD")
    log "loading $file"
    # Strip colour codes and detect the "listening" line that confirms a successful load.
    openrct2-cli "${args[@]}" > >(mawk -W interactive -v flag="$READY_FLAG" '
        { gsub(/\033\[[0-9;]*m/, ""); print; fflush() }
        !ready && /Listening for clients on/ { print "ok" > flag; close(flag); ready = 1 }
    ') 2>&1 &
    SERVER_PID=$!
    while (( waited < STARTUP_TIMEOUT )); do
        [[ -f "$READY_FLAG" ]] && { log "server is up (pid $SERVER_PID) with $(basename "$file")"; echo "$file" > "$LAN_STATE/loaded-park.txt"; return 0; }
        kill -0 "$SERVER_PID" 2>/dev/null || break
        sleep 1; waited=$((waited + 1))
    done
    log "could not load $(basename "$file") within ${STARTUP_TIMEOUT}s"
    kill -TERM "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
    return 1
}

request_save() {
    local reply=""
    # braces: "exec ... 2>/dev/null" would silence stderr (our log) for the rest of the script
    if { exec 3<>"/dev/tcp/127.0.0.1/$CONTROL_PORT"; } 2>/dev/null; then
        printf 'save\n' >&3
        read -r -t 20 reply <&3 || true
        exec 3>&- 3<&- || true
    fi
    log "shutdown save: ${reply:-no answer from lan-stats plugin}"
}

shutdown() {
    log "stop requested"
    [[ -n "$ARCHIVER_PID" ]] && kill "$ARCHIVER_PID" 2>/dev/null || true
    if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
        request_save
        kill -TERM "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
    exit 0
}

archiver() {
    trap 'exit 0' TERM INT   # do not inherit the main shutdown handler
    local interval=$((ARCHIVE_INTERVAL_MINUTES * 60)) newest last
    (( interval > 0 )) || return 0
    while sleep "$interval"; do
        newest="$(find "$SAVE/autosave" -maxdepth 1 -name 'autosave_*.park' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)"
        [[ -n "$newest" ]] && looks_valid "$newest" || continue
        last="$(find "$SAVE/archive" -maxdepth 1 -name 'archive_*.park' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)"
        if [[ -n "$last" ]] && cmp -s "$newest" "$last"; then continue; fi
        cp -p "$newest" "$SAVE/archive/archive_$(date +%Y-%m-%d_%H-%M-%S).park"
        # rotate our own archive copies (oldest first)
        find "$SAVE/archive" -maxdepth 1 -name 'archive_*.park' -printf '%T@ %p\n' | sort -rn | tail -n +$((ARCHIVE_KEEP + 1)) | cut -d' ' -f2- \
            | while read -r old; do rm -f -- "$old"; done
    done
}

main() {
    trap shutdown TERM INT
    log "OpenRCT2 $(openrct2-cli --version 2>/dev/null | head -1)"
    configure
    install_plugins
    write_plugin_store

    local saves=() f started=false
    mapfile -t saves < <(list_saves)
    if [[ ${#saves[@]} -gt 0 ]]; then
        for f in "${saves[@]}"; do
            if is_marked_bad "$f"; then log "skipping $(basename "$f") (failed to load before)"; continue; fi
            if ! looks_valid "$f"; then log "skipping $(basename "$f") (not a valid .park file)"; echo "$(file_id "$f")" >> "$BAD_LIST"; continue; fi
            if start_server "$f"; then started=true; break; fi
            echo "$(file_id "$f")" >> "$BAD_LIST"
        done
        # Saves exist but none loads: refuse to silently start over from the initial park.
        $started || die "none of the ${#saves[@]} saves could be loaded; see README 'Recovery'. Not falling back to the initial park."
    else
        log "no saves yet: starting a new game from the initial park"
        local initial
        initial="$(initial_park)" || exit 1
        start_server "$initial" || die "the initial park could not be loaded"
    fi

    archiver &
    ARCHIVER_PID=$!
    local code=0
    wait "$SERVER_PID" || code=$?
    log "server exited with code $code"
    kill "$ARCHIVER_PID" 2>/dev/null || true
    exit "$code"
}

main "$@"
