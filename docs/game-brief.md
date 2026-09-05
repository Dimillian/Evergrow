# Evergrowing — game brief

**Status:** initial design proposal · **Updated:** 2026-09-04

## The game in one paragraph

Evergrowing is a fully 2D, top-down browser action RPG in which a gothic world unfolds as the player explores. Fight through living forests and drowned ruins, discover settlements, step directly into their buildings, and return to the wilderness with equipment that changes both your appearance and your play style. A vast, interconnected skill tree lets melee, ranged, and magic builds grow into hybrids. The world can keep generating, and the player can keep pursuing stronger challenges, without requiring a final map edge or a mandatory character reset.

**Player fantasy:** “Every expedition reveals somewhere worth exploring, every fight feels good, and every return to town gives me a new possibility for my build.”

Diablo informs the immediacy, atmosphere, loot excitement, and compact orb-based HUD. Path of Exile informs the depth of interconnected character choices. Evergrowing should develop its own fiction, art language, node structure, and interface details.

## Original requirements

These are the user's requirements, distinct from the proposals elsewhere in this document. The last column points to the owning systems in the [catalog](systems-catalog.md).

| # | Requirement | Systems |
| --- | --- | --- |
| 1 | A procedural world generated during exploration, using visually hidden chunks taking roughly 20–30 seconds to walk across. | S01–S02 |
| 2 | Multiple procedural biomes, including dead forest, swamp, and verdant forest, with props, sights, villages, and towns. | S03–S04 |
| 3 | A day and night cycle. | S05 |
| 4 | Smooth biome transitions. | S03 |
| 5 | Procedural cities and towns with interesting layouts, shops, a blacksmith, and smooth movement into and out of houses. | S04, S06, S17 |
| 6 | A Diablo-inspired bottom combat HUD with life and mana orbs, skills, and access to character, inventory, and skill-tree screens. | S19 |
| 7 | Extremely reactive, dynamic combat, floating damage numbers, and strong feedback. | S07–S09 |
| 8 | A central skill tree with thousands of melee, ranged, and magic nodes, providing stats and skills. | S10–S11 |
| 9 | Dark gothic art, emissive lights, atmospheric lighting around the player and other light sources, and convincing building transitions. | S05–S06, S18 |
| 10 | Strong particle effects for combat and impacts. | S09, S18 |
| 11 | Fully 2D top-down procedural art, fluid and living animation, visible worn equipment, and flexible assets defined in code. | S15, S18 |
| 12 | Playable in a browser. | S22–S24 |

## Design pillars

### 1. The journey remains continuous

The player should perceive geography, roads, weathered landmarks, and settlements. Chunk boundaries are an implementation detail. Ordinary house interiors occupy the same world as their exteriors, with roofs and obstructing walls fading as the player enters. Biome borders are places with mixed vegetation, terrain, sound, and lighting.

### 2. Control feels immediate

Movement, aiming, attacks, dodging, and interaction must feel reliable before we add large quantities of content. Enemy intent stays readable through darkness and effects. Feedback expresses what happened: contact, a blocked blow, a critical strike, a dangerous spell, or a valuable drop.

### 3. Builds express choices

The skill tree is the heart of the game. Its thousands of nodes are a long-term map of possibilities, with paths that help players understand what they are building. A character cannot simply allocate everything. Equipment and skill modifications make those choices visible in combat and on the character.

### 4. Procedural generation has an artistic grammar

Code defines silhouettes, palettes, materials, anatomy, architectural rules, animation, and placement. Randomness varies those definitions. A swamp chapel should look deliberately composed, and a new sword should read clearly at gameplay scale. Cached render output is compatible with this direction; the source of the art remains procedural code.

### 5. There is always a reason for another expedition

New geography, build opportunities, equipment projects, encounters, and optional danger tiers create continuing goals. “Infinite” means the systems can continue producing territory and challenges in practical play. It does not promise infinitely many handcrafted mechanics, an infinitely large resident world, or useful progression from ever-larger raw numbers alone.

## The player experience

### Moment to moment

Read the space, move and aim, attack or combine skills, avoid a telegraphed threat, collect useful rewards, and spot something that invites investigation. Combat leaves room to see the landscape; environmental motion makes quieter travel feel alive.

### An expedition

Leave a sanctuary with a build goal and a chosen danger tier. Follow a road, landmark, rumor, or unexplored edge. Fight encounters with a mixture of predictable biome identity and occasional surprises. Find a shrine, a small event, a rare crafting ingredient, or a new settlement. Activate a waypoint and decide whether to push onward or return to work on the build.

**Proposed session rhythm:** a meaningful outing can fit into about 10–20 minutes, while the persistent world also supports long exploration sessions. Short-session usefulness must be tested, not enforced through a timer.

### Long-term play

Expand the explored world, discover build branches, refine equipment, complete regional objectives, and take on higher danger tiers. A powerful character gains tactical options and access to demanding encounters as well as power. Optional new characters explore alternative paths; forced prestige is not a default requirement.

## Proposed identity and world premise

One possible fiction is **the Evergrowth**: an unexplained renewal that overtakes abandoned kingdoms, raises living forests around dead ones, and leaves settlements dependent on circles of maintained light. Some inhabitants cultivate it, some burn it back, and some worship it. This gives dead forest, lush forest, swamp, ruins, and inhabited refuges a shared visual and narrative cause.

This is a creative direction to discuss, not established lore. The working emotional palette is solitude, danger, curiosity, and relief when warm windows appear through the trees. Verdant areas remain gothic through twisted scale, decaying masonry, deep shadow, and uneasy inhabitants; darkness does not require every location to be gray.

## Working decisions

These defaults make the proposal concrete and can be changed during brainstorming.

| Area | Proposed default | Why |
| --- | --- | --- |
| Platform | Single-player desktop browser first; keyboard and mouse. | Lets us prove the demanding world, combat, and art systems together. |
| Character | Classless shared tree with suggested starting paths. | Supports melee, ranged, magic, and hybrid experimentation. |
| Camera | Fixed 2D top-down view; exact tilt and scale chosen by an art prototype. | Keeps code-generated equipment and world geometry manageable and readable. |
| World | Persistent seed, generated on demand, with recorded changes. | Returning to a town should feel like returning to a place. |
| Difficulty | Walking farther reveals geography; stronger global danger tiers are explicitly selected at sanctuary waypoints. | Preserves exploration and prevents invisible boundary-based difficulty spikes. |
| Tier changes | Reuse terrain, buildings, exploration, and persistent settlements; regenerate eligible encounters and tier-scaled rewards. | Gives stronger expeditions without replacing the player's world. |
| Progression | Finite simultaneous tree allocations, continuing item projects, discoveries, and danger advancement. | Keeps build decisions meaningful over extended play. |
| Death | Respawn at a sanctuary with a modest recoverable setback; no default permanent character loss. | Supports learning and experimentation. Exact penalties require playtesting. |
| Persistence | Local autosaves with explicit export/import and visible failure recovery. | Makes the first playable useful without an account service. |
| Business model | Undecided. No progression design should depend on purchases. | Keeps the initial design focused on play. |

Night changes atmosphere, encounter composition, and opportunities. It should not silently invalidate a difficulty choice. Local threats such as bosses and cursed landmarks must be signaled before commitment.

## Scope boundaries for the first version

The complete vision includes cities, thousands of tree nodes, many biomes, and a large procedural art vocabulary. The first playable proves the connected experience with much smaller content counts; see the [roadmap](roadmap.md).

Multiplayer, competitive economies, mobile controls, destructible buildings, player construction, companions, hunger, and a live-service seasonal structure are possible later discussions. None is required to make the core concept work. Additions should earn their complexity by improving exploration, combat, or build expression.

Missing foundations now included in the design are enemy behavior and encounter direction, loot and crafting, resources and status effects, death and recovery, discovery and objectives, world persistence, audio, accessibility, onboarding, generation validation, and performance tools. They are cataloged alongside the original systems.

## What would make this successful?

- A short combat encounter feels responsive with only a basic attack and two skills.
- Traveling through a biome boundary and into a house feels continuous and readable.
- A settlement has a believable layout and gives useful reasons to return.
- A player can identify equipped weapon and armor changes without opening a menu.
- A newcomer can plan a useful path through a small tree; a larger tree preserves that clarity.
- A second expedition offers a new decision, discovery, or build opportunity.
- Long exploration remains smooth, and saving, reloading, and returning to known places are trustworthy.

These are design acceptance criteria. Device-specific performance targets and measurements belong in the [technical foundations](technical-foundations.md).

## Questions to revisit after the first prototypes

1. **Movement:** WASD with pointer aiming, click-to-move, or both? Begin with WASD and pointer aiming, then compare using the same encounter.
2. **Combat pace:** how much commitment should heavy attacks have, and how generous should dodge cancellation be?
3. **Art:** which degree of top-down tilt makes equipment, roofs, and enemy intent clearest?
4. **Progression:** when should allocation points stop growing, and which continuing rewards still feel valuable afterward?
5. **Exploration:** how often should quiet travel turn into a discovery or fight before the wilderness feels crowded?
6. **Fiction:** does the Evergrowth premise fit the intended tone, or should the world be more grounded?
7. **Scope:** are controller support, cloud saves, or cooperative play important enough to change the early architecture?

Implementation should resolve prototype questions with playable evidence and record decisions here. The roadmap is organized by proof and dependencies rather than speculative release dates.
