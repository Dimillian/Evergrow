import './ui-kit.css';
import './typography.css';
import './world-map.css';
import './atlas-review.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { uiIcon } from './ui-components.ts';
import { World } from './world.ts';
import { WorldMap } from './world-map.ts';
import { formatWorldDistance } from './world-distance.ts';
import { AtlasSurvey, ATLAS_SURVEYS, ATLAS_ZOOM, atlasSurveyBounds } from './tools/atlas-survey.ts';

if (!import.meta.env.DEV) throw new Error('The atlas review is available only on the local development server.');
installUITheme();
const params = new URLSearchParams(location.search);
const requestedSeed = Number(params.get('seed'));
const seed = params.has('seed') && Number.isSafeInteger(requestedSeed) ? requestedSeed >>> 0 : 7319;
const surveyId = ATLAS_SURVEYS.find(s => s.id === params.get('size'))?.id ?? 'wide';
const region = atlasSurveyBounds(surveyId);
const root = document.querySelector<HTMLElement>('#atlas-review')!;
const world = new World(seed), chart = new AtlasSurvey(world, region);
const abort = new AbortController();
let map: WorldMap | null = null;
let disposed = false;
let showLevels = params.get('levels') !== '0';
const player = { x: 0, y: 0, angle: -Math.PI / 2 };

async function start() {
  await loadGameFont();
  if (disposed) return;
  root.innerHTML = `<header class="atlas-review-header"><div class="atlas-review-heading">${uiIcon('map')}<h1>World atlas</h1></div>
    <form class="atlas-seeds">
      <label>Seed <input name="seed" aria-label="World seed" type="number" min="0" max="4294967295" step="1" required value="${seed}"></label>
      <label>Survey <select name="size" aria-label="Survey size">${ATLAS_SURVEYS.map(s => `<option value="${s.id}"${s.id === surveyId ? ' selected' : ''}>${s.label} · ${formatWorldDistance(atlasSurveyBounds(s.id).width)}</option>`).join('')}</select></label>
      <button class="ui-button" type="submit">Generate</button><button class="ui-button" type="button" data-random>New seed</button>
    </form></header>
    <div class="atlas-map-mount"></div><footer class="atlas-review-footer"><span class="atlas-survey-status" role="status">Surveying landmarks…</span>
    <span><button type="button" class="atlas-levels" aria-pressed="${showLevels}">Regions</button> · <button type="button" class="atlas-fit">Fit survey</button> · <a href="#" class="atlas-export">Export PNG</a></span></footer>`;
  const mount = root.querySelector<HTMLElement>('.atlas-map-mount')!;
  map = new WorldMap(world, chart, mount, () => {}, ATLAS_ZOOM);
  map.open(player);
  map.setZoneLevels(showLevels);
  map.fitBounds(region, 24);
  const signal = abort.signal;
  root.querySelector('.atlas-levels')!.addEventListener('click', event => {
    showLevels = !showLevels; map?.setZoneLevels(showLevels);
    (event.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', String(showLevels));
    const url = new URL(location.href); url.searchParams.set('levels', showLevels ? '1' : '0'); history.replaceState(null, '', url);
  }, { signal });
  root.querySelector('.atlas-fit')!.addEventListener('click', () => map?.fitBounds(region, 24), { signal });
  window.addEventListener('resize', () => map?.resize(), { signal });
  const form = root.querySelector<HTMLFormElement>('form')!;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    location.href = `/atlas.html?seed=${data.get('seed')}&size=${data.get('size')}&levels=${showLevels ? '1' : '0'}`;
  }, { signal });
  root.querySelector('[data-random]')!.addEventListener('click', () => {
    form.querySelector<HTMLInputElement>('input')!.value = String(crypto.getRandomValues(new Uint32Array(1))[0]);
    form.requestSubmit();
  }, { signal });
  root.querySelector('.atlas-export')!.addEventListener('click', event => {
    event.preventDefault(); if (!map) return;
    const link = document.createElement('a'); link.download = `evergrow-atlas-${seed}-${surveyId}.png`;
    link.href = map.getCanvas().toDataURL('image/png'); link.click();
  }, { signal });
  root.setAttribute('aria-busy', 'false');
  let lastRefresh = 0;
  await chart.survey(region, signal, progress => {
    if (disposed) return;
    root.querySelector('.atlas-survey-status')!.textContent = progress < 1 ? `Surveying landmarks · ${Math.round(progress * 100)}%`
      : `${formatWorldDistance(region.width)} × ${formatWorldDistance(region.height)} · ${chart.discoveredPOICount.toLocaleString()} landmarks`;
    if (progress === 1 || performance.now() - lastRefresh > 500) { map?.update(player, 0); lastRefresh = performance.now(); }
  });
}
void start().catch(error => { if (disposed) return; root.textContent = `Atlas review could not load: ${String(error)}`; root.setAttribute('aria-busy', 'false'); });
function dispose() { if (disposed) return; disposed = true; abort.abort(); map?.dispose(); chart.dispose(); world.dispose(); }
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
