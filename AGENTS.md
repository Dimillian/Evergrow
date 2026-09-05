# Working on Evergrowing

## User preferences

- Keep the game local. Do not create, connect, publish, or deploy a Site unless the user explicitly requests it.
- Use the Codex in-app browser for previews, reusing the existing local game tab.
- The user does gameplay testing and provides feedback on combat feel, movement, balance, and visuals. Do not drive gameplay, launch another browser, or run automated browser playtests unless explicitly asked.
- The user requested town/city layout captures on 2026-09-05. Static scene staging and captures in the in-app browser are authorized for that request; keep their playable session separate.
- Code-level tests, type checking, and production builds are appropriate. Existing optional browser regression tests require the user's explicit request before running.
- Keep the local development server available while the user tests. Avoid unnecessary reloads during their play session.
- Use local Git checkpoints for coherent changes. Do not add a remote or push unless requested.
- This is an unreleased prototype for the user’s own testing. Prefer the cleanest current design over backward compatibility. When replacing a system, update its callers/tests and remove obsolete implementations, exports, adapters, and legacy-only tests. Do not keep old features or build compatibility layers for hypothetical consumers. Old save formats may be invalidated when a design change requires it; migrations are not required at this stage. Mention any resulting test-progress reset. Git checkpoints provide the history.

## Current scope

The local slice now includes connected Deadwood, Verdant Forest, and swamp terrain; procedural settlements with enterable buildings; and exploration maps. Continue to prioritize the procedural asset engine, smooth transitions, readable navigation, and satisfying combat. Trading, skill trees, equipment screens, and other larger systems remain future work.

The Astral skill row contains basic attack (LMB) and exactly five empty skills (RMB, 1–4). Potion (Q) and dodge (Space) occupy separate utility shortcuts beside the menu rail. Unassigned controls do nothing. There is no default player fireball. Proper skills and wand attacks are future work; their design need not preserve the old fireball implementation. Do not restore universal right-click casting.

The basic attack is one repeatable action driven by character stats and equipped-weapon stats. Do not reintroduce an automatic combo chain; combos may become a separate skill in future work. Keep movement and combat continuous, without hitstop. The runtime game view has no how-to text or control legend; small bindings on skill buttons are intentional. Character, inventory, skill-tree, and journal HUD shortcuts remain disabled until those systems are requested.

With only one weapon equipped, the character holds it with both hands. Both hands must stay attached to its hilt through movement and attacks; casting may briefly release and smoothly regrip. An occupied off-hand slot will support a shield or second weapon later. Do not return the empty off-hand to a dangling idle stance.

The sword needs a clearly visible metal-gold arc that sweeps, tapers, and disperses with the blade. The user wants a dynamic arc, not its removal or a tiny glint. The starter sword currently attacks twice per second; further cadence and impact changes should follow the user's playtest feedback. Contact effects and damage must follow the blade's sweep.

Draw HUD and text, including damage numbers, at native display resolution after world post-processing. Use the locally bundled Pixelify Sans font and natural glyph metrics; do not recreate letters from individually rounded pixel rectangles. Font files are a deliberate exception to procedural world/equipment art, with their license bundled locally.

Use one fixed CRT treatment with soft phosphor glow, faint scanlines, and a low-contrast RGB grille. The user requested removing settings and filter switching. Do not reintroduce selectable display modes, the HUD gear, or a settings panel. Keep Escape pause/resume and N sound toggle; reduced motion follows the operating system automatically.

## Project layout

- `game/`: standalone Vite + TypeScript application; no runtime package dependencies.
- `game/src/simulation.ts` and `model.ts`: deterministic 120 Hz combat state, rule execution, and render interpolation snapshots.
- `game/src/combat-content.ts`, `encounter-director.ts`, and `combat-geometry.ts`: immutable balance definitions, encounter policy, and swept contact geometry. HUD/telegraph/action timing must consume shared definitions rather than duplicating gameplay values.
- `game/src/equipment.ts`: immutable starter definition and per-player equipment copies used to derive the basic attack.
- `game/src/world.ts`: seeded terrain, props, collision, and bounded tile caching.
- `game/src/road-shape.ts` and `road-art.ts`: continuous road contours, blended junctions, worn cobbles, and gravel. Keep visual shoulders inside the existing clear corridor and preserve the shared road centerlines.
- `game/src/ground-surface.ts`: world-aligned terrain samples interpolated per pixel; neighboring tiles must produce the same color field without blocky sample boundaries.
- `game/src/biomes.ts` and `settlements.ts`: continuous biome weights, deterministic town layouts, shared building/collision geometry, and points of interest.
- `game/src/world-query.ts` and `world-pois.ts`: per-request work/precision bounds and the shared POI kind registry. Cached settlements are frozen blueprints; future mutable world state belongs separately under stable IDs.
- `game/src/environment-art.ts` and `settlement-art.ts`: procedural biome silhouettes, furnished buildings, roof fading, and settlement lights.
- `game/src/ground-layer.ts`: bounded terrain composition before subpixel camera sampling; keep tile joins inside one surface to avoid seams.
- `game/src/art.ts`: current entrypoint for procedural character drawing and props; it may be replaced with direct imports as callers evolve. `art-types.ts`, `art-primitives.ts`, `prop-art.ts`, `equipment-art.ts`, `character-motion.ts`, `player-art.ts`, and `enemy-art.ts` own the implementation by responsibility.
- `game/src/player-arm-rig.ts`: facing-relative arm joints with separate depth and height, projected into the 2D art; shoulder armor must use the same joint anchors and upper-arm direction.
- `game/src/attack-motion.ts`: shared angular motion for visible swings and swept melee contact.
- `game/src/character-pose.ts`: common player pose for the character, ribbon, sparks, and weapon light.
- `game/src/renderer.ts`: interpolated scene composition, camera, actors, and a separate native-resolution UI pass.
- `game/src/scene-visibility.ts`: padded viewport coverage for props/buildings, invalidated when the world or visible bounds change.
- `game/src/camera.ts`: smooth bounded wheel zoom and shared world/screen projection. Keep the HUD and damage-text size independent of camera zoom; terrain, object coverage, and lights must follow the visible world bounds.
- `game/src/lighting.ts`: bounded dynamic light map, cached light stamps, and prop shadows.
- `game/src/effects.ts`: bounded combat particles, trails, flashes, and damage numbers; effects never drive gameplay.
- `game/src/sword-trail.ts`: sampled world-space metal-gold ribbons following the weapon.
- `game/src/postfx.ts`: world-only WebGL bloom passes, CRT/phosphor display treatment, and clean fallback.
- `game/src/hud.ts`, `hud-frame.ts`, `hud-layout.ts`, `hud-icons.ts`, `hud-orb.ts`, and `font.ts`: the selected Astral Instrument HUD, shared layout/hit bounds, calibrated silver rings and celestial engraving, skill/menu icons, animated resource glass, and native font rendering. Keep its materials and suspended-plate silhouette when extending it.
- `game/src/enemy-focus.ts` and `enemy-plate.ts`: visual enemy hover/recent-hit focus and the native top name/health plate. Use interpolated body bounds and the current camera transform; hover takes priority, dead/offscreen targets clear, and attack aiming remains unchanged.
- `game/src/assets/fonts/` and `typography.css`: locally bundled Pixelify Sans, source/license records, and shared menu typography.
- `game/src/main.ts`: font loading, bootstrap, and hot replacement. `game.ts` coordinates systems and application phases; `game-shell.ts` owns DOM menus and controls; `game-input.ts` owns held controls and action edges; `lifetime.ts` handles reverse-order teardown and startup rollback.
- `game/src/ui-hit-test.ts`: shared UI boundary for combat input, enemy hover, and cursor drawing. New panels must join this boundary and clear buffered simulation inputs when changing control context.
- `game/src/ui-theme.ts`, `ui-kit.css`, `ui-icons.ts`, and `ui-components.ts`: shared DOM/Canvas palette, window/control primitives, decorative SVG icons, and abortable modal focus management. `game-menu.ts` builds start/pause/defeat windows. Read `docs/ui-kit.md` before expanding inventory or other panels; extend shared primitives rather than adding independent themes.
- `game/src/exploration.ts` and `world-map.ts`: discovered terrain/POIs, local exploration persistence, smoothly scrolling minimap, and interactive world map.
- `game/src/exploration-save.ts` and `map-view.ts`: transactional save validation and pure map projection/zoom limits. Schemas and exports may change with the current design; no backward-compatibility or migration requirement applies to this prototype.
- `game/layouts.html` and `game/src/layout-review.ts`: dev-only static town, interior, and road scenes with PNG export using the real renderer; never advances gameplay or changes exploration saves.
- `game/rig.html` and `game/src/rig-review.ts`: dev-only frozen character poses across eight facings, without driving gameplay.
- `game/hud.html` and `game/src/hud-review.ts`: dev-only frozen healthy, damaged, and depleted player HUD/enemy plate states with PNG export; no gameplay or save access.
- `game/ui.html` and `game/src/ui-review.ts`: dev-only static review of actual windows and reusable UI primitives at desktop/narrow sizes, with frozen rendering and memory-only exploration.
- `game/hud-directions.html`, `game/src/hud-directions-review.ts`, and `hud-concept-*.ts`: dev-only historical HUD art propositions; the user selected Astral, whose frame is shared with the runtime. Frozen scene, shared content, no gameplay/save access or theme switching. See `docs/hud-directions.md`.
- `docs/`: design documents and reference concepts, not runtime assets.

From the repository root: `npm run setup`, `npm run dev`, `npm test`, and `npm run build`. `npm run check` runs code tests, strict/core compilation, and a production build; it never runs browser gameplay tests. `npm run stats` prints source/content counts and last-build sizes. Engine tests require Node.js 22.13 or later for TypeScript stripping.

The headless core must compile with `tsconfig.core.json` without DOM or Node globals. Runtime imports must stay acyclic. Read `docs/architecture.md` for ownership and extension guidance, and `docs/system-status.md` for current content, budgets, and verified limitations.

World map opens with M, Tab while playing, or the minimap; M/Escape closes it. The map pauses combat and shows explored terrain only. N toggles audio. Interior entry is movement through an open doorway in shared world coordinates; fading roofs must never change collision. Keep towns protected from enemy spawns and pursuit. World and character saves remain separate from the locally retained exploration map.
