# Evergrowing — roadmap

**Status:** proposed sequence, not a dated commitment · **Updated:** 2026-09-04

**Prototype update, 2026-09-05:** the local build now combines the combat foundation with three connected biomes, procedural town/city layouts, seamless furnished interiors, and persistent exploration maps. These are first implementations awaiting the user's feedback, not completion of M1/M2; trading, progression, objectives, inhabitants, and character saves remain deferred. See [prototype status](prototype-status.md).

Build outward from a small expedition that feels good. World scale, procedural art, responsive combat, and a huge tree are interdependent risks; test their expensive assumptions early, then increase content volume. All quantities below are provisional scope targets.

## At a glance

| Stage | Playable result | Main question answered |
| --- | --- | --- |
| M0 — Feasibility | Small interactive laboratories | Can code-generated art, combat, lighting, streaming, and the tree fit together in a browser? |
| M1 — Vertical slice | One complete town-to-wilderness expedition | Is the core game enjoyable and coherent? |
| M2 — Living world | Three biomes, varied settlements, and regional exploration | Does continued travel produce believable, interesting places? |
| M3 — Build depth | Distinct melee, ranged, magic, and hybrid builds | Do the tree, skills, enemies, and loot create lasting choices? |
| M4 — Sustained progression | Reliable long sessions, optional higher tiers, durable saves | Can the player keep going without performance, economy, or progression collapsing? |
| M5 — Full-vision release candidate | Thousands of tree nodes, city variety, polished browser play | Can the breadth of the original vision meet the quality established by the slice? |

There are no calendar estimates yet. M0 measurements and the actual team capacity should determine them. Saving, accessibility, and performance begin in the slice and deepen throughout; their later milestones do not defer basic correctness.

## M0 — Prove the difficult pieces

**Deliverable:** one browser development harness containing several small, interactive test scenes, a measured renderer choice, and a short record of accepted tradeoffs.

| Experiment | Build only enough to show | Acceptance gate |
| --- | --- | --- |
| Character and combat feel | Code-generated player rig, two visibly different weapons, directional movement/aiming, one attack, dodge, a telegraphed enemy, hit feedback. | Input feels immediate; attacks connect visibly; worn gear reads at normal camera scale; essential cues survive reduced effects. |
| Light and interior | One procedurally defined house, roof/wall fading, a door with collision, indoor/outdoor lighting, several moving lights. | Entering and leaving stays continuous; actors sort correctly; walls block attacks as intended; lighting remains within the measured budget. |
| World streaming | Seeded terrain across several chunk borders, one road, a biome boundary, bounded active chunks, and generation work off the critical frame path where supported. | Walk and dash across edges/corners without exposing generation; returning yields the same terrain; active memory stabilizes. |
| Large-tree interface | Synthetic graph containing several thousand placeholder nodes; zoom, pan, search, route highlighting, allocation validation. | The browser handles the graph and the interface reveals local choices. This proves tooling scale only, not thousands of designed nodes. |
| Runtime profiling | Worst-case scene with configurable enemies, props, lights, and particles; timing and memory instrumentation. | Record hardware, browser, resolution, frame-time distribution, generation cost, and resident state; choose initial quality budgets. |

Begin with the character/combat scene and a streaming skeleton. Once shared coordinates and drawing primitives are stable, interior and tree experiments can proceed independently. Use the [technical foundations](technical-foundations.md) for stack candidates and measurement expectations.

**Exit decision:** pick the rendering/runtime approach, camera treatment, procedural character construction, collision representation, and chunk policy from evidence. If simultaneous dynamic lighting and generated art exceed budget, constrain active lights, cache static geometry, or simplify shadows and remeasure. Preserve the core visual direction while adjusting implementation scope.

## M1 — Make one expedition worth replaying

**Deliverable:** a small persistent world in which the player can leave a village, fight, discover something, earn a meaningful upgrade, return to a service building, spend a tree point, save, and resume.

Proposed content budget:

- One complete biome and a convincing playable boundary into a second.
- One generated village with an inn/sanctuary/vendor and blacksmith, spread across roughly two enterable buildings.
- Three small enemy families with one initial enemy each, covering different combat roles; one elite modifier and one boss encounter.
- Two weapon families, a basic attack, two active slots drawing from a small available skill pool, dodge, and healing. The shared tree offers enough melee/ranged/magic options to expose design issues without requiring equal content depth yet.
- About **40–60 curated tree nodes**, including several active unlocks and at least two build-changing choices.
- A small equipment-slot set with visibly distinct weapons and armor, common/magic/rare drops, sell/salvage, and one deterministic item-improvement action.
- One local objective or event, a landmark, a waypoint, fog of war, and a simple return-to-town flow.
- Two test danger tiers, one guardian-trial unlock, and a sanctuary tier selector with basic encounter reset rules. This proves the advancement model before M4 expands it.
- A full day/night cycle, the orb-based combat HUD, inventory/character/tree screens, local save/load, export/import, and core accessibility settings.

### Build order inside the slice

1. **Connect movement to the world:** stable collision, chunk streaming, camera, and one biome grammar.
2. **Make a combat pocket enjoyable:** one enemy, one weapon, one skill, clear hit/death/reward flow.
3. **Make progression tangible:** equip a drop, show the change on the player, allocate a node, and observe a different fight outcome.
4. **Close the expedition loop:** generate a village, enter buildings, use services, discover a waypoint, and handle death/recovery.
5. **Make progress durable:** integrate stable IDs and save transactions as systems are added; complete reload and export/import verification before external playtests.
6. **Expand within the content budget:** add the remaining enemies, tree paths, biome boundary, day/night polish, and first boss.

**Exit gates:**

- A fresh player can complete a roughly 10–20 minute outing and name a useful next goal.
- At least two small builds feel different in positioning or action choices.
- Players cross chunks, cross a biome border, and enter a building without a perceived loading interruption.
- A gear change is readable on the character as well as in the character screen.
- Death and respec leave a practical route to continue; essential services are available at night.
- A tier change preserves geography, one-time rewards, and any outstanding death-recovery claim; refunding a technique clearly updates its loadout eligibility.
- Save/reload preserves equipment, allocations, known places, and completed one-time interactions.
- The representative encounter fits the selected reference-device budgets without runaway world residency.

If combat or the expedition loop is weak, revise it here. Additional biomes and nodes will not fix those foundations.

## M2 — Grow a coherent, living world

**Deliverable:** repeatable exploration across dead forest, swamp, and verdant forest, including meaningful transition regions and settlements worth remembering.

Add regional geography, shared roads and rivers, landmark placement, resource identity, mixed biome transitions, more village grammars, a larger town, and a first city-layout prototype. Establish the same road/building/service rules before raising settlement density. Expand interior furnishings, inhabitants' ambient behavior, local rumors, event grammars, and day/night encounter variants. Essential service access remains reliable.

Create a seed gallery and navigation diagnostics so invalid layouts are reproducible. Separate architecture choices from decoration seeds. Add pacing rules for quiet stretches, ordinary encounters, and distinctive discoveries.

**Exit gates:**

- A sampled set of worlds has reachable services, connected intended routes, passable bridges, and usable doorways; broken seeds are reproducible.
- Players can recognize each biome and explain how a transition changes its identity.
- Settlements have varied street/building arrangements while retaining understandable services.
- Revisiting an explored place preserves landmarks and persistent changes.
- An extended journey contains both rests and discoveries, with bounded active memory and no recurring traversal stalls.

M2's city is a feasibility prototype, not the final diversity of cities promised by the full vision.

## M3 — Make builds support repeated play

**Deliverable:** a balanced, inspectable progression framework with viable melee, ranged, magic, and several hybrid paths.

Expand the real tree to a few hundred nodes, provisionally **200–400**, using curated regional structure. Add the full proposed active-skill loadout, skill transformations, meaningful defenses/status interactions, more weapon/armor identities, compatible affix pools, focused crafting projects, elite families, and bosses that test movement and build decisions.

Add skill search, semantic zoom, tag filters, route planning, costs/effect previews, affordable sanctuary respec, loot filtering, and useful item comparisons. Build node/affix validators, representative build fixtures, and combat inspection tools before multiplying definitions.

**Exit gates:**

- Representative melee, ranged, magic, and hybrid builds each clear appropriate content with distinct behavior.
- No single path is necessary for basic survival, and the initial experience explains how to recover from an ineffective build.
- Node descriptions match implemented effects; modifiers do not duplicate or recurse unexpectedly.
- Crafting provides targeted progress and useful resource sinks without requiring unreadable currency complexity.
- Players can find and plan a desired branch without searching blindly across the whole graph.

## M4 — Make endless play hold up

**Deliverable:** opt-in danger advancement, repeatable expedition goals, continuing equipment projects, reliable long exploration, and robust saves.

Expand the slice's sanctuary-controlled tier changes and reset rules into sustained progression, with visible local threat exceptions and tier-relative power arithmetic. Terrain and discovered settlements retain their identity across tiers. Progression must reward gear improvements at the same tier and preserve the importance of skill choices. Test both ordinary progression and extreme synthetic tiers for overflow, precision, broken reward curves, and degenerate builds.

Exercise resident-world eviction, render cache limits, save-schema upgrades, suspended tabs, interrupted writes, storage-quota failure, export/import, and recovery from old or corrupt data. Offline single-player saves are user-controlled; an online competitive economy would require a separate trust model.

**Exit gates:**

- Walking farther does not silently raise global danger; deliberately selecting a tier produces the stated challenge and rewards.
- Returning to a lower tier makes earned power understandable; moving up creates a meaningful test.
- Save/load, portal use, tier changes, and chunk eviction do not duplicate one-time rewards or lose inventory transactions.
- Long travel stabilizes resident resources; growth of persistent exploration data is measured and handled explicitly.
- Death, exhaustion of crafting resources, or a failed save never silently destroys the only recoverable state.
- Repeated expeditions still offer a useful choice after the finite allocation budget is reached.

## M5 — Fulfill the breadth and prepare release

**Deliverable:** a browser release candidate that meets the core vision, including **thousands of actual designed skill nodes**, procedural city variety, and a broad enough content vocabulary to sustain exploration.

Expand the tree in validated thematic regions, with meaningful branch destinations and documented build roles. Synthetic placeholders do not count. Increase biome prop vocabularies, city neighborhoods, enterable building variations, enemies, boss encounters, skills, equipped appearances, and event combinations based on observed repetition.

Finish audio, onboarding, UI scaling, input rebinding, quality presets, reduced-effects modes, pause/focus behavior, and browser compatibility checks. Finalize the supported browser/device matrix from actual tests. Prepare versioned builds, public hosting, clear save management, release notes, and a reproducible bug-report path based on seed and version. Choose distribution and monetization only after explicit product decisions.

**Exit gates:**

- All twelve original requirements in the [brief](game-brief.md) have demonstrable playable coverage.
- The complete tree remains navigable and its content passes graph/effect validation.
- Cities retain reachable services, coherent layouts, seamless ordinary interiors, and stable performance at their intended density.
- Browser/device compatibility, accessibility settings, save migration/recovery, and representative stress scenarios meet published expectations.
- New-player testing confirms the game explains its core loop without developer narration.

A smaller public prototype can ship after M1 or M2, clearly labeled as such. It should not be described as the complete vision until the remaining gates are met.

## Keep these risks visible

| Risk | Early response | Expansion rule |
| --- | --- | --- |
| Generated art looks generic or unreadable. | Build a strong silhouette/material grammar and compare at real gameplay scale in M0. | Add variations only after the base art works. |
| Thousands of nodes create busywork. | Separate UI stress tests from curated progression tests. | Expand only when branches offer understandable choices and destinations. |
| World generation creates repetitive or broken places. | Use regional structure, placement constraints, seed galleries, and route validation. | Increase grammar variety before world density. |
| Lighting, particles, and streaming compete for the frame. | Measure them together early; bound residency and effect counts. | Raise budgets only with representative-device evidence. |
| Endless scaling erases strategy or destabilizes numbers. | Keep build budgets finite, tier changes explicit, and combat arithmetic normalized. | Validate relative power and rewards before raising tier range. |
| Local persistence grows or becomes incompatible. | Version seeds/definitions, record compact deltas, and support export/recovery early. | Do not discard meaningful world history silently to fit a cache. |

After each milestone, update the brief's working decisions and revise later scope around what playtests actually establish. Content breadth should follow proven systems.
