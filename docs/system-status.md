# Current system status

Updated 2026-09-06 for the gamepad implementation checkpoint. **Playable local prototype; unreleased.** This is the current implementation summary. Earlier snapshots live in [historical checkpoints](history/foundation-checkpoints.md); planned work lives in the [roadmap](roadmap.md).

## Implemented systems

| System | Current implementation | Remaining boundary |
| --- | --- | --- |
| Characters and saves | Eight browser-local slots; title hall, starter choice (Sword / Bow / Fire Staff), equipped preview, level/power summary, continue/delete; autosave, backup recovery and stale-writer checks | No cloud sync, export/import or migrations |
| Combat | Deterministic 120 Hz simulation; weapon basics, five assignable active slots, dodge, dual potion; 20 executable skills; melee/bow attack speed and independent staff/magic cast speed | Player tests feel and balance; no automatic combos or default assigned spell |
| Aiming and input | Swept ranged contacts, bounded aim assistance, aim feedback; standard gamepad analog movement/aim, combat bindings and menu navigation; neutral rearm and disconnect pause | Fixed Xbox-position labels; text entry, drag/drop and gameplay zoom still use keyboard/mouse; controller hardware/feel acceptance remains with the player |
| Enemies | Six archetypes, three ranks, patrol/LOS, flank/pounce/ranged/area patterns, home return; corrected hound patrol arrival and idle facing | No bosses or deep elite modifier pool |
| Spawning | 9–14 ambient target, 24 living actors total, nine slots reserved from camps; nine initial roamers, then travel/cooldown-driven groups; births fully offscreen | Larger populations need profiling; waiting on cleared ground does not refill it |
| Progression | Fixed geographic danger, source-level rewards, XP level-gap factors, one skill and five stat points per level | Numeric level bound 1,000,000; not a balanced infinite endgame |
| Equipment | Ten kinds, five rarities, eleven slots; thirteen generated weapon profiles, three shields; 19 general and two shield affix families; visible procedural gear | Recipe-based +10 enhancement and enchanting; no wands or unique legendary powers |
| Inventory | 64 cells, three-column panel, drag/drop, Shift-click equip/unequip; shared complete equipment planning and effective-stat tooltips, including both-hand displacement | Shop sales and buyback; no stash or manual ground disposal |
| Skill atlas | 2,185 nodes, 3,047 edges, 150 passive constellations + 12 development groups, three domains, nine schools; short cross-connected routes, hover stat previews, search/filters, double-click and atomic path allocation | Reused authored bonus families need balancing; no respec |
| Gold and loot | Independent gear/gold rolls; physical saved coin piles, magnet pickup, wallet in HUD/inventory; corrected common-heavy loot tables; individual named ground items | Purchases, enhancements and enchanting provide gold sinks; affordability awaits playtesting |
| World | Seven blended biomes, 23 prop families, seeded roads, streamed terrain, day/night and climate-specific environmental life | Finite coordinate/cache/save bounds; no weather or procedural quests |
| Towns and interiors | Stable generated towns/cities, five building kinds, furnished walk-in interiors, roof fading and protected sanctuaries | Three procedural service NPC roles, nearby click/E interaction and pause-safe workbenches |
| Town economy | Blacksmith equipment shop, jeweler jewelry stock, 12-item buyback, guaranteed +10, rarity upgrades, single/all-affix rerolls and geographic relevel | Deterministic stock refresh at levels 4/7/10…; initial prices require player balance feedback |
| Town portal | Free three-second P channel, home-town anchors, saved single-use return endpoint, safe landing, native control/map markers and arrival protection | Permanent waypoint network and map travel remain specified |
| Camps and landmarks | Four-/six-member camps, watchtowers, graveyards, standing stones and caravans; camp casualties persist with the character | Landmark interactions, chests and objective rewards remain absent |
| Maps | Smooth 0.05-scale minimap; 600-unit normal discovery radius; explored atlas with POI hover, conservative fog and per-character chart saves | No waypoint travel; 720 units is the reveal API ceiling, not the normal reveal radius |
| Presentation | Procedural equipment/world art, layered trees, wind/wildlife, dynamic lighting, fixed restrained CRT/phosphor; readable native UI, enemy rank plates, animated deaths and fading remains | Hardware performance and visual acceptance remain separate from code checks |
| UI foundation | Astral HUD, shared compact windows, consistent tooltip motion and item components; centralized panel lifecycle; point badges and compact notifications | Service panels reuse these components; equipped gear is separate and first |
| Notifications | Separate named item cards, level/point gains, discovered POIs and debounced biome entry; gold and XP accumulate in one rewards card until it expires | No duplicate central reward banner |

## Starting character and core rules

Every new character begins at level 1, 0 XP and 0 gold, with ten of each attribute, no unspent points, only the free tree origin allocated, five empty skill bindings and 64 empty bag cells. The same worn leather outfit accompanies the chosen common starter weapon. Starter armor currently has no implicit/affix stat bonuses. The sword is the two-handed Weathered Sword (24 base damage, two attacks/second); bow and staff use their own profiles. See [character systems](character-systems.md) and [weapons and skills](weapons-and-skills.md).

Base life and mana are 100; mana regenerates at 1/second before bonuses. Q restores 42% maximum life and 40% maximum mana together, with two charges and a charge recovered every eight kills. Basic attacks cost no mana. First-row skills have no cooldown but still pay mana and obey action recovery; second-row skills cost more and have cooldowns. Attack speed, cast speed, mana-cost reduction and cooldown reduction remain distinct stats.

Geographic area level rises every 3,200 units from the origin. Enemies retain spawn-time level/rank/stats/reward context. Gear rarity probabilities are conditional on an item dropping: normal enemies yield 75% Common / 22% Magic / 2.7% Rare / 0.28% Epic / 0.02% Legendary. The complete rank tables and growth formulas live in [progression and loot](progression-and-loot.md); the general item generator's default weights are not enemy drop rates.

## Budgets and verification · historical gamepad checkpoint (2026-09-06)

| Resource / metric | Value at the gamepad checkpoint |
| --- | --- |
| Code verification | 528 tests passed including gamepad input and menu boundaries; strict application/core TypeScript and production build passed |
| Runtime code | 152 modules / 17,299 lines; zero runtime dependencies |
| All TypeScript / review entrypoints | 177 modules / 19,660 lines; 18 review entrypoints |
| Test files | 71 code-test files; one optional browser-test file |
| Projectiles / timed ground effects | 128 / 16 |
| Ground equipment / coin piles | 96 / 128 |
| Character saves | Eight slots; 700,000-character serialized checkpoint limit per slot |
| Commerce | 2,048 current-epoch purchase masks; 12 buyback items; stock 12 blacksmith / 6 jeweler |
| Exploration | 8,192 chunks / 4,096 POIs; 3,500,000-character serialized chart limit |
| Coordinate / content level bounds | ±48,000,000 exploration coordinates / level 1,000,000 |
| Wilderness cells / camp ledger | 128 cached cells / 1,024 persisted camps, up to six members each |
| Climate regions / chart tiles | 512 cached regions / 384 cached chart tiles, at most 256 visible |
| Biome life | 40 disturbances, 48 footprints, 100 particles, six birds, ten insects |
| Last build (stats script) | JS 534,681 bytes / 181,624 gzip; CSS 63,810 bytes / 14,098 gzip; font separate |

Counts were refreshed with `npm run stats` after the implementation checks. Build sizes describe the last successful build, not a performance measurement. Vite emits its initial-JS-chunk size advisory above 500 kB. Save payload version 3 requires a new character for earlier saves; old slots remain stored and incompatible. All service mutations persist before live commitment, and failed writes leave gold/items unchanged. Browser playtests are opt-in and remain with the player; static reviews do not prove gameplay balance or long-session Safari performance.

## Latest completed checkpoints

| Checkpoint | Result |
| --- | --- |
| Gamepad support (2026-09-06) | Standard controller movement/aim, all combat actions, panel navigation, device-aware HUD bindings and disconnect pause; 528 code tests and application/core checks/build passed; hardware playtesting remains with the player |
| `434705f` | Three starter weapon choices |
| `f20bb6f` | Lower starting mana regeneration and dual resource potion |
| `e17bdcf` | Persistent gold wallet/piles and reward feedback |
| `0086946` | Stable camp-hound patrol/idle behavior |
| `7f089ec` | Fixed stuck movement around native shortcuts and focus changes |
| `9058c56` | Gold and XP stack in the shared notification feed |
| `85b1b00` | Shared equipment plan, correct full-build comparisons, reusable item UI and centralized panel lifecycle |
| `16431cf` | NPC/vendor design specification; no NPC runtime implementation |

The prior checkpoints above were pushed to `origin/main`. The town-services checkpoint adds all three NPC roles, complete transactions/persistence and improvement services, plus [desktop/narrow static captures](captures/2026-09-05/town-services/README.md). The next step is player feedback on affordability, usefulness and interaction feel; the current prices and +10 strength are initial live tuning.

## Selected next work

[Town portals](travel-and-portals.md) are implemented; skill progression now requires save v3. Permanent waypoint travel and [interactive POIs](interactive-pois.md) remain specified; gameplay feedback on the portal loop comes first.

## Skill progression checkpoint · 2026-09-06

Implemented [skill ranks and specializations](skill-progression.md): 20 active skills, 19 specialization nodes, 17 masteries, optional Arcane Overload, and Cataclysm/Tempest/Absolute Zero. The atlas has 2,185 nodes and 3,047 edges. Combat, HUD, atlas and save v3 share rank/variant costs and potency. Previous numeric checkpoint metrics above remain historical; balance and gameplay feel await player testing.

Verification for the skill progression work: `npm run check` passed (542 code tests in the shared working tree, strict application/headless-core TypeScript, production build). The rank panel was inspected in the in-app browser using the frozen, save-free review. Gameplay balance remains for player testing.

Integration with the remote gamepad checkpoint was revalidated with `npm run check`: 551 shared-working-tree code tests passed, strict compilation and production build passed. HUD controller bindings retain the shared ranked-skill cost calculation.
