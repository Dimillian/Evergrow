# Evergrowing

A browser ARPG about exploring an unending gothic wilderness and shaping a character through a vast, classless skill tree. Its world, equipment, characters, and effects are drawn from procedural definitions in code.

The **local playable prototype** is in `game/`: fluid combat, a visibly equipped character, connected Deadwood/verdant/swamp biomes, and procedural settlements with walk-in interiors. A scrolling minimap and explored-world map track your travels. Artwork is generated in code, with dynamic lights, combat particles, a floating HUD, and CRT/phosphor presentation. The broader design documents remain proposals for later development.

## Play locally

Use Node.js 22.13 or later. From this repository:

```sh
npm run setup
npm run dev
```

Open [Evergrowing locally](http://127.0.0.1:5173/) in the Codex in-app browser. The server binds to this machine only. No account, external media, or hosted service is required.

| Control | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse | Aim |
| Mouse wheel over the world | Smooth camera zoom in / out |
| Hold left mouse | Repeat the basic weapon attack |
| Right mouse / 1–4 | Use assigned skills; empty slots do nothing |
| C / I | Character, equipment, inventory, and attributes |
| T | Skill tree and active skill assignments |
| Space | Dodge, using one of two regenerating charges |
| Q | Healing flask; charges return through kills |
| Escape | Close a panel, pause, or resume |
| M | Open or close the world map |
| Tab while playing / click minimap | Open the world map |
| Map: drag / scroll / + and − | Pan / zoom |
| N | Toggle synthesized sound |
| F3 | Frame-rate and coordinate overlay |

The basic attack derives its timing, reach, and damage from character and equipped-weapon stats. A single equipped weapon uses both hands on its hilt; the rig has an independent-hand stance for future shields or second weapons. There is no automatic combo chain; a combo could become a separate skill later. Character, inventory, and skill-tree HUD shortcuts are active; the journal remains unavailable. The skill row starts with basic attack plus five empty wells. Unlock major nodes and assign their skills to RMB/1–4 from the tree. Potion (Q) and dodge (Space) have separate shortcuts. There is no universal fireball: Ember Lance requires unlocking and assignment.

The camera smoothly zooms around the character from 0.65× to 1.8× with the mouse wheel or a trackpad scroll. HUD, minimap, and damage text keep their size; aiming, lighting, and particles follow the world view. The selected zoom remains through a new run but resets on page reload.

The HUD and damage numbers render at native display resolution above the world shader. UI typography uses locally bundled [Pixelify Sans](game/src/assets/fonts/SOURCE.md), licensed under the SIL Open Font License; no external font service is used.

The compact HUD uses dark metalwork, engraved skill icons, and subtly animated resource glass. A violet XP rail beneath the skills shows the current level and exact experience toward the next one. Kills grant 20 XP (stalker), 30 XP (hexer), or 50 XP (brute); the first level needs 100 XP and each following level needs 50 more. Excess XP carries over. Every level grants one skill point and five attribute points to spend. New runs start at level 1 with 0 XP; character progress is run-local and resets on restart/reload. A local [static HUD review](http://127.0.0.1:5173/hud.html) shows healthy, damaged, and depleted states without advancing gameplay or touching saves.

The selected [Astral Instrument HUD](docs/hud-directions.md) uses calibrated silver rings, celestial engraving, and suspended black-steel skill plates. Its live resources, charges, cooldowns, and damage feedback retain native-resolution text. Compare the original three studies in the local [HUD directions preview](http://127.0.0.1:5173/hud-directions.html), or inspect the live healthy/damaged/depleted states at [HUD review](http://127.0.0.1:5173/hud.html) (`?size=narrow` for 390px).

Menus and maps share a retro interface kit: slate surfaces, fine brass edges, jade actions, crisp typography, and consistent keyboard focus. The local [interface review](http://127.0.0.1:5173/ui.html) shows the actual start, pause, defeat, and map windows alongside reusable controls and item-slot primitives in desktop and narrow layouts.

Hover an enemy to see its name and health at the top of the screen. A subtle marker identifies the focused mob, and enemies you hit stay on the plate briefly while you fight. Names and health remain crisp at every camera zoom.

The world uses one fixed presentation: soft CRT scanlines combined with restrained phosphor glow and a subtle RGB grille. There is no settings panel or filter switching. Reduced motion follows the operating system; N still toggles sound.

Walk west from Deadwood to reach Verdant Forest, east to reach the swamp, or follow the road north to the first settlement. Enter buildings through their open south-facing doors; roofs fade and warm interior lighting blends in without changing spaces. Shops and the forge have distinct furnished interiors; trading is not implemented yet.

The large map pauses combat. Hover over discovered points of interest for details, and use its recenter control to return to your position. Exploration is retained locally for this world seed and generation version; starting a new run resets combat and position while keeping the explored map. Character progress is not saved yet.

The user owns gameplay and visual verification in the in-app browser and directs the next changes. See [prototype status](docs/prototype-status.md) for what is implemented and deliberately deferred. Control documentation stays here; the game view has no how-to text or control legend.

`npm run check` runs deterministic/code-level tests, strict application and browser-independent core type checks, and the local production build. It excludes automated browser playtesting. `npm run stats` reports current code/content counts, resource limits, and last-build sizes. The source is tracked in a local Git repository with no remote.

## Start here

| Document | What it answers |
| --- | --- |
| [Game brief](docs/game-brief.md) | What is the game, what makes it distinctive, and what must it deliver? |
| [Systems catalog](docs/systems-catalog.md) | What systems exist, how do they connect, and what is needed first? |
| [Combat and progression](docs/combat-and-progression.md) | How do fighting, builds, loot, and endless advancement work? |
| [World and art](docs/world-and-art.md) | How does the wilderness grow, how do settlements work, and how is everything drawn? |
| [Technical foundations](docs/technical-foundations.md) | How could a browser deliver this, and which assumptions need prototypes? |
| [Roadmap](docs/roadmap.md) | In what order should we prove and build the game? |
| [Implemented architecture](docs/architecture.md) | Which module owns each system, and where should we extend it? |
| [Character systems](docs/character-systems.md) | What are the gear, stat, skill, XP, and loot rules implemented now? |
| [Interface kit](docs/ui-kit.md) | Which visual and interaction primitives should new windows and inventory reuse? |
| [System status and stats](docs/system-status.md) | What exists today, which checks pass, and what are the current limits? |

Read the brief first, then the roadmap. The systems catalog is the implementation inventory; the three deeper documents explain the intended behavior.

## Working direction

- **Exploration:** continuous seeded terrain, large streamed chunks, smooth biome borders, inhabited settlements, and houses entered without a loading interruption.
- **Combat:** immediate movement and attacks, readable enemy intent, strong impact feedback, and equipment that visibly changes the player.
- **Progression:** a shared tree eventually containing thousands of meaningful choices; limited simultaneous allocations keep builds distinct.
- **Endlessness:** new territory and repeatable advancement in player-selected danger tiers, with curated content rules that create variety.
- **Presentation:** fully 2D top-down, dark gothic, fluid, lit, and entirely generated from code-defined art.
- **First release assumption:** single-player desktop browser, keyboard and mouse, local saves with export/import. These platform and scope choices remain open to discussion.

The prototype now connects combat, procedural exploration, settlements, maps, equipment, attributes, and a 2,788-node skill atlas. The next step is the user’s gameplay and balance feedback; trading, crafting, off-hand gear, respecs, and persistent characters remain future work.

## Visual exploration

The [concept gallery](docs/concepts/README.md) shows forest exploration, swamp combat, a village blacksmith interior, and the skill-tree screen. The [retro art direction](docs/retro-art-direction.md) develops the new visual steering: procedural shapes, pixel typography, fluid movement, and subtle optional CRT/phosphor effects. Exact generation prompts are saved with the images.

The [settlement capture gallery](docs/captures/2026-09-05/README.md) shows the procedural buildings, furnished interiors, and revised roads with rounded junctions, worn cobbles, and softer wilderness shoulders. Open the local [layout review](http://127.0.0.1:5173/layouts.html) to stage these views with the game's renderer and export PNGs without advancing gameplay or changing the explored map. This review page is available only through the development server.

## Character and skill foundation

The armory has a live equipment doll, ten equipment positions, an 8×6 inventory, and effective combat stats. Drag items into equipment slots or shift-click to equip; shift-click equipped gear to return it to an empty bag cell. Select an item for actions and inspection, or hover/focus it for a comparison. Replacing equipped gear works even with a full bag. Strength, Dexterity, Intelligence, and Vitality feed the same stat derivation as item affixes and skill nodes.

Monsters drop seeded gear with procedural names/icons, item levels, and five rarity tiers. The first kill guarantees gear; later kills have a 45% drop chance. Walking within 30 world units collects visible loot into the bag; full bags leave it on the ground. Four spare level-1 items make equipment interaction available immediately.

The skill atlas connects 150 organically spaced constellations with three winding arteries and curved crosslinks between Might, Cunning, and Arcana. Its 2,788 nodes include 1,528 themed minors, 1,103 attribute travel stars, 150 notables, six major skill unlocks, and a free origin. Each constellation develops a consistent specialty; varied rings, crescents, fans, and branches make those groups readable. Every major is three points from the origin. Pan, zoom, search, filter, inspect, and allocate connected nodes; hovering or selecting a destination previews the shortest route and remaining point cost from the current build. Procedural engravings identify the actual stat or skill at closer zoom. The six initial skills are Crescent Cleave, Rift Lunge, Ember Lance, Astral Nova, Thorn Volley, and Soul Siphon. They are initial action recipes for iteration, alongside seven authored specialty families per discipline.

The [frozen character review](http://127.0.0.1:5173/character.html?panel=character) and [skill review](http://127.0.0.1:5173/character.html?panel=skills) use actual panels with staged level-10 data. These development-only views never tick combat or read/write saves. [Panel captures](docs/captures/2026-09-05/character-systems/README.md) show the result.
