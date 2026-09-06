import { formatWorldDistance } from './world-distance.ts';
import { drawJourneyMapMarker, type JourneyMarker } from './journey-marker.ts';
import { drawMapZoneLevels, mapZoneLabels } from './map-zone-art.ts';
import { drawMapProps, drawMapBuilding } from './map-terrain-art.ts';
import type { Prop } from './world.ts';
import { Exploration, EXPLORATION_REVEAL_RADIUS, EXPLORATION_CELL_SIZE, EXPLORATION_CHUNK_SIZE } from './exploration.ts';
import { BIOMES, type BiomeId } from './biomes.ts';
import { roadPaths } from './road-shape.ts';
import { clampMapCoordinate, fitMapBounds, getMinimapRect, projectMapPoint, unprojectMapPoint, zoomMapAt, type MapView } from './map-view.ts';
import { POI_DEFINITIONS } from './world-pois.ts';
export { getMinimapRect, projectMapPoint, unprojectMapPoint, zoomMapAt, type MapView } from './map-view.ts';
import type { ExplorationWorld, MapPOI, MapRect } from './exploration.ts';
import { text } from './font.ts';
import { uiIcon } from './ui-components.ts';
import { UI_THEME } from './ui-theme.ts';
import { getZoneAt, type ZoneProgression } from './zone-progression.ts';

export interface MapPlayer { x: number; y: number; angle: number; }
export interface MinimapEnemy { x: number; y: number; kind?: string; }
export interface MapWorld extends ExplorationWorld {
  mapColor(x: number, y: number, sampleSize?: number): string;
  atlasColor?(x: number, y: number): string;
  getProps?(x: number, y: number, width: number, height: number): Prop[];
  sampleBiome(x: number, y: number): { id: string; name: string };
  getBuildings(x: number, y: number, width: number, height: number): Array<MapRect & { name?: string; kind?: string }>;
  getBuildingAt?(x: number, y: number): { name?: string } | null;
  isSanctuary?(x: number, y: number): boolean;
}
const TILE_PIXELS = 32;
export const MAP_TERRAIN_RULES = Object.freeze({ cacheLimit: 384, maximumVisibleTiles: 256, baseWorldSize: 768 });
/** Increase world coverage per tile at overview scales while retaining a bounded sample budget. */
export function mapTerrainSize(zoom: number, width: number, height: number): number {
  if (![zoom, width, height].every(Number.isFinite) || zoom <= 0 || width <= 0 || height <= 0) return MAP_TERRAIN_RULES.baseWorldSize;
  zoom = Math.max(.025, zoom); width = Math.min(16384, width); height = Math.min(16384, height);
  let size = Math.max(width, height) <= 256 ? 768 : zoom < .06 ? 3072 : zoom < .13 ? 1536 : 768;
  while ((Math.ceil(width / zoom / size) + 2) * (Math.ceil(height / zoom / size) + 2) > MAP_TERRAIN_RULES.maximumVisibleTiles) size *= 2;
  return size;
}

/** Coarse pixels are visible only when every covered exploration cell is known. */
export function isMapSampleRevealed(exploration: Pick<Exploration, 'isCellRevealed'>, x: number, y: number, sampleSize: number): boolean {
  if (![x, y, sampleSize].every(Number.isFinite) || sampleSize <= 0 || sampleSize > 4096) return false;
  const minX = Math.floor(x / EXPLORATION_CELL_SIZE), minY = Math.floor(y / EXPLORATION_CELL_SIZE);
  const maxX = Math.ceil((x + sampleSize) / EXPLORATION_CELL_SIZE), maxY = Math.ceil((y + sampleSize) / EXPLORATION_CELL_SIZE);
  for (let cy = minY; cy < maxY; cy++) for (let cx = minX; cx < maxX; cx++) if (!exploration.isCellRevealed(cx, cy)) return false;
  return true;
}
const TERRAIN_CACHE_LIMIT = MAP_TERRAIN_RULES.cacheLimit;
interface TerrainTile { base: HTMLCanvasElement; charted: HTMLCanvasElement; roads: HTMLCanvasElement | null; chartedRoads: HTMLCanvasElement | null; revision: number; nextRow: number; decorated: boolean; readyAt?: number; }
interface PreviewTile { base: HTMLCanvasElement; charted: HTMLCanvasElement; revision: number; }
export function mapTileBlend(readyAt: number, now: number, reducedMotion = false): number {
  if (reducedMotion) return 1;
  const t = Math.max(0, Math.min(1, (now - readyAt) / 240));
  return t * t * (3 - 2 * t);
}

function maskMapTile(c: CanvasRenderingContext2D, source: HTMLCanvasElement, exploration: Exploration,
  ox: number, oy: number, size: number, pixels: number): void {
  const sampleSize = size / pixels;
  c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, pixels, pixels);
  for (let y = 0; y < pixels; y++) {
    let run = -1;
    for (let x = 0; x <= pixels; x++) {
      const revealed = x < pixels && isMapSampleRevealed(exploration, ox + x * sampleSize, oy + y * sampleSize, sampleSize);
      if (revealed && run < 0) run = x;
      if (!revealed && run >= 0) { c.drawImage(source, run, y, x - run, 1, run, y, x - run, 1); run = -1; }
    }
  }
}
export interface MapRoadPath { main: boolean; points: readonly (readonly [number, number])[] }
/** Exact existing centerlines sampled at a fixed, bounded world interval; tile canvases clip the ends. */
export function mapRoadPaths(x: number, y: number, size: number, seed = 7319): MapRoadPath[] {
  if (![x,y,size].every(Number.isFinite) || size <= 0 || size > 12288 || Math.abs(x)>48000000 || Math.abs(y)>48000000) return [];
  return roadPaths(x,y,size,size,seed);
}

function createMapRoadLayer(x: number, y: number, size: number, seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d')!;
  c.setTransform(128 / size, 0, 0, 128 / size, -x * 128 / size, -y * 128 / size);
  c.lineJoin = 'round'; c.lineCap = 'round';
  for (const road of mapRoadPaths(x, y, size, seed)) {
    c.beginPath(); c.moveTo(...road.points[0]);
    for (const point of road.points.slice(1)) c.lineTo(...point);
    c.strokeStyle = '#15232180'; c.lineWidth = road.main ? 37 : 29; c.stroke();
    c.strokeStyle = road.main ? '#c8b88dba' : '#b4a88091'; c.lineWidth = road.main ? 22 : 16; c.stroke();
  }
  return canvas;
}

interface PresentationState {
  x: number; y: number; angle: number; revision: number; status: string; message: string;
}
const bounds = (view: MapView): MapRect => ({ x: view.centerX - view.width / view.zoom / 2,
  y: view.centerY - view.height / view.zoom / 2, width: view.width / view.zoom, height: view.height / view.zoom });
const setText = (element: HTMLElement, value: string) => { if (element.textContent !== value) element.textContent = value; };
const palette = UI_THEME.palette;

/** Revealed cells are the boundary for inspecting terrain and danger on the chart. */
export function chartedMapArea(world: Pick<MapWorld, 'sampleBiome' | 'isSanctuary'> & Partial<Pick<MapWorld, 'seed'>>,
  exploration: Pick<Exploration, 'isRevealed'>, x: number, y: number) {
  if (![x, y].every(Number.isFinite) || !exploration.isRevealed(x, y)) return null;
  return { name: getZoneAt(x, y, world.seed).name, label: mapAreaLabel(world, x, y), x, y };
}

function mapAreaLabel(world: Pick<MapWorld, 'isSanctuary'> & Partial<Pick<MapWorld, 'seed'>>, x: number, y: number) {
  return world.isSanctuary?.(x, y) ? 'Sanctuary' : `Area Lv ${getZoneAt(x, y, world.seed).level}`;
}

/** Keep hover selection inside the chart and prefer the closest visible marker. */
export function pickMapPOI(pois: readonly MapPOI[], view: MapView, pointer: { x: number; y: number }, radius: number): MapPOI | null {
  if (pointer.x < view.x || pointer.y < view.y || pointer.x >= view.x + view.width || pointer.y >= view.y + view.height) return null;
  let nearest: MapPOI | null = null, distance = radius;
  for (const poi of pois) {
    const p = projectMapPoint(poi.x, poi.y, view);
    if (p.x < view.x || p.y < view.y || p.x > view.x + view.width || p.y > view.y + view.height) continue;
    const d = Math.hypot(p.x - pointer.x, p.y - pointer.y);
    if (d < distance || (!nearest && d === radius)) { distance = d; nearest = poi; }
  }
  return nearest;
}

const SERVICE_KINDS = new Set(['blacksmith', 'merchant', 'inn', 'chapel', 'jeweler', 'enchanter']);
/** The same stable visible list serves painting and hover; hidden overlapping services never steal focus. */
export function selectMapPOIs(pois: readonly MapPOI[], view: MapView, mini = false): MapPOI[] {
  const priority = (poi: MapPOI) => poi.kind === 'portal' ? -1 : poi.kind === 'town' ? 0 : poi.kind === 'camp' ? 1 : SERVICE_KINDS.has(poi.kind) ? 3 : 2;
  const candidates = pois.filter(poi => (view.zoom >= .10 || !SERVICE_KINDS.has(poi.kind)))
    .map(poi => ({ poi, screen: projectMapPoint(poi.x, poi.y, view) }))
    .filter(({ screen }) => screen.x >= view.x + 6 && screen.y >= view.y + 6 && screen.x <= view.x + view.width - 6 && screen.y <= view.y + view.height - 6)
    .sort((a, b) => priority(a.poi) - priority(b.poi) || a.poi.id.localeCompare(b.poi.id));
  const selected: typeof candidates = [], separation = mini ? 11 : view.zoom < .07 ? 40 : 19;
  for (const candidate of candidates) if (selected.every(other => Math.hypot(candidate.screen.x - other.screen.x,
    candidate.screen.y - other.screen.y) >= separation)) selected.push(candidate);
  return selected.map(candidate => candidate.poi);
}

export interface MapRegionLabel { id: string; name: string; x: number; y: number }
/** A label needs a revealed, homogeneous patch; the chart never names unknown terrain. */
export function mapRegionLabels(world: Pick<MapWorld, 'sampleBiome'>, exploration: Pick<Exploration, 'isRevealed'>,
  view: MapView, pois: readonly Pick<MapPOI, 'x' | 'y'>[]): MapRegionLabel[] {
  if (view.zoom > .11) return [];
  const region = bounds(view), stride = Math.max(960, 52 / view.zoom);
  const candidates: Array<MapRegionLabel & { score: number }> = [];
  for (let y = Math.ceil(region.y / stride) * stride; y < region.y + region.height; y += stride)
    for (let x = Math.ceil(region.x / stride) * stride; x < region.x + region.width; x += stride) {
      const screen = projectMapPoint(x, y, view);
      if (screen.x < view.x + 82 || screen.y < view.y + 46 || screen.x > view.x + view.width - 82 || screen.y > view.y + view.height - 65) continue;
      const offsets = [[0, 0], [-420, 0], [420, 0], [0, -420], [0, 420], [-280, -280], [280, -280], [-280, 280], [280, 280]];
      if (!offsets.every(([dx, dy]) => exploration.isRevealed(x + dx, y + dy))) continue;
      const biome = world.sampleBiome(x, y);
      const matching = offsets.filter(([dx, dy]) => world.sampleBiome(x + dx, y + dy).id === biome.id).length;
      if (matching < 8 || pois.some(poi => { const p = projectMapPoint(poi.x, poi.y, view); return Math.abs(p.x - screen.x) < 76 && Math.abs(p.y - screen.y) < 21; })) continue;
      candidates.push({ id: biome.id, name: biome.name, x, y, score: matching * 1000 - Math.hypot(screen.x - view.x - view.width / 2, screen.y - view.y - view.height / 2) });
    }
  candidates.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
  const selected: MapRegionLabel[] = [];
  for (const candidate of candidates) {
    if (selected.length >= 12) break;
    if (selected.some(other => Math.hypot((other.x - candidate.x) * view.zoom, (other.y - candidate.y) * view.zoom) < (other.id === candidate.id ? 250 : 145))) continue;
    selected.push(candidate);
  }
  return selected;
}

export type CampMapState = 'dormant' | 'active' | 'cleared';

/** A continuously translated chart built from cached world-space terrain and discovery tiles. */
export class WorldMap {
  private journeyMarker: JourneyMarker|null = null;
  setJourneyMarker(marker:JourneyMarker|null) { if(JSON.stringify(marker)===JSON.stringify(this.journeyMarker))return; this.journeyMarker=marker; this.invalidate(); }
  readonly element: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private viewport: HTMLDivElement;
  private status: HTMLElement;
  private discoveries: HTMLElement;
  private coordinates: HTMLElement;
  private tooltip: HTMLDivElement;
  private tooltipName: HTMLElement;
  private tooltipKind: HTMLElement;
  private tooltipDescription: HTMLElement;
  private tiles = new Map<string, TerrainTile>();
  private previewTiles = new Map<string, PreviewTile>();
  private frame = 0;
  private chartDirty = false;
  private buildBudget?: number;
  private pendingTerrain = false;
  private chartLayer?: HTMLCanvasElement;
  private chartLayerValid = false;
  private visiblePOIs: MapPOI[] = [];
  private zoneLevels = true;
  setZoneLevels(visible: boolean) { this.zoneLevels = visible; this.render(); }
  private abort = new AbortController();
  private opened = false;
  private player: MapPlayer = { x: 0, y: 0, angle: 0 };
  private view: MapView = { x: 0, y: 0, width: 800, height: 500, centerX: 0, centerY: 0, zoom: .17 };
  private pointer: { x: number; y: number } | null = null;
  private portalMarkers: () => MapPOI[] = () => [];
  setPortalMarkers(reader: () => MapPOI[]) { this.portalMarkers = reader; this.render(); }
  private minimapPointer: { x: number; y: number } | null = null;
  private drag: { id: number; x: number; y: number; centerX: number; centerY: number } | null = null;
  private hovered: MapPOI | null = null;
  private returnFocus: HTMLElement | null = null;
  private ratio = 1;
  private presentation: PresentationState | null = null;
  private disposed = false;
  private world: MapWorld;
  private exploration: Exploration;
  private onClose: () => void;
  private eventStateReader: (poi: MapPOI) => string | null = () => null;
  setEventStateReader(reader: (poi: MapPOI) => string | null) { this.eventStateReader = reader; }
  private campStateReader: (id: string) => CampMapState = () => 'dormant';

  constructor(world: MapWorld, exploration: Exploration, mount: HTMLElement, onClose: () => void) {
    this.world = world; this.exploration = exploration; this.onClose = onClose;
    this.element = document.createElement('div');
    this.element.className = 'world-map-root'; this.element.hidden = true;
    this.element.innerHTML = `<section class="world-map-panel ui-window" role="dialog" aria-modal="true" aria-labelledby="world-map-title">
      <header class="world-map-header ui-window__header">
        <div class="world-map-heading"><span class="world-map-emblem" aria-hidden="true">${uiIcon('map')}</span>
          <h2 class="ui-title" id="world-map-title">World map</h2></div>
        <button type="button" class="world-map-close ui-button ui-button--quiet ui-button--icon" aria-label="Close world map" data-tooltip="Close map" data-tooltip-placement="below" data-tooltip-align="end">${uiIcon('close')}</button>
      </header>
      <div class="world-map-viewport ui-window__body"><canvas class="world-map-canvas" tabindex="0" aria-label="Explored world map"></canvas>
        <div class="world-map-toolbar" role="toolbar" aria-label="Map controls">
          <button type="button" class="ui-button ui-button--quiet ui-button--icon" data-map="out" aria-label="Zoom out" data-tooltip="Zoom out">${uiIcon('minus')}</button>
          <button type="button" class="ui-button ui-button--quiet ui-button--icon" data-map="in" aria-label="Zoom in" data-tooltip="Zoom in">${uiIcon('plus')}</button>
          <span class="world-map-control-divider" aria-hidden="true"></span>
          <button type="button" class="ui-button ui-button--quiet ui-button--icon" data-map="center" aria-label="Center on character" data-tooltip="Center on character" data-tooltip-align="end">${uiIcon('center')}</button>
        </div>
        <div class="world-map-tooltip ui-tooltip" role="status" aria-live="polite" aria-atomic="true" hidden>
          <p class="world-map-poi-kind ui-kicker"></p><h3 class="ui-title"></h3><p class="world-map-poi-description ui-body"></p></div>
      </div>
      <footer class="world-map-footer ui-window__footer">
        <div class="world-map-progress"><span class="world-map-discoveries"></span><span class="world-map-status ui-muted" role="status"></span></div>
        <div class="world-map-position"><span class="ui-kicker">Position</span><span class="world-map-coordinates"></span></div>
      </footer></section>`;
    mount.append(this.element);
    this.canvas = this.element.querySelector<HTMLCanvasElement>('.world-map-canvas')!;
    this.context = this.canvas.getContext('2d')!;
    this.viewport = this.element.querySelector<HTMLDivElement>('.world-map-viewport')!;
    this.status = this.element.querySelector('.world-map-status')!;
    this.discoveries = this.element.querySelector('.world-map-discoveries')!;
    this.coordinates = this.element.querySelector('.world-map-coordinates')!;
    this.tooltip = this.element.querySelector<HTMLDivElement>('.world-map-tooltip')!;
    this.tooltipName = this.tooltip.querySelector('h3')!;
    this.tooltipKind = this.tooltip.querySelector('.world-map-poi-kind')!;
    this.tooltipDescription = this.tooltip.querySelector('.world-map-poi-description')!;
    this.bind();
  }

  /** Run state is supplied by simulation; chart persistence contains discoveries only. */
  setCampStateReader(reader: (id: string) => CampMapState) {
    this.campStateReader = reader; this.render();
  }
  private isCampCleared(poi: MapPOI): boolean { return poi.kind === 'camp' && this.campStateReader(poi.id) === 'cleared'; }
  private poiLabel(poi: MapPOI): string { const state = this.eventStateReader(poi); if (poi.sighted) return `${POI_DEFINITIONS[poi.kind].label} · Sighted`; if (state) return `${POI_DEFINITIONS[poi.kind].label} · ${state}`; return this.isCampCleared(poi) ? 'Camp · Cleared' : POI_DEFINITIONS[poi.kind].label; }

  get isOpen() { return this.opened; }
  open(player: MapPlayer) {
    if (this.disposed || this.opened) return;
    this.player = { ...player }; this.exploration.reveal(player.x, player.y);
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.opened = true; this.element.hidden = false;
    this.view.centerX = clampMapCoordinate(player.x); this.view.centerY = clampMapCoordinate(player.y);
    this.resize(); this.canvas.focus({ preventScroll: true });
  }
  close() {
    if (!this.opened) return;
    if (this.drag && this.canvas.hasPointerCapture(this.drag.id)) this.canvas.releasePointerCapture(this.drag.id);
    if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0;
    this.chartLayer = undefined; this.visiblePOIs = [];
    this.opened = false; this.element.hidden = true; this.drag = null; this.pointer = null;
    this.canvas.classList.remove('world-map-dragging'); this.hideTooltip(); this.exploration.save();
    if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
  }
  update(player: MapPlayer, _dt: number) {
    if (this.disposed || ![player.x, player.y].every(Number.isFinite)) return;
    this.player = { ...player };
    this.exploration.reveal(player.x, player.y);
    const previous = this.presentation;
    if (this.opened && (!previous || previous.x !== player.x || previous.y !== player.y
      || previous.angle !== player.angle || previous.revision !== this.exploration.revision
      || previous.status !== this.exploration.storageStatus || previous.message !== this.exploration.persistenceMessage)) this.render();
  }
  resize() {
    if (!this.opened || this.disposed) return;
    const rect = this.viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.view.width = rect.width; this.view.height = rect.height;
    this.ratio = Math.max(1, Math.min(4, window.devicePixelRatio || 1));
    this.canvas.width = Math.round(rect.width * this.ratio); this.canvas.height = Math.round(rect.height * this.ratio);
    this.render();
  }
  /** Frame any charted region without changing discoveries, player state or saved data. */
  fitBounds(region: MapRect, padding = 40) {
    this.view = fitMapBounds(this.view, region, padding); this.render();
  }
  get viewBounds(): MapRect { return bounds(this.view); }
  get terrainCacheSize(): number { return this.tiles.size; }
  getCanvas(): HTMLCanvasElement { return this.canvas; }
  setMinimapPointer(point: { x: number; y: number } | null) { this.minimapPointer = point; }

  private bind() {
    const signal = this.abort.signal;
    this.element.querySelector('.world-map-close')!.addEventListener('click', () => { this.close(); this.onClose(); }, { signal });
    for (const button of this.element.querySelectorAll<HTMLButtonElement>('[data-map]')) {
      button.addEventListener('click', () => {
        if (button.dataset.map === 'center') {
          this.view.centerX = clampMapCoordinate(this.player.x); this.view.centerY = clampMapCoordinate(this.player.y);
        }
        else this.view = zoomMapAt(this.view, this.view.width / 2, this.view.height / 2,
          this.view.zoom * (button.dataset.map === 'in' ? 1.3 : 1 / 1.3));
        this.invalidate();
      }, { signal });
    }
    const local = (event: PointerEvent | WheelEvent) => { const r = this.canvas.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; };
    this.canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault(); const p = local(event); this.canvas.focus(); this.canvas.setPointerCapture(event.pointerId);
      this.drag = { id: event.pointerId, ...p, centerX: this.view.centerX, centerY: this.view.centerY };
      this.canvas.classList.add('world-map-dragging'); this.hideTooltip();
    }, { signal });
    this.canvas.addEventListener('pointermove', event => {
      const p = local(event); this.pointer = p;
      if (this.drag && event.pointerId === this.drag.id) {
        this.view.centerX = clampMapCoordinate(this.drag.centerX - (p.x - this.drag.x) / this.view.zoom);
        this.view.centerY = clampMapCoordinate(this.drag.centerY - (p.y - this.drag.y) / this.view.zoom);
      }
      this.invalidate(!!this.drag);
    }, { signal });
    const release = () => { this.drag = null; this.canvas.classList.remove('world-map-dragging'); this.invalidate(false); };
    this.canvas.addEventListener('pointerup', release, { signal });
    this.canvas.addEventListener('pointercancel', release, { signal });
    this.canvas.addEventListener('lostpointercapture', release, { signal });
    this.canvas.addEventListener('pointerleave', () => { if (!this.drag) { this.pointer = null; this.hideTooltip(); this.invalidate(false); } }, { signal });
    this.canvas.addEventListener('wheel', event => {
      event.preventDefault(); const p = local(event);
      const delta = Math.max(-240, Math.min(240, event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.view.height : 1)));
      this.view = zoomMapAt(this.view, p.x, p.y, this.view.zoom * Math.exp(-delta * .0016)); this.invalidate();
    }, { signal, passive: false });
    this.element.addEventListener('keydown', event => {
      // Escape/M remain owned by the game's phase/input coordinator.
      if (event.key === 'Tab') {
        const controls = [...this.element.querySelectorAll<HTMLElement>('button, canvas[tabindex]')];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        return;
      }
      if (event.target !== this.canvas) return;
      const pan = 70 / this.view.zoom;
      if (event.key === 'ArrowLeft') this.view.centerX -= pan;
      else if (event.key === 'ArrowRight') this.view.centerX += pan;
      else if (event.key === 'ArrowUp') this.view.centerY -= pan;
      else if (event.key === 'ArrowDown') this.view.centerY += pan;
      else if (event.key === 'Home') { this.view.centerX = this.player.x; this.view.centerY = this.player.y; }
      else if (event.key === '+' || event.key === '=' || event.key === '-') this.view = zoomMapAt(this.view,
        this.view.width / 2, this.view.height / 2, this.view.zoom * (event.key === '-' ? 1 / 1.3 : 1.3));
      else return;
      this.view.centerX = clampMapCoordinate(this.view.centerX);
      this.view.centerY = clampMapCoordinate(this.view.centerY);
      event.preventDefault(); event.stopPropagation(); this.invalidate();
    }, { signal });
  }

  private tile(tx: number, ty: number, size: number, detailed = false): TerrainTile | null {
    const ox = tx * size, oy = ty * size, pixels = detailed ? 128 : TILE_PIXELS, sampleSize = size / pixels;
    let revision = 0;
    for (let cy = Math.floor(oy / EXPLORATION_CHUNK_SIZE); cy < Math.ceil((oy + size) / EXPLORATION_CHUNK_SIZE); cy++)
      for (let cx = Math.floor(ox / EXPLORATION_CHUNK_SIZE); cx < Math.ceil((ox + size) / EXPLORATION_CHUNK_SIZE); cx++)
        revision += this.exploration.getChunkRevision(cx * EXPLORATION_CHUNK_SIZE, cy * EXPLORATION_CHUNK_SIZE);
    if (!revision) return null;
    const id = `${detailed ? 'atlas' : 'mini'}:${size}:${tx}:${ty}`;
    let tile = this.tiles.get(id);
    const building = !tile?.decorated, started = performance.now();
    // Charge generation only: cached painting/label work must not starve unfinished edge tiles.
    const deadline = detailed && this.buildBudget !== undefined ? started + this.buildBudget : Infinity;
    if (!tile) {
      if (performance.now() >= deadline) { this.pendingTerrain = true; return null; }
      const base = document.createElement('canvas'), charted = document.createElement('canvas');
      base.width = base.height = charted.width = charted.height = pixels;
      tile = { base, charted, roads: null, chartedRoads: null, revision: -1, nextRow: 0, decorated: false };
      this.tiles.set(id, tile);
    } else { this.tiles.delete(id); this.tiles.set(id, tile); }
    if (!tile.decorated) {
      const c = tile.base.getContext('2d')!;
      const samples = detailed ? (size <= 3072 ? 64 : 128) : TILE_PIXELS, step = size / samples, pixelStep = pixels / samples;
      let changed = false;
      while (tile.nextRow < samples && performance.now() < deadline) {
        const y = tile.nextRow++;
        for (let x = 0; x < samples; x++) {
          const wx = ox + (x + .5) * step, wy = oy + (y + .5) * step;
          c.fillStyle = detailed && this.world.atlasColor ? this.world.atlasColor(wx, wy) : this.world.mapColor(wx, wy, step);
          c.fillRect(x * pixelStep, y * pixelStep, pixelStep, pixelStep);
        }
        changed = true;
      }
      if (tile.nextRow === samples && performance.now() < deadline) {
        if (detailed && size <= 3072 && this.world.getProps)
          drawMapProps(c, this.world.getProps(ox - 160, oy - 160, size + 320, size + 320), ox, oy, size, pixels);
        if (detailed) c.drawImage(createMapRoadLayer(ox, oy, size, this.world.seed), 0, 0);
        tile.roads = !detailed && sampleSize > 48 ? createMapRoadLayer(ox, oy, size, this.world.seed) : null;
        tile.chartedRoads = tile.roads ? document.createElement('canvas') : null;
        if (tile.chartedRoads) tile.chartedRoads.width = tile.chartedRoads.height = 128;
        tile.decorated = true; tile.readyAt = Number.isFinite(deadline) ? performance.now() : undefined; changed = true;
      } else this.pendingTerrain = true;
      if (changed) tile.revision = -1;
    }
    if (tile.decorated && tile.revision !== revision) {
      const c = tile.charted.getContext('2d')!;
      // One copy per contiguous revealed row run, retaining the exact fine-cell mask.
      maskMapTile(c, tile.base, this.exploration, ox, oy, size, pixels);
      if (tile.roads && tile.chartedRoads) {
        const roads = tile.chartedRoads.getContext('2d')!;
        roads.globalCompositeOperation = 'source-over'; roads.clearRect(0, 0, 128, 128);
        roads.drawImage(tile.roads, 0, 0); roads.imageSmoothingEnabled = false;
        // The same conservative exploration mask clips terrain and fine road strokes.
        roads.globalCompositeOperation = 'destination-in'; roads.drawImage(tile.charted, 0, 0, 128, 128);
        roads.globalCompositeOperation = 'source-over';
      }
      tile.revision = revision;
    }
    if (building && detailed && this.buildBudget !== undefined)
      this.buildBudget = Math.max(0, this.buildBudget - (performance.now() - started));
    if (this.tiles.size > TERRAIN_CACHE_LIMIT) this.tiles.delete(this.tiles.keys().next().value!);
    return tile;
  }

  /** Cheap, complete overview under unfinished detail; its own fog mask never exposes unknown cells. */
  private previewTile(tx: number, ty: number, size: number): HTMLCanvasElement | null {
    const ox = tx * size, oy = ty * size;
    let revision = 0;
    for (let cy = Math.floor(oy / EXPLORATION_CHUNK_SIZE); cy < Math.ceil((oy + size) / EXPLORATION_CHUNK_SIZE); cy++)
      for (let cx = Math.floor(ox / EXPLORATION_CHUNK_SIZE); cx < Math.ceil((ox + size) / EXPLORATION_CHUNK_SIZE); cx++)
        revision += this.exploration.getChunkRevision(cx * EXPLORATION_CHUNK_SIZE, cy * EXPLORATION_CHUNK_SIZE);
    if (!revision) return null;
    const cache = this.previewTiles ??= new Map<string, PreviewTile>(), key = `${size}:${tx}:${ty}`;
    let tile = cache.get(key);
    if (!tile) {
      // Padded samples interpolate continuously through tile edges.
      const coarse = document.createElement('canvas'); coarse.width = coarse.height = 10;
      const samples = coarse.getContext('2d')!, step = size / 8;
      for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
        samples.fillStyle = this.world.mapColor(ox + (x - .5) * step, oy + (y - .5) * step, Math.max(96, step));
        samples.fillRect(x, y, 1, 1);
      }
      const base = document.createElement('canvas'), charted = document.createElement('canvas');
      base.width = base.height = charted.width = charted.height = 32;
      const c = base.getContext('2d')!; c.imageSmoothingEnabled = true;
      c.drawImage(coarse, 1, 1, 8, 8, 0, 0, 32, 32);
      tile = { base, charted, revision: -1 };
    } else cache.delete(key);
    cache.set(key, tile);
    if (tile.revision !== revision) {
      maskMapTile(tile.charted.getContext('2d')!, tile.base, this.exploration, ox, oy, size, 32);
      tile.revision = revision;
    }
    if (cache.size > TERRAIN_CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    return tile.charted;
  }

  private features(view: MapView, mini: boolean): { pois: MapPOI[]; labels: MapRegionLabel[]; zones: ZoneProgression[] } {
    const pois = selectMapPOIs([...this.exploration.getDiscoveredPOIs(bounds(view))
      .filter(poi => poi.sighted || this.exploration.isRevealed(poi.x, poi.y)), ...this.portalMarkers()], view, mini);
    const labels = mini || this.zoneLevels ? [] : mapRegionLabels(this.world, this.exploration, view, [...pois.filter(poi => poi.kind === 'town'), this.player]);
    const zones = mini || !this.zoneLevels ? [] : mapZoneLabels(view, this.exploration, this.world.seed, pois.filter(p => p.kind === 'town'));
    return { labels, zones, pois: pois.filter(poi => !zones.some(z => Math.abs((z.x-poi.x)*view.zoom)<82 && Math.abs((z.y-poi.y)*view.zoom)<28)).filter(poi => poi.kind === 'portal' || poi.kind === 'town' || !labels.some(label => {
      const dx = Math.abs((poi.x - label.x) * view.zoom), dy = (poi.y - label.y) * view.zoom;
      return dx < label.name.length * 3.4 + 8 && dy > -9 && dy < 27;
    })) };
  }

  private chart(c: CanvasRenderingContext2D, view: MapView, mini: boolean,
    features = this.features(view, mini)) {
    const region = bounds(view), tileSize = mini ? MAP_TERRAIN_RULES.baseWorldSize : mapTerrainSize(view.zoom, view.width, view.height);
    c.save(); c.beginPath(); c.rect(view.x, view.y, view.width, view.height); c.clip();
    c.fillStyle = palette.ink; c.fillRect(view.x, view.y, view.width, view.height);
    c.imageSmoothingEnabled = false;
    const transform = c.getTransform();
    const bleed = 1 / Math.max(.1, Math.hypot(transform.a, transform.b));
    const roadTiles: Array<{ tile: TerrainTile; x: number; y: number }> = [];
    const visibleTiles: Array<{ tx: number; ty: number }> = [];
    for (let ty = Math.floor(region.y / tileSize); ty <= Math.floor((region.y + region.height) / tileSize); ty++)
      for (let tx = Math.floor(region.x / tileSize); tx <= Math.floor((region.x + region.width) / tileSize); tx++) visibleTiles.push({ tx, ty });
    if (!mini) visibleTiles.sort((a, b) =>
      Math.hypot((a.tx + .5) * tileSize - view.centerX, (a.ty + .5) * tileSize - view.centerY)
      - Math.hypot((b.tx + .5) * tileSize - view.centerX, (b.ty + .5) * tileSize - view.centerY));
    const now = performance.now(), reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const layers = visibleTiles.map(({ tx, ty }) => {
      const tile = this.tile(tx, ty, tileSize, !mini);
      const blend = !tile?.decorated ? 0 : mini || tile.readyAt === undefined || this.buildBudget === undefined ? 1 : mapTileBlend(tile.readyAt, now, reducedMotion);
      if (tile?.decorated && blend < 1) this.pendingTerrain = true;
      return { tx, ty, tile, blend };
    });
    // Populate every revealed low-resolution tile in this frame, before refining the center outward.
    if (!mini && this.pendingTerrain) for (const { tx, ty } of visibleTiles) {
      const preview = this.previewTile(tx, ty, tileSize); if (!preview) continue;
      const p = projectMapPoint(tx * tileSize, ty * tileSize, view);
      c.drawImage(preview, p.x, p.y, tileSize * view.zoom + bleed, tileSize * view.zoom + bleed);
    }
    for (const { tx, ty, tile, blend } of layers) {
      if (!tile || !blend) continue;
      const p = projectMapPoint(tx * tileSize, ty * tileSize, view);
      c.globalAlpha = blend;
      c.drawImage(tile.charted, p.x, p.y, tileSize * view.zoom + bleed, tileSize * view.zoom + bleed);
      if (tile.chartedRoads) roadTiles.push({ tile, x: p.x, y: p.y });
    }
    c.globalAlpha = 1;
    c.imageSmoothingEnabled = true;
    for (const road of roadTiles) c.drawImage(road.tile.chartedRoads!, road.x, road.y, tileSize * view.zoom, tileSize * view.zoom);
    c.imageSmoothingEnabled = false;
    for (const building of view.zoom < .065 ? [] : this.world.getBuildings(region.x, region.y, region.width, region.height)) {
      const { x, y, width, height } = building;
      if (!this.exploration.isRevealed(x, y) || !this.exploration.isRevealed(x + width, y)
        || !this.exploration.isRevealed(x, y + height) || !this.exploration.isRevealed(x + width, y + height)) continue;
      const p = projectMapPoint(x, y, view), w = width * view.zoom, h = height * view.zoom;
      if (!mini && !isMapSampleRevealed(this.exploration, x, y, Math.max(width, height))) continue;
      if (!mini) { drawMapBuilding(c, p.x, p.y, Math.max(1, w), Math.max(1, h), building.kind); continue; }
      c.fillStyle = '#111a1d'; c.fillRect(p.x + 1, p.y + 1, w, h);
      c.fillStyle = '#897951'; c.fillRect(p.x, p.y, Math.max(1, w), Math.max(1, h));
      if (w > 6 && h > 6) { c.strokeStyle = '#c4ae78'; c.lineWidth = .8; c.strokeRect(p.x + .5, p.y + .5, w - 1, h - 1);
        c.strokeStyle = '#454a37'; c.beginPath(); c.moveTo(p.x + w / 2, p.y + 2); c.lineTo(p.x + w / 2, p.y + h - 2); c.stroke(); }
    }
    const { pois, labels } = features;
    if (!mini && this.zoneLevels) drawMapZoneLevels(c, view, this.exploration, this.world.seed, features.zones);
    for (const label of labels) {
      const p = projectMapPoint(label.x, label.y, view), biome = BIOMES[label.id as BiomeId];
      const labelColor = biome?.color ?? palette.jade;
      c.save(); c.globalAlpha = .84;
      c.strokeStyle = `${labelColor}99`; c.lineWidth = .8;
      c.beginPath(); c.moveTo(p.x - 25, p.y + 19); c.lineTo(p.x - 5, p.y + 19); c.moveTo(p.x + 5, p.y + 19); c.lineTo(p.x + 25, p.y + 19); c.stroke();
      c.fillStyle = labelColor; c.fillRect(p.x - 1, p.y + 18, 2, 2);
      text(c, label.name, p.x + 1, p.y + 1, 1.14, palette.ink, 'center');
      text(c, label.name, p.x, p.y, 1.14, palette.ivory, 'center'); c.restore();
    }
    for (const poi of pois) {
      if (poi.kind !== 'portal' && !poi.sighted && !this.exploration.isRevealed(poi.x, poi.y)) continue;
      const p = projectMapPoint(poi.x, poi.y, view);
      this.poiIcon(c, poi, p.x, p.y, mini ? 4.1 : view.zoom < .07 ? 5.4 : 7, this.hovered?.id === poi.id && !mini);
      if (!mini && poi.kind === 'town' && (view.zoom >= .045 || this.zoneLevels)) {
        text(c, poi.name, p.x + 1, p.y + 13, 1.15, palette.ink, 'center');
        text(c, poi.name, p.x, p.y + 12, 1.15, palette.ivory, 'center');
      }
    }
    drawJourneyMapMarker(c,view,this.journeyMarker,mini);
    c.restore();
    return pois;
  }

  private poiIcon(c: CanvasRenderingContext2D, poi: MapPOI, x: number, y: number, size: number, selected: boolean) {
    c.save(); c.translate(x, y); c.lineWidth = selected ? 1.8 : 1.1;
    const cleared = this.isCampCleared(poi) || ['Claimed', 'Beacon lit'].includes(this.eventStateReader(poi) ?? '');
    c.fillStyle = palette.well; c.strokeStyle = selected ? palette.ivory : cleared ? palette.jade : POI_DEFINITIONS[poi.kind].color;
    c.beginPath(); c.arc(0, 0, size + 2.5, 0, Math.PI * 2); c.fill(); if (selected) c.stroke();
    c.beginPath();
    if (poi.kind === 'portal') {
      c.ellipse(0, -1, size * .7, size, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.ellipse(0, size, size, size * .35, 0, 0, Math.PI * 2); c.stroke();
    } else if (poi.kind === 'town' || poi.kind === 'inn') {
      c.moveTo(-size, 0); c.lineTo(0, -size); c.lineTo(size, 0); c.lineTo(size * .7, 0); c.lineTo(size * .7, size); c.lineTo(-size * .7, size); c.lineTo(-size * .7, 0); c.closePath(); c.stroke();
    } else if (poi.kind === 'jeweler') {
      c.moveTo(0, -size); c.lineTo(size, 0); c.lineTo(0, size); c.lineTo(-size, 0); c.closePath(); c.stroke();
    } else if (poi.kind === 'enchanter') {
      c.arc(0, 0, size, 0, Math.PI * 2); c.moveTo(0, -size); c.lineTo(0, size); c.moveTo(-size, 0); c.lineTo(size, 0); c.stroke();
    } else if (poi.kind === 'chapel') {
      c.moveTo(0, -size); c.lineTo(0, size); c.moveTo(-size * .65, -size * .3); c.lineTo(size * .65, -size * .3); c.stroke();
    } else if (poi.kind === 'blacksmith') {
      c.moveTo(-size, -size * .7); c.lineTo(size * .6, size * .6); c.moveTo(-size * .6, -size); c.lineTo(-size, -size * .4); c.moveTo(-size * .7, size); c.lineTo(size * .7, -size * .5); c.stroke();
    } else if (poi.kind === 'shrine') {
      c.moveTo(0, -size); c.lineTo(size * .3, -size * .3); c.lineTo(size, 0); c.lineTo(size * .3, size * .3); c.lineTo(0, size); c.lineTo(-size * .3, size * .3); c.lineTo(-size, 0); c.lineTo(-size * .3, -size * .3); c.closePath(); c.stroke();
    } else if (poi.kind === 'camp') {
      c.moveTo(-size, size * .8); c.lineTo(0, -size); c.lineTo(size, size * .8); c.closePath();
      c.moveTo(0, -size); c.lineTo(0, size * .8); c.moveTo(-size * .5, -size); c.lineTo(size * .4, size * .8); c.stroke();
      if (cleared) { c.beginPath(); c.moveTo(size * .35, size * .45); c.lineTo(size * .85, size * .9); c.lineTo(size * 1.45, 0); c.lineWidth = 1.6; c.stroke(); }
    } else if (poi.kind === 'watchtower') {
      c.moveTo(-size * .7, size); c.lineTo(-size * .7, -size); c.lineTo(-size * .25, -size * .5); c.lineTo(size * .1, -size); c.lineTo(size * .7, -size * .65); c.lineTo(size * .7, size); c.closePath();
      c.moveTo(0, size * .5); c.lineTo(0, -size * .2); c.stroke();
    } else if (poi.kind === 'graveyard') {
      c.moveTo(-size * .7, size); c.lineTo(-size * .7, -size * .35); c.quadraticCurveTo(0, -size * 1.4, size * .7, -size * .35); c.lineTo(size * .7, size); c.closePath();
      c.moveTo(0, -size * .4); c.lineTo(0, size * .5); c.moveTo(-size * .3, 0); c.lineTo(size * .3, 0); c.stroke();
    } else if (poi.kind === 'standingStones') {
      c.moveTo(-size, size * .6); c.lineTo(-size * .8, -size * .55); c.lineTo(-size * .4, -size * .7); c.lineTo(-size * .25, size * .6); c.closePath();
      c.moveTo(size * .2, size * .6); c.lineTo(size * .3, -size); c.lineTo(size * .75, -size * .8); c.lineTo(size, size * .6); c.closePath(); c.stroke();
    } else if (poi.kind === 'caravan') {
      c.rect(-size, -size * .75, size * 2, size * 1.2); c.moveTo(-size, -size * .2); c.lineTo(size, -size * .2); c.stroke();
      c.beginPath(); c.arc(-size * .55, size * .7, size * .24, 0, Math.PI * 2); c.moveTo(size * .79, size * .7); c.arc(size * .55, size * .7, size * .24, 0, Math.PI * 2); c.stroke();
    } else if (poi.kind === 'merchant') {
      c.ellipse(0, 0, size * .7, size, 0, 0, Math.PI * 2); c.moveTo(-size * .7, 0); c.lineTo(size * .7, 0); c.stroke();
    } else {
      c.moveTo(-size, size * .6); c.lineTo(-size * .2, -size); c.lineTo(size * .3, 0); c.lineTo(size * .6, -size * .4); c.lineTo(size, size * .6); c.closePath(); c.stroke();
    }
    c.restore();
  }

  private playerArrow(c: CanvasRenderingContext2D, player: MapPlayer, view: MapView, mini: boolean) {
    const p = projectMapPoint(player.x, player.y, view);
    if (p.x < view.x || p.y < view.y || p.x > view.x + view.width || p.y > view.y + view.height) return;
    c.save(); c.translate(p.x, p.y);
    c.strokeStyle = '#e3d39433'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, mini ? 17 : 14, 0, Math.PI * 2); c.stroke();
    c.rotate(player.angle);
    const r = mini ? 5 : 7;
    c.beginPath(); c.moveTo(r + 2, 0); c.lineTo(-r, -r * .75); c.lineTo(-r * .5, 0); c.lineTo(-r, r * .75); c.closePath();
    c.fillStyle = '#fff2ba'; c.fill(); c.strokeStyle = '#1b261f'; c.lineWidth = 1.3; c.stroke(); c.restore();
  }

  private location(player: MapPlayer) {
    const building = this.world.getBuildingAt?.(player.x, player.y);
    if (building?.name) return building.name;
    if (this.world.isSanctuary?.(player.x, player.y)) {
      const towns = this.exploration.getDiscoveredPOIs({ x: player.x - 900, y: player.y - 900, width: 1800, height: 1800 }).filter(p => p.kind === 'town');
      towns.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
      if (towns[0]) return towns[0].name;
    }
    return this.world.sampleBiome(player.x, player.y).name;
  }

  drawMinimap(c: CanvasRenderingContext2D, player: MapPlayer, width: number, height: number, _time: number,
    enemies: readonly MinimapEnemy[] = []) {
    const r = getMinimapRect(width, height);
    const view: MapView = { x: r.x + 6, y: r.y + 25, width: r.width - 12, height: r.height - 48,
      centerX: player.x, centerY: player.y, zoom: .05 };
    const active = this.minimapPointer && this.minimapPointer.x >= r.x && this.minimapPointer.y >= r.y
      && this.minimapPointer.x < r.x + r.width && this.minimapPointer.y < r.y + r.height;
    c.save();
    const bg = c.createLinearGradient(r.x, r.y, r.x, r.y + r.height);
    bg.addColorStop(0, `${palette.panelRaised}f5`); bg.addColorStop(1, `${palette.panel}f5`);
    c.fillStyle = '#00000040'; c.fillRect(r.x + 2, r.y + 4, r.width, r.height);
    c.fillStyle = bg; c.fillRect(r.x, r.y, r.width, r.height);
    c.strokeStyle = `${palette.silverDim}${active?'cc':'70'}`; c.lineWidth = 1;
    c.strokeRect(r.x + .5, r.y + .5, r.width - 1, r.height - 1);
    c.strokeStyle = `${palette.silver}25`; c.beginPath();
    c.moveTo(r.x + 7,r.y + .5); c.lineTo(r.x + 25,r.y + .5);
    c.moveTo(r.x + r.width - 25,r.y + .5); c.lineTo(r.x + r.width - 7,r.y + .5); c.stroke();
    // A folded chart mark shares the fine-line style of the native menu icons.
    c.strokeStyle = palette.silverDim; c.beginPath();
    c.moveTo(r.x + 10, r.y + 9); c.lineTo(r.x + 14, r.y + 7); c.lineTo(r.x + 18, r.y + 9);
    c.lineTo(r.x + 22, r.y + 7); c.lineTo(r.x + 22, r.y + 17); c.lineTo(r.x + 18, r.y + 19);
    c.lineTo(r.x + 14, r.y + 17); c.lineTo(r.x + 10, r.y + 19); c.closePath();
    c.moveTo(r.x + 14, r.y + 7); c.lineTo(r.x + 14, r.y + 17);
    c.moveTo(r.x + 18, r.y + 9); c.lineTo(r.x + 18, r.y + 19); c.stroke();
    const area = mapAreaLabel(this.world, player.x, player.y);
    text(c, area, r.x + 29, r.y + 10, .85, area === 'Sanctuary' ? palette.jade : palette.ivory);
    c.fillStyle = palette.well; c.fillRect(r.x + r.width - 25, r.y + 6, 16, 15);
    c.strokeStyle = palette.line; c.strokeRect(r.x + r.width - 24.5, r.y + 6.5, 15, 14);
    text(c, 'M', r.x + r.width - 17, r.y + 10, .86, palette.muted, 'center');
    const pois = this.chart(c, view, true);
    c.strokeStyle = `${palette.silverDim}40`; c.strokeRect(view.x - .5, view.y - .5, view.width + 1, view.height + 1);
    const center = projectMapPoint(player.x, player.y, view);
    c.save(); c.beginPath(); c.rect(view.x, view.y, view.width, view.height); c.clip();
    c.setLineDash([2, 4]); c.strokeStyle = '#c5d5b127'; c.lineWidth = .8;
    c.beginPath(); c.arc(center.x, center.y, EXPLORATION_REVEAL_RADIUS * view.zoom, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    for (const enemy of enemies) {
      if (!this.exploration.isRevealed(enemy.x, enemy.y)) continue;
      const p = projectMapPoint(enemy.x, enemy.y, view);
      if (p.x < view.x || p.y < view.y || p.x > view.x + view.width || p.y > view.y + view.height) continue;
      c.fillStyle = enemy.kind === 'brute' ? '#d18a62' : enemy.kind === 'caster' ? '#d4a677' : '#b26a62';
      c.strokeStyle = '#070d12'; c.lineWidth = .7;
      c.beginPath(); c.arc(p.x, p.y, enemy.kind === 'brute' ? 1.9 : 1.4, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    this.playerArrow(c, player, view, true); c.restore();
    text(c, 'N', view.x + view.width / 2, view.y + 3, .8, palette.jade, 'center');
    const name = this.location(player);
    c.save(); c.beginPath(); c.rect(r.x + 6, r.y + r.height - 19, r.width - 12, 15); c.clip();
    text(c, name, r.x + r.width / 2, r.y + r.height - 15, .95, palette.text, 'center'); c.restore();
    if (this.minimapPointer) {
      const poi = pickMapPOI(pois.filter(p => p.kind === 'portal' || p.sighted || this.exploration.isRevealed(p.x, p.y)), view, this.minimapPointer, 8);
      if (poi) {
        const boxWidth = Math.min(190, width - 24), bx = Math.max(12, r.x - boxWidth - 9), by = r.y + 30;
        c.fillStyle = `${palette.panel}fa`; c.fillRect(bx, by, boxWidth, 48);
        c.strokeStyle = palette.lineStrong; c.strokeRect(bx + .5, by + .5, boxWidth - 1, 47);
        c.fillStyle = POI_DEFINITIONS[poi.kind].color; c.fillRect(bx + 1, by + 9, 2, 29);
        c.save(); c.beginPath(); c.rect(bx + 10, by + 6, boxWidth - 20, 36); c.clip();
        text(c, `${this.poiLabel(poi)} · ${mapAreaLabel(this.world, poi.x, poi.y)}`, bx + 11, by + 9, .75, palette.jade);
        text(c, poi.name, bx + 11, by + 26, 1.1, palette.ivory); c.restore();
      }
    }
    c.restore();
  }

  /** Pointer bursts commit once per display frame; hover never regenerates the chart. */
  private invalidate(chart = true) {
    this.chartDirty ||= chart;
    if (!this.opened || this.disposed || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.chartDirty) this.render(); else this.drawHover();
    });
  }

  private render() {
    if (!this.opened || this.disposed) return;
    if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0;
    this.chartDirty = false; this.pendingTerrain = false;
    this.buildBudget = 5;
    try { this.drawChart(); } finally { this.buildBudget = undefined; }
    if (this.pendingTerrain) this.invalidate();
    this.presentation = { x: this.player.x, y: this.player.y, angle: this.player.angle,
      revision: this.exploration.revision, status: this.exploration.storageStatus,
      message: this.exploration.persistenceMessage };
  }

  private drawChart() {
    const c = this.context;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0); c.clearRect(0, 0, this.view.width, this.view.height);
    this.hovered = null; this.chartLayerValid = false;
    const features = this.features(this.view, false);
    this.visiblePOIs = features.pois;
    this.chart(c, this.view, false, features);
    const grid = this.view.zoom < .065 ? 3200 : 1536, first = unprojectMapPoint(0, 0, this.view);
    c.save(); c.strokeStyle = '#bfbe9710'; c.lineWidth = .65;
    for (let wx = Math.ceil(first.x / grid) * grid; wx < first.x + this.view.width / this.view.zoom; wx += grid) {
      const p = projectMapPoint(wx, 0, this.view); c.beginPath(); c.moveTo(p.x, 0); c.lineTo(p.x, this.view.height); c.stroke();
    }
    for (let wy = Math.ceil(first.y / grid) * grid; wy < first.y + this.view.height / this.view.zoom; wy += grid) {
      const p = projectMapPoint(0, wy, this.view); c.beginPath(); c.moveTo(0, p.y); c.lineTo(this.view.width, p.y); c.stroke();
    }
    c.restore();
    this.playerArrow(c, this.player, this.view, false);
    const scale = this.view.zoom < .06 ? 2000 : this.view.zoom < .16 ? 1000 : 250;
    const scaleWidth = scale * this.view.zoom;
    c.strokeStyle = `${palette.ivory}75`; c.lineWidth = 1;
    c.beginPath(); c.moveTo(24, this.view.height - 25); c.lineTo(24, this.view.height - 21);
    c.lineTo(24 + scaleWidth, this.view.height - 21); c.lineTo(24 + scaleWidth, this.view.height - 25); c.stroke();
    text(c, formatWorldDistance(scale), 24, this.view.height - 39, .9, palette.muted);

    text(c, 'N', this.view.width - 27, 16, 1.15, palette.brass, 'center');
    c.strokeStyle = '#a8af9566'; c.beginPath(); c.moveTo(this.view.width - 27, 34); c.lineTo(this.view.width - 27, 54); c.moveTo(this.view.width - 32, 40); c.lineTo(this.view.width - 27, 34); c.lineTo(this.view.width - 22, 40); c.stroke();
    const count = this.exploration.discoveredPOICount;
    setText(this.discoveries, `${count} ${count === 1 ? 'place' : 'places'} charted`);
    const area = mapAreaLabel(this.world, this.player.x, this.player.y);
    setText(this.status, `${area} · ${this.exploration.persistenceMessage || (this.exploration.storageStatus === 'pending' ? 'Charting…' : 'Chart saved')}`);
    this.status.dataset.state = this.exploration.storageStatus;
    setText(this.coordinates, `X ${Math.round(this.player.x)} · Y ${Math.round(this.player.y)}`);
    this.drawHover();
  }

  private drawHover() {
    const previous = this.hovered;
    this.hovered = this.pointer && !this.drag ? pickMapPOI(this.visiblePOIs, this.view, this.pointer, 14) : null;
    if (previous?.id !== this.hovered?.id) {
      const c = this.context;
      if (!this.chartLayerValid) {
        const layer = this.chartLayer ??= document.createElement('canvas');
        if (layer.width !== this.canvas.width || layer.height !== this.canvas.height) {
          layer.width = this.canvas.width; layer.height = this.canvas.height;
        }
        const saved = layer.getContext('2d')!;
        saved.clearRect(0, 0, layer.width, layer.height); saved.drawImage(this.canvas, 0, 0);
        this.chartLayerValid = true;
      } else {
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.canvas.width, this.canvas.height);
        c.drawImage(this.chartLayer!, 0, 0);
      }
      c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      if (this.hovered) {
        const p = projectMapPoint(this.hovered.x, this.hovered.y, this.view);
        this.poiIcon(c, this.hovered, p.x, p.y, this.view.zoom < .07 ? 5.4 : 7, true);
      }
    }
    const marker=this.journeyMarker, markerPoint=marker?projectMapPoint(marker.x,marker.y,this.view):null;
    if(marker&&markerPoint&&this.pointer&&!this.drag&&Math.hypot(markerPoint.x-this.pointer.x,markerPoint.y-this.pointer.y)<15){
      this.tooltip.hidden=false;setText(this.tooltipName,marker.name);
      setText(this.tooltipKind,'Journey');setText(this.tooltipDescription,marker.known?'Tracked activity':'Explore this area to find the activity');
      this.tooltip.style.setProperty('--poi-color',palette.brass);this.positionTooltip(this.pointer);
    }
    else if (this.hovered && this.pointer) this.showTooltip(this.hovered, this.pointer);
    else if (this.pointer && !this.drag) {
      const point = unprojectMapPoint(this.pointer.x, this.pointer.y, this.view);
      const inspected = chartedMapArea(this.world, this.exploration, point.x, point.y);
      if (inspected) {
        this.tooltip.hidden = false; setText(this.tooltipName, inspected.name); setText(this.tooltipKind, inspected.label);
        setText(this.tooltipDescription, `X ${Math.round(inspected.x)} · Y ${Math.round(inspected.y)}`);
        this.tooltip.style.setProperty('--poi-color', palette.jade); this.positionTooltip(this.pointer);
      } else this.hideTooltip();
    } else this.hideTooltip();
  }

  private showTooltip(poi: MapPOI, point: { x: number; y: number }) {
    this.tooltip.hidden = false; setText(this.tooltipName, poi.name);
    setText(this.tooltipKind, `${this.poiLabel(poi)} · ${mapAreaLabel(this.world, poi.x, poi.y)}`); setText(this.tooltipDescription, this.eventStateReader(poi) ?? (this.isCampCleared(poi) ? 'The watchfire is quiet. All members of this garrison have been defeated for the current run.' : poi.description));
    this.tooltip.style.setProperty('--poi-color', POI_DEFINITIONS[poi.kind].color);
    this.positionTooltip(point);
  }
  private positionTooltip(point: { x: number; y: number }) {
    this.tooltip.style.left = `${Math.max(10, Math.min(this.view.width - this.tooltip.offsetWidth - 12, point.x + 18))}px`;
    this.tooltip.style.top = `${Math.max(10, Math.min(this.view.height - this.tooltip.offsetHeight - 12, point.y + 15))}px`;
  }
  private hideTooltip() { this.tooltip.hidden = true; }
  dispose() {
    if (this.disposed) return;
    this.close(); this.disposed = true; this.abort.abort(); this.tiles.clear(); this.previewTiles.clear(); this.element.remove(); this.exploration.save();
  }
}
