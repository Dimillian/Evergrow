import { segmentDistanceSquared } from './combat-geometry.ts';
import { bossLairCell, generateBossLair } from './wilderness-sites.ts';
import { landscapePropProbability, landscapeRelief } from './natural-landscape.ts';
import { worldNavigation } from './world-navigation.ts';
import type { MaterialId } from './material-content.ts';
import { furnitureContainer, furnitureContainerId, type BreakableContainer } from './breakable-containers.ts';
import { hydrology, type WaterSample } from './hydrology.ts';
import { dungeonEntrances } from './dungeon-entrances.ts';
import { queryEventSites } from './poi-sites.ts';
import { townPortalAnchor } from './travel.ts';
import { biomeGround, biomeMapColor, sampleBiome } from './biomes.ts';
import type { BiomeId, BiomeSample } from './biomes.ts';
import { chooseBiomeProp, propDefinition, type PropKind } from './biome-props.ts';
import { circleHitsRect, contains, freezeSettlement, generateSettlement, intersects, MAX_TOWN_RADIUS, settlementPavingWeight, settlementPOIs } from './settlements.ts';
import type { Building, POI, Settlement } from './settlements.ts';
import { pathDistance, roadSurface, roadAnchors } from './road-shape.ts';
import { groundContact, surfaceWaterWeight, type GroundContact } from './ground-material.ts';
import { isWorldCoordinate, validWorldRectangle, WORLD_QUERY_LIMITS } from './world-query.ts';
import { generateWildernessSite, startingEnemyCamp, wildernessPOI, WILDERNESS_RULES, type WildernessSite, type EnemyCamp } from './wilderness-sites.ts';
export { pathDistance } from './road-shape.ts';
import { nearestPlace, placeCell, queryPlaces, settlementPlace, type Place } from './world-geography.ts';

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
export const WORLD_GENERATION_VERSION = 10;
const PROP_CELL_SIZE = 80;
const MAX_PROP_RADIUS = 15;
const PROP_CACHE_LIMIT = 8192;
const COLLISION_CACHE_LIMIT = 256;
const COLLISION_CELL = 256;
const SETTLEMENT_CACHE_LIMIT = 32;
const UINT_RANGE = 0x100000000;


export function hash(x: number, y: number, seed: number, salt = 0): number {
  // Include the high coordinate bits instead of repeating every 2^32 cells.
  let value = (seed ^ salt ^ Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(y | 0, 0x27d4eb2d)
    ^ Math.imul(Math.floor(x / UINT_RANGE), 0x165667b1)
    ^ Math.imul(Math.floor(y / UINT_RANGE), 0x85ebca77)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function random(x: number, y: number, seed: number, salt = 0): number {
  return hash(x, y, seed, salt) / UINT_RANGE;
}

export function smoothstep(a: number, b: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function noise(x: number, y: number, seed: number): number {
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

export class WorldLandscape {
  readonly seed: number;
  readonly hydrology;
  readonly generationVersion = WORLD_GENERATION_VERSION;
  private propCells = new Map<string, Prop | null>();
  private settlements = new Map<number, Settlement>();
  private settlementCells = new Map<string, readonly Place[]>();
  private wilderness = new Map<string, WildernessSite | null>();
  private firstCamp: WildernessSite;
  private collisionRegions = new Map<string, { props: Prop[]; sites: WildernessSite[]; buildings: Building[] }>();

  readonly wildernessOnly: boolean;
  constructor(seed = 7319, wildernessOnly = false) {
    this.wildernessOnly = wildernessOnly;
    this.seed = seed >>> 0;
    this.hydrology = hydrology(this.seed);
    this.firstCamp = startingEnemyCamp(this.seed);
  }

  get cacheStats() { return { settlements: this.settlements.size, wildernessSites: this.wilderness.size }; }

  /** Cached generated content belongs to this world instance, not global module state. */
  dispose() { this.collisionRegions.clear(); this.propCells.clear(); this.settlements.clear(); this.settlementCells.clear(); this.wilderness.clear(); }

  sampleBiome(x: number, y: number): BiomeSample { return sampleBiome(x, y, this.seed); }

  getNearestSettlement(x:number,y:number):Settlement { return this.settlement(nearestPlace(this.seed,x,y).id); }

  getPortalAnchor(band: number) { return townPortalAnchor(this.settlement(band)); }

  private settlement(band: number): Settlement {
    let town = this.settlements.get(band);
    if (town) this.settlements.delete(band);
    else town = freezeSettlement(generateSettlement(this.seed, settlementPlace(this.seed, ...placeCell(band))));
    this.settlements.set(band, town);
    if (this.settlements.size > SETTLEMENT_CACHE_LIMIT) this.settlements.delete(this.settlements.keys().next().value!);
    return town;
  }

  getSettlements(x: number, y: number, width: number, height: number): Settlement[] {
    if (this.wildernessOnly) return [];
    if (!validWorldRectangle(x, y, width, height)) return [];
    const result: Settlement[] = [], query = { x, y, width, height };
    let places: readonly Place[];
    if (width <= 1024 && height <= 1024) {
      const cx = Math.floor(x / 2048), cy = Math.floor(y / 2048), key = `${cx}:${cy}`;
      let cached = this.settlementCells.get(key);
      if (!cached) {
        cached = queryPlaces(this.seed, cx * 2048, cy * 2048, 3072, 3072, MAX_TOWN_RADIUS);
        if (this.settlementCells.size >= 128) this.settlementCells.delete(this.settlementCells.keys().next().value!);
        this.settlementCells.set(key, cached);
      }
      places = cached;
    } else places = queryPlaces(this.seed, x, y, width, height, MAX_TOWN_RADIUS);
    for (const place of places) {
      if (!intersects(query, { x: place.x - MAX_TOWN_RADIUS, y: place.y - MAX_TOWN_RADIUS, width: MAX_TOWN_RADIUS * 2, height: MAX_TOWN_RADIUS * 2 })) continue;
      const town = this.settlement(place.id);
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
      this.hydrology.sample(x, y).coverage > .05 || this.getSettlements(x - radius, y - radius, radius * 2, radius * 2).some(town =>
        Math.hypot(x - town.x, y - town.y) < town.radius + radius));
    this.wilderness.set(key, site);
    if (this.wilderness.size > WILDERNESS_RULES.cacheLimit) this.wilderness.delete(this.wilderness.keys().next().value!);
    return site;
  }

  private bossLair(cx:number,cy:number):WildernessSite|null {
    if(!bossLairCell(this.seed,cx,cy))return null;
    const key=`lair:${cx}:${cy}`;
    if(this.wilderness.has(key)){const site=this.wilderness.get(key)!;this.wilderness.delete(key);this.wilderness.set(key,site);return site;}
    const neighbors:WildernessSite[]=[this.firstCamp];
    for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++){const s=this.wildernessSite(x,y);if(s)neighbors.push(s);}
    const site=generateBossLair(this.seed,cx,cy,(x,y,radius)=>this.hydrology.sample(x,y).coverage>.05
      ||neighbors.some(s=>Math.hypot(s.x-x,s.y-y)<s.radius+radius)
      ||this.getSettlements(x-radius,y-radius,radius*2,radius*2).some(t=>Math.hypot(t.x-x,t.y-y)<t.radius+radius));
    this.wilderness.set(key,site);
    if(this.wilderness.size>WILDERNESS_RULES.cacheLimit)this.wilderness.delete(this.wilderness.keys().next().value!);
    return site;
  }

  /** Overlapping blueprints for rendering/collision. Center-based POI queries remain half open. */
  getWildernessSites(x: number, y: number, width: number, height: number): WildernessSite[] {
    if (this.wildernessOnly) return [];
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
    for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) {include(this.wildernessSite(cx, cy));include(this.bossLair(cx,cy));}
    return result.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  }

  getDungeonEntrances(x:number,y:number,w:number,h:number) { return this.wildernessOnly ? [] : dungeonEntrances(this,x,y,w,h); }

  getEventSites(x: number, y: number, width: number, height: number) { return this.wildernessOnly ? [] : queryEventSites(this, x, y, width, height); }

  getEnemyCamps(x: number, y: number, width: number, height: number): EnemyCamp[] {
    return this.getWildernessSites(x, y, width, height).filter(site => site.kind === 'camp' || site.kind === 'bossLair');
  }

  getBuildings(x: number, y: number, width: number, height: number): Building[] {
    const query = { x, y, width, height };
    return this.getSettlements(x, y, width, height).flatMap(town => town.buildings).filter(building => intersects(query, building))
      .sort((a, b) => a.y + a.height - b.y - b.height || a.id.localeCompare(b.id));
  }

  getBuildingAt(x: number, y: number): Building | null {
    return this.getBuildings(x, y, .01, .01).find(building => building.form !== 'stall' && building.form !== 'tent' && building.form !== 'fixture' && contains(building, x, y)) ?? null;
  }

  isSanctuary(x: number, y: number): boolean {
    return this.getSettlements(x, y, .01, .01).some(town => Math.hypot(x - town.x, y - town.y) < town.radius);
  }

  getPOIs(x: number, y: number, width: number, height: number): POI[] {
    if (this.wildernessOnly) return [];
    if (!validWorldRectangle(x, y, width, height)) return [];
    const result = [...this.getDungeonEntrances(x,y,width,height).map(e=>({...e,kind:'dungeon' as const,description:`Level ${e.level} · Rootbound Crypt`})), ...this.getSettlements(x, y, width, height).flatMap(settlementPOIs),
      ...this.getWildernessSites(x, y, width, height).map(wildernessPOI),
      ...this.getEventSites(x, y, width, height).filter(s => s.kind === 'reliquary').map(s => ({ ...s, kind: 'reliquary' as const, description: 'Open the roadside cache.' }))];
    const first: Prop = { id: 'shrine:origin', x: -85, y: -95, radius: 15, kind: 'shrine', seed: 0, scale: 1 };
    const shrines = [first];
    shrines.push(...this.roadShrines(x, y, width, height));
    for (const shrine of shrines) result.push({ id: shrine.id, kind: 'shrine', name: 'Wayfarer Shrine', x: shrine.x, y: shrine.y,
      description: 'A roadside lantern kept alight for travellers.' });
    return result.filter(poi => inRectangle(poi, x, y, width, height)).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  }

  /** Cheap map samples share terrain/road colors without querying collision. */
  mapColor(x: number, y: number, sampleSize = 24): string {
    if (sampleSize > 48) {
      const water = this.hydrology.sample(x, y).coverage;
      const [r, g, b] = biomeMapColor(this.sampleBiome(x, y).weights).map((v, i) => Math.round(v * (1 - water) + [29, 73, 85][i] * water));
      return `rgb(${r},${g},${b})`;
    }
    const towns = this.getSettlements(x, y, .01, .01);
    const [r, g, b] = this.surfaceColor(x, y, towns, false).map(Math.round);
    return `rgb(${r},${g},${b})`;
  }

  /** The large atlas retains the game's ground materials, with lifted chart exposure. */
  atlasColor(x: number, y: number): string {
    const rgb = this.surfaceColor(x, y, this.getSettlements(x, y, .01, .01), true);
    return `rgb(${rgb.map(value => Math.round(Math.max(0, Math.min(230, value * 1.35 + 12)))).join(',')})`;
  }

  protected roadWeight(x: number, y: number): number {
    return roadSurface(x, y, this.seed).weight;
  }

  protected pavingWeight(towns: Settlement[], x: number, y: number, road: number): number {
    let paved = 0;
    for (const town of towns) paved = Math.max(paved, settlementPavingWeight(town, x, y, road));
    return paved;
  }

  protected surfaceColor(x: number, y: number, towns: Settlement[], detail: boolean): number[] {
    const damp = noise(x / 180, y / 180, this.seed + 201);
    const weights = this.sampleBiome(x, y).weights;
    const profile = roadSurface(x, y, this.seed), road = profile.weight * (towns.some(t=>Math.hypot(x-t.x,y-t.y)<t.radius-100)?0:1);
    const paved = this.pavingWeight(towns, x, y, road);
    const base = detail ? biomeGround(weights, smoothstep(.50, .85, damp) * .65) : biomeMapColor(weights);
    const hydro = this.hydrology.sample(x, y);
    const water = Math.max(surfaceWaterWeight(weights, damp, road), hydro.coverage * (1 - paved));
    const wet = smoothstep(.35, .85, damp) * (.35 + weights.swamp * .65);
    const shallows = Math.max(0, 1 - hydro.depth / .65);
    const pool = [17 + shallows * 22, 51 + shallows * 25, 60 + shallows * 16];
    const dirt = [58 - wet * 9, 51 - wet * 5, 39 - wet * 2];
    const town=towns.find(t=>Math.hypot(x-t.x,y-t.y)<t.radius);
    // Local soil retains the surrounding climate; broad wear should not read as bright ribbons.
    const strength=town?.kind==='city'?.5:town?.kind==='village'?.34:.25;
    const earth=[58+weights.sunscar*40,51+weights.sunscar*33,39+weights.sunscar*22];
    const stone=base.map((v,i)=>v*(1-strength)+earth[i]*strength+(town?.kind==='city'?3:0));
    const weather = detail ? (noise(x / 93, y / 93, this.seed + 203) - .5) * 18 : 0;
    const relief = detail ? landscapeRelief(x,y,this.seed,weights) : 0;
    const grain = detail ? (noise(x / 18, y / 18, this.seed + 202) - .5) * 5 : 0;
    const track = profile.tracks * road * (1 - paved) * 3;
    const bank = hydro.bank * .7 + (detail ? weights.swamp * (smoothstep(.40, .50, damp) - smoothstep(.50, .64, damp)) * (1 - road) : 0);
    const dryRoad = road * (1 - hydro.coverage * .88);
    return base.map((value, i) => (((value + relief + weather * .65 + [22, 23, 15][i] * bank) * (1 - water) + pool[i] * water) * (1 - dryRoad)
      + (dirt[i] + weather - track) * dryRoad) * (1 - paved)
      + (stone[i] + weather * .7 - (detail ? wet * 4 : 0)) * paved + grain);
  }

  /** River/lake masks are shared by art and contact. Paving stays dry; roads become shallow fords. */
  sampleWater(x: number, y: number): WaterSample {
    const w = this.hydrology.sample(x, y);
    if (w.coverage <= 0) return w;
    const towns = this.getSettlements(x, y, .01, .01), road = this.roadWeight(x, y);
    const paved = this.pavingWeight(towns, x, y, road);
    const dry = Math.max(paved, towns.some(t => t.buildings.some(b => contains(b, x, y, 8))) ? 1 : 0);
    return { ...w, coverage: w.coverage * (1 - dry), depth: w.depth * (1 - dry) * (1 - road * .78) };
  }

  sampleGroundContact(x: number, y: number): GroundContact {
    const weights = this.sampleBiome(x, y).weights;
    const road = this.roadWeight(x, y), towns = this.getSettlements(x, y, .01, .01);
    const contact = groundContact(weights, noise(x / 180, y / 180, this.seed + 201), road,
      this.pavingWeight(towns, x, y, road), !!this.getBuildingAt(x, y));
    const river = this.sampleWater(x, y).coverage;
    return { ...contact, simulatedWater: river > .1, water: contact.indoors ? 0 : Math.max(contact.water, river) };
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

    result.push(...this.roadShrines(x, y, width, height));

    const firstShrine: Prop = {
      id: 'shrine:origin', x: -85, y: -95, radius: 15, kind: 'shrine',
      seed: hash(0, 0, this.seed, 301), scale: 1,
    };
    if (!this.wildernessOnly && inRectangle(firstShrine, x, y, width, height)) result.push(firstShrine);
    return result.sort(compareProps);
  }

  private cellProp(cx: number, cy: number): Prop | null {
    const key = `${cx}:${cy}`, cached = this.propCells.get(key);
    if (cached !== undefined) return cached;
    const generated = this.generateCellProp(cx, cy), prop = generated ? Object.freeze(generated) : null;
    // Cache empty cells too. Blueprints are immutable; FIFO avoids churn on hot collision queries.
    if (this.propCells.size >= PROP_CACHE_LIMIT) this.propCells.delete(this.propCells.keys().next().value!);
    this.propCells.set(key, prop); return prop;
  }

  private generateCellProp(cx: number, cy: number): Prop | null {
    const x = (cx + 0.18 + random(cx, cy, this.seed, 1) * 0.64) * PROP_CELL_SIZE;
    const y = (cy + 0.18 + random(cx, cy, this.seed, 2) * 0.64) * PROP_CELL_SIZE;
    if ((x / 180) ** 2 + (y / 140) ** 2 < 1) return null;
    // Keep generous shoulders clear as well as the visibly compacted road.
    if (pathDistance(x, y, this.seed) < 76) return null;

    if (this.getWildernessSites(x - 18, y - 18, 36, 36).some(site => Math.hypot(x - site.x, y - site.y) < site.radius + 18)) return null;
    if (this.roadShrines(x - 44, y - 44, 88, 88).some(shrine => Math.hypot(x - shrine.x, y - shrine.y) < 44)) return null;
    if (this.hydrology.sample(x, y).coverage > .12) return null;
    const choice = random(cx, cy, this.seed, 4);
    const weights = this.sampleBiome(x, y).weights;
    const { biome, kind } = chooseBiomeProp(weights, random(cx, cy, this.seed, 41), choice);
    if (random(cx, cy, this.seed, 3) > landscapePropProbability(x,y,this.seed,kind,biome)) return null;
    const definition = propDefinition(kind);
    const scale = definition.scale[0] + random(cx, cy, this.seed, 5) * (definition.scale[1] - definition.scale[0]);
    const towns=this.getSettlements(x-180,y-180,360,360),settlementClearance=definition.radius[1]+22;
    for(const town of towns){
      if(Math.hypot(x-town.x,y-town.y)<155)return null;
      if(town.buildings.some(b=>circleHitsRect(x,y,settlementClearance+(definition.canopy?32:0),b)))return null;
      if(town.paths.some(path=>path.points.slice(1).some((b,j)=>{const a=path.points[j],vx=b[0]-a[0],vy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*vx+(y-a[1])*vy)/(vx*vx+vy*vy||1)));return Math.hypot(x-a[0]-t*vx,y-a[1]-t*vy)<path.width/2+settlementClearance;})))return null;
      if(definition.canopy&&town.buildings.some(b=>circleHitsRect(x+definition.canopy!.offsetX*scale,y-definition.canopy!.height*scale,definition.canopy!.radius*scale+16,b)))return null;
    }
    if (definition.canopy) {
      // The crown is projected above its trunk. A clear ground contact alone can
      // leave a foreground tree hiding a site's fire, supplies and entrance.
      const crownX = x + definition.canopy.offsetX * scale;
      const crownY = y - definition.canopy.height * scale, crownMargin = definition.canopy.radius * scale;
      if (this.getWildernessSites(crownX - crownMargin, crownY - crownMargin, crownMargin * 2, crownMargin * 2)
        .some(site => Math.hypot(crownX - site.x, crownY - site.y) < site.radius + crownMargin)) return null;
    }
    const radius = definition.radius[0] + random(cx, cy, this.seed, 6) * (definition.radius[1] - definition.radius[0]);
    const clearance=radius+18;
    if(this.getWildernessSites(x-clearance,y-clearance,clearance*2,clearance*2).some(site=>Math.hypot(x-site.x,y-site.y)<site.radius+clearance))return null;
    return { id: `prop:${cx}:${cy}`, x, y, radius, kind, biome, seed: hash(cx, cy, this.seed, 7), scale };
  }

  private roadShrines(x: number, y: number, width: number, height: number): Prop[] {
    if (this.wildernessOnly) return [];
    return roadAnchors(x, y, width, height, this.seed, 301).filter(p => p.seed % 3 === 0 && Math.hypot(p.x, p.y) > 450 && !this.isSanctuary(p.x, p.y))
      .map(p => ({ id: `shrine:road:${p.id}`, x: p.x, y: p.y, radius: 15, kind: 'shrine', seed: p.seed, scale: 1 }));
  }

  /** Immutable broad phase shared by footsteps, AI sight and projectile probes.
   * Exact query clipping and narrow-phase contacts below retain the original rules. */
  private collisionRegion(x: number, y: number, width: number, height: number) {
    const minX = Math.floor(x / COLLISION_CELL), minY = Math.floor(y / COLLISION_CELL);
    const maxX = Math.floor((x + width) / COLLISION_CELL), maxY = Math.floor((y + height) / COLLISION_CELL);
    const key = `${minX}:${minY}:${maxX}:${maxY}`, cached = this.collisionRegions.get(key);
    if (cached) return cached;
    const left = minX * COLLISION_CELL, top = minY * COLLISION_CELL;
    const w = (maxX - minX + 1) * COLLISION_CELL, h = (maxY - minY + 1) * COLLISION_CELL;
    const region = { props: this.getProps(left, top, w, h).filter(p => p.radius > 0),
      sites: this.getWildernessSites(left, top, w, h), buildings: this.getBuildings(left, top, w, h) };
    if (this.collisionRegions.size >= COLLISION_CACHE_LIMIT) this.collisionRegions.delete(this.collisionRegions.keys().next().value!);
    this.collisionRegions.set(key, region);
    return region;
  }

  impactMaterial(x: number, y: number, radius: number): MaterialId {
    const extent = radius + MAX_PROP_RADIUS;
    const region = this.collisionRegion(x - extent, y - extent, extent * 2, extent * 2);
    for (const prop of region.props) if (Math.hypot(x - prop.x, y - prop.y) < radius + prop.radius) {
      if (prop.kind === 'iceCrystal') return 'ice';
      return propDefinition(prop.kind).canopy || prop.kind === 'stump' ? 'wood' : 'stone';
    }
    for (const site of region.sites) for (const d of site.decor) if (d.radius > 0 && Math.hypot(x - d.x, y - d.y) < radius + d.radius)
      return ['crate', 'barrel', 'fence', 'wagon', 'wheel', 'tent', 'banner'].includes(d.kind) ? 'wood' : 'stone';
    return 'stone';
  }

  private brokenContainers: ReadonlySet<string> = new Set();
  setBrokenContainers(ids: ReadonlySet<string>): void { this.brokenContainers = ids; worldNavigation(this).clear(); }
  getContainers(x: number, y: number, radius: number): readonly BreakableContainer[] {
    if (!validWorldRectangle(x - radius, y - radius, radius * 2, radius * 2)) return [];
    const region = this.collisionRegion(x - radius, y - radius, radius * 2, radius * 2);
    const containers: BreakableContainer[] = region.sites.flatMap(site =>
      site.decor.filter((d): d is typeof d & { kind: 'crate' | 'barrel' } => d.kind === 'crate' || d.kind === 'barrel'));
    for (const building of region.buildings) for (let i = 0; i < building.furniture.length; i++) {
      const target = furnitureContainer(building, i); if (target) containers.push(target);
    }
    return containers.filter(d => !this.brokenContainers.has(d.id) && Math.hypot(d.x - x, d.y - y) <= radius + d.radius);
  }

  blocked(x: number, y: number, radius: number): boolean {
    if (![x, y].every(isWorldCoordinate) || !Number.isFinite(radius)
      || radius < 0 || radius > WORLD_QUERY_LIMITS.collisionRadius) return true;
    const extent = radius + MAX_PROP_RADIUS;
    if (!validWorldRectangle(x - extent, y - extent, extent * 2, extent * 2)) return true;
    const region = this.collisionRegion(x - extent, y - extent, extent * 2, extent * 2);
    if (region.props.some(prop => inRectangle(prop, x - extent, y - extent, extent * 2, extent * 2) &&
      (x - prop.x) ** 2 + (y - prop.y) ** 2 < (radius + prop.radius) ** 2 - 1e-7)) return true;
    const reach = Math.max(radius, .1);
    const query = { x: x - reach, y: y - reach, width: reach * 2, height: reach * 2 };
    if (region.sites.some(site => intersects(query, { x: site.x - site.radius, y: site.y - site.radius, width: site.radius * 2, height: site.radius * 2 }) &&
      site.decor.some(decor => decor.radius > 0 && !this.brokenContainers.has(decor.id) && (x - decor.x) ** 2 + (y - decor.y) ** 2 < (radius + decor.radius) ** 2 - 1e-7))) return true;
    return region.buildings.some(building => intersects(query, building) &&
      (building.walls.some(rect => circleHitsRect(x, y, radius, rect)) || building.furniture.some((rect, i) => !(rect.kind === 'barrel' && this.brokenContainers.has(furnitureContainerId(building, i))) && circleHitsRect(x, y, radius, rect))));
  }

  /** Test only the nearest discrete ray sample to each circle. This is the same
   * sampled collision rule as repeated blocked(), with one broad-phase query. */
  private sampledSegmentClear(ax:number,ay:number,bx:number,by:number,radius:number,steps:number,first:number,last:number):boolean|undefined {
    // Authored dungeon/custom worlds override blocked and retain their own geometry.
    if(this.blocked!==WorldLandscape.prototype.blocked)return undefined;
    if(first>last)return true;
    if(![ax,ay,bx,by].every(isWorldCoordinate)||radius<0||radius>WORLD_QUERY_LIMITS.collisionRadius||Math.hypot(bx-ax,by-ay)>4000)return undefined;
    const extent=radius+MAX_PROP_RADIUS;
    const region=this.collisionRegion(Math.min(ax,bx)-extent,Math.min(ay,by)-extent,Math.abs(bx-ax)+extent*2,Math.abs(by-ay)+extent*2);
    // Authored sites/architecture keep their existing bounds and breakable narrow phase.
    if(region.buildings.length||region.sites.length)return undefined;
    const dx=bx-ax,dy=by-ay,lengthSquared=dx*dx+dy*dy;
    const hit=(p:{x:number;y:number;radius:number})=>{
      const nearest=lengthSquared?Math.round(((p.x-ax)*dx+(p.y-ay)*dy)/lengthSquared*steps):first;
      const index=Math.max(first,Math.min(last,nearest)),x=ax+dx*index/steps,y=ay+dy*index/steps;
      return (x-p.x)**2+(y-p.y)**2<(radius+p.radius)**2-1e-7;
    };
    if(region.props.some(hit))return false;
    return true;
  }
  lineOfSight(ax:number,ay:number,bx:number,by:number):boolean|undefined {
    const steps=Math.ceil(Math.hypot(bx-ax,by-ay)/2);
    return this.sampledSegmentClear(ax,ay,bx,by,1,steps,1,steps-1);
  }
  walkableSegment(ax:number,ay:number,bx:number,by:number,radius:number):boolean|undefined {
    const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/8));
    const interior=this.sampledSegmentClear(ax,ay,bx,by,radius+4,steps,1,steps-1);
    if(interior===undefined)return undefined;
    if(!interior||this.blocked(ax,ay,radius)||this.blocked(bx,by,radius))return false;
    return !this.sanctuaryOnSegment(ax,ay,bx,by,steps);
  }

  protected sanctuaryOnSegment(ax:number,ay:number,bx:number,by:number,steps:number):boolean {
    if(this.isSanctuary===WorldLandscape.prototype.isSanctuary){
      const towns=this.getSettlements(Math.min(ax,bx),Math.min(ay,by),Math.abs(bx-ax)+.01,Math.abs(by-ay)+.01);
      // A completely clear segment needs no per-sample sanctuary queries.
      if(!towns.some(t=>segmentDistanceSquared(t.x,t.y,ax,ay,bx,by)<t.radius*t.radius))return false;
    }
    for(let i=0;i<=steps;i++)if(this.isSanctuary(ax+(bx-ax)*i/steps,ay+(by-ay)*i/steps))return true;
    return false;
  }

  /** Sweep short segments against trunk circles, preserving the unblocked axis. */
  navigationTarget(x:number,y:number,tx:number,ty:number,radius = 18) { return worldNavigation(this).target(x,y,tx,ty,radius); }
  move(x: number, y: number, dx: number, dy: number, radius: number): { x: number; y: number } {
    if (![x, y, x + dx, y + dy].every(isWorldCoordinate) || ![dx, dy, radius].every(Number.isFinite)
      || radius < 0 || radius > WORLD_QUERY_LIMITS.collisionRadius
      || Math.hypot(dx, dy) > WORLD_QUERY_LIMITS.movement) return { x, y };
    const extent = radius + MAX_PROP_RADIUS + 1;
    if (!validWorldRectangle(Math.min(x, x + dx) - extent, Math.min(y, y + dy) - extent,
      Math.abs(dx) + extent * 2, Math.abs(dy) + extent * 2)) return { x, y };
    const left = Math.min(x, x + dx), top = Math.min(y, y + dy);
    const width = Math.abs(dx), height = Math.abs(dy);
    const region = this.collisionRegion(left - extent, top - extent, width + extent * 2, height + extent * 2);
    const obstacles: Array<{ x: number; y: number; radius: number }> = region.props.filter(prop => inRectangle(prop, left - extent, top - extent, width + extent * 2, height + extent * 2));
    const query = { x: left - radius, y: top - radius, width: width + radius * 2 + .1, height: height + radius * 2 + .1 };
    for (const site of region.sites) if (intersects(query, { x: site.x - site.radius, y: site.y - site.radius, width: site.radius * 2, height: site.radius * 2 })) {
      for (const decor of site.decor) if (decor.radius > 0 && !this.brokenContainers.has(decor.id)) obstacles.push(decor);
    }
    const furniture = region.buildings.filter(building => intersects(query, building)).flatMap(building => [...building.walls, ...building.furniture.filter((rect, i) => !(rect.kind === 'barrel' && this.brokenContainers.has(furnitureContainerId(building, i))))]);
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

}
