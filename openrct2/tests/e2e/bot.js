/*
 * E2E bot: a *local* plugin loaded by a real OpenRCT2 client that joined the
 * server. It runs the steps from sharedStorage key "e2e.steps" one by one and
 * prints machine-readable result lines ("E2E {json}") on stdout.
 * All game changes go through context.executeAction, i.e. they are sent to
 * the server and checked there by the FFA plugins, exactly like a human click.
 *
 * Steps:
 *   { op: "create", label }                       build a 1x1 stall: ridecreate + trackplace
 *   { op: "rename", label, target, name }         ridesetname on a target ride
 *   { op: "demolish", label, target }             ridedemolish on a target ride
 *   { op: "status", label, target, status }       ridesetstatus (0 closed, 1 open)
 *   { op: "setting", label, target, setting, value } ridesetsetting (2 = min. waiting time)
 *   { op: "wait", ms }
 *   { op: "info", label }                         report own player + rides
 * target = { created: "<label>" } (ride made by an earlier create step of this
 *          bot) or { nameStartsWith: "Alice " } (any ride in the park).
 */
(function () {
    function out(obj) {
        console.log('E2E ' + JSON.stringify(obj));
    }

    function findRide(target, created) {
        if (target.created !== undefined) {
            return created[target.created];
        }
        var rides = map.rides;
        for (var i = 0; i < rides.length; i++) {
            if (target.nameStartsWith && rides[i].name.indexOf(target.nameStartsWith) === 0) {
                return rides[i].id;
            }
        }
        return undefined;
    }

    var FLAT_TRACK_1X1 = 118; // TrackElemType::FlatTrack1x1A, used by all 1x1 shops/stalls

    function pickRideObject() {
        // a stall (shopItem != 255): occupies one tile and needs no entrance/exit.
        // A ride without any track would be removed by OpenRCT2 on the next save/load.
        var objs = objectManager.getAllObjects('ride');
        for (var i = 0; i < objs.length; i++) {
            var types = objs[i].rideType || [];
            if (objs[i].shopItem !== 255 && types.length > 0 && types[0] !== 255) {
                return { rideType: types[0], rideObject: objs[i].index };
            }
        }
        return null;
    }

    function hasPath(x, y) {
        if (x < 0 || y < 0 || x >= map.size.x || y >= map.size.y) { return false; }
        var els = map.getTile(x, y).elements;
        for (var i = 0; i < els.length; i++) { if (els[i].type === 'footpath') { return true; } }
        return false;
    }

    function freeTiles() {
        // flat, dry tiles with nothing on them but the ground; tiles next to a
        // footpath first (those are inside the park). The game decides whether the
        // park owns the land: see findStallTile().
        var near = [], other = [];
        for (var x = 1; x < map.size.x - 1; x++) {
            for (var y = 1; y < map.size.y - 1; y++) {
                var els = map.getTile(x, y).elements;
                if (els.length !== 1 || els[0].type !== 'surface') { continue; }
                var s = els[0];
                if (s.slope !== 0 || s.waterHeight !== 0) { continue; }
                var t = { x: x * 32, y: y * 32, z: s.baseZ };
                (hasPath(x - 1, y) || hasPath(x + 1, y) || hasPath(x, y - 1) || hasPath(x, y + 1) ? near : other).push(t);
            }
        }
        return near.concat(other);
    }

    function placeArgs(t, ride, rideType) {
        return { x: t.x, y: t.y, z: t.z, direction: 0, ride: ride, trackType: FLAT_TRACK_1X1, rideType: rideType,
            brakeSpeed: 0, colour: 0, seatRotation: 4, trackPlaceFlags: 0, isFromTrackDesign: false };
    }

    /** First candidate tile the game accepts (queryAction has no side effects). */
    function findStallTile(ride, rideType) {
        var tiles = freeTiles(), lastError = null;
        for (var k = 0; k < tiles.length && k < 5000; k++) {
            var res = null;
            context.queryAction('trackplace', placeArgs(tiles[k], ride, rideType), function (r) { res = r; });
            if (res === null) { return { tile: tiles[k], note: 'async query' }; }
            if (!res.error) { return { tile: tiles[k] }; }
            lastError = res.errorTitle + ' / ' + res.errorMessage;
        }
        return { tile: null, note: tiles.length + ' candidates, last error: ' + lastError };
    }

    function main() {
        if (network.mode !== 'client') {
            return;
        }
        var steps = context.sharedStorage.get('e2e.steps', []);
        var created = {};
        var me = network.currentPlayer;
        out({ event: 'joined', player: me.name, id: me.id, group: me.group, steps: steps.length });

        function run(i) {
            if (i >= steps.length) {
                out({ event: 'done' });
                return;
            }
            var step = steps[i];
            var next = function () { context.setTimeout(function () { run(i + 1); }, 1500); };
            var report = function (extra) {
                var r = { event: 'step', op: step.op, label: step.label || null };
                for (var k in extra) { r[k] = extra[k]; }
                out(r);
            };
            var settled = false;
            var onResult = function (result, stage) {
                if (settled) { return; }
                settled = true;
                report({ ok: !result.error, stage: stage || 'execute', error: result.error || 0, errorTitle: result.errorTitle || null,
                    errorMessage: result.errorMessage || null, ride: result.ride !== undefined ? result.ride : null });
                if (step.op === 'create' && !result.error) {
                    created[step.label] = result.ride;
                }
                next();
            };
            // Like the game UI: query first (this runs the plugins' query hooks, also the
            // FFA plugins the server sent to this client), then execute on the server.
            // OpenRCT2 does not call the executeAction callback when the local query
            // fails, so a watchdog makes sure a step can never hang the bot.
            var act = function (name, args, done) {
                done = done || onResult;
                var finished = false;
                var finish = function (r, stage) { if (!finished) { finished = true; done(r, stage); } };
                context.setTimeout(function () { finish({ error: -1, errorTitle: 'timeout' }, 'timeout'); }, 10000);
                context.queryAction(name, args, function (q) {
                    if (q.error) { finish(q, 'query'); return; }
                    context.executeAction(name, args, function (r) { finish(r, 'execute'); });
                });
            };
            try {
                if (step.op === 'wait') {
                    context.setTimeout(function () { run(i + 1); }, step.ms || 1000);
                } else if (step.op === 'info') {
                    var p = network.getPlayer(network.currentPlayer.id);
                    var names = map.rides.map(function (r) { return r.id + ':' + r.name; });
                    report({ ok: true, player: p.name, group: p.group, rides: names });
                    next();
                } else if (step.op === 'create') {
                    var obj = pickRideObject();
                    if (!obj) { report({ ok: false, errorTitle: 'no ride object' }); next(); return; }
                    act('ridecreate', { rideType: obj.rideType, rideObject: obj.rideObject, entranceObject: 0, colour1: 0, colour2: 0, inspectionInterval: 0 },
                        function (c, stage) {
                            if (c.error) { onResult(c, stage); return; }
                            var found = findStallTile(c.ride, obj.rideType);
                            if (!found.tile) {
                                onResult({ error: -1, errorTitle: 'no free tile for the stall', errorMessage: found.note, ride: c.ride }, 'place');
                                return;
                            }
                            act('trackplace', placeArgs(found.tile, c.ride, obj.rideType), function (p, pstage) {
                                onResult({ error: p.error, errorTitle: p.errorTitle, errorMessage: p.errorMessage, ride: c.ride,
                                    tile: found.tile }, 'place-' + pstage);
                            });
                        });
                } else {
                    var rideId = findRide(step.target, created);
                    if (rideId === undefined) { report({ ok: false, errorTitle: 'target not found' }); next(); return; }
                    if (step.op === 'rename') {
                        act('ridesetname', { ride: rideId, name: step.name });
                    } else if (step.op === 'demolish') {
                        act('ridedemolish', { ride: rideId, modifyType: 0 });
                    } else if (step.op === 'setting') {
                        act('ridesetsetting', { ride: rideId, setting: step.setting, value: step.value });
                    } else if (step.op === 'status') {
                        act('ridesetstatus', { ride: rideId, status: step.status });
                    } else {
                        report({ ok: false, errorTitle: 'unknown op' });
                        next();
                    }
                }
            } catch (e) {
                report({ ok: false, errorTitle: 'exception', errorMessage: String(e) });
                next();
            }
        }
        // give the client a moment to settle after downloading the map
        context.setTimeout(function () { run(0); }, 4000);
    }

    registerPlugin({
        name: 'e2e-bot',
        version: '1.0.0',
        authors: ['LAN party tests'],
        type: 'local',
        licence: 'MIT',
        targetApiVersion: 124,
        main: main
    });
})();
