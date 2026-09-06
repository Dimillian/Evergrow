# Rootbound Crypt

Implemented 2026-09-06. One complete, persistent dungeon floor; pacing, difficulty and art remain subject to player feedback. The original proposal is in [dungeons and events](dungeons-and-events.md).

## Finding and entering

A stone crypt entrance appears near the starting route, around **(-520, 380)** (its exact clear-ground position is seeded). Other entrances sit near graveyards, offset from their event interaction. Discovered entrances appear on the overworld chart. Approach and press **E**, click, or use the controller interaction button to preview the fixed level and enter.

Each entrance owns a separate floor, not distant overworld coordinates. Dungeon level is the entrance's geographic level plus one, clamped at 1,000,000. Monsters never rescale when the player changes rooms, equipment or level. Entry uses the existing transition and short arrival protection without healing or restoring mana.

## Floor and encounters

- Thirteen rooms: a safe vestibule, nine combat chambers, two guarded treasure chambers and the Warden arena.
- A connected main route plus an optional loop through the treasure chambers. Doors stay open; clearing every ordinary enemy is optional.
- Seeded room proportions and offsets, eight graph orientations, encounter compositions and rewards. The graph is deliberately constrained to a validated template; arbitrary room graphs and additional themes are future extensions.
- Four to six ordinary enemies per combat chamber and four per treasure chamber: **44–62 ordinary enemies**, plus the boss and four threshold guardians.
- At most **24 living dungeon actors**. Room rosters stream wholly outside camera exclusion bounds. No ambient refill, visible materialization or reward for unloading a room. At very wide views, admission may wait for hidden space.
- Collision, projectiles and corridor navigation share the same worn room/corridor contours. Navigation uses bounded cached flow fields. Decorative sarcophagi, roots and masonry never obstruct those paths.

The entrance remains usable throughout. Killing the Warden unlocks the final chest and another exit near the arena. Exits return to the surface entrance.

## Crypt atmosphere

The crypt has its own dark ambient illumination, independent of outdoor daylight. Warm wall torches and cold suspended orbs illuminate the actual floor, walls and monsters; cached visibility fans stop each light at masonry. The player carries a modest neutral light, while attacks and spells retain their shared dynamic light budget. Hot flame/orb cores, rising embers and orbiting sparks render after surface illumination and before CRT bloom. Reduced motion freezes their animation.

Room recesses and uneven corridor shoulders use one deterministic contour for terrain, collision, navigation and both maps. These contours extend the existing clear rectangles, preserving current dungeon positions, encounters and saves. The underlying thirteen-room connection template is unchanged. Chipped staggered flagstones, damp patches, exposed wall courses, worn and displaced tomb lids, roots, bones and old blood trails provide the burial-chamber detail. Decoration does not obstruct combat routes.

Terrain remains tile-cached and world-aligned. Light masks are limited to 96 rays per source, cached at eight-unit positions with 256 masks per floor and a bounded occupancy cache; the renderer retains its eighteen-light budget. Fixture anchors are shared by art and illumination.

## Hollow Warden

The Warden has a distinct procedural silhouette and a persistent top boss plate. Its level-one baseline is 1,800 life and 18 damage, using shared geographic monster scaling.

| Move | Rule |
| --- | --- |
| Grave sweep | Broad frontal sector, 0.9-second locked warning, followed by recovery |
| Root fracture | Three locked ground lanes after a one-second warning; impacts spaced 0.16 seconds apart, at most one hit per sequence |
| Call the buried | Two finite guardians at 65% life and two at 30%; phase flags persist across travel and saving |
| Final phase | Recovery shortens to 0.65 seconds; warning duration stays unchanged |

Hard control lasts 25% of its ordinary duration, capped at 0.35 seconds, followed by 2.5 seconds of stun immunity. Slows have half duration and cannot reduce speed below 65%. Damage-over-time still works. The control hint appears when focusing the boss.

The arena stays escapable. Wounds, deaths and triggered guardian waves persist; neither retreat nor town travel resets boss life. This permits wearing down the boss across attempts in this prototype. The player will validate actual fight duration and pressure.

## Treasure

Ordinary enemies keep the existing source-level loot tables. The Warden awards six normal Stalkers' baseline XP through the normal level-gap adjustment, and one kill's potion credit, with no extra generic equipment or coin roll.

Each optional chest provides one veteran-weight item at D + 1 and 18 × (1 + 0.1 × (D − 1)) gold. The final chest provides three items using normal/veteran/elite rarity tables at D / D + 1 / D + 2, and 45–70 × (1 + 0.1 × (D − 1)) gold. Shared item-level limits apply. No guaranteed Rare item or enhancement bonus.

Chests use the shared interruptible one-second interaction channel, animated lids and warm light feedback. Items and coins appear physically and use existing pickup notifications. Delivery masks and ground insertion persist together before commitment. Full ground capacity leaves the remaining bundle pending; subsequent interaction delivers only the missing rewards. A full bag does not erase treasure or block the exit. The current burst is simultaneous; staggered emergence is a later presentation refinement.

## Travel, maps and saving

Only the active location simulates. Switching stages both locations and persists before committing. The suspended surface retains living actors, wounded sleeping camp members, camp casualties, ground items, coins and resource vials. A suspended floor retains its roster, health, guardian thresholds, ground loot and visited rooms. Character resources, cooldowns, gear and wallet stay shared.

Town portal P uses the existing cancellable channel. Its return endpoint includes the dungeon identity and exact floor position; vendor visits do not reroll the floor. Death uses town recovery, preserves the expedition, and clears the one-use portal link. Re-enter the original crypt to continue. Reloaded attacks restart safely rather than resuming at impact.

The minimap shows the local explored floor. The large map supports drag/zoom, discovered chest/boss hover labels and an Overworld button. Floor discovery never writes to the surface chart. Surface entrance tooltips identify active/cleared expeditions.

One unfinished expedition is allowed per character. Up to **eight expeditions** are retained, including completed rosters and unresolved optional rewards; no automatic eviction or reset. The existing 700,000-character save limit also applies. A full journal or failed storage write rejects the action without erasing either location. Current v3 checkpoints can gain these optional fields without resetting characters.

## Ownership and review

`dungeon.ts` owns immutable blueprints and headless geometry; `dungeon-contours.ts` shares worn outlines, `dungeon-surface.ts` draws cached masonry, and `dungeon-lighting.ts` owns fixture anchors and bounded visibility masks; `dungeon-world.ts` adapts them to rendering/collision; `dungeon-state.ts` owns persistent location contents; `dungeon-runtime.ts` admits roster actors; `dungeon-boss.ts` owns boss decisions; `dungeon-command.ts` stages transitions and chest transactions. Damage, statuses, XP, item generation and gold remain shared with the existing game.

`/dungeon.html` is a local, save-free review of the entrance, burial chamber, passage, Warden arena and explored floor. Lights animate at up to 30 FPS over frozen actors; it never advances gameplay and respects reduced motion. Tests cover deterministic seeds, collision-safe routes, offscreen admission, casualties, threshold waves, control, reward ownership, interrupted openings, full ground capacity, failed saves and town/death returns.
