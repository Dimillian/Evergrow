import './ui-kit.css';
import './typography.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Renderer } from './renderer.ts';
import { Simulation } from './simulation.ts';
import { PostFX } from './postfx.ts';
import { waterReviewScene, stageWaterScene } from './water-review-scene.ts';
if (!import.meta.env.DEV) throw new Error('Water study is local development only.');
installUITheme(); await loadGameFont();
const query = new URLSearchParams(location.search), input = document.querySelector<HTMLInputElement>('#seed')!;
const waterAge = Math.max(0, Math.min(86400, Number(query.get('age')) || 0));
let seed = Number(query.get('seed') ?? 7319) >>> 0, kind: 'river' | 'lake' = query.get('kind') === 'lake' ? 'lake' : 'river';
let world = new World(seed), scene = waterReviewScene(world, kind), sim = new Simulation(world, { spawn: false, startX: scene.x, startY: scene.y });
const renderer = new Renderer(), canvas = document.querySelector<HTMLCanvasElement>('#water')!, fx = new PostFX(canvas);
const abort = new AbortController(), motion = matchMedia('(prefers-reduced-motion: reduce)');
let last = performance.now(), time = 0, frame = 0, paused = false, renderAverage = 0;
function restart() {
  renderer.reset(); time = 0; last = performance.now(); stageWaterScene(sim, scene, 0, 0);
  document.querySelector<HTMLAnchorElement>('#atlas')!.href = `/atlas.html?seed=${seed}&view=extended&levels=1`;
  input.value = String(seed);
  for (const b of document.querySelectorAll('[data-kind]')) b.setAttribute('aria-pressed', String(b.getAttribute('data-kind') === kind));
  history.replaceState(null, '', `?seed=${seed}&kind=${kind}${waterAge ? `&age=${waterAge}` : ''}`);
}
function generate() { world.dispose(); world = new World(seed); scene = waterReviewScene(world, kind); sim = new Simulation(world, { spawn: false, startX: scene.x, startY: scene.y }); restart(); }
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-kind]')) button.addEventListener('click', () => { kind = button.dataset.kind as 'river' | 'lake'; generate(); }, { signal: abort.signal });
document.querySelector('#generate')!.addEventListener('click', () => { const value = Number(input.value); if (!Number.isInteger(value) || value < 0 || value > 4294967295) { input.setCustomValidity('Use a seed from 0 to 4294967295.'); input.reportValidity(); return; } input.setCustomValidity(''); seed = value; generate(); }, { signal: abort.signal });
document.querySelector('#replay')!.addEventListener('click', restart, { signal: abort.signal });
document.querySelector('#pause')!.addEventListener('click', e => { paused = !paused; (e.target as HTMLElement).textContent = paused ? 'Play' : 'Pause'; }, { signal: abort.signal });
restart();
function draw(now: number) {
  const dt = paused || document.hidden || motion.matches ? 0 : Math.min(.05, (now - last) / 1000); last = now;
  const ratio = devicePixelRatio || 1;
  if (canvas.width !== Math.round(innerWidth * ratio) || canvas.height !== Math.round(innerHeight * ratio)) {
    canvas.width = Math.round(innerWidth * ratio); canvas.height = Math.round(innerHeight * ratio);
    renderer.resize(620 * innerWidth / innerHeight, 620);
  }
  renderer.handleEvents(stageWaterScene(sim, scene, time, time + dt), motion.matches); time += dt;
  renderer.cameraX = scene.x; renderer.cameraY = scene.y - 80;
  const renderStart = performance.now();
  renderer.render(sim, world, dt, { phase: 'playing', reducedMotion: motion.matches, waterAge, fps: 60, debug: false });
  fx.render(renderer.canvas, time);
  renderAverage += (performance.now() - renderStart - renderAverage) * .04;
  canvas.dataset.renderMs = renderAverage.toFixed(2);
  document.querySelector('#status')!.textContent = `${kind === 'river' ? 'River crossing' : 'Lakeshore'} · Seed ${seed} · ${time < 4 ? 'Walking into water' : time < 7 ? 'Blade disturbances' : time < 10 ? 'Impact waves and reflected light' : 'Walking out'} ${waterAge ? ` · Surface age +${waterAge}s` : ''} · No gameplay ticks or saves`;
  if (time > 14) restart();
  frame = requestAnimationFrame(draw);
}
frame = requestAnimationFrame(draw);
function dispose() { renderer.reset(); cancelAnimationFrame(frame); abort.abort(); fx.dispose(); world.dispose(); }
window.addEventListener('pagehide', e => { if (!e.persisted) dispose(); }, { signal: abort.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
