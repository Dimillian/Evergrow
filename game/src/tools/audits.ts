import '../ui-kit.css';
import { FrameProfiler } from '../frame-profiler.ts';
import { PerformanceMonitor } from '../performance-monitor.ts';
import { toolPage } from './common.ts';
import { escapeUI as e } from '../ui-components.ts';
const root=await toolPage('Code & performance audits','Run commands in the repository terminal. This page documents access; it does not launch tests or alter a playable session.');
const commands=[['npm test','Headless tests for game rules, commands and persistence.'],['npm run typecheck','Application and core TypeScript checks.'],['npm run build','Type checking and production web build.'],['npm run check','Headless tests followed by the production build.'],['npm run stats','Current source, content and build statistics.'],['npm run test:browser','Optional Playwright regressions. Ask explicitly before agent-driven browser tests.'],['npm run release:check -- <last-published-source-sha>','Release-note and clean-source checks before a requested Sites publication.']];
root.insertAdjacentHTML('beforeend',`<div class="tool-split"><section class="tool-panel"><h2>Code checks</h2><table class="tool-table"><tbody>${commands.map(([cmd,description])=>`<tr><td><code>${e(cmd)}</code></td><td>${e(description)}</td></tr>`).join('')}</tbody></table><p>Commands run from the repository root. Results here are instructions, not claims of a passing run.</p></section><section class="tool-panel"><h2>Live frame profiler</h2><p>Press F3 during gameplay for the compact monitor, graph selector, freeze, reset and JSON export. No URL change or reload is needed. For continuous console profiling, open <a class="tools-button" href="/?profile=1" target="_top">Game with profiling ↗</a>, enter a character, then use the browser console:</p><pre>window.__evergrowPerformance.snapshot()
window.__evergrowPerformance.reset()</pre><p>600-frame window; median, p95, p99, maximum and ten slow CPU frames. Simulation, terrain, water, lighting, post-processing and UI timings. CPU timings do not measure GPU time.</p><h2>Offline render & capture scripts</h2><p>From <code>game/</code>, supply an installed <code>@napi-rs/canvas</code> path:</p><pre>CANVAS_MODULE=/absolute/path/to/canvas node --experimental-strip-types scripts/benchmark-world-rendering.mjs /tmp/world-timings.json

CANVAS_MODULE=/absolute/path/to/canvas node --experimental-strip-types scripts/benchmark-panels.mjs /tmp/panel-timings.json</pre><p>Other scripts: <code>render-world-map-review.mjs</code>, <code>render-art-review.mjs</code>, <code>render-water-animations.mjs</code>, <code>render-reward-animations.mjs</code>. Their headers document output and dependency arguments.</p><p>See <code>docs/world-performance.md</code> and <code>docs/development-tools.md</code>. Scene tools offer their own PNG or recording controls where supported.</p></section></div>`);

// Frozen synthetic timings exercise the actual UI without gameplay, saves or a second render loop.
const preview = document.createElement('section'); preview.className = 'tool-panel';
preview.innerHTML = '<h2>F3 monitor preview</h2><p>Synthetic sample data for layout inspection; these are not measured game results. Use the dropdown to inspect each graph.</p><div class="performance-preview" style="position:relative; height:520px; background:linear-gradient(140deg,#17262d,#090f17); overflow:hidden"></div><button class="tools-button">Restore sample data</button>';
root.append(preview);
let sampleClock = 0;
const profiler = new FrameProfiler(true, () => sampleClock);
const monitor = new PerformanceMonitor(profiler, preview.querySelector<HTMLElement>('.performance-preview')!, {
  continuous: true, releaseInput() {}, returnFocus() {}, isToggle: event => event.code === 'F3',
});
function fillPreview() {
  profiler.reset(); sampleClock = 0;
  for (let i = 0; i < 600; i++) {
    const stamp = i * (1000 / 60); sampleClock = stamp; profiler.begin(stamp);
    const wave = Math.sin(i / 25) * .7, spike = i === 460 ? 19 : 0;
    sampleClock += 1.2 + wave / 2; profiler.end('simulation', stamp);
    const world = sampleClock; sampleClock += 5.5 + wave + spike; profiler.end('world', world);
    profiler.end('terrain', sampleClock - 1.4 - spike); profiler.end('water', sampleClock - .8);
    profiler.end('lighting', sampleClock - 1.6); profiler.end('actors', sampleClock - 1.8);
    profiler.end('props', sampleClock - .8); profiler.end('structures', sampleClock - .3); profiler.end('characters', sampleClock - .7);
    profiler.end('sceneSetup', sampleClock - .4); profiler.end('scenery', sampleClock - 2.1);
    const post = sampleClock; sampleClock += .7; profiler.end('postfx', post);
    const ui = sampleClock; sampleClock += .9; profiler.end('ui', ui);
    profiler.setCounters({ enemies: 24 + Math.round(wave * 8), projectiles: 8 + Math.round(wave * 5), groundEffects: 4,
      terrainTiles: 48, terrainQueued: Math.max(0, Math.round(wave * 5)) });
    profiler.finish();
  }
  monitor.setOpen(true); monitor.update(sampleClock, 'study');
}
preview.querySelector('button')!.addEventListener('click', fillPreview);
fillPreview();
if (new URLSearchParams(location.search).get('view') === 'monitor') preview.scrollIntoView();
if (import.meta.hot) import.meta.hot.dispose(() => monitor.dispose());
