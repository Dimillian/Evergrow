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

## Project layout

- `game/`: standalone Vite + TypeScript application; no runtime package dependencies.
- `game/src/simulation.ts` and `model.ts`: deterministic combat state and rules.
- `game/src/world.ts`: seeded terrain, props, collision, and bounded tile caching.
- `game/src/art.ts`: procedural Canvas art and layered character rigs.
- `game/src/renderer.ts`, `postfx.ts`, and `font.ts`: scene composition, retro display effects, and bitmap typography.
- `game/src/main.ts`: input, loop, menus, and local preferences.
- `docs/`: design documents and reference concepts, not runtime assets.

From the repository root: `npm run setup`, `npm run dev`, `npm test`, and `npm run build`. Engine tests require Node.js 22.13 or later for TypeScript stripping.
