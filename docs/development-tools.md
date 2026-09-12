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
- **Skills & combat**: actual-simulation skill playground, skill atlas, bestiary, speech mode, deaths and enchanted weapon studies. The playground covers all current active skills and registered specializations with ranks 1–3, compatible weapons, eight facings, target formations and creature choice. Play/replay, pause/resume, one 120 Hz frame step, quarter/half/normal/double speed, optional loop, PNG capture and JSON observation export. Each replay starts a fresh simulation. Visual showcase uses a large training mana pool. Follow-up attacks and incoming physical-hit comparisons last 12 seconds with finite mana; sustained rotation lasts 30 seconds. Level 1/10/25/50/100, front/rear target facing and a no-active baseline are selectable. Non-showcase dummies retain their authored position to keep repeated contacts comparable. The incoming-hit mode uses a 10%-maximum-life physical hit every 1.2 seconds, starting at 0.9 seconds; random shield blocks are disabled for reproducibility, while active guard, armor, stances and wards still apply. Status shows actual life, mana, spending, casts, damage and absorption. It has no Game/session/repository, automatic camps, container interaction or character persistence. Real collision, projectiles, ground effects, damage and status rules still apply; these are disclosed controlled probes, not live encounter survival or boss time-to-kill measurements. Operating-system reduced motion is respected; hidden pages stop advancing.
- **World**: seed/placement survey, existing map and settlement reviews, climates, camps, events, crypts, forest/water motion and portals. The survey queries actual POIs in a bounded 1,000–24,000-unit square centered within ±1,000,000 coordinates. Type filtering, map/list selection, fixed danger/biome data, frozen real-renderer inspection, PNG and JSON export. It bypasses exploration fog only in its own view and accesses no saved charts. Related world tabs preserve the seed where their implementation supports it.
- **Interface**: windows/components, HUD, reward animations, notifications, Journeys, touch and Thor preview.
- **Data & audits**: source-backed searchable catalogs and progression formulas; code check, profiler and offline capture instructions. Equipment records link to their forge recipe; skill/specialization records link to the playground; event kinds link to placements. Catalog exports describe the current loaded source, not a deployed version. Tests and commands are not auto-executed from the page.

The home page presents six workspace cards rather than every review. Search reveals individual matching tasks across workspaces. Legacy URLs still open the exact shared implementations; the developer-facing organization is centralized here.

## Verification

`/progression.html?view=power` extends the progression workspace with a read-only character/cloud-observation importer and health, damage and recovery-time sensitivity controls. Inputs stay in memory; it never reads or writes playable saves. Cloud summaries/history are explicitly distinct from full validated checkpoints. The tool can export its data and assumptions. The companion command `node --experimental-strip-types game/scripts/power-audit.ts [snapshot.json] [report.json]` also runs a bounded 30-second, 120 Hz lightning-interruption study at three pulse phases. Personal snapshots/reports belong outside the repository. See `docs/combat-power-audit.md` for interpretation.

`game/tests/development-tools.test.ts` checks registry coverage of every review HTML, local navigation boundaries, deterministic forge derivation across kinds/materials, every skill/specialization activation, delayed effect completion, source-backed catalog coverage and bounded deterministic placement surveys. Run `npm run check`; do not run optional browser gameplay tests without the player's request. Inspect the production output to confirm only `index.html` is emitted and no tools modules are bundled.

### Expanded world atlas

The atlas now surveys a complete square through the runtime `World`, with Local (24,576 world units), Wide (49,152, default) and Vast (98,304) coverage. The selector displays the shared in-game metre scale. Seed input, New seed, Fit survey and PNG export stay in the atlas workspace; `?seed=18427&size=vast` links directly to a survey. Terrain renders progressively, while small, cancellable spatial batches enumerate landmarks. The disposable survey owns its complete POI index so large studies do not truncate at a character chart's discovery limit. Its 4,096 maximum revealed chunks remain within the normal exploration capacity. No character storage is read or written.

The atlas alone uses a 0.001 minimum zoom; gameplay retains 0.025. Shared terrain LOD keeps a maximum of 256 visible tiles even at the larger overview scale, and normal detail returns when zooming in.

### Dungeon workshop

The World workspace’s Dungeon tool (`/dungeon.html?view=gallery&seed=7319`) compares six dungeon themes using consecutive seeds. `view=entrances` shows their shared runtime entrance art; `expedition` selects the larger level-24 review floors. The Theme selector includes Rime Cathedral, Sunken Ossuary and Astral Archive. Seed input, New seed and PNG export support repeatable reviews. Click a room on Floor map or select a chamber in the sidebar to inspect actual runtime materials, props, fixtures and themed enemies. Chamber, Corridor and Encounter modes freeze disposable actors while lights animate at 30 Hz. The tool imports shared `generateDungeon`, `drawDungeonMap`, `DungeonWorld` and `Renderer`; it has no alternate generator or playable saves.

### Settlement workshop

`/layouts.html` now compares the starting refuge, villages and fortified cities using a URL-addressable seed. Hearth & stalls and Furnished interior provide close-ups; PNG export uses the actual runtime renderer. Refuges have no houses. `/services.html?role=gambler` and `?role=stash` stage the production panels in disposable memory. See [Settlements](settlements.md).

The town service study accepts `tier=village` or `tier=city` to select a real generated town of that tier. It supports all service roles and uses disposable memory.

The local `/character.html` review now includes the 12×6 spatial pack, upright item art, inline sorting, drag footprint previews and four dedicated charm rows. It uses the runtime inventory and disposable gear; no playable saves are accessed.

### Charm review

The Equipment workspace includes `/character.html?charms`, with six stone sizes staged in the dedicated charm grid. Item forge supports all 36 stone profiles, normal rarity, levels and enhancements. These views share runtime item rules and do not access character saves.

### Dungeon lighting study

The Dungeon workshop's Lighting view (`/dungeon.html?view=lighting&seed=7319&room=4`) presents illuminated mist, damp masonry reflections and selective fixture bloom through the production renderer. The World workspace links directly to it. Change the seed to 7317/7318 for Rootbound Crypt/Cinder Foundry. Export PNG captures the composed scene. Frozen actors and 30 Hz presentation keep this save-free; Chamber mode includes median CPU render/lighting timings (not a gameplay/GPU benchmark).

### Outdoor lighting study

`/biomes.html?lighting&view=verdant&variant=1` opens animated views of all nine climates using actual generated locations and the runtime renderer. Another area and seed selection inspect different landscape compositions; no scenery is added for screenshots. Actors stay frozen and the scene animates at 30 Hz, pausing while hidden and respecting reduced motion. Save PNG exports the current full-resolution composited frame. The regular biome gallery remains a still study. The optional Render timings disclosure reports bounded CPU timings, not GPU completion or gameplay frame rate.

The outdoor lighting study now covers all nine climates. Use its time slider, Dawn/Noon/Dusk/Midnight presets, or accelerated **Play day cycle** to inspect the shared sky, moving cloud shade and changing shadow direction. Time controls affect only the disposable preview; the game derives its 36-minute day from saved simulation time.

### Settlement night study

World → Settlement nights opens `/layouts.html?lighting`. The existing settlement views share live time-of-day controls and a 30 Hz presentation loop, with reduced-motion/hidden-tab suspension. The simulation remains paused in disposable memory. Save PNG encodes only on demand, never on each animation frame. Render timings expose a bounded 600-frame CPU sample; setup, scenery, props, structures and characters help locate drawing costs. Nested timings overlap (world contains the other render stages; actors contains props/structures/characters), so do not sum them. GPU completion and playable simulation are not measured.

### Expedition and respec studies

The World workspace includes `/tools/expeditions.html`, a disposable instance of the runtime expedition panel. `stage=0..9`, `level=19` and `failed` expose progression, the level gate and failed-route states. Equipment includes `/services.html?role=enchanter&respec` for exact reset pricing and point refunds. These studies do not access playable saves.

The power-audit CLI also includes disposable `enemyPressureProbe` scenarios for elite melee/ranged foes, dungeon/wilderness bosses and a twelve-enemy ring. It reports first contact, landed hits, largest hit and peak half-second damage through the real AI/projectile/hurt-guard loop; it never loads a playable slot.

The Combat power audit (`/progression.html?view=power`) now includes the frozen-before/current mana benchmark, 28 reproducible synthetic loadouts and a full-snapshot mana source breakdown. `game/scripts/resource-benchmark.ts` runs 84 disposable headless encounters; see [resource balance](resource-balance.md). Neither tool reads or writes playable/cloud saves automatically.

The complementary `game/scripts/damage-audit.ts /path/to/report.json` CLI compares 24 offensive fixtures, 300 damage-selected equipment sets and 280 single-cast contact/geometry probes using the existing disposable skill study. It writes JSON only, never loads playable saves and changes no runtime rules. Assumptions and findings are in [the September 11 damage audit](damage-audit-2026-09-11.md).


The damage audit also reports controlled low/mid/high-roll Legendary staff/chest comparisons on otherwise identical level-35 builds. It records roll-range/rank coefficients and the elite target's actual life, so successive tuning reports remain interpretable when enemy durability changes. These are deliberately matched affix combinations, not drop-frequency estimates or the user's cloud character. See [loot and combat follow-up](loot-quality-and-combat-2026-09-11.md).

### Greater-roll inspection

`/loot.html?greater&state=hovered` stages a Legendary staff with two greater rolls, an ordinary Epic item and an Epic charm with one greater roll. It shows the shared ground labels and bottom-corner tooltip. `/character.html?charms&greater` places the same staff in the existing inventory study; other generated gear retains its naturally rolled quality. Both modes use disposable recipes and runtime drawing, with no character-save access.

### Rebuilt skill atlas · local 2026-09-12

The Skills workspace's existing atlas view now opens the six-territory runtime graph. Use `/character.html?panel=skills&zoom=overview&map` for the full-height overview of the 875-node / 120-group map. The draggable mini-atlas tracks the visible window; the top territory filter row is removed. Origin returns to the early routes; All refits the map. Search finds an action, bonus, Doctrine, Technique or keystone. Details restores the inspector. `&progression` stages a level-100 caster build with three purchased ranks in disposable memory. The playground covers all 30 skills and 90 Techniques. No playable saves are read or written.

The save-free `game/scripts/atlas-balance.ts` CLI extends this workspace with 20 fully spent build fixtures and all 30 active-skill probes. See [balance follow-up](skill-tree-balance-2026-09-12.md).
