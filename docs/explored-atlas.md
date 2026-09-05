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

The chart chooses 768-, 1,536- or 3,072-unit terrain tiles according to zoom, using 32 samples per tile edge. Larger viewports may use further powers of two to cap the visible working set at 256 tiles, below the shared 384-tile cache. This avoids constantly evicting a large overview's own tiles. Panning and hover reuse cached terrain colors.

Coarse terrain samples omit small road and plaza colors. Instead, two cached 128 × 128 layers per coarse tile draw the exact shared road centerlines and mask them through the same exploration coverage as terrain. Thin, softly sampled strokes keep roads continuous at broad zoom without dominating the biome colors. The minimap always uses detailed 768-unit tiles. The worst-case 384-entry cache, if every entry is coarse, stores about 51 MiB of raw canvas pixels before browser/GPU overhead; a normal overview uses far fewer entries.

At overview scales, one terrain sample may cover several 48-unit exploration cells. The sample is drawn only when **every covered cell is revealed**. Coarse tiles track revisions from every underlying exploration chunk, so discovery in another part of a tile updates its mask. This intentionally trims very narrow explored paths at the broadest scale instead of exposing unknown terrain; zooming in restores that detail.

`atlas-review-data.ts` owns only the sample travel coverage. `map-view.ts` owns bounded fit/zoom math. `world-map.ts` owns terrain presentation, masks, biome labels, visible marker selection and map controls. Terrain color and biome generation remain world-owned.

## Verification

Map tests cover broad framing, zoom-anchor preservation, working-set/cache bounds, conservative coarse fog, updates in all covered exploration chunks, deterministic POI selection, matching hover targets, and revealed-only biome labels. Tests and static review do not replace the user's gameplay feedback.

The images in `docs/captures/2026-09-05/biome-atlas/` are **direct CPU exports of the actual map renderer**, not browser screenshots. The Mac was locked and the in-app browser could not be controlled during this review. A disposable `/tmp` Node canvas package supplied the Canvas API; the export invoked the real `WorldMap` drawing methods with real world data, the shared exploration staging, and the bundled Pixelify Sans font. It added no project dependency, advanced no gameplay and accessed no exploration save. The three seed views were inspected at 0.05 zoom; the additional wide view was inspected at 0.025.
