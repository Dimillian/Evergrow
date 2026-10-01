/** Explicitly requested, frozen browser renderer study. Start Vite separately.
 * node game/scripts/benchmark-browser-zoom.mjs /tmp/zoom.json
 * EVERGROW_BROWSER_PATH selects an installed Chromium; ZOOM_BENCH_URL selects Vite.
 * ZOOM_SCENES=forest,water,crowd ZOOM_LEVELS=1.8,1,0.8 ZOOM_WARMUP=90 ZOOM_FRAMES=120
 * ZOOM_CAPTURE_DIR saves PNGs; ZOOM_CPU_PROFILES=1 saves Chromium CPU profiles there.
 * No gameplay ticks, storage, input or playable game entrypoint.
 */
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const count = (value, fallback, max) => {
  const n = Number(value ?? fallback);
  if (!Number.isInteger(n) || n < 1 || n > max) throw Error(`Invalid frame count: ${value}`);
  return n;
};
const warmup = count(process.env.ZOOM_WARMUP, 90, 600), frames = count(process.env.ZOOM_FRAMES, 120, 600);
const scenes = (process.env.ZOOM_SCENES ?? 'forest,water,crowd').split(','), zooms = (process.env.ZOOM_LEVELS ?? '1.8,1,0.8').split(',').map(Number);
if (scenes.some(s => !['forest', 'water', 'crowd'].includes(s)) || zooms.some(z => !Number.isFinite(z) || z < .8 || z > 1.8)) throw Error('Invalid scene or zoom');
const output = resolve(process.argv[2] ?? '/tmp/evergrow-browser-zoom.json'), captures = process.env.ZOOM_CAPTURE_DIR;
if (captures) mkdirSync(captures, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.EVERGROW_BROWSER_PATH, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1209, height: 680 } });
  const warnings = [];
  page.on('pageerror', error => console.error(error));
  page.on('console', message => {
    if (['warning', 'error'].includes(message.type()) && warnings.length < 100) warnings.push(message.text());
  });
  await page.route('**/__zoom_benchmark__', route => route.fulfill({ contentType: 'text/html',
    body: '<html><body style="margin:0"><canvas width="1209" height="680"></canvas></body></html>' }));
  await page.goto(new URL('/__zoom_benchmark__', process.env.ZOOM_BENCH_URL ?? 'http://127.0.0.1:5173').href);
  await page.evaluate(async () => {
    const [{ Renderer }, { PostFX }, { FrameProfiler }, { zoomBenchmarkScene }, { loadGameFont }] = await Promise.all(
      ['/src/renderer.ts', '/src/postfx.ts', '/src/frame-profiler.ts', '/src/zoom-benchmark-scenes.ts', '/src/font.ts'].map(p => import(p)));
    await loadGameFont();
    const gl = document.createElement('canvas').getContext('webgl'), extension = gl?.getExtension('WEBGL_debug_renderer_info');
    window.benchmarkInfo = { agent: navigator.userAgent, gpu: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unknown' };
    window.setupBenchmark = (scene, zoom) => {
      window.benchmark?.renderer.reset(); window.benchmark?.world.dispose(); window.benchmark?.post.dispose();
      const fixture = zoomBenchmarkScene(scene), profiler = new FrameProfiler(true), renderer = new Renderer(false, profiler);
      const post = new PostFX(document.querySelector('canvas'));
      renderer.resize(1209, 680); renderer.cameraX = fixture.x; renderer.cameraY = fixture.y;
      window.benchmark = { ...fixture, profiler, renderer, post, zoom };
    };
    window.runBenchmark = async count => {
      const { renderer, world, sim, profiler, post, zoom } = window.benchmark; profiler.reset();
      for (let i = 0; i < count; i++) {
        await new Promise(requestAnimationFrame); profiler.begin(performance.now());
        let start = profiler.start();
        renderer.render(sim, world, 1 / 60, { fixedCamera: true, fixedCameraZoom: zoom, phase: 'paused', reducedMotion: false, skyHour: 10 });
        profiler.end('world', start); start = profiler.start(); post.render(renderer.canvas, 0);
        profiler.end('postfx', start); profiler.finish();
      }
      return profiler.snapshot();
    };
  });
  const report = { info: await page.evaluate(() => window.benchmarkInfo), width: 1209, height: 680, warmup, frames,
    mode: 'Frozen browser CPU submissions and stalls; excludes simulation, saves, terrain workers and device GPU timing', warnings, results: [] };
  const cdp = await page.context().newCDPSession(page);
  if (process.env.ZOOM_CPU_PROFILES) await cdp.send('Profiler.enable');
  for (const scene of scenes) for (const zoom of zooms) {
    console.error(`Measuring ${scene} at ${zoom}x`);
    await page.evaluate(({ scene, zoom }) => window.setupBenchmark(scene, zoom), { scene, zoom });
    await page.evaluate(n => window.runBenchmark(n), warmup);
    if (process.env.ZOOM_CPU_PROFILES) await cdp.send('Profiler.start');
    const capture = await page.evaluate(n => window.runBenchmark(n), frames);
    const graphics = await page.evaluate(() => ({ postfx: !!window.benchmark.post.gl,
      outdoor: !!window.benchmark.renderer.outdoorLightEffects.program, water: !!window.benchmark.renderer.waterArt.shader.program }));
    if (process.env.ZOOM_CPU_PROFILES) {
      const { profile } = await cdp.send('Profiler.stop');
      if (captures) writeFileSync(resolve(captures, `${scene}-${zoom}.cpuprofile`), JSON.stringify(profile));
    }
    report.results.push({ scene, zoom, graphics, capture }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    if (captures) {
      // Capture the rendered scene directly; WebGL's presented default buffer may be discarded between RAFs.
      const png = await page.evaluate(() => window.benchmark.renderer.canvas.toDataURL('image/png'));
      writeFileSync(resolve(captures, `${scene}-${zoom}.png`), Buffer.from(png.split(',')[1], 'base64'));
    }
    console.log(JSON.stringify({ scene, zoom, cpu: capture.metrics.frameCPU, characters: capture.metrics.characters,
      lighting: capture.metrics.lighting, misses: capture.metrics.spriteMisses }));
  }
} finally { await browser.close(); }
