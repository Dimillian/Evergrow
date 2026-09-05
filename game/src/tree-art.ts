import { polygon, line, taper, randomFromSeed, between, type Point, type Random, type CanvasFactory } from './art-primitives.ts';
import type { Sprite } from './art-types.ts';
import type { PropKind } from './biome-props.ts';

export type TreeKind = 'tree' | 'canopy' | 'willow' | 'autumnTree' | 'snowPine' | 'deadTree' | 'charredTree' | 'windTree';
interface TreePalette { bark: string; barkLight: string; barkDark: string; leaf: readonly string[]; }
export const TREE_BOUNDS: Readonly<Record<TreeKind, readonly [number, number]>> = Object.freeze({
  tree: [144, 174], canopy: [176, 182], willow: [176, 180], autumnTree: [186, 178],
  snowPine: [144, 180], deadTree: [126, 164], charredTree: [126, 154], windTree: [176, 142],
});
const PALETTES: Record<TreeKind, TreePalette> = {
  tree: { bark: '#605b40', barkLight: '#9b9270', barkDark: '#303e31', leaf: ['#172f2c', '#244537', '#345e40', '#50764b', '#81905a'] },
  canopy: { bark: '#625c40', barkLight: '#aaa17b', barkDark: '#293c30', leaf: ['#163b30', '#22523a', '#3b7046', '#63864e', '#a3aa69'] },
  willow: { bark: '#627974', barkLight: '#a2b29a', barkDark: '#2b4845', leaf: ['#1b3d3d', '#2b5551', '#3d7060', '#658977', '#9bad83'] },
  autumnTree: { bark: '#766048', barkLight: '#b6a078', barkDark: '#403c32', leaf: ['#583c2c', '#855330', '#b47b39', '#d1a34f', '#efd28a'] },
  snowPine: { bark: '#5c6b70', barkLight: '#a7b5ac', barkDark: '#303f48', leaf: ['#243e49', '#34545c', '#547978', '#a4c1c3', '#e0e6db'] },
  deadTree: { bark: '#677773', barkLight: '#afba9f', barkDark: '#344641', leaf: [] },
  charredTree: { bark: '#424148', barkLight: '#88817a', barkDark: '#232d31', leaf: [] },
  windTree: { bark: '#737b6c', barkLight: '#b9bca0', barkDark: '#3d4b48', leaf: ['#30453e', '#445c47', '#607850', '#869264', '#b3b78a'] },
};
export const isTreeKind = (kind: PropKind): kind is TreeKind => Object.hasOwn(TREE_BOUNDS, kind);

/** Three authored growth habits per family, with variation inside their shared physical crown bounds. */
export function createTreeSprite(factory: CanvasFactory, kind: TreeKind, seed: number): Sprite {
  const [width, height] = TREE_BOUNDS[kind], anchorX = width / 2, anchorY = height - 5;
  const surfaces = Array.from({ length: PALETTES[kind].leaf.length ? 3 : 1 }, () => {
    const image = factory(width, height); image.width = width; image.height = height;
    const c = image.getContext('2d');
    if (!c) throw new Error('A 2D canvas context is required for tree art.');
    c.translate(anchorX, anchorY);
    return { image, c };
  });
  const random = randomFromSeed(seed), habit = Math.floor(random() * 3);
  const palette = PALETTES[kind], pine = kind === 'snowPine', wind = kind === 'windTree';
  const bare = palette.leaf.length === 0;
  const tall = (height - 18) * (habit === 0 ? .91 : habit === 1 ? .97 : .82);
  const spread = (width / 2 - 10) * (habit === 0 ? .76 : habit === 1 ? .93 : 1);
  const lean = wind ? 24 : between(random, bare ? -17 : -9, bare ? 17 : 9);
  const trunk = surfaces[0].c;
  const thick = habit === 2 ? 13 : habit === 1 ? 9 : 6.5;
  for (let root = 0; root < 6; root++) {
    const a = Math.PI + root / 5 * Math.PI, length = between(random, 11, 24);
    const end: Point = [Math.cos(a) * length, Math.sin(a) * 6 + 1];
    taper(trunk, [0, -11], end, thick * .65, .8, palette.barkDark);
    line(trunk, [[-1, -10], [end[0] * .52 - 1, end[1] - 2], end], palette.bark, 1.7);
  }
  const spine: Point[] = [[0, 0], [-2, -tall * .26], [lean * .5, -tall * .51], [lean, -tall * .78], [lean + 3, -tall]];
  for (let i = 0; i < spine.length - 1; i++) {
    taper(trunk, spine[i], spine[i + 1], thick * (1 - i * .23), Math.max(1, thick * (.76 - i * .22)), palette.bark);
    line(trunk, [[spine[i][0] - thick * .25, spine[i][1]], [spine[i + 1][0] - thick * .13, spine[i + 1][1]]], palette.barkLight, i === 0 ? 1.4 : .85);
  }
  // Furrowed bark follows the trunk, with narrow lit ridges and a broken dark seam.
  for (let mark = 0; mark < 18; mark++) {
    const y = -4 - random() * tall * .65, x = lean * (-y / tall) + between(random, -thick * .24, thick * .25);
    line(trunk, [[x, y], [x - 1, y - 4], [x + .4, y - 8 - random() * 6]], mark % 3 ? palette.barkDark : palette.barkLight, mark % 3 ? .7 : .5);
  }
  if (habit === 2) {
    taper(trunk, [-1, -tall * .25], [-spread * .36, -tall * .61], thick * .8, 3, palette.bark);
    line(trunk, [[-3, -tall * .26], [-spread * .37, -tall * .61]], palette.barkLight, 1.2);
  }
  const branches = pine ? 8 : bare ? (habit === 0 ? 5 : habit === 1 ? 8 : 6) : 6;
  for (let b = 0; b < branches; b++) {
    const side = b % 2 ? 1 : -1, f = b / branches;
    const start: Point = [lean * (.3 + f * .5), -tall * (.32 + f * .48 + (bare ? random() * .07 : 0))];
    const reach = spread * (1 - f * .46) * between(random, .78, .98);
    const end: Point = [wind ? 5 + reach * .75 : start[0] + side * reach, start[1] - tall * (pine ? .03 : bare ? .07 + random() * .17 : .14)];
    const elbow: Point = [(start[0] + end[0]) * .5, start[1] - tall * (bare ? .025 + random() * .06 : .035)];
    taper(trunk, start, elbow, thick * .43 * (1 - f * .6), 2.2, palette.barkDark);
    taper(trunk, elbow, end, 2.8, .5, palette.bark);
    line(trunk, [[start[0] - 1, start[1] - 1], [elbow[0] - 1, elbow[1] - 1], [end[0], end[1] - 1]], palette.barkLight, .75);
    taper(trunk, elbow, [end[0] - side * 6, end[1] - 13], 1.7, .3, palette.bark);
    if (bare) {
      line(trunk, [end, [end[0] + side * 3, end[1] - 13], [end[0] + side * 9, end[1] - 18]], palette.barkLight, .7);
      if (b % 3 === 0) line(trunk, [elbow, [elbow[0] + side * 7, elbow[1] + 5], [elbow[0] + side * 12, elbow[1] + 3]], palette.bark, 1.1);
    }
  }
  if (bare) {
    // Broken elder top and shelf fungi distinguish age without adding collision.
    if (habit === 2) polygon(trunk, [[lean - 3, -tall * .81], [lean - 5, -tall * .93], [lean, -tall * .9], [lean + 3, -tall * .97], [lean + 4, -tall * .8]], palette.barkLight);
    for (let i = 0; i < 3; i++) {
      const x = i % 2 ? 4 : -4, y = -18 - i * 10;
      polygon(trunk, [[x - 3, y], [x - 2, y - 2], [x + 3, y - 3], [x + 4, y], [x, y + 1]], kind === 'charredTree' ? '#795944' : '#959d7c');
    }
    if (kind === 'charredTree') line(trunk, [[1, -7], [-1, -19], [2, -27], [0, -35]], '#b4724e', .8);
  } else if (pine) {
    const tiers = habit === 0 ? 7 : habit === 1 ? 8 : 6;
    for (let tier = 0; tier < tiers; tier++) {
      const f = tier / tiers, y = -25 - f * (tall - 28), span = spread * (1 - f * .9) * between(random, .86, 1);
      const x = lean * f + between(random, -2, 2), c = surfaces[tier % 2 + 1].c;
      const points: Point[] = [[x - span, y + 4], [x - span * .67, y - 5], [x - span * .81, y - 8], [x - span * .3, y - 17], [x, y - 28], [x + span * .42, y - 13], [x + span * .85, y - 4], [x + span, y + 5], [x + span * .3, y + 3], [x, y + 10], [x - span * .43, y + 5]];
      polygon(c, points, palette.leaf[tier % 2]);
      for (let needle = 0; needle < 12; needle++) {
        const nx = between(random, -span * .85, span * .85) + x, ny = y + between(random, -6, 4);
        line(c, [[nx, ny - 3], [nx + 4, ny + 3]], palette.leaf[2], .7);
      }
      polygon(c, [[x - span * .91, y + 1], [x - span * .63, y - 5], [x - span * .3, y - 17], [x, y - 27], [x + span * .38, y - 13], [x + span * .79, y - 5], [x + span * .28, y - 6], [x + span * .08, y - 2], [x - span * .21, y - 7], [x - span * .52, y]], palette.leaf[3]);
      line(c, [[x - span * .63, y - 5], [x - span * .3, y - 17], [x, y - 27], [x + span * .36, y - 14]], palette.leaf[4], 1.5);
    }
  } else {
    // Different structures: narrow central leader, asymmetric fork, broad old crown.
    const clusters: Array<[number, number, number, number]> = habit === 0
      ? [[lean, -.84, .52, .18], [-.28, -.69, .59, .17], [.34, -.62, .52, .17], [-.22, -.49, .56, .18], [.2, -.41, .52, .15]]
      : habit === 1 ? [[-.36, -.79, .58, .17], [.28, -.88, .48, .15], [-.58, -.58, .43, .18], [.51, -.64, .48, .19], [-.12, -.61, .64, .2], [.25, -.44, .55, .16]]
        : [[-.39, -.73, .58, .19], [.32, -.7, .62, .18], [-.55, -.48, .45, .18], [.55, -.44, .43, .17], [-.09, -.5, .62, .2], [-.19, -.36, .53, .14]];
    clusters.forEach(([xx, yy, rx, ry], i) => {
      const x = (i === 0 && habit === 0 ? xx : xx * spread * (wind ? .85 : 1)) + (wind ? 15 : 0);
      const y = yy * tall + (wind ? 9 : 0);
      const c = surfaces[i % 2 + 1].c;
      crown(c, x, y, rx * spread * (wind ? .8 : 1), ry * tall * (wind ? .65 : 1), palette.leaf, random, i);
      if (kind === 'willow') {
        for (let vine = 0; vine < 7; vine++) {
          const vx = x + between(random, -.75, .75) * rx * spread, vy = y + ry * tall * .45;
          const len = between(random, 14, 35);
          line(c, [[vx, vy], [vx + 2, vy + len * .6], [vx - 1, vy + len]], palette.leaf[2], .65);
          for (let leaf = 0; leaf < 5; leaf++) {
            const ly = vy + leaf * len / 5;
            polygon(c, [[vx, ly], [vx - 3, ly + 2], [vx - 1, ly + 6], [vx + 1, ly + 2]], palette.leaf[leaf % 2 ? 2 : 3]);
          }
        }
      }
    });
  }
  return { image: surfaces[0].image, width, height, anchorX, anchorY,
    foliage: surfaces.length > 1 ? surfaces.slice(1).map(s => s.image) : undefined };
}

function crown(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number,
  colors: readonly string[], random: Random, index: number) {
  const points: Point[] = Array.from({ length: 24 }, (_, i) => {
    const a = i / 24 * Math.PI * 2, r = (i % 3 === 0 ? .86 : 1) * between(random, .9, 1.05);
    return [x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r];
  });
  polygon(c, points, colors[0]);
  polygon(c, points.map(([px, py]) => [x + (px - x) * .94 - rx * .035, y + (py - y) * .84 - ry * .12]), colors[1]);
  // Broad top-facing color masses, then small grouped leaves. No uniform perimeter outline.
  for (let group = 0; group < 7; group++) {
    const a = group * 2.399 + index, radius = group === 0 ? 0 : .55;
    const gx = x + Math.cos(a) * rx * radius - rx * .09, gy = y + Math.sin(a) * ry * radius - ry * .18;
    const w = rx * between(random, .26, .4), h = ry * between(random, .25, .4);
    polygon(c, [[gx - w, gy], [gx - w * .7, gy - h * .65], [gx - w * .22, gy - h * .55], [gx, gy - h], [gx + w * .56, gy - h * .75], [gx + w, gy - h * .15], [gx + w * .65, gy + h * .5], [gx, gy + h * .65], [gx - w * .5, gy + h * .4]], colors[group % 3 === 0 ? 3 : 2]);
    for (let l = 0; l < 5; l++) {
      const lx = gx + between(random, -.8, .65) * w, ly = gy + between(random, -.7, .3) * h;
      const size = between(random, 1.3, 3.1);
      polygon(c, [[lx - size, ly], [lx, ly - size * .55], [lx + size * 1.5, ly - .4], [lx + size * .5, ly + size * .5]], colors[l === 0 && group < 4 ? 4 : 3]);
    }
  }
  for (let notch = 0; notch < 4; notch++) {
    const nx = x + between(random, -.7, .7) * rx, ny = y + between(random, .1, .6) * ry;
    line(c, [[nx - 3, ny], [nx, ny + 1], [nx + 4, ny - 1]], colors[0], 1.4);
  }
}
