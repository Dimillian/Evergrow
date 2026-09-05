import { Exploration } from './exploration.ts';
import { clampMapCoordinate, getMinimapRect, projectMapPoint, unprojectMapPoint, zoomMapAt, type MapView } from './map-view.ts';
import { POI_DEFINITIONS } from './world-pois.ts';
export { getMinimapRect, projectMapPoint, unprojectMapPoint, zoomMapAt, type MapView } from './map-view.ts';
import type { ExplorationWorld, MapPOI, MapRect } from './exploration.ts';
import { text } from './font.ts';
import { uiIcon } from './ui-components.ts';
import { UI_THEME } from './ui-theme.ts';
import { getZoneAt } from './zone-progression.ts';

export interface MapPlayer { x: number; y: number; angle: number; }
export interface MinimapEnemy { x: number; y: number; kind?: string; }
export interface MapWorld extends ExplorationWorld {
  mapColor(x: number, y: number): string;
  sampleBiome(x: number, y: number): { id: string; name: string };
  getBuildings(x: number, y: number, width: number, height: number): Array<MapRect & { name?: string; kind?: string }>;
  getBuildingAt?(x: number, y: number): { name?: string } | null;
  isSanctuary?(x: number, y: number): boolean;
}
const TILE_WORLD = 768, TILE_PIXELS = 32, SAMPLE_SIZE = TILE_WORLD / TILE_PIXELS;
const TERRAIN_CACHE_LIMIT = 384;
interface TerrainTile { base: HTMLCanvasElement; charted: HTMLCanvasElement; revision: number; }
interface PresentationState {
  x: number; y: number; angle: number; revision: number; status: string; message: string;
}
const bounds = (view: MapView): MapRect => ({ x: view.centerX - view.width / view.zoom / 2,
  y: view.centerY - view.height / view.zoom / 2, width: view.width / view.zoom, height: view.height / view.zoom });
const setText = (element: HTMLElement, value: string) => { if (element.textContent !== value) element.textContent = value; };
const palette = UI_THEME.palette;

/** Revealed cells are the boundary for inspecting terrain and danger on the chart. */
export function chartedMapArea(world: Pick<MapWorld, 'sampleBiome' | 'isSanctuary'>,
  exploration: Pick<Exploration, 'isRevealed'>, x: number, y: number) {
  if (![x, y].every(Number.isFinite) || !exploration.isRevealed(x, y)) return null;
  return { name: world.sampleBiome(x, y).name, label: mapAreaLabel(world, x, y), x, y };
}

function mapAreaLabel(world: Pick<MapWorld, 'isSanctuary'>, x: number, y: number) {
  return world.isSanctuary?.(x, y) ? 'Sanctuary' : `Area Lv ${getZoneAt(x, y).level}`;
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

export type CampMapState = 'dormant' | 'active' | 'cleared';

/** A continuously translated chart built from cached world-space terrain and discovery tiles. */
export class WorldMap {
  readonly element: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private viewport: HTMLDivElement;
  private title: HTMLElement;
  private status: HTMLElement;
  private discoveries: HTMLElement;
  private coordinates: HTMLElement;
  private tooltip: HTMLDivElement;
  private tooltipName: HTMLElement;
  private tooltipKind: HTMLElement;
  private tooltipDescription: HTMLElement;
  private tiles = new Map<string, TerrainTile>();
  private abort = new AbortController();
  private opened = false;
  private player: MapPlayer = { x: 0, y: 0, angle: 0 };
  private view: MapView = { x: 0, y: 0, width: 800, height: 500, centerX: 0, centerY: 0, zoom: .17 };
  private pointer: { x: number; y: number } | null = null;
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
  private campStateReader: (id: string) => CampMapState = () => 'dormant';

  constructor(world: MapWorld, exploration: Exploration, mount: HTMLElement, onClose: () => void) {
    this.world = world; this.exploration = exploration; this.onClose = onClose;
    this.element = document.createElement('div');
    this.element.className = 'world-map-root'; this.element.hidden = true;
    this.element.innerHTML = `<section class="world-map-panel ui-window" role="dialog" aria-modal="true" aria-labelledby="world-map-title">
      <header class="world-map-header ui-window__header">
        <div class="world-map-heading"><span class="world-map-emblem" aria-hidden="true">${uiIcon('map')}</span>
          <div><p class="world-map-eyebrow ui-kicker">Charted lands</p><h2 class="ui-title" id="world-map-title">The wilderness</h2></div></div>
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
    this.title = this.element.querySelector('#world-map-title')!;
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
  private poiLabel(poi: MapPOI): string { return this.isCampCleared(poi) ? 'Camp · Cleared' : POI_DEFINITIONS[poi.kind].label; }

  get isOpen() { return this.opened; }
  open(player: MapPlayer) {
    if (this.disposed || this.opened) return;
    this.player = { ...player }; this.exploration.reveal(player.x, player.y);
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.opened = true; this.element.hidden = false;
    this.view.centerX = clampMapCoordinate(player.x); this.view.centerY = clampMapCoordinate(player.y);
    this.resize(); this.render(); this.canvas.focus({ preventScroll: true });
  }
  close() {
    if (!this.opened) return;
    if (this.drag && this.canvas.hasPointerCapture(this.drag.id)) this.canvas.releasePointerCapture(this.drag.id);
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
        this.render();
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
      this.render();
    }, { signal });
    const release = () => { this.drag = null; this.canvas.classList.remove('world-map-dragging'); };
    this.canvas.addEventListener('pointerup', release, { signal });
    this.canvas.addEventListener('pointercancel', release, { signal });
    this.canvas.addEventListener('lostpointercapture', release, { signal });
    this.canvas.addEventListener('pointerleave', () => { if (!this.drag) { this.pointer = null; this.hideTooltip(); } }, { signal });
    this.canvas.addEventListener('wheel', event => {
      event.preventDefault(); const p = local(event);
      this.view = zoomMapAt(this.view, p.x, p.y, this.view.zoom * Math.exp(-event.deltaY * .0016)); this.render();
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
      event.preventDefault(); event.stopPropagation(); this.render();
    }, { signal });
  }

  private tile(tx: number, ty: number): TerrainTile | null {
    const ox = tx * TILE_WORLD, oy = ty * TILE_WORLD;
    const revision = this.exploration.getChunkRevision(ox, oy);
    if (!revision) return null;
    let any = false;
    for (let y = 0; y < 16 && !any; y++) for (let x = 0; x < 16; x++) {
      if (this.exploration.isCellRevealed(tx * 16 + x, ty * 16 + y)) { any = true; break; }
    }
    if (!any) return null;
    const id = `${tx}:${ty}`;
    let tile = this.tiles.get(id);
    if (!tile) {
      const base = document.createElement('canvas'), charted = document.createElement('canvas');
      base.width = base.height = charted.width = charted.height = TILE_PIXELS;
      const c = base.getContext('2d')!;
      for (let y = 0; y < TILE_PIXELS; y++) for (let x = 0; x < TILE_PIXELS; x++) {
        c.fillStyle = this.world.mapColor(ox + (x + .5) * SAMPLE_SIZE, oy + (y + .5) * SAMPLE_SIZE); c.fillRect(x, y, 1, 1);
      }
      tile = { base, charted, revision: -1 }; this.tiles.set(id, tile);
    } else { this.tiles.delete(id); this.tiles.set(id, tile); }
    if (tile.revision !== revision) {
      const c = tile.charted.getContext('2d')!;
      c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, TILE_PIXELS, TILE_PIXELS);
      // Draw only known cells. Undiscovered pixels and nearby POIs never leak through.
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (this.exploration.isCellRevealed(tx * 16 + x, ty * 16 + y))
        c.drawImage(tile.base, x * 2, y * 2, 2, 2, x * 2, y * 2, 2, 2);
      tile.revision = revision;
    }
    if (this.tiles.size > TERRAIN_CACHE_LIMIT) this.tiles.delete(this.tiles.keys().next().value!);
    return tile;
  }

  private chart(c: CanvasRenderingContext2D, view: MapView, mini: boolean) {
    const region = bounds(view);
    c.save(); c.beginPath(); c.rect(view.x, view.y, view.width, view.height); c.clip();
    c.fillStyle = palette.ink; c.fillRect(view.x, view.y, view.width, view.height);
    c.imageSmoothingEnabled = false;
    const transform = c.getTransform();
    const bleed = 1 / Math.max(.1, Math.hypot(transform.a, transform.b));
    for (let ty = Math.floor(region.y / TILE_WORLD); ty <= Math.floor((region.y + region.height) / TILE_WORLD); ty++) {
      for (let tx = Math.floor(region.x / TILE_WORLD); tx <= Math.floor((region.x + region.width) / TILE_WORLD); tx++) {
        const tile = this.tile(tx, ty); if (!tile) continue;
        const p = projectMapPoint(tx * TILE_WORLD, ty * TILE_WORLD, view);
        // One backing-pixel overlap covers fractional drawImage edges while the
        // world-space projection itself remains continuous, never quantized.
        c.drawImage(tile.charted, p.x, p.y, TILE_WORLD * view.zoom + bleed, TILE_WORLD * view.zoom + bleed);
      }
    }
    for (const building of this.world.getBuildings(region.x, region.y, region.width, region.height)) {
      const { x, y, width, height } = building;
      if (!this.exploration.isRevealed(x, y) || !this.exploration.isRevealed(x + width, y)
        || !this.exploration.isRevealed(x, y + height) || !this.exploration.isRevealed(x + width, y + height)) continue;
      const p = projectMapPoint(x, y, view), w = width * view.zoom, h = height * view.zoom;
      c.fillStyle = '#111a1d'; c.fillRect(p.x + 1, p.y + 1, w, h);
      c.fillStyle = '#897951'; c.fillRect(p.x, p.y, Math.max(1, w), Math.max(1, h));
      if (w > 6 && h > 6) { c.strokeStyle = '#c4ae78'; c.lineWidth = .8; c.strokeRect(p.x + .5, p.y + .5, w - 1, h - 1);
        c.strokeStyle = '#454a37'; c.beginPath(); c.moveTo(p.x + w / 2, p.y + 2); c.lineTo(p.x + w / 2, p.y + h - 2); c.stroke(); }
    }
    const pois = this.exploration.getDiscoveredPOIs(region);
    for (const poi of pois) {
      if (!this.exploration.isRevealed(poi.x, poi.y)) continue;
      const p = projectMapPoint(poi.x, poi.y, view);
      this.poiIcon(c, poi, p.x, p.y, mini ? 4.1 : 7, this.hovered?.id === poi.id && !mini);
      if (!mini && poi.kind === 'town') {
        text(c, poi.name, p.x + 1, p.y + 13, 1.15, palette.ink, 'center');
        text(c, poi.name, p.x, p.y + 12, 1.15, palette.ivory, 'center');
      }
    }
    c.restore();
    return pois;
  }

  private poiIcon(c: CanvasRenderingContext2D, poi: MapPOI, x: number, y: number, size: number, selected: boolean) {
    c.save(); c.translate(x, y); c.lineWidth = selected ? 1.8 : 1.1;
    const cleared = this.isCampCleared(poi);
    c.fillStyle = palette.well; c.strokeStyle = selected ? palette.ivory : cleared ? palette.jade : POI_DEFINITIONS[poi.kind].color;
    c.beginPath(); c.arc(0, 0, size + 2.5, 0, Math.PI * 2); c.fill(); if (selected) c.stroke();
    c.beginPath();
    if (poi.kind === 'town' || poi.kind === 'inn') {
      c.moveTo(-size, 0); c.lineTo(0, -size); c.lineTo(size, 0); c.lineTo(size * .7, 0); c.lineTo(size * .7, size); c.lineTo(-size * .7, size); c.lineTo(-size * .7, 0); c.closePath(); c.stroke();
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
      centerX: player.x, centerY: player.y, zoom: .08 };
    const active = this.minimapPointer && this.minimapPointer.x >= r.x && this.minimapPointer.y >= r.y
      && this.minimapPointer.x < r.x + r.width && this.minimapPointer.y < r.y + r.height;
    c.save();
    const bg = c.createLinearGradient(r.x, r.y, r.x, r.y + r.height);
    bg.addColorStop(0, `${palette.panelRaised}f5`); bg.addColorStop(1, `${palette.panel}f5`);
    c.fillStyle = '#00000040'; c.fillRect(r.x + 2, r.y + 4, r.width, r.height);
    c.fillStyle = bg; c.fillRect(r.x, r.y, r.width, r.height);
    c.strokeStyle = active ? palette.brass : palette.lineStrong; c.lineWidth = 1;
    c.strokeRect(r.x + .5, r.y + .5, r.width - 1, r.height - 1);
    c.strokeStyle = `${palette.ivory}16`; c.strokeRect(r.x + 2.5, r.y + 2.5, r.width - 5, r.height - 5);
    c.strokeStyle = palette.brass; c.beginPath();
    for (const [x, y, dx, dy] of [[r.x, r.y, 1, 1], [r.x + r.width, r.y, -1, 1],
      [r.x, r.y + r.height, 1, -1], [r.x + r.width, r.y + r.height, -1, -1]]) {
      c.moveTo(x + dx * .5, y + dy * 9); c.lineTo(x + dx * .5, y + dy * .5); c.lineTo(x + dx * 9, y + dy * .5);
    }
    c.stroke();
    // A folded chart mark shares the fine-line style of the native menu icons.
    c.strokeStyle = palette.brass; c.beginPath();
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
    c.strokeStyle = `${palette.brassDim}90`; c.strokeRect(view.x - .5, view.y - .5, view.width + 1, view.height + 1);
    const center = projectMapPoint(player.x, player.y, view);
    c.save(); c.beginPath(); c.rect(view.x, view.y, view.width, view.height); c.clip();
    c.setLineDash([2, 4]); c.strokeStyle = '#c5d5b127'; c.lineWidth = .8;
    c.beginPath(); c.arc(center.x, center.y, 260 * view.zoom, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
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
      const poi = pickMapPOI(pois.filter(p => this.exploration.isRevealed(p.x, p.y)), view, this.minimapPointer, 8);
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

  private render() {
    if (!this.opened || this.disposed) return;
    this.drawChart();
    this.presentation = { x: this.player.x, y: this.player.y, angle: this.player.angle,
      revision: this.exploration.revision, status: this.exploration.storageStatus,
      message: this.exploration.persistenceMessage };
  }

  private drawChart() {
    const c = this.context;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0); c.clearRect(0, 0, this.view.width, this.view.height);
    this.hovered = null;
    const region = bounds(this.view);
    if (this.pointer && !this.drag) this.hovered = pickMapPOI(this.exploration.getDiscoveredPOIs(region)
      .filter(p => this.exploration.isRevealed(p.x, p.y)), this.view, this.pointer, 14);
    this.chart(c, this.view, false);
    const grid = TILE_WORLD * 2, first = unprojectMapPoint(0, 0, this.view);
    c.save(); c.strokeStyle = '#bfbe9720'; c.lineWidth = .65;
    for (let wx = Math.ceil(first.x / grid) * grid; wx < first.x + this.view.width / this.view.zoom; wx += grid) {
      const p = projectMapPoint(wx, 0, this.view); c.beginPath(); c.moveTo(p.x, 0); c.lineTo(p.x, this.view.height); c.stroke();
    }
    for (let wy = Math.ceil(first.y / grid) * grid; wy < first.y + this.view.height / this.view.zoom; wy += grid) {
      const p = projectMapPoint(0, wy, this.view); c.beginPath(); c.moveTo(0, p.y); c.lineTo(this.view.width, p.y); c.stroke();
    }
    c.restore(); this.playerArrow(c, this.player, this.view, false);
    text(c, 'N', this.view.width - 27, 16, 1.15, palette.brass, 'center');
    c.strokeStyle = '#a8af9566'; c.beginPath(); c.moveTo(this.view.width - 27, 34); c.lineTo(this.view.width - 27, 54); c.moveTo(this.view.width - 32, 40); c.lineTo(this.view.width - 27, 34); c.lineTo(this.view.width - 22, 40); c.stroke();
    setText(this.title, this.location(this.player));
    const count = this.exploration.discoveredPOICount;
    setText(this.discoveries, `${count} ${count === 1 ? 'place' : 'places'} charted`);
    const area = mapAreaLabel(this.world, this.player.x, this.player.y);
    setText(this.status, `${area} · ${this.exploration.persistenceMessage || (this.exploration.storageStatus === 'pending' ? 'Charting…' : 'Chart saved')}`);
    this.status.dataset.state = this.exploration.storageStatus;
    setText(this.coordinates, `X ${Math.round(this.player.x)} · Y ${Math.round(this.player.y)}`);
    if (this.hovered && this.pointer) this.showTooltip(this.hovered, this.pointer);
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
    setText(this.tooltipKind, `${this.poiLabel(poi)} · ${mapAreaLabel(this.world, poi.x, poi.y)}`); setText(this.tooltipDescription, this.isCampCleared(poi) ? 'The watchfire is quiet. All members of this garrison have been defeated for the current run.' : poi.description);
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
    this.close(); this.disposed = true; this.abort.abort(); this.tiles.clear(); this.element.remove(); this.exploration.save();
  }
}
