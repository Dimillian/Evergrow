# Evergrow — world and procedural art

Status: working design proposal for discussion. **Required** marks the player-facing direction from the initial brief; **proposed** marks a recommended design choice; **experiment** marks an approach that must earn its place in a playable prototype. Numbers below are starting targets, not measured performance claims.

**Visual update, 2026-09-04:** the user has added a retro, pixel-art-adjacent direction with pixel fonts and CRT/phosphor effects, grounded in buildable procedural graphics. See the [concept gallery](concepts/README.md) and [retro art exploration](retro-art-direction.md). The images explore this direction; exact camera tilt, texture density, and shader strength remain prototype decisions.

## The world promise

**Required.** A player can walk into an apparently continuous, endlessly generated world. Large generation chunks should take roughly 20–30 seconds to cross at ordinary walking speed, with no visible seams or obvious moment of creation. Forests, swamps, settlements, interiors, lighting, and inhabitants should feel like parts of one place. The presentation is fully 2D, top-down, dark gothic, fluid, and generated from assets defined in code.

**Proposed.** “Endless” means an expandable, reproducible geography assembled from a growing vocabulary of designed rules. It does not promise infinitely many unique assets, infinite simultaneous simulation, or equal novelty at every coordinate. A recognizable world with meaningful variation is more valuable than a giant field of uncorrelated surprises.

Exploration distance and enemy danger should be independent. Travel can discover new places without silently invalidating an existing build. Sanctuary waypoints let players deliberately choose their danger tier; the same geography remains legible as encounters and rewards scale. Biomes introduce different encounter patterns and hazards, not an unavoidable outward difficulty gradient.

## Geography before decoration

**Proposed generation hierarchy:**

1. **World identity:** the seed and generation version establish the reproducible world.
2. **Regional structure:** broad climate, moisture, elevation, drainage, old routes, and settlement opportunities determine where places belong.
3. **Landmarks and connections:** rivers, crossings, ruins, sanctuaries, villages, and roads establish destinations and traversable routes.
4. **Biome composition:** world-space fields choose vegetation, ground, water, architecture accents, and transition areas.
5. **Local layout:** clearings, encounter spaces, buildings, sightlines, and interaction points create playable terrain.
6. **Visual dressing:** rocks, roots, clutter, surface marks, foliage variation, lights, and ambient motion enrich an already functional space.

Higher levels constrain lower levels. A bridge needs two reachable banks; a shop needs an accessible entrance; a boss clearing needs room for readable movement. These are generation rules, not repairs left to decoration. Roads should connect somewhere meaningful, and rivers should continue coherently across generation boundaries.

Generation chunks are bookkeeping units within this geography. A forest edge, town, river, or large landmark can cross several chunks. Adjacent chunks query shared world-space features rather than independently inventing their border contents. Features crossing boundaries need a stable owner and identifier so they are not duplicated.

Chunk dimensions follow the 20–30-second traversal target at the baseline movement speed. Movement bonuses change crossing time, not the geography. **Experiment:** prove streaming while moving diagonally, retreating through a transition, and using the fastest planned movement ability. Generate ahead of the camera with enough margin for those cases; ordinary traversal must never reveal incomplete geometry or pause at a border.

## Biomes with identities and transitions

**Required.** Multiple procedural biomes, including a dead forest, swamp, and verdant forest, with smooth transitions.

**Proposed biome vocabulary:**

| Biome | Recognizable forms and palette | Exploration and combat character |
| --- | --- | --- |
| Dead Forest | Pale forked trunks, charcoal earth, rust leaves, exposed burial stones | Broad broken sightlines, fallen-tree corridors, grave clearings |
| Swamp | Black pools, reed fans, leaning timber, green reflections | Raised paths, islands, flooded ruins, constrained crossings |
| Verdant Forest | Deep emerald masses, massive roots, violet understory, ruined white stone | Sheltered clearings, overgrown routes, alternating dense and open spaces |
| Ashen Uplands | Wind-cut rock, cinders, skeletal shrines, copper light | Longer sightlines, sparse cover, exposed ritual sites |
| Cathedral Wastes | Broken buttresses, tiled ground, collapsed cloisters, cold blue shadows | Architectural exploration, courtyards, fragmented historic streets |

The last two are expansion proposals. Each biome needs its own terrain grammar, prop families, landmark types, sound atmosphere, encounter language, and settlement adaptation. Recoloring the same forest is insufficient.

Transitions mix several signals over a broad, irregular area. Ground moisture changes first; pools and reeds appear; trees become sparse and lean; architecture adopts raised foundations. Large silhouettes remain locally coherent, rather than scattering every biome's props evenly across a noisy boundary. Transitional spaces can have their own landmarks: a drowned orchard between a town and swamp, or an abandoned charcoal camp between living and dead forest.

Environmental hazards must use consistent shapes and motion in every palette. Walkable water, blocking water, and damaging ground need distinct cues beyond color. Decorative fog must never hide an attack warning or make a passable route indistinguishable from a wall.

## Places worth remembering

**Proposed.** Regions combine small discoveries with rarer destinations. A shrine, overturned cart, unusual tree, or abandoned camp adds local texture. A bell tower, flooded abbey, market town, or enormous petrified trunk gives an expedition a destination and a silhouette the player can remember.

Landmarks should imply a history through constrained combinations. A plague village might combine barricaded courtyards, a treatment chapel, and a disused well. Its layout and props tell the same story.

Use spacing rules to prevent repetitive landmark clusters and excessively empty travel. Quiet stretches create anticipation, while discoveries provide combat, information, resources, beauty, or route choices. Tune their frequency through playtesting.

Discovery records should preserve names, map annotations, and useful icons. Players should be able to say “the blacksmith beyond the drowned orchard” and return there. Distinct settlement silhouettes, road approaches, and nearby landmarks support that memory more strongly than names alone.

## Settlements and seamless interiors

**Required.** Procedural villages, towns, and cities contain interesting layouts, shops, blacksmiths, and smoothly accessible buildings.

**Proposed.** Start from settlement grammars: a hamlet around a well, a bridge market, a walled church town, or a larger district-based city. First reserve the public space and route network, then place essential services, divide buildable plots, fit building footprints, and finally populate yards and interiors. Geography should deform the grammar: a river creates a crossing market; steep ground creates terraces; swamp buildings stand on connected platforms.

A sanctuary waypoint, merchant, and blacksmith form a readable arrival area. Doors face reachable paths. Signs, forge glow, and rooflines communicate services before the player opens a map. Decorative buildings must be distinguishable from usable entrances.

Ordinary houses share the outdoor world's coordinate space. Walking through a door crosses a threshold that blends roof visibility, interior lighting, ambient sound, and foreground occlusion. There is no mandatory loading screen. The underlying collision geometry does not change merely because the roof becomes transparent.

Roofs fade when they obstruct the player's occupied room or immediate view, with hysteresis to prevent flicker near thresholds. Adjacent roofs remain visible where possible, preserving the town silhouette. Cut away foreground walls or use consistently low wall representations; keep rear walls and structural edges so rooms remain comprehensible. Shadows and roof fading must agree about whether the character appears indoors.

Interior generation starts with circulation: reachable door, free entry space, connected rooms, reachable service counter, and sufficient player clearance. Furniture fills the remaining space. Containers and NPCs cannot seal the sole exit. A town must validate navigable paths from its entrance to every essential service and back outside.

**Proposed initial boundary:** ordinary accessible buildings use a single playable floor. Decorative upper floors are possible; functional multistory navigation and complex overlapping interiors wait until the base model works. Major dungeon thresholds may use separate spaces later, but must not weaken the seamless-house promise.

Settlements provide dependable recovery and trading. Enemy pursuit disengages at clearly communicated sanctuary limits. Destructible cities and town siege simulation are later expansion ideas.

## Day, night, and a living world

**Required.** A day and night cycle changes the appearance of the world.

**Proposed.** Time also changes ecology and atmosphere: some creatures emerge, insects gather near lamps, mist settles over water, villagers move between plausible nearby activities, and forges or windows become stronger navigation cues. Night need not apply a blanket difficulty increase. Any genuinely different threat should be introduced through observable behavior and local warning.

Start with a tunable cycle around 24 real minutes, subject to playtesting. It should be long enough to give expeditions an atmosphere, while allowing shorter sessions to experience transitions. The player can always read combat, even at the darkest hour. Essential town services remain available; flavor schedules must not force players to wait for a vendor.

“Alive” comes from layered small motion: asynchronous tree sway, ripples around reeds, candle flutter, breathing silhouettes, moving cloth, disturbed dust, and insects reacting to light. Give each layer a reason and a restrained amplitude. A screen where every prop wriggles equally looks unstable and obscures threats.

Active simulation follows the player's neighborhood. Faraway places retain persistent state and use simple elapsed-time rules when revisited; they do not need full offscreen combat or physics. Time changes atmosphere without unexpectedly destroying a player's remembered route or completed interaction.

## A code-defined gothic art system

**Required.** Art assets are represented in code, dynamically configurable, with visible equipment and fluid animation.

**Proposed visual identity.** Use a slightly elevated top-down 2D view, without committing to a strict isometric grid. Gothic character comes from pointed silhouettes, buttress-like roots, ironwork, burial architecture, worn cloth, and contrasts between cold surroundings and human warmth. Broad dark shapes establish the scene; carefully placed warm lights pull attention toward safety or activity. Enemy attacks retain their own readable accents.

Build a procedural illustration library rather than unrestricted random drawing. A tree definition contains trunk structure, branching rules, canopy masses, exposed roots, surface marks, and motion anchors. A building definition contains footprint, walls, roof, entrance, ornament, material treatment, and light anchors. Seeds vary proportions and details inside a designed family. Artists still author the rules, palettes, silhouettes, and examples that define the result.

Code-defined geometry may be drawn directly or generate reusable render surfaces. Shared detail patterns, controlled edge highlights, and deliberate shape simplification create depth without a hand-painted sprite library.

Characters use layered body parts with pose and deformation controls: torso, head, limbs, hands, armor panels, weapons, hair, and cloth. Equipment occupies consistent attachment points, with ordering rules for each facing. A sword swing changes pose and silhouette, not merely the angle of an icon. Armor changes silhouette and material; weapons change reach and movement; smaller upgrades may use trim or emissive details.

Readable silhouettes take precedence over showing every statistical affix. Define a finite set of compatible visual equipment families, then expand them. **Experiment:** compare a layered skeletal/vector prototype against cached procedural frames for movement, attacks, casts, turns, and hit reactions. Prove that several armor and weapon combinations remain readable while fighting a crowd before expanding the item library.

## Light, impact, and visual hierarchy

Light sources belong to objects: lanterns, forge mouths, spells, windows, and a subtle player visibility light. Their radius, color, falloff, flicker, and obstruction behavior come from material or ability definitions. Interior thresholds blend exposure and ambience; entering a building should feel spatially different without making the screen flash.

**Experiment:** find an affordable combination of selective dynamic shadows, contact shadows, ambient shading, and emissive bloom. The direction requires convincing light, not physically accurate global illumination. Dense settlements and fights containing several overlapping skills must remain readable and responsive.

Impact combines pose, a short material-specific particle burst, contact flash, sound, and restrained camera feedback. Physical hits can shed dust or sparks; magic can leave a brief coherent trail. Damage numbers belong above these decorative effects in the information hierarchy. Settings should reduce flash, shake, particles, and number density independently.

Reserve the strongest contrast and clearest edges for the player, enemies, actionable objects, and attack warnings. Foreground foliage fades when necessary. Large spell effects cannot continuously obscure nearby opponents. Visual complexity must support the extremely responsive combat promised by the brief.

## Persistence and proof

Store the world seed and generation version alongside explored regions and stable identifiers. Persist changes such as discovered waypoints, opened unique containers, completed landmarks, purchased player storage, and meaningful NPC outcomes. Rebuilding a chunk must not restock a unique reward or rearrange a remembered town. Renewable enemies and resources need explicit respawn rules separate from permanent interaction history.

Old saves need a deliberate generation-version policy before content updates ship: keep their generation rules available or migrate recorded regions. “The seed is the same” alone does not protect geography when algorithms change.

The first world-and-art proof should demonstrate a continuous route across a biome boundary, a settlement with reachable services, seamless house entry, sunset, an equipped animated character, and a crowded fight. Revisit it after leaving and loading a save. Inspect for seams, duplicated features, blocked doors, roof flicker, equipment clipping, unreadable lighting, and lost interactions. Record frame pacing and generation delays against a separately agreed browser hardware target.

## Example: one ten-minute expedition

This is an illustrative generated instance, not a scripted sequence every player receives.

**0:00–2:00.** At dusk, the player leaves Bellwick's blacksmith with a broad iron shoulder plate now visible on their character. Warm forge light fades as they pass under the roof edge and into the square. They choose a known danger tier at the sanctuary and take the northern road, following a leaning bell tower beyond the trees.

**2:00–4:00.** Living forest gradually becomes drowned orchard. Roots give way to reeds, wheel ruts fill with water, and the road rises onto timber. A patrol occupies a clearing wide enough for the player's movement skill. Steel impacts throw brief sparks; reeds sway as the player dodges through them. No chunk edge is visible.

**4:00–6:00.** A fork offers a direct bridge or an optional ruined chapel. The player investigates the chapel, entering beneath a fading roof while candlelight reveals a shrine and one side room. An exterior window still shows the swamp. Activating the shrine records a lasting discovery and reveals a nearby destination on the map.

**6:00–8:00.** Night settles. Insects cluster around the player's light, and nocturnal creatures gather near the bridge, changing the encounter composition. Their approach remains visible beyond the decorative mist. A tougher guardian occupies a broad island, giving the player a clear choice to engage or continue around it.

**8:00–10:00.** The player defeats the guardian, takes a visibly different weapon, and discovers a sanctuary near an abandoned watch post. They return to Bellwick by waypoint to compare equipment and store materials. On a later walk, the chapel remains discovered, its unique reward remains claimed, and the orchard's geography is unchanged. The expedition has produced a memorable route, a build decision, and another visible destination.
