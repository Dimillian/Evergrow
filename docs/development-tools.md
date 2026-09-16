# Local development tools

Local Unique studies: `/character.html?uniques`, `/loot.html?uniques` and `/chronicle.html?uniques` stage the six designs and collection states. The skill playground has a matching Unique selector for each supported skill. All use runtime generators/renderers/combat with disposable state; see [Unique items](unique-items.md).

Open **http://127.0.0.1:5173/tools/** (`/tools` also resolves) while `npm run dev` is running. This is the canonical entry point for development reviews. It groups existing reviews into Equipment, Characters, Skills & Combat, World, Interface and Data & Audits, with historical concepts in Archive. Search finds tools by purpose. A workspace mounts only one review at a time; moving between tabs unloads its renderer and memory state. Standalone reviews have Tools home / Open in workspace navigation.

The hub and review HTML are outside the production build entry graph and outside `public/`. Do not add them to Sites or Android builds. No publication is required for local tools. Review changes use staged, memory-only characters; they never load or edit playable saves. The game itself remains `/`.

World → Events includes **In progress** for all thirteen event entries (`/events.html?view=ruinedChapel&state=progress`). A recipe selector exposes every encounter variant. Play/Pause, scrubbing, speed and Restart stage the shared left-side trial panel and world objectives in disposable memory. Cursed chests and beacons use real durations; finite encounters use an explicitly authored twelve-second-per-wave presentation timeline. Instant interactions explain their lack of a progress phase. Hidden tabs suspend time, reduced motion starts paused, and no combat or playable saves are involved.

Trial previews include a **HUD card** animation row: **Replay entrance** / **Replay exit**, a separate animation scrubber and 1×/0.5×/0.25× motion speeds. The event timeline pauses during these replays. The shared runtime frame expands horizontally before its contents fade in, reversing on exit. Reduced motion makes the transition instant. Finishing the event timeline automatically previews the card exit before the reward-opening study.

The Events toolbar groups Available / In progress / Opening / Completed / Claimed into one stable preview-state selector. Contextual recipe, playback and HUD-card controls sit beside the scene on desktop and below it at widths under 980px, keeping the canvas in place when states change. The review fixes its camera while animations advance; chapel framing keeps its reward chest above the HUD. Runtime camera following is unchanged. Switching events retains the selected state when supported; opening animations finish on Claimed. Every preview state is URL-addressable through `state=available|progress|opening|completed|claimed`.

## Area announcements

The selected **Gilded Horizon** banner now uses the same `area-banner-art.ts` drawing in the game and this study. Its center sits at 12.5% of the scene height, horizontally centered. Desktop, handheld, landscape-phone and portrait-phone viewports inspect the shared compact spacing. The study contains no simulation input or playable saves.

Interface → **Area announcements** (`/notifications.html?view=banners`) replays/scrubs the shared 4.8-second fade, holds it visible, and changes the staged area/player level. Names and ranges use `getZoneAt`; scenery uses `World` and the frozen runtime renderer. The runtime difficulty colors compare the player against the full ordinary range: sage within it, silver above its maximum, amber 1–4 below its minimum, coral 5+ below. Hidden pages stop replay. The old corner area card and unselected frame implementations have been removed; pickup/discovery notices retain their corner feed.

## Adding a tool

1. Prefer extending the appropriate workspace and existing shared review over another disconnected page.
2. Put new tool implementation in `game/src/tools/` and HTML under `game/tools/`. Keep runtime content/formulas authoritative; do not copy balance tables.
3. Register the view in `game/src/tools/catalog.ts`, with a clear task name, workspace, route and searchable description.
4. Import `review-nav.ts` from its HTML for standalone navigation. A review can use query parameters for secondary states; use a distinct registry entry only for a useful primary task.
5. Own/dispose renderers, worlds, event listeners and animation frames on teardown. Pause hidden animated reviews, bound simulation work and never connect tools to character persistence.
6. Verify type checking, relevant headless tests and production exclusion. Gameplay testing stays with the player.

Existing HTML URLs remain useful direct entries to the same implementations, not duplicate tools. The hub embeds those implementations instead of copying them. Narrow services, editor phone mockups, speech and skill atlas are named modes of their owning workspaces. Historical HUD alternatives stay in Archive.

## Primary workspaces

Interface → Windows & components → Pause (`/ui.html?view=paused`) stages the production field-journal menu. Desktop/Narrow switches only the disposable preview viewport; categories, Options, Controls and release notes share the runtime implementation. Unavailable optional targets are disabled. This preview never opens playable characters or writes saves.

- **Equipment**: Item forge, equipment/material gallery, staged inventory/comparisons, services (including phone mode) and ground loot. The forge uses `generateItem` / `deriveItem` and normal equip transactions. Seed, level (1–1,000,000), kind, compatible profile/material, rarity and +0–10 enhancement are URL-addressable. Generate twelve successive seeds, retain the latest sixteen in memory, rotate the equipped portrait and export an item JSON recipe. JSON exports are development artifacts, not character save files.
- **Characters**: shared appearance editor, animated atelier, eight-facing rig, in-world looks, hair/accessory catalog, phone study and character hall.

  The eight-facing rig (`/rig.html`) includes simple clothing / plate-and-cloak, helmet visibility, seven equipment combinations plus unarmed, and a scrubbed walking stride. It defaults to unarmed with the shared default appearance so the directional head and torso are easy to inspect. All directions use one framing envelope per loadout; changing stride never zooms the character. Frozen presentation only, without gameplay or saves.

  The appearance catalog (`/appearance-catalog.html?kind=hair`) compares all 24 hairstyles over three pages. Directions switches between four cardinal views and all eight facings; Hair color exposes the runtime palettes and Helmet checks coverage. These choices persist in the URL and across catalog pages (`directions=8&color=flax&helmet=0`). Each view uses the production head renderer and stays independent of character saves.
- **Skills & combat**: actual-simulation skill playground, skill atlas, bestiary, speech mode, deaths and enchanted weapon studies. The playground covers all current active skills and registered specializations with ranks 1–20, compatible weapons, eight facings, target formations and creature choice. Play/replay, pause/resume, one 120 Hz frame step, quarter/half/normal/double speed, optional loop, PNG capture and JSON observation export. Each replay starts a fresh simulation. Visual showcase uses a large training mana pool. Follow-up attacks and incoming physical-hit comparisons last 12 seconds with finite mana; sustained rotation lasts 30 seconds. Level 1/10/25/50/100, front/rear target facing and a no-active baseline are selectable. Non-showcase dummies retain their authored position to keep repeated contacts comparable. The incoming-hit mode uses a 10%-maximum-life physical hit every 1.2 seconds, starting at 0.9 seconds; random shield blocks are disabled for reproducibility, while active guard, armor, stances and wards still apply. Status shows actual life, mana, spending, casts, damage and absorption. It has no Game/session/repository, automatic camps, container interaction or character persistence. Real collision, projectiles, ground effects, damage and status rules still apply; these are disclosed controlled probes, not live encounter survival or boss time-to-kill measurements. Operating-system reduced motion is respected; hidden pages stop advancing.
- **World**: seed/placement survey, existing map and settlement reviews, climates, camps, events, crypts, forest/water motion and portals. The survey queries actual POIs in a bounded 1,000–24,000-unit square centered within ±1,000,000 coordinates. Type filtering, map/list selection, fixed danger/biome data, frozen real-renderer inspection, PNG and JSON export. It bypasses exploration fog only in its own view and accesses no saved charts. Related world tabs preserve the seed where their implementation supports it.

World → Portals (`/portal.html`) selects real destination climates and special hazardous/dungeon seals in a save-free scene. It can freeze presentation time, adjust channel progress, compare all nine climate signatures and export PNG evidence.
- **Interface**: windows/components, HUD, reward animations, notifications, Journeys, touch and Thor preview.
- **Data & audits**: source-backed searchable catalogs and progression formulas; code check, profiler and offline capture instructions. Equipment records link to their forge recipe; skill/specialization records link to the playground; event kinds link to placements. Catalog exports describe the current loaded source, not a deployed version. Tests and commands are not auto-executed from the page.

The home page presents six workspace cards rather than every review. Search reveals individual matching tasks across workspaces. Legacy URLs still open the exact shared implementations; the developer-facing organization is centralized here.

## Verification

`/progression.html?view=power` extends the progression workspace with a read-only character/cloud-observation importer and health, damage and recovery-time sensitivity controls. Inputs stay in memory; it never reads or writes playable saves. Cloud summaries/history are explicitly distinct from full validated checkpoints. The tool can export its data and assumptions. The companion command `node --experimental-strip-types game/scripts/power-audit.ts [snapshot.json] [report.json]` also runs a bounded 30-second, 120 Hz lightning-interruption study at three pulse phases. Personal snapshots/reports belong outside the repository. See `docs/combat-power-audit.md` for interpretation.

`game/tests/development-tools.test.ts` checks registry coverage of every review HTML, local navigation boundaries, deterministic forge derivation across kinds/materials, every skill/specialization activation, delayed effect completion, source-backed catalog coverage and bounded deterministic placement surveys. Run `npm run check`; do not run optional browser gameplay tests without the player's request. Inspect the production output to confirm only `index.html` is emitted and no tools modules are bundled.

### Expanded world atlas

World → Map icon workshop (`/tools/map-icons.html`) catalogs every registered POI, navigation marker and dungeon marker with search, collection filters, hover/completion previews, backdrop and dungeon-theme controls, and per-card PNG export. Each card compares a 4× enlargement with actual map and minimap sizes. **Map view** (`?view=map`) switches to one actual-size marker over a cached crop of actual generated terrain; dungeon markers use a staged room with the selected theme’s map colors. Marker positions are staged for comparison, with labels outside the image. Search, state previews and PNG export support both views. All POIs now have dedicated semantic silhouettes (anvil, die, bed, paw, pickaxe, bridge, and so on), with fine details omitted at minimap scale. Dungeon events use an urn, protective shield and helmet; Journey tracking uses a flag, magnifying glass and edge chevron. Character arrows and enemy dots retain their preceding artwork. Runtime maps and the workshop share the exhaustive `map-symbol-art.ts` silhouette catalog through `map-icon-art.ts`, `dungeon-map-icon-art.ts` and `journey-marker.ts`; POI labels/colors stay in `world-pois.ts`. Registered kinds are shown even when not currently generated; ordinary residents have no individual map marker. The page renders on demand and accesses no simulation or saves.

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

The Skills workspace's existing atlas view now opens the six-territory runtime graph. Use `/character.html?panel=skills&zoom=overview&map` for the full-height overview of the 1,824-node / 174-group map. The draggable mini-atlas tracks the visible window; the top territory filter row is removed. Origin returns to the early routes; All refits the map. Search accepts shared affix labels and aliases such as `projectile pierce`, `crit damage` and `mana regen`, and highlights all matches on both maps. Search groups matches by bonus and automatically frames all of them after typing settles, without a node-by-node result list. Broad queries offer bonus-group chips; selecting one highlights the entire group. Enter or Recenter repeats the fit. Manual navigation cancels a pending fit. Details restores the inspector. `&progression` stages a level-100 caster build with three purchased ranks in disposable memory. The playground covers all 30 skills and 90 Techniques. No playable saves are read or written.

The save-free `game/scripts/atlas-balance.ts` CLI extends this workspace with 20 fully spent build fixtures and all 30 active-skill probes. See [balance follow-up](skill-tree-balance-2026-09-12.md).

### Merchant refresh and enhancement workbench

`/services.html?tier=city` stages the spatial Weapons / Armor / Accessories stock trays and paid refreshes. `/services.html?operation=enhance&item=1` opens the shared item showcase and exact enhancement gains. Both use the same runtime panel and pure commerce planner with disposable in-memory items and gold.

### Procedural skill icons

Skills & combat → Skill icon workshop (`/tools/skill-icons.html`) compares the first six redesigned skills or all 30. Each shows the shared stained-glass artwork at 106px, a 32px hotbar sample and 24px tree/dimmed samples. The SVG disclosure verifies DOM controls against the Canvas artwork. PNG export is on demand; the study owns no simulation, animation loop or saves.

The Interface workspace’s **HUD & shortcut menu** view (`/character.html?panel=hud&loadout=wand`) stages the actual floating HUD and compact shortcut list on a frozen, disposable character. `loadout=bow`, `staff`, `wand`, `shield` or `dual` changes the staged equipped silhouette. This view binds no gameplay input, advances no simulation and never accesses saves.

### Unique batch-three studies

The skill playground Unique selector includes all eighteen signatures. Heartwood’s study holds for 0.65 seconds then releases through normal simulation input. Red Harvest’s rear showcase turns its stationary target to face the player for one marked follow-up. Patient Bastion uses the existing incoming-hit scenario and adds basic attacks after the first guard hit. These are authored isolated probes; no playable saves are accessed. See [Unique items](unique-items.md) for direct preview links.

### Active-effect review

Interface → HUD & active buffs opens `/character.html?panel=hud&loadout=shield&buffs`. The existing frozen HUD review stages Spellweave, Afterguard and Brace with production glyphs, time readouts and nested explanations. Hover/focus/tap icons and underlined terms to inspect the cards. Timers are deliberately frozen; this review advances no simulation and has no playable saves.

Aura previews: the existing skill playground supports seven aura studies and shared buff/buildup icons. `/character.html?panel=hud&auras` stages reserved mana and Blood Oath stacks; `/character.html?panel=skills&auras&node=skill:bloodOath` inspects the existing-branch placement. Both are disposable and save-free. See [Auras](auras.md).

The frozen HUD review also accepts `effects=caster`, `guard`, `rogue`, `bow` or `ward`, for example `/character.html?panel=hud&effects=caster`. These stage representative Unique budgets and a target with Burn, Slow, Stun, Red Harvest and Exposure. They draw production cards and target plates without advancing simulation. `/character.html?uniques` and `/chronicle.html?uniques` expose nested signature explanations; the existing forge and Thor inspection also share the terms.

World → Crimson Rifts (`/tools/rifts.html`) previews the runtime portal, level selection, five inventory key tiers, danger/reward modifiers and records in disposable memory. It never starts a playable run or reads saves.

World → Crimson Rifts supports `/tools/rifts.html?view=map&seed=7319&biome=verdant`: a full revealed layout using runtime floor generation and map art, monster spawn dots, seed cycling and all nine biome palettes. This is a disposable layout study; it does not reveal a playable character map or start combat.


The Crimson Rifts map study (`/tools/rifts.html?view=map`) now displays shared overworld terrain with the actual dense roster. **View pack** switches to a frozen runtime-rendered scene; choosing a biome selects a real matching world seed. It never reads saves or advances combat.

The Crimson Rifts map/pack study includes **Profile rendering** for a frozen 1100×900 scene, using the runtime renderer and post-processing without advancing gameplay. It reports CPU median/p95 after warmup. See `docs/rift-performance.md` and `game/scripts/benchmark-rift-crowds.ts` for the separate headless crowd benchmark.

Crimson Rifts → **Guardian arrival** stages the runtime warning near a disposable character, without advancing AI or touching saves. Pack previews include the actual rank-modifier nameplate.

Crimson Rifts → View map now defaults to the local connected-clearings experiment. **Compare open layout** provides a same-seed A/B view; biome selection and frozen **View pack** continue to use runtime terrain and actors. The `layout=clearings|open` parameter preserves the selected generation style without touching playable saves.

Crimson Rifts → View pack includes an atmosphere-only animation and progress selector. `?view=map&scene=pack&atmosphere=&progress=0.9` shows late-hunt corruption/lightning using the real renderer, frozen enemies and an isolated visual clock. No combat simulation or character saves.

### Gameplay performance monitor

Data & audits → Code & performance audits includes the actual F3 monitor with a frozen synthetic 600-frame sample (`/tools/audits.html?view=monitor`). Inspect all six dropdown views and capture controls without loading characters, simulating gameplay or reading saves. Restore sample data repopulates the disposable profiler. The runtime monitor toggles with F3; see [world performance](world-performance.md) for metric definitions and limits.

### Coin and mana drop motion

Equipment → **Coins & mana drops** (`/loot.html?resources`) extends Ground loot with a save-free animated study using `drawGroundGold` and `drawResourcePickups`, followed by the shared CRT treatment. Compare small/large coin piles, mana and health vials at 4× detail and 1× world-art size over moss, stone, sand or dark swatches. Pause, restart and scrub twenty seconds; reduced motion follows the operating system with an additional preview selector. Hidden tabs stop advancing. This is an art study, not a gameplay or terrain-lighting simulation.

The Crimson Rifts map study also offers **Rift cleared (HUD)** (`/tools/rifts.html?view=map&cleared`): a disposable completed run at 4:34 with the actual elapsed-time HUD and crimson return marker. Atmosphere/encounter controls return to the hunt study; no character saves are accessed.

Character hall (`/title.html`) now stages wallet balances, effective attribute differences and real equipped items in the redesigned runtime title UI. Its background uses the runtime World, Renderer and post-processing over a frozen disposable simulation; the character pedestal uses the shared title portrait renderer. Gear hover/focus tooltips, narrow-screen detail tabs, empty slots and the existing cloud/conflict fixture parameters remain memory-only. This view never launches gameplay or reads playable saves.
