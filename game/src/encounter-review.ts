import './typography.css';
import './layout-review.css';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { Simulation } from './simulation.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { drawEnemyPlate } from './enemy-plate.ts';
import type { WildernessKind } from './wilderness-sites.ts';

// Frozen generated scenes only: no input, simulation ticks, exploration, or saves.
const VIEWS = [
  ['warband', 'Goblin warband'], ['camp', 'Ashen Watch'], ['watchtower', 'Watchtower'], ['graveyard', 'Graveyard'],
  ['standingStones', 'Standing stones'], ['caravan', 'Lost caravan'], ['warning', 'Wisp warning'],
] as const;
type ViewId = typeof VIEWS[number][0];
const root = document.querySelector<HTMLElement>('#encounter-review')!;
const lifetime = new AbortController();
let disposed = false, postfx: PostFX | undefined, world: World | undefined;

async function boot() {
  if (!import.meta.env.DEV) throw new Error('Wilderness review is local development only.');
  await loadGameFont(); if (disposed) return;
  const params = new URLSearchParams(location.search);
  world = new World(7319); const sceneWorld = world;
  const sites = sceneWorld.getWildernessSites(-8000, -8000, 16000, 16000);
  const firstCamp = sceneWorld.getWildernessSites(740, 180, 1, 1).find(site => site.kind === 'camp')!;
  const renderer = new Renderer();
  const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 1000;
  canvas.className = 'layout-review-scene'; canvas.setAttribute('role', 'img');
  const c = canvas.getContext('2d', { alpha: false })!;
  const display = document.createElement('canvas'); display.width = 1440; display.height = 1000;
  root.innerHTML = `<header class="layout-review-header"><div><p class="layout-review-eyebrow">EVERGROW / WILDERNESS</p><h1></h1></div><p class="layout-review-static">Frozen procedural scenes</p></header>
    <div class="layout-review-toolbar"><nav class="layout-review-views" aria-label="Wilderness scenes"></nav><a class="layout-review-download">Save PNG</a></div>
    <figure class="layout-review-figure"><div class="layout-review-frame"></div><figcaption class="layout-review-caption"><p class="layout-review-description"></p><p>Shared world renderer · CRT / soft phosphor</p></figcaption></figure>
    <p class="layout-review-status" role="status"></p>`;
  root.querySelector('.layout-review-frame')!.append(canvas);
  const title = root.querySelector('h1')!, description = root.querySelector('.layout-review-description')!;
  const save = root.querySelector<HTMLAnchorElement>('.layout-review-download')!;
  const buttons = new Map<ViewId, HTMLButtonElement>();
  let selected: ViewId = VIEWS.find(([id]) => id === params.get('view'))?.[0] ?? 'camp';
  function draw(view: ViewId) {
    if (disposed) return;
    selected = view;
    const site = view === 'warband' ? sites.find(site => site.members[0]?.kind === 'goblinChief')
      : view === 'camp' || view === 'warning' ? firstCamp
      : sites.filter(site => site.kind === view as WildernessKind).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0];
    if (!site) throw new Error('The requested site was not generated.');
    const sim = new Simulation(sceneWorld, { seed: 7319, spawn: false, startX: site.x, startY: site.y + 158 });
    sim.time = 12; sim.player.angle = -Math.PI / 2;
    for (const member of site.members) {
      const enemy = sim.spawnEnemy(member.kind, site.x + member.dx, site.y + member.dy, member.rank);
      if (enemy && view === 'warband') {
        enemy.angle = Math.PI / 2; enemy.attackAngle = Math.PI / 2;
        enemy.warband = { order: 'rush', remaining: 5.7, warning: true };
      }
    }
    let warning;
    if (view === 'warning') {
      sim.enemies.length = 0;
      warning = sim.spawnEnemy('wisp', site.x + 72, site.y + 35, 'elite');
      if (warning) {
        warning.state = 'windup'; warning.stateDuration = ENEMY_DEFINITIONS.wisp.windup;
        warning.stateTime = warning.stateDuration * .68;
        warning.attackTargetX = sim.player.x; warning.attackTargetY = sim.player.y;
        warning.attackAngle = Math.atan2(sim.player.y - warning.y, sim.player.x - warning.x);
      }
    }
    renderer.reset(); renderer.resize(720, 500); renderer.cameraX = site.x; renderer.cameraY = site.y - 20;
    renderer.render(sim, sceneWorld, 1, { phase: 'paused', reducedMotion: true, fps: 0, debug: false });
    postfx ??= new PostFX(display); postfx.render(renderer.canvas, 0);
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(display, 0, 0);
    if (warning) { c.save(); c.scale(2, 2); drawEnemyPlate(c, warning, 720, 500); c.restore(); }
    title.textContent = view === 'warning' ? 'Lantern Wisp · committed detonation' : site.name;
    description.textContent = view === 'warning' ? 'Target locks early; the circular warning fills until detonation. Staged pose, no gameplay running.'
      : view === 'warband' ? `${site.members.length - 1} scrap goblins · War Chief sounding a rush order`
      : site.kind === 'camp' ? `${site.members.length} authored sentries · open south entrance · tents, watchfire and supplies`
      : site.description;
    canvas.setAttribute('aria-label', `${title.textContent}. ${description.textContent}`);
    for (const [id, button] of buttons) button.setAttribute('aria-current', String(id === view));
    params.set('view', view); history.replaceState(null, '', `${location.pathname}?${params}`);
    save.href = canvas.toDataURL('image/png'); save.download = `evergrow-${view}.png`;
    root.dataset.ready = 'true'; root.setAttribute('aria-busy', 'false');
    root.querySelector('.layout-review-status')!.textContent = `${title.textContent} ready.`;
  }
  for (const [id, label] of VIEWS) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.addEventListener('click', () => draw(id), { signal: lifetime.signal });
    buttons.set(id, button); root.querySelector('nav')!.append(button);
  }
  display.addEventListener('webglcontextrestored', () => draw(selected), { signal: lifetime.signal });
  draw(selected);
}
void boot().catch(error => {
  if (disposed) return;
  root.setAttribute('aria-busy', 'false'); root.dataset.ready = 'error';
  const message = document.createElement('p'); message.setAttribute('role', 'alert'); message.textContent = String(error); root.replaceChildren(message);
});
function dispose() { disposed = true; lifetime.abort(); postfx?.dispose(); world?.dispose(); }
window.addEventListener('pagehide', e => { if (!e.persisted) dispose(); }, { signal: lifetime.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
