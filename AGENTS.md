# Working on Evergrowing

## User preferences

- Keep the game local. Do not create, connect, publish, or deploy a Site unless the user explicitly requests it.
- Use the Codex in-app browser for previews, reusing the existing local game tab.
- The user does gameplay testing and provides feedback on combat feel, movement, balance, and visuals. Do not drive gameplay, launch another browser, or run automated browser playtests unless explicitly asked.
- The user requested town/city layout captures on 2026-09-05. Static scene staging and captures in the in-app browser are authorized for that request; keep their playable session separate.
- Code-level tests, type checking, and production builds are appropriate. Existing optional browser regression tests require the user's explicit request before running.
- Keep the local development server available while the user tests. Avoid unnecessary reloads during their play session.
- Use local Git checkpoints for coherent changes. Do not add a remote or push unless requested.

## Current scope

The local slice now includes connected Deadwood, Verdant Forest, and swamp terrain; procedural settlements with enterable buildings; and exploration maps. Continue to prioritize the procedural asset engine, smooth transitions, readable navigation, and satisfying combat. Trading, skill trees, equipment screens, and other larger systems remain future work.

The basic attack is one repeatable action driven by character stats and equipped-weapon stats. Do not reintroduce an automatic combo chain; combos may become a separate skill in future work. Keep movement and combat continuous, without hitstop. The runtime game view has no how-to text or control legend; small bindings on skill buttons are intentional. Character, inventory, skill-tree, and journal HUD shortcuts remain disabled until those systems are requested.

With only one weapon equipped, the character holds it with both hands. Both hands must stay attached to its hilt through movement and attacks; casting may briefly release and smoothly regrip. An occupied off-hand slot will support a shield or second weapon later. Do not return the empty off-hand to a dangling idle stance.

The sword needs a clearly visible metal-gold arc that sweeps, tapers, and disperses with the blade. The user wants a dynamic arc, not its removal or a tiny glint. The starter sword currently attacks twice per second; further cadence and impact changes should follow the user's playtest feedback. Contact effects and damage must follow the blade's sweep.

Draw HUD and text, including damage numbers, at native display resolution after world post-processing. Use the locally bundled Pixelify Sans font and natural glyph metrics; do not recreate letters from individually rounded pixel rectangles. Font files are a deliberate exception to procedural world/equipment art, with their license bundled locally.

Use one fixed CRT treatment with soft phosphor glow, faint scanlines, and a low-contrast RGB grille. The user requested removing settings and filter switching. Do not reintroduce selectable display modes, the HUD gear, or a settings panel. Keep Escape pause/resume and N sound toggle; reduced motion follows the operating system automatically.

## Project layout

- `game/`: standalone Vite + TypeScript application; no runtime package dependencies.
- `game/src/simulation.ts` and `model.ts`: deterministic 120 Hz combat state, rules, and render interpolation snapshots.
- `game/src/equipment.ts`: character and equipped-weapon stats used to derive the basic attack.
- `game/src/world.ts`: seeded terrain, props, collision, and bounded tile caching.
- `game/src/biomes.ts` and `settlements.ts`: continuous biome weights, deterministic town layouts, shared building/collision geometry, and points of interest.
- `game/src/environment-art.ts` and `settlement-art.ts`: procedural biome silhouettes, furnished buildings, roof fading, and settlement lights.
- `game/src/ground-layer.ts`: bounded terrain composition before subpixel camera sampling; keep tile joins inside one surface to avoid seams.
- `game/src/art.ts`: procedural Canvas assets, modular equipment, articulated character rigs, and phased attack motion.
- `game/src/player-arm-rig.ts`: facing-relative arm joints with separate depth and height, projected into the 2D art; shoulder armor must use the same joint anchors and upper-arm direction.
- `game/src/attack-motion.ts`: shared angular motion for visible swings and swept melee contact.
- `game/src/character-pose.ts`: common player pose for the character, ribbon, sparks, and weapon light.
- `game/src/renderer.ts`: interpolated scene composition, camera, actors, and a separate native-resolution UI pass.
- `game/src/camera.ts`: smooth bounded wheel zoom and shared world/screen projection. Keep the HUD and damage-text size independent of camera zoom; terrain, object coverage, and lights must follow the visible world bounds.
- `game/src/lighting.ts`: bounded dynamic light map, cached light stamps, and prop shadows.
- `game/src/effects.ts`: bounded combat particles, trails, flashes, and damage numbers; effects never drive gameplay.
- `game/src/sword-trail.ts`: sampled world-space metal-gold ribbons following the weapon.
- `game/src/postfx.ts`: world-only WebGL bloom passes, CRT/phosphor display treatment, and clean fallback.
- `game/src/hud.ts`, `hud-icons.ts`, `hud-orb.ts`, and `font.ts`: compact procedural floating HUD, shared layout/hit bounds, engraved skill/menu icons, animated resource glass, and native font rendering.
- `game/src/assets/fonts/` and `typography.css`: locally bundled Pixelify Sans, source/license records, and shared menu typography.
- `game/src/main.ts`: input, loop, pause menu, local audio preference, and system reduced motion.
- `game/src/exploration.ts` and `world-map.ts`: discovered terrain/POIs, local exploration persistence, smoothly scrolling minimap, and interactive world map.
- `game/layouts.html` and `game/src/layout-review.ts`: dev-only static scene staging and PNG export using the real renderer; never advances gameplay or changes exploration saves.
- `game/rig.html` and `game/src/rig-review.ts`: dev-only frozen character poses across eight facings, without driving gameplay.
- `game/hud.html` and `game/src/hud-review.ts`: dev-only frozen healthy, damaged, and depleted HUD states with PNG export; no gameplay or save access.
- `docs/`: design documents and reference concepts, not runtime assets.

From the repository root: `npm run setup`, `npm run dev`, `npm test`, and `npm run build`. Engine tests require Node.js 22.13 or later for TypeScript stripping.

World map opens with M, Tab while playing, or the minimap; M/Escape closes it. The map pauses combat and shows explored terrain only. N toggles audio. Interior entry is movement through an open doorway in shared world coordinates; fading roofs must never change collision. Keep towns protected from enemy spawns and pursuit. World and character saves remain separate from the locally retained exploration map.
