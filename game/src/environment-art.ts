import type { Sprite } from './art.ts';
import type { Prop } from './world.ts';
import { drawGlow } from './lighting.ts';

type Point = readonly [number, number];
type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;
interface BiomeWeights { deadwood: number; verdant: number; swamp: number; }
interface ViewRect { x: number; y: number; width: number; height: number; }
const TAU = Math.PI * 2;

function hash(seed: number): number {
  let n = seed | 0;
  n = Math.imul(n ^ n >>> 16, 0x45d9f3b);
  n = Math.imul(n ^ n >>> 16, 0x45d9f3b);
  return (n ^ n >>> 16) >>> 0;
}
function random(seed: number, salt: number) { return hash(seed + Math.imul(salt, 7919)) / 0x100000000; }
function polygon(c: CanvasRenderingContext2D, points: readonly Point[], color: string) {
  c.beginPath(); c.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) c.lineTo(...points[i]);
  c.closePath(); c.fillStyle = color; c.fill();
}
function branch(c: CanvasRenderingContext2D, from: Point, to: Point, width: number, color: string) {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]), nx = -Math.sin(angle), ny = Math.cos(angle);
  polygon(c, [[from[0] + nx * width, from[1] + ny * width], [to[0] + nx * width * .28, to[1] + ny * width * .28],
    [to[0] - nx * width * .28, to[1] - ny * width * .28], [from[0] - nx * width, from[1] - ny * width]], color);
}
function leaf(c: CanvasRenderingContext2D, from: Point, to: Point, width: number, color: string) {
  const mx = (from[0] + to[0]) / 2, my = (from[1] + to[1]) / 2;
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  polygon(c, [from, [mx - Math.sin(a) * width, my + Math.cos(a) * width], to,
    [mx + Math.sin(a) * width * .55, my - Math.cos(a) * width * .55]], color);
}

/** Distinct biome silhouettes from a bounded family of deterministic geometry. */
export class EnvironmentArt {
  private cache = new Map<string, Sprite>();
  private factory: CanvasFactory;

  constructor(createCanvas?: CanvasFactory) {
    this.factory = createCanvas ?? ((width, height) => {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas;
    });
  }
  reset() { this.cache.clear(); }

  getSprite(prop: Prop): Sprite | null {
    const family = prop.kind === 'tree' && prop.biome === 'verdant' ? 'canopy' : prop.kind;
    if (!['willow', 'reeds', 'fern', 'flowers', 'canopy'].includes(family)) return null;
    const variant = hash(prop.seed) % 24, key = `${family}:${variant}`;
    const existing = this.cache.get(key);
    if (existing) { this.cache.delete(key); this.cache.set(key, existing); return existing; }
    const large = family === 'willow' || family === 'canopy';
    const width = family === 'willow' ? 176 : large ? 156 : family === 'fern' ? 52 : family === 'reeds' ? 42 : 34;
    const height = large ? 170 : family === 'reeds' ? 49 : 37;
    const image = this.factory(width, height); image.width = width; image.height = height;
    const c = image.getContext('2d');
    if (!c) throw new Error('A 2D canvas context is required for biome art.');
    const sprite: Sprite = { image, width, height, anchorX: width / 2, anchorY: height - 4 };
    const seed = hash(variant + family.length * 313);
    c.translate(sprite.anchorX, sprite.anchorY);
    if (family === 'willow') this.willow(c, seed);
    else if (family === 'canopy') this.canopy(c, seed);
    else if (family === 'reeds') this.reeds(c, seed);
    else if (family === 'fern') this.fern(c, seed);
    else this.flowers(c, seed);
    this.cache.set(key, sprite);
    if (this.cache.size > 72) this.cache.delete(this.cache.keys().next().value!);
    return sprite;
  }

  private canopy(c: CanvasRenderingContext2D, seed: number) {
    const lean = (random(seed, 1) - .5) * 10;
    polygon(c, [[-15, 1], [-4, -13], [4, -13], [17, 2], [3, -1], [-3, 3]], '#263e34');
    branch(c, [0, 0], [lean, -75], 5.5, '#645b40');
    branch(c, [-2, -4], [lean - 2, -76], 1.3, '#a89767');
    for (const side of [-1, 1]) {
      branch(c, [lean * .6, -43], [side * 32, -79], 3.1, '#736849');
      branch(c, [side * 20, -64], [side * 44, -69], 1.6, '#837d52');
    }
    const masses = [[-27, -122, 29, 24], [13, -132, 35, 25], [41, -102, 29, 29],
      [-46, -96, 28, 28], [-8, -99, 39, 33], [-31, -71, 34, 25], [29, -72, 36, 28], [0, -67, 32, 23]];
    const shades = ['#225343', '#407445', '#315f42', '#244e40', '#3e794a', '#346b43', '#2e664b', '#53854c'];
    masses.forEach(([x, y, rx, ry], i) => {
      const outline: Point[] = [];
      for (let edge = 0; edge < 13; edge++) {
        const angle = edge / 13 * TAU, r = .84 + random(seed, i * 19 + edge) * .2;
        outline.push([x + Math.cos(angle) * rx * r, y + Math.sin(angle) * ry * r]);
      }
      polygon(c, outline, shades[i]);
      c.strokeStyle = i % 3 === 0 ? '#6c9860' : '#89a964'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(...outline[7]);
      for (let edge = 8; edge < 12; edge++) c.lineTo(...outline[edge]);
      c.stroke();
      for (let mark = 0; mark < 4; mark++) {
        const lx = x + (random(seed, i * 31 + mark + 311) - .5) * rx;
        const ly = y + (random(seed, i * 29 + mark + 517) - .5) * ry;
        leaf(c, [lx - 3, ly], [lx + 4, ly - 2], 1.7, i % 2 ? '#739754' : '#588450');
      }
    });
    c.strokeStyle = '#77996a'; c.lineWidth = .8;
    c.beginPath(); c.moveTo(lean + 5, -38); c.quadraticCurveTo(lean - 6, -24, 3, -9); c.stroke();
    for (let i = 0; i < 4; i++) leaf(c, [3, -10 - i * 5], [i % 2 ? 9 : -3, -14 - i * 5], 2, '#79a466');
  }

  private willow(c: CanvasRenderingContext2D, seed: number) {
    const lean = -9 + random(seed, 7) * 18;
    polygon(c, [[-18, 2], [-7, -8], [2, -14], [11, -4], [19, 3], [3, 0]], '#263d3b');
    branch(c, [0, 0], [lean, -78], 5, '#657165');
    branch(c, [-2, -3], [lean - 2, -79], 1.3, '#a0a187');
    for (const side of [-1, 1]) {
      branch(c, [lean, -61], [side * 42, -105], 3.4, '#768474');
      branch(c, [side * 27, -89], [side * 62, -83], 2, '#667e6e');
    }
    for (let cluster = 0; cluster < 7; cluster++) {
      const x = (cluster - 3) * 18, y = -110 - Math.sin(cluster / 6 * Math.PI) * 31;
      const rx = 21 + random(seed, cluster + 21) * 6;
      polygon(c, [[x - rx, y + 10], [x - rx * .75, y - 5], [x - 3, y - 12], [x + rx * .8, y - 5],
        [x + rx, y + 12], [x + 11, y + 27], [x - 9, y + 23]], cluster % 2 ? '#3c6658' : '#2b514b');
      for (let strand = 0; strand < 4; strand++) {
        const sx = x - 13 + strand * 9, sy = y + 7 + random(seed, cluster * 7 + strand) * 9;
        const length = 29 + random(seed, cluster * 13 + strand + 101) * 44;
        const curl = (random(seed, cluster * 9 + strand + 207) - .5) * 11;
        c.strokeStyle = strand % 2 ? '#7b9470' : '#5a816b'; c.lineWidth = .8;
        c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(sx + curl, sy + length * .55, sx + curl * .55, sy + length); c.stroke();
        for (let n = 0; n < 5; n++) {
          const py = sy + 5 + n * length / 5, px = sx + Math.sin(n / 5 * Math.PI) * curl * .5;
          leaf(c, [px, py], [px + (n % 2 ? 4 : -4), py + 7], 1.6, strand % 2 ? '#7b9972' : '#456f5c');
        }
      }
    }
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i % 2 ? '#74a49a' : '#506e68';
      c.beginPath(); c.ellipse(-8 + i * 7, -4 + i % 2 * 3, 4, 1.7, -.2, 0, TAU); c.fill();
    }
  }

  private reeds(c: CanvasRenderingContext2D, seed: number) {
    for (let i = 0; i < 9; i++) {
      const x = -11 + random(seed, i) * 22, height = 17 + random(seed, 40 + i) * 24;
      const lean = (random(seed, i + 80) - .5) * 10;
      c.strokeStyle = i % 2 ? '#617e55' : '#3d6454'; c.lineWidth = .9;
      c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + lean * .4, -height * .6, x + lean, -height); c.stroke();
      leaf(c, [x, -7], [x + (i % 2 ? 8 : -7), -height * .67], 1.3, '#789467');
      if (i % 3 === 0) {
        branch(c, [x + lean, -height + 6], [x + lean, -height], 1.7, '#987852');
        c.fillStyle = '#c2a776'; c.fillRect(x + lean - .5, -height, .8, 3);
      }
    }
  }

  private fern(c: CanvasRenderingContext2D, seed: number) {
    for (let i = 0; i < 7; i++) {
      const angle = Math.PI + i * Math.PI / 6;
      const length = 15 + random(seed, i) * 11;
      const tx = Math.cos(angle) * length * .8, ty = Math.sin(angle) * length - 6;
      branch(c, [0, 0], [tx, ty], .6, '#9eaf68');
      for (let n = 1; n < 6; n++) {
        const t = n / 6, x = tx * t, y = ty * t;
        const span = Math.sin(t * Math.PI) * 5;
        leaf(c, [x, y], [x - Math.sin(angle) * span + tx * .13, y + Math.cos(angle) * span + ty * .13], 1.5, '#6c9650');
        leaf(c, [x, y], [x + Math.sin(angle) * span + tx * .13, y - Math.cos(angle) * span + ty * .13], 1.4, '#3e7851');
      }
    }
  }

  private flowers(c: CanvasRenderingContext2D, seed: number) {
    const colors = ['#b49abd', '#d4c19b', '#8aaacc'];
    for (let i = 0; i < 5; i++) {
      const x = -10 + random(seed, i) * 20, y = -8 - random(seed, i + 15) * 18;
      branch(c, [x * .6, 0], [x, y], .6, '#577b53');
      leaf(c, [x * .65, -3], [x + 5, -10], 2.1, '#81a065');
      for (let petal = 0; petal < 5; petal++) {
        const a = petal / 5 * TAU;
        c.fillStyle = colors[hash(seed) % colors.length]; c.beginPath();
        c.ellipse(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.6, 1.7, 1.1, a, 0, TAU); c.fill();
      }
      c.fillStyle = '#efd499'; c.fillRect(x - .7, y - .7, 1.4, 1.4);
    }
  }

  drawAmbient(c: CanvasRenderingContext2D, weights: BiomeWeights, view: ViewRect, time: number, reducedMotion: boolean) {
    const t = reducedMotion ? 0 : time;
    c.save();
    const opacity = c.globalAlpha;
    for (let cy = Math.floor(view.y / 170) - 1; cy <= Math.floor((view.y + view.height) / 170); cy++) {
      for (let cx = Math.floor(view.x / 170) - 1; cx <= Math.floor((view.x + view.width) / 170); cx++) {
        const seed = hash(Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663));
        const phase = random(seed, 0) * TAU;
        const x = cx * 170 + random(seed, 1) * 170 + Math.sin(t * .35 + phase) * 13;
        const y = cy * 170 + random(seed, 2) * 170 + Math.cos(t * .3 + phase) * 8;
        if (weights.swamp > .05) {
          const pulse = .25 + .75 * Math.max(0, Math.sin(t * 1.3 + phase));
          c.globalAlpha = opacity * weights.swamp * pulse * .55;
          c.fillStyle = '#b4dd87'; c.fillRect(x, y, 1.1, 1.1);
          c.globalAlpha = opacity;
          drawGlow(c, x, y, 10, '#a4d37e', weights.swamp * pulse * .25);
        }
        if (weights.verdant > .05 && seed % 3 === 0) {
          c.globalAlpha = opacity * weights.verdant * .4;
          c.fillStyle = seed % 2 ? '#d4baad' : '#d1da9a';
          c.save(); c.translate(x + 31, y - 23); c.rotate(Math.sin(t + phase) * .7);
          c.fillRect(-1.5, -.6, 3, 1.2); c.restore();
        }
      }
    }
    c.restore();
  }
}
