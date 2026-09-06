# Documentation

Updated 2026-09-06. Use the current guides for implementation. Proposed designs and historical captures are labeled separately; they do not override current code or user decisions.

## Start here

- [Current system status](system-status.md): implemented features, source/content counts, limits, verification and recent checkpoints.
- [Roadmap](roadmap.md): completed foundations, town economy delivery status and later candidates.
- [Systems catalog](systems-catalog.md): stable system IDs with current coverage and remaining work.
- [Architecture](architecture.md): code ownership, boundaries and extension rules.
- [Controls](controls.md): current player controls.
- [Android and AYN Thor](android-thor.md): offline APK, native controller input, companion screen and local saves.
- [Touch gameplay and UI](touch-controls.md): touch controls, device layouts, input lifecycle and verification.

## Current system guides

| Area | Guide |
| --- | --- |
| Character proportions, equipment materials and art review | [Character art](character-art.md) |
| Character, gear, attributes and allocation | [Character systems](character-systems.md) |
| Weapon profiles, skill effects and action speed | [Weapons and skills](weapons-and-skills.md) |
| Ranks, specializations, mastery and ultimates | [Skill progression](skill-progression.md) |
| Geographic scaling, XP, loot tables and gold | [Progression and loot](progression-and-loot.md) |
| World history, retirement and current storage bounds | [World-state longevity](world-state-longevity.md) |
| Character hall, starter choices and saving | [Character saves](character-saves.md) |
| Components, typography, tooltip motion and panel ownership | [UI kit](ui-kit.md) |
| Climate generation, props and procedural graphics | [Biomes](biomes.md), [living biomes](living-biomes.md), [graphics pass](graphics-overhaul.md) |
| Drainage, cell-based water and shader optics | [Living water](living-water.md) |
| Camps, landmarks and roaming | [Wilderness and encounters](wilderness-and-encounters.md) |
| Procedural crypt floors, boss, treasure and location saves | [Dungeons](dungeons.md) |
| Chests, choices, beacons and guardian trials | [Interactive POIs](interactive-pois.md) |
| Minimal activity guidance, journal and tracked markers | [Journeys](journeys.md) |
| Explored map and review tooling | [Explored atlas](explored-atlas.md) |

## Town economy

[NPCs and vendors](npcs-and-vendors.md) documents implemented blacksmith trading/+10 enhancement, jeweler stock and enchanting. Prices, stock weights and enhancement strength are initial playtest defaults. [Service captures](captures/2026-09-05/town-services/README.md) show the shared panels and NPC art.

## Next iteration specifications

- [ChatGPT cloud saves on Sites](cloud-saves-sites.md): researched authentication, per-user storage, atomic publication and cross-device conflicts; not implemented.

- [Journeys and local leads](procedural-journeys.md): proposed procedural adventures, light onboarding, level-aware routing, journal and reward/persistence rules.

- [Town portals and waypoints](travel-and-portals.md): implemented town return/home anchors; permanent waypoint network still specified.
- [Exploration, events and dungeons](dungeons-and-events.md): proposed encounter density, new enemy roles, interactive landmarks, procedural crypt floors, bosses and persistent expedition rewards.

Interactive POIs, town portals and dungeon expeditions are live. Permanent waypoint travel and regional Journey chains remain specified; single-site Journeys are implemented.

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

- [World generation 5](world-generation.md): dispersed settlements, connected curved roads, larger climates, fixed regional danger and three seed previews.

- [Panel performance](panel-performance.md): map/skill-atlas rendering, progressive loading and CPU verification.
