/** Native Canvas frozen-scene benchmark, no browser, simulation ticks or saves.
 * CANVAS_MODULE=/path/to/@napi-rs/canvas node --expose-gc --experimental-strip-types game/scripts/benchmark-zoom-rendering.mjs [report.json]
 * ZOOM_BENCH_SOURCE=/absolute/game/src supports paired source comparisons.
 * GPU effects, browser scheduling and worker terrain are NOT measured.
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
if (!globalThis.gc) throw Error('Run with --expose-gc: native Canvas allocations need collection between benchmark frames.');
if (!process.env.CANVAS_MODULE) throw Error('Set CANVAS_MODULE to an installed @napi-rs/canvas.');
const { createCanvas, GlobalFonts, Path2D } = require(process.env.CANVAS_MODULE);
const source = process.env.ZOOM_BENCH_SOURCE ? pathToFileURL(resolve(process.env.ZOOM_BENCH_SOURCE) + '/') : new URL('../src/', import.meta.url);
globalThis.Path2D = Path2D;
globalThis.document = { createElement(tag) {
  if (tag !== 'canvas') throw Error(tag);
  const canvas = createCanvas(1, 1), get = canvas.getContext.bind(canvas);
  canvas.getContext = kind => kind === '2d' ? get('2d') : null;
  canvas.addEventListener = canvas.removeEventListener = () => {};
  return canvas;
}, querySelector() { return null; } };
for (const [file, name] of [['PixelifySans-Variable.ttf', 'Pixelify Sans'], ['Barlow-Medium.ttf', 'Evergrow Numerals']])
  GlobalFonts.registerFromPath(fileURLToPath(new URL('assets/fonts/' + file, source)), name);
const { Renderer } = await import(new URL('renderer.ts', source));
const { FrameProfiler } = await import(new URL('frame-profiler.ts', source));
const { EnvironmentArt } = await import(new URL('environment-art.ts', source));
const { ArtLibrary } = await import(new URL('prop-art.ts', source));
const { zoomBenchmarkScene, ZOOM_BENCHMARK_SCENES, ZOOM_BENCHMARK_ZOOMS } = await import(new URL('zoom-benchmark-scenes.ts', source));
let builds = 0;
const seen = new WeakSet();
for (const [prototype, method] of [[EnvironmentArt.prototype, 'getSprite'], [ArtLibrary.prototype, 'getTree'], [ArtLibrary.prototype, 'getRock']]) {
  const original = prototype[method];
  prototype[method] = function (...args) { const sprite = original.apply(this, args); if (sprite && !seen.has(sprite)) { seen.add(sprite); builds++; } return sprite; };
}
const report = { mode: 'Native Canvas CPU; no WebGL, worker terrain, browser or simulation ticks; forced GC outside timings', width: 1209, height: 680,
  warmup: Math.max(0, Math.min(300, Number(process.env.ZOOM_WARMUP ?? 90))), frames: Math.max(1, Math.min(600, Number(process.env.ZOOM_FRAMES ?? 120))), results: [] };
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))];
for (const kind of ZOOM_BENCHMARK_SCENES) for (const zoom of ZOOM_BENCHMARK_ZOOMS) {
  if (process.env.ZOOM_SCENE && process.env.ZOOM_SCENE !== kind || process.env.ZOOM_LEVEL && Number(process.env.ZOOM_LEVEL) !== zoom) continue;
  console.error(`Measuring ${kind} at ${zoom}x`);
  const fixture = zoomBenchmarkScene(kind), profiler = new FrameProfiler(true), renderer = new Renderer(false, profiler);
  renderer.resize(report.width, report.height); renderer.cameraX = fixture.x; renderer.cameraY = fixture.y;
  const counts = [];
  for (let i = 0; i < report.warmup + report.frames; i++) {
    if (i === report.warmup) profiler.reset();
    // Native Skia retains prior frame snapshots behind reused lighting surfaces.
    // Release the destination's display list; browser canvases manage this at presentation.
    renderer.canvas.width = report.width; renderer.ctx.imageSmoothingEnabled = true;
    builds = 0; profiler.begin(performance.now());
    renderer.render(fixture.sim, fixture.world, 1 / 60, { fixedCamera: true, fixedCameraZoom: zoom, phase: 'paused', reducedMotion: false, skyHour: 10 });
    // Flush deferred native raster work before ending the CPU measurement.
    renderer.ctx.getImageData(0, 0, 1, 1); profiler.finish();
    if (i >= report.warmup) counts.push(builds);
    globalThis.gc();
  }
  const capture = profiler.snapshot();
  const result = { scene: kind, seed: fixture.seed, center: [fixture.x, fixture.y], zoom, enemies: fixture.sim.enemies.length,
    cpu: capture.metrics.frameCPU, spriteBuilds: { p50: percentile(counts, .5), p95: percentile(counts, .95), max: Math.max(...counts) },
    stages: Object.fromEntries(['sceneSetup', 'actors', 'props', 'characters', 'scenery', 'water', 'lighting'].map(stage => [stage, capture.metrics[stage]])),
    counters: renderer.renderStats };
  report.results.push(result); console.log(JSON.stringify(result));
  if (process.env.ZOOM_CAPTURE_DIR) { mkdirSync(process.env.ZOOM_CAPTURE_DIR, { recursive: true }); writeFileSync(resolve(process.env.ZOOM_CAPTURE_DIR, `${kind}-${zoom}.png`), renderer.canvas.toBuffer('image/png')); }
  renderer.reset(); fixture.world.dispose();
}
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
