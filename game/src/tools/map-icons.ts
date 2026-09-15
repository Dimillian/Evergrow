import { toolPage, reportRoute } from './common.ts';
import { POI_DEFINITIONS, type POIKind } from '../world-pois.ts';
import { drawMapPOIIcon, drawMapPlayerIcon, drawMapEnemyIcon, MAP_ICON_SIZES } from '../map-icon-art.ts';
import { drawDungeonMapIcon, type DungeonMapIcon } from '../dungeon-map-icon-art.ts';
import { drawJourneyMapMarker } from '../journey-marker.ts';
import { DUNGEON_EVENTS, DUNGEON_THEMES } from '../dungeon-content.ts';
import { GAME_FONT_STACK } from '../font.ts';
import { escapeUI } from '../ui-components.ts';
import { MAP_SYMBOL_LABELS } from '../map-symbol-art.ts';
import type { DungeonEventKind } from '../dungeon-content.ts';
import { createMapIconBackdrop } from './map-icon-backdrop.ts';
import './map-icons.css';

type Entry = { id: string; name: string; group: string; shape: string; note: string; color?: string; poi?: POIKind;
  draw(c: CanvasRenderingContext2D, mini: boolean, selected: boolean, completed: boolean): void };
const services = new Set<POIKind>(['blacksmith', 'jeweler', 'enchanter', 'merchant', 'inn', 'chapel', 'gambler', 'stash']);
const events = new Set<POIKind>(['bossLair', 'cursedChest', 'ruinedChapel', 'beastDen', 'quarry', 'hamlet', 'crossing', 'corruptedGrove', 'camp']);
const entries: Entry[] = Object.entries(POI_DEFINITIONS).map(([id, def]) => {
  const kind = id as POIKind, shape = kind;
  return { id, name: def.label, color: def.color, poi: kind, shape,
    group: services.has(kind) ? 'Services' : events.has(kind) ? 'Events' : 'Places',
    note: MAP_SYMBOL_LABELS[kind],
    draw: (c, mini, selected, completed) => drawMapPOIIcon(c, kind, 0, 0, mini ? MAP_ICON_SIZES.minimap : MAP_ICON_SIZES.map, selected, completed) };
});
for (const [id, name, note] of [
  ['player', 'Your character', 'Facing arrow and location halo.'], ['enemy', 'Enemy', 'Minimap only. Default dot for enemies other than brutes and casters.'],
  ['brute', 'Brute', 'Minimap only. Larger orange enemy dot.'], ['caster', 'Caster', 'Minimap only. Gold enemy dot.'],
] as const) entries.push({ id: `navigation:${id}`, name, group: 'Navigation', shape: id, note,
  draw: (c, mini) => id === 'player' ? drawMapPlayerIcon(c, 0, 0, -Math.PI / 2, mini) : drawMapEnemyIcon(c, 0, 0, id) });
for (const [id, name, known, edge] of [
  ['goal', 'Journey destination', true, false], ['search', 'Journey search area', false, false],
  ['edge', 'Journey offscreen direction', true, true], ['searchEdge', 'Search area offscreen', false, true],
] as const) entries.push({ id: `journey:${id}`, name, group: 'Navigation', shape: id,
  note: edge ? 'Bold direction chevron; shown at the minimap edge.' : known ? 'Destination flag.' : 'Magnifying glass inside the approximate search area.',
  draw: (c, mini) => {
    c.save(); if (edge) c.translate(-29, 0);
    drawJourneyMapMarker(c, { x: -40, y: -40, width: 80, height: 80, centerX: 0, centerY: 0, zoom: .025 },
      { x: edge ? 10000 : 0, y: 0, known, name }, edge || mini); c.restore();
  } });
for (const [id, name] of [['chest', 'Dungeon chest'], ['entry', 'Dungeon entrance / exit'], ['riftPortal', 'Crimson Rift portal'], ['boss', 'Dungeon boss'], ['player', 'Dungeon character']] as const)
  addDungeon(id, name, id);
for (const [id, event] of Object.entries(DUNGEON_EVENTS)) addDungeon(id, event.name, id as DungeonEventKind);
function addDungeon(id: string, name: string, shape: DungeonMapIcon): void {
  entries.push({ id: `dungeon:${id}`, name, group: 'Dungeons', shape,
    note: shape === 'player' ? 'Character arrow · unchanged.' : MAP_SYMBOL_LABELS[shape === 'riftPortal' ? 'rift' : shape === 'entry' ? 'exit' : shape === 'boss' ? 'bossLair' : shape],
    draw: (c, _mini, _selected, completed) => drawDungeonMapIcon(c, shape, 0, 0, completed, DUNGEON_THEMES[theme.value as keyof typeof DUNGEON_THEMES].accent, -Math.PI / 2) });
}
const root = await toolPage('Map icon workshop', 'Every registered place, service and event, plus dungeon and navigation markers. Enlarged drawings and actual map sizes use the live game artwork.');
root.insertAdjacentHTML('beforeend', `<div class="tool-toolbar map-icon-toolbar">
  <button type="button" id="map-view" aria-pressed="false">Map view</button>
  <label>Find an icon<input id="search" type="search" placeholder="Name, type or shape"></label>
  <label>Collection<select id="group"><option>All</option><option>Services</option><option>Events</option><option>Places</option><option>Navigation</option><option>Dungeons</option></select></label>
  <label>POI state<select id="state"><option value="normal">Normal</option><option value="selected">Hovered</option><option value="completed">Completed preview</option></select></label>
  <label>Backdrop<select id="background"><option value="#0b171b">Dark chart</option><option value="#365447">Forest</option><option value="#425d74">Frost</option><option value="#756047">Sand / stone</option></select></label>
  <label>Dungeon theme<select id="theme">${Object.values(DUNGEON_THEMES).map(t => `<option value="${t.id}">${escapeUI(t.name)}</option>`).join('')}</select></label>
  </div><p class="map-icon-notes" id="view-note"></p><p class="map-icon-notes">Completed previews apply the map’s jade treatment to POIs and actual completed states to dungeon markers; they do not imply every place has a completion state. Sighted POIs use the same icon with a different tooltip.</p>
  <p class="tool-status" id="count" role="status"></p><div class="map-icon-grid" id="gallery"></div>
  <details><summary>Where to revise these icons</summary><p>POI labels and colors: <code>game/src/world-pois.ts</code>. Shared silhouettes: <code>game/src/map-symbol-art.ts</code>. POI presentation: <code>game/src/map-icon-art.ts</code>. Dungeon symbols: <code>game/src/dungeon-map-icon-art.ts</code>. Journey markers: <code>game/src/journey-marker.ts</code>. Changes there update this workshop and the live maps together. Ordinary residents have no individual map marker. This catalog includes every registered POI, even kinds not currently generated.</p></details>`);
const search = root.querySelector<HTMLInputElement>('#search')!, group = root.querySelector<HTMLSelectElement>('#group')!;
const state = root.querySelector<HTMLSelectElement>('#state')!, background = root.querySelector<HTMLSelectElement>('#background')!;
const theme = root.querySelector<HTMLSelectElement>('#theme')!, gallery = root.querySelector<HTMLElement>('#gallery')!;
const controls = { search, group, state, background, theme };
const query = new URLSearchParams(location.search);
const mapToggle = root.querySelector<HTMLButtonElement>('#map-view')!;
let mapView = query.get('view') === 'map';
let mapBackdrop: HTMLCanvasElement | undefined;
for (const [key, input] of Object.entries(controls)) {
  const value = query.get(key);
  if (value !== null && (input instanceof HTMLInputElement || [...input.options].some(o => o.value === value))) input.value = value;
}
let cards: { entry: Entry; canvas: HTMLCanvasElement }[] = [];
function draw(): void {
  for (const { entry, canvas } of cards) {
    const width = canvas.clientWidth, height = 224, ratio = Math.min(3, devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    const c = canvas.getContext('2d')!; c.setTransform(ratio, 0, 0, ratio, 0, 0);
    c.fillStyle = background.value; c.fillRect(0, 0, width, height);
    if (mapView) {
      if (entry.group === 'Dungeons') {
        const dungeonTheme = DUNGEON_THEMES[theme.value as keyof typeof DUNGEON_THEMES];
        c.fillStyle = '#071018'; c.fillRect(0, 0, width, height);
        c.fillStyle = dungeonTheme.map; c.fillRect(0, height / 2 - 11, width, 22);
        c.fillRect(width / 2 - 62, height / 2 - 46, 124, 92);
        c.strokeStyle = dungeonTheme.wall; c.lineWidth = 1;
        c.strokeRect(width / 2 - 62, height / 2 - 46, 124, 92);
      } else {
        mapBackdrop ??= createMapIconBackdrop();
        c.imageSmoothingEnabled = false;
        const side = Math.max(width, height);
        c.drawImage(mapBackdrop, (width - side) / 2, (height - side) / 2, side, side);
      }
      c.save(); c.translate(width / 2, height / 2);
      const mini = entry.id.startsWith('navigation:') && entry.id !== 'navigation:player' || entry.id.includes('Edge') || entry.id === 'journey:edge';
      entry.draw(c, mini, state.value === 'selected', state.value === 'completed'); c.restore();
      continue;
    }
    for (const [x, y, scale, mini, label, captionY] of [[width * .5, 73, 4, false, '4× detail', 146], [width * .33, 180, 1, false, 'Map', 211], [width * .67, 180, 1, true, 'Mini', 211]] as const) {
      c.save(); c.translate(x, y); c.scale(scale, scale); entry.draw(c, mini, state.value === 'selected', state.value === 'completed'); c.restore();
      c.fillStyle = '#e3e9dd'; c.font = `12px ${GAME_FONT_STACK}`; c.textAlign = 'center'; c.fillText(label, x, captionY);
    }
  }
}
function refresh(): void {
  mapToggle.setAttribute('aria-pressed', String(mapView));
  background.disabled = mapView;
  root.querySelector('#view-note')!.textContent = mapView
    ? 'Map view · one icon at its actual display size. World markers sit on a real generated terrain crop; dungeon markers use a staged room with the selected theme’s map colors. Positions are arranged for review. Labels stay outside the map.'
    : 'Each card shows a 4× enlargement, world-map size and minimap size. Toggle Map view to review one actual-size icon against map scenery.';
  const term = search.value.trim().toLowerCase();
  const visible = entries.filter(e => (group.value === 'All' || group.value === e.group) && `${e.name} ${e.id} ${e.shape} ${e.note}`.toLowerCase().includes(term));
  gallery.innerHTML = visible.map(e => `<article class="map-icon-card"><h2>${escapeUI(e.name)}</h2><code>${escapeUI(e.id)}</code><canvas role="img" aria-label="${escapeUI(e.name)} at enlarged, map and minimap sizes"></canvas><p>${escapeUI(e.note)}</p><footer><span>${e.color ? `<i class="map-icon-swatch" style="--swatch:${e.color}"></i><code>${e.color}</code>` : escapeUI(e.group)}</span><button type="button" data-export="${e.id}">Save PNG</button></footer></article>`).join('');
  cards = visible.map((entry, i) => ({ entry, canvas: gallery.querySelectorAll('canvas')[i] }));
  for (const { entry, canvas } of cards) canvas.setAttribute('aria-label', `${entry.name} ${mapView ? 'at actual size in map context' : 'at enlarged, map and minimap sizes'}`);
  root.querySelector('#count')!.textContent = `${visible.length} / ${entries.length} markers · Every location has a dedicated silhouette${visible.length ? '' : ' · No matching icons'}`;
  draw();
}
const abort = new AbortController();
mapToggle.addEventListener('click', () => {
  mapView = !mapView;
  const url = new URL(location.href);
  if (mapView) url.searchParams.set('view', 'map'); else url.searchParams.delete('view');
  history.replaceState(null, '', url); reportRoute(); refresh();
}, { signal: abort.signal });
for (const input of Object.values(controls)) input.addEventListener('input', () => {
  const url = new URL(location.href);
  for (const [key, input] of Object.entries(controls)) url.searchParams.set(key, input.value);
  history.replaceState(null, '', url); reportRoute(); refresh();
}, { signal: abort.signal });
gallery.addEventListener('click', event => {
  const id = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-export]')?.dataset.export;
  const card = cards.find(c => c.entry.id === id); if (!card) return;
  const a = document.createElement('a'); a.download = `evergrow-map-${id!.replace(':', '-')}-${mapView ? 'context' : 'sizes'}-${state.value}.png`; a.href = card.canvas.toDataURL('image/png'); a.click();
}, { signal: abort.signal });
const observer = new ResizeObserver(draw); observer.observe(gallery); refresh();
const dispose = () => { observer.disconnect(); abort.abort(); };
window.addEventListener('pagehide', dispose, { once: true }); if (import.meta.hot) import.meta.hot.dispose(dispose);
