import './ui-kit.css';
import './style.css';
import './typography.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { GameShell } from './game-shell.ts';
import { WorldMap } from './world-map.ts';
import { Exploration } from './exploration.ts';
import { PORTAL_RULES, portalMapMarkers } from './travel.ts';
import { portalDestinations, type PortalDestination } from './portal-destination.ts';
import { BIOMES, BIOME_IDS, type BiomeId } from './biomes.ts';
import { Lifetime } from './lifetime.ts';

type StudyState = 'cast' | 'surface' | 'hazardous' | 'dungeon' | 'unavailable' | 'long';

// Disposable presentation study: no simulation ticks, live game input or character storage.
if (!import.meta.env.DEV) throw new Error('Local review only.');
installUITheme(); await loadGameFont();
const life = new Lifetime(), world = life.own(new World(7319)), sim = new Simulation(world, { spawn: false });
const abort = new AbortController(); life.defer(() => abort.abort());
const params = new URLSearchParams(location.search), anchor = world.getPortalAnchor(0), p = sim.player;
const requestedState = params.get('state') ?? 'surface';
let state: StudyState = requestedState === 'town' || requestedState.startsWith('biome-') ? 'surface'
  : ['cast','surface','hazardous','dungeon','unavailable','long'].includes(requestedState) ? requestedState as StudyState : 'surface';
let biome: BiomeId = requestedState.startsWith('biome-') && BIOME_IDS.includes(requestedState.slice(6) as BiomeId)
  ? requestedState.slice(6) as BiomeId
  : BIOME_IDS.includes(params.get('biome') as BiomeId) ? params.get('biome') as BiomeId : 'deadwood';
const requestedProgress = Number(params.get('progress') ?? .73), reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let channelProgress = Number.isFinite(requestedProgress) ? Math.max(.05, Math.min(1, requestedProgress)) : .73;
let frozen = reducedMotion.matches || !params.has('animate');

const shell = life.own(new GameShell(document.querySelector('#app')!, { play() {}, returnToTitle() {}, openMap() {}, openCharacter() {}, openInventory() {}, openSkills() {} }));
const chart = life.own(new Exploration(world, { storage: null }));
const map = life.own(new WorldMap(world, chart, shell.mapMount, () => map.close()));
map.setPortalMarkers(() => portalMapMarkers(sim.travel, band => world.getPortalAnchor(band)));
const renderer = new Renderer(), fx = life.own(new PostFX(shell.canvas));
if (params.has('close')) renderer.zoomByWheel(-1000, 0, 540);

const controls = document.querySelector<HTMLFormElement>('.portal-review-controls')!;
controls.innerHTML = `<label>Scene<select name="state">
  <option value="cast">Home town cast</option><option value="surface">Surface return</option><option value="hazardous">Hazardous return</option>
  <option value="dungeon">Dungeon return</option><option value="unavailable">No saved return</option><option value="long">Long destination</option>
  </select></label><label>Destination climate<select name="biome">${BIOME_IDS.map(id => `<option value="${id}">${BIOMES[id].name}</option>`).join('')}</select></label>
  <label>Channel progress<input name="progress" type="range" min="0.05" max="1" step="0.01"></label>
  <label class="check"><input name="frozen" type="checkbox"> Freeze motion</label>
  <button name="compare" type="button">Compare all</button><button name="capture" type="button">Save PNG</button>`;
const stateSelect = controls.elements.namedItem('state') as HTMLSelectElement;
const biomeSelect = controls.elements.namedItem('biome') as HTMLSelectElement;
const progressInput = controls.elements.namedItem('progress') as HTMLInputElement;
const frozenInput = controls.elements.namedItem('frozen') as HTMLInputElement;
stateSelect.value = state; biomeSelect.value = biome; progressInput.value = String(channelProgress); frozenInput.checked = frozen;

function studyDestination(kind: PortalDestination['kind'], selected: BiomeId): PortalDestination {
  if (state === 'dungeon') return { kind, name: 'Vault of the Ashen Covenant', detail: 'Dungeon · Level 27', biome: selected };
  if (state === 'hazardous') return { kind, name: `Longwatch Vale · ${BIOMES[selected].name}`, detail: 'Region level 18–31', biome: selected };
  if (state === 'long') return { kind, name: `The Everlasting Hollow Beyond ${BIOMES[selected].name}`, detail: 'Region level 11–24', biome: selected };
  return { kind, name: BIOMES[selected].name, detail: 'Region level 8–19', biome: selected };
}

function stage() {
  const casting = state === 'cast';
  p.x = p.prevX = casting ? 0 : anchor.x - 46; p.y = p.prevY = casting ? 330 : anchor.y + 20; p.angle = -Math.PI / 2;
  sim.portal.origin = casting ? { x: p.x, y: p.y } : null;
  sim.portal.elapsed = casting ? channelProgress * PORTAL_RULES.channel : 0;
  sim.travel.returnTo = state === 'unavailable' ? null : { x: 0, y: 330, town: 0 };
  chart.reveal(p.x, p.y);
}

function destinations() {
  const projected = portalDestinations({ seed: world.seed, home: anchor, travel: sim.travel, expeditions: sim.expeditions });
  const kind: PortalDestination['kind'] = state === 'dungeon' ? 'dungeon' : state === 'hazardous' ? 'hazardous' : 'surface';
  return { home: state === 'cast' ? { ...projected.home, biome } : projected.home,
    returnTo: state === 'unavailable' ? null : studyDestination(kind, biome) };
}

function draw(dt = 0) {
  stage();
  const ratio = devicePixelRatio || 1;
  shell.canvas.width = innerWidth * Math.min(1.6, ratio); shell.canvas.height = innerHeight * Math.min(1.6, ratio);
  shell.uiCanvas.width = innerWidth * ratio; shell.uiCanvas.height = innerHeight * ratio;
  const projected = destinations(); renderer.portalDestinations = projected;
  renderer.resize(Math.round(540 * innerWidth / innerHeight), 540); renderer.snapTo(p);
  const settings = { phase: 'playing' as const, reducedMotion: frozen };
  renderer.render(sim, world, dt, settings); fx.render(renderer.canvas, dt);
  const c = shell.uiCanvas.getContext('2d')!;
  c.setTransform(shell.uiCanvas.width / renderer.width, 0, 0, shell.uiCanvas.height / renderer.height, 0, 0);
  renderer.renderUI(c, sim, world, settings); map.drawMinimap(c, p, renderer.width, renderer.height, 0);
  shell.resizeControls(renderer.width, renderer.height);
}

function captureFrame(): HTMLCanvasElement {
  const output = document.createElement('canvas'); output.width = shell.canvas.width; output.height = shell.canvas.height;
  const c = output.getContext('2d')!; c.drawImage(shell.canvas, 0, 0); c.drawImage(shell.uiCanvas, 0, 0, output.width, output.height);
  return output;
}

function capturePortalCloseup(): HTMLCanvasElement {
  const frame = captureFrame(), point = renderer.worldToScreen(anchor.x, anchor.y - 22);
  const scaleX = frame.width / renderer.width, scaleY = frame.height / renderer.height;
  const width = Math.min(frame.width, 480), height = Math.min(frame.height, 300);
  const sx = Math.max(0, Math.min(frame.width - width, point.x * scaleX - width / 2));
  const sy = Math.max(0, Math.min(frame.height - height, point.y * scaleY - height / 2));
  const output = document.createElement('canvas'); output.width = width; output.height = height;
  output.getContext('2d')!.drawImage(frame, sx, sy, width, height, 0, 0, width, height); return output;
}

function syncURL() {
  params.set('state', state); params.set('biome', biome); params.set('progress', channelProgress.toFixed(2));
  frozen ? params.delete('animate') : params.set('animate', '1'); history.replaceState(null, '', `${location.pathname}?${params}`);
}

function update() { syncURL(); draw(); }
stateSelect.addEventListener('change', () => { state = stateSelect.value as StudyState; progressInput.disabled = state !== 'cast'; update(); }, { signal: abort.signal });
biomeSelect.addEventListener('change', () => { biome = biomeSelect.value as BiomeId; update(); }, { signal: abort.signal });
progressInput.addEventListener('input', () => { channelProgress = Number(progressInput.value); update(); }, { signal: abort.signal });
frozenInput.addEventListener('change', () => { frozen = reducedMotion.matches || frozenInput.checked; frozenInput.checked = frozen; update(); }, { signal: abort.signal });
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { frozen = true; frozenInput.checked = true; update(); } }, { signal: abort.signal });

controls.querySelector<HTMLButtonElement>('[name="capture"]')!.addEventListener('click', () => {
  const link = document.createElement('a'); link.href = captureFrame().toDataURL('image/png'); link.download = `evergrow-portal-${state}-${biome}.png`; link.click();
}, { signal: abort.signal });

const comparison = document.querySelector<HTMLElement>('.portal-review-comparison')!, grid = comparison.querySelector<HTMLElement>('.portal-review-grid')!;
let comparisonFrames: Array<{ biome: BiomeId; canvas: HTMLCanvasElement }> = [];
controls.querySelector<HTMLButtonElement>('[name="compare"]')!.addEventListener('click', () => {
  const previous = { state, biome, frozen }; state = 'surface'; frozen = true; grid.replaceChildren(); comparisonFrames = [];
  for (const id of BIOME_IDS) {
    biome = id; draw(); const figure = document.createElement('figure'), image = document.createElement('img'), caption = document.createElement('figcaption');
    const closeup = capturePortalCloseup(); comparisonFrames.push({ biome: id, canvas: closeup });
    image.src = closeup.toDataURL('image/jpeg', .92); image.alt = `${BIOMES[id].name} Town Portal`; caption.textContent = BIOMES[id].name;
    figure.append(image, caption); grid.append(figure);
  }
  ({ state, biome, frozen } = previous); draw(); comparison.hidden = false;
  comparison.querySelector<HTMLButtonElement>('[data-close-comparison]')!.focus();
}, { signal: abort.signal });
comparison.querySelector<HTMLButtonElement>('[data-save-comparison]')!.addEventListener('click', () => {
  if (!comparisonFrames.length) return;
  const cellWidth = 480, imageHeight = 300, captionHeight = 32, columns = 3, rows = Math.ceil(comparisonFrames.length / columns);
  const output = document.createElement('canvas'); output.width = cellWidth * columns; output.height = (imageHeight + captionHeight) * rows;
  const c = output.getContext('2d')!; c.fillStyle = '#070c12'; c.fillRect(0, 0, output.width, output.height); c.font = '18px system-ui'; c.fillStyle = '#d9d5c7';
  comparisonFrames.forEach(({ biome: id, canvas }, index) => { const x = index % columns * cellWidth, y = Math.floor(index / columns) * (imageHeight + captionHeight); c.drawImage(canvas, x, y); c.fillText(BIOMES[id].name, x + 12, y + imageHeight + 22); });
  const link = document.createElement('a'); link.href = output.toDataURL('image/png'); link.download = 'evergrow-town-portal-biomes.png'; link.click();
}, { signal: abort.signal });
function closeComparison() { comparison.hidden = true; controls.querySelector<HTMLButtonElement>('[name="compare"]')!.focus(); }
comparison.querySelector<HTMLButtonElement>('[data-close-comparison]')!.addEventListener('click', closeComparison, { signal: abort.signal });
comparison.addEventListener('keydown', event => { if (event.key === 'Escape') closeComparison(); }, { signal: abort.signal });

shell.showMenu('playing', 0, 0); progressInput.disabled = state !== 'cast'; draw();
if (params.has('map')) map.open(p);
let frame = 0, previousTime = performance.now();
function animate(now: number) { const dt = Math.min(.05, (now - previousTime) / 1000); previousTime = now; if (!frozen && !document.hidden) draw(dt); frame = requestAnimationFrame(animate); }
frame = requestAnimationFrame(animate);
window.addEventListener('resize', update, { signal: abort.signal });
life.defer(() => cancelAnimationFrame(frame));
if (import.meta.hot) import.meta.hot.dispose(() => life.dispose());
