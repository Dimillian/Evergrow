# Current system status

Published in v0.3.15, 2026-09-12: cloud creation rejects unresolved empty slots; every cloud deletion awaits server confirmation while retaining device recovery. Legacy Chronicle recovery is independent of gameplay validation, and explicit deletion can clear unreadable legacy slots. Gameplay save status is specific to the active character. No automatic reset or individual account edits. See [cloud recovery and deletion](cloud-saves-sites.md#cloud-recovery-and-deletion--september-12-2026).

Local, 2026-09-11 follow-up: wider affix quality (0.65–1.35×), tapered equipment-rank damage, per-cast repeated-hit budgets for fans/barrages, corrected authored fire burns, and gradual elite durability above home levels. [Measurements and remaining limits](loot-quality-and-combat-2026-09-11.md). Not yet published.


Local, 2026-09-11: Strength and Intelligence now each grant 1.5% damage per added point; their equipment/charm rolls and jewelry implicits taper. Enchanters offer one free attribute refund. Existing items update on validated load. The repeat audit shows substantially lower hits but remaining skill-driven elite burst; see [offensive attribute follow-up](offensive-attribute-balance-2026-09-11.md). Not yet published.


Local, 2026-09-10: Enchanter skill resets cost 25 gold per refunded point. Settlement expedition tables unlock ten-stage saved dungeon routes at level 20, with forks, stage modifiers, death resets and an Epic/Legendary-weighted final chest. Six dungeon themes share distinct entrances and interiors; three new styles also appear in the wilderness. See [Expeditions and respec](expeditions.md). Not yet published.

Local settlement rework · generation 10 (2026-09-09): three settlement tiers, outdoor starting refuges without houses, families, gambling and personal storage. Generation-9 characters upgrade on Continue, preserving progression and exploration. The original save is retained until the upgrade commits. See [Settlements](settlements.md). Earlier generation/layout statements below describe the prior checkpoint.
Local, 2026-09-08: bounded regional scaling connects ordinary −1/+1 encounters, ranked +1/+2/+3 threats, saved camp/trial/dungeon baselines, source-level rewards, vendors, map ranges and onward Journey guidance. All event families are eligible from level one. Generation-9 saves remain compatible. See [regional scaling](region-scaling.md). This pass is not published.

Published in v0.6.0, 2026-09-08: Cloud character file import/download are removed from the hall and cloud repository. Local browser transfers remain available. Existing saves are preserved; all Cloud characters automatically rank individually in the new home leaderboard. Character names, levels and equipped gear power are public; account identities remain private. Characters, Chronicle, Leaderboard and What’s new share home navigation. See [home and rankings](leaderboard.md). Competitive validation remains future work.

The v0.6.0 regional monster expansion adds six biome-weighted archetypes, mixed packs, two-basic/one-signature attack cycles, procedural anatomy and matching remains. See [regional monsters](regional-monsters.md) for combat and spawn weights. Existing characters remain compatible.

The v0.6.0 wilderness boss lairs add Briar Matriarch, Ashbound Colossus and Grave Marshal, each guarded by two Elites and eight Veterans. Sparse additive placement preserves existing POIs and saves. Red warnings, phase-two cadence, automatic rare hoards, map/Journeys discovery and three Chronicle families are implemented. See [wilderness bosses](wilderness-bosses.md).

Local vendor polish adds multi-select selling and rarity selection, an exact receipt, atomic bulk transactions, and pickup-style coin flights into the wallet. Existing 12-item buyback stays bounded. See [vendor rules](npcs-and-vendors.md).

Chronicle is published in v0.5.0: account/character histories, 32 achievement families, detailed statistics and title/pause/inventory entry points. The matching cloud API/schema deployment succeeded; cross-device acceptance remains a player check. See [Chronicle](chronicle.md).

## Natural landscapes · v0.4.0, 2026-09-07

Generation 9 is enabled in local gameplay: nine biomes, clustered trees and rock outcrops, open glades, Steppe grassland and Sunscar sand formations. Each seed chooses a starting biome and a generated home town/city; a dry southern approach, level-one start and initial home portal remain guaranteed. Gameplay, maps, hydrology and terrain workers share the generator. Fresh characters required; older saves are preserved but incompatible. Included in the v0.4.0 release source. See [natural landscapes](natural-landscapes.md).

## World expansion · local, 2026-09-07

Generation 7 adds six regional POIs and cursed chests, recipe-driven assault/defense/seal/timed events, scored ninety-second waves, shared chest opening/loot-flight presentation, road-facing placement and branching 13–19-room crypts. Actor, rank and archetype count caps are removed; hidden admission and travel pacing remain. Fresh test characters required. [Rules and rewards](interactive-pois.md). Included in the v0.4.0 release source.

Checkpoint verification: 904 code tests pass, along with strict type checking and the production build. Event difficulty and pacing await player testing.

## Equipment materials · v0.3.3, 2026-09-07

196 profile/material combinations share real loot, vendor and upgrade recipes. Common foundations dominate; silver, gold and crystal are rarer bases with stronger implicit stats, independent of affix rarity. No save reset. [Rates and rules](item-materials.md).


## Player changelog · 2026-09-07

The character hall now opens a dated What’s new panel with New/Tweaks/Fixes sections, historical development recaps and controller/touch/keyboard navigation. `CHANGELOG.md` is its single bundled source. The release workflow requires committed, refreshed player-facing notes before each Sites publication. This panel does not access saves. See [release workflow](releases.md).

## Skill-owned specialization leaves · 2026-09-07

All 20 skills have three implemented selectable variants (60 total). Each skill has three independent, three-point leaves with two skill-specific improvements before each specialization. Shared hover/details name the owning skill and separate effects/costs/unlock state. All 864 code tests and production compilation/build pass. Old school-specialization paths have been removed; characters invested in them may require a fresh test character. See [skill progression](skill-progression.md).

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
| Spawning | No actor-count, rank or archetype cap; sixteen initial roamers, packs of 4–6, then travel/cooldown-driven groups; births fully offscreen | Larger populations need profiling; waiting on cleared ground does not refill it |
| Progression | Fixed geographic danger, source-level rewards, XP level-gap factors, unchanged thresholds through level 4 and a rising post-intro premium, one skill and five stat points per level | Numeric level bound 1,000,000; not a balanced infinite endgame |
| Equipment | Twelve kinds, five rarities, eleven slots; 17 generated weapons, 3 shields and 6 caster foci; shared affixes with curated caster rolls; visible procedural gear | Recipe-based +10 enhancement and enchanting; no unique legendary powers |
| Inventory | 64 cells, three columns, subtle title-row Sort & filter / Equip Best icons; compact filtering popover and three-choice weapon-type warning; double-click/keyboard equip; LB/RB section switching and highlighted controller navigation | Equip Best uses item power; weapon changes require a choice, keeping the current weapon still upgrades other gear; no stash or manual ground disposal |
| Skill atlas | Published 875-node, 932-edge six-territory map; 90 specialties, 30 skills, 90 Techniques, eight Doctrine families and four keystones; finite old-tree point refund; v0.3.17 extends purchased ranks to 20 with gradual damage, mana and utility growth | Atlas published in v0.3.16; twenty-rank tuning is prepared for v0.3.17; further combat/balance playtesting remains |
| Gold and loot | Independent gear/gold rolls; physical saved coin piles, magnet pickup, wallet in HUD/inventory; corrected common-heavy loot tables; individual named ground items | Purchases, enhancements and enchanting provide gold sinks; affordability awaits playtesting |
| World | Seven blended biomes, 23 prop families, seeded roads/rivers/lakes, water-aware settlements, streamed terrain and climate-specific environmental life | Finite coordinate/cache/save bounds; no weather or multi-site quest chains |
| Towns and interiors | Stable generated towns/cities, five building kinds, furnished walk-in interiors, roof fading and protected sanctuaries | Three procedural service NPC roles, nearby click/E interaction and pause-safe workbenches |
| Town economy | Blacksmith equipment shop, jeweler jewelry stock, 12-item buyback, guaranteed +10, rarity upgrades, single/all-affix rerolls and geographic relevel | Deterministic stock refresh at levels 4/7/10…; initial prices require player balance feedback |
| Town portal | Free three-second P channel, home-town anchors, saved single-use return endpoint, safe landing, native control/map markers and arrival protection | Permanent waypoint network and map travel remain specified |
| Camps and landmarks | Camps and goblin warbands, watchtowers, graveyards, standing stones, caravans, cursed chests, ruined chapels, beast dens, quarries, occupied hamlets, contested crossings and corrupted groves | Regional placement; persistent recipe-driven assault, defense, seal and timed waves; shared chest bursts and scored treasure |
| Dungeons | Rootbound Crypt: 13–19 rooms, two treasure chambers, persistent Warden, floor chart, fixed level, town/death returns, atomic chest rewards, worn contours and wall-occluded torch/orb illumination | One theme/floor, variable branching layouts; exhausted floors retire to exact receipts, unfinished rewards remain |
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

Generation 9 retains named irregular danger districts: levels follow road travel and remoteness, with higher-level wilderness pockets. Towns are distributed in two dimensions and climate regions are 6,400 units apart. See [world generation](world-generation.md). Enemies retain spawn-time level/rank/stats/reward context. Gear rarity probabilities are conditional on an item dropping: normal enemies yield 75% Common / 22% Magic / 2.7% Rare / 0.28% Epic / 0.02% Legendary. The complete rank tables and growth formulas live in [progression and loot](progression-and-loot.md); the general item generator's default weights are not enemy drop rates.

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

Earlier checkpoint stats (historical): 232 runtime TypeScript modules / 25,656 lines; 96 code-test files; 24 development review entrypoints; zero runtime dependencies. Content: seven biomes, nine enemy archetypes, 20 active skills, 2,185 skill nodes and 17 POI kinds. Source counts come from `npm run stats` at this checkpoint.

Thor controller checkpoint: 21 focused controller/skill tests passed, including select-field escape and single-press node-action routing. Application/headless type checks and Android APK assembly passed. The compact inspector was reviewed in the in-app browser at 832 × 468. Installed over the existing Thor package without clearing data; app launch succeeded with no observed startup errors. Gameplay/controller feel remains player-tested.

### Handheld optimization checkpoint — September 6

Native-density static HUD chrome caching avoids rebuilding metalwork every frame. Thor skips map rasterization/PNG transfer behind Pack, Build and item details. Touch/controller directional assistance respects action reach, visibility and manual ground targeting. Routine checkpoints run every 20 seconds, cloud outbox batches at 30 seconds with explicit flushes; immediate local transactions remain unchanged. Cloud cadence is included in the published v0.5.0 source.

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

Shared animated warnings cover enemy sectors, pounce lanes, Warden fractures and player ground skills, using actual combat geometry and the bounded scene light pass. Live ground presentation replaces independent warning lifetimes. Meteor/Cataclysm now descend visibly, explode with stone/ember material responses, and leave four seconds of tunable non-stacking burning ground. Arrow rain, frost fields, Tempest and elemental blast materials share this treatment. No save reset; local gameplay/visual tuning remains player testing.

Checkpoint verification: 847 code tests pass; application/headless TypeScript and production build pass. Material budgets remain 48 bursts / 384 fragments; total scene lights remain capped at 18.

### Build-defining affixes · 2026-09-07

Wellsip, Expanse, Deep Draught, Piercing, Spellweave and Afterguard now run through shared item derivation and combat owners. Named +1–5 skill rolls use slot/family/element weights, geographic item-level gates and validated discrete recipes. Equipment ranks improve unlocked skill potency without increasing costs or modifying purchased ranks. Loot, vendor stock, enchanting, equipped-item comparisons, skill previews and saves share these rules. Temporary combat buffs expire independently; no save reset.

Affix checkpoint verification: all 858 code tests, application/headless type checks and production build pass. Tests cover weighted slot pools, discrete rank odds/gates, enhancement/releveling, save round trips, failed-action buff preservation, projectile snapshots, potion restoration and block/kill ownership. Gameplay feel remains player testing.


### Skill atlas redesign · 2026-09-07

Early schools now have separate skill branches beside simple passive backbones: 2,182 nodes and 2,923 connections. Basic and advanced unlock costs remain three/four points; all 60 specializations retain two passive improvements. A Details toggle expands the atlas, domain selection centers starter skills, and overview styling emphasizes backbone connections. Route changes can invalidate older invested paths; saves are preserved. Visually approved by the user; Site publication remains separate. See `skill-progression.md`.

The redesign also replaces the stretched outer clusters with five balanced silhouettes and adds cached, bounded path-light animation (gold allocations, blue previews), subtle nebulae and dust. Reduced motion is respected. Validation: 870 full-suite tests plus the added preview-priority regression pass; TypeScript and production build pass.

Basic ranged attacks (Archer arrows and the Hexer’s three bolts) no longer project warning lanes or their associated lights. Ground attacks, pounces, heavy attacks and boss warnings remain; combat timing and projectile behavior are unchanged.

Local specialist equipment adds cloth robes and a matching caster outfit, leather/ranger affix pools, eight jewelry bases, gentler service premiums and material odds that improve with geographic level and encounter difficulty. The gallery exposes level/encounter controls. See [equipment materials](item-materials.md).

Caster armor has four fabric constructions: linen, silk, velvet and starweave. They share cloth silhouettes and caster affix pools, with distinct nonmetallic finishes, stronger bases and increasingly rare, difficulty-weighted drops.

## Dynamic soundtrack — September 8

The local runtime now includes regional, settlement, dungeon and major-encounter music, independent remembered SFX/music levels, quiet panel sounds and shared mute/background handling. See [dynamic soundtrack](dynamic-soundtrack.md) for the 17-track catalogue and transition rules. Site publication and Android installation are separate.

## Local atlas replacement · 2026-09-12

Supersedes the historical atlas counts and three-/four-point school rules above. Six territories replace the celestial petals. Adds Sidestep, Brace, Runic Ward, Vaulting Shot, Rally of Iron and Ghost Hunt. Direct Techniques replace potency/efficiency chains; ranks stop at three, and optional Doctrines/keystones introduce distinct decisions. Older valid tree investments are refunded while retaining character and world progress. [Current rules](skill-progression.md). This pass is local only.
