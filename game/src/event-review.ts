import './typography.css';
import './ui-kit.css';
import './layout-review.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { Simulation } from './simulation.ts';
import { eventSite, type EventKind, type EventRecord } from './poi-content.ts';
import { EventPanel } from './poi-panel.ts';
// Frozen, memory-only scenes. No simulation ticks, character storage or gameplay input.
const views: readonly [
  EventKind,
  string
][] = [['camp', 'Strongbox'], ['caravan', 'Caravan'], ['watchtower', 'Beacon'], ['graveyard', 'Vigil'], ['standingStones', 'Blessing'], ['reliquary', 'Reliquary']];
const root = document.querySelector<HTMLElement>('#event-review')!;
const lifetime = new AbortController();
let disposed = false, world: World | undefined, fx: PostFX | undefined, panel: EventPanel | undefined;
async function boot() {
  if (!import.meta.env.DEV)
    throw new Error('Local review only.');
  installUITheme();
  await loadGameFont();
  if (disposed)
    return;
  world = new World(7319);
  const scene = world;
  const sites = scene.getWildernessSites(-8000, -8000, 16000, 16000).map(eventSite);
  const relic = scene.getEventSites(-2000, -16000, 4000, 32000).find(s => s.kind === 'reliquary');
  if (relic)
    sites.push(relic);
  const renderer = new Renderer(), display = document.createElement('canvas'), canvas = document.createElement('canvas');
  for (const c of [display, canvas]) {
    c.width = 1440;
    c.height = 1000;
  }
  canvas.className = 'layout-review-scene';
  canvas.setAttribute('role', 'img');
  root.innerHTML = '<header class="layout-review-header"><h1>Wilderness events</h1></header><div class="layout-review-toolbar"><nav class="layout-review-views"></nav><button class="state-button">Show claimed</button><button class="choice-button">Show choices</button></div><figure class="layout-review-figure"><div class="layout-review-frame"></div></figure>';
  root.querySelector('.layout-review-frame')!.append(canvas);
  panel = new EventPanel(document.body, { close: () => panel!.close(), choose: () => panel!.close() });
  const params = new URLSearchParams(location.search);
  let kind = views.find(([k]) => k === params.get('view'))?.[0] ?? 'camp', claimed = false;
  const buttons = new Map<EventKind, HTMLButtonElement>();
  function draw() {
    const site = sites.filter(s => s.kind === kind).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0];
    if (!site)
      throw new Error('Missing review site.');
    const sim = new Simulation(scene, { spawn: false, seed: 7319, startX: site.x + 42, startY: site.y + 35 });
    sim.time = 12;
    sim.player.angle = -Math.PI / 2;
    if (claimed)
      sim.eventState.sites[site.id] = { ...site, phase: 'claimed', choice: kind === 'caravan' ? 'goods' : kind === 'standingStones' ? 'haste' : null, delivered: 0, bonusGranted: true } as EventRecord;
    renderer.reset();
    renderer.resize(720, 500);
    renderer.cameraX = site.x;
    renderer.cameraY = site.y - 85;
    const settings = { phase: 'playing' as const, reducedMotion: true, fps: 0, debug: false };
    renderer.render(sim, scene, 0, settings);
    fx ??= new PostFX(display);
    fx.render(renderer.canvas, 0);
    const c = canvas.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(display, 0, 0);
    c.save();
    c.scale(2, 2);
    renderer.renderUI(c, sim, scene, settings);
    c.restore();
    canvas.setAttribute('aria-label', `${site.name}, ${claimed ? 'claimed' : 'available'}`);
    for (const [id, b] of buttons)
      b.setAttribute('aria-current', String(id === kind));
    root.querySelector('.state-button')!.textContent = claimed ? 'Show available' : 'Show claimed';
    (root.querySelector('.choice-button') as HTMLButtonElement).disabled = !['caravan', 'standingStones', 'graveyard'].includes(kind);
    params.set('view', kind);
    history.replaceState(null, '', `${location.pathname}?${params}`);
    root.dataset.ready = 'true';
    root.setAttribute('aria-busy', 'false');
  }
  for (const [id, name] of views) {
    const b = document.createElement('button');
    b.textContent = name;
    b.addEventListener('click', () => { kind = id; claimed = false; draw(); }, { signal: lifetime.signal });
    buttons.set(id, b);
    root.querySelector('nav')!.append(b);
  }
  root.querySelector('.state-button')!.addEventListener('click', () => { claimed = !claimed; draw(); }, { signal: lifetime.signal });
  root.querySelector('.choice-button')!.addEventListener('click', () => panel!.open(sites.filter(s => s.kind === kind).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0]), { signal: lifetime.signal });
  draw();
}
void boot().catch(e => { root.textContent = String(e); root.dataset.ready = 'error'; });
function dispose() { disposed = true; lifetime.abort(); panel?.dispose(); fx?.dispose(); world?.dispose(); }
window.addEventListener('pagehide', e => { if (!e.persisted)
  dispose(); }, { signal: lifetime.signal });
if (import.meta.hot)
  import.meta.hot.dispose(dispose);
