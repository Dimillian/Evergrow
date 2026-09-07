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
  root.innerHTML = '<header class="layout-review-header"><h1>World events</h1></header><div class="layout-review-toolbar"><nav class="layout-review-views"></nav><button class="state-button">Show claimed</button><button class="opening-button">Preview opening</button><button class="choice-button">Show choices</button></div><figure class="layout-review-figure"><div class="layout-review-frame"></div></figure>';
  root.querySelector('.layout-review-frame')!.append(canvas);
  panel = new EventPanel(document.body, { close: () => panel!.close(), choose: () => panel!.close() });
  const params = new URLSearchParams(location.search);
  let kind = views.find(([k]) => k === params.get('view'))?.[0] ?? 'cursedChest', claimed = false;
  let sim: Simulation, selected: EventSite;
  const buttons = new Map<EventKind, HTMLButtonElement>();
  const reviewRecord = (phase: EventRecord['phase']): EventRecord => ({ ...selected, phase, choice: kind === 'caravan' ? 'goods' : kind === 'standingStones' ? 'haste' : null, wavesCleared: kind === 'cursedChest' ? 6 : 0, delivered: 0, bonusGranted: phase === 'claimed' });
  function paint(animated = false, dt = 0) {
    const settings = { phase: 'playing' as const, reducedMotion: !animated || matchMedia('(prefers-reduced-motion: reduce)').matches, fps: 0, debug: false };
    renderer.render(sim, scene, dt, settings); fx ??= new PostFX(display); fx.render(renderer.canvas, sim.time);
    const c = canvas.getContext('2d')!; c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(display, 0, 0);
    c.save(); c.scale(2, 2); renderer.renderUI(c, sim, scene, settings); c.restore();
    canvas.setAttribute('aria-label', `${selected.name}, ${claimed ? 'claimed' : 'available'}`);
  }
  function draw() {
    cancelAnimationFrame(frame);
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
  root.querySelector('.opening-button')!.addEventListener('click', () => {
    claimed = false; draw();
    const start = performance.now(); let previous = start, opened = false;
    function animate(now: number) {
      if (disposed) return;
      const elapsed = (now - start) / 1000; sim.time = 12 + elapsed;
      if (!opened) {
        opened = true; sim.eventChannel.cancel(); const record = reviewRecord('claimed');
        sim.eventState.sites[selected.id] = record; const bundle = eventRewards(record);
        sim.groundItems = bundle.items.map((item, i) => ({ id: i + 1, item, ...treasureLanding(scene, selected.x, selected.y, i, selected.seed), flight: { x: selected.x, y: selected.y, at: 12, delay: i * .11 } }));
        if (bundle.gold) sim.groundGold = [{ id: 100, amount: bundle.gold, age: 0, ...treasureLanding(scene, selected.x, selected.y, 12, selected.seed), flight: { x: selected.x, y: selected.y, at: 12, delay: .1 } }];
      }
      for (const pile of sim.groundGold) pile.age = elapsed;
      paint(true, Math.min(.05, (now - previous) / 1000)); previous = now;
      if (elapsed < 4) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
  }, { signal: lifetime.signal });
  draw();
}
void boot().catch(e => { root.textContent = String(e); root.dataset.ready = 'error'; });
function dispose() { disposed = true; cancelAnimationFrame(frame); lifetime.abort(); panel?.dispose(); fx?.dispose(); world?.dispose(); }
window.addEventListener('pagehide', e => { if (!e.persisted) dispose(); }, { signal: lifetime.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
