# Evergrowing

A browser ARPG about exploring an unending gothic wilderness and shaping a character through a vast, classless skill tree. Its world, equipment, characters, and effects are drawn from procedural definitions in code.

This repository currently contains design documents, not a playable game. These are a first brainstorming pass, dated **2026-09-04**. The original requirements are recorded in the game brief; additional ideas are proposals to test, not settled commitments.

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

The immediate next step is **M0 in the roadmap**: small playable experiments that prove combat feel, procedural character art, lighting, world streaming, and entering buildings. No framework or release date is committed yet.

## Visual exploration

The [concept gallery](docs/concepts/README.md) shows forest exploration, swamp combat, a village blacksmith interior, and the skill-tree screen. The [retro art direction](docs/retro-art-direction.md) develops the new visual steering: procedural shapes, pixel typography, fluid movement, and subtle optional CRT/phosphor effects. Exact generation prompts are saved with the images.
