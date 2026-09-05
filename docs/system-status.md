# System status and foundation checkpoint

2026-09-05 · local prototype · world generation 3 · character foundation 2 · weapon schools 1.

The engine foundation supports run-local character progression, one- and two-handed gear, shields, dual wield, inventory, tree allocations, and seventeen active skills through shared contracts and validated mutations. The large atlas reuses authored bonus families and is not a balanced endgame. Gameplay acceptance and performance on the user's machine remain separate from code verification.

## Current inventory

| System | Implemented today | Status / next boundary |
| --- | --- | --- |
| Combat | 120 Hz deterministic simulation; weapon-dependent basic attack, dodge, potion, and 17 unlockable/assignable skills; melee, arrows, elemental bolts, pierce, chains, blasts, timed areas, burns, slows, blocks | Rules tested; skill feel and balance await user feedback |
| Encounters | 3 enemy archetypes, progression-based mix, 5–10 target population, 12-enemy hard cap, 2 pack + 1 special simultaneous attack slots | Bounded prototype; large crowds need profiling |
| Experience / levels | Kill XP, increasing thresholds, overflow, live XP/level bar; 1 skill point and 5 attribute points per level | Run-local; no automatic spending, free refill, respec, or character saving |
| Equipment / stats | 4 attributes; one derived-stat path; 11 equipment slots, 10 kinds, 5 tiers, 17 general and 2 shield affix families; 13 weapon profiles and 3 shields; procedural worn art | One-/two-handed melee, dual wield, three bows and three elemental staves; no wands or unique legendary powers |
| Inventory / gear loot | 48 bag cells; 3-column character screen, comparison tooltips, drag/drop, Shift-click and button equip; seeded enemy gear drops and proximity pickup | Transactional item moves; no stash, trade, crafting, item deletion, or character persistence |
| Skill atlas | 2,824 connected nodes, 2,923 curved edges, 150 themed constellations, 3 domains, 9 weapon schools and 17 active-skill majors; winding paths, hybrid crosslinks, search and shortest-route preview | First/advanced school skills require 4/7 points from origin; authored bonus families repeat, with balance/content expansion ahead |
| World | 3 smoothly connected biomes; streamed 256-unit terrain tiles; deterministic roads, props and clear corridors | Tested generation; biome distribution is still a three-region prototype |
| Settlements / interiors | 5 building kinds; 8 buildings in Briarwatch; towns target 5–8, cities 12–16; shared doors/walls/furniture; roof fading and sanctuaries | Walkable layout foundation; no residents or service transactions |
| Maps / discovery | Smooth minimap, explored-world map, hover POIs; 7 registered POI kinds; chart persistence | Tested bounded storage; landmark kind is reserved for later content |
| Procedural art | Shared weapon/shield silhouettes for worn art and inventory icons; one-/two-handed, bow, staff, shield and dual-wield poses; enemy art and prop libraries; all generated in code | Held attack snapshots keep animation and weapon effects aligned |
| Lighting / effects | Dynamic lights/shadows, combat particles, blade ribbon, elemental projectiles, blast/chain/ground/block effects, burn/frost cues, synthesized audio, fixed CRT/soft phosphor | Bounded resources; performance has not been benchmarked in gameplay |
| HUD / application | Astral frames/orbs/XP; equipped-weapon basic attack + 5 assignable skill wells; separate potion/dodge; enabled C/I/T menus; skill costs/cooldowns/gear requirements; enemy focus plate and native text | New runs have empty skill slots; journal remains unavailable |
| Interface kit | Shared materials/icons/primitives across start/pause/defeat/map, character inventory, and skill atlas; native focus, tooltips, scroll regions, responsive layouts | Existing panels share the kit; static review is separate from gameplay |
| Lifecycle / tooling | Scoped teardown and startup rollback, HMR cleanup, strict/core compilation, dependency checks, reusable stats command | Foundation guardrails in place |

## Combat numbers

Player starts with **100 life / 100 mana**. The two-handed Weathered Sword deals **24 damage**, attacks **2 times/second**, reaches **60 world units**, and sweeps **135°**. The new run has no assigned skills or default right-click cast. Skills require allocating a major, assigning a slot, and compatible equipped gear. Attribute, gear, and tree bonuses affect real combat; the numbers here describe the unchanged starter equipment. Eight bag items include a one-handed sword, dagger, buckler, bow, and staff for immediate equipment testing. Dodge has **2 charges** with **1.8 s** recharge; flasks have **2 charges**, restore **42 life**, and replenish a charge every **8 kills**. There are **1 enemy projectile template** and **2 pickup types**. See [weapons and skills](weapons-and-skills.md) for all profile values, skills, effects, requirements, and formulas.

| Enemy | Life | Damage | Move speed (units/s) | Windup / active / recovery |
| --- | ---: | ---: | ---: | --- |
| Hollow Stalker | 48 | 8 | 112 | 0.32 / 0.18 / 0.65 s |
| Gravebound Brute | 138 | 22 | 69 | 0.75 / 0.13 / 0.90 s |
| Mire Hexer | 56 | 13 | 82 | 0.65 / 0.15 / 0.70 s |

## Resource budgets

| Resource | Current bound |
| --- | --- |
| Character bag / equipment / active skill slots | 48 cells / 11 slots / 5 slots |
| Projectiles / timed ground effects | 128 / 16 |
| Ground equipment | 96 items; auto-pickup within 30 units with line of sight |
| Skill atlas | 2,824 immutable nodes / 2,923 edges; culled, event-driven Canvas drawing |
| World terrain tiles / settlement blueprints | 48 / 32 cached entries |
| Rendered building cache / chart terrain cache | 24 buildings / 384 map tiles |
| Base procedural prop library | 161 sprite canvases; about 5.05 MiB of RGBA pixels when all variants are populated, excluding other art/GPU overhead |
| Combat particles / flashes / impact effects / damage labels | 650 / 22 / 24 / 35 |
| Skill area visuals / chain visuals | 20 / 24 |
| Sword ribbon / rendered corpses | 96 samples / 45 corpses |
| Lighting | 18 lights per pass; up to 4 lights casting shadows against up to 24 props; 24 cached light stamps |
| Audio | 96 voices maximum |
| Discovery | 8,192 chunks of 32×32 cells; 48 world units per cell; 4,096 POIs |
| Saved chart | 3,500,000 characters; discovery/map center bounded to ±48,000,000 world units |
| Single world request | Span ≤262,144 units; ≤65,536 prop cells; movement ≤4,096 units; collision radius ≤1,024 units |

Per-request limits prevent accidental huge enumeration; they are not a fixed map size. Cache eviction does not remove explored terrain from discovery. Storage capacity and numeric precision still make the implementation finite, despite its unbounded-generation design direction.

## Historical refactor and verification stats

The following checkpoints describe their state at the time. The current system tables above and the final checkpoint below supersede older content counts and boundaries.

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

## Astral skill-bar checkpoint

The live HUD has one basic attack, five unassigned skill wells, and separate potion/dodge shortcuts within the same compact Astral footprint. Right-click and 1–4 perform no action. Simulation and input no longer start or buffer default fireball casts; regression tests cover stale/direct cast input and normal attack, dodge, potion, and movement behavior. The current check passes **180 code tests**, strict/core compilation, and a production build. Gameplay feedback remains with the user.

## Experience checkpoint

Kills award 20 XP for a Hollow Stalker, 30 for a Mire Hexer, and 50 for a Gravebound Brute, once per death. The next level requires `100 + 50 × (level − 1)` XP. Overflow carries across levels; new runs reset to level 1 / 0 XP. At that checkpoint, combat stats remained independent of level; the character foundation below adds spendable rewards. The Astral HUD shows exact current/required XP plus level, with a smoothed violet rail and level-up pulse that respects reduced motion.

Verification: **190 code tests**, strict application/core compilation, and production build passed. Tests cover lethal-only and duplicate rewards, sanctuary despawns, overflow and multiple levels, run reset, HUD input bounds, animation convergence, and reduced motion. Static in-app previews cover desktop and narrow layouts; gameplay testing remains with the user.


## Character, inventory, and skill foundation

The three-column character window now connects the procedural doll, ten equipment slots, 48 inventory cells, item comparisons, four spendable attributes, and live derived combat stats. Equip/unequip and bag swaps validate before mutation, preserving gear even when replacing an item with a full pack. C/I opens this window; T opens the atlas. Both pause combat and clear buffered input.

The atlas has one free origin, 2,382 minor stars, 390 notables, and six active-skill majors across Might, Cunning, and Arcana. Each major is reachable in three points. Nodes reuse authored stat families and feed the same stat derivation as gear. Cleave, Lunge, Volley, Siphon, Nova, and Ember are implemented actions, unlocked through the tree and assigned to RMB/1–4. They share metadata with their UI, and cooldowns follow the skill when reassigned. New runs retain five empty skill slots.

Each level awards one skill point and five attribute points. Enemy gear is deterministic, with a guaranteed first-kill drop and 45% chance thereafter, capped at 96 ground items. Item levels, five tiers, affixes, procedural names/icons, and worn material variation are implemented. Nearby visible loot enters an empty bag cell; full bags leave loot on the ground. Four level-1 bag items allow equipment interaction immediately.

All character data and ground gear reset on a new run/reload; the separately saved exploration chart remains intact. There is no respec, stash, trading, crafting, item deletion, off-hand gear, wand attack, or character persistence yet. These are deliberate boundaries of this first increment. The six skills and generated bonus families need user gameplay/balance iteration.

Validation for this increment uses code-level rules/integration tests, strict/core compilation, a production build, and frozen in-app panel captures. No automated gameplay tests are run. **233 code tests pass**, along with strict/core type checks and the production build. The build contains 79 transformed modules, 277.36 kB JavaScript (95.08 kB gzip), and 42.71 kB CSS (9.51 kB gzip), with the local font separate. Frozen in-app captures verify the actual panels at the default 1280×720 viewport; the local game starts without console errors. See [character systems](character-systems.md) for formulas, content counts, ownership, transaction rules, and current limits.

## Organic atlas checkpoint

The lattice has been replaced by 150 irregular themed constellations and three winding progression arteries. The 2,788-node graph contains 1 origin, 1,528 constellation minors, 1,103 attribute travel nodes, 150 notables, and 6 active-skill majors. There are 2,878 curved edges and 47 additional circuit crosslinks, including mixed-discipline routes. All nodes are reachable; all six active skills remain three points from the origin. Twenty-one authored specialties supply the current bonus content.

The native-resolution painter uses engraved stat/skill icons, distinct medallion sizes, restrained regional colors, warm allocated paths, and zoom-dependent labels. Hovering or selecting a destination highlights its shortest additional-point route; the inspector reports the cost. Search keeps that route legible and dismisses results after a choice. The initial camera frames the starter branches, and All fits the full graph to the viewport. Graph, route calculation, glyphs, painting, and panel interactions have separate owners.

**240 code tests pass**, including graph connectivity, immutable content, node clearance, themed clusters, hybrid routes, allocation validation, and shortest-route correctness. Strict application/core compilation and the production build pass. The build has 82 transformed modules, 290.49 kB JavaScript (100.80 kB gzip), and 43.75 kB CSS (9.71 kB gzip), with the local font separate. [Three frozen in-app captures](captures/2026-09-05/organic-skill-tree/README.md) show the actual atlas at overview, regional, and detail zoom. The review reports no console errors; gameplay remains for the user to test. Character state remains run-local and resets on reload.

## Weapon schools checkpoint

Thirteen generated weapon profiles and three shield profiles now drive item generation, live equipment, icons, poses, basic attacks, and skill requirements. One-handed weapons support a shield or another one-handed melee weapon. Dual wield alternates each hand's own timing and damage. Bows fire arrows and elemental staves release free basic bolts; staff damage uses the spell multiplier once. Both-hand equipment changes are transactional, including full-bag failure cases.

Seventeen implemented skills occupy nine schools in the expanded organic atlas. These include melee sweeps, a continuous collision-aware lunge, stuns, shield guard, bow volleys/piercing/ricochets/arrow rain, and Fireball, Arc Lightning, Ice Nova, Frost Lance, Meteor, and Soul Siphon. Projectile payloads and melee attacks retain their weapon snapshot. Timed ground attacks have explicit pulse counts; burns, slows, hit-once chains, and actual-damage healing have simulation integration coverage. The HUD and tree explain incompatible gear without deleting assignments.

**295 code tests pass**, along with strict application/core compilation and the production build. Tests include every generated weapon's held geometry, dual-wield cadence, safe hand swaps, weapon gating, piercing and ricochets, wall collision, delayed areas, status expiry, shields, and healing edge cases. They caught and now prevent an extra burn tick at expiry. The build contains 88 transformed modules, **326.09 kB JavaScript / 112.89 kB gzip**, and **44.17 kB CSS / 9.81 kB gzip**, with the local font separate.

[Frozen in-app captures](captures/2026-09-05/weapon-schools/README.md) cover sword/shield, dual wield, recurve bow, storm staff, and skill requirements at the default 1280×720 viewport. All five review pages report no console errors. No browser gameplay was driven; combat feel and balance remain for the user to test. Character state still resets on reload, while chart discovery remains separate.
