#!/usr/bin/env bash
# End-to-end test with REAL OpenRCT2 clients (Linux AppImage under Xvfb).
#
# Runs an isolated copy of the openrct2 + dashboard services from
# ../docker-compose-local.yml (project lan-openrct2-e2e, own volumes and network,
# ports bound to 127.0.0.1) and drives three players (Alice, Bob, Jeroen)
# through the multiplayer, ownership, admin, pause, reconnect and persistence
# scenarios. Real game data is never touched.
#
# Requirements (you need to own RollerCoaster Tycoon 2 for the client):
#   OPENRCT2_APPIMAGE=/path/OpenRCT2-v0.5.7-linux-x86_64.AppImage
#   RCT2_DATA=/path/rct2.zip            (or an extracted RCT2 directory)
#   E2E_PARK=/path/to/park.(park|sv6|sc6)   park to host
#   curl, unzip, sha1sum on the host (jq is optional: the server image's jq is used otherwise)
#
#   ./tests/e2e/run.sh            run everything, tear the test stack down after
#   KEEP=1 ./tests/e2e/run.sh     leave the test stack running for inspection
set -Euo pipefail
cd "$(dirname "$0")/../.."
ROOT="$PWD"
W="$ROOT/tests/e2e/.work"
CLIENT_IMAGE=lan-openrct2-e2e-client

export COMPOSE_PROJECT_NAME=lan-openrct2-e2e NAME_PREFIX=openrct2-e2e VOLUME_PREFIX=lan-openrct2-e2e NETWORK_NAME=lan-openrct2-e2e-web
export OPENRCT2_BIND=127.0.0.1 OPENRCT2_PORT=21753 DASHBOARD_BIND=127.0.0.1 DASHBOARD_PORT=28080
export STATS_INTERVAL_MS=3000 HISTORY_SAMPLE_SECONDS=10 PARK_PATH="$W/park" SAFETY_SAVE_SECONDS=60
API="http://127.0.0.1:$DASHBOARD_PORT"
NET=lan-openrct2-e2e
SERVICES=(openrct2 dashboard)
dc() { docker compose -f "$ROOT/../docker-compose-local.yml" "$@"; }

PASS=0; FAIL=0; RESULTS=()
log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
check() { # name, then a command that must succeed
    local name="$1"; shift
    if "$@" >/dev/null 2>&1; then PASS=$((PASS + 1)); RESULTS+=("PASS  $name"); printf '  \033[32mPASS\033[0m %s\n' "$name"
    else FAIL=$((FAIL + 1)); RESULTS+=("FAIL  $name"); printf '  \033[31mFAIL\033[0m %s\n' "$name"; fi
}
die() { echo "error: $*" >&2; exit 2; }
state() { curl -fsS "$API/api/state"; }
jq_state() { state | jq -e "$1"; }
wait_until() { # timeout_s jq-expression-on-state
    local end=$((SECONDS + $1))
    while (( SECONDS < end )); do jq_state "$2" >/dev/null 2>&1 && return 0; sleep 1; done
    return 1
}

# ------------------------------------------------------------------ preparation
prepare() {
    command -v curl >/dev/null && command -v unzip >/dev/null && command -v sha1sum >/dev/null || die "curl, unzip and sha1sum are required"
    log "building the stack images"
    dc build -q "${SERVICES[@]}" >/dev/null || die "docker compose build failed"
    if ! command -v jq >/dev/null; then
        # no jq on the host: use the one inside the server image via a helper container
        docker rm -f e2e-jq >/dev/null 2>&1 || true
        docker run -d --name e2e-jq --entrypoint sleep "lan-openrct2-server:${OPENRCT2_VERSION:-0.5.7}" infinity >/dev/null
        jq() { docker exec -i e2e-jq jq "$@"; }
        export -f jq
    fi
    mkdir -p "$W/park" "$W/clients"
    if [[ ! -x "$W/app/AppRun" ]]; then
        [[ -f "${OPENRCT2_APPIMAGE:-}" ]] || die "set OPENRCT2_APPIMAGE to the OpenRCT2 Linux AppImage"
        log "extracting AppImage"
        (cd "$W" && rm -rf squashfs-root && "$OPENRCT2_APPIMAGE" --appimage-extract >/dev/null && mv squashfs-root app)
    fi
    if [[ ! -d "$W/rct2/Data" ]]; then
        [[ -e "${RCT2_DATA:-}" ]] || die "set RCT2_DATA to rct2.zip or an RCT2 directory"
        log "preparing RCT2 data"
        rm -rf "$W/rct2" "$W/rct2-tmp" && mkdir -p "$W/rct2-tmp"
        if [[ -d "$RCT2_DATA" ]]; then cp -a "$RCT2_DATA/." "$W/rct2-tmp/"; else unzip -q "$RCT2_DATA" -d "$W/rct2-tmp"; fi
        local data; data="$(find "$W/rct2-tmp" -maxdepth 3 -type d -name Data | head -1)"
        [[ -n "$data" ]] || die "no Data directory found in $RCT2_DATA"
        mv "$(dirname "$data")" "$W/rct2" && rm -rf "$W/rct2-tmp"
    fi
    if ! ls "$W/park/"* >/dev/null 2>&1; then
        [[ -f "${E2E_PARK:-}" ]] || die "set E2E_PARK to a park file to host"
        cp "$E2E_PARK" "$W/park/"
    fi
    rm -rf "$W/clients"/*
    log "building the test client image"
    docker build -q -t "$CLIENT_IMAGE" -f tests/e2e/client.Dockerfile tests/e2e >/dev/null
}

# ------------------------------------------------------------------ clients
client_dir() { echo "$W/clients/$1"; }
start_client() { # name, steps-json
    local name="$1" steps="$2" dir; dir="$(client_dir "$1")"
    mkdir -p "$dir/plugin"
    if [[ ! -f "$dir/config.ini" ]]; then
        cat > "$dir/config.ini" <<EOF
[general]
game_path = "/rct2"
play_intro = false
language = en-GB
last_run_version = "0.5.7"
[network]
player_name = "$name"
[sound]
master_sound = false
sound_enabled = false
EOF
    fi
    cp tests/e2e/bot.js "$dir/plugin/e2e-bot.js"
    jq -n --argjson steps "$steps" '{e2e: {steps: $steps}}' > "$dir/plugin.store.json"
    docker rm -f "e2e-client-${name,,}" >/dev/null 2>&1 || true
    docker run -d --name "e2e-client-${name,,}" --network "$NET" --user "$(id -u):$(id -g)" \
        -v "$W/app:/app:ro" -v "$W/rct2:/rct2:ro" -v "$dir:/u" \
        "$CLIENT_IMAGE" join openrct2 --port 11753 --user-data-path /u --rct2-data-path /rct2 >/dev/null
}
events() { docker logs "e2e-client-${1,,}" 2>&1 | grep -o 'E2E {.*}' | sed 's/^E2E //'; }
wait_event() { # name jq-filter timeout
    local end=$((SECONDS + ${3:-120}))
    while (( SECONDS < end )); do
        events "$1" | jq -se "map(select($2)) | length > 0" >/dev/null 2>&1 && return 0
        docker ps -q --filter "name=e2e-client-${1,,}" | grep -q . || return 1
        sleep 1
    done
    return 1
}
step() { events "$1" | jq -s -c --arg l "$2" 'map(select(.event == "step" and .label == $l)) | last'; }
await_step() { local end=$((SECONDS + ${3:-60})); while (( SECONDS < end )); do [[ "$(step "$1" "$2")" != null ]] && return 0; sleep 2; done; return 1; }
step_ok() { await_step "$1" "$2" && [[ "$(step "$1" "$2" | jq -r '.ok')" == true ]]; }
step_denied() { [[ "$(step "$1" "$2" | jq -r '.ok')" == false && "$(step "$1" "$2" | jq -r '.error')" != 0 ]]; }
# denied by ffa-ownership specifically (not by e.g. the rate limiter)
# OpenRCT2 gives the client no callback when the *server* refuses an action, so the
# bot's step ends with "timeout"; the server's verdict comes from the lan-stats log line.
step_not_owned() { # name label action
    await_step "$1" "$2" && [[ "$(step "$1" "$2" | jq -r '.ok')" == false ]] &&
    docker logs openrct2-e2e-server 2>&1 | grep -q "\[lan-stats\] denied $3 from $1: NOT OWNED"; }
stop_client() { # keep the client log for debugging: .work/logs/<name>-<n>.log
    mkdir -p "$W/logs"; local n=1; while [[ -e "$W/logs/${1,,}-$n.log" ]]; do n=$((n + 1)); done
    docker logs "e2e-client-${1,,}" > "$W/logs/${1,,}-$n.log" 2>&1 || true
    docker rm -f "e2e-client-${1,,}" >/dev/null 2>&1 || true; }
player() { state | jq -c --arg n "$1" '.players[] | select(.name == $n)'; }
admin() { ./scripts/admin.sh "$@"; }

cleanup() {
    for c in alice bob jeroen; do stop_client "$c"; done
    docker rm -f e2e-jq >/dev/null 2>&1 || true
    if [[ -z "${KEEP:-}" ]]; then dc down -v >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

# ================================================================== tests
prepare

log "Infrastructure"
check "docker-compose-local.yml is valid" dc config -q
dc down -v >/dev/null 2>&1 || true
dc up -d --build "${SERVICES[@]}" >/dev/null 2>&1 || die "docker compose up failed"
wait_healthy() { local end=$((SECONDS + 180)); while (( SECONDS < end )); do
    [[ "$(docker inspect -f '{{.State.Health.Status}}' openrct2-e2e-server 2>/dev/null)" == healthy && "$(docker inspect -f '{{.State.Health.Status}}' openrct2-e2e-dashboard 2>/dev/null)" == healthy ]] && return 0; sleep 2; done; return 1; }
check "both containers start and become healthy" wait_healthy
check "game server listens on TCP $OPENRCT2_PORT" bash -c "exec 3<>/dev/tcp/127.0.0.1/$OPENRCT2_PORT"
check "dashboard responds on port $DASHBOARD_PORT" curl -fsS "$API/"
check "dashboard API reports the server online" wait_until 30 '.overview.serverStatus == "online"'
check "telemetry: FFA ownership and economy plugins detected" jq_state '.overview.ffa.ownership and .overview.ffa.economy'
check "empty server is paused" wait_until 20 '.overview.simState == "paused" and .overview.onlineCount == 0'

log "Player 1 joins and builds"
start_client Alice '[{"op":"create","label":"create"},{"op":"rename","label":"rename-own","target":{"created":"create"},"name":"Alice Coaster"},{"op":"info","label":"info"},{"op":"wait","ms":90000}]'
check "Alice joins and creates an attraction" wait_event Alice '.label == "create" and .ok' 150
check "Alice can rename her own attraction" wait_event Alice '.label == "rename-own" and .ok' 30
check "dashboard shows Alice online" wait_until 20 '.players[] | select(.name == "Alice") | .online'
check "simulation runs while a player is online" wait_until 20 '.overview.simState == "running"'
check "dashboard shows the attraction owned by Alice" wait_until 20 '.rides[] | select(.name == "Alice Coaster") | .owner.name == "Alice"'
check "Alice has an individual balance from ffa-individual-economy" wait_until 10 '.players[] | select(.name == "Alice") | .money != null'

log "Player 2 joins while player 1 is online"
start_client Bob '[{"op":"rename","label":"rename-other","target":{"nameStartsWith":"Alice"},"name":"Hacked"},{"op":"demolish","label":"demolish-other","target":{"nameStartsWith":"Alice"}},{"op":"setting","label":"setting-other","target":{"nameStartsWith":"Alice"},"setting":2,"value":5},{"op":"create","label":"create"},{"op":"info","label":"info"},{"op":"wait","ms":10000}]'
check "Bob joins and creates his own attraction" wait_event Bob '.label == "create" and .ok' 150
check "two players online at the same time" wait_until 20 '.overview.onlineCount == 2'
check "Bob cannot rename Alice's attraction" step_not_owned Bob rename-other ridesetname
check "Bob cannot demolish Alice's attraction" step_not_owned Bob demolish-other ridedemolish
check "Bob cannot change settings of Alice's attraction" step_not_owned Bob setting-other ridesetsetting
check "Alice's attraction still exists, unchanged" jq_state '[.rides[] | select(.name == "Alice Coaster")] | length == 1'
check "Bob is a regular player (group Player, not admin)" jq_state '.players[] | select(.name == "Bob") | (.isAdmin | not) and .group == "Player"'
alice_money="$(player Alice | jq '.money')"
alice_ride_uid="$(state | jq -r '.rides[] | select(.name == "Alice Coaster") | .uid')"

log "Everybody leaves: the game pauses"
stop_client Alice; stop_client Bob
check "disconnected players stay visible as offline" wait_until 30 '([.players[] | select(.name == "Alice" or .name == "Bob")] | length == 2) and ([.players[] | select(.online)] | length == 0)'
check "server pauses when nobody is connected" wait_until 30 '.overview.simState == "paused"'
d1="$(state | jq -r '.overview.gameDate')"; sleep 12; d2="$(state | jq -r '.overview.gameDate')"
check "in-game date frozen while paused ($d1)" test "$d1" == "$d2"
check "telemetry stays live while paused (not shown as stale)" jq_state '.overview.telemetry.live and .overview.serverStatus == "online"'

log "Player 1 reconnects"
start_client Alice '[{"op":"info","label":"info"},{"op":"rename","label":"rename-own-again","target":{"nameStartsWith":"Alice"},"name":"Alice Wild Coaster"},{"op":"wait","ms":8000}]'
check "Alice reconnects" wait_event Alice '.label == "info" and .ok' 150
check "game resumes when a player reconnects" wait_until 20 '.overview.simState == "running"'
check "Alice still owns her attraction after reconnecting" step_ok Alice rename-own-again
check "Alice's balance survived the reconnect ($alice_money)" jq_state ".players[] | select(.name == \"Alice\") | .money == $alice_money"
check "reconnect did not create a duplicate identity" jq_state '[.players[] | select(.name == "Alice")] | length == 1'
stop_client Alice

log "Administrator bootstrap"
start_client Jeroen '[{"op":"info","label":"info"},{"op":"rename","label":"rename-before-admin","target":{"nameStartsWith":"Bob"},"name":"Not yet"},{"op":"wait","ms":3000}]'
check "Jeroen joins as a normal player first" wait_event Jeroen '.label == "info" and .group == 2' 150
wait_event Jeroen '.label == "rename-before-admin"' 30 >/dev/null
check "before registration Jeroen cannot modify Bob's attraction" step_not_owned Jeroen rename-before-admin ridesetname
stop_client Jeroen
keyfile="$(ls "$(client_dir Jeroen)"/keys/Jeroen-*.pubkey)"
key_hash="$(basename "$keyfile" .pubkey)"; key_hash="${key_hash#Jeroen-}"
check "public key hash = SHA-1 of the client's public key file" test "$(sha1sum < "$keyfile" | cut -d' ' -f1)" == "$key_hash"
check "admin.sh players lists Jeroen with that hash" bash -c "./scripts/admin.sh players | grep -q '$key_hash'"
check "admin.sh grant Jeroen succeeds" admin grant Jeroen
check "users.json maps the key hash to the Admin group" bash -c "dc exec -T openrct2 jq -e '.[] | select(.hash == \"$key_hash\" and .groupId == 0)' /data/users.json"
check "admin.sh refuses an unknown name" bash -c '! ./scripts/admin.sh grant Nobody'

start_client Jeroen '[{"op":"info","label":"info"},{"op":"rename","label":"admin-rename","target":{"nameStartsWith":"Bob"},"name":"Renamed by admin"},{"op":"demolish","label":"admin-demolish","target":{"nameStartsWith":"Renamed by admin"}},{"op":"wait","ms":5000}]'
check "after reconnecting Jeroen is in the Admin group" wait_event Jeroen '.label == "info" and .group == 0' 150
wait_event Jeroen '.label == "admin-demolish"' 30 >/dev/null
check "admin can modify another player's attraction" step_ok Jeroen admin-rename
check "admin can demolish another player's attraction" step_ok Jeroen admin-demolish
check "dashboard marks Jeroen as admin" wait_until 20 '.players[] | select(.name == "Jeroen") | .isAdmin'
check "dashboard: Bob now owns 0 attractions (leaderboard updated)" wait_until 20 '.players[] | select(.name == "Bob") | .attractions == 0 and .demolished == 1'
check "demolished attraction kept with owner in history" bash -c "curl -fsS '$API/api/rides?include=demolished' | jq -e '.[] | select(.status == \"demolished\" and .owner.name == \"Bob\")'"
stop_client Jeroen
start_client Jeroen '[{"op":"info","label":"info"},{"op":"wait","ms":2000}]'
check "admin permissions survive reconnecting" wait_event Jeroen '.label == "info" and .group == 0' 150
stop_client Jeroen

log "Persistence across container recreation"
start_client Alice '[{"op":"info","label":"info"},{"op":"wait","ms":120000}]'
wait_event Alice '.label == "info"' 150 >/dev/null
sleep 5
samples_before="$(curl -fsS "$API/api/history?hours=1" | jq '[.series[] | length] | add // 0')"
dc stop openrct2 >/dev/null 2>&1   # the old container's log is gone after recreating it
check "shutdown save was written while a player was online" bash -c "docker logs openrct2-e2e-server 2>&1 | grep -q 'shutdown save: saved lan-latest.park'"
dc up -d --force-recreate "${SERVICES[@]}" >/dev/null 2>&1
check "after re-creating, the server resumes from the shutdown save" bash -c "sleep 20; docker logs openrct2-e2e-server 2>&1 | grep -q 'server is up .* with lan-latest.park'"
check "server came back healthy after recreation" wait_healthy
check "server resumed from the shutdown save, not the initial park" bash -c "dc logs openrct2 2>&1 | grep -q 'server is up .* lan-latest.park'"
stop_client Alice
check "dashboard reconnects to the restarted server" wait_until 60 '.overview.serverStatus == "online"'
check "attraction and owner survived the restart" wait_until 30 ".rides[] | select(.uid == \"$alice_ride_uid\") | .owner.name == \"Alice\""
check "Alice's balance survived the restart" jq_state ".players[] | select(.name == \"Alice\") | .money == $alice_money"
check "dashboard history survived the restart ($samples_before samples)" bash -c "test \"\$(curl -fsS '$API/api/history?hours=1' | jq '[.series[] | length] | add // 0')\" -ge $samples_before -a $samples_before -gt 0"
start_client Jeroen '[{"op":"info","label":"info"},{"op":"wait","ms":2000}]'
check "admin permissions survive a server restart" wait_event Jeroen '.label == "info" and .group == 0' 150
stop_client Jeroen

log "Backup and restore"
mkdir -p backups
ls backups > "$W/backups-before.txt"
new_backups() { ls backups | comm -13 "$W/backups-before.txt" - | sed 's|^|backups/|'; }
check "backup.sh creates an archive with saves, users.json and the database" bash -c '
  ./scripts/backup.sh >/dev/null && f=$(ls -t backups/lan-openrct2-*.tar.gz | head -1) &&
  tar -tzf "$f" | grep -q "data/users.json" && tar -tzf "$f" | grep -q "data/save/lan-latest.park" &&
  tar -tzf "$f" | grep -q "dashboard/backup-snapshot.sqlite"'
backup_file="$(new_backups | head -1)"
state | jq -r '.rides[] | select(.status != "demolished") | .uid' | sort > "$W/rides-before.txt"
check "restore.sh restores a backup" bash -c "echo restore | ./scripts/restore.sh '$backup_file' >/dev/null 2>&1"
check "restore.sh kept a safety backup of the replaced data" test "$(new_backups | wc -l)" -ge 2
check "server and dashboard healthy after restore" wait_healthy
check "after restore the attractions and the admin are back" bash -c "
  sleep 10; diff <(curl -fsS '$API/api/state' | jq -r '.rides[] | select(.status != \"demolished\") | .uid' | sort) '$W/rides-before.txt' >/dev/null &&
  dc exec -T openrct2 cat /data/users.json | jq -e '.[] | select(.name == \"Jeroen\") | .groupId == 0' >/dev/null"
new_backups | while read -r f; do rm -f -- "$f"; done   # only the archives this test made
rmdir backups 2>/dev/null || true

echo
printf '%s\n' "${RESULTS[@]}"
echo "passed: $PASS  failed: $FAIL"
(( FAIL == 0 ))
