# Evergrow — systems catalog

**Status:** initial design inventory · **Updated:** 2026-09-04

This catalog connects the [game brief](game-brief.md) to future implementation work. IDs are stable references, not a mandated software-module structure. All behaviors beyond the original requirements are proposals. Content amounts and tuning values belong to prototypes, not contracts.

**Milestones:** M0 feasibility; M1 playable slice; M2 living world; M3 build depth; M4 sustained endless play; M5 full-vision content and browser release. See the [roadmap](roadmap.md) for exit gates. “M1 → M3,” for example, means a minimal working system in M1 and substantial expansion in M3.

## World and traversal

| ID | System / first delivery | Responsibilities and proposed behavior | Dependencies and proof |
| --- | --- | --- | --- |
| S01 | **World coordinates and chunk streaming** · M0 → M1 | Stable seeded coordinates; generate, prefetch, activate, unload, and reconstruct chunks. A chunk takes roughly 20–30 seconds to cross at baseline walking speed; rendering and interaction should not expose that partition. Preserve coordinate precision during long travel. | Needs S23 budgets and S22 persistence. Cross edges and corners at maximum supported movement speed without holes, stutters, or altered geometry. |
| S02 | **Regional geography and traversability** · M0 → M2 | Regional fields establish water, roads, elevation cues, clearings, landmarks, and settlement sites before local details. Neighboring chunks share boundary rules. Navigation and collision derive from the same source geometry as the art. | Builds on S01 and S24 seed inspection. Validate connected roads, usable spawn points, escape routes, and reachable doors over many seeds. |
| S03 | **Biomes and transitions** · M1 → M2 | Dead forest, swamp, and verdant forest have distinct silhouettes, terrain, props, encounters, ambient sound, and resources. Mixed transition zones blend those characteristics across world-space regions. | Needs S02, S18, S12. Walk through a transition: no palette cut, abrupt prop wall, collision seam, or audio switch at a chunk border. |
| S04 | **Settlements and points of interest** · M1 → M2/M5 | Generate village and city layouts using roads, public spaces, building plots, service roles, and local architectural variations. Compose ruins, shrines, ambush sites, and landmarks with clear entrances and readable focal points. | Needs S02, S06, S17. Shops are reachable, settlements have coherent streets, and repeated layouts vary meaningfully. City scale expands after village layouts work. |
| S05 | **Day/night and environmental life** · M1 → M2 | A saved world clock drives sun/ambient color, lamp activation, windows, creatures, NPC ambience, wind, water, foliage, insects, and sound. Night changes encounter composition and special opportunities within the chosen danger tier. Weather is a later extension. | Needs S18 and S12. A complete cycle preserves enemy readability and access to essential services. No unexplained global damage spike at nightfall. |
| S06 | **Interiors and occlusion** · M0 → M1/M2 | Ordinary houses share exterior coordinates. Roofs and selected walls fade to reveal interiors; light and ambience blend across the doorway while collision remains continuous and consistent with the building geometry. Start with one accessible floor per building. | Needs S04, S07, S18. Enter, leave, fight near a threshold, and approach from every direction without hidden threats, blocked exits, or leaking attacks through solid walls. |

The [world and art document](world-and-art.md) describes the generation hierarchy and visual composition. Generation must create coherent places before decorating them. A building, bridge, or town can cross chunk boundaries; it has one stable owner and identity.

## Fighting and build identity

| ID | System / first delivery | Responsibilities and proposed behavior | Dependencies and proof |
| --- | --- | --- | --- |
| S07 | **Input, movement, collision, and interaction** · M0 → M1 | Keyboard movement, pointer aiming, attack, dodge, nearby interaction, and explicit input buffering. Predictable collision against terrain and buildings; movement must remain responsive during effects and menu transitions. | Needs S02 and S23. The player can circle enemies, dodge through intended openings, and use a door without sticky movement or unintended interaction. |
| S08 | **Combat resolution and resources** · M0 → M1/M3 | Attacks, projectiles, area effects, hit detection, health, mana, dodge availability, healing, mitigation, status buildup, damage over time, stagger, and death. Separate simulation events from visual feedback. | Needs S07, S11, S12. The same encounter behaves consistently at different render rates; damage and defensive rules are explainable and inspectable. |
| S09 | **Impact feedback and sound** · M0 → M1/M3 | Contact flashes, directional recoil, brief optional hit-stop, weapon trails, blood/essence, positional audio cues, selective screen shake, and floating combat text. Communicate damage types and enemy intent without hiding the scene. | Receives S08 events; uses S18 and S21 settings. A player recognizes hit, miss, block, critical strike, danger, and valuable loot without relying solely on color or tiny numbers. |
| S10 | **Skill-tree graph and allocations** · M0 tooling / M1 play → M5 | A shared classless graph contains melee, ranged, magic, defense, and utility routes. Distinguish discovered/unlocked nodes from currently allocated nodes. Limited active points preserve specialization; search, zoom, planning, previews, and sanctuary respec support navigation. | Needs S24 definitions, S19 UI, S22 saves. Every node has stable identity, legal paths, meaningful effects, and visible consequences; synthetic large graphs test scale before thousands of real nodes are produced. |
| S11 | **Active skills and build interactions** · M1 → M3 | Tree nodes unlock skills, transformations, and synergies. Proposed full loadout is a basic attack, four equipped active skills, a dodge, and a healing flask; the slice uses two active skills. Tags express weapon, element, delivery, and effect compatibility. | Needs S08, S10, S15. At least two distinct builds change positioning and action choices, with unsupported combinations explained before spending points. |
| S12 | **Enemies, encounters, elites, and bosses** · M1 → M3/M4 | Biome-specific enemy families fill roles such as pursuer, ranged attacker, and area controller. An encounter director places fair combinations, rests, ambushes, and rewards; curated elite modifiers and bosses add tactical rules. | Needs S02, S08, S20. Avoid unavoidable spawn damage, unreadable combinations, sanctuary intrusion, and endless enemies following across the map. |

The [combat and progression document](combat-and-progression.md) owns the detailed rules. Enemies, weapons, skills, and statuses need shared tags and event definitions so new content composes predictably.

## Rewards, persistence of choice, and motivation

| ID | System / first delivery | Responsibilities and proposed behavior | Dependencies and proof |
| --- | --- | --- | --- |
| S13 | **Loot and item generation** · M1 → M3 | Generate equipment from base types, power tier, rarity, compatible affixes, and visual descriptors. Use boss/resource reward identities, rarity cues, comparison tools, and a customizable loot filter to make drops worth noticing. | Needs S12, S15, S20. A player can explain why a drop matters; deterministic reward IDs prevent save/reload duplication. |
| S14 | **Crafting and economy** · M1 → M3/M4 | Sell, salvage, buy essentials, improve items, and later target specific crafting outcomes. Start with few currencies/material categories and clear costs. Resource sinks support continuing projects; preserve favorite equipment through a bounded improvement path. | Needs S13, S17, S22. A poor drop still has use, crafting costs and outcomes are understandable, and costs never block basic recovery after death. |
| S15 | **Inventory, equipment, and appearance** · M0 visual / M1 play → M3 | Capacity, equipment slots, item comparison, stable inventory state, and worn appearance. Procedural geometry/material/rig attachments expose weapon and armor changes in the world. Slot and weapon requirements must be explicit. | Needs S18, S13, S19. Equipping and unequipping changes both stats and appearance, persists through reload, and never duplicates or deletes an item unintentionally. |
| S16 | **Exploration, events, objectives, and map** · M1 → M2/M4 | Fog of war, known landmarks, waypoints, regional rumors, handcrafted objective grammars, optional events, and discoveries. Give expeditions short goals without requiring a linear campaign. Story fragments build regional identity. | Needs S01, S04, S12, S22. The player can choose a destination, complete a meaningful local objective, and revisit a remembered place. |
| S17 | **NPCs and town services** · M1 → M2 | Useful vendor, blacksmith, inn/sanctuary, and later specialist services. Placement and signs communicate roles; small routines, work animation, and brief dialogue make inhabitants feel present. Essential services remain accessible through day/night. | Needs S04, S06, S14, S16. A first-time visitor can locate and use each required service without a quest prerequisite. |
| S20 | **Danger progression, travel, death, and recovery** · M1 → M4 | Sanctuary waypoints handle safe returns and explicit danger-tier advancement, proposed to unlock through guardian trials. Geography remains persistent across tiers; enemy/reward state resets only under declared rules. Death returns to safety with a modest recoverable loss; recovery claims survive tier changes and settle once. | Needs S08, S12, S22. Difficulty selection is visible, local exceptional threats are signaled, travel cannot duplicate rewards, and failure leaves a viable path to resume. |

### The endless-progression contract

Exploration distance, danger tier, equipment power, and skill allocation are different values. A coordinate is not a character level. Choosing a higher tier changes the challenge and rewards while keeping the world's geography recognizable. Newly earned gear should improve performance at the same tier; moving up a tier should ask for both sufficient power and competent build use.

Higher tiers combine stronger tuning with a finite vocabulary of encounter variants, elite combinations, and objectives. Tree completion is not the endless reward mechanism: finite allocations coexist with continuing discoveries and item projects. Eventually encountering familiar mechanics is expected; the system must produce useful decisions from their combinations.

Persistent world changes, one-time discoveries, repeatable encounter rewards, and tier-specific state require separate identities and reset rules. These rules must be explicit before implementing shortcuts such as “unload a chunk to reset it.” See S22 and the technical foundations.

## Presentation and foundations

| ID | System / first delivery | Responsibilities and proposed behavior | Dependencies and proof |
| --- | --- | --- | --- |
| S18 | **Procedural art, animation, lighting, and effects** · M0 → M5 | Code defines terrain materials, prop grammars, architecture, body rigs, equipped parts, enemy silhouettes, particles, lights, shadows, and animation. Cache generated render output where useful. Use quality tiers to bound expensive effects. | Core input to S03–S09 and S15. Art remains recognizable at gameplay scale; many visible actors and lights fit measured performance budgets. |
| S19 | **Combat HUD and character interfaces** · M1 → M3 | Bottom health/mana orbs, skill bindings, dodge/heal availability, status indicators, inventory/character/tree access, minimap, objective cues, and clear equipment comparisons. The skill tree supports semantic zoom, filters, search, and planned paths. | Needs S08, S10, S15, S16. Critical combat information is legible, menu focus cannot trigger world attacks, and UI works at intended browser sizes. |
| S21 | **Onboarding, accessibility, and controls** · M1 → M5 | Teach movement, one attack, a dodge, a first node, and one equipment upgrade through play. Include rebinding, scalable text, readable color-independent cues, reduced motion, particle/shake/flash controls, and combat-text density. Single-player menus pause hostile simulation by default. | Cross-cuts S07–S19 and S23. A newcomer reaches a first useful build choice; feedback remains understandable with optional visual effects reduced. |
| S22 | **Save/load and world state** · M1 → M4 | Versioned local saves, world seeds, stable object IDs, player progression, inventories, explored places, interaction deltas, autosave checkpoints, export/import, migration, and storage-failure handling. Prevent partial inventory/currency transactions. | Needs stable definitions in S24. Reload reconstructs a known place and build correctly; failed writes preserve the last good save and report recovery options. |
| S23 | **Browser runtime and performance** · M0 → M5 | Renderer selection, timing, simulation scheduling, worker jobs, bounded resident world data, pooling/caches, quality settings, resize behavior, tab suspension, audio activation, graphics recovery, and browser compatibility. | Enables every gameplay system. Profile on documented reference devices; travel and combat stay within calibrated budgets over long sessions. |
| S24 | **Content definitions, diagnostics, and validation** · M0 → M5 | Data schemas, deterministic seeds, skill/affix/enemy registries, seed galleries, node graph inspection, item and combat previews, generation overlays, profiling, balance simulations, and save fixtures. | Foundational for repeatability. Catch invalid references, impossible layouts, duplicate stable IDs, broken graph paths, and runaway modifiers before release. |

S18–S24 are first-class game systems. They determine whether the ambitious visible features can be expanded and maintained.

### Proposed interface layout

The bottom HUD has a health orb on the left, mana orb on the right, and a compact skill bar between them. Give dodge charges and the healing flask distinct indicators beside the skills. Current bindings, insufficient-resource states, cooldowns, and important status effects must remain legible over bright and dark terrain. Numeric resource labels are available; the orbs also communicate depletion through shape and motion. Character, inventory, and tree buttons sit within this bottom frame.

Keep the center of the screen available for movement and attack warnings. A small corner minimap shows nearby routes and services; an expandable world map handles remembered places and waypoint travel. Objectives occupy a small collapsible area. Damage numbers have configurable density, and loot labels yield to combat warnings.

Inventory pairs a backpack with an equipped-character preview and clear slot targets. Selecting an item compares its practical effects and appearance with the equipped item. The character panel explains defenses and resource rules; the tree panel handles search, build planning, prerequisites, and allocation changes. Initial single-player menus pause hostile simulation and the world clock. Closing a menu clears buffered attacks so a click used for equipment cannot fire into the world. Final panel sizes and shortcuts require browser playtests.

## Cross-system rules to preserve

1. **Simulation is authoritative.** Damage, item ownership, collision, and rewards cannot depend on particles finishing or a sprite being visible.
2. **Procedural systems share geometry and identity.** A visible doorway, its collision gap, navigation connection, interior, and saved interaction describe the same place.
3. **Randomness is reproducible where it matters.** Use separate seeded streams for geography, placement, encounters, and loot. Cosmetic particles need not reproduce exactly.
4. **Progression is inspectable.** Tooltips and comparisons explain what an allocation or item changes; costs, incompatible tags, and tier differences are visible.
5. **Safety has clear boundaries.** Town sanctuaries, boss arenas, tier changes, and recovery rules are communicated through space and UI.
6. **Optional presentation cannot conceal essential information.** Reduced particles, muted audio, or reduced motion leave attacks and threats readable.
7. **Endless travel uses finite resources.** Active world state and render caches are bounded; persistent exploration has an explicit storage policy and user-visible recovery path.

## Expansion ideas worth parking

Later candidates include subterranean dungeon entrances, controller support, regional factions and reputations, weather systems, traveling merchants, unusual town specialists, and optional challenge characters. Evaluate each after the connected expedition loop works. Cooperative multiplayer, user trading, construction, and seasonal resets need separate scope and architecture decisions.

The first implementation backlog should be derived from M0 and M1, not by turning every row into an immediate feature task.
