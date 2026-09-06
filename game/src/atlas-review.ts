import './ui-kit.css';
import './typography.css';
import './world-map.css';
import './atlas-review.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { uiIcon } from './ui-components.ts';
import { World } from './world.ts';
import { Exploration } from './exploration.ts';
import { WorldMap } from './world-map.ts';
import { BIOMES, type BiomeId } from './biomes.ts';
import { stageAtlasExploration, ATLAS_REVIEW_BOUNDS, stageExtendedAtlasExploration, EXTENDED_ATLAS_BOUNDS } from './atlas-review-data.ts';

// Static exploration staging uses the real generation and map; no simulation or localStorage.
if (!import.meta.env.DEV) throw new Error('The atlas review is available only on the local development server.');
installUITheme();
const SEEDS = [7319, 18427, 90210] as const;
const params = new URLSearchParams(location.search);
const requestedSeed = Number(params.get('seed'));
const seed = params.has('seed') && Number.isSafeInteger(requestedSeed) ? requestedSeed >>> 0 : SEEDS[0];
const root = document.querySelector<HTMLElement>('#atlas-review')!;
const world = new World(seed), chart = new Exploration(world, { storage: null });
const abort = new AbortController();
let map: WorldMap | null = null;
let disposed = false;


async function start() {
  await loadGameFont();
  if (disposed) return;
  const extended = params.get('view') === 'extended';
  if (extended) stageExtendedAtlasExploration(chart); else stageAtlasExploration(chart, seed);
  root.innerHTML = `<header class="atlas-review-header"><div class="atlas-review-heading">${uiIcon('map')}<div>
    <p class="ui-kicker">Evergrow · World study</p><h1>${extended ? 'Geography & danger · Seed ' + seed : 'Beyond the familiar roads'}</h1></div></div>
    <nav class="atlas-seeds" aria-label="World seed">${SEEDS.map(value => `<a class="ui-button${seed === value ? ' is-selected' : ''}" href="/atlas.html?seed=${value}${extended ? '&view=extended&levels=1' : ''}"${seed === value ? ' aria-current="page"' : ''}>Seed ${value}</a>`).join('')}</nav></header>
    <div class="atlas-map-mount"></div><footer class="atlas-review-footer"><span><strong class="atlas-biomes"></strong> · ${extended ? 'Named regions · Road-led progression · ! marks dangerous wilderness' : 'Extensive exploration, with a living frontier'}</span>
    <span>Static review · <a href="#" class="atlas-export">Export chart PNG</a></span></footer>`;
  const mount = root.querySelector<HTMLElement>('.atlas-map-mount')!;
  map = new WorldMap(world, chart, mount, () => {});
  map.open({ x: 0, y: 0, angle: -Math.PI / 2 });
  map.setZoneLevels(true);
  const framing = extended ? EXTENDED_ATLAS_BOUNDS : ATLAS_REVIEW_BOUNDS;
  const reviewBounds = params.get('view') === 'local' ? { x: -2400, y: -500, width: 4800, height: 3400 } : framing;
  map.fitBounds(reviewBounds, 24);
  const found = new Set<BiomeId>();
  for (let y = -9000; y <= 9000; y += 480) for (let x = -11000; x <= 11000; x += 480)
    if (chart.isRevealed(x, y)) found.add(world.sampleBiome(x, y).id);
  root.querySelector('.atlas-biomes')!.textContent = `${found.size} of ${Object.keys(BIOMES).length} biomes charted`;
  root.setAttribute('aria-busy', 'false');
  window.addEventListener('resize', () => { map?.resize(); map?.fitBounds(reviewBounds, 24); }, { signal: abort.signal });
  root.querySelector('.atlas-export')!.addEventListener('click', event => {
    event.preventDefault(); if (!map) return;
    const link = document.createElement('a'); link.download = `evergrow-atlas-${seed}.png`;
    link.href = map.getCanvas().toDataURL('image/png'); link.click();
  }, { signal: abort.signal });
}
void start().catch(error => { if (disposed) return; root.textContent = `Atlas review could not load: ${String(error)}`; root.setAttribute('aria-busy', 'false'); });
function dispose() { if (disposed) return; disposed = true; abort.abort(); map?.dispose(); chart.dispose(); world.dispose(); }
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
