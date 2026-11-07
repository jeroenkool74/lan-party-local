/*
 * lan-stats — read-only statistics exporter for the LAN dashboard.
 *
 * Runs on the dedicated server only (type "local": it is never sent to clients).
 * Every few seconds (real time, also while the server is paused) it builds a
 * snapshot of players, attractions and the park and sends it as one line of
 * JSON over TCP to the dashboard backend.
 *
 * Design rules:
 *  - Never mutates game state, never executes game actions (no desync risk).
 *  - Ownership and balances are READ from the FFA plugins' park storage
 *    (ffa-ownership: rideOwners, ffa-individual-economy: playerProfiles); no
 *    ownership logic is duplicated here. Park storage of another plugin is only
 *    opened when that plugin is loaded, because opening it creates an entry.
 *  - Players are identified by their public-key hash (stable across renames).
 *
 * The OpenRCT2 socket API only allows localhost or hosts listed in the
 * server's `[plugin] allowed_hosts` config option; the container entrypoint
 * adds the dashboard host there.
 *
 * Configuration (context.sharedStorage, written by the container entrypoint):
 *   lan-stats.host        dashboard ingest host        (default "dashboard")
 *   lan-stats.port        dashboard ingest port        (default 9000)
 *   lan-stats.intervalMs  snapshot interval in ms      (default 10000)
 */
(function () {
    'use strict';

    var PLUGIN_VERSION = '1.0.0';
    var SCHEMA_VERSION = 1;
    var OWNERSHIP_PLUGIN = 'ffa-ownership';
    var ECONOMY_PLUGIN = 'ffa-individual-economy';
    // Ride type id of toilets; ffa-individual-economy never lets them cost money.
    var RIDE_TYPE_TOILETS = 36;
    var RATING_UNDEFINED = 0xFFFF;
    // RideFlag bit positions (src/openrct2/ride/Ride.h)
    var FLAG_BROKEN_DOWN = 1 << 7;
    var FLAG_CRASHED = 1 << 10;

    function safe(fn, fallback) {
        try {
            var v = fn();
            return v === undefined ? fallback : v;
        } catch (e) {
            return fallback;
        }
    }

    function rating(value) {
        if (typeof value !== 'number' || value < 0 || value >= RATING_UNDEFINED) {
            return null;
        }
        return value;
    }

    // OpenRCT2 uses INT64_MIN (MONEY64_UNDEFINED) for "no value yet", e.g. the
    // profit per hour of a ride that has not run yet.
    function money(value) {
        if (typeof value !== 'number' || !isFinite(value) || value <= -9007199254740991 || value >= 9007199254740991) {
            return null;
        }
        return value;
    }

    function loadedPluginNames(api) {
        var names = {};
        var list = safe(function () { return api.pluginManager.plugins; }, []);
        for (var i = 0; i < list.length; i++) {
            names[list[i].name] = true;
        }
        return names;
    }

    function readStorage(api, pluginName, key, loaded) {
        if (!loaded[pluginName]) {
            return null;
        }
        return safe(function () { return api.context.getParkStorage(pluginName).get(key, null); }, null);
    }

    /** Mirrors getRideProfit() in ffa-individual-economy. */
    function economyRideProfit(ride) {
        if (!ride) {
            return 0;
        }
        var p = ride.totalProfit || 0;
        return Math.max(p, ride.type === RIDE_TYPE_TOILETS ? 0 : p);
    }

    /**
     * Builds a snapshot. `api` holds the OpenRCT2 globals so the function can be
     * unit-tested with mocks: { context, network, park, date, map, pluginManager }.
     */
    function collectSnapshot(api) {
        var loaded = loadedPluginNames(api);
        var rideOwners = readStorage(api, OWNERSHIP_PLUGIN, 'rideOwners', loaded);
        var profiles = readStorage(api, ECONOMY_PLUGIN, 'playerProfiles', loaded);
        var rideProps = readStorage(api, ECONOMY_PLUGIN, 'rideProperties', loaded);
        var initialDollars = readStorage(api, ECONOMY_PLUGIN, 'initialDollars', loaded);
        var noMoney = safe(function () { return api.park.getFlag('noMoney'); }, false);
        var economyActive = !!(profiles && typeof initialDollars === 'number' && !noMoney);

        var rides = [];
        var ridesById = {};
        var mapRides = safe(function () { return api.map.rides; }, []);
        for (var i = 0; i < mapRides.length; i++) {
            var r = mapRides[i];
            var flags = safe(function () { return r.flags; }, 0);
            var owner = null;
            var ownerSource = null;
            if (rideOwners && rideOwners[r.id] !== undefined) {
                owner = rideOwners[r.id];
                ownerSource = 'ffa-ownership';
            } else if (rideProps && rideProps[r.id] && rideProps[r.id].authorHash) {
                owner = rideProps[r.id].authorHash;
                ownerSource = 'ffa-individual-economy';
            }
            var ride = {
                id: r.id,
                name: safe(function () { return r.name; }, ''),
                type: safe(function () { return r.type; }, null),
                objectName: safe(function () { return r.object.name; }, null),
                classification: safe(function () { return r.classification; }, null),
                status: safe(function () { return r.status; }, null),
                brokenDown: (flags & FLAG_BROKEN_DOWN) !== 0,
                crashed: (flags & FLAG_CRASHED) !== 0,
                excitement: rating(safe(function () { return r.excitement; }, null)),
                intensity: rating(safe(function () { return r.intensity; }, null)),
                nausea: rating(safe(function () { return r.nausea; }, null)),
                totalCustomers: safe(function () { return r.totalCustomers; }, 0),
                totalProfit: money(safe(function () { return r.totalProfit; }, 0)) || 0,
                profitPerHour: money(safe(function () { return r.profit; }, null)),
                incomePerHour: money(safe(function () { return r.incomePerHour; }, null)),
                guestsOnRide: safe(function () { return r.guestCount; }, null),
                runningCost: money(safe(function () { return r.runningCost; }, null)),
                value: money(safe(function () { return r.value; }, null)),
                buildDate: safe(function () { return r.buildDate; }, null),
                age: safe(function () { return r.age; }, null),
                downtime: safe(function () { return r.downtime; }, null),
                reliability: safe(function () { return r.reliability; }, null),
                price: safe(function () { return r.price[0]; }, null),
                owner: owner,
                ownerSource: ownerSource
            };
            rides.push(ride);
            ridesById[r.id] = ride;
        }

        var onlinePlayers = [];
        var groups = {};
        var groupList = safe(function () { return api.network.groups; }, []);
        for (var g = 0; g < groupList.length; g++) {
            groups[groupList[g].id] = groupList[g];
        }
        var netPlayers = safe(function () { return api.network.players; }, []);
        for (var p = 0; p < netPlayers.length; p++) {
            var pl = netPlayers[p];
            var hash = safe(function () { return pl.publicKeyHash; }, '');
            if (!hash) {
                continue; // the (invisible) server host player has no key
            }
            var group = groups[pl.group];
            var perms = (group && group.permissions) || [];
            onlinePlayers.push({
                id: pl.id,
                hash: hash,
                name: pl.name,
                group: group ? group.name : null,
                // Same rule ffa-ownership uses for its admin exception.
                isAdmin: perms.indexOf('kick_player') >= 0,
                ping: safe(function () { return pl.ping; }, null)
            });
        }

        var economy = null;
        if (economyActive) {
            var balances = {};
            for (var h in profiles) {
                // "" is the server host player (actions run by plugins on the server)
                if (!h || !Object.prototype.hasOwnProperty.call(profiles, h)) {
                    continue;
                }
                var prof = profiles[h];
                // Mirrors getPlayerCash() in ffa-individual-economy.
                var profit = 0;
                var created = prof.ridesCreated || [];
                for (var c = 0; c < created.length; c++) {
                    profit += economyRideProfit(ridesById[created[c]]);
                }
                balances[h] = {
                    name: prof.name,
                    balance: initialDollars - (prof.moneySpent || 0) + profit,
                    moneySpent: prof.moneySpent || 0,
                    ridesCreated: created.length
                };
            }
            economy = { initialDollars: initialDollars, players: balances };
        }

        return {
            type: 'snapshot',
            schema: SCHEMA_VERSION,
            plugin: PLUGIN_VERSION,
            apiVersion: safe(function () { return api.context.apiVersion; }, null),
            ffa: {
                ownership: !!loaded[OWNERSHIP_PLUGIN],
                economy: !!loaded[ECONOMY_PLUGIN],
                plugins: Object.keys(loaded).sort()
            },
            date: {
                year: safe(function () { return api.date.year; }, null),
                month: safe(function () { return api.date.month; }, null),
                day: safe(function () { return api.date.day; }, null),
                monthsElapsed: safe(function () { return api.date.monthsElapsed; }, null),
                ticksElapsed: safe(function () { return api.date.ticksElapsed; }, null)
            },
            sim: {
                paused: safe(function () { return api.context.paused; }, null),
                onlineCount: onlinePlayers.length
            },
            park: {
                name: safe(function () { return api.park.name; }, null),
                guests: safe(function () { return api.park.guests; }, null),
                rating: safe(function () { return api.park.rating; }, null),
                value: safe(function () { return api.park.value; }, null)
            },
            players: onlinePlayers,
            economy: economy,
            rides: rides
        };
    }

    // ---------------------------------------------------------------- transport

    function createExporter(api, cfg) {
        var socket = null;
        var connected = false;
        var connecting = false;
        var lastAttempt = 0;
        // Reconnect with backoff (5 s doubling to 60 s) to keep the log quiet
        // while the dashboard is down.
        var retryMs = 5000;
        var MAX_RETRY_MS = 60000;

        function log(msg) {
            console.log('[lan-stats] ' + msg);
        }

        function drop(reason) {
            if (socket) {
                try { socket.destroy(null); } catch (e) { /* ignore */ }
            }
            if (connected && reason) {
                log('disconnected from dashboard: ' + reason);
            }
            socket = null;
            connected = false;
            connecting = false;
        }

        function connect() {
            var now = Date.now();
            if (connecting || connected || now - lastAttempt < retryMs) {
                return;
            }
            lastAttempt = now;
            retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
            connecting = true;
            try {
                var s = api.network.createSocket();
                socket = s;
                s.on('error', function (err) {
                    if (socket === s) { drop('error ' + err); }
                });
                s.on('close', function () {
                    if (socket === s) { drop('closed'); }
                });
                s.on('data', function () { /* backend never sends data */ });
                s.connect(cfg.port, cfg.host, function () {
                    if (socket !== s) { return; }
                    connected = true;
                    connecting = false;
                    retryMs = 5000;
                    log('connected to dashboard at ' + cfg.host + ':' + cfg.port);
                    send({ type: 'hello', plugin: PLUGIN_VERSION, schema: SCHEMA_VERSION });
                    sendSnapshot();
                });
            } catch (e) {
                connecting = false;
                socket = null;
                log('cannot connect to ' + cfg.host + ':' + cfg.port + ': ' + e +
                    ' (is the host listed in [plugin] allowed_hosts?)');
            }
        }

        function send(obj) {
            if (!connected || !socket) {
                return false;
            }
            var line = JSON.stringify(obj) + '\n';
            // Note: OpenRCT2's Socket.write() returns true when NOT all bytes were sent.
            var incomplete = socket.write(line);
            if (incomplete) {
                // Partial writes break line framing; reconnect to resynchronise.
                drop('partial write');
                return false;
            }
            return true;
        }

        function sendSnapshot() {
            if (!connected) {
                connect();
                return;
            }
            var snap;
            try {
                snap = collectSnapshot(api);
            } catch (e) {
                log('snapshot failed: ' + e);
                return;
            }
            send(snap);
        }

        return { connect: connect, sendSnapshot: sendSnapshot, send: send, isConnected: function () { return connected; } };
    }

    function main() {
        if (network.mode !== 'server') {
            return;
        }
        var api = {
            context: context, network: network, park: park, date: date, map: map,
            pluginManager: typeof pluginManager !== 'undefined' ? pluginManager : null
        };
        var store = context.sharedStorage;
        var cfg = {
            host: store.get('lan-stats.host', 'dashboard'),
            port: store.get('lan-stats.port', 9000),
            intervalMs: Math.max(2000, store.get('lan-stats.intervalMs', 10000))
        };
        var exporter = createExporter(api, cfg);
        var pending = false;

        // Push an extra snapshot shortly after joins/leaves so presence updates quickly.
        function soon() {
            if (pending) { return; }
            pending = true;
            context.setTimeout(function () {
                pending = false;
                exporter.sendSnapshot();
            }, 1500);
        }

        context.subscribe('network.join', function (e) {
            var p = network.getPlayer(e.player);
            console.log('[lan-stats] player joined: ' + (p ? p.name + ' (' + p.publicKeyHash.substring(0, 12) + ')' : e.player));
            soon();
        });
        context.subscribe('network.leave', function (e) {
            console.log('[lan-stats] player left: id ' + e.player);
            soon();
        });

        // Log actions of players that the server refused (e.g. "NOT OWNED" from
        // ffa-ownership). OpenRCT2 itself does not log refused actions, and the client
        // only shows a popup. Read-only: the result is not touched. Plugins load in
        // file-name order, so this hook runs after the ffa-* hooks have set their result.
        var lastDenial = {};
        context.subscribe('action.query', function (e) {
            if (!e.result || !e.result.error || typeof e.player !== 'number' || e.player <= 0) { return; }
            var p = network.getPlayer(e.player);
            var name = p ? p.name : 'player ' + e.player;
            var title = e.result.errorTitle || ('error ' + e.result.error);
            var key = e.player + '|' + e.action + '|' + title;
            var now = Date.now();
            if (lastDenial[key] && now - lastDenial[key] < 5000) { return; }
            lastDenial[key] = now;
            console.log('[lan-stats] denied ' + e.action + ' from ' + name + ': ' + title +
                (e.result.errorMessage ? ' - ' + e.result.errorMessage : ''));
        });

        console.log('[lan-stats] v' + PLUGIN_VERSION + ' exporting every ' + cfg.intervalMs + ' ms to ' + cfg.host + ':' + cfg.port);
        exporter.connect();
        context.setInterval(function () { exporter.sendSnapshot(); }, cfg.intervalMs);

        startControlListener(store.get('lan-stats.controlPort', 11780), store.get('lan-stats.safetySaveSeconds', 60));
    }

    /*
     * Container-local control channel (127.0.0.1 only, never published).
     * Used by the entrypoint to request a save before shutdown.
     *   "save\n" -> "saved <file>" | "paused" | "error <msg>"
     * context.saveGame() is only allowed in a game-state-mutable context, so the
     * save is performed in the next interval.tick. Ticks do not run while the
     * server is paused; in that case nothing changed since the pause and the
     * built-in autosave covers it, so we answer "paused".
     *
     * Safety save: OpenRCT2 pauses the moment the last player leaves, and no
     * plugin code can save while paused. The built-in autosave only runs 5
     * minutes after activity started, so a server stop shortly after the last
     * player left could lose up to 5 minutes. While exactly one player is
     * online we therefore also save every `safetySaveSeconds` (default 60).
     */
    var SAVE_NAME = 'lan-latest';
    function startControlListener(port, safetySaveSeconds) {
        var waiting = [];
        var lastTickSeenAt = 0;
        var lastSafetySave = Date.now();

        function humansOnline() {
            var n = 0;
            var ps = network.players;
            for (var i = 0; i < ps.length; i++) {
                if (ps[i].publicKeyHash) { n++; }
            }
            return n;
        }

        context.subscribe('interval.tick', function () {
            var now = Date.now();
            lastTickSeenAt = now;
            var safetyDue = safetySaveSeconds > 0 && now - lastSafetySave >= safetySaveSeconds * 1000;
            if (waiting.length === 0 && !safetyDue) {
                return;
            }
            if (waiting.length === 0) {
                lastSafetySave = now;
                if (humansOnline() !== 1) {
                    return;
                }
            }
            var reply;
            try {
                context.saveGame({ filename: SAVE_NAME });
                lastSafetySave = now;
                reply = 'saved ' + SAVE_NAME + '.park';
                if (waiting.length > 0) {
                    console.log('[lan-stats] saved game to save/' + SAVE_NAME + '.park on request');
                }
            } catch (e) {
                reply = 'error ' + e;
                console.log('[lan-stats] save failed: ' + e);
            }
            var sockets = waiting;
            waiting = [];
            for (var i = 0; i < sockets.length; i++) {
                try { sockets[i].end(reply + '\n'); } catch (e2) { /* ignore */ }
            }
        });

        try {
            var listener = network.createListener();
            listener.on('connection', function (sock) {
                sock.on('data', function (data) {
                    var cmd = String(data).trim();
                    if (cmd === 'save') {
                        var running = Date.now() - lastTickSeenAt < 1000;
                        if (running) {
                            waiting.push(sock);
                        } else {
                            sock.end('paused\n');
                        }
                    } else if (cmd === 'ping') {
                        sock.end('pong ' + PLUGIN_VERSION + '\n');
                    } else {
                        sock.end('error unknown command\n');
                    }
                });
                sock.on('error', function () { /* ignore */ });
            });
            listener.listen(port, '127.0.0.1');
            console.log('[lan-stats] control channel listening on 127.0.0.1:' + port);
        } catch (e) {
            console.log('[lan-stats] control channel unavailable: ' + e);
        }
    }

    if (typeof registerPlugin === 'function') {
        registerPlugin({
            name: 'lan-stats',
            version: PLUGIN_VERSION,
            authors: ['LAN party'],
            type: 'local',
            licence: 'MIT',
            minApiVersion: 77,
            targetApiVersion: 124,
            main: main
        });
    }

    // Exposed for unit tests (Node). Inside OpenRCT2 `module` is undefined.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { collectSnapshot: collectSnapshot, createExporter: createExporter };
    }
})();
