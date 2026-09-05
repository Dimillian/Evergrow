import { polygon, line, taper, randomFromSeed, hash, type Point, type CanvasFactory } from './art-primitives.ts';
import type { BiomeId } from './biomes.ts';
import { propDefinition } from './biome-props.ts';
import type { Prop } from './world.ts';

interface GroundPalette { soil: string; cover: string; light: string; dark: string; litter: string; }
export const GROUND_PALETTES: Readonly<Record<BiomeId, GroundPalette>> = Object.freeze({
  deadwood: { soil: '#45473a', cover: '#344c43', light: '#7d8c69', dark: '#192d2a', litter: '#8d8762' },
  verdant: { soil: '#504b32', cover: '#3a5937', light: '#829451', dark: '#1d342a', litter: '#a29a5b' },
  swamp: { soil: '#294a48', cover: '#42654e', light: '#809b77', dark: '#142f36', litter: '#8a9765' },
  frostpine: { soil: '#647f88', cover: '#9baeb0', light: '#d1d9c9', dark: '#354e5b', litter: '#91a5a0' },
  emberfall: { soil: '#655046', cover: '#514c4c', light: '#9b8070', dark: '#272c32', litter: '#b28b5d' },
  autumn: { soil: '#5a4834', cover: '#756037', light: '#bc9e54', dark: '#32382a', litter: '#c39449' },
  highlands: { soil: '#62675b', cover: '#535f48', light: '#a2a17e', dark: '#303e3d', litter: '#a79ab0' },
});

function patch(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, seed: number, color: string, opacity: number) {
  const random = randomFromSeed(seed);
  const contour: Point[] = Array.from({ length: 22 }, (_, i) => {
    const a = i / 22 * Math.PI * 2, r = .75 + random() * .3;
    return [Math.cos(a) * rx * r, Math.sin(a) * ry * r];
  });
  c.save(); c.translate(x, y); c.scale(rx, ry); c.globalAlpha *= opacity * 1.7;
  const gradient = c.createRadialGradient(-.12, -.1, .06, 0, 0, 1);
  gradient.addColorStop(0, color); gradient.addColorStop(.4, color + 'db');
  gradient.addColorStop(.75, color + '65'); gradient.addColorStop(1, color + '00');
  c.beginPath(); c.moveTo(contour[0][0] / rx, contour[0][1] / ry);
  for (const [px, py] of contour.slice(1)) c.lineTo(px / rx, py / ry);
  c.closePath(); c.fillStyle = gradient; c.fill();
  c.restore();
}

/** Medium-scale connected deposits, cropped from stable world anchors by each terrain tile. */
export function drawGroundPatches(c: CanvasRenderingContext2D, originX: number, originY: number, size: number,
  seed: number, biomeAt: (x: number, y: number) => BiomeId, clear: (x: number, y: number) => boolean) {
  const step = 112, margin = 96;
  c.save(); c.translate(-originX, -originY);
  const alpha = c.globalAlpha;
  for (let cy = Math.floor((originY - margin) / step); cy <= Math.floor((originY + size + margin) / step); cy++) {
    for (let cx = Math.floor((originX - margin) / step); cx <= Math.floor((originX + size + margin) / step); cx++) {
      const localSeed = hash(seed ^ Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663));
      const random = randomFromSeed(localSeed);
      const x = (cx + random()) * step, y = (cy + random()) * step;
      const rx = 32 + random() * 52, ry = 18 + random() * 26;
      if (!clear(x, y) || !clear(x - rx, y - ry) || !clear(x + rx, y + ry)
        || !clear(x - rx, y + ry) || !clear(x + rx, y - ry)) continue;
      const biome = biomeAt(x, y), palette = GROUND_PALETTES[biome], cover = random() > .36;
      patch(c, x, y, rx, ry, localSeed, cover ? palette.cover : palette.soil, biome === 'frostpine' ? .2 : .16);
      // Marks belong to a deposit instead of filling every cell with the same grass symbol.
      for (let mark = 0; mark < 32; mark++) {
        const a = random() * Math.PI * 2, r = Math.sqrt(random()) * .9;
        const mx = x + Math.cos(a) * rx * r, my = y + Math.sin(a) * ry * r;
        const length = 1.5 + random() * 4;
        c.globalAlpha = alpha * (.18 + random() * .25);
        if (biome === 'swamp' && !cover) {
          line(c, [[mx - length * 2, my], [mx, my + .8], [mx + length, my]], palette.light, .65);
        } else if (biome === 'autumn' || biome === 'deadwood' || !cover) {
          polygon(c, [[mx - length, my], [mx - 1, my - 1.6], [mx + length, my - .5], [mx + 1, my + 1.3]], mark % 3 ? palette.litter : palette.dark);
        } else if (biome === 'frostpine') {
          c.fillStyle = mark % 3 ? palette.light : palette.dark;
          c.fillRect(Math.floor(mx - length), Math.floor(my), Math.ceil(length * 1.6), 1);
        } else {
          line(c, [[mx - length, my], [mx, my - 1], [mx + length * .6, my - .5]], mark % 3 ? palette.light : palette.dark, .9);
        }
      }
      c.globalAlpha = alpha;
    }
  }
  c.restore();
}

interface GroundStamp { image: HTMLCanvasElement; }
export const GROUND_DRESSING_LIMIT = 96;

/** Root beds, litter and mineral fragments share each prop's physical anchor. No new obstacles. */
export class GroundDressing {
  private cache = new Map<string, GroundStamp>();
  private factory: CanvasFactory;
  constructor(factory: CanvasFactory = (width, height) => {
    const image = document.createElement('canvas'); image.width = width; image.height = height; return image;
  }) { this.factory = factory; }
  reset() { this.cache.clear(); }
  get cacheSize() { return this.cache.size; }
  private stamp(prop: Prop): GroundStamp {
    const biome = prop.biome ?? 'deadwood', variant = hash(prop.seed) % 16;
    const key = `${prop.kind}:${biome}:${variant}`;
    const cached = this.cache.get(key);
    if (cached) { this.cache.delete(key); this.cache.set(key, cached); return cached; }
    const image = this.factory(192, 112);
    const c = image.getContext('2d')!; c.translate(96, 68);
    const random = randomFromSeed(hash(variant + prop.kind.length * 731));
    const palette = GROUND_PALETTES[biome], tree = !!propDefinition(prop.kind).canopy;
    const rx = tree ? 40 : 25, ry = tree ? 23 : 13;
    patch(c, 1, 0, rx, ry, variant, palette.soil, .3);
    patch(c, -8, -3, rx * .72, ry * .8, variant + 17, palette.cover, .23);
    for (let i = 0; i < (tree ? 58 : 24); i++) {
      const a = random() * Math.PI * 2, r = Math.sqrt(random());
      const x = Math.cos(a) * rx * r, y = Math.sin(a) * ry * r;
      const w = 1 + random() * 2.6;
      polygon(c, [[x - w, y], [x, y - 1.3], [x + w * .8, y - .4], [x + w * .3, y + 1]], i % 4 === 0 ? palette.light : i % 3 ? palette.litter : palette.dark);
    }
    if (tree) {
      for (let root = 0; root < 5; root++) {
        const a = root / 5 * Math.PI * 2 + random(), len = 16 + random() * 17;
        const mid: Point = [Math.cos(a) * len * .5, Math.sin(a) * len * .24];
        const end: Point = [Math.cos(a + .2) * len, Math.sin(a + .2) * len * .48];
        taper(c, [0, -3], mid, 5, 2.4, palette.dark);
        taper(c, mid, end, 2.4, .4, palette.soil);
        line(c, [[-1, -3], [mid[0] - 1, mid[1] - 1], end], palette.litter, .65);
      }
      // Low undergrowth beside the roots, kept inside the protected prop footprint skirt.
      for (let plant = 0; plant < 3; plant++) {
        const x = (plant % 2 ? 1 : -1) * (19 + random() * 10), y = -7 + random() * 14;
        for (let frond = 0; frond < 5; frond++) {
          const dx = (frond - 2) * 3.2, h = 5 + random() * 6;
          polygon(c, [[x, y], [x + dx * .55 - 1, y - h * .65], [x + dx, y - h], [x + dx * .6 + 1, y - h * .5]], frond % 2 ? palette.cover : palette.light);
        }
      }
    } else if (prop.radius > 0) {
      for (let chip = 0; chip < 5; chip++) {
        const x = (random() - .5) * 37, y = (random() - .4) * 16;
        polygon(c, [[x - 3, y], [x - 2, y - 3], [x + 2, y - 4], [x + 4, y - 1], [x, y + 1]], palette.soil);
        line(c, [[x - 2, y - 3], [x + 2, y - 4], [x + 3, y - 2]], palette.light, .7);
      }
    }
    const definition = propDefinition(prop.kind);
    drawPropShade(c, { ...prop, x: 0, y: 0, scale: 1, seed: variant, radius: (definition.radius[0] + definition.radius[1]) / 2 });
    const stamp = { image }; this.cache.set(key, stamp);
    if (this.cache.size > GROUND_DRESSING_LIMIT) this.cache.delete(this.cache.keys().next().value!);
    return stamp;
  }
  draw(c: CanvasRenderingContext2D, props: readonly Prop[], view?: { left: number; top: number; width: number; height: number }) {
    for (const prop of props) {
      if (prop.radius <= 0 || prop.kind === 'shrine') continue;
      if (view && (prop.x + 115 < view.left || prop.x - 115 > view.left + view.width
        || prop.y + 55 < view.top || prop.y - 82 > view.top + view.height)) continue;
      const stamp = this.stamp(prop);
      c.drawImage(stamp.image, prop.x - 96 * prop.scale, prop.y - 68 * prop.scale, 192 * prop.scale, 112 * prop.scale);
    }
  }
}

/** Shape-aware ambient shade: broken crowns plus a small dark ground contact. */
function drawPropShade(c: CanvasRenderingContext2D, prop: Prop) {
  if (prop.radius <= 0) return;
  const definition = propDefinition(prop.kind);
  c.save(); c.translate(prop.x, prop.y); c.scale(prop.scale, prop.scale);
  if (definition.canopy) {
    const radius = definition.canopy.radius;
    for (let lobe = 0; lobe < 5; lobe++) {
      const a = lobe * 2.4 + prop.seed % 11;
      const x = 9 + Math.cos(a) * radius * .33, y = 7 + Math.sin(a) * radius * .14;
      patch(c, x, y, radius * .46, radius * .22, hash(prop.seed + lobe), '#0e2428', .1);
    }
  }
  const [rx, ry] = definition.shadow;
  c.fillStyle = '#07141c30'; c.beginPath(); c.ellipse(2, 3, rx * .85, ry * .82, -.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#07101560'; c.beginPath(); c.ellipse(0, 1, Math.max(3, prop.radius * .72), Math.max(2, prop.radius * .27), 0, 0, Math.PI * 2); c.fill();
  c.restore();
}
