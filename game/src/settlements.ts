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
export interface POI {
  id: string;
  name: string;
  kind: 'town' | 'blacksmith' | 'merchant' | 'inn' | 'chapel' | 'shrine' | 'landmark';
  x: number;
  y: number;
  description: string;
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

/** Rounded contours and a soft shoulder join every street into one material. */
function roundedPaving(rect: Rect, x: number, y: number): number {
  const radius = Math.min(18, rect.width / 2, rect.height / 2);
  const qx = Math.abs(x - rect.x - rect.width / 2) - rect.width / 2 + radius;
  const qy = Math.abs(y - rect.y - rect.height / 2) - rect.height / 2 + radius;
  const distance = Math.hypot(Math.max(0, qx), Math.max(0, qy)) + Math.min(Math.max(qx, qy), 0) - radius;
  return 1 - smoothstep(-4, 10, distance);
}

/** Shared by ground and map rendering; main/crossroads become cobbles inside town. */
export function settlementPavingWeight(town: Settlement, x: number, y: number, road: number): number {
  const outskirts = 1 - smoothstep(town.radius - 180, town.radius - 20, Math.hypot(x - town.x, y - town.y));
  let paved = Math.max(road * outskirts, roundedPaving(town.plaza, x, y));
  for (const street of town.streets) paved = Math.max(paved, roundedPaving(street, x, y));
  return paved;
}

export function settlementPOIs(town: Settlement): POI[] {
  return [
    { id: town.id, name: town.name, kind: 'town', x: town.x, y: town.y,
      description: town.kind === 'city' ? 'A sheltered market city with several blocks of shops and homes.' : 'A sheltered roadside town. Its doors stand open to travellers.' },
    ...town.buildings.filter(b => b.kind !== 'house').map(b => ({ id: `${b.id}:poi`, name: b.name, kind: b.kind,
      x: b.door.x, y: b.door.y, description: BUILDING_DESCRIPTIONS[b.kind] } as POI)),
  ];
}
