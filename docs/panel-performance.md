# Map and skill-atlas performance

The September 6, 2026 pass targets repeated Canvas work and cold map generation. It changes presentation only; world generation, discovery, allocation and combat remain owned by their existing systems.

## World map

- Pointer, drag, wheel and keyboard bursts schedule at most one display-frame draw. A pending hover frame is upgraded if the camera changes before it runs. Closing cancels pending work.
- Hover uses the already decluttered POI list. Moving across ordinary terrain updates the DOM tooltip without redrawing the chart. A retained backing image is allocated only when highlighting a POI; it is discarded when the panel closes.
- Fog masking copies contiguous revealed row runs instead of issuing a separate Canvas image copy for every pixel. Every pixel still checks the same underlying discovery cells; internal unknown holes stay masked.
- Cold atlas terrain is built in rows with a five-millisecond generation budget per frame. Every revealed tile gets an immediate low-resolution climate preview (100 padded color samples and a 32-pixel discovery mask), including tiles whose detail work has not started. Detailed rows stay hidden until complete, then the exact materials, props and road ink crossfade in over 240 ms. Operating-system reduced motion skips that fade. The preview cache has a separate 384-entry limit, and every discovery revision remasks it. The visible center is prioritized. Cached drawing does not consume this budget, so unfinished edge tiles cannot starve. This is a cooperative budget, not a hard upper bound: one row, a prop query, native rasterization or a cold district query can run longer.
- Minimap tiles retain synchronous, detailed sampling. Full-map and minimap caches remain separate within the existing 384-tile LRU.
- Danger contours use world-aligned 16-cell tiles in stable zoom bands, with a 512-entry LRU. Geometry can be reused across small pans and wheel changes. Discovery is never cached with it: corners and each 24-unit contour interval are checked against current fog before drawing.

## Skill atlas

The existing atlas already coalesces drawing into animation frames, culls offscreen geometry and reduces detail at distant zoom. Search now prepares a matching-ID set when the query, discipline, reachability or build changes, instead of rebuilding searchable strings during rendering and picking.

The atlas surface is retained at native display resolution while a tooltip fades or slides. Only the tooltip is repainted during those animation frames. Camera, selection, hover target, search, allocation, ranks and resize invalidate the underlying atlas. Closing releases the retained surface. This preserves all node glyphs, labels, route highlighting and tooltip motion; pan/zoom still redraw visible vector geometry.

## Verification and measurements

`game/scripts/benchmark-panels.mjs` uses an already installed `@napi-rs/canvas` supplied through `CANVAS_MODULE`. It adds no runtime dependency, opens no browser, advances no gameplay and uses memory-only exploration. Run with `--progressive` to measure actual budgeted map rendering; omit it for synchronous cold-build comparison. An optional first argument writes JSON. `PANEL_CAPTURE_DIR` exports static renderer images to an existing directory. The tool also compares direct and retained tooltip pixels (maximum allowed channel difference: one).

At a 1,000 × 700 backing surface on the development Mac, representative sequential CPU samples were:

| Work | Before | After |
| --- | ---: | ---: |
| Newly generated chart, synchronous total | 5,091 ms | 867–982 ms |
| Cached map pan/zoom, median | ~4 ms | ~2 ms |
| Tooltip animation at 0.12 skill zoom, median | ~10 ms/full atlas draw | ~0.3 ms/retained draw |

These are Canvas CPU observations, not browser FPS or GPU-compositor measurements. Contention from simultaneous builds produces much higher outliers. The cold total is distributed across frames in the live panel. Initial district/terrain work can still exceed a frame budget, and the skill atlas still draws its vectors during camera movement. Higher display resolution and the user's actual browser can change those costs; gameplay and interaction feel remain user-tested.

Code tests also verify full preview coverage at a zero detail budget, preview fog invalidation, bounded easing and reduced motion. Code tests cover coalescing, camera-change priority, progressive yielding/completion, exactly-once terrain sampling, fog changes during loading, cache reuse across pan/zoom, and contour concealment. Full code tests, strict/core compilation and production build validate the checkpoint. Browser gameplay tests were not run.
