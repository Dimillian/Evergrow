import type { Building, Rect } from './settlements.ts';
import type { PointLight } from './lighting.ts';
import { drawGlow } from './lighting.ts';

type Point = readonly [number, number];
type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;
interface ImageLayer { image: HTMLCanvasElement; x: number; y: number; }
interface FurnitureLayer extends ImageLayer { depth: number; kind: string; source: Rect; }
interface BuildingArt { floor: ImageLayer; roof: ImageLayer; furniture: FurnitureLayer[]; }
export interface StructureLayer { y: number; draw(c: CanvasRenderingContext2D): void; }
interface Reveal { open: boolean; opacity: number; }
const WALL_HEIGHT = 42;
const TAU = Math.PI * 2;
const MAX_CACHED_BUILDINGS = 24;

function hash(seed: number): number {
  let n = seed | 0; n = Math.imul(n ^ n >>> 16, 0x45d9f3b);
  n = Math.imul(n ^ n >>> 16, 0x45d9f3b); return (n ^ n >>> 16) >>> 0;
}
function rand(seed: number, salt: number) { return hash(seed + Math.imul(salt, 7879)) / 0x100000000; }
function inside(b: Rect, x: number, y: number, margin = 0) {
  return x >= b.x - margin && x <= b.x + b.width + margin && y >= b.y - margin && y <= b.y + b.height + margin;
}
function roofRise(b: Building) { return Math.min(36, Math.max(22, b.width * .19)) + (b.kind === 'chapel' ? 7 : 0); }
function facadeWindows(b: Building): Array<{ x: number; sign: boolean }> {
  const half = b.door.width / 2;
  const sides = [{ start: b.x, end: b.door.x - half, right: false },
    { start: b.door.x + half, end: b.x + b.width, right: true }];
  return sides.flatMap(side => {
    const width = side.end - side.start;
    const count = width >= 65 ? 2 : 1;
    return Array.from({ length: count }, (_, index) => ({
      x: side.start + width * (index + 1) / (count + 1),
      sign: side.right && index === 0 && b.kind !== 'house',
    }));
  });
}
function polygon(c: CanvasRenderingContext2D, points: readonly Point[], fill: string) {
  c.beginPath(); c.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) c.lineTo(...points[i]);
  c.closePath(); c.fillStyle = fill; c.fill();
}
function line(c: CanvasRenderingContext2D, points: readonly Point[], color: string, width = 1) {
  c.beginPath(); c.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) c.lineTo(...points[i]);
  c.strokeStyle = color; c.lineWidth = width; c.stroke();
}

/** Floors, wall footprints and furniture use the same coordinates as collision. */
export class SettlementArt {
  private cache = new Map<string, BuildingArt>();
  private reveal = new Map<string, Reveal>();
  private factory: CanvasFactory;
  private playerX = 0;
  private playerY = 0;
  private reducedMotion = false;

  constructor(createCanvas?: CanvasFactory) {
    this.factory = createCanvas ?? ((width, height) => {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas;
    });
  }

  reset() { this.cache.clear(); this.reveal.clear(); }

  update(buildings: readonly Building[], playerX: number, playerY: number, dt: number, reducedMotion: boolean) {
    this.playerX = playerX; this.playerY = playerY; this.reducedMotion = reducedMotion;
    const visible = new Set(buildings.map(b => b.id));
    for (const id of this.reveal.keys()) if (!visible.has(id)) this.reveal.delete(id);
    for (const b of buildings) {
      const doorDistance = Math.hypot((playerX - b.door.x) * .9, playerY - b.door.y);
      const approaching = Math.abs(playerX - b.door.x) < b.door.width / 2 + 19
        && playerY >= b.door.y - 14 && playerY <= b.door.y + 49;
      // Compare the projected roof with the character's silhouette, including
      // someone beside a wall or just south of it, before their feet enter.
      const roofBack = WALL_HEIGHT + roofRise(b) + 9;
      const roofOccludes = playerX >= b.x - 24 && playerX <= b.x + b.width + 24
        && playerY >= b.y - roofBack && playerY <= b.y + b.height + 29;
      const nearRoof = playerX >= b.x - 38 && playerX <= b.x + b.width + 38
        && playerY >= b.y - roofBack - 14 && playerY <= b.y + b.height + 43;
      const revealNow = inside(b, playerX, playerY, 3) || approaching || roofOccludes;
      const old = this.reveal.get(b.id);
      const open = revealNow || !!old?.open && (nearRoof || doorDistance < 70);
      const state = old ?? { open, opacity: open ? 0 : 1 };
      state.open = open;
      const target = open ? 0 : 1;
      const blend = 1 - Math.exp(-Math.max(0, Math.min(.1, dt)) * (open ? 8 : 4.5));
      state.opacity += (target - state.opacity) * blend;
      if (Math.abs(state.opacity - target) < .002) state.opacity = target;
      this.reveal.set(b.id, state);
    }
    while (this.reveal.size > 48) this.reveal.delete(this.reveal.keys().next().value!);
  }

  private layer(width: number, height: number, x: number, y: number, draw: (c: CanvasRenderingContext2D) => void): ImageLayer {
    const image = this.factory(Math.ceil(width), Math.ceil(height)); image.width = Math.ceil(width); image.height = Math.ceil(height);
    const c = image.getContext('2d');
    if (!c) throw new Error('A 2D canvas context is required for settlement art.');
    c.translate(-x, -y); draw(c);
    return { image, x, y };
  }

  private art(b: Building): BuildingArt {
    const cached = this.cache.get(b.id);
    if (cached) { this.cache.delete(b.id); this.cache.set(b.id, cached); return cached; }
    const local: Building = { ...b, x: 0, y: 0, door: { ...b.door, x: b.door.x - b.x, y: b.door.y - b.y },
      walls: b.walls.map(r => ({ ...r, x: r.x - b.x, y: r.y - b.y })),
      furniture: b.furniture.map(r => ({ ...r, x: r.x - b.x, y: r.y - b.y })) };
    const floor = this.layer(b.width + 20, b.height + 27, -10, -7, c => this.floor(c, local));
    const furniture = local.furniture.map(item => ({
      ...this.layer(item.width + 16, item.height + 38, item.x - 8, item.y - 31, c => this.furnish(c, item, b.seed)),
      depth: item.y + item.height, kind: item.kind, source: item,
    }));
    const roofPadding = Math.ceil(WALL_HEIGHT + roofRise(b) + 36);
    const roof = this.layer(b.width + 36, b.height + roofPadding + 6, -18, -roofPadding, c => this.roof(c, local));
    const result = { floor, roof, furniture };
    this.cache.set(b.id, result);
    if (this.cache.size > MAX_CACHED_BUILDINGS) this.cache.delete(this.cache.keys().next().value!);
    return result;
  }

  drawGround(c: CanvasRenderingContext2D, buildings: readonly Building[], _time: number) {
    for (const b of buildings) {
      const layer = this.art(b).floor;
      c.drawImage(layer.image, b.x + layer.x, b.y + layer.y);
    }
  }

  private floor(c: CanvasRenderingContext2D, b: Building) {
    const { width: w, height: h } = b;
    polygon(c, [[-6, 2], [w + 8, 3], [w + 10, h + 8], [-5, h + 8]], '#06101360');
    c.fillStyle = '#4a4b42'; c.fillRect(-3, -2, w + 6, h + 6);
    c.fillStyle = '#2a302e'; c.fillRect(0, 0, w, h);
    const stone = b.kind === 'blacksmith' || b.kind === 'chapel';
    c.save(); c.beginPath(); c.rect(4, 4, w - 8, h - 8); c.clip();
    const rowHeight = stone ? 14 : 10;
    for (let row = 0; row < Math.ceil(h / rowHeight); row++) {
      const block = stone ? 21 : 42;
      for (let col = -1; col < Math.ceil(w / block); col++) {
        const x = col * block + (row % 2 ? block * .5 : 0), y = row * rowHeight;
        const tone = rand(b.seed, row * 37 + col + 79);
        c.fillStyle = stone ? (tone > .5 ? '#666558' : '#5b5c51') : (tone > .5 ? '#725e44' : '#64533e');
        c.fillRect(x + .7, y + .7, block - 1.4, rowHeight - 1.4);
        line(c, [[x + 2, y + 1], [x + block - 2, y + 1]], stone ? '#88847160' : '#aa8b5940', .7);
        if (!stone) {
          line(c, [[x + 5, y + 5], [x + block - 6, y + 4]], '#322f2650', .65);
          c.fillStyle = '#282d2980'; c.fillRect(x + 2, y + 4, .7, .7);
        }
      }
    }
    if (b.kind === 'inn' || b.kind === 'chapel' || b.kind === 'merchant') {
      const rw = Math.min(b.kind === 'chapel' ? 39 : 49, w * .3), x = w / 2 - rw / 2;
      const color = b.kind === 'merchant' ? '#3c6459' : '#6f3344';
      c.fillStyle = '#22292e80'; c.fillRect(x - 2, 27, rw + 4, h - 38);
      c.fillStyle = color; c.fillRect(x, 28, rw, h - 40);
      c.strokeStyle = '#b394635e'; c.lineWidth = 1; c.strokeRect(x + 2.5, 30.5, rw - 5, h - 45);
      for (let y = 35; y < h - 18; y += 15) polygon(c, [[w / 2, y - 3], [w / 2 + 3, y], [w / 2, y + 3], [w / 2 - 3, y]], '#c4a46c50');
    }
    // Floor decoration stays flat: all upright furniture comes from collision footprints.
    c.strokeStyle = stone ? '#b9af8547' : '#cfaa6e35'; c.lineWidth = 1;
    c.strokeRect(10.5, 10.5, w - 21, h - 21);
    for (const item of b.furniture) {
      if (item.kind === 'forge' || item.kind === 'anvil') {
        c.fillStyle = '#1b25233b'; c.beginPath();
        c.ellipse(item.x + item.width / 2, item.y + item.height - 3, item.width * .8, item.height * .8, 0, 0, TAU); c.fill();
        for (let mark = 0; mark < 6; mark++) {
          const x = item.x + rand(b.seed, mark + 230) * item.width;
          const y = item.y + item.height + rand(b.seed, mark + 271) * 12;
          line(c, [[x, y], [x + 3, y - 1]], '#c5a07050', .8);
        }
      } else if (item.kind === 'bed') {
        c.fillStyle = '#8f735542'; c.fillRect(item.x - 3, item.y + item.height - 11, item.width + 6, 18);
        line(c, [[item.x - 2, item.y + item.height + 4], [item.x + item.width + 2, item.y + item.height + 4]], '#d1ae745c', 1);
      }
    }
    if (b.kind === 'chapel') {
      const cy = h * .59;
      c.strokeStyle = '#c2a77580'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(w / 2, cy, 16, 11, 0, 0, TAU); c.stroke();
      polygon(c, [[w / 2, cy - 15], [w / 2 + 4, cy - 3], [w / 2 + 12, cy], [w / 2 + 4, cy + 3],
        [w / 2, cy + 15], [w / 2 - 4, cy + 3], [w / 2 - 12, cy], [w / 2 - 4, cy - 3]], '#c6b17b80');
    }
    for (const window of facadeWindows(b)) {
      if (window.sign) continue;
      polygon(c, [[window.x - 6, h - 9], [window.x + 6, h - 9], [window.x + 17, h - 43], [window.x - 9, h - 45]], '#edc8880d');
    }
    c.restore();
    const dx = b.door.x;
    c.fillStyle = '#716b55'; c.fillRect(dx - b.door.width / 2 - 3, h - 5, b.door.width + 6, 10);
    c.fillStyle = '#8d8165'; c.fillRect(dx - b.door.width / 2 - 5, h + 4, b.door.width + 10, 5);
    line(c, [[dx - b.door.width / 2 - 4, h + 4.5], [dx + b.door.width / 2 + 4, h + 4.5]], '#c5b184', .8);
    c.fillStyle = '#393d3480'; c.fillRect(dx - b.door.width / 2 - 6, h + 9, b.door.width + 12, 2);
  }

  private furnish(c: CanvasRenderingContext2D, item: Rect & { kind: string }, seed: number) {
    const { x, y, width: w, height: h } = item;
    c.save(); c.translate(x, y);
    c.fillStyle = '#070e135c'; c.fillRect(-1, 2, w + 3, h + 1);
    if (item.kind === 'bed') {
      c.fillStyle = '#39362d'; c.fillRect(0, -5, w, h + 5);
      c.fillStyle = '#8b7752'; c.fillRect(0, -7, w, 4);
      c.fillStyle = '#aaa183'; c.fillRect(2, -2, w - 4, h - 2);
      c.fillStyle = '#d4cbb0'; c.fillRect(4, 0, w - 8, 6);
      c.fillStyle = seed % 2 ? '#426879' : '#874c52'; c.fillRect(2, 8, w - 4, h - 10);
      line(c, [[3, 10], [w - 3, 10]], '#d0af815c', 1.4);
      line(c, [[w * .68, 10], [w * .72, h - 4]], '#0e283e45', 1.4);
      for (let seam = 0; seam < 3; seam++) line(c, [[4, 16 + seam * 6], [w - 4, 16 + seam * 6]], '#cdab7c24', .7);
      for (const px of [1, w - 3]) { c.fillStyle = '#a18a60'; c.fillRect(px, h - 5, 2, 7); }
    } else if (item.kind === 'forge') {
      c.fillStyle = '#343d3b'; c.fillRect(0, -20, w, h + 20);
      c.fillStyle = '#697066'; c.fillRect(0, -21, w, 5);
      for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
        c.strokeStyle = '#92917a45'; c.lineWidth = .8;
        c.strokeRect(col * w / 3 + (row % 2 ? -3 : 0), -15 + row * 8, w / 3, 8);
      }
      polygon(c, [[4, h - 4], [4, -4], [9, -10], [w - 9, -10], [w - 4, -4], [w - 4, h - 4]], '#131e23');
      polygon(c, [[5, h - 5], [7, h - 11], [w - 9, h - 13], [w - 5, h - 4]], '#cd6034');
      c.fillStyle = '#ffb865'; c.fillRect(8, h - 8, w - 16, 2);
      c.fillStyle = '#8b7d5b'; c.fillRect(-1, h - 3, w + 2, 4);
    } else if (item.kind === 'anvil') {
      c.fillStyle = '#443e30'; c.fillRect(w * .25, h * .35, w * .5, h * .6);
      polygon(c, [[1, 0], [w * .7, -4], [w + 2, -1], [w * .79, 3], [w * .57, 4], [w * .64, 9], [w * .26, 9], [w * .33, 3], [0, 3]], '#637c7b');
      line(c, [[1, -.5], [w * .7, -4], [w + 1, -1]], '#cad0b1', 1);
    } else if (item.kind === 'barrel') {
      c.fillStyle = '#5c4d37'; c.beginPath(); c.ellipse(w / 2, h / 2 - 3, w / 2, h / 2 + 4, 0, 0, TAU); c.fill();
      c.strokeStyle = '#91977f'; c.lineWidth = 1.2;
      for (const yy of [h * .25 - 4, h * .7 - 2]) { c.beginPath(); c.ellipse(w / 2, yy, w / 2, 2.1, 0, 0, Math.PI); c.stroke(); }
      c.fillStyle = '#99835b'; c.beginPath(); c.ellipse(w / 2, -3, w / 2 - .5, 3, 0, 0, TAU); c.fill();
      line(c, [[w * .3, -3], [w * .75, -3]], '#4c4536', .6);
    } else if (item.kind === 'shelf') {
      c.fillStyle = '#38372e'; c.fillRect(0, -12, w, h + 12);
      for (let row = 0; row < 2; row++) {
        c.fillStyle = '#a0875d'; c.fillRect(0, -10 + row * 11, w, 2);
        const count = Math.max(4, Math.floor((w - 5) / 7));
        for (let object = 0; object < count; object++) {
          const px = 3 + object * (w - 5) / count, py = -5 + row * 11;
          c.fillStyle = ['#769f95', '#ad8568', '#777ba0'][object % 3]; c.fillRect(px, py - 4, 3, 5);
          c.fillStyle = '#c8b67d'; c.fillRect(px + .5, py - 5, 2, 1);
          if (object % 3 === 2) {
            c.fillStyle = '#b2997b'; c.fillRect(px + 3, py - 3, 2, 4);
            c.fillStyle = '#523f36'; c.fillRect(px + 3.4, py - 2, .6, 2);
          }
        }
      }
    } else {
      const stone = item.kind === 'altar', top = stone ? '#8c8b76' : '#977951';
      c.fillStyle = stone ? '#485557' : '#3f3b30'; c.fillRect(1, -4, w - 2, h + 3);
      c.fillStyle = top; c.fillRect(0, -7, w, h);
      line(c, [[1, -6.5], [w - 1, -6.5]], stone ? '#d0c9a4' : '#cbb181', .8);
      if (item.kind === 'counter') {
        c.fillStyle = '#b9c1aa'; c.fillRect(w - 10, -5, 7, 5);
        line(c, [[w - 9, -3], [w - 5, -3]], '#65716b', .6);
        c.fillStyle = '#d1af65'; c.beginPath(); c.ellipse(7, 0, 2.5, 1.5, 0, 0, TAU); c.fill();
        c.fillStyle = '#745264'; c.fillRect(w * .4, -5, 8, 5);
        line(c, [[w * .4 + 1, -3], [w * .4 + 7, -3]], '#c3aa80', .7);
      } else if (stone) {
        c.fillStyle = '#713c52'; c.fillRect(w / 2 - 6, -7, 12, h + 2);
        for (const px of [5, w - 6]) { c.fillStyle = '#d4c9a0'; c.fillRect(px, -12, 1.5, 7); c.fillStyle = '#ffe9a0'; c.fillRect(px, -13, 1.5, 2); }
      } else {
        c.fillStyle = '#b9a178'; c.beginPath(); c.ellipse(w / 2, -1, 4.5, 2.5, 0, 0, TAU); c.fill();
        c.fillStyle = '#72503b'; c.fillRect(w - 7, -4, 3, 3);
      }
    }
    c.restore();
  }

  drawStructure(c: CanvasRenderingContext2D, b: Building, time: number) {
    for (const layer of this.getStructureLayers(b, time).sort((a, z) => a.y - z.y)) layer.draw(c);
  }

  /** Insert each footprint depth alongside actors so furnishings cannot cover someone in front. */
  getStructureLayers(b: Building, time: number): StructureLayer[] {
    const opacity = this.reveal.get(b.id)?.opacity ?? 1;
    const t = this.reducedMotion ? 0 : time;
    const layers: StructureLayer[] = [];
    // The back wall stays tall; sides and the foreground wall become a cutaway.
    for (const wall of b.walls) {
      const south = wall.width >= wall.height && Math.abs(wall.y + wall.height - b.y - b.height) < .01;
      const side = wall.width < wall.height;
      const height = south ? 7 + opacity * (WALL_HEIGHT - 7) : side ? 14 + opacity * (WALL_HEIGHT - 14) : WALL_HEIGHT;
      layers.push({ y: wall.y + wall.height, draw: c => {
        c.save(); this.wall(c, wall, height, b.kind); c.restore();
      } });
    }
    for (const item of this.art(b).furniture) {
      layers.push({ y: b.y + item.depth, draw: c => {
        c.save(); c.drawImage(item.image, b.x + item.x, b.y + item.y);
        if (item.kind === 'forge' && opacity < .96) {
          const x = b.x + item.source.x + item.source.width / 2;
          const y = b.y + item.source.y + item.source.height - 8;
          drawGlow(c, x, y, 24, '#ff9f4f', (1 - opacity) * .45);
          for (let i = 0; i < 4; i++) {
            const phase = t * (2 + i * .3) + i * 1.7;
            polygon(c, [[x - 6 + i * 3, y + 1], [x - 5 + i * 3 + Math.sin(phase), y - 4 - Math.sin(phase * .7) * 2],
              [x - 3 + i * 3, y + 1]], i % 2 ? '#ffdf92' : '#f58540');
          }
        }
        c.restore();
      } });
    }
    layers.push({ y: b.door.y + .1, draw: c => this.entrance(c, b, opacity, t) });
    return layers;
  }

  private entrance(c: CanvasRenderingContext2D, b: Building, opacity: number, time: number) {
    c.save();
    const front = b.door.y, dx = b.door.x, half = b.door.width / 2;
    // Hinges and open leaves attach to the jambs, never cover the passable doorway.
    const jambHeight = 25 + opacity * 17;
    for (const side of [-1, 1]) {
      const x = dx + side * half;
      c.fillStyle = '#372e29'; c.fillRect(x - 1.5, front - jambHeight, 3, jambHeight + 1);
      line(c, [[x - .5, front - jambHeight], [x - .5, front - 1]], '#b19966', .7);
      polygon(c, [[x + side * 2, front - jambHeight + 2], [x + side * 8, front - jambHeight + 5],
        [x + side * 8, front - 2], [x + side * 2, front - 1]], '#554731');
      line(c, [[x + side * 3, front - jambHeight + 4], [x + side * 7, front - jambHeight + 6]], '#9e885b', .7);
    }
    const facade = opacity > .05 ? opacity : 0;
    if (facade > 0) {
      c.save(); c.globalAlpha *= facade;
      for (const [index, window] of facadeWindows(b).entries()) {
        if (window.sign) this.sign(c, window.x, front - 24, b.kind);
        else this.window(c, window.x, front - 23, b.kind === 'chapel', time, b.seed + index * 5);
      }
      c.restore();
    }
    this.lantern(c, dx - half - 8, front - 26, time, b.seed);
    c.restore();
  }

  private wall(c: CanvasRenderingContext2D, r: Rect, height: number, kind: Building['kind']) {
    const stone = kind === 'chapel' || kind === 'blacksmith';
    c.fillStyle = stone ? '#4c5c5c' : '#8b856a'; c.fillRect(r.x, r.y - height, r.width, r.height + height);
    c.fillStyle = stone ? '#75827b' : '#a19878'; c.fillRect(r.x, r.y - height, r.width, Math.min(4, r.height));
    line(c, [[r.x + .5, r.y - height + .5], [r.x + r.width - .5, r.y - height + .5]], '#c2b08a', .75);
    if (stone) {
      c.strokeStyle = '#1a30373c'; c.lineWidth = .7;
      for (let y = r.y - height + 6; y < r.y + r.height; y += 7) {
        c.beginPath(); c.moveTo(r.x, y); c.lineTo(r.x + r.width, y); c.stroke();
      }
    } else {
      c.fillStyle = '#443b30';
      if (r.width > 12) {
        c.fillRect(r.x, r.y - height, r.width, 2);
        c.fillRect(r.x, r.y + r.height - 4, r.width, 3);
        for (let x = r.x + 3; x < r.x + r.width; x += 27) {
          c.fillRect(x, r.y - height + 1, 2.5, height + r.height - 3);
          if (x + 24 < r.x + r.width) line(c, [[x + 2, r.y + r.height - 5], [x + 25, r.y - height + 4]], '#514936', 2);
        }
      } else c.fillRect(r.x + 1, r.y - height, 2, r.height + height);
    }
  }

  private window(c: CanvasRenderingContext2D, x: number, y: number, chapel: boolean, time: number, seed: number) {
    c.save(); c.translate(x, y);
    const opacity = c.globalAlpha;
    polygon(c, [[-9, 8], [-9, -7], [0, -15], [9, -7], [9, 8]], '#283b40');
    polygon(c, [[-7, 6], [-7, -6], [0, -12], [7, -6], [7, 6]], chapel ? '#98b5a1' : '#ddb36f');
    c.fillStyle = chapel ? '#ddc584' : '#ffe5a3'; c.globalAlpha *= .7 + Math.sin(time * 3.7 + seed) * .08;
    c.fillRect(-5, -4, 3, 9); c.globalAlpha = opacity;
    line(c, [[0, -12], [0, 6]], '#5b634f', 1.3);
    line(c, [[-7, -1], [7, -1]], '#5b634f', 1.2);
    line(c, [[-10, 9], [10, 9]], '#b0a080', 2);
    if (chapel) {
      line(c, [[-7, -6], [0, -1], [7, -6]], '#626e59', .8);
      polygon(c, [[0, -9], [2, -7], [0, -5], [-2, -7]], '#efc77b');
    }
    c.restore();
  }

  private lantern(c: CanvasRenderingContext2D, x: number, y: number, time: number, seed: number) {
    c.save(); c.translate(x, y);
    line(c, [[-3, -8], [1, -10], [5, -8], [5, -4]], '#766b50', 1.3);
    polygon(c, [[1, -3], [5, -6], [9, -3], [8, 5], [2, 5]], '#253234');
    polygon(c, [[3, -2], [5, -4], [7, -2], [7, 4], [3, 4]], '#ffc878');
    c.fillStyle = '#fff0b7'; c.fillRect(4.5, -1, 1, 4);
    drawGlow(c, 5, 0, 19, '#ffc071', .25 + Math.sin(time * 5 + seed) * .025);
    c.restore();
  }

  private sign(c: CanvasRenderingContext2D, x: number, y: number, kind: Building['kind']) {
    c.save(); c.translate(x, y);
    line(c, [[-9, -8], [-9, -12], [8, -12]], '#9b8c63', 1.2);
    line(c, [[-5, -12], [-5, -7], [5, -7], [5, -12]], '#514b3c', .8);
    polygon(c, [[-9, -7], [9, -7], [10, 5], [6, 8], [-7, 7], [-10, 4]], kind === 'inn' ? '#3a5660' : kind === 'merchant' ? '#3d6253' : '#503c3d');
    c.strokeStyle = '#c6aa74'; c.lineWidth = .8; c.stroke();
    c.strokeStyle = '#e0c795'; c.lineWidth = 1.2; c.lineJoin = 'round';
    if (kind === 'blacksmith') {
      polygon(c, [[-6, -2], [2, -3], [7, -1], [2, 1], [1, 4], [-3, 4], [-3, 1], [-6, 0]], '#d8c394');
    } else if (kind === 'merchant') {
      c.strokeRect(-4.5, -1.5, 9, 7); c.beginPath(); c.arc(0, -1.5, 3, Math.PI, TAU); c.stroke();
    } else if (kind === 'inn') {
      c.strokeRect(-4, -4, 6, 9); c.beginPath(); c.arc(3, 0, 2.5, -Math.PI / 2, Math.PI / 2); c.stroke();
      line(c, [[-5, 6], [5, 6]], '#d8c394', 1);
    } else {
      line(c, [[0, -5], [0, 6]], '#e0cf9c', 1.5); line(c, [[-4, -1], [4, -1]], '#e0cf9c', 1.5);
      polygon(c, [[0, -7], [2, -5], [0, -3], [-2, -5]], '#e0cf9c');
    }
    c.restore();
  }

  private roof(c: CanvasRenderingContext2D, b: Building) {
    const w = b.width, h = b.height, rise = roofRise(b);
    const left = -8, right = w + 8, center = w / 2, back = -WALL_HEIGHT - 3, front = h - WALL_HEIGHT + 3;
    const south = [[left, front], [center, front - rise], [right, front]] as const;
    polygon(c, [[left + 1, front], [right - 1, front], [right - 2, front + 5], [left + 2, front + 5]], '#1b2e34');
    polygon(c, south, b.kind === 'chapel' ? '#647575' : '#a09374');
    line(c, [[center, front - rise + 1], [center, front]], '#483d32', 2);
    line(c, [[left + 8, front - 1], [center, front - rise + 3], [right - 8, front - 1]], '#564a36', 2);
    polygon(c, [[center, front - rise * .71], [center + 5, front - rise * .48], [center, front - rise * .25],
      [center - 5, front - rise * .48]], b.kind === 'chapel' ? '#b6c5a4' : '#425964');
    for (const side of [-1, 1]) {
      const edge = side < 0 ? left : right;
      c.save();
      polygon(c, [[edge, back], [center, back - rise], [center, front - rise], [edge, front]], side < 0 ? '#3d535e' : '#283f4d');
      c.clip();
      for (let y = back - rise - 1, row = 0; y <= front; y += 7, row++) {
        for (let x = left - 8 + (row % 2 ? 6 : 0), col = 0; x < right + 8; x += 13, col++) {
          const tone = rand(b.seed, row * 37 + col + (side < 0 ? 0 : 317));
          c.fillStyle = side < 0 ? (tone > .5 ? '#536976' : '#405b68') : (tone > .5 ? '#344d5b' : '#29434f');
          c.fillRect(x, y, 12.4, 6.4);
          line(c, [[x + .7, y + 5.8], [x + 11.7, y + 5.8]], side < 0 ? '#82908a75' : '#6a827960', .65);
        }
      }
      c.restore();
      line(c, [[edge, front], [edge, back], [center, back - rise]], '#a7a68a', 1.4);
      line(c, [[edge, front], [center, front - rise]], side < 0 ? '#8a968b' : '#5f7980', 2);
    }
    line(c, [[center, back - rise], [center, front - rise]], '#abb39b', 3);
    line(c, [[center + 1.5, back - rise + 1], [center + 1.5, front - rise]], '#516a70', .9);
    if (w >= 140 && (b.kind === 'house' || b.kind === 'inn' || b.kind === 'merchant')) {
      const dx = w * .23, dy = h * .6 - WALL_HEIGHT - rise * .46;
      polygon(c, [[dx - 15, dy + 5], [dx - 13, dy - 12], [dx, dy - 23], [dx + 13, dy - 12], [dx + 16, dy + 5]], '#2c4048');
      polygon(c, [[dx - 11, dy + 3], [dx - 11, dy - 10], [dx, dy - 19], [dx + 11, dy - 10], [dx + 11, dy + 3]], '#938b6b');
      line(c, [[dx - 15, dy - 10], [dx, dy - 24], [dx + 15, dy - 10]], '#b0b39b', 2);
      c.fillStyle = '#394b4b'; c.fillRect(dx - 5, dy - 10, 10, 12);
      c.fillStyle = '#d9bb79'; c.fillRect(dx - 3.5, dy - 8, 7, 8);
      line(c, [[dx, dy - 8], [dx, dy]], '#66725c', 1);
      line(c, [[dx - 12, dy + 4], [dx + 12, dy + 4]], '#b5a785', 1.1);
    }
    const cx = w * .75, cy = h * .27 - WALL_HEIGHT - 8;
    c.fillStyle = '#3b4a4b'; c.fillRect(cx - 6, cy - 29, 13, 31);
    c.fillStyle = '#7d8172'; c.fillRect(cx - 7, cy - 31, 15, 5);
    c.fillStyle = '#182b32'; c.fillRect(cx - 4, cy - 30, 9, 2);
    for (let y = cy - 24; y < cy; y += 6) line(c, [[cx - 5, y], [cx + 6, y]], '#a29a7a70', .6);
    if (b.kind === 'chapel') {
      const sx = center, sy = back - rise + 7;
      polygon(c, [[sx - 9, sy], [sx, sy - 24], [sx + 9, sy]], '#415f69');
      line(c, [[sx, sy - 23], [sx + 8, sy - 1]], '#acb9a1', .9);
      line(c, [[sx, sy - 33], [sx, sy - 21]], '#c7b886', 1.2);
      line(c, [[sx - 4, sy - 29], [sx + 4, sy - 29]], '#c7b886', 1.2);
    }
  }

  drawRoofs(c: CanvasRenderingContext2D, buildings: readonly Building[], time: number) {
    const t = this.reducedMotion ? 0 : time;
    for (const b of [...buildings].sort((a, z) => a.y + a.height - z.y - z.height)) {
      const opacity = this.reveal.get(b.id)?.opacity ?? 1;
      if (opacity < .002) continue;
      const roof = this.art(b).roof;
      c.save(); c.globalAlpha *= opacity;
      const roofAlpha = c.globalAlpha;
      c.drawImage(roof.image, b.x + roof.x, b.y + roof.y);
      if (b.kind === 'blacksmith' || b.kind === 'inn' || b.kind === 'house') {
        const x = b.x + b.width * .75, y = b.y + b.height * .27 - WALL_HEIGHT - 40;
        for (let i = 0; i < 5; i++) {
          const phase = (t * .16 + i / 5 + rand(b.seed, 19)) % 1;
          c.globalAlpha = roofAlpha * Math.sin(phase * Math.PI) * .14;
          c.fillStyle = b.kind === 'blacksmith' ? '#c1a98e' : '#a1b4b0';
          c.beginPath(); c.ellipse(x + Math.sin(phase * 3 + i) * 3 + phase * 11, y - phase * 31,
            3 + phase * 6, 2 + phase * 4, -.2, 0, TAU); c.fill();
        }
      }
      c.restore();
    }
  }

  getLights(buildings: readonly Building[], time: number): PointLight[] {
    const t = this.reducedMotion ? 0 : time;
    const result: PointLight[] = [];
    const nearest = [...buildings].sort((a, b) => Math.hypot(a.door.x - this.playerX, a.door.y - this.playerY)
      - Math.hypot(b.door.x - this.playerX, b.door.y - this.playerY));
    for (const b of nearest) {
      const opacity = this.reveal.get(b.id)?.opacity ?? 1;
      result.push({ x: b.door.x - b.door.width / 2 - 3, y: b.door.y - 26, radius: 111,
        power: .68 + Math.sin(t * 5 + b.seed) * .035, color: '#ffc071' });
      if (opacity > .1) result.push({ x: facadeWindows(b)[0].x, y: b.door.y - 24, radius: 89, power: .36 * opacity, color: '#e8be79' });
      if (opacity < .95) {
        const source = b.furniture.find(item => item.kind === 'forge' || item.kind === 'altar');
        const forge = source?.kind === 'forge';
        result.push({ x: source ? source.x + source.width / 2 : b.x + b.width / 2,
          y: source ? source.y + source.height - 8 : b.y + b.height * .4,
          radius: Math.max(forge ? 133 : 106, Math.hypot(b.width, b.height) * .64),
          power: (forge ? .95 : .48) * (1 - opacity), color: forge ? '#ff9652' : '#e1cda0' });
      }
      if (result.length >= 12) break;
    }
    return result.slice(0, 12);
  }
}
