# Explored atlas review

The local `/atlas.html` page shows the actual interactive world map after extensive staged exploration. It uses `World`, `Exploration` and `WorldMap` directly. It does not advance gameplay, create a character, use localStorage or modify the player's saved chart.

Three views are available:

- `/atlas.html?seed=7319`
- `/atlas.html?seed=18427`
- `/atlas.html?seed=90210`

Each seed uses the real seven-biome terrain, settlements and wilderness places. The staged discovery uses overlapping travelled circles across a roughly 20,000-unit region, with an irregular frontier, unexplored bays and narrow excursions. Every charted pixel and POI passes through the normal exploration API; the review does not paint undiscovered terrain. All seven biomes are present in the revealed portion of each sample. Camp markers retain their initial state because no enemies have been defeated.

The seed tabs change the local review. The map retains normal panning, zooming and POI hover. **Export chart PNG** saves the current chart canvas with its current framing. The default framing comes from `WorldMap.fitBounds`, which changes only the map camera. The page can be captured in the Codex in-app browser without touching the playable game.

## Runtime improvements

The full map now zooms out to **0.025**, allowing a broad region to fit on screen. A scale rail gives the overview a readable distance reference. Native biome labels are placed only on revealed, predominantly matching terrain; they avoid settlement markers and reserve space from minor POIs. Labels are a cartographic aid, not discovery or simulation state.

Overview POIs use deterministic priority and spacing: settlements and camps remain readable, while overlapping shop markers return at closer zoom. Hover queries the exact list that is drawn, so a hidden shop or obscured landmark cannot intercept a visible marker. At closer zoom, detailed building footprints remain available. The minimap uses a 0.05 scale (60% more distance across than 0.08) while retaining detailed terrain sampling. Walking reveals terrain and nearby POIs within 600 world units, up from 260; its discovery ring shares the same radius. Existing explored charts are preserved.

The full atlas uses its own 128 × 128 terrain tiles; the minimap retains its original 32 × 32 tiles, color sampler and drawing path. Cache keys distinguish the two surfaces. Large-map ground colors come from the game's actual ground materials, water, soil and paving, with a brighter chart exposure. Each normal tile takes 64 × 64 world samples; extended overview tiles use at most 128 × 128. Sampling aligns with the 48-unit discovery cells, so a coarse color never bridges a known/unknown cell boundary.

`map-terrain-art.ts` adds woodland canopies, recognizable conifers, bare branches and rock silhouettes at actual generated prop anchors. Crown extents use the shared prop registry; a padded query includes neighboring crowns crossing tile borders. Overview symbols have reduced contrast, and prop queries stop above 3,072-unit tiles. Roads follow the exact shared centerlines, with brighter atlas ink. All detail is flattened into the terrain tile before the common exploration mask is applied. Town roofs retain actual building footprints, distinct warm/slate materials, ridge lines and roof courses. Buildings require complete discovery coverage before drawing; the large-map coordinate grid is quieter.

The chart retains its 768-, 1,536- and 3,072-unit coverage levels, further powers of two for unusually large views, 256 visible-tile limit and shared 384-entry cache. Each atlas entry stores two 128 × 128 canvases (base and masked), about 48 MiB for 384 atlas entries before browser/GPU overhead. Roads do not add retained canvases to atlas tiles. Fog revisions rebuild only the revealed surface, reusing its terrain and prop art. At overview scales where a pixel covers multiple discovery cells, every covered cell must be known.

`/atlas.html?view=local` opens a closer, save-free town-and-woodland study. The default review remains the broad multi-biome overview. Both use the same full-map renderer as the runtime game.

`atlas-review-data.ts` owns only the sample travel coverage. `map-view.ts` owns bounded fit/zoom math. `world-map.ts` owns terrain presentation, masks, biome labels, visible marker selection and map controls. Terrain color and biome generation remain world-owned.

## Verification

Map tests cover broad framing, zoom-anchor preservation, working-set/cache bounds, conservative coarse fog, updates in all covered exploration chunks, deterministic POI selection, matching hover targets, revealed-only biome labels, isolation of minimap/atlas caches, and fine-grained masking of atlas detail (including unknown holes inside explored terrain). Tests and static review do not replace the user's gameplay feedback.

The images in `docs/captures/2026-09-05/biome-atlas/` are **direct CPU exports of the actual map renderer**, not browser screenshots. The Mac was locked and the in-app browser could not be controlled during this review. A disposable `/tmp` Node canvas package supplied the Canvas API; the export invoked the real `WorldMap` drawing methods with real world data, the shared exploration staging, and the bundled Pixelify Sans font. It added no project dependency, advanced no gameplay and accessed no exploration save. The three seed views were inspected at 0.05 zoom; the additional wide view was inspected at 0.025.

## Geography and danger study

`/atlas.html?seed=7319&view=extended&levels=1` stages a roughly 40,000-unit-wide surveyed disk in memory. Seed tabs compare 7319, 18427 and 90210; arbitrary signed 32-bit seed parameters are also supported. These previews use actual generated roads, terrain, settlements and regional danger without touching gameplay saves.

Generation 5 spreads settlements across both dimensions, enlarges the climate field, and connects towns with curved routes. Named, irregular danger districts replace the old radial bands. The full in-game map and this review both show revealed boundaries, names and levels, with orange `!` labels for more dangerous wilderness pockets. Regions avoid towns and suppress overlapping minor POIs before hover testing. Towns remain sanctuaries. See [world generation](world-generation.md) for current geography, tuning, query bounds and the authorized test-progress reset.
