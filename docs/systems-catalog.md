# Systems catalog

Updated 2026-09-05. Stable system IDs from the original design, with current implementation and remaining scope. For counts and verification use [system status](system-status.md); for delivery order use [roadmap](roadmap.md). A working foundation does not imply final balance or release readiness.

| ID | System | Implemented | Next or unimplemented |
| --- | --- | --- | --- |
| S01 | Coordinates and streaming | Seeded world queries, streamed/cached terrain, bounded coordinates | Truly unbounded precision; measured worker generation if needed |
| S02 | Geography and traversal | Shared terrain/road/building geometry, natural road junctions and collision | Broader geographic structures and navigation validation |
| S03 | Biomes | Seven climates, smooth mixed borders and biome-specific props | More content variety and player visual feedback |
| S04 | Settlements and POIs | Procedural towns/cities, camps and four landmark families | Interactive landmarks and deeper city layout variety |
| S05 | Environmental life | Saved clock, day/night, wind, footsteps, foliage, birds/insects and climate effects | Weather and NPC routines |
| S06 | Interiors | Shared exterior coordinates, open doors, furnished rooms, fading roofs and lighting | NPC work areas; more interior recipes |
| S07 | Input and interaction | Movement, aim, zoom, dodge, held-input cleanup and modal ownership | Nearby NPC interaction |
| S08 | Combat rules/resources | Fixed simulation, shared damage/status/reward owners, skills, block, independent action speeds, low base mana regen and dual potion | Further balance, resistances and deeper combat mechanics |
| S09 | Feedback/audio | Hit particles, dynamic sword trails, synthesized sound, ranged assistance, animated death/remains and native combat text | Player-led feel refinement; continuous combat without hitstop |
| S10 | Skill tree | Connected organic graph, search/filter/zoom, hover comparisons, double-click and atomic path allocation | Respec and deeper authored node variety |
| S11 | Active skills | Seventeen unlocks with equipment checks; basic attack plus five assignable active slots; potion/dodge separate | New actions and skill transformations |
| S12 | Encounters | Six archetypes, three ranks, camp persistence and offscreen travel-driven roaming | Bosses and expanded elite mechanics; profile before more actors |
| S13 | Loot and item generation | Source-level equipment, rank-specific drop/rarity tables, procedural names/affixes and independent loot RNG | More affix identity, unique powers and loot filtering |
| S14 | Economy | Per-character gold wallet, saved physical coins and reward presentation | Atomic trading and buyback; see NPC spec |
| S15 | Inventory/equipment/appearance | Procedural names/icons/worn art, tiers, source-level scaling, affixes, both-hand equipment planning and complete previews | +10 enhancement, rarity/reroll/relevel services; no unique legendary powers |
| S16 | Exploration/objectives | Per-character explored map, POI/biome discoveries and notifications | Quests, interactive events, chests and waypoint travel |
| S17 | NPC services | Town service buildings and shared UI foundation; specification complete | Blacksmith, jeweler and enchanter runtime; no residents yet |
| S18 | Art/lighting | Code-generated assets, layered trees, dynamic lights and fixed CRT/soft phosphor | More authored variety and measured performance work |
| S19 | HUD/panels | Astral HUD, title hall, inventory/equipment/stats, atlas, shared tooltips and panel coordinator | Vendor/service panels using the same kit |
| S20 | Progression/travel/recovery | Fixed geographic danger, XP level-gap rewards, one skill/five stat points per level, sanctuary protection and defeat/continue handling | Return travel and deeper recovery/endgame design; no selectable danger tiers |
| S21 | Accessibility/controls | Native UI focus, input boundaries, reduced-motion behavior, legible numeric labels, concise controls document | Rebinding and broader accessibility verification; no graphics settings screen |
| S22 | Persistence | Eight character slots, autosaves, backups, stale-writer rejection, separate charts, gear/gold/camp state | Durable vendor transactions/stock next; export/import and cloud saves absent |
| S23 | Runtime/performance | Canvas/WebGL browser renderer, fixed simulation, bounded caches, teardown/HMR and stats command | Recorded device-specific long-session profiles; no production performance guarantee |
| S24 | Validation/tools | Headless code tests, strict browser/core compilation, import boundaries and static review scenes | Extend fixtures with each system; user owns gameplay testing |

## Shared rules

- Simulation and validated commands own damage, currency, item ownership and rewards. Presentation consumes results.
- World blueprints remain immutable. Mutable stock, NPC interactions and other future world consequences need separate character-owned state.
- Geographic danger, character level, item level, rarity and enhancement are distinct concepts. The current game uses distance-based zones; old sanctuary-tier proposals are not implemented.
- Shared item presentation, stat derivation and equipment plans must agree with actual transactions, including off-hand displacement and inventory capacity.
- Saving must preserve whole operations. Wallet helpers alone do not make a gold/item/stock trade atomic.
- Keep UI copy concise, UI text above post-processing, and gameplay inputs cleared at panel/focus transitions.
- Numerical, cache and save bounds are explicit prototype limits. More content does not remove the need to profile and playtest.

See [NPCs and vendors](npcs-and-vendors.md) for the agreed next design, [architecture](architecture.md) for code ownership, and [documentation index](README.md) for current guides versus historical proposals.
