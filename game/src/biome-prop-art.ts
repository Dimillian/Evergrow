import { weatherStone } from './material-art.ts';
import type { PropKind } from './biome-props.ts';
import { randomFromSeed, polygon, line, taper, type Point, type Random } from './art-primitives.ts';
import type { BiomeId } from './biomes.ts';

type Family = 'iceCrystal' | 'basalt' | 'emberRock'
  | 'leafPile' | 'heather' | 'limestone' | 'tussock' | 'mushrooms' | 'stump' | 'lilies';
export const BIOME_PROP_BOUNDS: Readonly<Partial<Record<PropKind, readonly [number, number]>>> = Object.freeze({
  iceCrystal: [68, 82], basalt: [72, 61],
  emberRock: [68, 48], leafPile: [68, 30],
  heather: [64, 54], limestone: [70, 56], tussock: [64, 57], mushrooms: [50, 40], stump: [60, 44], lilies: [72, 36],
});
const TAU = Math.PI * 2;
const ellipse = (x: number, y: number, rx: number, ry: number, count = 12): Point[] =>
  Array.from({ length: count }, (_, i) => [x + Math.cos(i / count * TAU) * rx, y + Math.sin(i / count * TAU) * ry]);
const between = (random: Random, min: number, max: number) => min + (max - min) * random();
const leaf = (c: CanvasRenderingContext2D, x: number, y: number, size: number, fill: string, tilt = 0) =>
  polygon(c, [[x - size, y + tilt], [x - size * .25, y - size * .6], [x + size, y - tilt], [x + size * .2, y + size * .5]], fill);

function crystal(c: CanvasRenderingContext2D, random: Random) {
  polygon(c, ellipse(0, -1, 24, 4.5), '#4c7a83');
  const shards = [[-15, -2, 10, 30], [13, -1, 12, 37], [-2, 2, 14, 62], [19, 2, 7, 19]];
  for (const [x, y, width, baseHeight] of shards) {
    const h = baseHeight + random() * 5, tip = x + width * .18;
    polygon(c, [[x - width * .5, y], [x - width * .48, y - h * .8], [tip, y - h], [x + width * .5, y - h * .7], [x + width * .4, y - 3]], '#457c94');
    polygon(c, [[x - width * .5, y], [x - width * .48, y - h * .8], [tip, y - h], [x, y - h * .67], [x, y - 2]], '#acd6de');
    polygon(c, [[tip, y - h], [x + width * .5, y - h * .7], [x, y - h * .67]], '#e1f1e9');
    line(c, [[x - width * .46, y - h * .77], [x, y - h * .67], [x, y - 3]], '#e3f2ec', .85);
    line(c, [[x + width * .1, y - 9], [x + width * .38, y - 14]], '#73c0d2', 1);
  }
}

function basalt(c: CanvasRenderingContext2D, random: Random, ember: boolean) {
  for (const [x, y, width, height] of [[-12, -3, 20, 28], [12, -1, 23, 37], [-3, 1, 24, 23]]) {
    const top = y - height * (ember ? .65 : 1) - random() * 3;
    polygon(c, [[x - width / 2, y], [x - width / 2, top + 6], [x, top], [x + width / 2, top + 4], [x + width / 2, y - 3], [x, y + 3]], '#363443');
    polygon(c, [[x - width / 2, top + 6], [x, top], [x + width / 2, top + 4], [x, top + 10]], '#777079');
    polygon(c, [[x, top + 10], [x + width / 2, top + 4], [x + width / 2, y - 3], [x, y + 3]], '#242c35');
    line(c, [[x - width / 2, top + 6], [x, top + 10], [x, y]], '#8b8286', .65);
    weatherStone(c, [[x - width / 2, top + 6], [x, top + 10], [x, y + 2], [x - width / 2, y]], Math.floor(random() * 10000), '#93837d', '#202b34', '#666557');
    if (ember) {
      line(c, [[x - 5, y - 3], [x - 3, top + 12], [x + 1, top + 8], [x + 4, top + 10]], '#c67150', 1.2);
      line(c, [[x - 4, y - 7], [x - 3, top + 13], [x + 1, top + 9]], '#f3b477', .55);
    } else line(c, [[x - width / 2 + 1, y - 9], [x - 3, y - 7], [x - 1, y - 13]], '#242b31', .9);
  }
}

function limestone(c: CanvasRenderingContext2D, random: Random) {
  const top = -30 - random() * 9;
  const points: Point[] = [[-28, -2], [-25, -20], [-9, top], [15, top + 3], [28, -14], [24, 0], [0, 3]];
  polygon(c, points, '#a1a596');
  polygon(c, [[-25, -20], [-9, top], [15, top + 3], [20, -19], [-3, -15]], '#c5c6ac');
  polygon(c, [[15, top + 3], [28, -14], [24, 0], [2, 3], [8, -15]], '#7c8984');
  line(c, [[-24, -20], [-9, top], [14, top + 3]], '#e0dbbb', 1.1);
  for (let seam = 0; seam < 3; seam++) line(c, [[-23 + seam, -15 + seam * 5], [-7, -11 + seam * 5], [6, -13 + seam * 5], [24, -10 + seam * 3]], '#657570', .8);
  polygon(c, [[-24, -4], [-11, -7], [-2, -3], [-9, 0], [-23, 0]], '#787e60');
  weatherStone(c, points, Math.floor(random() * 10000), '#d5d3b9', '#52696b', '#7f895d');
  for (let bloom = 0; bloom < 3; bloom++) leaf(c, -19 + bloom * 4, -5 - bloom % 2 * 2, 1.8, '#c1b3c0');
}

function heather(c: CanvasRenderingContext2D, random: Random) {
  const colors = ['#a98dba', '#b8a0bc', '#876d9d', '#c4a4bf'];
  for (let stem = 0; stem < 12; stem++) {
    const x = between(random, -14, 15), height = between(random, 14, 42), lean = between(random, 4, 12);
    line(c, [[x * .4, 0], [x + lean * .5, -height * .6], [x + lean, -height]], '#788269', .8);
    for (let bud = 0; bud < 5; bud++) {
      const y = -height + bud * 2.6, bx = x + lean - bud * .65 + (bud % 2 ? -1 : 1);
      leaf(c, bx, y, 1.6, colors[(stem + bud) % colors.length]);
    }
    leaf(c, x * .8, -8, 2.5, '#81906d', -1);
  }
}

function tussock(c: CanvasRenderingContext2D, random: Random) {
  for (let blade = 0; blade < 13; blade++) {
    const x = between(random, -8, 8), lean = between(random, -12, 22), h = between(random, 14, 47);
    const fill = blade % 3 === 0 ? '#b9b993' : blade % 3 === 1 ? '#778e7d' : '#5f766d';
    polygon(c, [[x - .9, 0], [x + lean * .4, -h * .67], [x + lean, -h], [x + lean * .46 + 1, -h * .63], [x + 1, 0]], fill);
    if (blade % 3 === 0) line(c, [[x + lean * .78, -h + 7], [x + lean, -h]], '#d6c5a0', 1.3);
  }
}

function mushrooms(c: CanvasRenderingContext2D, random: Random) {
  for (const [x, y, radius] of [[-12, 0, 5], [1, 2, 8], [12, -2, 5]]) {
    const height = radius * 2 + random() * 6;
    taper(c, [x, y], [x + 1, y - height], 2.4, 1.6, '#aab9a2');
    polygon(c, [[x - radius, y - height + 1], [x - radius * .5, y - height - radius * .5], [x + 1, y - height - radius * .7], [x + radius * .85, y - height - radius * .15], [x + radius, y - height + 1], [x + 1, y - height + 3]], '#769989');
    line(c, [[x - radius + 1, y - height + 1], [x + 1, y - height + 2], [x + radius - 1, y - height + .8]], '#d1dfbe', .75);
    c.fillStyle = '#e2e2c4'; c.fillRect(x - 1, y - height - 2, 1.4, 1.3);
  }
}

function stump(c: CanvasRenderingContext2D, random: Random) {
  polygon(c, [[-24, 2], [-12, -8], [-11, -27], [0, -30], [13, -24], [12, -8], [25, 2], [9, -1], [3, 4], [-6, 0]], '#5a5243');
  polygon(c, [[-11, -27], [0, -30], [13, -24], [7, -18], [-5, -20]], '#9c8b66');
  polygon(c, [[1, -26], [7, -25], [8, -22], [1, -20], [-5, -23]], '#604f3e');
  line(c, [[-8, -25], [-4, -27], [6, -25], [9, -22]], '#ceba86', .75);
  line(c, [[-8, -21], [-8, -7], [-17, 0]], '#aa9164', 1);
  line(c, [[4, -18], [5, -6], [10, 0]], '#352f2d', 1.5);
  for (let growth = 0; growth < 4; growth++) leaf(c, 10 + between(random, -2, 7), -5 + between(random, -7, 5), 3, growth % 2 ? '#87955e' : '#596e52');
}

function lilies(c: CanvasRenderingContext2D, random: Random) {
  for (const [x, y, r] of [[-18, -4, 10], [3, -11, 12], [19, -3, 9], [-1, -2, 9]]) {
    const outline = ellipse(x, y, r, r * .5, 10); outline.splice(1, 0, [x, y]);
    polygon(c, outline, random() < .5 ? '#4b795e' : '#699072');
    line(c, outline.slice(6, 10), '#99b288', .65);
    line(c, [[x, y], [x - r * .7, y - 1]], '#355c51', .6);
  }
  for (let petal = 0; petal < 6; petal++) {
    const angle = petal / 6 * TAU, x = 3 + Math.cos(angle) * 3.8, y = -14 + Math.sin(angle) * 2;
    leaf(c, x, y, 3, petal % 2 ? '#d4c7d2' : '#b692bb', Math.cos(angle) * 1.5);
  }
  polygon(c, ellipse(3, -14, 2, 1.3, 6), '#ddc889');
}

/** Geometry is generated once per cached family/variant, never loaded as an image asset. */
export function drawBiomeProp(c: CanvasRenderingContext2D, kind: PropKind, seed: number): void {
  const random = randomFromSeed(seed);
  const draw: Record<Family, (c: CanvasRenderingContext2D, random: Random) => void> = {
    iceCrystal: crystal, basalt: (ctx, r) => basalt(ctx, r, false),
    emberRock: (ctx, r) => basalt(ctx, r, true), heather, limestone, tussock, mushrooms, stump, lilies,
    leafPile: (ctx, r) => { for (let i = 0; i < 27; i++) leaf(ctx, between(r, -27, 27), between(r, -12, 1), between(r, 1.4, 4.6), ['#a77c45', '#c59c56', '#825a39'][i % 3], between(r, -1.3, 1.3)); },
  };
  if (!(kind in draw)) throw new Error(`No biome prop drawing for ${kind}.`);
  draw[kind as Family](c, random);
}

/** World-aligned small accents are cropped by terrain tiles. They never own collision. */
export function drawBiomeGroundAccent(c: CanvasRenderingContext2D, biome: BiomeId, x: number, y: number,
  pick: number, seed: number, onRoad: boolean): boolean {
  const random = randomFromSeed(seed);
  if (onRoad) return false;
  if (biome === 'frostpine') {
    if (pick < .42) {
      polygon(c, [[x - 5, y], [x - 1, y - 1.3], [x + 7, y], [x + 2, y + 1.4]], '#c4d3d42e');
      line(c, [[x - 1, y - 2], [x + 3, y - 1]], '#e1e6dc31', .6);
    } else if (pick > .83) {
      line(c, [[x - 2, y + 1], [x, y - 4], [x + 1, y]], '#688c9b55', .65);
      line(c, [[x, y - 4], [x + 2, y - 2]], '#c6e0db55', .6);
    }
    return true;
  }
  if (biome === 'emberfall') {
    if (pick < .18) {
      line(c, [[x - 4, y - 1], [x, y + 1], [x + 5, y - 2]], '#180f1955', 1);
      if (pick < .035) line(c, [[x, y + .5], [x + 3, y - 1]], '#b56d4940', .55);
    } else if (pick > .7) {
      polygon(c, [[x - 3, y], [x - 1, y - 2], [x + 3, y - 1], [x + 2, y + 1]], '#91828830');
      line(c, [[x - 1, y - 2], [x + 3, y - 1]], '#c8b1a528', .6);
    }
    return true;
  }
  if (biome === 'autumn' && pick < .4) {
    for (let n = 0; n < 2; n++) leaf(c, x + n * 4, y + n - 1, 1.4 + random() * 1.7,
      n ? '#b391494d' : '#ac743a4d', between(random, -.8, .8));
    return true;
  }
  if (biome === 'highlands' && pick < .49) {
    const length = between(random, 4, 9);
    line(c, [[x, y], [x + 2, y - length * .55], [x + 7, y - length]], '#a2ad8255', .65);
    line(c, [[x + 2, y], [x + 5, y - length * .7]], '#818e7a55', .6);
    if (pick < .14) leaf(c, x + 6, y - length + 1, 1.2, '#b99eb659', -.5);
    return true;
  }
  return false;
}
