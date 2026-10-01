# Walking and terrain performance

## Zoomed-out rendering (October 1, 2026, local)

This pass targets scenery and rig rendering. Gameplay population, 120 Hz simulation, targeting, world generation and saves are unchanged.

- `scenery-cache.ts` replaces the environment's 96-entry eviction policy with byte-budgeted scene retention. Environment and base scenery reserve at most 160 MiB and 96 MiB respectively, including a conservative 12× allowance for source-associated lighting/shadow surfaces. These are raster reservations, not measured GPU/process memory or a budget for the entire renderer. Independent terrain, water and other caches retain their own limits.
- Each library plans all candidate sprite keys before any render pass. Raster tiers follow camera zoom with hysteresis; if the view's estimated working set exceeds its budget, tiers step down to a minimum half-resolution source. Logical geometry, collision, depth ordering and independently moving foliage stay unchanged. Inactive entries evict first. If even the minimum tier exceeds the budget, bounded eviction still applies; arbitrary oversized review views are not guaranteed zero misses.
- Props are rejected using scaled source bounds plus wind/bending allowance **before** allocating and sorting draw entries. Enemy rigs use rank-scaled body, weapon/recoil and status-effect envelopes instead of a blanket 256-unit margin. Attack warnings remain in their independent pass.
- At zoom below 0.95, non-emissive props under 180 projected logical pixels can use a cached combined base/relief image for each moving layer. Fine outdoor edge glints/wet sheen are omitted for those compact layers. Canopy movement and player-occlusion alpha remain live. Sky changes use small quantized lighting steps, with at most four layer bakes per frame; missing combined layers initially use the existing detail path.
- F3's **Characters** timing includes player and enemy rigs as well as NPCs. **Visible objects**, **Scenery cache**, and **Scenery memory** show render admissions, per-frame hits/misses/evictions, and reserved raster MiB. JSON exports include camera zoom and gauge units. Rendering counters are sampled every frame; simulation population counters retain their 10 Hz updates. Nested timings are not additive.

### Repeatable zoom comparisons

**Data & audits → Zoom rendering benchmark** (`/tools/audits.html`) runs only when its button is pressed. It uses the real Renderer and PostFX on frozen forest (seed 18427, center 5000/5000), river (seed 7319), and 256-enemy rift (seed 7342) fixtures, at a 1209 × 680 logical viewport. Each fixture is compared at 1.8×, 1× and 0.8× after 90 warmup frames, with 120 captured frames. The table reports CPU median/p95/p99, admitted props/enemies and p95 sprite misses. Export JSON retains full captures. Cancel and page exit release the study; operating-system reduced motion is respected and recorded. No AI ticks, gameplay input or save access occur. Frozen terrain uses the synchronous path, so this does not measure runtime worker streaming.

An optional native Canvas equivalent runs without a browser:

```sh
CANVAS_MODULE=/absolute/path/to/@napi-rs/canvas node --expose-gc --experimental-strip-types game/scripts/benchmark-zoom-rendering.mjs /tmp/zoom-rendering.json
```

`ZOOM_SCENE=forest`, `ZOOM_LEVEL=0.8`, `ZOOM_WARMUP=90`, `ZOOM_FRAMES=120`, and `ZOOM_CAPTURE_DIR=/tmp/zoom-captures` optionally narrow the run or export images. `ZOOM_BENCH_SOURCE` selects another checkout's absolute `game/src` directory; an older checkout must also receive the identical `zoom-benchmark-scenes.ts` fixture. Native runs release the destination display list and force GC between frames to bound Skia snapshot retention. CPU measurements include native raster completion but exclude that cleanup, WebGL, browser scheduling and terrain workers. They are not browser FPS measurements.

Regression coverage includes the reported forest's former cache-churn access sequence, working-set eviction and hard byte limits, zoom-tier hysteresis and geometry preservation, bounded combined-light bakes, scaled render bounds, and player/enemy profiler integration. Use F3 exports on the affected device for sustained gameplay acceptance, including movement, combat effects and GPU pressure.

### Local verification

All nine final native captures (three scenes × three zoom levels, 90 warmup and 30 measured frames each) completed with **zero warmed sprite rebuilds and zero sprite evictions**. This does not imply zero terrain, lighting or effect work.

The native forest comparison against `0370246` used 90 warmup frames and 30 measured frames at 0.8×. The previous renderer generated **41 new scenery sprites on every measured frame**; the updated renderer generated **zero**, with zero sprite evictions. The revised image retains full-resolution canopy sources in this fixture; its combined shading deliberately omits small moving edge glints. Source/derived raster reservations for both scenery libraries together were approximately 146 MiB, not a measurement of process or GPU memory.

For the unchanged 256-enemy rift fixture, conservative bounds reduce rig submissions from **129 to 76** at 1.8×, **201 to 141** at 1×, and **230 to 182** at 0.8×. All 256 actors remain in simulation. These deterministic work counts are independent of host speed. Native timings were collected on a shared cloud CPU and are not used to claim browser FPS or device frame-time gains.

Application/headless type checks and the production build pass. The 1,777-test suite exercised the change; one unrelated cloud-worker acknowledgement timeout (including its parent test) passed on an isolated rerun of all 38 cloud-cadence tests. The final scenery/art regression group also passed all 17 tests after raster-policy refinement. No automated browser gameplay was run.

## Outline, outdoor lighting and navigation follow-up (October 1, 2026)

The follow-up profiles the real browser renderer and the existing headless crowd simulation separately. Ranked silhouettes now use upward-rounded 1×/1.5×/2× raster density based on their displayed transform. Tint, four rim samples, soft glow and the live rig are composed on a small reusable surface before one image reaches the world canvas. The world canvas receives precomposed images instead of per-enemy shadow-blur operations. Body/weapon bounds, pose updates, rank colors and screen-space glow width are retained; each creature kind has at most three density tiers and Renderer reset releases them.

Outdoor ground relief, air and clouds now render together into one GPU atlas, followed by one WebGL-to-Canvas snapshot. The original depth order and screen/multiply blend modes are retained when the atlas crops are drawn around actors and world illumination. Ground relief keeps half resolution (640-pixel maximum axis); soft air uses quarter resolution and broad clouds one-eighth resolution. Extruded one-pixel gutters keep filtered crops from bleeding into one another at screen edges. At 1209 × 680 this shades about 56% fewer pixels across the three passes. Sky, canopy motion and light uniforms still update at their existing rates; the fixed CRT and native-resolution HUD are unchanged.

Navigation shares exact target anchors (64 entries) and directed, radius-specific grid-edge clearance proofs (65,536 entries). A bounded FIFO ring evicts old edges without repeatedly scanning deleted Map slots. Each route also reuses its source connectors while scoring waypoints. Source coordinates are never rounded for clearance checks, and movement/contact tests remain live. Breaking a container and disposing the world invalidate all navigation caches. Population and 120 Hz simulation are unchanged.

A before/after replay of the existing 128/256/512-enemy rift scenarios matched the full sampled player, enemy, projectile, ground-effect, event and expedition state across **1,260 ticks**. Calls to `WorldLandscape.walkableSegment` fell from **2,594,107 to 1,373,106 (47%)**. Tests additionally cover clearance radii, fractional/negative positions, route invalidation, outline geometry and reuse, atlas crop order/gutters, context restoration and reduced motion.

### Follow-up verification

`npm run check` passed **all 1,781 tests**, application/core type checking and the production build. All nine final browser captures (three scenes × three zooms, 90 warmup + 30 measured frames) had zero warmed sprite misses and evictions. Forest and crowd PNGs were compared with `a18dff4`; the ground detail, depth order, rank silhouettes and lighting remain present, with the intended lower-density small outlines and soft air/cloud sampling.

Paired 0.8× frozen browser captures against `a18dff4`, Chromium 151 with **software SwiftShader**, 1209 × 680, identical 90/30 warmup/sample counts and no CPU sampling profiler:

| Scene | Before median frame CPU | After median frame CPU | Change |
| --- | ---: | ---: | ---: |
| Forest | 208.5 ms | 148.8 ms | −29% |
| 256-enemy rift (182 rigs admitted) | 336.7 ms | 259.0 ms | −23% |

These unusually high absolute times reflect software graphics on a shared cloud host. They are measurements of this environment, not device FPS or a promised hardware speedup. Tail timings vary with host scheduling. The separate 512-enemy simulation benchmark measured 25.835 → 18.422 ms median per two fixed ticks (−29%); the exact replay/query-count comparison above is independent of host speed.

### Browser reproduction

With Vite running, the optional terminal study uses the same disposable fixtures and runtime Renderer/PostFX as Data & audits:

```sh
EVERGROW_BROWSER_PATH=/path/to/chromium node game/scripts/benchmark-browser-zoom.mjs /tmp/zoom.json
```

It opens only an isolated frozen study, advances no gameplay and accesses no saves. `ZOOM_BENCH_URL` selects another local checkout's Vite server. `ZOOM_SCENES=forest,crowd`, `ZOOM_LEVELS=0.8`, `ZOOM_WARMUP=90`, `ZOOM_FRAMES=30` narrow a comparison. `ZOOM_CAPTURE_DIR` saves world PNGs; `ZOOM_CPU_PROFILES=1` additionally records CPU profiles in that directory. JSON records the actual browser/graphics renderer. Agent-driven browser studies still require user authorization; this follow-up was explicitly requested.

CPU stage samples include submission and synchronization stalls, which can be charged to a later Canvas operation or texture upload. Nested timings overlap. Frozen captures exclude simulation, combat effect creation, camera traversal, terrain workers and saves. Software SwiftShader observations locate work and support paired comparisons; they are not target-device FPS predictions. Captures compare the retained silhouettes and lighting; these optimisations do not promise pixel-identical supersampling or blur.

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

## Background terrain, storage and reusable lighting (2026-09-06)

Runtime surface terrain now generates its full procedural tiles in a module worker using `OffscreenCanvas`. The game thread immediately composes a 16 × 16 underlay from 25 shared world-color samples, then fades each finished tile over 160 ms. The stream allows one outstanding generation request and at most 256 wanted/transferred tiles; viewport changes reprioritize work and close stale `ImageBitmap`s. Reset terminates the worker and closes its retained bitmaps. Frozen reviews, dungeon geometry and browsers without worker Canvas support use the existing cooperative renderer. An unexpected worker error also falls back to that path. Worker generation is used in the playable game, so synchronous review timings do not measure this change.

Static prop reflection stamps and their composed water layer are cached separately from the moving player. Fixed environmental lights cache their clipped/shadowed cookies after a stable observation; intensity flicker still applies every frame. Prop-coverage changes invalidate shadow geometry. Both caches have explicit size limits and clear on world reset. A native Canvas comparison found **zero differing channels** across 30 lighting frames and 25 reflection frames, including moving cameras, animated characters and changed shadow props. In that sample, shadow construction fell from 30 calls to three.

Water optics render only the visible wet bounds, padded at the field edge for filtering. Scene transfer includes another 192 world units for refraction, uses bounded resolution, and quantizes buffer dimensions to avoid repeated allocation. A 100 × 300 river inside a 1,000 × 600 view uses a 484 × 600 source rectangle, under half the original source area before pixel rounding. Dry views skip this work. Water and CRT still use separate GPU contexts: this pass reduces transfer area rather than rebuilding the entire actor/light composition in one GPU renderer.

Character and chart JSON encoding, validation, backup handling and disk writes now run in a **separate save worker**, using IndexedDB transactions. Terrain work cannot block the save worker. Live checkpoint staging uses native structured cloning. Routine autosaves coalesce; exploration snapshots preserve discoveries made while a write is pending. Purchases, portal/dungeon travel and POI claims hold simulation and new commands while awaiting save-before-commit, with rendering continuing. This storage replacement intentionally starts a fresh set of local prototype slots; it does not import the previous localStorage characters.

### Measuring real play sessions

Press **F3** during gameplay to toggle the compact, nonmodal performance monitor. Its dropdown selects Frame timing, CPU breakdown, Rendering detail, Props & characters, Scene load or Terrain streaming. The summary reports rolling FPS (frame count divided by uncapped elapsed time), p95/p99 frame intervals and the number of intervals above 50 ms. Timing graphs mark the 16.7 ms / 60 FPS reference budget; it is a reference, not a measured refresh rate or a new frame cap. History holds up to 600 frames and labels its actual duration.

Freeze holds the displayed capture while gameplay and profiling continue; Resume returns to current samples. Reset starts a fresh capture. Export JSON downloads the frozen capture or current timeline, percentiles and ten slow CPU frames. Reports contain timings and scene counts, not character checkpoints. The panel uses native-resolution Canvas graphs and the shared UI frame/fonts above world post-processing. Its controls consume pointer/keyboard input without pausing gameplay; Escape closes it when one of its controls has focus. F3 respects the current performance-overlay binding. Its visible DOM rectangle is projected into the shared logical UI hit region, including canvas-captured drags and navigation-hidden layouts. Coordinate-based entry clears held input and queued simulation actions; closing the monitor removes its hit region.

Collection starts immediately when opened and stops when closed, unless `?profile=1` explicitly requests continuous collection. `window.__evergrowPerformance.snapshot()` and `.reset()` remain available. Counters and charts refresh at 10 Hz, summaries at 2 Hz, with reusable chronological sample storage. The monitor's own CPU time is recorded separately. Scene counts cover living enemies, projectiles and ground effects in the active simulation. Terrain counts show resident worker tiles (or the synchronous cache) and outstanding worker tiles; pending includes in-flight work. Dungeon statistics use the actual floor tile cache, including its 64-tile eviction limit and disposal, rather than the unused overworld cache. Review `/tools/audits.html?view=monitor` for the real UI with frozen synthetic samples, without playable saves or gameplay.

World timing contains the render sub-stages. Scenery includes some water/lighting work, and Actors contains props, structures and characters: these nested values are not additive. CPU breakdown uses separate top-level stages plus unaccounted work. CPU submission timings do not measure GPU execution. Frame interval includes browser scheduling, GPU pressure and idle time. Background/native suspension and phase transitions break the cadence; graphs omit inactive gaps and exports mark segment starts with zero intervals. Long active-play stalls remain uncapped in telemetry even though simulation delta is bounded. Freezing the monitor does not freeze the simulation.

Code checks establish sampling and UI integration correctness, **not a measured browser FPS improvement or a measured overhead budget**. Gameplay acceptance and monitor overhead remain the user's playtest measurements.

The completed pass passed 654 headless/code tests, strict/core compilation and the production build. Five new IndexedDB/session tests cover cross-tab compare-and-write, queued snapshots, deferred reward rejection, chart union and discoveries made during a pending save. The real terrain worker entrypoint also produced identical pixel channels for twelve tiles across three seeds using native Canvas with no `document` global. This verifies its DOM-free drawing path; browser worker scheduling and GPU execution remain user playtest measurements.

## Local atmosphere and lighting pass (2026-09-09)

The current camera and procedural assets remain in place. `scene-light-style.ts` owns a consistent upper-left sky key, continuously blended biome light colors, indoor attenuation and bounded height-to-ground shadow projection. `gear-scene-light.ts` combines that key with the existing eighteen scene lights and respects enclosed light polygons. Authored equipment normals retain separate roughness/metallic responses; stronger diffuse shaping and light-directed reflection bands distinguish steel from leather and cloth. `prop-surface-light.ts` adds cached, alpha-masked directional shading to existing scenery sprites; this is a painted relief approximation, not a new normal/depth-buffer renderer.

`scene-shadows.ts` projects the actual cached trunk, rock and crown silhouettes onto the ground. Crown shadows follow the same wind field and per-layer phase as the foliage, with two faint samples for the penumbra. Up to 100 visible shadow casters use masks no larger than 144 pixels. Weak caches follow the lifetime of source sprites and clear on renderer reset. The old static canopy patches are removed; baked contact shade remains. Actor cast shadows use bounded soft body projections oriented away from their sampled scene light, with dense foot contact and reduced opacity on water. These are grounding approximations, not articulated shadow meshes. Ground shadows precede the depth-sorted actors.

`atmosphere-art.ts` places separate world-anchored ground and foreground mist banks, with cooler woodland mist, warm dry-climate haze and restrained dungeon floor wisps. Each layer admits at most 96 cells; 32 small procedural tint cookies are cached. Foreground mist thins around the player, disappears indoors and is omitted in dungeons. Enclosed ground mist requires a clear floor footprint. Reduced motion freezes wind and mist displacement. Existing biome particles remain independent.

The fixed CRT composite now uses restrained split-tone contrast with a preserved dark toe, warmer highlights, cooler shadows and less bloom spill. No new render targets, texture readbacks, per-frame blur filters or graphics settings are introduced. Native-resolution HUD, attack warnings, input projection, collisions, saves and world generation are unchanged. Code checks cover cache reuse, reduced motion, enclosed fog rejection, blended light, material response and shadow direction; device frame-time and visual acceptance still require the player's test.

## Dungeon crowds · September 10, 2026

A Node CPU profile of real dungeon crowd simulation found most samples inside repeated room/corridor polygon containment. Every sight ray and body-clearance probe scanned the floor, making pursuing groups expensive even before rendering. Frozen floors now use a 64-unit spatial index: only local silhouettes are candidates, and cells with no intersecting outline edges cache a proven uniform result. Boundary cells retain exact polygon checks. Small body queries whose entire bounds lie in open cells skip redundant perimeter probes. Cache storage is limited to the finite floor bounds and weakly owned by the floor. Generation uses uncached queries until geometry is frozen.

Dungeon admission now indexes the static roster by room and checks existing actors using a set; spawn ordering, offscreen requirements, casualties and reward rules are unchanged. Drawing skips wholly offscreen enemy rigs with a conservative 256-unit world margin. Their movement and combat still simulate, including when pursuing from another room. There is no new enemy-count cap or reduced simulation frequency.

Run `node --experimental-strip-types game/scripts/benchmark-dungeon-crowds.ts` from the repository root; add `--uncached` to compare the original exact collision algorithm in the same scenario. This disposable headless study uses seed 7319, real dungeon geometry and a mixed melee/ranged crowd, 360 fixed simulation ticks, discarding the first 60 for warm-cache reporting. It accesses no saves and opens no browser.

Measured on the development machine:

| Enemies | Original median tick | Indexed median tick | Original p95 | Indexed p95 |
| --- | ---: | ---: | ---: | ---: |
| 24 | 2.635 ms | 0.055 ms | 10.885 ms | 0.144 ms |
| 48 | 5.385 ms | 0.104 ms | 21.641 ms | 0.303 ms |
| 96 | 15.894 ms | 0.268 ms | 53.003 ms | 0.684 ms |

These are CPU simulation measurements, not browser frame rates, GPU measurements or a guarantee for every encounter. Cold navigation, rendering and effects remain part of the real frame budget. Differential tests compare all six theme outlines, wall vertices, negative coordinates, cell boundaries and radii from 0 to 1000 against the original algorithm; a deterministic crowd replay produces identical enemies, projectiles and events. Dungeon/expedition, AI, navigation and spawn regressions also pass.
