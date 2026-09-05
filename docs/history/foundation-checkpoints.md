# Historical foundation checkpoints

Archived 2026-09-05. These are successive snapshots, not current status. Later sections superseded earlier ones even within this record. Counts, limitations and test totals below describe their original checkpoints. Use [current system status](../system-status.md), [roadmap](../roadmap.md) and [architecture](../architecture.md) for ongoing work.

## Living biomes visual pass

The forest motion system now covers all seven climates: shared traveling gusts, reactive grass, material-specific footsteps, moving canopy light, five bird silhouettes and three insect silhouettes. The Mire samples actual water for splashes; Frostpine leaves snow impressions; Emberfall adds ash and rock sparks; Amberwood lifts copper leaves; Highlands sheds windborne seeds. Mixed borders share one budget: 40 disturbances, 48 footprints, 100 particles, six birds, ten insects, 100 ground anchors and five shafts. Reduced motion freezes reactions; teleports and reset clear movement history. See [living biomes](../living-biomes.md).

All 423 code tests, strict application/core compilation and production build pass. Native Canvas staging inspected the actual renderer in all seven climates and two mixed borders, before the CRT pass and without gameplay ticks or saves. The earlier `/forest.html` browser recording remains available. Combat-load performance and the expanded motion in play remain for user testing. World generation and exploration namespace are unchanged.

2026-09-05 · local prototype · world generation 4 · character foundation 2 · weapon schools 1 · progression model 1 · wilderness encounters 1.

The engine foundation supports saved character progression, one- and two-handed gear, shields, dual wield, inventory, tree allocations, and seventeen active skills through shared contracts and validated mutations. The large atlas reuses authored bonus families and is not a balanced endgame. Gameplay acceptance and performance on the user's machine remain separate from code verification.

## Current inventory

| System | Implemented today | Status / next boundary |
| --- | --- | --- |
| Combat | 120 Hz deterministic simulation; weapon-dependent basic attack, dodge, potion, and 17 unlockable/assignable skills; melee, arrows, elemental bolts, pierce, chains, blasts, timed areas, burns, slows, blocks | Rules tested; skill feel and balance await user feedback |
| Encounters | 6 enemy archetypes, 3 ranks, biome-weighted mix; fixed geographic level; patrol/LOS awareness, flanking, ranged spacing, committed attacks and home return; 5–8 ambient target, 18-enemy hard cap, 2 pack + 1 special attack slots | Offscreen solitary/2–3-member groups need travel after startup; camps reserve 4 slots for roaming; visible births/removals suppressed; difficulty awaits user playtesting |
| Experience / levels | Source-level/rank XP, level-gap bonuses/penalties, increasing thresholds, overflow, live XP/level bar; 1 skill point and 5 attribute points per level | Fixed geographic danger; eight saved characters; no automatic spending or respec |
| Equipment / stats | 4 attributes; one derived-stat path; 11 equipment slots, 10 kinds, 5 tiers, 17 general and 2 shield affix families; 13 weapon profiles and 3 shields; procedural worn art | One-/two-handed melee, dual wield, three bows and three elemental staves; no wands or unique legendary powers |
| Inventory / gear loot | 48 bag cells; 3-column character screen, comparisons and transactional gear changes; rank loot tables, archetype/biome weights, source-level items, bounded percentage growth | No stash, trade, crafting, item deletion, or character persistence; long farming sessions need item disposal |
| Skill atlas | 2,824 connected nodes, 2,923 curved edges, 150 themed constellations, 3 domains, 9 weapon schools and 17 active-skill majors; winding paths, hybrid crosslinks, search and shortest-route preview | First/advanced school skills require 4/7 points from origin; authored bonus families repeat, with balance/content expansion ahead |
| World | 7 climates blended through a seeded two-dimensional field; streamed 256-unit terrain tiles; 23 prop families, deterministic roads and clear corridors | Tested seeds, boundaries and distribution; distinct climates now occur throughout the world |
| Wilderness sites / camps | Fixed 4-/6-member camps, watchtowers, graveyards, standing stones and caravans; shared geometry, decor and lighting | Camp member health/deaths survive streaming within the run; decorative landmarks have no interactions or chest rewards yet |
| Settlements / interiors | 5 building kinds; 8 buildings in Briarwatch; towns target 5–8, cities 12–16; shared doors/walls/furniture; roof fading and sanctuaries | Walkable layout foundation; no residents or service transactions |
| Maps / discovery | Smooth minimap, adaptive-detail world overview, decluttered hover POIs, revealed biome/area labels; 12 registered POI kinds; cleared camp markers/tooltips; chart persistence | Coarse samples require fully known discovery cells; world generation 4 starts a new exploration chart |
| Procedural art | Shared weapon/shield/armor silhouettes for worn art and inventory icons; actual item silhouettes on the ground; one-/two-handed, bow, staff, shield and dual-wield poses; enemy art and 23 climate prop families; all generated in code | Held attacks retain pose snapshots; prop collision, crowns, light and sway share metadata |
| Lighting / effects | Dynamic lights/shadows, combat particles, blade ribbon, elemental projectiles, blast/chain/ground/block effects, burn/frost cues, synthesized audio, fixed CRT/soft phosphor | Bounded resources; performance has not been benchmarked in gameplay |
| HUD / application | Astral frames/orbs/XP; equipped-weapon basic attack + 5 assignable skill wells; separate potion/dodge; enabled C/I/T menus; skill costs/cooldowns/gear requirements; enemy focus plate with iron/silver/crowned rank heraldry and native text | New runs have empty skill slots; journal remains unavailable |
| Interface kit | Shared materials/icons/primitives across start/pause/defeat/map, character inventory, and skill atlas; native focus, tooltips, scroll regions, responsive layouts | Existing panels share the kit; static review is separate from gameplay |
| Lifecycle / tooling | Scoped teardown, HMR cleanup, strict/core compilation, dependency checks, stats command, interactive local progression/loot study | Foundation guardrails in place; progression study uses actual runtime formulas |

## Combat numbers

Player starts with **100 life / 100 mana**. The two-handed Weathered Sword deals **24 damage**, attacks **2 times/second**, reaches **60 world units**, and sweeps **135°**. The new run has no assigned skills or default right-click cast. Skills require allocating a major, assigning a slot, and compatible equipped gear. Attribute, gear, and tree bonuses affect real combat; the numbers here describe the unchanged starter equipment. Eight bag items include a one-handed sword, dagger, buckler, bow, and staff for immediate equipment testing. Dodge has **2 charges** with **1.8 s** recharge; flasks have **2 charges**, restore **42% of maximum life**, and replenish a charge every **8 kills**. There are **2 enemy projectile templates** and **2 resource pickup types** (12% maximum life / 16% maximum mana). See [weapons and skills](../weapons-and-skills.md) for all profile values, skills, effects, requirements, and formulas.

| Level-one normal enemy | Life | Damage | Move speed (units/s) | Windup / active / recovery |
| --- | ---: | ---: | ---: | --- |
| Hollow Stalker | 48 | 8 | 104 | 0.42 / 0.18 / 0.78 s |
| Gravebound Brute | 138 | 22 | 65 | 0.95 / 0.18 / 1.20 s |
| Mire Hexer | 56 | 13 per bolt | 76 | 0.90 / 0.15 / 1.15 s |
| Briar Hound | 37 | 10 | 124 | 0.68 / 0.28 / 0.95 s |
| Ashen Ranger | 45 | 11 | 96 | 0.95 / 0.12 / 0.95 s |
| Lantern Wisp | 39 | 17 | 73 | 1.30 / 0.15 / 1.40 s |

Area danger rises one level per 3,200 units from the origin. Monster level and rank govern source stats, XP and item levels. See [progression and loot](../progression-and-loot.md) for the curves and loot tables, or inspect the shared values in the local `/progression.html` study.

## Resource budgets

| Resource | Current bound |
| --- | --- |
| Character bag / equipment / active skill slots | 64 cells / 11 slots / 5 slots |
| Projectiles / timed ground effects | 128 / 16 |
| Living enemies / ambient target / reserved roaming slots | 18 total / 5–8 ambient by area level / 4 slots unavailable to camps |
| Ground equipment | 96 items; auto-pickup within 30 units with line of sight |
| Skill atlas | 2,824 immutable nodes / 2,923 edges; culled, event-driven Canvas drawing |
| World terrain tiles / settlement blueprints | 48 / 32 cached entries |
| Climate region cache | 512 seeded region records; 2,400-unit region grid |
| Wilderness blueprint cache / camp run ledger | 128 cells / 1,024 camps, maximum 6 members each; later unrecorded camps remain dormant at ledger capacity |
| Rendered building cache / chart terrain cache | 24 buildings / 384 map tiles; at most 256 visible chart tiles; about 51 MiB raw RGBA if all cached tiles use the coarse road layers, excluding browser/GPU overhead |
| Chart detail levels / zoom | Nominal 768 / 1,536 / 3,072 world units per tile, coarsening further for large viewports; zoom 0.025–0.7 |
| Base procedural prop library | 257 surfaces maximum (48 three-layer living trees, 48 dead trees, 32 rocks, 32 grasses, one shrine); under 20 MiB raw RGBA, excluding browser/GPU overhead |
| Biome sprite LRU | 96 entries; 24 seeded variants per family; up to three surfaces per living tree; conservative ceiling 37.2 MiB raw RGBA (186×182×3 per entry), excluding browser/GPU overhead |
| Ground dressing / localized atmosphere | 96 stamps at 192×112 (7.88 MiB raw RGBA); one 240×80 mist stamp; at most 12 mist banks and 32 lily ripple anchors |
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

For the ownership map and extension instructions, see [implemented architecture](../architecture.md). Run `npm run stats` after future builds to refresh the measurements.

## Subsequent interface checkpoint

The UI pass passes **177 code tests across 31 files**, strict/core TypeScript checks, and the production build. There are now **61 TypeScript modules**, including **4 static review entrypoints**; **57 runtime modules** total **7,686 lines**. Runtime dependencies remain zero. The current build contains **198.46 kB JavaScript / 68.13 kB gzip** and **19.27 kB CSS / 4.69 kB gzip**, using the stats script's compression settings, with the font separate.

Static in-app browser inspection covered start/pause/defeat windows, the world map, reusable components, desktop/narrow layouts, and pause keyboard focus. The user's playable tab was left untouched. See [interface kit](../ui-kit.md) for extension guidance and the local review link. The foundation measurements above remain the historical before/after refactor record.

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

Validation for this increment uses code-level rules/integration tests, strict/core compilation, a production build, and frozen in-app panel captures. No automated gameplay tests are run. **233 code tests pass**, along with strict/core type checks and the production build. The build contains 79 transformed modules, 277.36 kB JavaScript (95.08 kB gzip), and 42.71 kB CSS (9.51 kB gzip), with the local font separate. Frozen in-app captures verify the actual panels at the default 1280×720 viewport; the local game starts without console errors. See [character systems](../character-systems.md) for formulas, content counts, ownership, transaction rules, and current limits.

## Organic atlas checkpoint

The lattice has been replaced by 150 irregular themed constellations and three winding progression arteries. The 2,788-node graph contains 1 origin, 1,528 constellation minors, 1,103 attribute travel nodes, 150 notables, and 6 active-skill majors. There are 2,878 curved edges and 47 additional circuit crosslinks, including mixed-discipline routes. All nodes are reachable; all six active skills remain three points from the origin. Twenty-one authored specialties supply the current bonus content.

The native-resolution painter uses engraved stat/skill icons, distinct medallion sizes, restrained regional colors, warm allocated paths, and zoom-dependent labels. Hovering or selecting a destination highlights its shortest additional-point route; the inspector reports the cost. Search keeps that route legible and dismisses results after a choice. The initial camera frames the starter branches, and All fits the full graph to the viewport. Graph, route calculation, glyphs, painting, and panel interactions have separate owners.

**240 code tests pass**, including graph connectivity, immutable content, node clearance, themed clusters, hybrid routes, allocation validation, and shortest-route correctness. Strict application/core compilation and the production build pass. The build has 82 transformed modules, 290.49 kB JavaScript (100.80 kB gzip), and 43.75 kB CSS (9.71 kB gzip), with the local font separate. [Three frozen in-app captures](../captures/2026-09-05/organic-skill-tree/README.md) show the actual atlas at overview, regional, and detail zoom. The review reports no console errors; gameplay remains for the user to test. Character state remains run-local and resets on reload.

## Weapon schools checkpoint

Thirteen generated weapon profiles and three shield profiles now drive item generation, live equipment, icons, poses, basic attacks, and skill requirements. One-handed weapons support a shield or another one-handed melee weapon. Dual wield alternates each hand's own timing and damage. Bows fire arrows and elemental staves release free basic bolts; staff damage uses the spell multiplier once. Both-hand equipment changes are transactional, including full-bag failure cases.

Seventeen implemented skills occupy nine schools in the expanded organic atlas. These include melee sweeps, a continuous collision-aware lunge, stuns, shield guard, bow volleys/piercing/ricochets/arrow rain, and Fireball, Arc Lightning, Ice Nova, Frost Lance, Meteor, and Soul Siphon. Projectile payloads and melee attacks retain their weapon snapshot. Timed ground attacks have explicit pulse counts; burns, slows, hit-once chains, and actual-damage healing have simulation integration coverage. The HUD and tree explain incompatible gear without deleting assignments.

**295 code tests pass**, along with strict application/core compilation and the production build. Tests include every generated weapon's held geometry, dual-wield cadence, safe hand swaps, weapon gating, piercing and ricochets, wall collision, delayed areas, status expiry, shields, and healing edge cases. They caught and now prevent an extra burn tick at expiry. The build contains 88 transformed modules, **326.09 kB JavaScript / 112.89 kB gzip**, and **44.17 kB CSS / 9.81 kB gzip**, with the local font separate.

[Frozen in-app captures](../captures/2026-09-05/weapon-schools/README.md) cover sword/shield, dual wield, recurve bow, storm staff, and skill requirements at the default 1280×720 viewport. All five review pages report no console errors. No browser gameplay was driven; combat feel and balance remain for the user to test. Character state still resets on reload, while chart discovery remains separate.

## Connected progression and loot checkpoint

Geographic danger now links the existing systems. Each 3,200-unit ring from the origin raises area level by one; biome and character level remain separate. Enemies capture their level, normal/veteran/elite rank, health, damage, XP, biome and loot seed at spawn. Moving them home, gaining a level, or killing their caster does not rewrite source stats or projectile armor context. The director uses area level and biome instead of accumulated kills.

XP grows with enemy level and rank, with a bounded reward bonus for higher-level targets and a penalty for trivial farming. The next-level curve grows from five same-level normal-Stalker equivalents at level one to about fifty at level fifty. Level rewards remain one skill point and five attribute points. Actual balance is still for playtesting; the comparison deliberately excludes builds, mixed packs, travel, and clear time.

Three explicit loot tables govern item count and rarity. Normal enemies have a 28% gear chance, veterans 70%, and elites one guaranteed item plus a 25% chance of a second. The first kill guarantees at least one item. Item level comes from the defeated enemy, plus zero/one/two levels by rank. Archetypes bias item kind; biomes bias weapon/shield profiles without excluding existing gear. Rolls use a separate source seed. Percentage gear growth tapers independently of flat damage/armor, source-level armor prevents passive mitigation inflation, and recovery scales with maximum resources.

Maps show area levels and sanctuaries; enemy plates show level and rank. The development-only [progression study](http://127.0.0.1:5173/progression.html) exposes the actual shared curves, equipment values and conditional loot probabilities. It runs no simulation and touches no saved progress. [Native in-app captures](../captures/2026-09-05/progression/README.md) show the overview, loot/level comparison, elite rewards, and ranked enemy plate. Inspected review pages report no console errors.

**319 code tests across 45 files pass**, including source snapshots, pre-award XP, full-rank loot yields, probability boundaries, percentage budgets, projectile-source armor, and scaled recovery. Strict/core TypeScript and the production build pass. There are 87 runtime TypeScript modules and no runtime package dependencies. The build contains **333.15 kB JavaScript / 115.32 kB gzip**, and **44.17 kB CSS / 9.81 kB gzip** (Vite compression report), with the font separate. The current numeric content ceiling is 1,000,000 levels; this is an implementation bound, not a validated infinite endgame. See [progression and loot](../progression-and-loot.md) for all formulas, probabilities and remaining boundaries.

## Wilderness, encounters and art checkpoint

Six enemy archetypes now have distinct silhouettes and tactics. Stalkers flank, Brutes commit heavy swings, Hexers release slow fans, Hounds pounce along a locked lane, Archers retreat and aim, and Wisps mark a delayed ground detonation. Patrols, line-of-sight awareness, camp alerts, lost-target memory and home return share a headless state machine. Warnings read the real attack timing, spread, travel distance and blast radius. Native target plates and small world badges share distinct normal, veteran and elite heraldry.

Five wilderness site types add camps, watchtowers, graveyards, standing stones and caravans, bringing the map registry to twelve kinds. Their immutable layouts drive art, collision, clear approaches and map discovery together. Crown-aware tree clearance keeps foreground foliage from hiding supplies and entrances. Camp groups preserve health, source stats, seeds and deaths on streaming; cleared markers read the current run without entering saved exploration. Ambient spawning respects camera bounds and camp footprints. The first four-member camp is east of the start at (740, 180); generated camps have six members. The 1,024-record ledger and capacity-delayed first-materialization limitation are documented in [progression and loot](../progression-and-loot.md).

Helmets, cuirasses and pauldrons now share forged geometry between equipped characters and inventory icons. Weapons and shields have material facets and engraving; ground loot uses actual equipment silhouettes. Existing hand attachments, two-handed support, bow draw and dual-wield rules remain intact. The four non-camp landmark types are environmental content today, without chests, quests or service interactions.

**350 code tests across 48 files pass**, plus strict application/core compilation and the production build. Coverage includes all six hover silhouettes, patrol/LOS/return, committed attacks and escape windows, ranged retreat, encounter caps, camp sleep/death/restore/priority, blocked entrances, canopy visibility, deterministic sites, and item/rig geometry. There are **93 runtime TypeScript modules**, **9 development review entrypoints**, and **zero runtime package dependencies**. Production output is **377.88 kB JavaScript / 131.09 kB gzip**, and **44.17 kB CSS / 9.81 kB gzip** (Vite report), with the font separate.

[Nine frozen in-app screenshots](../captures/2026-09-05/encounter-polish/README.md) cover rank plates, six creatures, equipped characters/items, all five wilderness layouts, and the wisp warning. Static inspection caught and corrected a helmet face layer, staff framing, two obstructed site approaches, hard soil edges and foreground canopy occlusion. No gameplay was driven; combat feel, difficulty and runtime performance remain for user playtesting. Exploration identity remains unchanged and no deployment or remote push was made.

## Seven-biome world and map overview checkpoint

Deadwood, Verdant Forest and The Mire now join Frostpine Reach, Emberfall, Amberwood and Hollow Highlands in a two-dimensional climate field. Normalized weights drive shared ground, light, map and vegetation transitions. Twenty-three prop families add snowy pines/crystals, charred trunks/basalt, autumn crowns/leaves, windswept trees/heather/limestone and richer existing-biome groundcover. Ground contacts respect road/town clearance; projected crowns also keep wilderness sites visible, and procedural sprites remain bounded by a dedicated LRU. All seven climates have explicit six-archetype encounter weights, camp rosters/palettes and positive gear-profile biases. Area, rank, XP and item scaling formulas are unchanged.

The large map now switches terrain detail as it zooms out, declutters POIs before hover testing and labels revealed biome regions. Coarse samples cannot expose unknown fine discovery cells. The [three-seed atlas review](../explored-atlas.md) uses the actual map with memory-only exploration; the [biome review](../biomes.md) stages actual world scenes and transitions through the renderer. Both export frozen PNGs without gameplay or saved-chart access.

World generation is now **4**. The altered climate geography starts a fresh exploration namespace; old generation-3 charts are not merged or migrated. Characters, gear and skill allocations remain run-local as before.

**369 code tests across 50 files pass**, together with strict application/core compilation and the production build. Coverage includes seven-biome determinism, normalization/continuity, seeded prop geometry and cache limits, all-climate encounter/loot contracts, canopy visibility, overview framing/fog/cache invalidation, road continuity and minimap detail. There are **112 TypeScript source modules**, **95 runtime modules totaling 13,316 lines**, **11 development review entrypoints**, and **zero runtime package dependencies**. Production output contains 100 transformed modules, **401.10 kB JavaScript / 139.83 kB gzip**, and **44.17 kB CSS / 9.81 kB gzip** (Vite report), with the local font separate. `npm run stats` now reports biome/prop counts, generation identity and the climate, sprite and chart limits from the actual registries.

[Static biome and atlas captures](../captures/2026-09-05/biome-atlas/README.md) show the generated world and explored-map samples; that capture record describes the rendering method and visual-review limits. No gameplay was driven. Combat feel, navigation and runtime performance remain for user playtesting.

## Natural roaming and hidden population checkpoint

Roaming encounters now use solitary enemies and loose groups of two or three, with biome-weighted leaders and suitable companions. Camps no longer consume the ambient target of five to eight enemies. The shared eighteen-actor cap reserves four slots from camp use. An initial five roamers populate hidden surroundings; further groups require 220–380 units of travel and a 3.2–5.8-second cooldown. Failed placements retry without spending earned travel, and elapsed time or zooming alone cannot refill cleared ground.

All automatic births and camp restorations wait for a valid camera envelope. That envelope includes the displayed frame, pending zoom, resize, camera follow, near-future travel and bounded impact movement. A shared body/effect margin protects complete groups at every screen edge. Camps validate every member before yielding population capacity. Visible or engaged actors remain; only hidden inactive foes can retire or sleep, without XP or loot. Sleeping camps preserve their original wounds, deaths and source identities. The earlier visible camp-activation exception is removed.

**400 code tests across 53 files pass**, along with strict application/core TypeScript checks and the production build. Regression coverage includes seeded headless travel, forward placement, narrow and ultrawide cameras, full-group geometry, pending zoom/resize/dashes, construction/reset ordering, camp activation/restoration, travel pacing, shared budgets, pursuit protection and source rewards. There are **97 runtime modules totaling 13,536 lines**, **11 development review entrypoints**, and **zero runtime dependencies**. Production output contains 102 transformed modules, **406.32 kB JavaScript / 141.57 kB gzip** and **44.17 kB CSS / 9.81 kB gzip** (Vite report), with the font separate. The stats command now distinguishes roaming targets, reserved slots and the shared hard cap.

The local development server remains available. No browser gameplay was driven; encounter density and pacing await the user's playtest feedback. World generation stays at 4 and exploration charts are retained.


## Combat expansion foundation checkpoint

The first three expansion recommendations are implemented. `combat-damage.ts`, `combat-rewards.ts`, `combat-status.ts` and `ground-effects.ts` own contact/death commitment, source-level rewards, status reapplication/ticking and snapshotted timed attacks. `enemy-state.ts` supplies common transitions without coupling those modules to AI decisions. Simulation retains its explicit fixed order, state and random/identity ownership, and shrinks from **712 to 616 lines**.

Seventeen skills now select from nine typed execution kinds. Frozen recipes centralize arcs, radii, projectile speeds, durations, stun/slow/burn potency, chain limits and falloff. Numeric descriptions, guard readouts, damage-per-wave labels and timed warning footprints read the same content. New variants can reuse a handler; new behavior kinds require an exhaustive implementation. Projectile and ground effects capture their payload at release. Shared status operations preserve strongest strength/longest duration without additive stacking or resetting accrued burns.

`CombatEvent` is a discriminated union with required per-event payloads. Hits need identity, resulting health, direction and critical state; chains need destinations; ground warnings need geometry, timing and skill. Renderer, effects, audio and focus narrow those types instead of guessing omitted required values. Compile-only negative contracts reject malformed events, commands and recipes.

`executeCharacterCommand` owns validation, transactional sheet mutation and immediate stat/equipment projection refresh for equip, unequip, bag moves, attribute/node allocation and skill assignment. UI callbacks send commands and refresh their presentation after success. Failure preserves the full character; increased resource maxima never refill current life/mana. Existing lower-level sheet operations remain the implementation of these transactions and tools for constructing test fixtures.

**411 code tests across 56 files pass**, plus strict application/core TypeScript and a production build. New coverage protects command success/failure, automatic projection refresh, hand conflicts, cooldown-preserving assignment, status reapplication/expiry/death, content immutability and nested ground-payload snapshots. A one-time headless comparison against checkpoint `fad5f4a` matched actor/projectile/item/pickup state, resources, rewards and events for **64,800 fixed ticks across 18 scenarios**, covering basic combat and all seventeen skills. This is evidence for the tested refactor, not a permanent requirement to preserve old behavior or a performance benchmark.

There are **104 runtime modules totaling 13,757 lines**, **11 development review entrypoints**, and **zero runtime dependencies**. Production output contains 109 transformed modules, **409.38 kB JavaScript / 142.63 kB gzip**, and **44.17 kB CSS / 9.81 kB gzip** (Vite report), with the font separate. Gameplay tuning, spawn budgets, world generation and saved exploration are unchanged. The local server remains available; no browser gameplay was driven. Performance profiling and larger-population work remain a separate next step. See [architecture](../architecture.md#adding-combat-behavior-after-the-expansion-refactor) for extension rules.

## Current checkpoint: character hall and saves

Supersedes the run-local persistence limitations in earlier checkpoint notes above. The game now opens a forest-backed eight-slot character hall. Name/create, continue and confirmed delete are implemented, with actual equipped previews and derived power. Checkpoints preserve character progress, resources, position, ground gear and defeated camp members; charts are separate per character. New characters have identical basic leather gear, the weathered sword and 64 empty inventory slots. Saving is local to the browser, with autosave, last-good backups, whole-payload validation and stale-tab protection. Live encounters and in-flight combat are rebuilt on continue. See [character saves](../character-saves.md).

### Roaming density refinement

Roaming targets are now 9–14, with 24 total actors and nine slots reserved from camps. After nine initial roamers, groups require 180–280 units of travel and a 2.2–3.8-second cooldown. Forward placements use a fixed-width travel corridor instead of wide angular scatter; lead beyond the padded camera/group bounds is 30–90 units. Births remain wholly offscreen, sanctuaries stay protected, and stationary players do not trigger endless refills. Concurrent attack/rank caps are unchanged.
