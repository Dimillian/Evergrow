import './typography.css';
import './ui-kit.css';
import './layout-review.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { Simulation } from './simulation.ts';
import { eventSite, type EventKind, type EventRecord, type EventSite } from './poi-content.ts';
import { eventRewards } from './poi-rewards.ts';
import { treasureLanding } from './treasure-flight.ts';
import { EventPanel } from './poi-panel.ts';
import { eventRecipe } from './event-recipes.ts';
import { freshWaves } from './wave-system.ts';
import './tools/event-review.css';
// Frozen, memory-only scenes. Only presentation time advances; no combat, inputs or storage.
const views: readonly [EventKind, string][] = [
  ['cursedChest', 'Cursed chest'], ['ruinedChapel', 'Chapel'], ['beastDen', 'Den'], ['quarry', 'Quarry'],
  ['hamlet', 'Hamlet'], ['crossing', 'Crossing'], ['corruptedGrove', 'Grove'], ['camp', 'Strongbox'],
  ['caravan', 'Caravan'], ['watchtower', 'Beacon'], ['graveyard', 'Vigil'], ['standingStones', 'Blessing'], ['reliquary', 'Reliquary'],
];
const root = document.querySelector<HTMLElement>('#event-review')!;
const lifetime = new AbortController();
let disposed = false, frame = 0, world: World | undefined, fx: PostFX | undefined, panel: EventPanel | undefined;
async function boot() {
  if (!import.meta.env.DEV) throw new Error('Local review only.');
  installUITheme(); await loadGameFont(); if (disposed) return;
  world = new World(7319); const scene = world;
  const landmarks = scene.getWildernessSites(-8000, -8000, 16000, 16000);
  const sites = landmarks.map(s => eventSite(s, scene.seed));
  const relic = scene.getEventSites(-2000, -16000, 4000, 32000).find(s => s.kind === 'reliquary');
  if (relic) sites.push(relic);
  const renderer = new Renderer(), display = document.createElement('canvas'), canvas = document.createElement('canvas');
  for (const c of [display, canvas]) { c.width = 1920; c.height = 1280; }
  canvas.className = 'layout-review-scene'; canvas.setAttribute('role', 'img');
  root.innerHTML = `<header class="layout-review-header"><h1>World events</h1></header>
    <div class="layout-review-toolbar"><nav class="layout-review-views"></nav><button class="state-button">Show claimed</button><button class="progress-button">Preview In Progress</button><button class="opening-button">Preview opening</button><button class="choice-button">Show choices</button></div>
    <div class="event-review-progress" hidden><button class="progress-play">Pause</button><label>Elapsed <input class="progress-time" type="range" min="0" step="0.1" value="0"></label><output class="progress-readout"></output><label>Speed <select class="progress-speed"><option value="1">1×</option><option value="5">5×</option><option value="10">10×</option></select></label><button class="progress-restart">Restart</button></div>
    <p class="layout-review-static">Disposable visual preview · No combat or saves. The countdown uses the event recipe; enemy waves are not simulated.</p>
    <figure class="layout-review-figure"><div class="layout-review-frame"></div></figure>`;
  root.querySelector('.layout-review-frame')!.append(canvas);
  panel = new EventPanel(document.body, { close: () => panel!.close(), choose: () => panel!.close() });
  const params = new URLSearchParams(location.search);
  let kind = views.find(([k]) => k === params.get('view'))?.[0] ?? 'cursedChest', claimed = false;
  let sim: Simulation, selected: EventSite;
  let inProgress = false, paused = false, previous = 0;
  const progressControls = root.querySelector<HTMLElement>('.event-review-progress')!;
  const timeline = root.querySelector<HTMLInputElement>('.progress-time')!;
  const playButton = root.querySelector<HTMLButtonElement>('.progress-play')!;
  const speed = root.querySelector<HTMLSelectElement>('.progress-speed')!;
  const readout = root.querySelector<HTMLOutputElement>('.progress-readout')!;
  const buttons = new Map<EventKind, HTMLButtonElement>();
  const reviewRecord = (phase: EventRecord['phase']): EventRecord => ({ ...selected, phase, choice: kind === 'caravan' ? 'goods' : kind === 'standingStones' ? 'haste' : null, wavesCleared: kind === 'cursedChest' ? 6 : 0, delivered: 0, bonusGranted: phase === 'claimed' });
  function paint(animated = false, dt = 0) {
    const settings = { phase: 'playing' as const, reducedMotion: !animated || matchMedia('(prefers-reduced-motion: reduce)').matches, fps: 0, debug: false };
    renderer.render(sim, scene, dt, settings); fx ??= new PostFX(display); fx.render(renderer.canvas, sim.time);
    const c = canvas.getContext('2d')!; c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(display, 0, 0);
    c.save(); c.scale(2, 2); renderer.renderUI(c, sim, scene, settings); c.restore();
    canvas.setAttribute('aria-label', `${selected.name}, ${inProgress ? `${Math.ceil(Number(timeline.max) - Number(timeline.value))} seconds remaining` : claimed ? 'claimed' : 'available'}`);
  }
  function draw() {
    cancelAnimationFrame(frame);
    inProgress = false; progressControls.hidden = true; panel?.close();
    selected = sites.filter(s => s.kind === kind).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0];
    if (!selected) return;
    sim = new Simulation(scene, { spawn: false, seed: 7319, startX: selected.x + 42, startY: selected.y + 35 });
    sim.time = 12; sim.player.angle = -Math.PI / 2;
    if (claimed) sim.eventState.sites[selected.id] = reviewRecord('claimed');
    const landmark = ['cursedChest','reliquary'].includes(kind)?undefined:landmarks.find(s => s.id === selected.id);
    renderer.reset(); renderer.resize(960, 640); renderer.cameraX = landmark?.x ?? selected.x; renderer.cameraY = (landmark?.y ?? selected.y) - 40;
    paint();
    for (const [id, b] of buttons) b.setAttribute('aria-current', String(id === kind));
    root.querySelector('.state-button')!.textContent = claimed ? 'Show available' : 'Show claimed';
    (root.querySelector('.choice-button') as HTMLButtonElement).disabled = ['reliquary', 'camp', 'watchtower'].includes(kind);
    (root.querySelector('.opening-button') as HTMLButtonElement).disabled = ['watchtower', 'standingStones'].includes(kind);
    (root.querySelector('.progress-button') as HTMLButtonElement).disabled = kind !== 'cursedChest';
    params.delete('state');
    params.set('view', kind); history.replaceState(null, '', `${location.pathname}?${params}`);
    root.dataset.ready = 'true'; root.setAttribute('aria-busy', 'false');
  }
  for (const [id, name] of views) {
    const b = document.createElement('button'); b.textContent = name; b.disabled = !sites.some(s => s.kind === id);
    b.addEventListener('click', () => { kind = id; claimed = false; draw(); }, { signal: lifetime.signal });
    buttons.set(id, b); root.querySelector('nav')!.append(b);
  }
  root.querySelector('.state-button')!.addEventListener('click', () => { claimed = !claimed; draw(); }, { signal: lifetime.signal });
  root.querySelector('.choice-button')!.addEventListener('click', () => panel!.open(selected), { signal: lifetime.signal });
  function updateProgress() {
    const trial = sim.eventState.trial!;
    timeline.value = String(trial.elapsed);
    readout.value = `${Math.ceil(Number(timeline.max) - trial.elapsed)}s remaining`;
    timeline.setAttribute('aria-valuetext', `${trial.elapsed.toFixed(1)} seconds elapsed, ${readout.value}`);
    playButton.textContent = paused ? 'Play' : 'Pause';
  }
  function animateProgress(now: number) {
    if (disposed || !inProgress || paused || document.hidden) return;
    if (!previous) previous = now;
    const dt = Math.min(.1, (now - previous) / 1000);
    if (dt >= 1 / 30) {
      previous = now;
      const trial = sim.eventState.trial!, duration = Number(timeline.max);
      trial.elapsed = Math.min(duration, trial.elapsed + dt * Number(speed.value));
      sim.time += dt;
      updateProgress(); paint(true, dt);
      if (trial.elapsed >= duration) { root.querySelector<HTMLButtonElement>('.opening-button')!.click(); return; }
    }
    frame = requestAnimationFrame(animateProgress);
  }
  function startProgress() {
    if (kind !== 'cursedChest') return;
    claimed = false; draw(); inProgress = true;
    const duration = eventRecipe(selected)!.rules.duration;
    sim.eventState.sites[selected.id] = { ...reviewRecord('active'), wavesCleared: 0 };
    sim.eventState.trial = { ...freshWaves(), siteId: selected.id, started: true, guardians: [], sealReady: false };
    timeline.max = String(duration); progressControls.hidden = false;
    paused = matchMedia('(prefers-reduced-motion: reduce)').matches; previous = 0;
    params.set('state', 'progress'); history.replaceState(null, '', `${location.pathname}?${params}`);
    updateProgress(); paint();
    if (!paused) frame = requestAnimationFrame(animateProgress);
  }
  root.querySelector('.progress-button')!.addEventListener('click', startProgress, { signal: lifetime.signal });
  root.querySelector('.progress-restart')!.addEventListener('click', startProgress, { signal: lifetime.signal });
  playButton.addEventListener('click', () => {
    paused = !paused; previous = 0; cancelAnimationFrame(frame); updateProgress();
    if (!paused) frame = requestAnimationFrame(animateProgress);
  }, { signal: lifetime.signal });
  timeline.addEventListener('input', () => {
    if (!inProgress) return;
    paused = true; cancelAnimationFrame(frame);
    sim.eventState.trial!.elapsed = Number(timeline.value);
    updateProgress(); paint();
  }, { signal: lifetime.signal });
  document.addEventListener('visibilitychange', () => {
    if (!inProgress) return;
    cancelAnimationFrame(frame); previous = 0;
    if (!paused && !document.hidden) frame = requestAnimationFrame(animateProgress);
  }, { signal: lifetime.signal });
  root.querySelector('.opening-button')!.addEventListener('click', () => {
    claimed = false; draw();
    let previous = performance.now(), elapsed = 0, opened = false;
    function animate(now: number) {
      if (disposed) return;
      const dt = Math.min(.05, (now - previous) / 1000); previous = now;
      if (document.hidden) { frame = requestAnimationFrame(animate); return; }
      elapsed += dt; sim.time = 12 + elapsed;
      if (!opened) {
        opened = true; claimed = true; root.querySelector('.state-button')!.textContent = 'Show available';
        sim.eventChannel.cancel(); const record = reviewRecord('claimed');
        sim.eventState.sites[selected.id] = record; const bundle = eventRewards(record);
        sim.groundItems = bundle.items.map((item, i) => ({ id: i + 1, item, ...treasureLanding(scene, selected.x, selected.y, i, selected.seed), flight: { x: selected.x, y: selected.y, at: 12, delay: i * .11 } }));
        if (bundle.gold) sim.groundGold = [{ id: 100, amount: bundle.gold, age: 0, ...treasureLanding(scene, selected.x, selected.y, 12, selected.seed), flight: { x: selected.x, y: selected.y, at: 12, delay: .1 } }];
      }
      for (const pile of sim.groundGold) pile.age = elapsed;
      paint(true, dt);
      if (elapsed < 4) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
  }, { signal: lifetime.signal });
  const initialProgress = params.get('state') === 'progress';
  draw();
  if (initialProgress) startProgress();
}
void boot().catch(e => { root.textContent = String(e); root.dataset.ready = 'error'; });
function dispose() { disposed = true; cancelAnimationFrame(frame); lifetime.abort(); panel?.dispose(); fx?.dispose(); world?.dispose(); }
window.addEventListener('pagehide', e => { if (!e.persisted) dispose(); }, { signal: lifetime.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
