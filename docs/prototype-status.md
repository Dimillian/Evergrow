# Local combat prototype

Checkpoint date: 2026-09-05. The current pass develops the first playable Deadwood slice in response to feedback about stiff movement, animation, lighting, and the HUD. Gameplay feel and visual acceptance belong to the user in the existing Codex in-app browser tab.

## Implemented

- One continuous seeded Deadwood biome with a clear starting area, winding protected trails, rocks, living/dead trees, and lantern shrines.
- Terrain generated on demand with a bounded tile cache; stable prop identities and collision across positive and negative coordinates.
- Procedural tree, rock, shrine, and equipment shapes with material marks and finite sprite caches. The concept PNGs remain design references and are not runtime assets.
- A larger articulated character rig with visible helmet, shoulder armor, cloak, boots, and sword. Directional strides, body motion, cloth movement, casting poses, and phased swings support continuous animation. Stalkers, brutes, and casters retain distinct silhouettes.
- Keyboard movement and pointer aiming with smoother velocity changes, render interpolation, and input buffering. Movement continues through the basic attack, and recovery allows responsive transitions into the next action. Combat runs continuously without hitstop.
- One repeated basic weapon attack driven by character and equipped-weapon stats. Attack timing, reach, and damage are derived from those definitions. There is no automatic combo chain; a future skill may introduce one explicitly.
- Ember projectiles, two regenerating dodge charges, and healing flasks. Enemy telegraphs, attacks, recovery, hit reactions, knockback, and collision remain gameplay state, independent of visual effects.
- Dynamic colored illumination from the player, shrines, attacks, projectiles, and impact flashes. A bounded light map combines cool ambient light with warm fire and colored magic; nearby trunks and rocks cast shadows.
- Flying sparks, curved trails, bright particle cores, impact rings, damage numbers, and ambient motes. Effects have bounded lifetimes and collection sizes.
- Bounded enemy populations with gradual introduction of heavy and ranged enemies; health/focus pickups, flask recovery through kills, death, and restart.
- A smaller centered floating HUD with detailed metal framing, animated red and blue liquid orbs, resource numbers, skill icons, cooldowns, and charges. Character, inventory, skill-tree, and journal shortcuts are visible but disabled; the gear button opens settings. World drawing continues behind the HUD.
- No runtime how-to text, control legends, or introductory combat tips. Small bindings remain on their skill buttons; control documentation is available in the repository README.
- Pause/settings, synthesized audio, a code-defined bitmap font, reduced-motion preferences, and distinct CRT/phosphor/clean display modes. Presentation preferences are stored locally when browser storage is available.

## Architecture chosen for this experiment

The local Vite/TypeScript application has no runtime package dependencies. Canvas 2D builds the world and characters from procedural definitions and draws them into a logical-resolution scene buffer. Modular character and equipment drawing allows the rig to evolve without importing static character sprites.

Combat runs on a deterministic 120 Hz clock. Rendering interpolates simulation snapshots so actors can move smoothly between fixed ticks. The loop bounds catch-up, preserves short input taps, clears combat input over the HUD, and pauses on focus or menu changes. Hit feedback does not pause the simulation. Character and equipped-weapon definitions provide the basic attack parameters; an inventory or item-swapping interface is not implemented yet.

The rendering layer owns camera motion, particles, trails, and flashes. Lighting uses a half-resolution surface light map, cached procedural light stamps, and bounded shadow casting. Limits on lights, occluders, particles, and transient effects keep their cost from growing with the explored world.

The WebGL presentation pipeline extracts bright colors at quarter resolution, blurs them horizontally and vertically through two reusable targets, and composites bloom with scanlines and an RGB phosphor mask. CRT uses moderate bloom and warmer color; phosphor strengthens the glow and colored display treatment. Clean bypasses those display effects. No geometric screen distortion changes pointer aiming. HUD bounds suppress filtering and bloom around small labels and resource orbs. A clean Canvas fallback remains available when WebGL is unavailable.

The Canvas HUD shares its geometry with transparent HTML controls so accessible labels, disabled menu states, the settings button, and pointer blocking match the artwork. The liquid animation never changes the underlying resource values.

This renderer remains an experiment. Performance on the user's normal play setup, readability in motion, and combat feel determine the next changes.

## Validation and next feedback

Code verification uses deterministic engine tests, TypeScript checking, and a production build. Relevant checks include combat geometry, one hit per attack window, repeat-attack timing, stat-derived attack parameters, buffering and cancellation, dodge protection, swept projectiles, healing and reward identity, spawn limits, reproducibility, collision, route access, and cache bounds. HUD layout checks cover narrow and desktop viewports; code-level WebGL checks cover pass bindings, storage reuse, context restoration, and cleanup.

Code checks do not establish gameplay feel or visual acceptance. The user performs all gameplay and visual verification in the existing in-app browser. Optional browser regression tests remain separate and require the user's explicit request; do not drive gameplay, take over their session, or launch another browser to assess this pass.

Useful feedback areas are movement continuity, repeated attack cadence, sword reach and weight, dodge responsiveness, enemy pressure, character proportions, lighting contrast, particle density, HUD size, and shader strength. These are observations to gather through the user's feedback, not an acceptance checklist they must complete.

## HUD references

The floating centerpiece uses bottom-center action grouping and clear resource anchors as design references. Blizzard discusses its bottom-center PC action-bar layout in the [Diablo IV UI design update](https://news.blizzard.com/en-gb/article/23308274/diablo-iv-quarterly-updatefebruary-2020). Grinding Gear Games' [archived interface screenshot](https://webcdn.pathofexile.com/public/chris/old/11.jpg), published in its [development screenshot history](https://www.pathofexile.com/forum/view-thread/445682), provides another reference for orb-based ARPG controls. Evergrowing's frame, icons, and orb animation are generated in code; no reference artwork is imported.

## Deliberately deferred

Additional biomes, towns and building interiors, a skill tree, equipment swapping and inventory, crafting, persistent character/world saves, danger tiers, controller/mobile support, and multiplayer. Combo mechanics are deferred to a possible future skill; the default attack remains a single stat-driven action. Kills and combat state are per run; only presentation preferences survive reload.

The project stays local. Local Git checkpoints preserve coherent changes. No Site, deployment, Git remote, or push is part of this work.
