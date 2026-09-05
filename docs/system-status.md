# System status and foundation checkpoint

2026-09-05 · local prototype · world generation 3.

The foundation pass preserves existing gameplay and art while making rules, drawing, persistence, input, and browser lifecycle easier to change independently. The result is ready for controlled expansion within the current budgets. Gameplay acceptance and performance on the user's machine remain separate from code verification.

## Current inventory

| System | Implemented today | Status / next boundary |
| --- | --- | --- |
| Combat | 120 Hz deterministic simulation; 4 player actions; swept melee/projectiles; buffering, dodge, recoil, death/restart | Tested foundation; action execution remains explicit |
| Encounters | 3 enemy archetypes, progression-based mix, 5–10 target population, 12-enemy hard cap, 2 pack + 1 special simultaneous attack slots | Bounded prototype; large crowds need profiling |
| Equipment / stats | 1 sword definition; speed/damage multipliers; attack snapshots; 7 outfit layers; two-hand grip with future off-hand occupancy | Rendering/stat foundation; no inventory or item swapping UI |
| World | 3 smoothly connected biomes; streamed 256-unit terrain tiles; deterministic roads, props and clear corridors | Tested generation; biome distribution is still a three-region prototype |
| Settlements / interiors | 5 building kinds; 8 buildings in Briarwatch; towns target 5–8, cities 12–16; shared doors/walls/furniture; roof fading and sanctuaries | Walkable layout foundation; no residents or service transactions |
| Maps / discovery | Smooth minimap, explored-world map, hover POIs; 7 registered POI kinds; chart persistence | Tested bounded storage; landmark kind is reserved for later content |
| Procedural art | Modular character motion, equipment drawing, enemy art and prop libraries; all world art generated in code | Preserved drawing output; more weapon/armor families remain content work |
| Lighting / effects | Dynamic lights/shadows, combat particles, blade ribbon, synthesized audio, fixed CRT/soft phosphor | Bounded resources; performance has not been benchmarked in gameplay |
| HUD / application | Animated orbs, 4 action slots, 4 disabled menu shortcuts, enemy focus plate, shared UI hit regions, clean native text | Tested geometry/input; menus await their actual systems |
| Interface kit | Shared theme and SVG icons; refined start/pause/defeat/map windows; buttons, slots, stats, tooltips, scroll regions, keyboard focus | Ready for panel composition; inventory behavior remains future work |
| Lifecycle / tooling | Scoped teardown and startup rollback, HMR cleanup, strict/core compilation, dependency checks, reusable stats command | Foundation guardrails in place |

## Combat numbers

Player starts with **100 life / 100 mana**. The sword deals **24 damage**, attacks **2 times/second**, reaches **60 world units**, and sweeps **135°**. Ember costs **20 mana**, deals **36 damage**, and has a **0.45 s** cooldown. Dodge has **2 charges** with **1.8 s** recharge; flasks have **2 charges**, restore **42 life**, and replenish a charge every **8 kills**. There are **2 projectile definitions** and **2 pickup types**.

| Enemy | Life | Damage | Move speed (units/s) | Windup / active / recovery |
| --- | ---: | ---: | ---: | --- |
| Hollow Stalker | 48 | 8 | 112 | 0.32 / 0.18 / 0.65 s |
| Gravebound Brute | 138 | 22 | 69 | 0.75 / 0.13 / 0.90 s |
| Mire Hexer | 56 | 13 | 82 | 0.65 / 0.15 / 0.70 s |

## Resource budgets

| Resource | Current bound |
| --- | --- |
| World terrain tiles / settlement blueprints | 48 / 32 cached entries |
| Rendered building cache / chart terrain cache | 24 buildings / 384 map tiles |
| Base procedural prop library | 161 sprite canvases; about 5.05 MiB of RGBA pixels when all variants are populated, excluding other art/GPU overhead |
| Combat particles / flashes / impact effects / damage labels | 650 / 22 / 24 / 35 |
| Sword ribbon / rendered corpses | 96 samples / 45 corpses |
| Lighting | 18 lights per pass; up to 4 lights casting shadows against up to 24 props; 24 cached light stamps |
| Audio | 96 voices maximum |
| Discovery | 8,192 chunks of 32×32 cells; 48 world units per cell; 4,096 POIs |
| Saved chart | 3,500,000 characters; discovery/map center bounded to ±48,000,000 world units |
| Single world request | Span ≤262,144 units; ≤65,536 prop cells; movement ≤4,096 units; collision radius ≤1,024 units |

Per-request limits prevent accidental huge enumeration; they are not a fixed map size. Cache eviction does not remove explored terrain from discovery. Storage capacity and numeric precision still make the implementation finite, despite its unbounded-generation design direction.

## Refactor and verification stats

| Metric | Before | After |
| --- | ---: | ---: |
| Passing code-level tests | 128 | 168 |
| TypeScript source modules (including review entrypoints) | 35 | 56 |
| Runtime source modules | 32 | 53 |
| Runtime TypeScript lines | 7,007 | 7,456 |
| `art.ts` entrypoint | 1,036 lines | 31 lines, with implementation split by responsibility |
| `main.ts` entrypoint | 400 lines | 27 lines, with application/input/DOM ownership separated |
| Runtime package dependencies | 0 | 0 |

The extra modules are smaller ownership boundaries; code size is a maintenance metric, not a quality score. There are **29 code-test files**, **3 static review entrypoints**, and **1 optional browser-test file** that was not run. The production JavaScript is approximately **190 kB raw / 65 kB gzip** using the stats script's gzip settings; the locally bundled font is separate.

`npm run check` passed: 168 tests, strict application compilation, browser-independent core compilation, and production build. The existing local in-app browser was inspected without driving gameplay. No deployment, remote repository, save reset, or gameplay tuning was performed.

Concrete fixes include bounded extreme-coordinate queries, immutable cached layouts, safe exploration boundary round-trips, correct full-capacity merge reporting, empty-corrupt-save protection, defensive POI copies, invalid grip/damage handling, bounded effect batches, world-aware scene caching, and cleanup of resources even if one teardown fails.

For the ownership map and extension instructions, see [implemented architecture](architecture.md). Run `npm run stats` after future builds to refresh the measurements.

## Subsequent interface checkpoint

The UI pass passes **177 code tests across 31 files**, strict/core TypeScript checks, and the production build. There are now **61 TypeScript modules**, including **4 static review entrypoints**; **57 runtime modules** total **7,686 lines**. Runtime dependencies remain zero. The current build contains **198.46 kB JavaScript / 68.13 kB gzip** and **19.27 kB CSS / 4.69 kB gzip**, using the stats script's compression settings, with the font separate.

Static in-app browser inspection covered start/pause/defeat windows, the world map, reusable components, desktop/narrow layouts, and pause keyboard focus. The user's playable tab was left untouched. See [interface kit](ui-kit.md) for extension guidance and the local review link. The foundation measurements above remain the historical before/after refactor record.
