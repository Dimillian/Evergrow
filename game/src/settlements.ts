import type { WorldPOI } from './world-pois.ts';
export type POI = WorldPOI;

export interface Rect { x: number; y: number; width: number; height: number; }
export type BuildingKind = 'blacksmith' | 'merchant' | 'inn' | 'house' | 'chapel';
export interface Building extends Rect {
  id: string;
  seed: number;
  name: string;
  kind: BuildingKind;
  door: { x: number; y: number; width: number };
  walls: Rect[];
  furniture: Array<Rect & { kind: string }>;
}
export interface Settlement {
  id: string;
  seed: number;
  name: string;
  kind: 'town' | 'city';
  x: number;
  y: number;
  radius: number;
  buildings: Building[];
  plaza: Rect;
  streets: Rect[];
}


export const FIRST_TOWN_Y = -1150;
export const TOWN_INTERVAL = 3200;
export const MAX_TOWN_RADIUS = 1000;
const NAMES = ['Briarwatch', 'Hollowmere', 'Alderrest', 'Mournbridge', 'Thornhaven', 'Willow Cross'];
const BUILDING_NAMES: Record<BuildingKind, string> = {
  blacksmith: 'The Ember Forge', merchant: 'Wayfarer Goods', inn: 'The Lantern Inn', house: 'Woodland House', chapel: 'Chapel of the Vigil',
};
const BUILDING_DESCRIPTIONS: Record<BuildingKind, string> = {
  blacksmith: 'Coal glows in the forge beside a scarred iron anvil.',
  merchant: 'Shelves of travel supplies stand above tightly sealed crates.',
  inn: 'Lamplit beds and a quiet common table offer shelter from the woods.',
  house: 'A modest timber home tucked beside the road.',
  chapel: 'Candles gather around an old stone altar beneath dark rafters.',
};

/** Cached generation is a blueprint; future mutable settlement state belongs elsewhere. */
export function freezeSettlement(town: Settlement): Settlement {
  for (const building of town.buildings) {
    Object.freeze(building.door);
    building.walls.forEach(Object.freeze); Object.freeze(building.walls);
    building.furniture.forEach(Object.freeze); Object.freeze(building.furniture);
    Object.freeze(building);
  }
  town.streets.forEach(Object.freeze); Object.freeze(town.streets);
  Object.freeze(town.plaza); Object.freeze(town.buildings);
  return Object.freeze(town);
}

export function contains(rect: Rect, x: number, y: number, margin = 0): boolean {
  return x >= rect.x - margin && x < rect.x + rect.width + margin && y >= rect.y - margin && y < rect.y + rect.height + margin;
}
export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
export function circleHitsRect(x: number, y: number, radius: number, rect: Rect): boolean {
  const dx = x - Math.max(rect.x, Math.min(rect.x + rect.width, x));
  const dy = y - Math.max(rect.y, Math.min(rect.y + rect.height, y));
  return radius === 0 ? contains(rect, x, y) : dx * dx + dy * dy < radius * radius - 1e-7;
}

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = Math.imul(state ^ state >>> 15, state | 1);
    x ^= x + Math.imul(x ^ x >>> 7, x | 61);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}

function building(id: string, seed: number, kind: BuildingKind, rect: Rect): Building {
  const { x, y, width, height } = rect;
  const door = { x: x + width / 2, y: y + height, width: 42 };
  const walls = [
    { x, y, width, height: 8 }, { x, y, width: 8, height }, { x: x + width - 8, y, width: 8, height },
    { x, y: door.y - 8, width: width / 2 - door.width / 2, height: 8 },
    { x: door.x + door.width / 2, y: door.y - 8, width: width / 2 - door.width / 2, height: 8 },
  ];
  const furniture: Building['furniture'] = [];
  const add = (kind: string, rx: number, ry: number, width: number, height: number) => furniture.push({ kind, x: x + rx, y: y + ry, width, height });
  if (kind === 'blacksmith') {
    add('forge', 15, 15, 35, 27); add('anvil', width - 43, height * .5, 25, 18); add('barrel', 16, height - 36, 17, 17);
  } else if (kind === 'merchant') {
    add('shelf', 15, 15, 37, 16); add('shelf', width - 52, 15, 37, 16);
    add('counter', 15, height * .53, 35, 16); add('barrel', width - 34, height - 35, 17, 17);
  } else if (kind === 'inn') {
    add('bed', 15, 15, 28, 39); add('bed', width - 43, 15, 28, 39);
    add('table', 16, height - 39, 28, 19); add('table', width - 44, height - 39, 28, 19);
  } else if (kind === 'chapel') {
    add('altar', width / 2 - 22, 16, 44, 18); add('table', 16, height * .5, 26, 16); add('table', width - 42, height * .5, 26, 16);
  } else {
    add('bed', 15, 15, 28, 39); add('table', width - 44, 19, 28, 22); add('shelf', width - 44, height - 34, 28, 15);
  }
  return { id, seed, kind, name: BUILDING_NAMES[kind], ...rect, door, walls, furniture };
}

/** Bounded seeded layout; every building faces an unobstructed south-side street. */
export function generateSettlement(seed: number, band: number,
  mainPathX: (y: number) => number, pathDistance: (x: number, y: number) => number): Settlement {
  const townSeed = (Math.imul(band, 0x45d9f3b) ^ seed ^ 0xabc719) >>> 0;
  const random = rng(townSeed);
  const y = FIRST_TOWN_Y + band * TOWN_INTERVAL;
  const x = mainPathX(y);
  const id = `town:${seed}:${band}`;
  const city = Math.abs(band) % 2 === 1;
  const target = band === 0 ? 8 : city ? 12 + Math.floor(random() * 5) : 5 + Math.floor(random() * 4);
  const buildings: Building[] = [];
  const streets: Rect[] = [];
  const plaza = { x: x - 105, y: y - 78, width: 210, height: 156 };
  // More sites than needed allow uninterrupted older crossroads to pass through towns.
  const sites = city
    ? [-270, 0, 270, -540, 540, -810, 810].flatMap(row => [false, true].flatMap(outer => [-1, 1].map(side => ({ row, side, outer }))))
    : [-330, -110, 110, 330, -550, 550].flatMap(row => [-1, 1].map(side => ({ row, side, outer: false })));
  if (!city) sites.push(...[-220, 0, 220].flatMap(row => [-1, 1].map(side => ({ row, side, outer: true }))));
  const kinds: BuildingKind[] = ['blacksmith', 'merchant', 'inn', 'chapel', 'house', 'house', 'house', 'house'];
  for (const site of sites) {
    if (buildings.length >= target) break;
    const width = 144 + Math.floor(random() * 43), height = 116 + Math.floor(random() * 36);
    const doorY = y + site.row + 22;
    const roadX = mainPathX(doorY);
    const centerX = roadX + site.side * ((site.outer ? 392 : 142) + width / 2);
    const rect = { x: centerX - width / 2, y: doorY - height, width, height };
    const requiredRadius = Math.hypot(centerX - x, rect.y + height / 2 - y) + Math.hypot(width, height) / 2 + 30;
    if (requiredRadius > (band === 0 ? 780 : MAX_TOWN_RADIUS)) continue;
    let reserved = false;
    for (let sx = rect.x - 20; sx <= rect.x + width + 20; sx += 12) {
      for (let sy = rect.y - 20; sy <= rect.y + height + 20; sy += 12) {
        if (pathDistance(sx, sy) < 43) { reserved = true; break; }
      }
      if (reserved) break;
    }
    if (reserved || buildings.some(other => intersects({ x: rect.x - 12, y: rect.y - 12, width: width + 24, height: height + 24 }, other))) continue;
    const next = building(`${id}:building:${buildings.length}`, (townSeed + buildings.length * 193) >>> 0, kinds[buildings.length] ?? 'house', rect);
    buildings.push(next);
    streets.push({ x: Math.min(roadX, next.door.x) - 28, y: doorY + 5, width: Math.abs(roadX - next.door.x) + 56, height: 44 });
    streets.push({ x: next.door.x - 28, y: doorY - 5, width: 56, height: 47 });
  }
  const radius = Math.max(310, ...buildings.map(b => Math.hypot(b.x + b.width / 2 - x, b.y + b.height / 2 - y) + Math.hypot(b.width, b.height) / 2 + 30));
  return { id, seed: townSeed, name: band === 0 ? 'Briarwatch' : NAMES[(townSeed % NAMES.length)], kind: city ? 'city' : 'town', x, y, radius, buildings, plaza, streets };
}

function smoothstep(a: number, b: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const PAVING_INNER = -6, PAVING_OUTER = 18, PAVING_JOIN = 22;

function pavingDistance(rect: Rect, x: number, y: number, paddingX: number, paddingY: number, rounding: number): number {
  const halfWidth = rect.width / 2 + paddingX, halfHeight = rect.height / 2 + paddingY;
  const radius = Math.min(rounding, halfWidth, halfHeight);
  const qx = Math.abs(x - rect.x - rect.width / 2) - halfWidth + radius;
  const qy = Math.abs(y - rect.y - rect.height / 2) - halfHeight + radius;
  return Math.hypot(Math.max(0, qx), Math.max(0, qy)) + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Polynomial smooth union rounds the concave corners where two lanes meet. */
function joinPaving(a: number, b: number, radius: number): number {
  if (radius <= 0) return Math.min(a, b);
  const overlap = Math.max(0, 1 - Math.abs(a - b) / radius);
  return Math.min(a, b) - overlap * overlap * radius * .25;
}

function buildingPavingClearance(town: Settlement, x: number, y: number, paved: number): number {
  for (const building of town.buildings) {
    if (x < building.x - 6 || x > building.x + building.width + 6
      || y < building.y - 6 || y > building.y + building.height + 6) continue;
    const dx = Math.max(building.x - x, 0, x - building.x - building.width);
    const dy = Math.max(building.y - y, 0, y - building.y - building.height);
    const outside = smoothstep(0, 6, Math.hypot(dx, dy));
    const apron = (1 - smoothstep(building.door.width / 2 - 5, building.door.width / 2, Math.abs(x - building.door.x)))
      * smoothstep(building.door.y - 10, building.door.y - 5, y);
    paved *= Math.max(outside, apron);
    if (paved <= 0) return 0;
  }
  return paved;
}

/** Shared continuous paving field; street rectangles remain the saved layout geometry. */
export function settlementPavingWeight(town: Settlement, x: number, y: number, road: number): number {
  const outskirts = 1 - smoothstep(town.radius - 180, town.radius - 20, Math.hypot(x - town.x, y - town.y));
  const incoming = Math.max(0, Math.min(1, road)) * outskirts;
  if (incoming >= 1) return buildingPavingClearance(town, x, y, 1);
  let distance = pavingDistance(town.plaza, x, y, 0, 0, 38);
  // All further unions only expand paving; its bounded wear cannot erode this core.
  if (distance <= PAVING_INNER - 1.5) return buildingPavingClearance(town, x, y, 1);
  for (let i = 0; i < town.streets.length; i++) {
    const street = town.streets[i];
    const lane = street.width > 120 && street.width > street.height * 2;
    let bow = 0;
    if (lane) {
      // Both authored road/door endpoints stay fixed; the middle bows at most 4.2 px.
      const t = Math.max(0, Math.min(1, (x - street.x - 28) / (street.width - 56)));
      const arch = t * (1 - t);
      bow = arch * arch * 67.2 * (((town.seed + i) & 2) ? 1 : -1);
    }
    // A fully paved 32 px walking corridor survives the bow and chipped shoulders.
    const next = pavingDistance(street, x, y - bow, lane ? 4 : 2, lane ? 10.5 : 5, lane ? 32 : 22);
    distance = joinPaving(distance, next, PAVING_JOIN);
    if (distance <= PAVING_INNER - 1.5) return buildingPavingClearance(town, x, y, 1);
  }
  // One world-space contour variation, rather than independent noise at tile or lane edges.
  distance += 1.5 * (Math.sin(x * .071 + y * .023) * .55
    + Math.sin(y * .109 - x * .041) * .3 + Math.sin(x * .23 + y * .17) * .15);
  let paved: number;
  if (distance <= PAVING_INNER) paved = 1;
  else if (distance >= PAVING_OUTER + PAVING_JOIN) paved = incoming;
  else {
    if (incoming > 0) {
      // Invert the coverage curve so road shoulders and the radial outskirts retain
      // their exact existing weight. The inverse is only needed near a street join.
      const t = .5 - Math.sin(Math.asin(2 * incoming - 1) / 3);
      const roadDistance = PAVING_INNER + (PAVING_OUTER - PAVING_INNER) * t;
      distance = joinPaving(distance, roadDistance, PAVING_JOIN * smoothstep(0, .22, incoming));
    }
    paved = 1 - smoothstep(PAVING_INNER, PAVING_OUTER, distance);
  }
  return paved > 0 ? buildingPavingClearance(town, x, y, paved) : 0;
}

export function settlementPOIs(town: Settlement): POI[] {
  return [
    { id: town.id, name: town.name, kind: 'town', x: town.x, y: town.y,
      description: town.kind === 'city' ? 'A sheltered market city with several blocks of shops and homes.' : 'A sheltered roadside town. Its doors stand open to travellers.' },
    ...town.buildings.filter(b => b.kind !== 'house').map(b => ({ id: `${b.id}:poi`, name: b.kind === 'merchant' ? 'Jeweler' : b.kind === 'chapel' ? 'Enchanter' : b.name, kind: b.kind === 'merchant' ? 'jeweler' : b.kind === 'chapel' ? 'enchanter' : b.kind,
      x: b.door.x, y: b.door.y, description: BUILDING_DESCRIPTIONS[b.kind] } as POI)),
  ];
}
