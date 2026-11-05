# OpenRCT2 free-for-all LAN server + live dashboard

A self-contained OpenRCT2 multiplayer server for a LAN party (about 10 players), with
the FFA plugin suite (every player owns their own rides and money) and a read-only
live web dashboard with leaderboards and history.

```bash
cp .env.example .env              # optional - every value has a default
cp ~/my-park.park park/           # the park a NEW game starts from (see "Initial park")
docker compose up -d --build
```

The root `docker-compose.yml` of this repository includes this stack, so from the
repository root `docker compose up -d --build` starts it together with traefik and the
website (or only this stack: `docker compose up -d --build openrct2 dashboard`). Settings
still come from `openrct2/.env`. Start it either from the root or from this directory, not
both (the container names are the same; the data volumes are shared).

The scripts in `scripts/` use the fixed container, image and volume names from
`compose.yaml` (plain `docker exec` / `docker run`, no `docker compose`), so they work
however the stack was started, and including this stack in another compose file needs
nothing more than an `include:` entry. They never touch other containers.

* Game: connect to `SERVER-IP:11753` in OpenRCT2 (**Multiplayer → Connect to Server**,
  the IP of this machine). Clients must run **OpenRCT2 0.5.7**.
* Dashboard: `http://SERVER-IP:8080`

Everything works offline once the images are built (building needs internet once:
Docker Hub images and npm packages for the dashboard).

## Contents

```
compose.yaml              the whole stack (openrct2 + dashboard)
.env.example              all settings, with defaults and explanations
park/                     put your initial .park / .sv6 / .sc6 file here (read-only mount)
server/                   game-server image: official openrct2/openrct2-cli:0.5.7 + wrapper
  bin/entrypoint.sh       config, plugin install, save selection, archive, clean shutdown
  bin/users.sh            edit users.json (used by scripts/admin.sh)
  bin/control.sh          ask the running server to save
  defaults/groups.json    permission groups (Admin / Spectator / Player)
plugins/
  ffa-suite/              vendored CorySanin/openrct2-ffa-plugin-suite + small patches (README inside)
  lan-stats/lan-stats.js  our read-only statistics exporter plugin
dashboard/                Node 24 + SQLite service, Vite/TypeScript frontend, unit tests
scripts/                  admin.sh, backup.sh, restore.sh, save-now.sh, new-park.sh
tests/e2e/run.sh          end-to-end test with real OpenRCT2 clients
```

## Architecture

```
 players (OpenRCT2 0.5.7) ──TCP 11753──► openrct2  (headless server, plugins, saves in volume)
                                            │ lan-stats plugin: JSON snapshot every 10 s
                                            ▼ TCP 9000 (internal Docker network only)
 browsers ─────────────────HTTP 8080──► dashboard (Node: ingest → SQLite → REST + SSE → web UI)
```

* **Why the plugin connects to the dashboard (and not the other way around):** OpenRCT2
  plugin sockets may only *listen* on localhost, and may only *connect* to localhost or
  to hosts listed in `[plugin] allowed_hosts`. The entrypoint adds `dashboard` to
  `allowed_hosts`, so the plugin opens one outgoing connection to `dashboard:9000`.
  Port 9000 is not published on the host.
* The plugin **only reads** game state (no game actions, no park storage writes), runs
  only on the server and never on clients, so it cannot cause desyncs. It reuses the
  FFA data: ride owners from `ffa-ownership` (`rideOwners`), balances computed the same
  way `ffa-individual-economy` computes them (`playerProfiles`). Players are identified
  by their **public-key hash**, never by name or slot, so renames and reconnects keep
  their statistics.
* The dashboard has no write endpoints at all (GET/HEAD only), shows no admin commands
  and does not show key hashes (public player ids are the first 16 hex characters).
* The same plugin also opens a **localhost-only** control port (127.0.0.1:11780, inside
  the container) that the wrapper uses to save the game on shutdown. It accepts only
  `save` and `ping`.

## Game server behaviour

| Topic | How |
|---|---|
| Version | `openrct2/openrct2-cli:0.5.7` (pinned, `OPENRCT2_VERSION`) |
| Players | `MAX_PLAYERS=16`, port 11753/TCP |
| Not on the internet | `advertise = false` (no master-server listing), nothing else talks outward |
| Restart | `restart: unless-stopped`, health check on port 11753 |
| Data | Docker volume `lan-openrct2-data` (config, saves, users, groups, keys, plugin store) |
| Autosave | every 5 minutes (`AUTOSAVE_FREQUENCY=1`), keeps 24 (`AUTOSAVE_AMOUNT`) = 2 hours |
| Archive | every 60 min the newest autosave is copied to `save/archive/` (keeps 48) |
| Shutdown | `docker compose stop/down/restart` saves `save/lan-latest.park` first |
| Safety save | while exactly 1 player is online the server saves every 60 s (`SAFETY_SAVE_SECONDS`) |
| Pause | `pause_server_if_no_clients = true` - the date stands still when nobody is online |
| Logs | `docker compose logs`: start-up decisions, joins/leaves, saves, and refused player actions (`[lan-stats] denied ridesetname from Bob: NOT OWNED`). In the data volume: chat (`chatlogs/`, `log_chat`) and all executed actions (`serverlogs/`, `log_server_actions`) |

### Which park is loaded on start

The wrapper (`server/bin/entrypoint.sh`) decides and logs it:

1. The **newest save** (by time) from `save/autosave/`, `save/` (`lan-latest.park`) and
   `save/archive/`. If that file does not load (the wrapper checks the server really
   starts listening), it is remembered in `.lan/unloadable-saves.txt` and the next
   newest is tried. Files are never deleted or moved.
2. Only if **no save exists at all**: the initial park from `./park` (`INITIAL_PARK`, or
   the only file in that directory).
3. If saves exist but none loads, the server **refuses to start** instead of silently
   starting the initial park again (which would throw away the game). See "Recovery".

### Initial park

Put a `.park`, `.sv6`, `.sc6` or `.sea` file in `park/`. With more than one file, set
`INITIAL_PARK=<file name>` in `.env`. It is only used for a brand-new game; to start
over with a different park while saves exist, use `./scripts/new-park.sh` (it moves the
old saves to `save/retired-<time>/`, nothing is deleted). The headless server does not
need the original RCT2 files, but players do.

## Becoming administrator

Admin rights are bound to your OpenRCT2 **key**, not your name. Nothing is invented: the
hash is taken from what your client actually used.

1. Start the stack and join once as `Jeroen` from your own computer (the dashboard now
   knows the key of "Jeroen").
2. On the server: `./scripts/admin.sh grant Jeroen`
3. Disconnect and reconnect. You are now in the **Admin** group (stored in
   `users.json` in the data volume, so it survives restarts and updates).

Without joining first you can use the hash directly. Your client stores its key as
`<OpenRCT2 user dir>/keys/Jeroen-<hash>.pubkey` (Linux `~/.config/OpenRCT2/keys/`,
Windows `Documents\OpenRCT2\keys\`); the 40 hex characters in the file name are the
hash (equal to `sha1sum` of that file):

```bash
./scripts/admin.sh grant 0123456789abcdef0123456789abcdef01234567 Jeroen
```

Other commands: `./scripts/admin.sh players` (all seen players with hashes),
`./scripts/admin.sh list` (users.json), `./scripts/admin.sh revoke <name|hash>`.
In the game, admins can also promote players via **Multiplayer → Players**.

**What the groups can do** (`groups.json`, created once, you can edit it in-game):

* **Admin**: all permissions - kick/ban, manage groups and passwords, cheats, park
  settings, and *every* ride (ffa-ownership treats everyone with the `kick_player`
  permission as admin).
* **Player** (default for new players): build rides, paths, scenery, terraform, staff,
  guests - but only edit/demolish **their own** rides; own money.
* **Spectator**: chat only. Move a troublemaker there instead of banning.

Set `KNOWN_KEYS_ONLY=true` once everybody has joined to lock out unknown keys
(admins promoted via users.json are known; others become known when an admin assigns
them a group).

## Plugins

`ENABLED_PLUGINS` (comma separated) decides which plugins are installed into
`plugin/managed/` on every start:

| Plugin | Purpose |
|---|---|
| `ffa-ownership` | rides are named after and owned by their builder; others can't edit them; chat `!owner` |
| `ffa-individual-economy` | every player has their own money (stored in the park); building costs your money, your rides' profit is yours |
| `ffa-anti-grief` | blocks griefing actions (e.g. removing others' paths in bulk, guest/staff abuse) |
| `ffa-rate-limit` | limits action spam per player |
| `ffa-disable-track-designs` | **still needed in 0.5.7**: track designs bypass ownership and economy |
| `ffa-cheat-toggle` | low-maintenance cheats, configurable below |
| `ffa-ip-ban` | available, off by default |
| `lan-stats` | statistics for the dashboard (read-only) |

Upstream source, version, license and our three small bug-fix patches are documented in
[`plugins/ffa-suite/README.md`](plugins/ffa-suite/README.md).

**Cheats** (`.env`, applied when the park loads, all `true` by default):
`CHEAT_DISABLE_BREAKDOWNS`, `CHEAT_DISABLE_VANDALISM`, `CHEAT_DISABLE_RIDE_VALUE_AGING`,
`CHEAT_DISABLE_PLANT_AGING`, `CHEAT_DISABLE_LITTERING`, `CHEAT_MOW_GRASS`,
`CHEAT_UNLOCK_ALL_RIDES`. Setting one to `false` stops the plugin from enabling it; a
cheat that is already on in a save stays on until an admin switches it off in the
Cheats window.

**Rides are kept forever.** Nothing removes rides automatically - not even rides of
players that never return. The dashboard keeps demolished rides in its history.

**Your own plugin:** put a `.js` file in the data volume under `plugin/` (e.g.
`docker compose cp my.js openrct2:/data/plugin/`) and restart. `plugin/managed/` is
reserved and rewritten on each start. Plugin settings live in `plugin.store.json`; the
entrypoint only updates its own keys (`lan-stats`, `cheat-toggle`) and never drops others.

## Dashboard

`http://SERVER-IP:8080` - updates live (Server-Sent Events, falls back to polling).

* **Overview**: server status, park date, players online / known, attractions, guests,
  simulation state (running / paused / no telemetry), last update.
* **Leaderboard** (animated, sortable by money, profit, attractions, guests): status,
  money, attractions, total profit, guests entertained, best attraction, last seen.
* **History**: per-player money / profit / guests / attractions over time (SQLite).
* **Attractions**: every ride with owner, status, ratings, customers, profit; sortable,
  filterable, optionally including demolished ones.
* **Player page**: stats, rides, demolished rides and personal history.

Status is never guessed:

| Shown | Meaning |
|---|---|
| online / running | snapshots arrive and the game date advances |
| paused | snapshots arrive, but the server paused itself (nobody online) or the game is paused |
| telemetry unavailable | the game port answers, but the plugin sends nothing (plugin disabled/broken) |
| offline | the game server does not answer |

**Metric definitions** - all straight from the game, nothing estimated:

* *Money*: the player's balance as ffa-individual-economy computes it (start money −
  spent + profit of their current rides). Empty when the park has "no money".
* *Total profit*: sum of the game's `totalProfit` over all rides the player built,
  including demolished rides at their last known value.
* *Guests entertained*: sum of the game's `totalCustomers` over the same rides.
* *Best attraction*: the player's ride with the highest excitement rating.
* History samples are taken every 60 s only while the simulation runs.

OpenRCT2 stores money in tenths (internal 100000 = 10,000.0); the dashboard shows it like
the game, with `CURRENCY_SYMBOL`.

## Operating

```bash
docker compose ps                         # status + health
docker compose logs -f openrct2           # game server log (joins, chat, actions, saves)
docker compose logs -f dashboard
./scripts/save-now.sh                     # save immediately (save/lan-latest.park)
docker compose restart openrct2           # saves first, then restarts
docker compose down                       # stop; data stays in the volumes
```

Ports and bind addresses: `OPENRCT2_BIND`, `OPENRCT2_PORT`, `DASHBOARD_BIND`,
`DASHBOARD_PORT` in `.env` (e.g. bind to the LAN IP only). Only use this on a trusted
LAN; do not forward these ports to the internet.

### Backup and restore

```bash
./scripts/backup.sh                       # → backups/lan-openrct2-YYYYmmdd-HHMMSS.tar.gz
./scripts/restore.sh backups/lan-openrct2-....tar.gz
```

The backup saves the game first, then archives the whole game data volume (saves,
users.json, groups.json, config, plugin store) and a consistent copy of the dashboard
database. It works while the server runs. Restore asks for confirmation and makes a
fresh backup of the current state first, so nothing is lost. Copy `backups/` somewhere
else for real safety.

### Recovery

* **A save is corrupt**: the server skips it automatically and loads the next newest
  one; see the log and `.lan/unloadable-saves.txt`.
* **Go back to an older save**: the newest file wins, so stop the server (this saves the
  current state as `lan-latest.park`, which stays available) and copy the wanted save to a
  new, newer file:

  ```bash
  docker compose stop openrct2
  docker compose run --rm --no-deps --entrypoint ls openrct2 -lt /data/save/archive /data/save/autosave
  docker compose run --rm --no-deps --entrypoint cp openrct2 \
      /data/save/archive/archive_YYYYmmdd-HHMMSS.park /data/save/restored.park
  docker compose up -d
  ```
* **No save loads**: the server stops with an explanation. Restore a backup, or move the
  bad saves away, or remove the entry from `.lan/unloadable-saves.txt` if it was a
  temporary problem.
* **Admin lost**: `./scripts/admin.sh grant <name|hash>` again.

### Updating

* **OpenRCT2**: set `OPENRCT2_VERSION` to a new tag of `openrct2/openrct2-cli`, then
  `docker compose up -d --build`. **All players need the same version.** Make a backup
  first; saves are forward compatible, not backward. Run the E2E test with a client of
  the new version.
* **FFA plugins**: see `plugins/ffa-suite/README.md`.
* **Dashboard / this repository**: `docker compose up -d --build`. The database schema is
  created/updated automatically and data is kept.

## Testing

```bash
cd dashboard && npm ci && npm test        # unit tests (plugin, tracker, HTTP API); also run in the image build
```

End-to-end test with **real OpenRCT2 0.5.7 clients** (headless under Xvfb in Docker) and
an isolated copy of the stack on ports 21753/28080 (your real data is not touched):

```bash
OPENRCT2_APPIMAGE=/path/OpenRCT2-v0.5.7-linux-x86_64.AppImage \
RCT2_DATA=/path/rct2.zip  ./tests/e2e/run.sh        # KEEP=1 leaves the test stack running
```

It checks: compose/health/ports/security settings, players joining and building,
ownership enforcement between two players, per-player money, pause when empty,
reconnect with the same key, admin bootstrap and admin editing other players' rides,
persistence across a container re-create (save on shutdown, balances, rides, dashboard
history, admin), backup and restore. The test bots build real (1-tile stall) attractions
through the normal game actions. Refusals are checked on the server's verdict
(`[lan-stats] denied ... NOT OWNED` in the log), because OpenRCT2 gives a client no
callback when the server refuses its action.

**Manual check before the party** (10 minutes): start the stack, join from two
computers, build a ride on each, try to rename the other one's ride (must be refused),
make yourself admin, check the dashboard on a phone, `docker compose restart openrct2`,
rejoin and check everything is still there.

## Limitations

* **No LAN server list:** OpenRCT2's LAN discovery uses UDP broadcast, which does not pass
  Docker's port publishing. Players connect directly by IP (`Connect to Server`). Tip:
  add it once via *Multiplayer → Add server*.
* **What can be lost:** a crash or power cut loses at most the last 5 minutes (last
  autosave); a normal `docker compose stop` saves first. While the server is paused
  (nobody online) the game cannot save, but nothing changes then either - except that
  changes in the last ≤ 60 s before the last player left are only in the safety save
  rhythm, so stopping the container within a minute after the last player left can
  lose up to that minute.
* ffa-ownership puts the owner's name in ride names and **removes digits** from names
  players type; track designs are blocked; owner names in `!owner` are forgotten after a
  restart (ownership itself is kept).
* Rides that came with the initial park have no owner: only admins can edit them, and
  their profit counts for nobody.
* Money values on the dashboard follow the game's balance formula; money changes the
  plugin cannot see (e.g. an admin's cheat `set money`) are not reflected.
* The dashboard is read-only and has no login; anyone on the LAN can view it.
