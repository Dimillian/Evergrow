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
| Hold left mouse | Repeat the basic weapon attack |
| Right mouse | Ember projectile |
| Space | Dodge, using one of two regenerating charges |
| Q | Healing flask; charges return through kills |
| Escape | Pause, resume, or start a new run |
| M | Open or close the world map |
| Tab while playing / click minimap | Open the world map |
| Map: drag / scroll / + and − | Pan / zoom |
| N | Toggle synthesized sound |
| F3 | Frame-rate and coordinate overlay |

The basic attack derives its timing, reach, and damage from character and equipped-weapon stats. A single equipped weapon uses both hands on its hilt; the rig has an independent-hand stance for future shields or second weapons. There is no automatic combo chain; a combo could become a separate skill later. Character, inventory, skill-tree, and journal shortcuts on the HUD are disabled placeholders.

The HUD and damage numbers render at native display resolution above the world shader. UI typography uses locally bundled [Pixelify Sans](game/src/assets/fonts/SOURCE.md), licensed under the SIL Open Font License; no external font service is used.

The world uses one fixed presentation: soft CRT scanlines combined with restrained phosphor glow and a subtle RGB grille. There is no settings panel or filter switching. Reduced motion follows the operating system; N still toggles sound.

Walk west from Deadwood to reach Verdant Forest, east to reach the swamp, or follow the road north to the first settlement. Enter buildings through their open south-facing doors; roofs fade and warm interior lighting blends in without changing spaces. Shops and the forge have distinct furnished interiors; trading is not implemented yet.

The large map pauses combat. Hover over discovered points of interest for details, and use its recenter control to return to your position. Exploration is retained locally for this world seed and generation version; starting a new run resets combat and position while keeping the explored map. Character progress is not saved yet.

The user owns gameplay and visual verification in the in-app browser and directs the next changes. See [prototype status](docs/prototype-status.md) for what is implemented and deliberately deferred. Control documentation stays here; the game view has no how-to text or control legend.

`npm test` runs deterministic engine tests. `npm run build` type-checks and creates the local production bundle. The source is tracked in a local Git repository with no remote.

## Start here

| Document | What it answers |
| --- | --- |
| [Game brief](docs/game-brief.md) | What is the game, what makes it distinctive, and what must it deliver? |
| [Systems catalog](docs/systems-catalog.md) | What systems exist, how do they connect, and what is needed first? |
| [Combat and progression](docs/combat-and-progression.md) | How do fighting, builds, loot, and endless advancement work? |
| [World and art](docs/world-and-art.md) | How does the wilderness grow, how do settlements work, and how is everything drawn? |
| [Technical foundations](docs/technical-foundations.md) | How could a browser deliver this, and which assumptions need prototypes? |
| [Roadmap](docs/roadmap.md) | In what order should we prove and build the game? |

Read the brief first, then the roadmap. The systems catalog is the implementation inventory; the three deeper documents explain the intended behavior.

## Working direction

- **Exploration:** continuous seeded terrain, large streamed chunks, smooth biome borders, inhabited settlements, and houses entered without a loading interruption.
- **Combat:** immediate movement and attacks, readable enemy intent, strong impact feedback, and equipment that visibly changes the player.
- **Progression:** a shared tree eventually containing thousands of meaningful choices; limited simultaneous allocations keep builds distinct.
- **Endlessness:** new territory and repeatable advancement in player-selected danger tiers, with curated content rules that create variety.
- **Presentation:** fully 2D top-down, dark gothic, fluid, lit, and entirely generated from code-defined art.
- **First release assumption:** single-player desktop browser, keyboard and mouse, local saves with export/import. These platform and scope choices remain open to discussion.

The current prototype combines the combat foundation with the first connected-biome, settlement, interior, and mapping experiments. The next step is the user's exploration and playtest feedback; trading, skill trees, and broader progression remain deferred.

## Visual exploration

The [concept gallery](docs/concepts/README.md) shows forest exploration, swamp combat, a village blacksmith interior, and the skill-tree screen. The [retro art direction](docs/retro-art-direction.md) develops the new visual steering: procedural shapes, pixel typography, fluid movement, and subtle optional CRT/phosphor effects. Exact generation prompts are saved with the images.

The [settlement capture gallery](docs/captures/2026-09-05/README.md) shows the current procedural buildings, street junctions, and furnished interiors. Open the local [layout review](http://127.0.0.1:5173/layouts.html) to stage these views with the game's renderer and export PNGs without advancing gameplay or changing the explored map. This review page is available only through the development server.
