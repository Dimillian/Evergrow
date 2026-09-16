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
  ['singularity', 'Singularity: Void Collapse'], ['combustion', 'Combustion: Voidfire'], ['cascade', 'Cascade: Chain Reaction'],
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
  root.innerHTML = `<header class="layout-review-header"><div><p class="layout-review-eyebrow">EVERGROW / WILDERNESS & COMBAT</p><h1></h1></div><p class="layout-review-static">Frozen procedural scenes</p></header>
    <div class="layout-review-toolbar"><nav class="layout-review-views" aria-label="Wilderness scenes"></nav><a class="layout-review-download">Save PNG</a></div>
    <figure class="layout-review-figure"><div class="layout-review-frame"></div><figcaption class="layout-review-caption"><p class="layout-review-description"></p><p>Shared world renderer · CRT / soft phosphor</p></figcaption></figure>
    <p class="layout-review-status" role="status"></p>`;
  root.querySelector('.layout-review-frame')!.append(canvas);
  const title = root.querySelector('h1')!, description = root.querySelector('.layout-review-description')!;
  const save = root.querySelector<HTMLAnchorElement>('.layout-review-download')!;
  const buttons = new Map<ViewId, HTMLButtonElement>();
  let selected: ViewId = VIEWS.find(([id]) => id === params.get('view'))?.[0] ?? 'singularity';
  function draw(view: ViewId) {
    if (disposed) return;
    selected = view;
    const site = view === 'warband' ? sites.find(site => site.members[0]?.kind === 'goblinChief')
      : ['camp', 'warning', 'singularity', 'combustion', 'cascade'].includes(view) ? firstCamp
      : sites.filter(site => site.kind === view as WildernessKind).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0];
    if (!site) throw new Error('The requested site was not generated.');
    const sim = new Simulation(sceneWorld, { seed: 7319, spawn: false, startX: site.x, startY: site.y + 158 });
    sim.time = 22.5; sim.player.angle = -Math.PI / 2;
    for (const member of site.members) {
      const enemy = sim.spawnEnemy(member.kind, site.x + member.dx, site.y + member.dy, member.rank);
      if (enemy && view === 'warband') {
        enemy.angle = Math.PI / 2; enemy.attackAngle = Math.PI / 2;
        enemy.warband = { order: 'rush', remaining: 5.7, warning: true };
      }
    }
    renderer.reset(); renderer.resize(720, 500); renderer.cameraX = site.x; renderer.cameraY = site.y + 15;
    let platesToDraw: any[] = [];
    if (view === 'singularity') {
      sim.enemies.length = 0;
      const target = sim.spawnEnemy('frostRevenant', site.x, site.y + 15, 'elite');
      if (target) {
        target.hp = 3840; target.maxHp = 6000; target.chillTime = 4.0; target.freezeTime = 1.8;
        (target.statusDurations ??= {}).freeze = 1.8; (target.statusDurations ??= {}).chill = 4.0;
        platesToDraw.push(target);
      }
      const m1 = sim.spawnEnemy('thornReaver', site.x + 85, site.y - 30, 'normal');
      if (m1) { m1.hp = 1600; m1.maxHp = 2400; m1.stagger = 1.2; m1.knockbackX = -55; m1.knockbackY = 35; (m1.statusDurations ??= {}).stagger = 1.2; platesToDraw.push(m1); }
      const m2 = sim.spawnEnemy('hound', site.x + 75, site.y + 65, 'normal');
      if (m2) { m2.hp = 1200; m2.maxHp = 1800; m2.stagger = 1.2; m2.knockbackX = -45; m2.knockbackY = -40; }
      const m3 = sim.spawnEnemy('emberAcolyte', site.x - 80, site.y - 20, 'normal');
      if (m3) { m3.hp = 800; m3.maxHp = 1500; m3.stagger = 1.0; m3.knockbackX = 45; m3.knockbackY = 30; }

      renderer.handleEvents([
        { type: 'hit', x: site.x, y: site.y + 15, value: 840, actualValue: 840, reaction: 'singularity', color: '#c578ff', targetId: target?.id ?? 1, remainingHp: 3840, enemyKind: 'frostRevenant', heavy: true, angle: 0 },
        { type: 'blast', x: site.x, y: site.y + 15, radius: 180, color: '#c578ff', reaction: 'singularity' }
      ], false);
    } else if (view === 'combustion') {
      sim.enemies.length = 0;
      const target = sim.spawnEnemy('thornReaver', site.x, site.y + 15, 'elite');
      if (target) {
        target.hp = 2800; target.maxHp = 5000; target.burnTime = 4.0; target.burnDps = 55;
        (target.statusDurations ??= {}).burn = 4.0; platesToDraw.push(target);
      }
      const m1 = sim.spawnEnemy('hound', site.x + 75, site.y - 20, 'normal');
      if (m1) { m1.hp = 1100; m1.maxHp = 1800; m1.burnTime = 3.5; m1.burnDps = 30; (m1.statusDurations ??= {}).burn = 3.5; platesToDraw.push(m1); }
      const m2 = sim.spawnEnemy('stormSentinel', site.x - 70, site.y + 55, 'normal');
      if (m2) { m2.hp = 1400; m2.maxHp = 2200; m2.burnTime = 3.5; m2.burnDps = 30; (m2.statusDurations ??= {}).burn = 3.5; }

      renderer.handleEvents([
        { type: 'hit', x: site.x, y: site.y + 15, value: 960, actualValue: 960, reaction: 'combustion', color: '#ff4d79', targetId: target?.id ?? 1, remainingHp: 2800, enemyKind: 'thornReaver', heavy: true, angle: 0 },
        { type: 'blast', x: site.x, y: site.y + 15, radius: 120, color: '#ff4d79', reaction: 'combustion' }
      ], false);
    } else if (view === 'cascade') {
      sim.enemies.length = 0;
      const primary = sim.spawnEnemy('thornReaver', site.x - 30, site.y + 15, 'elite');
      if (primary) { primary.hp = 3200; primary.maxHp = 5000; platesToDraw.push(primary); }
      const chilled1 = sim.spawnEnemy('frostRevenant', site.x + 75, site.y - 25, 'normal');
      if (chilled1) { chilled1.hp = 2600; chilled1.maxHp = 5000; chilled1.chillTime = 3.5; chilled1.fractureTime = 3.0; (chilled1.statusDurations ??= {}).chill = 3.5; (chilled1.statusDurations ??= {}).fracture = 3.0; platesToDraw.push(chilled1); }
      const chilled2 = sim.spawnEnemy('stormSentinel', site.x + 70, site.y + 65, 'normal');
      if (chilled2) { chilled2.hp = 1500; chilled2.maxHp = 2400; chilled2.chillTime = 3.5; chilled2.fractureTime = 3.0; (chilled2.statusDurations ??= {}).chill = 3.5; (chilled2.statusDurations ??= {}).fracture = 3.0; }

      renderer.handleEvents([
        { type: 'hit', x: site.x - 30, y: site.y + 15, value: 480, actualValue: 480, reaction: 'overload', color: '#ff77aa', targetId: primary?.id ?? 1, remainingHp: 3200, enemyKind: 'thornReaver', heavy: true, angle: 0 },
        { type: 'blast', x: site.x - 30, y: site.y + 15, radius: 140, color: '#ff77aa', reaction: 'overload' },
        { type: 'chain', x: site.x - 30, y: site.y + 15, toX: site.x + 75, toY: site.y - 25, duration: 0.35, style: 'lightning', color: '#67e8f9', reaction: 'cascade' },
        { type: 'chain', x: site.x - 30, y: site.y + 15, toX: site.x + 70, toY: site.y + 65, duration: 0.35, style: 'lightning', color: '#67e8f9', reaction: 'cascade' },
        { type: 'hit', x: site.x + 75, y: site.y - 25, value: 240, actualValue: 240, reaction: 'cascade', color: '#67e8f9', targetId: chilled1?.id ?? 2, remainingHp: 2600, enemyKind: 'frostRevenant', heavy: true, angle: 0 },
        { type: 'hit', x: site.x + 70, y: site.y + 65, value: 240, actualValue: 240, reaction: 'cascade', color: '#67e8f9', targetId: chilled2?.id ?? 3, remainingHp: 1500, enemyKind: 'stormSentinel', heavy: true, angle: 0 }
      ], false);
    } else if (view === 'warning') {
      sim.enemies.length = 0;
      const warning = sim.spawnEnemy('wisp', site.x + 72, site.y + 35, 'elite');
      if (warning) {
        warning.state = 'windup'; warning.stateDuration = ENEMY_DEFINITIONS.wisp.windup;
        warning.stateTime = warning.stateDuration * .68;
        warning.attackTargetX = sim.player.x; warning.attackTargetY = sim.player.y;
        warning.attackAngle = Math.atan2(sim.player.y - warning.y, sim.player.x - warning.x);
        platesToDraw.push(warning);
      }
    }
    renderer.render(sim, sceneWorld, 0.12, { phase: 'playing', reducedMotion: false });
    postfx ??= new PostFX(display); postfx.render(renderer.canvas, 0);
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(display, 0, 0);
    c.save(); c.scale(2, 2);
    renderer.renderUI(c, sim, sceneWorld, { phase: 'playing', reducedMotion: false });
    for (const p of platesToDraw) drawEnemyPlate(c, p, 720, 500);
    c.restore();
    title.textContent = view === 'singularity' ? 'Singularity · Gravitational Void Collapse'
      : view === 'combustion' ? 'Combustion · Voidfire Plasma Eruption'
      : view === 'cascade' ? 'Cascade · Superconductor Chain Reaction'
      : view === 'warning' ? 'Lantern Wisp · committed detonation' : site.name;
    description.textContent = view === 'singularity' ? 'Arcane strikes a frozen foe, detonating an imploding cosmic gravity well that pulls and staggers surrounding enemies with vacuum suction.'
      : view === 'combustion' ? 'Arcane strikes a burning foe, triggering a superheated voidfire plasma flare that deals direct True Damage and spreads burning to nearby enemies.'
      : view === 'cascade' ? 'Overload shockwave striking adjacent chilled foes cascades into Superconduct arcs, shattering armor across the encounter with fracture debuffs.'
      : view === 'warning' ? 'Target locks early; the circular warning fills until detonation. Staged pose, no gameplay running.'
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
