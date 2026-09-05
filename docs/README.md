# Documentation

Updated 2026-09-05. Use the current guides for implementation. Proposed designs and historical captures are labeled separately; they do not override current code or user decisions.

## Start here

- [Current system status](system-status.md): implemented features, source/content counts, limits, verification and recent checkpoints.
- [Roadmap](roadmap.md): completed foundations, town economy delivery status and later candidates.
- [Systems catalog](systems-catalog.md): stable system IDs with current coverage and remaining work.
- [Architecture](architecture.md): code ownership, boundaries and extension rules.
- [Controls](controls.md): current player controls.

## Current system guides

| Area | Guide |
| --- | --- |
| Character, gear, attributes and allocation | [Character systems](character-systems.md) |
| Weapon profiles, skill effects and action speed | [Weapons and skills](weapons-and-skills.md) |
| Geographic scaling, XP, loot tables and gold | [Progression and loot](progression-and-loot.md) |
| Character hall, starter choices and saving | [Character saves](character-saves.md) |
| Components, typography, tooltip motion and panel ownership | [UI kit](ui-kit.md) |
| Climate generation, props and procedural graphics | [Biomes](biomes.md), [living biomes](living-biomes.md), [graphics pass](graphics-overhaul.md) |
| Camps, landmarks and roaming | [Wilderness and encounters](wilderness-and-encounters.md) |
| Explored map and review tooling | [Explored atlas](explored-atlas.md) |

## Town economy

[NPCs and vendors](npcs-and-vendors.md) documents implemented blacksmith trading/+10 enhancement, jeweler stock and enchanting. Prices, stock weights and enhancement strength are initial playtest defaults. [Service captures](captures/2026-09-05/town-services/README.md) show the shared panels and NPC art.

## Next iteration specifications

- [Town portals and waypoints](travel-and-portals.md): implemented town return/home anchors; permanent waypoint network still specified.
- [Interactive POIs](interactive-pois.md): camp chests, caravan choices, beacons, graveyard/stone trials and roadside reliquaries.

Interactive POIs and permanent waypoint travel are specified, not implemented. Town portals are live.

## Original vision and design exploration

[Game brief](game-brief.md), [world and art](world-and-art.md), [combat and progression](combat-and-progression.md), [technical foundations](technical-foundations.md), and [retro art direction](retro-art-direction.md) preserve the initial vision/proposals. Their proposed content counts, renderer choices, active-slot counts, sanctuary difficulty tiers, settings and migration ideas are not current requirements. Current guides and explicit user decisions supersede them.

[HUD directions](hud-directions.md) records the three art studies and selection of Astral. [Concept images](concepts/README.md) are generated visual references, not game assets.

## Historical evidence

- [Foundation checkpoints](history/foundation-checkpoints.md): older successive implementation/test snapshots, preserved with original numbers.
- [Early prototype](prototype-status.md): the initial slice before character saves and later world/combat work.
- [Expansion review](architecture-review-2026-09-05.md): pre-refactor assessment; its first three recommendations were implemented.
- [NPC readiness review](npc-vendor-readiness.md): assessment and completed item/panel consolidation; a historical pre-implementation assessment, now followed by atomic saved transactions.
- [Living forest study](living-forest.md): original motion pass and recording, later generalized to all biomes.
- [README screenshots](screenshots/README.md) and [capture gallery](captures/2026-09-05/README.md): staged evidence at capture time. Older loadouts, UI and maps are not claims about the latest playable save or visuals.

## Keeping this current

When a system changes, update its guide and any affected controls/catalog entry. Update status counts from `npm run stats`; record which checkpoint actually passed `npm run check`. Update the roadmap when a deliverable becomes implemented. Keep old numbers in historical records rather than appending contradictory “current” sections. Link to authoritative tables instead of copying balance values into unrelated docs.

Code checks and static reviews do not establish gameplay feel, economy balance or Safari performance. The player tests gameplay. Commit and push documentation with coherent code checkpoints.
