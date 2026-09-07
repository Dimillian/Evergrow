# Current system status

## Basic caster motion · 2026-09-07

Staff basics lift vertically with both hands attached; wands use a compact casting flick. Bolt cores, lights and release sparks use a frozen animated-tip launch pose, easing onto the existing aimed flight plane without changing collision, range, mana or cadence. Projectile wakes grow on release. Static casting stages are available in the weapon-light study. See [weapon rules](weapons-and-skills.md).


## Held elemental light and melee enchantments · 2026-09-07

Staves/wands and offhand orbs/grimoires now cast type-colored, rig-anchored lights. Caster cores stay bright after world darkening; two held sources share the existing 18-light cap and dungeon clipping. Kindling/Rime/Stormbound are mutually exclusive ordinary melee affixes with real flat added damage, weapon-local scaling, elemental engravings/sheaths/trails and impact/death feedback. Generation, services, previews and save validation share the recipe; no save reset. `/weapon-lights.html` is the frozen crypt gallery. Checkpoint verification: 828 code tests and production build passed. See [weapon rules](weapons-and-skills.md).


The character-editor rebase onto upstream `91b3279` passes 817 code tests, strict application/headless compilation and the production build. Its [25-image screenshot gallery](captures/2026-09-07/character-editor/README.md) includes desktop/phone UI, all procedural parts and six frozen world-rendered looks. Hall/inventory portraits preserve tint and helmet projection, and tint materials retain the hex format required by downstream shading.

Updated 2026-09-07 after rebasing the character editor onto the upstream pause-menu, ground-loot and destructible-container updates. **Playable local prototype; unreleased.** This is the current implementation summary. Earlier snapshots live in [historical checkpoints](history/foundation-checkpoints.md); planned work lives in the [roadmap](roadmap.md).

[Character appearance](character-editor.md) is integrated in creation and inventory with shared world/portrait rendering. Save v4 requires the appearance recipe; valid pre-editor v3 characters migrate automatically with the default look, preserving progress.

## Implemented systems

| System | Current implementation | Remaining boundary |
| --- | --- | --- |
| Characters and saves | Compact eight-slot hall, six starters, level/power summaries and Continue/Create; local worker saves, portable character/chart import/export; Site-only Cloud / Local tabs with authenticated D1/R2 publication and a durable recovery outbox | Cloud deployment succeeded; real sign-in/cross-browser acceptance remains a player check; Android remains local-only; pre-editor v3 appearance migrates to v4 |
| Combat | Deterministic 120 Hz simulation; weapon basics, five assignable active slots, dodge, dual potion; 20 executable skills; melee/bow attack speed and independent staff/wand/magic cast speed | Player tests feel and balance; no automatic combos or default assigned spell |
| Aiming and input | Swept ranged contacts, directional touch/controller target assistance with bounded prediction, cursor-local mouse assistance, aim feedback; standard gamepad analog movement/aim, combat bindings and menu navigation; neutral rearm and disconnect pause | Fixed Xbox-position labels; text entry, drag/drop and gameplay zoom still use keyboard/mouse; controller hardware/feel acceptance remains with the player |
| Android / AYN Thor | Bundled offline APK, native controller adapter, hardware-accelerated game WebView capped at 60 FPS, secondary map/64-cell pack/build UI and validated shared commands | Local debug distribution; app/browser saves separate; physical gameplay and sustained performance are user-tested; see [Android/Thor](android-thor.md) |
| Touch gameplay/UI | Analog movement and independent aim, five skill controls, utilities, touch menus; tap equipment actions; map/tree pan-pinch; native editing and cancellation across phases | Physical-device combat feel, thumb reach and sustained performance await user acceptance; see [touch controls](touch-controls.md) |
| Enemies | Eight archetypes, three ranks, patrol/LOS, flank/pounce/ranged/area patterns, home return; hound patrol arrival; goblin rush/surround commands and leader-death morale | Hollow Warden adds a ninth, dungeon-only archetype; deeper elite modifiers remain future work |
| Enemy deaths | Four articulated death recipes for all nine enemy kinds (36 total), one random choice per kill, solid body parts and separate humanoid/hound/wisp rigs; shared `/deaths.html` review | Authored motion; neutral silhouette handoff, no physics ragdolls or terrain-aware corpse collisions; player visual acceptance pending |
| Spawning | 16–24 ambient target, 48 living actors total, sixteen slots reserved from camps; sixteen initial roamers, packs of 4–6, then travel/cooldown-driven groups; births fully offscreen | Larger populations need profiling; waiting on cleared ground does not refill it |
| Progression | Fixed geographic danger, source-level rewards, XP level-gap factors, unchanged thresholds through level 4 and a rising post-intro premium, one skill and five stat points per level | Numeric level bound 1,000,000; not a balanced infinite endgame |
| Equipment | Twelve kinds, five rarities, eleven slots; 17 generated weapons, 3 shields and 6 caster foci; shared affixes with curated caster rolls; visible procedural gear | Recipe-based +10 enhancement and enchanting; no unique legendary powers |
| Inventory | 64 cells, three columns, subtle title-row Sort & filter / Equip Best icons; compact filtering popover and three-choice weapon-type warning; double-click/keyboard equip; LB/RB section switching and highlighted controller navigation | Equip Best uses item power; weapon changes require a choice, keeping the current weapon still upgrades other gear; no stash or manual ground disposal |
| Skill atlas | 2,185 nodes, 3,047 edges, 150 passive constellations + 12 development groups, three domains, nine schools; short cross-connected routes, hover stat previews, search/filters, double-click and atomic path allocation | Reused authored bonus families need balancing; no respec |
| Gold and loot | Independent gear/gold rolls; physical saved coin piles, magnet pickup, wallet in HUD/inventory; corrected common-heavy loot tables; individual named ground items | Purchases, enhancements and enchanting provide gold sinks; affordability awaits playtesting |
| World | Seven blended biomes, 23 prop families, seeded roads/rivers/lakes, water-aware settlements, streamed terrain and climate-specific environmental life | Finite coordinate/cache/save bounds; no weather or multi-site quest chains |
| Towns and interiors | Stable generated towns/cities, five building kinds, furnished walk-in interiors, roof fading and protected sanctuaries | Three procedural service NPC roles, nearby click/E interaction and pause-safe workbenches |
| Town economy | Blacksmith equipment shop, jeweler jewelry stock, 12-item buyback, guaranteed +10, rarity upgrades, single/all-affix rerolls and geographic relevel | Deterministic stock refresh at levels 4/7/10…; initial prices require player balance feedback |
| Town portal | Free three-second P channel, home-town anchors, saved single-use return endpoint, safe landing, native control/map markers and arrival protection | Permanent waypoint network and map travel remain specified |
| Camps and landmarks | Four-/eight-member camps plus 10–15-goblin warbands with a ranked chief; watchtowers, graveyards, standing stones and caravans; camp casualties persist with the character | Strongboxes, caravan choices, beacons, reliquaries and guardian trials implemented |
| Dungeons | Rootbound Crypt: 13 rooms, two treasure chambers, persistent Warden, floor chart, fixed level, town/death returns, atomic chest rewards, worn contours and wall-occluded torch/orb illumination | One theme/floor, 24 living actors; exhausted floors retire to exact receipts, unfinished rewards remain |
| Journeys | Local Recommended/Nearby guidance, compact mini log, J journal, fixed tracked targets, natural completion XP with saved receipts, celebration UI and fog-safe markers | Awaiting player testing; initial bonus XP tuning; no regional chains or milestone memory; see [Journeys](journeys.md) |
| Maps | Smooth 0.05-scale minimap; 600-unit normal discovery radius; explored atlas with POI hover, conservative fog and per-character chart saves | No waypoint travel; 720 units is the reveal API ceiling, not the normal reveal radius |
| Water | Descending drainage networks, local cell-based waves, footsteps/impact splashes, refracted shallows, distorted reflections and shader highlights | Traversable water; no swimming, flooding, erosion or boats; see [living water](living-water.md) |
| Presentation | Procedural equipment/world art, layered trees, wind/wildlife, dynamic lighting, fixed restrained CRT/phosphor; readable native UI, enemy rank plates, animated deaths and fading remains | Hardware performance and visual acceptance remain separate from code checks |
| UI foundation | Astral HUD, shared compact windows, consistent tooltip motion and item components; centralized panel lifecycle; point badges and compact notifications | Service panels reuse these components; equipped gear is separate and first |
| Enemy battle barks | Ashglass overhead bubbles; 20 lines each for seven humanoids, 30% engagement chance, four-second admission window, 2.8-second lifetime, maximum three visible and shared spacing; no gameplay RNG or save state | Live encounter verified after reducing excessive suppression; [guide](battle-barks.md) |
| Notifications | Separate named item cards, level/point gains, discovered POIs and debounced biome entry; gold accumulates at its HUD counter, XP animates toward its rail; level and Journey completion use shared celebrations | No duplicate gold/XP feed cards |

## Starting character and core rules

Every new character begins at level 1, 0 XP and 0 gold, with ten of each attribute, no unspent points, only the free tree origin allocated, five empty skill bindings and 64 empty bag cells. The same worn leather outfit accompanies the chosen common starter weapon. Starter armor currently has no implicit/affix stat bonuses. The default is Longsword + Iron Buckler; Two-handed Sword, Wand + Grimoire, Fire Staff, Shortbow and Longbow are the other starter choices. Shared profiles determine their damage and cadence. See [character systems](character-systems.md) and [weapons and skills](weapons-and-skills.md).

Base life and mana are 100; mana regenerates at 1/second before bonuses. Q restores 42% maximum life and 40% maximum mana together, with two charges and a charge recovered every eight kills. Melee/bow basics cost no mana; staff basics cost four and wand basics two before reductions. First-row skills have no cooldown but still pay mana and obey action recovery; second-row skills cost more and have cooldowns. Attack speed, cast speed, mana-cost reduction and cooldown reduction remain distinct stats.

Generation 6 retains named irregular danger districts: levels follow road travel and remoteness, with higher-level wilderness pockets. Towns are distributed in two dimensions and climate regions are 6,400 units apart. See [world generation](world-generation.md). Enemies retain spawn-time level/rank/stats/reward context. Gear rarity probabilities are conditional on an item dropping: normal enemies yield 75% Common / 22% Magic / 2.7% Rare / 0.28% Epic / 0.02% Legendary. The complete rank tables and growth formulas live in [progression and loot](progression-and-loot.md); the general item generator's default weights are not enemy drop rates.

## Current consolidation

[World-state longevity](world-state-longevity.md) removes the old lifetime gates for camps, events, expeditions and Journey completions. Sleeping camps use a 32-garrison actor cache with exact death/wound storage. Exhausted floors and old completed POIs compact without regenerating rewards. A character payload remains bounded to 8,388,608 string code units; explored-chart and commerce limits still apply. This is not infinite persistence and needs long-session profiling before larger populations.

`JourneyController` owns runtime guidance/search/markers; `LocationController` owns travel orchestration with persistence-before-arrival ordering. Game retains application lifecycle and shared input/camera hooks. Current IndexedDB characters continue without a reset.

## Next work

- [ChatGPT cloud saves on Sites](cloud-saves-sites.md): implemented and deployed on the public Site; sign-in, per-user eight-slot roster, same-revision character/chart bundles and conflict protection.
- Player acceptance of current progression, density, Journey rewards, touch controls and economy.
- Region-paged world/chart persistence and measured long-session Safari performance.
- More enemy/elite mechanics, dungeon themes and build identity after those foundations; permanent waypoint travel and respec remain unimplemented.

## Verification and history

The Journey/difficulty checkpoint `7398e4c` delivered Journey guidance, higher post-intro XP thresholds and denser/harder encounters, with 673 passing code tests plus application/headless type checks and production build. Subsequent shared touch/UI checkpoints are included in the tested tree. The earlier consolidation passed 713 code tests, strict application/headless TypeScript and production build; details are in [world-state longevity](world-state-longevity.md).

Older implementation counts, save formats, bounds and delivery notes are preserved in [the pre-consolidation snapshot](history/system-status-before-longevity.md). Those numbers are historical, not the current runtime contract. Use `npm run stats` for current source/content counts. Gameplay and browser performance remain user-tested.

Android frame-pacing checkpoint: 725 passing code tests, application/headless type checking, web production build and Android APK assembly. Installed on the connected AYN Thor. Main display confirmed at 60 Hz; lower display firmware retains 120 Hz despite the app request. Combat remains fixed at 120 Hz. Static second-screen layout was reviewed at its logical display size.

Cloud/hall checkpoint: 735 code tests passed; focused save tests rerun after final persistence changes. Application/headless types, normal web build, Android APK and Site Worker/client builds pass. Live cloud authentication and visual/controller acceptance remain to be verified with the player.

Current stats: 232 runtime TypeScript modules / 25,656 lines; 96 code-test files; 24 development review entrypoints; zero runtime dependencies. Content: seven biomes, nine enemy archetypes, 20 active skills, 2,185 skill nodes and 17 POI kinds. Source counts come from `npm run stats` at this checkpoint.

Thor controller checkpoint: 21 focused controller/skill tests passed, including select-field escape and single-press node-action routing. Application/headless type checks and Android APK assembly passed. The compact inspector was reviewed in the in-app browser at 832 × 468. Installed over the existing Thor package without clearing data; app launch succeeded with no observed startup errors. Gameplay/controller feel remains player-tested.

### Handheld optimization checkpoint — September 6

Native-density static HUD chrome caching avoids rebuilding metalwork every frame. Thor skips map rasterization/PNG transfer behind Pack, Build and item details. Touch/controller directional assistance respects action reach, visibility and manual ground targeting. Routine checkpoints run every 20 seconds, cloud outbox batches at 30 seconds with explicit flushes; immediate local transactions remain unchanged. Cloud cadence awaits the next requested Site deployment.

Android checkpoint stats (historical): 227 runtime TypeScript modules / 25,154 lines; 95 code-test files; 24 development review entrypoints; zero runtime dependencies. Content: seven biomes, nine enemy archetypes, 20 active skills, 2,185 skill nodes and 17 POI kinds. Source counts come from `npm run stats` at this checkpoint.

Initial Ashglass battle-bark checkpoint (historical): 747 passing code tests, application/headless type checks and production build. The 15 bark tests cover content, encounter policy, cleanup, projection/occlusion and gameplay RNG isolation. Static in-app model review has no console warnings/errors; combat feel remains user-tested. Source stats at that checkpoint: 240 runtime TypeScript modules / 26,378 lines, 97 code-test files, 24 development review entrypoints and zero runtime dependencies. No save reset.

Battle-bark switch follow-up (historical): `GAME_FEATURES.battleBarks` is an app-wide boolean, default true; false clears and suppresses all gameplay/review speech without a settings UI. The goblin now says “Your plan was to win?” in place of its former gutting threat. Verified 749 code tests, application/headless type checks and production build. Source stats at that checkpoint: 241 runtime modules / 26,390 lines, 97 code-test files, 24 review entrypoints, zero runtime dependencies.

Battle-bark playtest follow-up (historical): successful greetings now have four seconds to find safe space; encounter chance is 25% and lifetime 2.8 seconds. Brief obstruction no longer deletes active speech; bare branches and faded foliage no longer blanket-hide speakers. The three-slot cap, shared spacing, global off switch and independent RNG remain. Live seed-7319 encounter visibly verified a naturally rolled Stalker bark. Verified 752 code tests, application/headless checks and production build; no save reset.

Battle-bark readability follow-up (historical): speech lasts four seconds and draws over damage numbers. Damage popups no longer reserve bark placement space; the three-bubble cap and other visibility rules remain. Verified 20 bark tests after updating duration expectations, application/headless checks and production build. The other 732 code tests passed in the full suite. No save reset.

Battle-bark duration correction: restored the requested 2.8-second lifetime while retaining speech over damage numbers. Rebased the bark branch onto upstream/main at 1978bf9, preserving the merged death animations and newer HUD/save changes. Verified all 779 code tests, application/headless type checks and production build. No save reset.

Battle-bark PR checkpoint: encounter chance increased to 30%, keeping the 2.8-second lifetime, three-bubble cap and speech over damage numbers. Review timing labels now consume shared runtime rules. Captured the current real-model study for the PR and verified all 779 code tests, application/headless type checks and production build. No save reset.

### Breakable containers · 2026-09-07

Crates and barrels in wilderness sites and buildings now break from player attack contacts, emit bounded procedural debris, and sometimes drop physical gold. Shared collision, immutable scenery rendering and saved destruction receipts agree; returning or reloading cannot pay them twice. See [progression and loot](progression-and-loot.md#breakable-containers).

### Shared material responses · 2026-09-07

Seven immutable material recipes now drive containers, combat contacts, scenery impacts and elemental deaths. Wood, stone, metal, ice, bone, glass and embers share bounded fragments, motion, light and sound textures. Physical death variants and reward/save ownership stay unchanged. See [material responses](material-responses.md).

### Equipment identity and elemental hybrids · 2026-09-07

Slot-specific weighted affix pools now drive drops and enchanting, with stronger specialist rolls and rare melee enchantments. Sword + wand supports offhand magic skills; physical and added elemental damage scale separately through Strength/attack and Intelligence/spell bonuses. Fire burns, frost chills and lightning interrupts through shared contact rules. Existing saves remain loadable. See [equipment affixes](equipment-affixes.md).

Affix/hybrid checkpoint verification: all 836 code tests pass, including weighted generation/rerolls, specialist bounds, sword + wand save/casting/aim checks, and snapshotted elemental statuses. Application/headless TypeScript and production build pass. Combat feel remains player-tested; no Site or Android deployment in this checkpoint.

Sword/wand follow-up: mixed one-handed basics now alternate one action per click (or sequentially while held), with independent weapon speed, mana cost and release. Next-hand HUD/aim assistance and offhand wand-tip launch share the same selection. Unaffordable wand turns wait without skipping or firing both hands.

Enemy debuff HUD: target and boss plates now show compact Burn/Chill/Stagger indicators and actual remaining durations. Shared projection hides expired/dead effects; narrow layouts retain icons/timers, and the boss resistance note clears the row. Verified 19 focused status/focus/layout tests plus application/headless checks and production build.

### Spell anticipation and aftermath · 2026-09-07

Shared animated warnings cover enemy sectors, projectile/pounce lanes, Warden fractures and player ground skills, using actual combat geometry and the bounded scene light pass. Live ground presentation replaces independent warning lifetimes. Meteor/Cataclysm now descend visibly, explode with stone/ember material responses, and leave four seconds of tunable non-stacking burning ground. Arrow rain, frost fields, Tempest and elemental blast materials share this treatment. No save reset; local gameplay/visual tuning remains player testing.

Checkpoint verification: 847 code tests pass; application/headless TypeScript and production build pass. Material budgets remain 48 bursts / 384 fragments; total scene lights remain capped at 18.
