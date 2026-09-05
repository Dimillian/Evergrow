import { createTreeSprite, isTreeKind } from './tree-art.ts';
import type { Sprite } from './art-types.ts';
import type { Prop } from './world.ts';
import { drawGlow } from './lighting.ts';
import { BIOME_PROP_BOUNDS, drawBiomeProp } from './biome-prop-art.ts';
import type { BiomeWeights } from './biomes.ts';

type Point = readonly [number, number];
type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;
interface ViewRect { x: number; y: number; width: number; height: number; }
const TAU = Math.PI * 2;
export const ENVIRONMENT_ART_RULES = Object.freeze({ variants: 24, cacheLimit: 96, ambientCells: 384 });

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
  get cacheStats() { return { sprites: this.cache.size,
    pixels: [...this.cache.values()].reduce((pixels, sprite) => pixels + sprite.width * sprite.height * (1 + (sprite.foliage?.length ?? 0)), 0) }; }

  getSprite(prop: Prop): Sprite | null {
    const family = prop.kind, bounds = BIOME_PROP_BOUNDS[family];
    if (!bounds && !isTreeKind(family) && !['reeds', 'fern', 'flowers'].includes(family)) return null;
    if (family === 'tree' || family === 'deadTree') return null;
    const variant = hash(prop.seed) % ENVIRONMENT_ART_RULES.variants, key = `${family}:${variant}`;
    const existing = this.cache.get(key);
    if (existing) { this.cache.delete(key); this.cache.set(key, existing); return existing; }
    if (isTreeKind(family)) {
      const sprite = createTreeSprite(this.factory, family, hash(variant + family.length * 313));
      this.cache.set(key, sprite);
      if (this.cache.size > ENVIRONMENT_ART_RULES.cacheLimit) this.cache.delete(this.cache.keys().next().value!);
      return sprite;
    }
    const width = bounds?.[0] ?? (family === 'fern' ? 52 : family === 'reeds' ? 42 : 34);
    const height = bounds?.[1] ?? (family === 'reeds' ? 49 : 37);
    const image = this.factory(width, height); image.width = width; image.height = height;
    const c = image.getContext('2d');
    if (!c) throw new Error('A 2D canvas context is required for biome art.');
    const sprite: Sprite = { image, width, height, anchorX: width / 2, anchorY: height - 4 };
    const seed = hash(variant + family.length * 313);
    c.translate(sprite.anchorX, sprite.anchorY);
    if (bounds) drawBiomeProp(c, family, seed);
    else if (family === 'reeds') this.reeds(c, seed);
    else if (family === 'fern') this.fern(c, seed);
    else this.flowers(c, seed);
    this.cache.set(key, sprite);
    if (this.cache.size > ENVIRONMENT_ART_RULES.cacheLimit) this.cache.delete(this.cache.keys().next().value!);
    return sprite;
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

  drawAmbient(c: CanvasRenderingContext2D, sampleWeights: (x: number, y: number) => BiomeWeights,
    view: ViewRect, time: number, reducedMotion: boolean) {
    if (![view.x, view.y, view.width, view.height, time].every(Number.isFinite) || view.width <= 0 || view.height <= 0) return;
    const t = reducedMotion ? 0 : time;
    c.save();
    const opacity = c.globalAlpha;
    const cells = (Math.ceil(view.width / 170) + 2) * (Math.ceil(view.height / 170) + 2);
    const stride = Math.max(1, Math.ceil(Math.sqrt(cells / ENVIRONMENT_ART_RULES.ambientCells)));
    let visited = 0;
    ambient: for (let cy = Math.floor(view.y / 170 / stride) * stride - stride; cy <= Math.floor((view.y + view.height) / 170); cy += stride) {
      for (let cx = Math.floor(view.x / 170 / stride) * stride - stride; cx <= Math.floor((view.x + view.width) / 170); cx += stride) {
        if (visited++ >= ENVIRONMENT_ART_RULES.ambientCells) break ambient;
        const seed = hash(Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663));
        const phase = random(seed, 0) * TAU;
        const x = cx * 170 + random(seed, 1) * 170 + Math.sin(t * .35 + phase) * 13;
        const y = cy * 170 + random(seed, 2) * 170 + Math.cos(t * .3 + phase) * 8;
        // Particle families belong to their world anchor, not the camera's biome.
        const weights = sampleWeights(cx * 170 + 85, cy * 170 + 85);
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
        if (weights.frostpine > .05) {
          c.globalAlpha = opacity * weights.frostpine * .62; c.fillStyle = '#dbe9e6';
          for (let flake = 0; flake < 3; flake++) {
            const fx = x + flake * 37 + Math.sin(t * .55 + phase + flake) * 17;
            const fy = y + ((t * 11 + flake * 53 + phase * 17) % 160) - 80;
            c.fillRect(fx, fy, flake === 1 ? 1.8 : 1.1, flake === 1 ? 1.1 : 1.5);
          }
        }
        if (weights.emberfall > .05) {
          const emberY = y - ((t * 14 + phase * 20) % 110);
          const pulse = .5 + Math.sin(t * 2 + phase) * .35;
          c.globalAlpha = opacity * weights.emberfall * pulse;
          c.fillStyle = '#e9aa70'; c.fillRect(x + Math.sin(t + phase) * 4, emberY, 1.3, 1.5);
          c.fillStyle = '#a28c87'; c.fillRect(x - 32, y + Math.sin(t * .2 + phase) * 14, 1.2, .8);
        }
        if (weights.autumn > .05 && seed % 2 === 0) {
          c.globalAlpha = opacity * weights.autumn * .55;
          c.save(); c.translate(x + Math.sin(t * .45 + phase) * 21, y + Math.cos(t * .6 + phase) * 8);
          c.rotate(Math.sin(t * .8 + phase) * 1.1);
          polygon(c, [[-2.8, 0], [-1, -1.5], [.8, -1], [2.8, .1], [.7, 1.5], [-1.2, 1]], seed % 3 ? '#d4a55c' : '#b67748');
          c.restore();
        }
        if (weights.highlands > .05 && seed % 3 === 0) {
          c.globalAlpha = opacity * weights.highlands * .38;
          c.strokeStyle = '#c7c2ae'; c.lineWidth = .65; c.beginPath();
          c.moveTo(x + Math.sin(t * .3 + phase) * 20, y); c.lineTo(x + 4 + Math.sin(t * .3 + phase) * 20, y - 1.5); c.stroke();
        }
        c.globalAlpha = opacity;
      }
    }
    c.restore();
  }
}
