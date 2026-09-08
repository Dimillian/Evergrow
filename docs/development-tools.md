# Local development tools

Open **http://127.0.0.1:5173/tools/** (`/tools` also resolves) while `npm run dev` is running. This is the canonical entry point for development reviews. It groups existing reviews into Equipment, Characters, Skills & Combat, World, Interface and Data & Audits, with historical concepts in Archive. Search finds tools by purpose. A workspace mounts only one review at a time; moving between tabs unloads its renderer and memory state. Standalone reviews have Tools home / Open in workspace navigation.

The hub and review HTML are outside the production build entry graph and outside `public/`. Do not add them to Sites or Android builds. No publication is required for local tools. Review changes use staged, memory-only characters; they never load or edit playable saves. The game itself remains `/`.

## Adding a tool

1. Prefer extending the appropriate workspace and existing shared review over another disconnected page.
2. Put new tool implementation in `game/src/tools/` and HTML under `game/tools/`. Keep runtime content/formulas authoritative; do not copy balance tables.
3. Register the view in `game/src/tools/catalog.ts`, with a clear task name, workspace, route and searchable description.
4. Import `review-nav.ts` from its HTML for standalone navigation. A review can use query parameters for secondary states; use a distinct registry entry only for a useful primary task.
5. Own/dispose renderers, worlds, event listeners and animation frames on teardown. Pause hidden animated reviews, bound simulation work and never connect tools to character persistence.
6. Verify type checking, relevant headless tests and production exclusion. Gameplay testing stays with the player.

Existing HTML URLs remain useful direct entries to the same implementations, not duplicate tools. The hub embeds those implementations instead of copying them. Narrow services, editor phone mockups, speech and skill atlas are named modes of their owning workspaces. Historical HUD alternatives stay in Archive.

## Primary workspaces

- **Equipment**: Item forge, equipment/material gallery, staged inventory/comparisons, services (including phone mode) and ground loot. The forge uses `generateItem` / `deriveItem` and normal equip transactions. Seed, level (1–1,000,000), kind, compatible profile/material, rarity and +0–10 enhancement are URL-addressable. Generate twelve successive seeds, retain the latest sixteen in memory, rotate the equipped portrait and export an item JSON recipe. JSON exports are development artifacts, not character save files.
- **Characters**: shared appearance editor, animated atelier, eight-facing rig, in-world looks, hair/accessory catalog, phone study and character hall.
- **Skills & combat**: actual-simulation skill playground, skill atlas, bestiary, speech mode, deaths and enchanted weapon studies. The playground covers all current active skills and registered specializations with ranks 1–7, compatible weapons, eight facings, target formations and creature choice. Play/replay, pause/resume, one 120 Hz frame step, quarter/half/normal/double speed, optional loop, PNG capture and JSON observation export. Each replay starts a fresh 12-second simulation with stationary high-life targets and a large training mana pool. It has no Game/session/repository, automatic camps, container interaction or character persistence. Real collision, projectiles, ground effects, damage and status rules still apply; it is an animation study, not a balance benchmark. Operating-system reduced motion is respected; hidden pages stop advancing.
- **World**: seed/placement survey, existing map and settlement reviews, climates, camps, events, crypts, forest/water motion and portals. The survey queries actual POIs in a bounded 1,000–24,000-unit square centered within ±1,000,000 coordinates. Type filtering, map/list selection, fixed danger/biome data, frozen real-renderer inspection, PNG and JSON export. It bypasses exploration fog only in its own view and accesses no saved charts. Related world tabs preserve the seed where their implementation supports it.
- **Interface**: windows/components, HUD, reward animations, notifications, Journeys, touch and Thor preview.
- **Data & audits**: source-backed searchable catalogs and progression formulas; code check, profiler and offline capture instructions. Equipment records link to their forge recipe; skill/specialization records link to the playground; event kinds link to placements. Catalog exports describe the current loaded source, not a deployed version. Tests and commands are not auto-executed from the page.

The home page presents six workspace cards rather than every review. Search reveals individual matching tasks across workspaces. Legacy URLs still open the exact shared implementations; the developer-facing organization is centralized here.

## Verification

`game/tests/development-tools.test.ts` checks registry coverage of every review HTML, local navigation boundaries, deterministic forge derivation across kinds/materials, every skill/specialization activation, delayed effect completion, source-backed catalog coverage and bounded deterministic placement surveys. Run `npm run check`; do not run optional browser gameplay tests without the player's request. Inspect the production output to confirm only `index.html` is emitted and no tools modules are bundled.

### Expanded world atlas

The atlas now surveys a complete square through the runtime `World`, with Local (24,576 world units), Wide (49,152, default) and Vast (98,304) coverage. The selector displays the shared in-game metre scale. Seed input, New seed, Fit survey and PNG export stay in the atlas workspace; `?seed=18427&size=vast` links directly to a survey. Terrain renders progressively, while small, cancellable spatial batches enumerate landmarks. The disposable survey owns its complete POI index so large studies do not truncate at a character chart's discovery limit. Its 4,096 maximum revealed chunks remain within the normal exploration capacity. No character storage is read or written.

The atlas alone uses a 0.001 minimum zoom; gameplay retains 0.025. Shared terrain LOD keeps a maximum of 256 visible tiles even at the larger overview scale, and normal detail returns when zooming in.

### Dungeon workshop

The World workspace’s Dungeon tool (`/dungeon.html?view=gallery&seed=7319`) compares Rootbound Crypt, Cinder Foundry and Drowned Vault maps using consecutive seeds. Seed input, New seed and PNG export support repeatable reviews. Click a room on Floor map or select a chamber in the sidebar to inspect actual runtime materials, props, fixtures and themed enemies. Chamber, Corridor and Encounter modes freeze disposable actors while lights animate at 30 Hz. The tool imports shared `generateDungeon`, `drawDungeonMap`, `DungeonWorld` and `Renderer`; it has no alternate generator or playable saves.
