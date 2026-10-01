import { Renderer } from '../renderer.ts';
import { PostFX } from '../postfx.ts';
import { FrameProfiler } from '../frame-profiler.ts';
import { ZOOM_BENCHMARK_SCENES, ZOOM_BENCHMARK_ZOOMS, zoomBenchmarkScene } from '../zoom-benchmark-scenes.ts';

function nextFrame(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(); return; }
    const cancel = () => { cancelAnimationFrame(id); resolve(); };
    const id = requestAnimationFrame(() => { signal.removeEventListener('abort', cancel); resolve(); });
    signal.addEventListener('abort', cancel, { once: true });
  });
}

/** Explicitly started, save-free renderer study; never advances gameplay. */
export function mountZoomBenchmark(root: HTMLElement) {
  const panel = document.createElement('section'); panel.className = 'tool-panel';
  panel.innerHTML = `<h2>Zoom rendering benchmark</h2><p>Compare the same frozen forest, river and 256-enemy rift at 1.8×, 1× and 0.8×. Includes browser WebGL effects; excludes AI, saves and worker terrain. Each view warms for 90 frames, then captures 120. CPU timings are submission times, not GPU execution.</p>
    <button class="tools-button" data-run>Run zoom benchmark</button> <button class="tools-button" data-export disabled>Export JSON</button><p data-status role="status">Ready · 1209 × 680 logical pixels</p>
    <canvas width="1209" height="680" style="width:100%;max-width:900px;height:auto" aria-label="Frozen benchmark scene" hidden></canvas>
    <table class="tool-table"><thead><tr><th>Scene / zoom</th><th>CPU median / p95 / p99</th><th>Props / enemies drawn</th><th>Sprite misses p95</th></tr></thead><tbody></tbody></table>`;
  root.append(panel);
  const button = panel.querySelector<HTMLButtonElement>('[data-run]')!, download = panel.querySelector<HTMLButtonElement>('[data-export]')!;
  const status = panel.querySelector<HTMLElement>('[data-status]')!, rows = panel.querySelector('tbody')!, canvas = panel.querySelector('canvas')!;
  const captures: Array<{ scene: string; zoom: number; seed: number; capture: ReturnType<FrameProfiler['snapshot']> }> = [];
  let abort: AbortController | undefined;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.addEventListener('pagehide', () => abort?.abort());
  button.addEventListener('click', async () => {
    if (abort) { abort.abort(); return; }
    const controller = abort = new AbortController(); button.textContent = 'Cancel'; download.disabled = true;
    captures.length = 0; rows.replaceChildren(); canvas.hidden = false;
    const profiler = new FrameProfiler(true), renderer = new Renderer(false, profiler), post = new PostFX(canvas);
    let failure = '';
    renderer.resize(canvas.width, canvas.height);
    try {
      for (const scene of ZOOM_BENCHMARK_SCENES) for (const zoom of ZOOM_BENCHMARK_ZOOMS) {
        const fixture = zoomBenchmarkScene(scene);
        try {
          renderer.reset(); renderer.cameraX = fixture.x; renderer.cameraY = fixture.y;
          for (let frame = 0; frame < 210; frame++) {
            await nextFrame(controller.signal);
            if (controller.signal.aborted) return;
            if (document.hidden) { profiler.suspend(); frame--; continue; }
            if (frame === 90) profiler.reset();
            status.textContent = `${scene} · ${zoom}× · ${frame < 90 ? 'Warming' : 'Capturing'} ${frame < 90 ? frame + 1 : frame - 89}/${frame < 90 ? 90 : 120}`;
            profiler.begin(performance.now()); const worldStart = profiler.start();
            renderer.render(fixture.sim, fixture.world, 1 / 60, { phase: 'paused', fixedCamera: true, fixedCameraZoom: zoom, reducedMotion, skyHour: 10 });
            profiler.end('world', worldStart); const postStart = profiler.start();
            post.render(renderer.canvas, 0); profiler.end('postfx', postStart); profiler.finish();
          }
          const capture = profiler.snapshot(), metrics = capture.metrics, stats = renderer.renderStats;
          captures.push({ scene, zoom, seed: fixture.seed, capture });
          const row = document.createElement('tr');
          for (const value of [`${scene} / ${zoom}×`, `${metrics.frameCPU.p50.toFixed(1)} / ${metrics.frameCPU.p95.toFixed(1)} / ${metrics.frameCPU.p99.toFixed(1)} ms`,
            `${stats.visibleProps} / ${stats.visibleEnemies}`, String(metrics.spriteMisses.p95)]) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
          rows.append(row);
        } finally { fixture.world.dispose(); }
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    } finally {
      renderer.reset(); post.dispose(); abort = undefined; button.textContent = 'Run zoom benchmark'; download.disabled = captures.length === 0;
      status.textContent = `${failure ? `Failed: ${failure}` : controller.signal.aborted ? 'Cancelled' : 'Finished'} · ${captures.length}/9 captures · no gameplay advanced`;
    }
  });
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ width: 1209, height: 680, mode: 'Frozen browser renderer', reducedMotion, captures }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'evergrow-zoom-rendering.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
