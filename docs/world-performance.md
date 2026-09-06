# Walking and terrain performance

The September 6, 2026 checkpoint reduces terrain-boundary stalls and repeated procedural queries. It preserves terrain detail, world generation, collision and combat rules.

## Rendering and query changes

`GroundLayer` retains overlapping terrain when its tile origin changes, copying the existing opaque composition and painting only incoming rows/columns. Fractional camera sampling still happens against one continuous surface, avoiding tile seams.

During ordinary movement frames it predicts the incoming strip up to one tile ahead, using 0.8 seconds of recent camera velocity. Subpixel motion still triggers preparation at high refresh rates. It prepares at most one tile per frame with a cooperative budget of 12% of the preceding frame interval, capped at two milliseconds. Ground sampling yields every four sample rows, raster assembly every 32 pixel rows, and decoration between passes and detail rows. Partial canvases are never displayed. A foreground request resumes pending work and finishes it before drawing; cold starts, teleports and large view changes can still require synchronous generation. A single work unit or native raster operation can exceed the cooperative budget.

Storage remains bounded: 48 completed world tiles, 16 unfinished tiles, and 16 prepared tile references in the composition layer. Reset/world replacement drops the layer's references; world disposal clears pending and completed work.

Procedural prop cells, including empty cells, now share an 8,192-entry FIFO cache between visibility and collision queries. Cached props are frozen blueprints. Eviction cannot change generated identities, positions or collision. Road-distance sampling minimizes squared segment distances before taking one square root.

## Verification

`game/scripts/benchmark-world-rendering.mjs` runs real terrain composition and prop/collision queries using an installed `@napi-rs/canvas` provided through `CANVAS_MODULE`. Run with Node's `--experimental-strip-types`; an optional argument writes JSON. `WORLD_BENCH_SOURCE` can point to another checkout's absolute `game/src/` directory for comparison. It opens no browser, advances no simulation, and accesses no saves.

The terrain sample draws 180 positions at three horizontal and 0.9 vertical world units per frame, flushes native raster work with a pixel read, and excludes the initial cold frame. Historical measurements from the first traversal checkpoint, before the water system, on the development Mac:

| Work | Before | After |
| --- | ---: | ---: |
| 960 × 600 terrain, worst movement frame | 44.7 ms | 5.5 ms |
| 1600 × 900 terrain, worst movement frame | 58.8 ms | 10.0 ms |
| Nearby prop query, median | 0.393 ms | 0.017 ms |
| Twelve collision probes, median | 0.075 ms | 0.011 ms |

These are terrain/query CPU observations, not complete gameplay frame times or browser FPS. The ordinary-frame terrain median was 1.7 ms and 4.3 ms respectively after the change; preparation frames deliberately do more work to reduce crossing spikes. Other renderer passes, simulation, GPU work and cold generation can still affect the user's gameplay session.

That earlier checkpoint passed 606 code tests, strict/core compilation and production build. Tests cover overlapping/diagonal/negative terrain coverage, bounded prefetch, world replacement/reset, cooperative completion and prop cache eviction. A native Canvas comparison across fractional movement, boundary crossings, reversals and a negative-coordinate teleport produced zero differing pixel channels against the previous renderer. No browser gameplay test was run.

## Water and combat traversal pass

Static collision candidates now share a 256-entry cache of enclosing 256-unit regions. Movement, AI visibility and projectile probes reuse props, wilderness decor and buildings; exact original rectangle clipping and circle/rectangle contact checks still decide collisions. Disposing a world clears the cache. Procedural geography, movement, attack timing and saves are unchanged.

The shoreline terrain pass samples each shared lattice corner once (1,225 samples per 256-unit tile instead of 4,624) and yields every four sampling/drawing rows. This makes shoreline work cooperative with terrain preparation while retaining the same contours and submerged stones.

Water scrolls copy overlapping typed-array rows. Undisturbed water skips the wave solver until its first impulse, while the shader's ambient clock continues normally. Once disturbed, the original fixed-step equations run unchanged. Field revisions avoid repacking/uploading the static bed every frame and avoid uploading waves when unchanged. Texture storage and light arrays are reused; resize, world replacement, reset and WebGL context restoration invalidate the appropriate uploads. Scene and silhouette reflections continue updating each rendered water frame.

Verification for this pass:

- 983,872 blocked/movement results matched the preceding implementation across three seeds, including props, camp decor and town furniture.
- Native Canvas pixels matched exactly across 30 shoreline tiles; sampler calls fell from 138,720 to 36,750 (73.5% fewer).
- In the existing 2,880-probe collision benchmark, wilderness queries fell from 2,681 to eight. One development-machine sample reduced the median twelve-probe batch from 0.014 ms to 0.005 ms; timing varies with load, while the query-count reduction is deterministic.
- Regression tests cover 240 Hz subpixel prefetch, bounded collision storage, fluid strip sampling/revisions, and GPU upload lifecycle including context loss/restoration. GPU-call tests use an instrumented context; they do not measure GPU frame time.

The performance checkpoint passed all 645 code tests, strict/core compilation and the production build.

These optimizations remove repeated work without reducing visual resolution or changing gameplay. They do not promise a locked browser frame rate: first visits, teleports, driver upload costs and native raster operations can still stall. The player remains responsible for browser gameplay testing; no automated gameplay was driven.
