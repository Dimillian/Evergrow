import './typography.css';
import './layout-review.css';
import { loadGameFont } from './font.ts';
import { PostFX } from './postfx.ts';
import type { VisualMode } from './postfx.ts';
import { Renderer } from './renderer.ts';
import type { RenderSettings } from './renderer.ts';
import { FIRST_TOWN_Y, TOWN_INTERVAL } from './settlements.ts';
import type { Building, Rect, Settlement } from './settlements.ts';
import { Simulation } from './simulation.ts';
import { mainPathX, World } from './world.ts';

// This HTML entry is intentionally absent from Vite's production build inputs.
// Staging only creates a frozen simulation: no input handlers or simulation ticks.
const EXPORT_WIDTH = 1440;
const EXPORT_HEIGHT = 1000;
const ASPECT = EXPORT_WIDTH / EXPORT_HEIGHT;
const WORLD_SEED = 7319;
const VIEWS = [
  { id: 'town', label: 'Town overview' },
  { id: 'city', label: 'City overview' },
  { id: 'street', label: 'Street junction' },
  { id: 'interior', label: 'Furnished interior' },
] as const;
type ViewId = typeof VIEWS[number]['id'];
interface Point { x: number; y: number; }
interface Stage {
  title: string;
  description: string;
  camera: Point;
  width: number;
  height: number;
  hero: Point;
  settlement: Settlement;
}

const lifecycle = new AbortController();
let disposed = false;
let postfx: PostFX | undefined;
const root = document.querySelector<HTMLElement>('#layout-review')!;

function fit(rectangles: readonly Rect[], padding: number): Pick<Stage, 'camera' | 'width' | 'height'> {
  const left = Math.min(...rectangles.map(rect => rect.x)) - padding;
  const top = Math.min(...rectangles.map(rect => rect.y)) - padding;
  const right = Math.max(...rectangles.map(rect => rect.x + rect.width)) + padding;
  const bottom = Math.max(...rectangles.map(rect => rect.y + rect.height)) + padding;
  const height = Math.ceil(Math.max(bottom - top, (right - left) / ASPECT));
  return { camera: { x: (left + right) / 2, y: (top + bottom) / 2 }, width: Math.round(height * ASPECT), height };
}

function settlementAt(world: World, y: number): Settlement {
  const settlement = world.getSettlements(mainPathX(y) - 1, y - 1, 2, 2)
    .find(candidate => Math.abs(candidate.y - y) < 1);
  if (!settlement || !settlement.buildings.length) throw new Error('The requested settlement has no generated buildings.');
  return settlement;
}

/** Find an unoccupied staging point without ever moving or advancing a character. */
function clearFloor(world: World, preferred: Point, bounds?: Rect): Point {
  const radius = 9;
  for (let ring = 0; ring <= 10; ring++) {
    const samples = ring ? 16 : 1;
    for (let index = 0; index < samples; index++) {
      const angle = index / samples * Math.PI * 2;
      const point = { x: preferred.x + Math.cos(angle) * ring * 8, y: preferred.y + Math.sin(angle) * ring * 8 };
      if (bounds && (point.x < bounds.x + 17 || point.x > bounds.x + bounds.width - 17
        || point.y < bounds.y + 17 || point.y > bounds.y + bounds.height - 17)) continue;
      if (!world.blocked(point.x, point.y, radius)) return point;
    }
  }
  throw new Error('Could not find clear floor for the staged character.');
}

function overview(world: World, settlement: Settlement): Stage {
  // Include the projected roof above its ground footprint, and every generated street.
  const buildings = settlement.buildings.map(building => ({ x: building.x - 16, y: building.y - 100,
    width: building.width + 32, height: building.height + 130 }));
  return {
    title: `${settlement.name} · ${settlement.kind === 'city' ? 'city' : 'town'}`,
    description: `${settlement.buildings.length} generated buildings · connected streets and central road`,
    ...fit([...buildings, ...settlement.streets, settlement.plaza], 110),
    hero: clearFloor(world, { x: settlement.x, y: settlement.y + 25 }), settlement,
  };
}

function selectBuilding(settlement: Settlement, kind: Building['kind']): Building {
  return settlement.buildings.find(building => building.kind === kind) ?? settlement.buildings[0];
}

function makeStage(world: World, view: ViewId): Stage {
  const town = settlementAt(world, FIRST_TOWN_Y);
  if (view === 'town') return overview(world, town);
  if (view === 'city') return overview(world, settlementAt(world, FIRST_TOWN_Y - TOWN_INTERVAL));
  if (view === 'street') {
    const building = selectBuilding(town, 'blacksmith');
    const junction = { x: mainPathX(building.door.y + 27), y: building.door.y + 27 };
    const hero = clearFloor(world, { x: (junction.x + building.door.x) / 2, y: junction.y });
    const height = 420;
    return {
      title: `${town.name} · ${building.name}`,
      description: 'Street meets the central road · equipped character shown at world scale',
      camera: { x: (building.x + building.width / 2 + junction.x) / 2, y: building.y + building.height * .55 - 15 },
      width: Math.round(height * ASPECT), height, hero, settlement: town,
    };
  }
  const building = selectBuilding(town, 'inn');
  const hero = clearFloor(world, { x: building.door.x, y: building.y + building.height * .64 }, building);
  return {
    title: `${town.name} · ${building.name}`,
    description: 'Furnished room · automatic roof cutaway · shared doorway and world coordinates',
    ...fit([{ x: building.x - 12, y: building.y - 48, width: building.width + 24, height: building.height + 92 }], 32),
    hero, settlement: town,
  };
}

function createButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = label;
  return button;
}

async function boot() {
  if (!import.meta.env.DEV) throw new Error('Layout review is available only through the local development server.');
  await loadGameFont();
  if (disposed) return;
  const params = new URLSearchParams(location.search);
  let view: ViewId = VIEWS.find(candidate => candidate.id === params.get('view'))?.id ?? 'town';
  const defaultMode = (id: ViewId): VisualMode => id === 'town' || id === 'city' ? 'clean' : 'crt';
  let modePinned = ['clean', 'crt', 'phosphor'].includes(params.get('mode') ?? '');
  let mode: VisualMode = modePinned ? params.get('mode') as VisualMode : defaultMode(view);
  const world = new World(WORLD_SEED);
  const renderer = new Renderer();
  const scene = document.createElement('canvas');
  scene.width = EXPORT_WIDTH; scene.height = EXPORT_HEIGHT;
  scene.className = 'layout-review-scene'; scene.setAttribute('role', 'img');
  const context = scene.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas rendering is unavailable.');
  const display = document.createElement('canvas');
  display.width = EXPORT_WIDTH; display.height = EXPORT_HEIGHT;

  root.innerHTML = `
    <header class="layout-review-header">
      <div><p class="layout-review-eyebrow">EVERGROWING / LOCAL DEV</p><h1>Settlement layout review</h1></div>
      <p class="layout-review-static">Frozen generated scenes</p>
    </header>
    <div class="layout-review-toolbar">
      <nav class="layout-review-views" aria-label="Layout views"></nav>
      <div class="layout-review-actions">
        <label for="layout-mode">Display</label>
        <select id="layout-mode"><option value="clean">Clean</option><option value="crt">CRT</option><option value="phosphor">Phosphor</option></select>
      </div>
    </div>
    <figure class="layout-review-figure">
      <div class="layout-review-frame"></div>
      <figcaption class="layout-review-caption"><p class="layout-review-description"></p><p class="layout-review-metadata"></p></figcaption>
    </figure>
    <p class="layout-review-status" role="status" aria-live="polite"></p>`;
  root.querySelector('.layout-review-frame')!.append(scene);
  const heading = root.querySelector('h1')!;
  const description = root.querySelector<HTMLElement>('.layout-review-description')!;
  const metadata = root.querySelector<HTMLElement>('.layout-review-metadata')!;
  const status = root.querySelector<HTMLElement>('.layout-review-status')!;
  const modeSelect = root.querySelector<HTMLSelectElement>('#layout-mode')!;
  modeSelect.value = mode;
  const download = document.createElement('a');
  download.className = 'layout-review-download'; download.textContent = 'Save PNG';
  root.querySelector('.layout-review-actions')!.append(download);
  const viewButtons = new Map<ViewId, HTMLButtonElement>();
  const settings: RenderSettings = { phase: 'paused', muted: true, reducedMotion: true, mode, fps: 0, debug: false };
  let stage: Stage;

  function compose() {
    context!.imageSmoothingEnabled = false;
    if (mode === 'clean') context!.drawImage(renderer.canvas, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
    else {
      postfx ??= new PostFX(display);
      postfx.render(renderer.canvas, mode, 0);
      // Copy immediately while the WebGL drawing buffer is still valid; exports use the persistent 2D canvas.
      context!.drawImage(display, 0, 0);
    }
    params.set('view', view); params.set('mode', mode);
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
    scene.setAttribute('aria-label', `${stage.title}. ${stage.description}. ${mode} display.`);
    scene.dataset.view = view;
    download.href = scene.toDataURL('image/png');
    download.download = `evergrowing-${view}-seed-${WORLD_SEED}-v${world.generationVersion}-${mode}.png`;
    metadata.textContent = `Seed ${WORLD_SEED} · generation ${world.generationVersion} · PNG ${EXPORT_WIDTH} × ${EXPORT_HEIGHT}`;
    status.textContent = `${stage.title}, ${mode} display ready.`;
    root.dataset.ready = 'true';
    root.setAttribute('aria-busy', 'false');
  }

  function renderView(next: ViewId) {
    root.dataset.ready = 'false'; root.setAttribute('aria-busy', 'true');
    if (!modePinned) { mode = defaultMode(next); modeSelect.value = mode; settings.mode = mode; }
    stage = makeStage(world, next);
    const simulation = new Simulation(world, { seed: WORLD_SEED, spawn: false, startX: stage.hero.x, startY: stage.hero.y });
    simulation.player.angle = -.65;
    simulation.time = 12;
    renderer.reset(); renderer.resize(stage.width, stage.height);
    renderer.cameraX = stage.camera.x; renderer.cameraY = stage.camera.y;
    // Advance only presentation settling, once; the paused simulation never runs.
    renderer.render(simulation, world, 1, settings);
    view = next;
    heading.textContent = stage.title; description.textContent = stage.description;
    document.title = `Evergrowing · ${stage.title} · Layout review`;
    for (const [id, button] of viewButtons) button.setAttribute('aria-current', String(id === view));
    compose();
  }

  for (const choice of VIEWS) {
    const button = createButton(choice.label);
    button.dataset.view = choice.id;
    button.addEventListener('click', () => renderView(choice.id), { signal: lifecycle.signal });
    viewButtons.set(choice.id, button);
    root.querySelector('.layout-review-views')!.append(button);
  }
  modeSelect.addEventListener('change', () => {
    modePinned = true; mode = modeSelect.value as VisualMode; settings.mode = mode; compose();
  }, { signal: lifecycle.signal });
  display.addEventListener('webglcontextrestored', compose, { signal: lifecycle.signal });
  renderView(view);
}

void boot().catch(error => {
  if (disposed) return;
  root.setAttribute('aria-busy', 'false'); root.dataset.ready = 'error';
  const message = document.createElement('p');
  message.className = 'layout-review-loading layout-review-error'; message.setAttribute('role', 'alert');
  message.textContent = error instanceof Error ? error.message : 'Layout review could not be prepared.';
  root.replaceChildren(message);
});

function dispose() {
  disposed = true; lifecycle.abort(); postfx?.dispose();
}
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); }, { signal: lifecycle.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
