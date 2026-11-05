# Vendored FFA plugin suite

`upstream/` is an unmodified copy of
[CorySanin/openrct2-ffa-plugin-suite](https://github.com/CorySanin/openrct2-ffa-plugin-suite)
at commit `dae02be7b26f164011fa5490eb76a0d254da1d67` (2026-06-16), licensed GPL-3.0
(see `upstream/LICENSE`). `upstream/lib/*.js` are the compiled plugins that run on
the server; `upstream/src/` is their TypeScript source.

`patches/` holds the only local changes. They are applied with `patch` while the
server image is built (see `server/Dockerfile`), so `upstream/` always stays a
clean copy that can be replaced on an update.

## Patches

| Patch | Why |
|---|---|
| `ownership.patch` | On `ridecreate` upstream only records the owner if `e.player < network.numPlayers`. Player ids are the lowest free id (server = 0), so after someone disconnects the remaining players can have ids >= the player count; their new rides then got **no owner at all**, which made them uneditable even for their builder. Replaced by "the player exists". |
| `individual-economy.patch` | (1) The `ridedemolish` hooks crashed (`TypeError`) for rides without economy data (rides that came with the park, or built before the plugin was enabled) - typically when an admin removes them. (2) `ridedemolish` with `modifyType = 1` is a *refurbish*, not a demolition, but it removed the ride from the owner's list (the owner lost its income). Both now only act on real demolitions of rides the plugin knows. |
| `cheat-toggle.patch` | Upstream always enables the same cheats. Each one can now be switched off via `plugin.store.json` (`cheat-toggle.<name>`, written from `.env` by the entrypoint). Adds the optional `disableLittering` toggle (OpenRCT2 cheat 14) for a tidy park. Defaults match upstream except `disableLittering`, which the entrypoint enables. |

## Compatibility with OpenRCT2 0.5.7 (plugin API 124)

Checked against the OpenRCT2 v0.5.7 source and in real multiplayer tests:

* Action names (`cheatset`, `ridesetname`, ...), `network.getPlayer(id)` (API >= 77: ids,
  returns `null` for unknown ids) and permission names (`kick_player`) are unchanged.
* Cheat indices used by cheat-toggle still match `CheatType` in `src/openrct2/Cheats.h`
  (9 breakdowns, 13 vandalism, 14 littering, 23 grass, 25 plant aging, 43 ride value, 44 unlock rides).
* **Admin exception:** ffa-ownership already lets every player whose group has the
  `kick_player` permission edit any ride. No change was needed; the Admin group has it,
  the Player group does not.
* **ffa-disable-track-designs is still required:** `TrackDesignCreateRide()` in
  `src/openrct2/ride/TrackDesign.cpp` runs the nested `RideCreateAction` without a
  player id, so ownership and economy cannot attribute track designs
  ([OpenRCT2#12762](https://github.com/OpenRCT2/OpenRCT2/issues/12762) is not fixed in 0.5.7).
* Ownership (`rideOwners`) and balances (`playerProfiles`) are stored in the park's
  plugin storage keyed by the player's public-key hash, so they persist in every save
  and survive reconnects and renames. ffa-ownership keeps owner *names* only in memory
  (`!owner` says "unknown" after a restart); the dashboard keeps its own name history.

## Updating

1. Replace `upstream/` with the new upstream version (keep `LICENSE`).
2. `docker compose build openrct2` - the build fails loudly if a patch no longer applies;
   then refresh or drop that patch.
3. Run the end-to-end test (`tests/e2e/run.sh`).
