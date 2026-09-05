/** All coordinates are world pixels; prop positions are their ground contacts. */
export interface Prop {
  id: string;
  x: number;
  y: number;
  radius: number;
  kind: 'tree' | 'deadTree' | 'rock' | 'shrine';
  seed: number;
  scale: number;
}

export const TILE_SIZE = 256;
const PROP_CELL_SIZE = 80;
const MAX_PROP_RADIUS = 15;
const TILE_CACHE_LIMIT = 48;
const SHRINE_INTERVAL = 2200;
const BRANCH_INTERVAL = 1600;
const BRANCH_OFFSET = -620;
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

/** The central trail passes through the starting clearing and continues forever. */
export function mainPathX(y: number): number {
  return Math.sin(y / 580) * 78 + Math.sin(y / 210) * 22;
}

function branchY(x: number, band: number): number {
  return band * BRANCH_INTERVAL + BRANCH_OFFSET
    + Math.sin(x / 430) * 90 + Math.sin(x / 180) * 25;
}

/** Approximate normal distance to the nearest continuous trail centerline. */
export function pathDistance(x: number, y: number): number {
  const mainSlope = Math.cos(y / 580) * 78 / 580 + Math.cos(y / 210) * 22 / 210;
  let distance = Math.abs(x - mainPathX(y)) / Math.hypot(1, mainSlope);
  const nearestBand = Math.round((y - BRANCH_OFFSET) / BRANCH_INTERVAL);
  const branchSlope = Math.cos(x / 430) * 90 / 430 + Math.cos(x / 180) * 25 / 180;
  for (let band = nearestBand - 1; band <= nearestBand + 1; band++) {
    distance = Math.min(distance, Math.abs(y - branchY(x, band)) / Math.hypot(1, branchSlope));
  }
  return distance;
}

function inRectangle(prop: Prop, x: number, y: number, width: number, height: number): boolean {
  return prop.x >= x && prop.x < x + width && prop.y >= y && prop.y < y + height;
}

function compareProps(a: Prop, b: Prop): number {
  return a.y - b.y || a.x - b.x || a.id.localeCompare(b.id);
}

export class World {
  readonly seed: number;
  private groundTiles = new Map<string, HTMLCanvasElement>();

  constructor(seed = 7319) {
    this.seed = seed | 0;
  }

  /** Half-open rectangle of ground contacts, returned in stable depth order. */
  getProps(x: number, y: number, width: number, height: number): Prop[] {
    if (![x, y, width, height, x + width, y + height].every(Number.isFinite)
      || width <= 0 || height <= 0) return [];

    const result: Prop[] = [];
    const minCellX = Math.floor(x / PROP_CELL_SIZE);
    const minCellY = Math.floor(y / PROP_CELL_SIZE);
    const maxCellX = Math.floor((x + width) / PROP_CELL_SIZE);
    const maxCellY = Math.floor((y + height) / PROP_CELL_SIZE);

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
    const roadsideShrine = this.roadShrine(Math.floor(y / SHRINE_INTERVAL));
    if (roadsideShrine && Math.hypot(x - roadsideShrine.x, y - roadsideShrine.y) < 44) return null;
    const density = 0.40 + noise(x / 520, y / 520, this.seed + 37) * 0.39;
    if (random(cx, cy, this.seed, 3) > density) return null;
    const choice = random(cx, cy, this.seed, 4);
    const kind: Prop['kind'] = choice < 0.18 ? 'rock' : choice < 0.76 ? 'deadTree' : 'tree';
    const scale = 0.82 + random(cx, cy, this.seed, 5) * 0.38;
    const radius = kind === 'rock'
      ? 8 + random(cx, cy, this.seed, 6) * 5
      : 9 + random(cx, cy, this.seed, 6) * 5;
    return { id: `prop:${cx}:${cy}`, x, y, radius, kind, seed: hash(cx, cy, this.seed, 7), scale };
  }

  private roadShrine(band: number): Prop | null {
    if (random(band, 0, this.seed, 101) > 0.5) return null;
    const y = band * SHRINE_INTERVAL + 500 + random(band, 0, this.seed, 102) * 950;
    if (Math.abs(y) < 450) return null;
    const side = random(band, 0, this.seed, 103) < 0.5 ? -1 : 1;
    return {
      id: `shrine:road:${band}`, x: mainPathX(y) + side * 53, y,
      radius: 15, kind: 'shrine', seed: hash(band, 0, this.seed, 104), scale: 1,
    };
  }

  blocked(x: number, y: number, radius: number): boolean {
    if (![x, y, radius].every(Number.isFinite) || radius < 0) return true;
    const extent = radius + MAX_PROP_RADIUS;
    return this.getProps(x - extent, y - extent, extent * 2, extent * 2).some(prop =>
      (x - prop.x) ** 2 + (y - prop.y) ** 2 < (radius + prop.radius) ** 2 - 1e-7);
  }

  /** Sweep short segments against trunk circles, preserving the unblocked axis. */
  move(x: number, y: number, dx: number, dy: number, radius: number): { x: number; y: number } {
    if (![x, y, dx, dy, radius].every(Number.isFinite) || radius < 0) return { x, y };
    const extent = radius + MAX_PROP_RADIUS + 1;
    const props = this.getProps(Math.min(x, x + dx) - extent, Math.min(y, y + dy) - extent,
      Math.abs(dx) + extent * 2, Math.abs(dy) + extent * 2);
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
    const sx = dx / steps;
    const sy = dy / steps;

    const segmentBlocked = (ax: number, ay: number, bx: number, by: number): boolean => {
      const vx = bx - ax;
      const vy = by - ay;
      const lengthSquared = vx * vx + vy * vy;
      return props.some(prop => {
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
    if (!Number.isSafeInteger(tileX) || !Number.isSafeInteger(tileY)) {
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
    // Every material sample and detail anchor is in world space. Tile edges are
    // merely a crop of the same illustration, including at negative coordinates.
    for (let y = 0; y < TILE_SIZE; y += 4) {
      for (let x = 0; x < TILE_SIZE; x += 4) {
        const wx = originX + x + 2;
        const wy = originY + y + 2;
        const damp = noise(wx / 180, wy / 180, this.seed + 201);
        const grain = noise(wx / 19, wy / 19, this.seed + 202) - 0.5;
        const moss = smoothstep(0.50, 0.85, damp) * 0.65;
        const distance = pathDistance(wx, wy);
        const shoulder = 30 + noise(wx / 65, wy / 65, this.seed + 203) * 11;
        const road = 1 - smoothstep(shoulder - 5, shoulder + 14, distance);
        const rut = (1 - smoothstep(0, 2.5, Math.abs(distance - 11))) * road;
        const shade = grain * 5 - rut * 1.5;
        const red = Math.round((22 + moss * 10) * (1 - road) + 64 * road + shade);
        const green = Math.round((40 + moss * 35) * (1 - road) + 54 * road + shade);
        const blue = Math.round((43 + moss * 13) * (1 - road) + 37 * road + shade);
        context.fillStyle = `rgb(${red},${green},${blue})`;
        context.fillRect(x, y, 4, 4);
      }
    }

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

        if (pick < (onRoad ? 0.08 : 0.49)) {
          const length = 3 + random(cx, cy, this.seed, 214) * 5;
          const lean = random(cx, cy, this.seed, 215) * 5 - 2.5;
          context.strokeStyle = 'rgba(90,144,96,0.26)';
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
