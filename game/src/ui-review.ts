import './ui-kit.css';
import './style.css';
import './typography.css';
import './world-map.css';
import './ui-review.css';
import { installUITheme, UI_THEME } from './ui-theme.ts';
import { escapeUI, uiIcon } from './ui-components.ts';
import { loadGameFont } from './font.ts';
import { GameShell } from './game-shell.ts';
import { WorldMap } from './world-map.ts';
import { Exploration } from './exploration.ts';
import { World, mainPathX } from './world.ts';
import { Renderer, type RenderSettings } from './renderer.ts';
import { Simulation } from './simulation.ts';
import { PostFX } from './postfx.ts';
import { FIRST_TOWN_Y } from './settlements.ts';
import { Lifetime } from './lifetime.ts';

// The iframe is a static presentation viewport, never the playable Game entry.
// No gameplay input, simulation ticks, save reads or save writes occur on this route.
const VIEWS = [
  { id: 'ready', label: 'Start screen' }, { id: 'paused', label: 'Pause' },
  { id: 'dead', label: 'Defeat' }, { id: 'map', label: 'World map' },
  { id: 'components', label: 'Components' },
] as const;
type View = typeof VIEWS[number]['id'];
type Size = 'desktop' | 'narrow';
const CHANNEL = 'evergrowing:ui-review';
const SEED = 7319;
const params = new URLSearchParams(location.search);
const embedded = params.get('embed') === '1';
const root = document.querySelector<HTMLElement>('#ui-review')!;
const abort = new AbortController();
const lifetime = new Lifetime();
lifetime.defer(() => abort.abort());
let disposed = false;
let view: View = validView(params.get('view')) ?? 'ready';
let size: Size = params.get('size') === 'narrow' ? 'narrow' : 'desktop';

function validView(value: unknown): View | undefined {
  return VIEWS.find(candidate => candidate.id === value)?.id;
}

function setURL() {
  const query = new URLSearchParams(); query.set('view', view);
  if (embedded) query.set('embed', '1'); else query.set('size', size);
  history.replaceState(null, '', `${location.pathname}?${query}`);
}

function outerReview() {
  root.innerHTML = `<header class="ui-review-header"><div><p class="ui-kicker">EVERGROWING / LOCAL DEV</p>
    <h1>Interface review</h1></div><p class="ui-review-note">Live interface components.<br>Frozen world and chart.</p></header>
    <div class="ui-review-tools"><nav class="ui-review-tabs" aria-label="Interface states">
      ${VIEWS.map(choice => `<button class="ui-button ui-button--quiet" type="button" data-view="${choice.id}" aria-pressed="false">${choice.label}</button>`).join('')}
    </nav><div class="ui-review-sizes" aria-label="Preview viewport">
      <button class="ui-button ui-button--quiet" type="button" data-size="desktop" aria-pressed="false">Desktop</button>
      <button class="ui-button ui-button--quiet" type="button" data-size="narrow" aria-pressed="false">Narrow</button>
      <button class="ui-button ui-button--quiet" type="button" data-toast>Toast</button>
    </div></div>
    <div class="ui-review-viewport"><iframe class="ui-review-frame" title="Frozen Evergrowing interface preview"></iframe></div>
    <footer class="ui-review-footer"><p class="ui-review-status" role="status">Preparing preview…</p>
      <p>Seed ${SEED} · discovery held in memory · no gameplay</p></footer>`;
  const frame = root.querySelector<HTMLIFrameElement>('iframe')!;
  lifetime.defer(() => frame.remove());
  const status = root.querySelector<HTMLElement>('.ui-review-status')!;
  let expectedView: View | null = view;
  const updateChrome = () => {
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === view));
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-size]')) button.setAttribute('aria-pressed', String(button.dataset.size === size));
    frame.dataset.size = size; setURL();
  };
  updateChrome(); frame.src = `/ui.html?embed=1&view=${view}`;
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-view]')) {
    button.addEventListener('click', () => {
      view = validView(button.dataset.view)!; updateChrome();
      expectedView = view; root.dataset.ready = 'false'; root.setAttribute('aria-busy', 'true');
      frame.contentWindow?.postMessage({ channel: CHANNEL, action: 'view', view }, location.origin);
    }, { signal: abort.signal });
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-size]')) {
    button.addEventListener('click', () => { size = button.dataset.size === 'narrow' ? 'narrow' : 'desktop'; updateChrome(); }, { signal: abort.signal });
  }
  root.querySelector('[data-toast]')!.addEventListener('click', () => {
    frame.contentWindow?.postMessage({ channel: CHANNEL, action: 'toast' }, location.origin);
  }, { signal: abort.signal });
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.channel !== CHANNEL) return;
    if (event.data.action === 'ready') {
      // A tab can be selected while the child's font/terrain is still loading.
      if (expectedView && validView(event.data.view) !== expectedView) {
        frame.contentWindow?.postMessage({ channel: CHANNEL, action: 'view', view: expectedView }, location.origin);
        return;
      }
      expectedView = null;
      view = validView(event.data.view) ?? view; updateChrome();
      status.textContent = `${VIEWS.find(choice => choice.id === view)!.label} · ${Math.round(frame.clientWidth)} × ${Math.round(frame.clientHeight)} viewport`;
      root.dataset.ready = 'true'; root.setAttribute('aria-busy', 'false');
    } else if (event.data.action === 'error') {
      status.textContent = String(event.data.message); status.setAttribute('role', 'alert');
      root.dataset.ready = 'error'; root.setAttribute('aria-busy', 'false');
    }
  }, { signal: abort.signal });
}

function foundationSheet(): HTMLElement {
  const sheet = document.createElement('section'); sheet.className = 'ui-review-foundation ui-scroll-area'; sheet.hidden = true;
  sheet.setAttribute('aria-label', 'Shared interface components');
  sheet.innerHTML = `<div class="ui-window"><header class="ui-window-header"><div><p class="ui-kicker">INTERFACE FOUNDATION</p>
    <h2 class="ui-title">Forged for the journey</h2></div><span class="ui-badge">COMPONENTS</span></header>
    <div class="ui-window-body"><section class="ui-review-section"><h3>Actions &amp; states</h3>
      <div class="ui-review-component-row"><button class="ui-button ui-button--primary" type="button" data-demo="Primary action">${uiIcon('leaf')}<span>Primary action</span></button>
        <button class="ui-button ui-button--quiet" type="button" data-demo="Quiet action">Quiet action</button>
        <button class="ui-button ui-button--danger" type="button" data-demo="Danger action">${uiIcon('skull')}<span>Danger action</span></button>
        <button class="ui-button" type="button" disabled>Unavailable</button>
        <button class="ui-button ui-button--icon" type="button" aria-label="Example map control" data-tooltip="World map" data-tooltip-placement="below" data-demo="Map control">${uiIcon('map')}</button>
      </div></section><div class="ui-divider"></div>
      <div class="ui-review-components-columns"><section class="ui-review-section"><h3>Readouts</h3><dl class="ui-review-stat-list">
        <div class="ui-stat"><dt class="ui-stat-label">Vitality</dt><dd class="ui-stat-value">76 / 100</dd></div>
        <div class="ui-stat"><dt class="ui-stat-label">Mana</dt><dd class="ui-stat-value">62 / 100</dd></div>
      </dl><div class="ui-review-component-row"><span class="ui-badge">DEADWOOD</span><span class="ui-status">Sanctuary</span><kbd class="ui-key">M</kbd></div></section>
      <section class="ui-review-section"><h3>Slots &amp; item detail</h3><div class="ui-review-slot-row">
        <button class="ui-slot" type="button" disabled aria-label="Example equipped sword">${uiIcon('sword')}</button>
        <button class="ui-slot" type="button" disabled aria-label="Empty example slot"></button>
        <button class="ui-slot" type="button" disabled aria-label="Empty example slot"></button>
        <button class="ui-slot" type="button" disabled aria-label="Empty example slot"></button>
      </div><aside class="ui-tooltip ui-review-example-tooltip"><p class="ui-kicker">TWO-HANDED SWORD</p><h4>Weathered Sword</h4>
        <p class="ui-body">A worn steel blade with a bound leather grip.</p><div class="ui-divider"></div>
        <p class="ui-muted">Static component example</p></aside></section></div>
      <section class="ui-review-section"><h3>Shared palette</h3><div class="ui-review-swatches">
        ${Object.entries(UI_THEME.palette).map(([name, color]) => `<figure class="ui-review-swatch"><div class="ui-review-swatch-color" style="background:${escapeUI(color)}"></div><figcaption>${escapeUI(name)}</figcaption></figure>`).join('')}
      </div></section><p class="ui-muted ui-review-component-feedback" role="status"></p>
    </div><footer class="ui-window-footer"><span class="ui-muted">Presentation components for future panels.</span></footer></div>`;
  for (const button of sheet.querySelectorAll<HTMLButtonElement>('[data-demo]')) {
    button.addEventListener('click', () => {
      sheet.querySelector<HTMLElement>('.ui-review-component-feedback')!.textContent = `${button.dataset.demo} selected · preview only`;
    }, { signal: abort.signal });
  }
  return sheet;
}

function seedDiscovery(world: World, exploration: Exploration) {
  for (let y = 440; y >= -2620; y -= 120) exploration.reveal(mainPathX(y), y, 285);
  const town = world.getSettlements(mainPathX(FIRST_TOWN_Y) - 1, FIRST_TOWN_Y - 1, 2, 2)
    .find(candidate => candidate.y === FIRST_TOWN_Y);
  if (!town) throw new Error('The preview settlement could not be generated.');
  for (const building of town.buildings) {
    const y = building.door.y + 24, start = mainPathX(y);
    const steps = Math.max(1, Math.ceil(Math.abs(building.door.x - start) / 90));
    for (let i = 0; i <= steps; i++) exploration.reveal(start + (building.door.x - start) * i / steps, y, 180);
    exploration.reveal(building.door.x, building.y + building.height / 2, 170);
  }
  for (let x = 0; x <= 1160; x += 120) exploration.reveal(x, FIRST_TOWN_Y - 460 + Math.sin(x / 280) * 100, 220);
  return { x: mainPathX(FIRST_TOWN_Y + 90), y: FIRST_TOWN_Y + 90, angle: -.65 };
}

function embeddedReview() {
  const world = lifetime.own(new World(SEED)), renderer = new Renderer();
  const simulation = new Simulation(world, { seed: SEED, spawn: false });
  const exploration = lifetime.own(new Exploration(world, { storage: null }));
  const mapPlayer = seedDiscovery(world, exploration);
  const shell = lifetime.own(new GameShell(root, {
    play: () => shell.toast('Static preview · no simulation is running'),
    restart: () => selectView('ready'), openCharacter: () => {}, openSkills: () => {}, openMap: () => selectView('map'),
  }));
  const map = lifetime.own(new WorldMap(world, exploration, shell.mapMount, () => selectView('paused')));
  const foundation = foundationSheet(); root.querySelector('.game-shell')!.append(foundation);
  const display = document.createElement('canvas'), postfx = lifetime.own(new PostFX(display));
  const ground = shell.canvas.getContext('2d', { alpha: false });
  const ui = shell.uiCanvas.getContext('2d');
  if (!ground || !ui) throw new Error('Canvas rendering is unavailable.');
  renderer.pointerActive = false;
  let resizeFrame = 0;
  const ready = () => {
    root.dataset.ready = 'true'; root.setAttribute('aria-busy', 'false');
    parent.postMessage({ channel: CHANNEL, action: 'ready', view }, location.origin);
  };

  function drawFrozenBackground() {
    const width = root.clientWidth, height = root.clientHeight;
    if (width <= 0 || height <= 0 || disposed) return;
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    shell.canvas.width = display.width = Math.round(width * ratio);
    shell.canvas.height = display.height = Math.round(height * ratio);
    shell.uiCanvas.width = Math.round(width * ratio); shell.uiCanvas.height = Math.round(height * ratio);
    const logicalHeight = Math.min(680, Math.max(450, Math.round(height / 1.35)));
    renderer.reset(); renderer.resize(Math.round(logicalHeight * width / height), logicalHeight);
    renderer.cameraX = 0; renderer.cameraY = -15;
    simulation.player.angle = -.65; simulation.player.hp = view === 'dead' ? 0 : view === 'paused' ? 76 : 100;
    simulation.player.dead = view === 'dead'; simulation.player.mana = view === 'paused' ? 62 : 100;
    simulation.kills = 17; simulation.time = 218;
    const settings: RenderSettings = { phase: view === 'dead' ? 'dead' : view === 'ready' ? 'ready' : 'paused',
      reducedMotion: true, fps: 0, debug: false };
    renderer.render(simulation, world, 1, settings);
    postfx.render(renderer.canvas, view === 'dead' ? .25 : 0);
    ground!.drawImage(display, 0, 0);
    ui!.setTransform(shell.uiCanvas.width / renderer.width, 0, 0, shell.uiCanvas.height / renderer.height, 0, 0);
    renderer.renderUI(ui!, simulation, world, settings);
    shell.resizeControls(renderer.width, renderer.height);
    map.resize(); ready();
  }

  function selectView(next: View) {
    if (disposed) return;
    view = next; setURL(); map.close(); foundation.hidden = next !== 'components';
    shell.showMenu(next === 'components' ? 'map' : next, 17, 218, 'Deadwood');
    if (next === 'map') map.open(mapPlayer);
    drawFrozenBackground();
  }

  const resize = () => {
    if (!resizeFrame) resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; drawFrozenBackground(); });
  };
  const observer = new ResizeObserver(resize); observer.observe(root);
  lifetime.defer(() => { observer.disconnect(); cancelAnimationFrame(resizeFrame); });
  display.addEventListener('webglcontextrestored', resize, { signal: abort.signal });
  window.addEventListener('message', event => {
    if (event.source !== parent || event.origin !== location.origin || event.data?.channel !== CHANNEL) return;
    const next = validView(event.data.view);
    if (event.data.action === 'view' && next) selectView(next);
    else if (event.data.action === 'toast') shell.toast('The path ahead is charted.');
  }, { signal: abort.signal });
  root.addEventListener('keydown', event => {
    if (view === 'map' && event.key === 'Escape') { event.preventDefault(); selectView('paused'); }
  }, { signal: abort.signal });
  selectView(view);
}

async function boot() {
  if (!import.meta.env.DEV) throw new Error('Interface review is available only on the local development server.');
  document.documentElement.className = embedded ? 'ui-review-embedded' : 'ui-review-document';
  installUITheme(); await loadGameFont();
  if (disposed) return;
  if (embedded) embeddedReview(); else outerReview();
}

void boot().catch(error => {
  if (disposed) return;
  const message = error instanceof Error ? error.message : 'Interface review could not be prepared.';
  try { lifetime.dispose(); } catch (cleanupError) { console.error('Interface preview cleanup failed.', cleanupError); }
  root.innerHTML = `<p class="ui-review-loading ui-review-error" role="alert">${escapeUI(message)}</p>`;
  root.setAttribute('aria-busy', 'false'); root.dataset.ready = 'error';
  if (embedded) parent.postMessage({ channel: CHANNEL, action: 'error', message }, location.origin);
});

function dispose() {
  if (disposed) return;
  disposed = true; lifetime.dispose();
}
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); }, { signal: abort.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
