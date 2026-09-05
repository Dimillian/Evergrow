# Local combat prototype

Checkpoint date: 2026-09-05. This is the first playable foundation, scoped to the user's latest request. Gameplay feel and visual acceptance are for the user to assess in the in-app browser.

## Implemented

- One continuous seeded Deadwood biome, a clear starting area, winding protected trails, rocks, living/dead trees, and lantern shrines.
- Terrain tiles generated on demand with a 48-tile cache; stable prop identities and collision across positive and negative coordinates.
- Code-generated tree/rock/shrine shapes, material marks, and finite sprite caches. No concept PNG is imported into the game.
- Layered character animation with visible helmet, shoulder armor, cloak, boots, and sword; distinct stalker, brute, and caster silhouettes.
- Keyboard movement and pointer aiming, a three-hit sword combo, ember projectiles, two regenerating dodge charges, and healing flasks.
- Telegraph, attack, and recovery states; damage sectors and collision checks; knockback, hit reactions, damage numbers, sparks, and short hitstop.
- Bounded enemy populations with gradual introduction of heavy and ranged enemies; health/focus pickups, flask recovery through kills, death, and restart.
- Orb HUD, minimap, four combat controls, pause/settings, configurable sound, reduced motion, and CRT/phosphor/clean display modes.
- Synthesized audio and a code-defined bitmap font. Preferences are stored locally when browser storage is available.

## Architecture chosen for this experiment

The local Vite/TypeScript application has no runtime package dependencies. Canvas 2D draws procedural assets and the scene into a logical-resolution buffer; a small WebGL pass presents it with optional scanlines, phosphor glow, and display treatment. A clean Canvas fallback is used when WebGL is unavailable.

Combat uses a deterministic 120 Hz simulation with collision and rewards independent of rendering. The outer loop bounds catch-up, retains fast input taps until a simulation step, clears input on focus/menu changes, and pauses when the page loses focus. The rendering layer owns transient particles, sounds, camera motion, and hitstop.

This is a practical first implementation, not a final renderer commitment. Performance on the user's normal play setup, art readability in motion, and combat feel determine the next changes.

## Validation and next feedback

The 28 deterministic engine tests cover combat geometry, single-hit windows, combo sequencing, cancellation and buffer expiry, dodge protection, swept projectiles, healing, reward identity, spawn limits, reproducibility, collision, route access, and tile-cache bounds. Production compilation also verifies the TypeScript integration.

The initial integration check caught and fixed lost very short mouse taps and several warning/attack geometry mismatches. Browser regression tests created during that check remain optional; do not run them or automate gameplay without the user's explicit request. All future playtesting and feel judgments belong to the user in the in-app browser.

Useful feedback areas are movement pace, sword reach and weight, dodge responsiveness, enemy pressure, character scale, terrain detail, lighting, and shader strength. These are observations to gather, not an acceptance checklist the user must complete.

## Deliberately deferred

Additional biomes, towns and building interiors, a skill tree, equipment swapping and inventory, crafting, persistent character/world saves, danger tiers, controller/mobile support, and multiplayer. Current kills and combat state are per run; only presentation preferences survive reload. Displayed equipment demonstrates the rig, rather than an implemented inventory system.

The project stays local. There is no deployment or Git remote connected to this checkout.
