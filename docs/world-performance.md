# Walking and terrain performance

The September 6, 2026 checkpoint reduces terrain-boundary stalls and repeated procedural queries. It preserves terrain detail, world generation, collision and combat rules.

## Rendering and query changes

`GroundLayer` retains overlapping terrain when its tile origin changes, copying the existing opaque composition and painting only incoming rows/columns. Fractional camera sampling still happens against one continuous surface, avoiding tile seams.

During ordinary movement frames it predicts the incoming strip up to one tile ahead, using 48 frames of recent camera displacement. It prepares at most one tile per frame with a cooperative two-millisecond budget. Ground sampling yields every four sample rows, raster assembly every 32 pixel rows, and decoration between passes and detail rows. Partial canvases are never displayed. A foreground request resumes pending work and finishes it before drawing; cold starts, teleports and large view changes can still require synchronous generation. A single work unit or native raster operation can exceed the cooperative budget.

Storage remains bounded: 48 completed world tiles, 16 unfinished tiles, and 16 prepared tile references in the composition layer. Reset/world replacement drops the layer's references; world disposal clears pending and completed work.

Procedural prop cells, including empty cells, now share an 8,192-entry FIFO cache between visibility and collision queries. Cached props are frozen blueprints. Eviction cannot change generated identities, positions or collision. Road-distance sampling minimizes squared segment distances before taking one square root.

## Verification

`game/scripts/benchmark-world-rendering.mjs` runs real terrain composition and prop/collision queries using an installed `@napi-rs/canvas` provided through `CANVAS_MODULE`. Run with Node's `--experimental-strip-types`; an optional argument writes JSON. `WORLD_BENCH_SOURCE` can point to another checkout's absolute `game/src/` directory for comparison. It opens no browser, advances no simulation, and accesses no saves.

The terrain sample draws 180 positions at three horizontal and 0.9 vertical world units per frame, flushes native raster work with a pixel read, and excludes the initial cold frame. Sequential measurements on the development Mac:

| Work | Before | After |
| --- | ---: | ---: |
| 960 × 600 terrain, worst movement frame | 44.7 ms | 5.5 ms |
| 1600 × 900 terrain, worst movement frame | 58.8 ms | 10.0 ms |
| Nearby prop query, median | 0.393 ms | 0.017 ms |
| Twelve collision probes, median | 0.075 ms | 0.011 ms |

These are terrain/query CPU observations, not complete gameplay frame times or browser FPS. The ordinary-frame terrain median was 1.7 ms and 4.3 ms respectively after the change; preparation frames deliberately do more work to reduce crossing spikes. Other renderer passes, simulation, GPU work and cold generation can still affect the user's gameplay session.

The checkpoint passed 606 code tests, strict/core compilation and production build. Tests cover overlapping/diagonal/negative terrain coverage, bounded prefetch, world replacement/reset, cooperative completion and prop cache eviction. A native Canvas comparison across fractional movement, boundary crossings, reversals and a negative-coordinate teleport produced zero differing pixel channels against the previous renderer. No browser gameplay test was run.
