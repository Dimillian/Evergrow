import { drawGroundPatches } from './ground-art.ts';
import { biomeGround, biomeMapColor, sampleBiome } from './biomes.ts';
import type { BiomeId, BiomeSample } from './biomes.ts';
import { chooseBiomeProp, propDefinition, type PropKind } from './biome-props.ts';
import { drawBiomeGroundAccent } from './biome-prop-art.ts';
import { circleHitsRect, contains, FIRST_TOWN_Y, freezeSettlement, generateSettlement, intersects, MAX_TOWN_RADIUS, settlementPavingWeight, settlementPOIs, TOWN_INTERVAL } from './settlements.ts';
import type { Building, POI, Settlement } from './settlements.ts';
import { mainPathX, pathDistance, roadSurface } from './road-shape.ts';
import { drawGroundSurface } from './ground-surface.ts';
import { drawRoadDetails } from './road-art.ts';
import { isWorldCoordinate, validWorldRectangle, WORLD_QUERY_LIMITS } from './world-query.ts';
import { generateWildernessSite, startingEnemyCamp, wildernessPOI, WILDERNESS_RULES, type WildernessSite, type EnemyCamp } from './wilderness-sites.ts';
export { mainPathX, pathDistance } from './road-shape.ts';

/** All coordinates are world pixels; prop positions are their ground contacts. */
export interface Prop {
  id: string;
  x: number;
  y: number;
  radius: number;
  kind: PropKind;
  biome?: BiomeId;
  seed: number;
  scale: number;
}

export const TILE_SIZE = 256;
export const WORLD_GENERATION_VERSION = 4;
const PROP_CELL_SIZE = 80;
const MAX_PROP_RADIUS = 15;
const TILE_CACHE_LIMIT = 48;
const SETTLEMENT_CACHE_LIMIT = 32;
const SHRINE_INTERVAL = 2200;
const UINT_RANGE = 0x100000000;

type CanvasFactory = () => HTMLCanvasElement;

function hash(x: number, y: number, seed: number, salt = 0): number {
  // Include the high coordinate bits instead of repeating every 2^32 cells.
  let value = (seed ^ salt ^ Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(y | 0, 0x27d4eb2d)
    ^ Math.imul(Math.floor(x / UINT_RANGE), 0x165667b1)
    ^ Math.imul(Math.floor(y / UINT_RANGE), 0x85ebca77)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

function random(x: number, y: number, seed: number, salt = 0): number {
  return hash(x, y, seed, salt) / UINT_RANGE;
}

function smoothstep(a: number, b: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const tx = smoothstep(0, 1, x - ix);
  const ty = smoothstep(0, 1, y - iy);
  const a = random(ix, iy, seed);
  const b = random(ix + 1, iy, seed);
  const c = random(ix, iy + 1, seed);
  const d = random(ix + 1, iy + 1, seed);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

function inRectangle(prop: { x: number; y: number }, x: number, y: number, width: number, height: number): boolean {
  return prop.x >= x && prop.x < x + width && prop.y >= y && prop.y < y + height;
}

function compareProps(a: Prop, b: Prop): number {
  return a.y - b.y || a.x - b.x || a.id.localeCompare(b.id);
}

export class World {
  readonly seed: number;
  readonly generationVersion = WORLD_GENERATION_VERSION;
  private groundTiles = new Map<string, HTMLCanvasElement>();
  private settlements = new Map<number, Settlement>();
  private wilderness = new Map<string, WildernessSite | null>();
  private firstCamp: WildernessSite;

  constructor(seed = 7319) {
    this.seed = seed | 0;
    this.firstCamp = startingEnemyCamp(this.seed);
  }

  get cacheStats() { return { groundTiles: this.groundTiles.size, settlements: this.settlements.size, wildernessSites: this.wilderness.size }; }

  /** Cached generated content belongs to this world instance, not global module state. */
  dispose() { this.groundTiles.clear(); this.settlements.clear(); this.wilderness.clear(); }

  sampleBiome(x: number, y: number): BiomeSample { return sampleBiome(x, y, this.seed); }

  private settlement(band: number): Settlement {
    let town = this.settlements.get(band);
    if (town) this.settlements.delete(band);
    else town = freezeSettlement(generateSettlement(this.seed, band, mainPathX, pathDistance));
    this.settlements.set(band, town);
    if (this.settlements.size > SETTLEMENT_CACHE_LIMIT) this.settlements.delete(this.settlements.keys().next().value!);
    return town;
  }

  getSettlements(x: number, y: number, width: number, height: number): Settlement[] {
    if (!validWorldRectangle(x, y, width, height)) return [];
    const result: Settlement[] = [], query = { x, y, width, height };
    const first = Math.ceil((y - MAX_TOWN_RADIUS - FIRST_TOWN_Y) / TOWN_INTERVAL);
    const last = Math.floor((y + height + MAX_TOWN_RADIUS - FIRST_TOWN_Y) / TOWN_INTERVAL);
    for (let band = first; band <= last; band++) {
      const townY = FIRST_TOWN_Y + band * TOWN_INTERVAL, townX = mainPathX(townY);
      if (!intersects(query, { x: townX - MAX_TOWN_RADIUS, y: townY - MAX_TOWN_RADIUS, width: MAX_TOWN_RADIUS * 2, height: MAX_TOWN_RADIUS * 2 })) continue;
      const town = this.settlement(band);
      if (intersects(query, { x: town.x - town.radius, y: town.y - town.radius, width: town.radius * 2, height: town.radius * 2 })) result.push(town);
    }
    return result;
  }

  private wildernessSite(cx: number, cy: number): WildernessSite | null {
    const key = `${cx}:${cy}`;
    if (this.wilderness.has(key)) {
      const site = this.wilderness.get(key)!;
      this.wilderness.delete(key); this.wilderness.set(key, site); return site;
    }
    const site = generateWildernessSite(this.seed, cx, cy, (x, y, radius) =>
      this.getSettlements(x - radius, y - radius, radius * 2, radius * 2).some(town =>
        Math.hypot(x - town.x, y - town.y) < town.radius + radius));
    this.wilderness.set(key, site);
    if (this.wilderness.size > WILDERNESS_RULES.cacheLimit) this.wilderness.delete(this.wilderness.keys().next().value!);
    return site;
  }

  /** Overlapping blueprints for rendering/collision. Center-based POI queries remain half open. */
  getWildernessSites(x: number, y: number, width: number, height: number): WildernessSite[] {
    if (!validWorldRectangle(x, y, width, height)) return [];
    const { cellSize, maxRadius, maxQueryCells } = WILDERNESS_RULES;
    const minX = Math.floor((x - maxRadius) / cellSize), maxX = Math.floor((x + width + maxRadius) / cellSize);
    const minY = Math.floor((y - maxRadius) / cellSize), maxY = Math.floor((y + height + maxRadius) / cellSize);
    if ((maxX - minX + 1) * (maxY - minY + 1) > maxQueryCells) return [];
    const result: WildernessSite[] = [], query = { x, y, width, height };
    const include = (site: WildernessSite | null) => {
      if (site && intersects(query, { x: site.x - site.radius, y: site.y - site.radius, width: site.radius * 2, height: site.radius * 2 })) result.push(site);
    };
    include(this.firstCamp);
    for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) include(this.wildernessSite(cx, cy));
    return result.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  }

  getEnemyCamps(x: number, y: number, width: number, height: number): EnemyCamp[] {
    return this.getWildernessSites(x, y, width, height).filter(site => site.kind === 'camp');
  }

  getBuildings(x: number, y: number, width: number, height: number): Building[] {
    const query = { x, y, width, height };
    return this.getSettlements(x, y, width, height).flatMap(town => town.buildings).filter(building => intersects(query, building))
      .sort((a, b) => a.y + a.height - b.y - b.height || a.id.localeCompare(b.id));
  }

  getBuildingAt(x: number, y: number): Building | null {
    return this.getBuildings(x, y, .01, .01).find(building => contains(building, x, y)) ?? null;
  }

  isSanctuary(x: number, y: number): boolean {
    return this.getSettlements(x, y, .01, .01).some(town => Math.hypot(x - town.x, y - town.y) < town.radius);
  }

  getPOIs(x: number, y: number, width: number, height: number): POI[] {
    if (!validWorldRectangle(x, y, width, height)) return [];
    const result = [...this.getSettlements(x, y, width, height).flatMap(settlementPOIs),
      ...this.getWildernessSites(x, y, width, height).map(wildernessPOI)];
    const first: Prop = { id: 'shrine:origin', x: -85, y: -95, radius: 15, kind: 'shrine', seed: 0, scale: 1 };
    const shrines = [first];
    for (let band = Math.floor(y / SHRINE_INTERVAL) - 1; band <= Math.floor((y + height) / SHRINE_INTERVAL) + 1; band++) {
      const shrine = this.roadShrine(band);
      if (shrine) shrines.push(shrine);
    }
    for (const shrine of shrines) result.push({ id: shrine.id, kind: 'shrine', name: 'Wayfarer Shrine', x: shrine.x, y: shrine.y,
      description: 'A roadside lantern kept alight for travellers.' });
    return result.filter(poi => inRectangle(poi, x, y, width, height)).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  }

  /** Cheap map samples share terrain/road colors without querying collision. */
  mapColor(x: number, y: number, sampleSize = 24): string {
    if (sampleSize > 48) {
      const [r, g, b] = biomeMapColor(this.sampleBiome(x, y).weights).map(Math.round);
      return `rgb(${r},${g},${b})`;
    }
    const towns = this.getSettlements(x, y, .01, .01);
    const [r, g, b] = this.surfaceColor(x, y, towns, false).map(Math.round);
    return `rgb(${r},${g},${b})`;
  }

  private roadWeight(x: number, y: number): number {
    return roadSurface(x, y, this.seed).weight;
  }

  private pavingWeight(towns: Settlement[], x: number, y: number, road: number): number {
    let paved = 0;
    for (const town of towns) paved = Math.max(paved, settlementPavingWeight(town, x, y, road));
    return paved;
  }

  private surfaceColor(x: number, y: number, towns: Settlement[], detail: boolean): number[] {
    const damp = noise(x / 180, y / 180, this.seed + 201);
    const weights = this.sampleBiome(x, y).weights;
    const profile = roadSurface(x, y, this.seed), road = profile.weight;
    const paved = this.pavingWeight(towns, x, y, road);
    const base = detail ? biomeGround(weights, smoothstep(.50, .85, damp) * .65) : biomeMapColor(weights);
    const water = weights.swamp * smoothstep(.48, .75, damp) * (1 - road);
    const wet = smoothstep(.35, .85, damp) * (.35 + weights.swamp * .65);
    const pool = [15, 48, 60];
    const dirt = [58 - wet * 9, 51 - wet * 5, 39 - wet * 2];
    const stone = [68, 68, 59];
    const weather = detail ? (noise(x / 93, y / 93, this.seed + 203) - .5) * 18 : 0;
    const grain = detail ? (noise(x / 18, y / 18, this.seed + 202) - .5) * 5 : 0;
    const track = profile.tracks * road * (1 - paved) * 3;
    const bank = detail ? weights.swamp * (smoothstep(.40, .50, damp) - smoothstep(.50, .64, damp)) * (1 - road) : 0;
    return base.map((value, i) => (((value + weather * .65 + [8, 16, 10][i] * bank) * (1 - water) + pool[i] * water) * (1 - road)
      + (dirt[i] + weather - track) * road) * (1 - paved)
      + (stone[i] + weather * .7 - (detail ? wet * 4 : 0)) * paved + grain);
  }

  /** Half-open rectangle of ground contacts, returned in stable depth order. */
  getProps(x: number, y: number, width: number, height: number): Prop[] {
    if (!validWorldRectangle(x, y, width, height)) return [];

    const result: Prop[] = [];
    const minCellX = Math.floor(x / PROP_CELL_SIZE);
    const minCellY = Math.floor(y / PROP_CELL_SIZE);
    const maxCellX = Math.floor((x + width) / PROP_CELL_SIZE);
    const maxCellY = Math.floor((y + height) / PROP_CELL_SIZE);
    if ((maxCellX - minCellX + 1) * (maxCellY - minCellY + 1) > WORLD_QUERY_LIMITS.propCells) return [];

    for (let cy = minCellY; cy <= maxCellY; cy++) {
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        const prop = this.cellProp(cx, cy);
        if (prop && inRectangle(prop, x, y, width, height)) result.push(prop);
      }
    }

    const firstBand = Math.floor(y / SHRINE_INTERVAL) - 1;
    const lastBand = Math.floor((y + height) / SHRINE_INTERVAL) + 1;
    for (let band = firstBand; band <= lastBand; band++) {
      const shrine = this.roadShrine(band);
      if (shrine && inRectangle(shrine, x, y, width, height)) result.push(shrine);
    }

    const firstShrine: Prop = {
      id: 'shrine:origin', x: -85, y: -95, radius: 15, kind: 'shrine',
      seed: hash(0, 0, this.seed, 301), scale: 1,
    };
    if (inRectangle(firstShrine, x, y, width, height)) result.push(firstShrine);
    return result.sort(compareProps);
  }

  private cellProp(cx: number, cy: number): Prop | null {
    const x = (cx + 0.18 + random(cx, cy, this.seed, 1) * 0.64) * PROP_CELL_SIZE;
    const y = (cy + 0.18 + random(cx, cy, this.seed, 2) * 0.64) * PROP_CELL_SIZE;
    if ((x / 180) ** 2 + (y / 140) ** 2 < 1) return null;
    // Keep generous shoulders clear as well as the visibly compacted road.
    if (pathDistance(x, y) < 76) return null;
    if (this.isSanctuary(x, y)) return null;
    if (this.getWildernessSites(x - 18, y - 18, 36, 36).some(site => Math.hypot(x - site.x, y - site.y) < site.radius + 18)) return null;
    const roadsideShrine = this.roadShrine(Math.floor(y / SHRINE_INTERVAL));
    if (roadsideShrine && Math.hypot(x - roadsideShrine.x, y - roadsideShrine.y) < 44) return null;
    const density = 0.40 + noise(x / 520, y / 520, this.seed + 37) * 0.39;
    if (random(cx, cy, this.seed, 3) > density) return null;
    const choice = random(cx, cy, this.seed, 4);
    const weights = this.sampleBiome(x, y).weights;
    const { biome, kind } = chooseBiomeProp(weights, random(cx, cy, this.seed, 41), choice);
    const definition = propDefinition(kind);
    const scale = definition.scale[0] + random(cx, cy, this.seed, 5) * (definition.scale[1] - definition.scale[0]);
    if (definition.canopy) {
      // The crown is projected above its trunk. A clear ground contact alone can
      // leave a foreground tree hiding a site's fire, supplies and entrance.
      const crownX = x + definition.canopy.offsetX * scale;
      const crownY = y - definition.canopy.height * scale, crownMargin = definition.canopy.radius * scale;
      if (this.getWildernessSites(crownX - crownMargin, crownY - crownMargin, crownMargin * 2, crownMargin * 2)
        .some(site => Math.hypot(crownX - site.x, crownY - site.y) < site.radius + crownMargin)) return null;
    }
    const radius = definition.radius[0] + random(cx, cy, this.seed, 6) * (definition.radius[1] - definition.radius[0]);
    return { id: `prop:${cx}:${cy}`, x, y, radius, kind, biome, seed: hash(cx, cy, this.seed, 7), scale };
  }

  private roadShrine(band: number): Prop | null {
    if (random(band, 0, this.seed, 101) > 0.5) return null;
    const y = band * SHRINE_INTERVAL + 500 + random(band, 0, this.seed, 102) * 950;
    if (Math.abs(y) < 450) return null;
    const side = random(band, 0, this.seed, 103) < 0.5 ? -1 : 1;
    const x = mainPathX(y) + side * 53;
    if (this.isSanctuary(x, y)) return null;
    return {
      id: `shrine:road:${band}`, x, y,
      radius: 15, kind: 'shrine', seed: hash(band, 0, this.seed, 104), scale: 1,
    };
  }

  blocked(x: number, y: number, radius: number): boolean {
    if (![x, y].every(isWorldCoordinate) || !Number.isFinite(radius)
      || radius < 0 || radius > WORLD_QUERY_LIMITS.collisionRadius) return true;
    const extent = radius + MAX_PROP_RADIUS;
    if (!validWorldRectangle(x - extent, y - extent, extent * 2, extent * 2)) return true;
    if (this.getProps(x - extent, y - extent, extent * 2, extent * 2).some(prop => prop.radius > 0 &&
      (x - prop.x) ** 2 + (y - prop.y) ** 2 < (radius + prop.radius) ** 2 - 1e-7)) return true;
    const reach = Math.max(radius, .1);
    if (this.getWildernessSites(x - reach, y - reach, reach * 2, reach * 2).some(site =>
      site.decor.some(decor => decor.radius > 0 && (x - decor.x) ** 2 + (y - decor.y) ** 2 < (radius + decor.radius) ** 2 - 1e-7))) return true;
    return this.getBuildings(x - reach, y - reach, reach * 2, reach * 2).some(building =>
      [...building.walls, ...building.furniture].some(rect => circleHitsRect(x, y, radius, rect)));
  }

  /** Sweep short segments against trunk circles, preserving the unblocked axis. */
  move(x: number, y: number, dx: number, dy: number, radius: number): { x: number; y: number } {
    if (![x, y, x + dx, y + dy].every(isWorldCoordinate) || ![dx, dy, radius].every(Number.isFinite)
      || radius < 0 || radius > WORLD_QUERY_LIMITS.collisionRadius
      || Math.hypot(dx, dy) > WORLD_QUERY_LIMITS.movement) return { x, y };
    const extent = radius + MAX_PROP_RADIUS + 1;
    if (!validWorldRectangle(Math.min(x, x + dx) - extent, Math.min(y, y + dy) - extent,
      Math.abs(dx) + extent * 2, Math.abs(dy) + extent * 2)) return { x, y };
    const props = this.getProps(Math.min(x, x + dx) - extent, Math.min(y, y + dy) - extent,
      Math.abs(dx) + extent * 2, Math.abs(dy) + extent * 2).filter(prop => prop.radius > 0);
    const obstacles = [...props, ...this.getWildernessSites(Math.min(x, x + dx) - radius, Math.min(y, y + dy) - radius,
      Math.abs(dx) + radius * 2 + .1, Math.abs(dy) + radius * 2 + .1).flatMap(site => site.decor).filter(decor => decor.radius > 0)];
    const furniture = this.getBuildings(Math.min(x, x + dx) - radius, Math.min(y, y + dy) - radius,
      Math.abs(dx) + radius * 2 + .1, Math.abs(dy) + radius * 2 + .1).flatMap(building => [...building.walls, ...building.furniture]);
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
    const sx = dx / steps;
    const sy = dy / steps;

    const segmentBlocked = (ax: number, ay: number, bx: number, by: number): boolean => {
      const vx = bx - ax;
      const vy = by - ay;
      const lengthSquared = vx * vx + vy * vy;
      return furniture.some(rect => circleHitsRect(bx, by, radius, rect)) || obstacles.some(prop => {
        const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
          ((prop.x - ax) * vx + (prop.y - ay) * vy) / lengthSquared));
        const nearX = ax + vx * t - prop.x;
        const nearY = ay + vy * t - prop.y;
        return nearX * nearX + nearY * nearY < (radius + prop.radius) ** 2 - 1e-7;
      });
    };

    for (let i = 0; i < steps; i++) {
      if (!segmentBlocked(x, y, x + sx, y + sy)) {
        x += sx;
        y += sy;
      } else if (Math.abs(sx) >= Math.abs(sy)) {
        if (!segmentBlocked(x, y, x + sx, y)) x += sx;
        if (!segmentBlocked(x, y, x, y + sy)) y += sy;
      } else {
        if (!segmentBlocked(x, y, x, y + sy)) y += sy;
        if (!segmentBlocked(x, y, x + sx, y)) x += sx;
      }
    }
    return { x, y };
  }

  /** Ground is rendered only on demand; the constructor and queries need no DOM. */
  getGroundTile(tileX: number, tileY: number, createCanvas?: CanvasFactory): HTMLCanvasElement {
    if (![tileX, tileY, tileX * TILE_SIZE, tileY * TILE_SIZE,
      (tileX + 1) * TILE_SIZE, (tileY + 1) * TILE_SIZE].every(Number.isSafeInteger)) {
      throw new RangeError('Ground tile coordinates must be safe integers.');
    }
    const key = `${tileX}:${tileY}`;
    const cached = this.groundTiles.get(key);
    if (cached) {
      this.groundTiles.delete(key);
      this.groundTiles.set(key, cached);
      return cached;
    }
    const canvas = createCanvas ? createCanvas() : document.createElement('canvas');
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('A 2D canvas context is required for ground tiles.');
    this.drawGround(context, tileX * TILE_SIZE, tileY * TILE_SIZE);
    this.groundTiles.set(key, canvas);
    if (this.groundTiles.size > TILE_CACHE_LIMIT) {
      this.groundTiles.delete(this.groundTiles.keys().next().value!);
    }
    return canvas;
  }

  private drawGround(context: CanvasRenderingContext2D, originX: number, originY: number): void {
    // Resolve nearby geometry once per tile, never while looking up individual pixels.
    const towns = this.getSettlements(originX - 192, originY - 192, TILE_SIZE + 384, TILE_SIZE + 384);
    const buildings = towns.flatMap(town => town.buildings);
    // Every material sample and detail anchor is in world space. Tile edges are
    // merely a crop of the same illustration, including at negative coordinates.
    drawGroundSurface(context, originX, originY, TILE_SIZE, (x, y) => this.surfaceColor(x, y, towns, true));
    drawGroundPatches(context, originX, originY, TILE_SIZE, this.seed, (x, y) => this.sampleBiome(x, y).id,
      (x, y) => this.roadWeight(x, y) < .025 && this.pavingWeight(towns, x, y, 0) < .025
        && !buildings.some(building => contains(building, x, y, 12)));
    drawRoadDetails(context, originX, originY, TILE_SIZE, this.seed, (x, y) => {
      if (buildings.some(building => contains(building, x, y, 10))) return { road: 0, paved: 0 };
      const road = this.roadWeight(x, y);
      return { road, paved: this.pavingWeight(towns, x, y, road) };
    });

    const detailCell = 15;
    const margin = 22;
    for (let cy = Math.floor((originY - margin) / detailCell);
      cy <= Math.floor((originY + TILE_SIZE + margin) / detailCell); cy++) {
      for (let cx = Math.floor((originX - margin) / detailCell);
        cx <= Math.floor((originX + TILE_SIZE + margin) / detailCell); cx++) {
        const wx = (cx + random(cx, cy, this.seed, 211)) * detailCell;
        const wy = (cy + random(cx, cy, this.seed, 212)) * detailCell;
        const px = wx - originX;
        const py = wy - originY;
        const pick = random(cx, cy, this.seed, 213);
        const onRoad = pathDistance(wx, wy) < 37;
        if (buildings.some(building => contains(building, wx, wy, 9))
          || this.pavingWeight(towns, wx, wy, this.roadWeight(wx, wy)) > .08) continue;
        const weights = this.sampleBiome(wx, wy).weights;
        const { biome } = chooseBiomeProp(weights, random(cx, cy, this.seed, 217), 0);
        if (drawBiomeGroundAccent(context, biome, px, py, pick, hash(cx, cy, this.seed, 218), onRoad)) continue;
        if (biome === 'swamp' && !onRoad && noise(wx / 180, wy / 180, this.seed + 201) > .64) {
          if (pick > .8) {
            context.strokeStyle = 'rgba(90,160,161,0.22)'; context.lineWidth = .7;
            context.beginPath(); context.moveTo(px - 4, py); context.lineTo(px + 5, py);
            context.moveTo(px + 7, py + 2); context.lineTo(px + 10, py + 2); context.stroke();
          } else if (pick < .055) {
            context.fillStyle = 'rgba(87,128,76,0.7)'; context.fillRect(px - 2, py - 1, 5, 3);
            context.fillStyle = 'rgba(159,167,96,0.5)'; context.fillRect(px, py - 1, 2, 1);
          }
          continue;
        }

        if (pick < (onRoad ? 0.08 : 0.18 + noise(wx / 83, wy / 83, this.seed + 239) * .23)) {
          const length = 3 + random(cx, cy, this.seed, 214) * 5;
          const lean = random(cx, cy, this.seed, 215) * 5 - 2.5;
          context.strokeStyle = biome === 'swamp' ? 'rgba(111,155,132,0.31)' : biome === 'verdant' ? 'rgba(99,180,87,0.36)'
            : biome === 'autumn' ? 'rgba(161,151,83,0.33)' : biome === 'highlands' ? 'rgba(155,160,122,0.35)'
              : biome === 'frostpine' ? 'rgba(139,174,176,0.25)' : biome === 'emberfall' ? 'rgba(133,115,104,0.24)' : 'rgba(90,144,96,0.26)';
          context.lineWidth = 0.65;
          context.beginPath();
          context.moveTo(px, py);
          context.quadraticCurveTo(px + lean * 0.3, py - length * 0.55, px + lean, py - length);
          context.moveTo(px + 1, py);
          context.lineTo(px + 3 + lean * 0.3, py - length * 0.55);
          context.stroke();
        } else if (pick > 0.78) {
          const size = 0.8 + random(cx, cy, this.seed, 216) * 1.4;
          context.fillStyle = onRoad ? 'rgba(104,98,79,0.23)' : 'rgba(76,85,77,0.17)';
          context.fillRect(px, py, size * 1.6, size);
          context.fillStyle = 'rgba(5,11,12,0.15)';
          context.fillRect(px, py + size, size * 1.8, 0.8);
        } else if (pick > 0.70 && !onRoad) {
          context.strokeStyle = 'rgba(9,15,15,0.24)';
          context.lineWidth = 0.8;
          context.beginPath();
          context.moveTo(px - 3, py - 1);
          context.lineTo(px + 7, py + 2);
          context.lineTo(px + 11, py);
          context.moveTo(px + 2, py + 0.5);
          context.lineTo(px + 4, py - 3);
          context.stroke();
        }
      }
    }
  }
}
