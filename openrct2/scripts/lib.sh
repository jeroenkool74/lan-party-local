# Shared helpers for the scripts in this directory (sourced, not executed).
#
# The scripts talk to Docker directly by container, image and volume name (all fixed
# in the root docker-compose.yml / docker-compose-local.yml) instead of through `docker compose`. That way they work no matter
# how the stack was started (either compose file, any project name).

# NAME_PREFIX / VOLUME_PREFIX may be set in the environment or in the root .env.
_env_value() { if [[ -f ../.env ]]; then sed -n "s/^$1=//p" ../.env | tail -1; fi; return 0; }
NAME_PREFIX="${NAME_PREFIX:-$(_env_value NAME_PREFIX)}"
VOLUME_PREFIX="${VOLUME_PREFIX:-$(_env_value VOLUME_PREFIX)}"
TZ="${TZ:-$(_env_value TZ)}"

SERVER="${NAME_PREFIX:-openrct2}-server"
DASHBOARD="${NAME_PREFIX:-openrct2}-dashboard"
DATA_VOLUME="${VOLUME_PREFIX:-lan-openrct2}-data"
DASHBOARD_VOLUME="${VOLUME_PREFIX:-lan-openrct2}-dashboard-data"

server_exec() { docker exec "$SERVER" "$@"; }
dashboard_exec() { docker exec "$DASHBOARD" "$@"; }

# The image of the existing server container (falls back to the default tag).
server_image() {
    docker inspect -f '{{.Config.Image}}' "$SERVER" 2>/dev/null || echo "lan-openrct2-server:${OPENRCT2_VERSION:-0.5.7}"
}

# Throw-away container from the server image (runs as the game server user unless
# --user is given), without network or capabilities. Usage: tool_run [docker run options] -- command...
tool_run() {
    local opts=()
    while [[ $# -gt 0 && "$1" != "--" ]]; do opts+=("$1"); shift; done
    shift
    docker run --rm -i -e TZ="${TZ:-Europe/Amsterdam}" --network none --cap-drop ALL --security-opt no-new-privileges "${opts[@]}" \
        --entrypoint "$1" "$(server_image)" "${@:2}"
}

stop_stack() { docker stop "$DASHBOARD" "$SERVER" >/dev/null; echo "stopped $SERVER and $DASHBOARD"; }
start_stack() { docker start "$SERVER" "$DASHBOARD" >/dev/null; echo "started $SERVER and $DASHBOARD"; }
