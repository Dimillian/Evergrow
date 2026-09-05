import type { PropKind } from './biome-props.ts';
import { randomFromSeed, polygon, line, taper, type Point, type Random } from './art-primitives.ts';
import type { BiomeId } from './biomes.ts';

type Family = 'snowPine' | 'iceCrystal' | 'charredTree' | 'basalt' | 'emberRock' | 'autumnTree'
  | 'leafPile' | 'windTree' | 'heather' | 'limestone' | 'tussock' | 'mushrooms' | 'stump' | 'lilies';
export const BIOME_PROP_BOUNDS: Readonly<Partial<Record<PropKind, readonly [number, number]>>> = Object.freeze({
  snowPine: [144, 180], iceCrystal: [68, 82], charredTree: [126, 154], basalt: [72, 61],
  emberRock: [68, 48], autumnTree: [186, 178], leafPile: [68, 30], windTree: [176, 132],
  heather: [64, 54], limestone: [70, 56], tussock: [64, 57], mushrooms: [50, 40], stump: [60, 44], lilies: [72, 36],
});
const TAU = Math.PI * 2;
const ellipse = (x: number, y: number, rx: number, ry: number, count = 12): Point[] =>
  Array.from({ length: count }, (_, i) => [x + Math.cos(i / count * TAU) * rx, y + Math.sin(i / count * TAU) * ry]);
const between = (random: Random, min: number, max: number) => min + (max - min) * random();
const leaf = (c: CanvasRenderingContext2D, x: number, y: number, size: number, fill: string, tilt = 0) =>
  polygon(c, [[x - size, y + tilt], [x - size * .25, y - size * .6], [x + size, y - tilt], [x + size * .2, y + size * .5]], fill);

function snowPine(c: CanvasRenderingContext2D, random: Random) {
  const lean = between(random, -7, 7), height = between(random, 143, 166);
  polygon(c, [[-13, 1], [-5, -8], [4, -8], [14, 2], [0, 4]], '#4d6565');
  taper(c, [0, 0], [lean, -height + 8], 10, 1.8, '#4f6267');
  line(c, [[-2, -2], [lean - 2, -height * .6]], '#a5b7ae', 1.3);
  for (let tier = 0; tier < 7; tier++) {
    const y = -35 - tier * 17.5, span = 55 - tier * 7, x = lean * (tier + 1) / 7;
    const outline: Point[] = [[x - span, y + 7], [x - span * .68, y - 7], [x - span * .8, y - 10],
      [x - span * .32, y - 21], [x + lean * .1, y - 31], [x + span * .34, y - 15],
      [x + span * .76, y - 7], [x + span * .66, y - 3], [x + span, y + 8],
      [x + span * .35, y + 6], [x + span * .2, y + 13], [x, y + 9], [x - span * .47, y + 13], [x - span * .58, y + 7]];
    polygon(c, outline, tier % 2 ? '#395b62' : '#2a4a55');
    polygon(c, [[x - span, y + 7], [x - span * .68, y - 7], [x - span * .32, y - 21], [x, y - 30],
      [x + span * .3, y - 15], [x + span * .73, y - 6], [x + span * .24, y - 8],
      [x + span * .05, y - 4], [x - span * .18, y - 9], [x - span * .53, y - 2]], tier % 2 ? '#b5cccb' : '#97b8bc');
    line(c, [[x - span * .66, y - 7], [x - span * .32, y - 20], [x, y - 29], [x + span * .31, y - 14]], '#d4dfd6', 1.1);
    for (let branch = 0; branch < 3; branch++) {
      const side = branch % 2 ? -1 : 1, bx = x + side * span * (.2 + branch * .14);
      line(c, [[bx, y + 3], [bx + side * 7, y + 5]], '#728f93', .7);
    }
  }
  polygon(c, [[-13, 1], [-5, -3], [5, -3], [14, 2], [1, 4]], '#b7cbca');
}

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

function charredTree(c: CanvasRenderingContext2D, random: Random) {
  const lean = between(random, -13, 13), height = between(random, 121, 143);
  polygon(c, [[-15, 2], [-6, -9], [5, -9], [17, 2], [2, 0]], '#292d32');
  const trunk: Point[] = [[0, 0], [-2, -36], [lean * .5, -75], [lean, -height + 11], [lean - 4, -height]];
  for (let i = 0; i < trunk.length - 1; i++) {
    taper(c, trunk[i], trunk[i + 1], 13 - i * 2.4, 10 - i * 2.5, '#32343b');
    line(c, [[trunk[i][0] - 3, trunk[i][1]], [trunk[i + 1][0] - 2, trunk[i + 1][1]]], '#7a7270', 1.4);
  }
  for (let arm = 0; arm < 5; arm++) {
    const side = arm % 2 ? -1 : 1, y = -35 - arm * 17, reach = between(random, 25, 49);
    const elbow: Point = [side * reach * .56, y - 12], end: Point = [side * reach, y - 31];
    taper(c, [lean * .3, y], elbow, 6 - arm * .4, 3.6, '#3c3b41');
    taper(c, elbow, end, 3.6, 1.3, '#5e585a');
    line(c, [[side * 2, y - 1], [elbow[0] - 1, elbow[1] - 2], [end[0] - 1, end[1] - 1]], '#97817a', .7);
    taper(c, elbow, [elbow[0] + side * 11, elbow[1] + 2], 2.8, .7, '#756461');
  }
  line(c, [[2, -5], [1, -22], [3.5, -30]], '#9f5d46', .9);
  line(c, [[-5, -42], [-3, -48], [-4.5, -57]], '#6a4f47', .8);
  polygon(c, [[-5, -2], [-1, -5], [2, -2], [0, 1]], '#a98478');
}

function basalt(c: CanvasRenderingContext2D, random: Random, ember: boolean) {
  for (const [x, y, width, height] of [[-12, -3, 20, 28], [12, -1, 23, 37], [-3, 1, 24, 23]]) {
    const top = y - height * (ember ? .65 : 1) - random() * 3;
    polygon(c, [[x - width / 2, y], [x - width / 2, top + 6], [x, top], [x + width / 2, top + 4], [x + width / 2, y - 3], [x, y + 3]], '#363443');
    polygon(c, [[x - width / 2, top + 6], [x, top], [x + width / 2, top + 4], [x, top + 10]], '#777079');
    polygon(c, [[x, top + 10], [x + width / 2, top + 4], [x + width / 2, y - 3], [x, y + 3]], '#242c35');
    line(c, [[x - width / 2, top + 6], [x, top + 10], [x, y]], '#8b8286', .65);
    if (ember) {
      line(c, [[x - 5, y - 3], [x - 3, top + 12], [x + 1, top + 8], [x + 4, top + 10]], '#c67150', 1.2);
      line(c, [[x - 4, y - 7], [x - 3, top + 13], [x + 1, top + 9]], '#f3b477', .55);
    } else line(c, [[x - width / 2 + 1, y - 9], [x - 3, y - 7], [x - 1, y - 13]], '#242b31', .9);
  }
}

function autumnTree(c: CanvasRenderingContext2D, random: Random) {
  const lean = between(random, -8, 8);
  polygon(c, [[-17, 2], [-5, -10], [4, -10], [18, 3], [0, 1]], '#544438');
  taper(c, [0, 0], [lean, -107], 12, 3, '#665344');
  line(c, [[-3, -3], [lean - 2, -79]], '#bc9c6d', 1.5);
  for (const side of [-1, 1]) {
    taper(c, [lean * .5, -43], [side * 45, -91], 7, 2, '#846248');
    taper(c, [side * 20, -66], [side * 63, -72], 4, 1, '#8c6b46');
  }
  const clusters = [[-21, -135, 38, 28], [21, -130, 40, 31], [-53, -105, 32, 28], [51, -93, 32, 29],
    [-12, -106, 43, 35], [-34, -73, 38, 25], [29, -74, 40, 26], [0, -64, 34, 22]];
  const colors = ['#ad753c', '#bc974a', '#775b38', '#b37935', '#9f6735', '#bc8039', '#cf9b49', '#d4aa54'];
  clusters.forEach(([x, y, rx, ry], index) => {
    const points = Array.from({ length: 16 }, (_, edge): Point => {
      const a = edge / 16 * TAU, scallop = (edge % 2 ? .85 : 1) * between(random, .92, 1.05);
      return [x + Math.cos(a) * rx * scallop, y + Math.sin(a) * ry * scallop];
    });
    polygon(c, points, colors[index]);
    line(c, points.slice(8, 14), index % 2 ? '#ecd08b' : '#dbb76c', 1.1);
    for (let mark = 0; mark < 7; mark++) {
      const mx = x + between(random, -.62, .62) * rx, my = y + between(random, -.6, .5) * ry;
      leaf(c, mx, my, between(random, 2, 4.6), mark % 3 ? '#d4ac57' : '#84522f', between(random, -1.4, 1.4));
    }
  });
  for (let fallen = 0; fallen < 7; fallen++) leaf(c, between(random, -19, 20), between(random, -2, 2.5), 2.4, fallen % 2 ? '#bf8545' : '#8d5c36');
}

function windTree(c: CanvasRenderingContext2D, random: Random) {
  polygon(c, [[-16, 2], [-5, -7], [4, -6], [16, 2], [2, 0]], '#515151');
  const bend = between(random, 19, 28);
  taper(c, [0, 0], [9, -37], 12, 8, '#6c6e67');
  taper(c, [9, -37], [bend, -66], 8, 4.2, '#818475');
  taper(c, [bend, -66], [54, -88], 4.2, 1, '#9a9b83');
  line(c, [[-3, -1], [6, -35], [bend - 2, -65], [50, -85]], '#c2c1a4', 1.1);
  for (let branch = 0; branch < 4; branch++) {
    const y = -41 - branch * 11, x = 8 + branch * 7;
    taper(c, [x, y], [x + 30, y - 9], 3.4, 1, '#828677');
  }
  const masses = [[35, -103, 33, 15], [52, -88, 30, 15], [14, -88, 35, 17], [40, -70, 39, 17], [8, -69, 24, 13]];
  masses.forEach(([x, y, rx, ry], index) => {
    polygon(c, [[x - rx, y], [x - rx * .8, y - ry * .5], [x - rx * .28, y - ry], [x + rx * .4, y - ry * .8], [x + rx, y - ry * .2],
      [x + rx * .81, y + ry * .35], [x + rx * .2, y + ry * .75], [x - rx * .5, y + ry * .7]], index % 2 ? '#667557' : '#505f51');
    line(c, [[x - rx * .8, y - ry * .5], [x - rx * .28, y - ry], [x + rx * .4, y - ry * .8]], '#a4aa7c', 1.1);
    for (let leafIndex = 0; leafIndex < 5; leafIndex++) leaf(c, x + between(random, -rx * .65, rx * .6), y + between(random, -ry * .6, ry * .5), 3, '#8b9970', -.5);
  });
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
    snowPine, iceCrystal: crystal, charredTree, basalt: (ctx, r) => basalt(ctx, r, false),
    emberRock: (ctx, r) => basalt(ctx, r, true), autumnTree, windTree, heather, limestone, tussock, mushrooms, stump, lilies,
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
