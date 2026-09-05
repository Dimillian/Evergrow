# Working on Evergrowing

## User preferences

- Keep the game local. Do not create, connect, publish, or deploy a Site unless the user explicitly requests it.
- Use the Codex in-app browser for previews, reusing the existing local game tab.
- The user does gameplay testing and provides feedback on combat feel, movement, balance, and visuals. Do not drive gameplay, launch another browser, or run automated browser playtests unless explicitly asked.
- Code-level tests, type checking, and production builds are appropriate. Existing optional browser regression tests require the user's explicit request before running.
- Keep the local development server available while the user tests. Avoid unnecessary reloads during their play session.
- Use local Git checkpoints for coherent changes. Do not add a remote or push unless requested.

## Current scope

One procedural Deadwood biome, a visibly equipped character, movement, and satisfying combat against mobs. Prioritize the procedural asset engine, animation, input, enemy tells, and hit feedback. Larger systems in the design documents are future work.

The basic attack is one repeatable action driven by character stats and equipped-weapon stats. Do not reintroduce an automatic combo chain; combos may become a separate skill in future work. Keep movement and combat continuous, without hitstop. The runtime game view has no how-to text or control legend; small bindings on skill buttons are intentional. Character, inventory, skill-tree, and journal HUD shortcuts remain disabled until those systems are requested.

## Project layout

- `game/`: standalone Vite + TypeScript application; no runtime package dependencies.
- `game/src/simulation.ts` and `model.ts`: deterministic 120 Hz combat state, rules, and render interpolation snapshots.
- `game/src/equipment.ts`: character and equipped-weapon stats used to derive the basic attack.
- `game/src/world.ts`: seeded terrain, props, collision, and bounded tile caching.
- `game/src/art.ts`: procedural Canvas assets, modular equipment, articulated character rigs, and phased attack motion.
- `game/src/renderer.ts`: interpolated scene composition, camera, actors, and world overlays.
- `game/src/lighting.ts`: bounded dynamic light map, cached light stamps, and prop shadows.
- `game/src/effects.ts`: bounded combat particles, trails, flashes, and damage numbers; effects never drive gameplay.
- `game/src/postfx.ts`: WebGL bloom passes, CRT/phosphor display treatment, and clean fallback with HUD protection.
- `game/src/hud.ts` and `font.ts`: procedural floating HUD, shared layout/hit bounds, animated resource orbs, and bitmap typography.
- `game/src/main.ts`: input, loop, menus, and local preferences.
- `docs/`: design documents and reference concepts, not runtime assets.

From the repository root: `npm run setup`, `npm run dev`, `npm test`, and `npm run build`. Engine tests require Node.js 22.13 or later for TypeScript stripping.
