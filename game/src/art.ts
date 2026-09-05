import { STARTING_SWORD, type WeaponVisual } from './equipment.ts';
import { getActiveSwingOffset } from './attack-motion.ts';

/** Procedural art only: every cached image below is drawn from geometry. */
export interface Sprite {
  image: HTMLCanvasElement;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
}

export const PLAYER_ART_SCALE = 1.24;

export interface ArmorMaterial {
  readonly base: string;
  readonly shadow: string;
  readonly edge: string;
  readonly trim: string;
}

/** Geometry style and material are independent, so equipment needs no textures. */
export interface ArmorPiece {
  readonly style: 'plate' | 'leather';
  readonly seed: number;
  readonly material: ArmorMaterial;
}

export interface CloakPiece {
  readonly base: string;
  readonly shadow: string;
  readonly highlight: string;
  readonly trim: string;
  readonly seed: number;
}

export interface CharacterOutfit {
  readonly head: ArmorPiece | null;
  readonly chest: ArmorPiece | null;
  readonly shoulders: ArmorPiece | null;
  readonly hands: ArmorPiece | null;
  readonly legs: ArmorPiece | null;
  readonly boots: ArmorPiece | null;
  readonly cloak: CloakPiece | null;
}

const STEEL: ArmorMaterial = { base: '#728c81', shadow: '#294750', edge: '#d1d6b0', trim: '#cfaa6c' };
const LEATHER: ArmorMaterial = { base: '#5c4c41', shadow: '#292b30', edge: '#a79873', trim: '#b18b58' };
export const STARTER_OUTFIT: CharacterOutfit = {
  head: { style: 'plate', seed: 31, material: STEEL },
  chest: { style: 'plate', seed: 17, material: STEEL },
  shoulders: { style: 'plate', seed: 42, material: STEEL },
  hands: { style: 'plate', seed: 23, material: STEEL },
  legs: { style: 'plate', seed: 59, material: STEEL },
  boots: { style: 'leather', seed: 11, material: LEATHER },
  cloak: { base: '#92364e', shadow: '#4e2a3e', highlight: '#cf5e69', trim: '#d4a070', seed: 71 },
};

/** Rest-space mounts; animated limbs carry their attached pieces with them. */
export const PLAYER_ATTACHMENTS = {
  head: [0, -33], chest: [0, -21], waist: [0, -13],
  leftShoulder: [-6.5, -26], rightShoulder: [6.5, -26],
  leftHip: [-3.4, -12], rightHip: [3.4, -12],
  leftFoot: [-3.6, 0], rightFoot: [3.6, 0],
} as const;

export interface CharacterPose {
  kind: 'player' | 'stalker' | 'brute' | 'caster';
  /** Canvas radians: zero faces right, PI / 2 faces down. */
  angle: number;
  /** Elapsed animation time in seconds. */
  time: number;
  /** Radians accumulated from distance travelled, independent of idle/cape time. */
  gaitPhase?: number;
  /** Movement direction, independent of where the weapon is aimed. */
  moveAngle?: number;
  moving: number;
  /** Normalized swing progress; negative values are an enemy's windup progress. */
  attack: number;
  attackAngle: number;
  /** Normalized active-window boundaries from the simulation's attack recipe. */
  attackStart?: number;
  attackEnd?: number;
  attackArc?: number;
  /** Normalized casting windup. Zero means the hand is relaxed. */
  cast?: number;
  weapon?: WeaponVisual;
  /** Slots can be replaced or set to null independently, without altering the rig. */
  outfit?: Partial<CharacterOutfit>;
  /** Remaining bright-hit timer in seconds (0.16 seconds at impact). */
  hitFlash: number;
  /** Normalized remaining impact animation, from one at contact to zero at rest. */
  impact?: number;
  /** Direction away from the attacker; recoil never moves the ground anchor. */
  impactAngle?: number;
  dodging: boolean;
  /** Normalized dodge progress, from launch through recovery. */
  dodgeProgress?: number;
  dead?: boolean;
}

type Point = readonly [number, number];
type Affine = readonly [number, number, number, number, number, number];

function compose(a: Affine, b: Affine): Affine {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}

function transformPoint(matrix: Affine, point: Point): Point {
  return [matrix[0] * point[0] + matrix[2] * point[1] + matrix[4],
    matrix[1] * point[0] + matrix[3] * point[1] + matrix[5]];
}

type Random = () => number;
type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;
type Color = (value: string) => string;

const TAU = Math.PI * 2;
const TREE_VARIANTS = 48;
const ROCK_VARIANTS = 32;
const GRASS_VARIANTS = 32;
const WEAPON_REST_ANGLE = -0.46;

function clamp(value: number, low = 0, high = 1): number {
  return Math.max(low, Math.min(high, value));
}

function smooth(value: number): number {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

/** The weapon and its renderer-owned trail share exactly the same sweep. */
export function getSwingAngle(
  angle: number,
  progress: number,
  activeStart = 0.2,
  activeEnd = 0.5,
  arc = 2.3,
): number {
  const start = clamp(activeStart, 0.01, 0.95);
  const end = clamp(activeEnd, start + 0.01, 0.99);
  const rest = WEAPON_REST_ANGLE;
  const from = -arc * 0.5;
  const to = arc * 0.5;
  const t = clamp(progress);
  if (t < start) return angle + rest + (from - rest) * smooth(t / start);
  if (t < end) return angle + getActiveSwingOffset((t - start) / (end - start), arc);
  const recovery = (t - end) / (1 - end);
  // Finish the motion before bringing the blade back: the hand does not reverse
  // at full speed on the exact tick where the damaging arc ends.
  const settle = smooth((recovery - 0.14) / 0.86);
  return angle + to + (rest - to) * settle + 0.22 * Math.sin(recovery * Math.PI) ** 2 * (1 - settle);
}

function elbowFor(shoulder: Point, hand: Point, side: number, anticipation = 0): Point {
  const dx = hand[0] - shoulder[0], dy = hand[1] - shoulder[1];
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  // The last few percent of reach stretch softly instead of snapping a joint.
  const stretch = Math.max(1, distance / 19.7);
  const upper = 9.1 * stretch, fore = 10.8 * stretch;
  const along = clamp((upper * upper - fore * fore + distance * distance) / (2 * distance), 0, upper);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  const nx = -dy / distance, ny = dx / distance;
  const bend = Math.tanh((nx * side + ny * (0.5 - anticipation * 0.75)) * 2.5);
  return [shoulder[0] + dx / distance * along + nx * height * bend,
    shoulder[1] + dy / distance * along + ny * height * bend];
}

function hash(value: number): number {
  let x = value | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}

function randomFromSeed(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function between(random: Random, min: number, max: number): number {
  return min + (max - min) * random();
}

function polygon(ctx: CanvasRenderingContext2D, points: readonly Point[], fill: string): void {
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index][0], points[index][1]);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function line(
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  color: string,
  width: number,
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index][0], points[index][1]);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'bevel';
  ctx.lineCap = 'butt';
  ctx.stroke();
}

function taper(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  fromWidth: number,
  toWidth: number,
  fill: string,
): void {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length / 2;
  const ny = dx / length / 2;
  polygon(ctx, [
    [from[0] + nx * fromWidth, from[1] + ny * fromWidth],
    [to[0] + nx * toWidth, to[1] + ny * toWidth],
    [to[0] - nx * toWidth, to[1] - ny * toWidth],
    [from[0] - nx * fromWidth, from[1] - ny * fromWidth],
  ], fill);
}

function mixColor(from: string, to: string, amount: number): string {
  const a = Number.parseInt(from.slice(1), 16);
  const b = Number.parseInt(to.slice(1), 16);
  const red = Math.round(((a >>> 16) & 255) * (1 - amount) + ((b >>> 16) & 255) * amount);
  const green = Math.round(((a >>> 8) & 255) * (1 - amount) + ((b >>> 8) & 255) * amount);
  const blue = Math.round((a & 255) * (1 - amount) + (b & 255) * amount);
  return `rgb(${red},${green},${blue})`;
}

function makeSprite(factory: CanvasFactory, width: number, height: number): Sprite {
  const image = factory(width, height);
  image.width = width;
  image.height = height;
  return { image, width, height, anchorX: width / 2, anchorY: height - 4 };
}

function context(sprite: Sprite): CanvasRenderingContext2D {
  const ctx = sprite.image.getContext('2d');
  if (!ctx) throw new Error('Evergrowing needs a 2D canvas context to draw its procedural artwork.');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** Finite variant libraries keep texture memory independent of explored distance. */
export class ArtLibrary {
  private readonly factory: CanvasFactory;
  private readonly livingTrees = new Map<number, Sprite>();
  private readonly deadTrees = new Map<number, Sprite>();
  private readonly rocks = new Map<number, Sprite>();
  private readonly grasses = new Map<number, Sprite>();
  private shrine: Sprite | undefined;

  constructor(createCanvas?: CanvasFactory) {
    this.factory = createCanvas ?? ((width, height) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    });
  }

  getTree(seed: number, dead: boolean): Sprite {
    const variant = hash(seed) % TREE_VARIANTS;
    const cache = dead ? this.deadTrees : this.livingTrees;
    let sprite = cache.get(variant);
    if (!sprite) {
      const random = randomFromSeed(hash(variant + (dead ? 8901 : 1741)));
      sprite = dead ? this.drawDeadTree(random) : this.drawLivingTree(random);
      cache.set(variant, sprite);
    }
    return sprite;
  }

  getRock(seed: number): Sprite {
    const variant = hash(seed) % ROCK_VARIANTS;
    let sprite = this.rocks.get(variant);
    if (!sprite) {
      sprite = this.drawRock(randomFromSeed(hash(variant + 6169)));
      this.rocks.set(variant, sprite);
    }
    return sprite;
  }

  getGrass(seed: number): Sprite {
    const variant = hash(seed) % GRASS_VARIANTS;
    let sprite = this.grasses.get(variant);
    if (!sprite) {
      const random = randomFromSeed(hash(variant + 9923));
      sprite = makeSprite(this.factory, 22, 17);
      sprite.anchorY = 14;
      const ctx = context(sprite);
      for (let blade = 0; blade < 5; blade += 1) {
        const x = between(random, 7, 15);
        const height = between(random, 4, 12);
        polygon(ctx, [[x - 1, 14], [x + between(random, -5, 5), 14 - height], [x + 1.5, 14]],
          blade % 2 === 0 ? '#456248' : '#234f43');
      }
      this.grasses.set(variant, sprite);
    }
    return sprite;
  }

  getShrine(): Sprite {
    if (this.shrine) return this.shrine;
    const sprite = makeSprite(this.factory, 50, 75);
    sprite.anchorY = 72;
    const ctx = context(sprite);

    // Three simple plinths and a narrow stone spire, viewed from overhead.
    polygon(ctx, [[9, 64], [31, 56], [45, 63], [35, 73], [9, 69]], '#313b39');
    polygon(ctx, [[7, 60], [30, 52], [43, 58], [33, 67], [7, 64]], '#606151');
    polygon(ctx, [[7, 64], [33, 67], [33, 72], [7, 68]], '#444b43');
    polygon(ctx, [[33, 67], [43, 58], [43, 63], [33, 72]], '#2d3937');
    line(ctx, [[8, 60], [7, 64], [32, 67]], '#92907a', 0.8);
    polygon(ctx, [[17, 54], [30, 49], [40, 53], [31, 61], [17, 58]], '#6a6a57');
    polygon(ctx, [[17, 58], [31, 61], [31, 65], [17, 61]], '#484f43');
    polygon(ctx, [[22, 16], [34, 20], [35, 53], [22, 57]], '#626354');
    polygon(ctx, [[34, 20], [40, 16], [40, 50], [35, 53]], '#374540');
    polygon(ctx, [[20, 15], [31, 3], [41, 15], [34, 20]], '#767563');
    polygon(ctx, [[31, 3], [41, 15], [34, 20]], '#414b43');
    line(ctx, [[31, 3], [20, 15], [34, 20]], '#b1a788', 0.8);
    line(ctx, [[24, 22], [24, 48], [34, 51]], '#8b8c71', 0.8);
    polygon(ctx, [[26, 42], [26, 31], [29, 27], [32, 33], [32, 44]], '#384740');
    line(ctx, [[27, 41], [27, 32], [29, 29], [31, 34], [31, 42]], '#a39367', 0.8);
    line(ctx, [[29, 34], [29, 39]], '#bcad75', 1);

    // A lantern has an emissive core; its ground-light pool belongs to the renderer.
    taper(ctx, [15, 57], [15, 29], 2.8, 2, '#5c5239');
    line(ctx, [[15, 30], [7, 26], [5, 29]], '#927347', 1.6);
    line(ctx, [[7, 28], [7, 35]], '#756040', 1);
    polygon(ctx, [[3, 37], [7, 34], [11, 38], [10, 47], [6, 49], [3, 46]], '#302b22');
    polygon(ctx, [[4, 38], [7, 36], [10, 39], [9, 46], [6, 47], [4, 45]], '#d7a348');
    polygon(ctx, [[6, 39], [8, 40], [8, 45], [6, 45]], '#f9d88b');
    line(ctx, [[3, 37], [7, 39], [11, 38]], '#9b763e', 0.8);

    polygon(ctx, [[2, 69], [9, 66], [13, 70], [8, 74], [3, 73]], '#545746');
    polygon(ctx, [[42, 68], [46, 65], [49, 68], [46, 71]], '#52594b');
    this.shrine = sprite;
    return sprite;
  }

  private drawLivingTree(random: Random): Sprite {
    const width = Math.floor(between(random, 92, 131));
    const height = Math.floor(between(random, 112, 161));
    const sprite = makeSprite(this.factory, width, height);
    const ctx = context(sprite);
    const x = sprite.anchorX;
    const y = sprite.anchorY;
    const lean = between(random, -6, 6);
    const trunk: Point[] = [[x, y], [x - 1, height * 0.76], [x + lean, height * 0.52], [x + lean * 1.5, height * 0.24]];

    polygon(ctx, [[x - 10, y + 1], [x - 3, y - 7], [x + 3, y - 7], [x + 9, y + 2], [x, y]], '#242a24');
    for (let segment = 0; segment < trunk.length - 1; segment += 1) {
      taper(ctx, trunk[segment], trunk[segment + 1], 7.5 - segment * 1.9, 5.6 - segment * 1.9, '#4f4934');
    }
    line(ctx, [[x - 2, y - 2], [x - 2, height * 0.78], [x + lean - 1, height * 0.53]], '#716247', 1);
    for (const side of [-1, 1]) {
      const branchY = height * between(random, 0.68, 0.78);
      const middle: Point = [x + side * width * 0.15, branchY - height * 0.12];
      const tip: Point = [x + side * width * between(random, 0.24, 0.30), branchY - height * 0.30];
      taper(ctx, [x, branchY], middle, 4.6, 3.2, '#62563a');
      taper(ctx, middle, tip, 3.2, 1.1, '#5a5139');
      taper(ctx, middle, [middle[0] + side * width * 0.14, middle[1] - height * 0.04], 2.1, 0.8, '#62583c');
    }

    const masses: readonly (readonly [number, number, number, number, string])[] = [
      [-0.21, 0.24, 0.22, 0.14, '#234c3d'],
      [0.10, 0.19, 0.24, 0.15, '#3a6344'],
      [-0.32, 0.39, 0.18, 0.16, '#1b3d35'],
      [0.29, 0.36, 0.20, 0.17, '#234a39'],
      [-0.03, 0.38, 0.27, 0.19, '#365b40'],
      [-0.23, 0.56, 0.22, 0.15, '#3d6748'],
      [0.19, 0.55, 0.23, 0.16, '#22513e'],
      [-0.02, 0.55, 0.21, 0.17, '#4a7250'],
    ];
    const template: readonly Point[] = [
      [-0.57, -0.88], [0.12, -1], [0.31, -0.79], [0.75, -0.76],
      [0.84, -0.30], [1, 0.03], [0.76, 0.49], [0.39, 0.57],
      [0.14, 0.91], [-0.38, 0.79], [-0.55, 0.50], [-0.89, 0.45], [-1, 0.05], [-0.75, -0.30],
    ];
    for (const [offsetX, offsetY, radiusX, radiusY, fill] of masses) {
      const centerX = x + width * offsetX + between(random, -2, 2);
      const centerY = height * offsetY + between(random, -3, 3);
      const points: Point[] = template.map(([px, py]) => [
        Math.round((centerX + px * width * radiusX * between(random, 0.91, 1.07)) / 2) * 2,
        Math.round((centerY + py * height * radiusY * between(random, 0.91, 1.07)) / 2) * 2,
      ]);
      polygon(ctx, points, fill);
      ctx.save();
      ctx.clip();
      // Directional color bands sell a material using the same few polygons.
      line(ctx, points.slice(0, 5), '#759467', 1.4);
      // A sparse, quiet material mark stays inside each large foliage mass.
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#a2b878';
      for (let fleck = 0; fleck < 3; fleck += 1) {
        ctx.fillRect(Math.floor(centerX + between(random, -10, 7)), Math.floor(centerY + between(random, -8, 6)), between(random, 2, 5), 1);
      }
      ctx.restore();
    }
    return sprite;
  }

  private drawDeadTree(random: Random): Sprite {
    const width = Math.floor(between(random, 79, 112));
    const height = Math.floor(between(random, 105, 154));
    const sprite = makeSprite(this.factory, width, height);
    const ctx = context(sprite);
    const x = sprite.anchorX;
    const y = sprite.anchorY;
    const lean = between(random, -11, 11);
    const trunk: Point[] = [
      [x, y], [x + between(random, -3, 3), height * 0.77],
      [x + lean * 0.4, height * 0.55], [x + lean, height * 0.30],
      [x + lean * 0.8 + between(random, -4, 4), height * 0.08],
    ];
    polygon(ctx, [[x - 9, y + 1], [x - 3, y - 8], [x + 4, y - 7], [x + 10, y + 2]], '#343c32');
    const bark = random() > 0.5 ? '#858771' : '#777c69';
    for (let index = 0; index < trunk.length - 1; index += 1) {
      const fromWidth = 10 - index * 2.1;
      const toWidth = 7.9 - index * 2.1;
      taper(ctx, trunk[index], trunk[index + 1], fromWidth, toWidth, bark);
      const from = trunk[index];
      const to = trunk[index + 1];
      taper(ctx, [from[0] - fromWidth * 0.25, from[1]], [to[0] - toWidth * 0.25, to[1]], fromWidth * 0.28, toWidth * 0.28, '#a0a086');
    }
    // Angular branch chains and fine terminal forks establish a bone silhouette.
    for (let level = 0; level < 4; level += 1) {
      const originY = height * (0.72 - level * 0.16);
      const originX = x + lean * (1 - originY / height);
      const side = level % 2 === 0 ? -1 : 1;
      const reach = width * between(random, 0.25, 0.36) * (1 - level * 0.08);
      const middle: Point = [originX + side * reach * 0.56, originY - height * between(random, 0.06, 0.10)];
      const tip: Point = [originX + side * reach, middle[1] - height * between(random, 0.12, 0.19)];
      taper(ctx, [originX, originY], middle, 4.8 - level * 0.6, 2.8 - level * 0.3, bark);
      taper(ctx, middle, tip, 2.8 - level * 0.3, 0.7, '#999b80');
      taper(ctx, middle, [middle[0] + side * reach * 0.46, middle[1] - height * 0.015], 2.1, 0.7, '#8d9178');
      const fork: Point = [tip[0] - side * reach * 0.12, tip[1] + height * 0.055];
      taper(ctx, fork, [fork[0] - side * 5, fork[1] - 11], 1.3, 0.6, '#969b80');
    }
    taper(ctx, trunk[2], [trunk[2][0] + width * 0.29, trunk[2][1] - height * 0.07], 4.2, 1.2, '#858b72');
    taper(ctx, [trunk[2][0] + width * 0.24, trunk[2][1] - height * 0.06], [trunk[2][0] + width * 0.27, trunk[2][1] - height * 0.16], 1.8, 0.6, '#a9a78a');
    line(ctx, [[x + 1, y - 10], [x, y - 18]], '#485144', 1);
    return sprite;
  }

  private drawRock(random: Random): Sprite {
    const width = Math.floor(between(random, 19, 33));
    const height = Math.floor(between(random, 18, 31));
    const sprite = makeSprite(this.factory, width, height);
    const ctx = context(sprite);
    const left: Point = [2, height * 0.50];
    const crown: Point = [width * between(random, 0.30, 0.47), 2];
    const topRight: Point = [width * 0.79, height * 0.19];
    const right: Point = [width - 2, height * 0.65];
    const foot: Point = [width * 0.62, height - 3];
    const front: Point = [width * 0.25, height - 4];
    const center: Point = [width * 0.53, height * 0.57];
    polygon(ctx, [left, crown, topRight, right, foot, front], '#444e46');
    polygon(ctx, [left, crown, topRight, center], '#656657');
    polygon(ctx, [topRight, right, foot, center], '#394940');
    polygon(ctx, [left, center, foot, front], '#52534a');
    line(ctx, [left, crown, topRight], '#8b8770', 0.7);
    if (random() > 0.5) {
      polygon(ctx, [[width * 0.14, height * 0.59], [width * 0.39, height * 0.66], [width * 0.35, height * 0.75], [width * 0.13, height * 0.69]], '#45583c');
    }
    return sprite;
  }
}

function boot(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, color: Color): void {
  polygon(ctx, [[x - width, y - 6], [x + width - 0.5, y - 6], [x + width + 1, y], [x - width, y + 1]], color('#141e20'));
  line(ctx, [[x - width + 1, y - 5], [x - width + 1, y - 1]], color('#53605a'), 0.8);
}

function sword(ctx: CanvasRenderingContext2D, hand: Point, angle: number, color: Color, visual = STARTING_SWORD.visual): void {
  ctx.save();
  ctx.translate(hand[0], hand[1]);
  ctx.rotate(angle);
  const length = Math.max(8, visual.length), halfWidth = Math.max(0.7, visual.width * 0.5);
  const guard = Math.max(3.6, halfWidth * 2.4);
  polygon(ctx, [[-5, -1.3], [3, -1.3], [3, 1.3], [-5, 1.3]], color(visual.grip));
  for (let wrap = 0; wrap < 3; wrap++) {
    line(ctx, [[-4 + wrap * 1.8, -1.2], [-3.2 + wrap * 1.8, 1.2]], color('#bd9461'), 0.5);
  }
  polygon(ctx, [[3, -halfWidth], [length * 0.77, -halfWidth * 0.66], [length, 0],
    [length * 0.77, halfWidth * 0.68], [3, halfWidth]], color(visual.metal));
  polygon(ctx, [[3, -halfWidth], [length * 0.77, -halfWidth * 0.66], [length, 0], [4, -0.15]], color(visual.edge));
  line(ctx, [[5, 0.3], [length * 0.74, 0.3]], color('#456664'), 0.55);
  polygon(ctx, [[0.5, -guard + 0.8], [2.5, -guard], [4, -guard + 1.2],
    [3.8, guard - 1], [2, guard], [0.8, guard - 0.4]], color(visual.guard));
  line(ctx, [[1, -guard + 1], [2.5, -guard + 0.7], [3, guard - 1]], color(visual.edge), 0.55);
  polygon(ctx, [[-7, -1.1], [-5.5, -2], [-4.2, -0.8], [-4.2, 0.8], [-5.5, 2], [-7, 1]], color(visual.guard));
  ctx.fillStyle = color('#8b4c49');
  ctx.fillRect(-6, -0.65, 1.1, 1.3);
  if (visual.glow) line(ctx, [[5, -halfWidth], [length * 0.77, -halfWidth * 0.66], [length, 0]], color(visual.glow), 0.55);
  ctx.restore();
}

function armorArm(
  ctx: CanvasRenderingContext2D, shoulder: Point, elbow: Point, hand: Point,
  piece: ArmorPiece | null, color: Color,
): void {
  taper(ctx, shoulder, elbow, 4.5, 3.4, color('#263a39'));
  taper(ctx, elbow, hand, 3.4, 2.1, color('#5b5145'));
  if (piece) {
    const m = piece.material;
    const cuff: Point = [elbow[0] * 0.28 + hand[0] * 0.72, elbow[1] * 0.28 + hand[1] * 0.72];
    taper(ctx, elbow, cuff, piece.style === 'plate' ? 4.4 : 3.4, 3, color(m.shadow));
    taper(ctx, [elbow[0] - 0.5, elbow[1] - 0.6], [cuff[0] - 0.5, cuff[1] - 0.3], 3.1, 2.2, color(m.base));
    line(ctx, [[elbow[0] - 1.4, elbow[1]], [cuff[0] - 1.2, cuff[1]]], color(m.edge), 0.65);
    line(ctx, [[cuff[0] - 1.6, cuff[1] - 0.7], [cuff[0] + 1.6, cuff[1] + 0.7]], color(m.trim), 0.8);
  }
  const material = piece?.material ?? LEATHER;
  polygon(ctx, [[hand[0] - 2, hand[1] - 1.7], [hand[0] + 1.5, hand[1] - 2],
    [hand[0] + 2.1, hand[1] + 0.8], [hand[0] + 1.1, hand[1] + 2], [hand[0] - 1.5, hand[1] + 1.6]], color(material.base));
  line(ctx, [[hand[0] - 1.4, hand[1] - 1.2], [hand[0] + 1.3, hand[1] - 1.2]], color(material.edge), 0.65);
  for (let finger = 0; finger < 2; finger++) {
    line(ctx, [[hand[0] - 0.5 + finger, hand[1]], [hand[0] - 0.4 + finger, hand[1] + 1.4]], color(material.shadow), 0.45);
  }
}

function armorBoot(ctx: CanvasRenderingContext2D, anchor: Point, piece: ArmorPiece | null, color: Color, direction: number): void {
  const [x, y] = anchor;
  const m = piece?.material ?? LEATHER;
  const toe = direction * 0.85;
  polygon(ctx, [[x - 2.2, y - 6], [x + 2, y - 6], [x + 2.3, y - 2],
    [x + 3 + toe, y - 0.2], [x + 2.5 + toe, y + 1.2], [x - 2.2 + toe, y + 1.4], [x - 2.5, y - 1]], color(m.shadow));
  polygon(ctx, [[x - 1.7, y - 5.5], [x + 1.5, y - 5.5], [x + 1.7, y - 1],
    [x + 2.2 + toe, y], [x - 1.5 + toe, y + 0.5]], color(m.base));
  line(ctx, [[x - 1.5 + toe, y + 0.7], [x + 2.1 + toe, y + 0.4]], color('#1b2428'), 0.75);
  line(ctx, [[x - 1.5, y - 4], [x + 1.4, y - 4]], color(m.trim), 0.9);
  ctx.fillStyle = color(m.edge);
  ctx.fillRect(x - 0.1, y - 4.4, 0.8, 0.8);
  line(ctx, [[x - 1.3, y - 5.4], [x - 1.2, y - 1.7], [x - 0.4 + toe, y - 0.6]], color(m.edge), 0.55);
  if (piece?.style === 'plate') {
    polygon(ctx, [[x - 1.6, y - 2], [x + 1.6, y - 2], [x + 2.2 + toe, y], [x - 1.8 + toe, y + 0.3]], color(m.base));
    line(ctx, [[x - 1.6, y - 2], [x + 1.6, y - 2]], color(m.edge), 0.65);
  }
}

function chestArmor(ctx: CanvasRenderingContext2D, piece: ArmorPiece | null, color: Color): void {
  ctx.save(); ctx.translate(...PLAYER_ATTACHMENTS.chest);
  polygon(ctx, [[-6, -7], [6, -7], [7, 6], [4, 11], [-5, 11], [-7, 4]], color('#1b3338'));
  // Dark quilted fabric remains visible between separately attached armor pieces.
  for (let row = 0; row < 3; row++) {
    line(ctx, [[-4.5, 4 + row * 2], [0, 5 + row * 2], [4, 4 + row * 2]], color('#496257'), 0.6);
  }
  if (piece) {
    const m = piece.material;
    const plate = piece.style === 'plate';
    polygon(ctx, [[-5.6, -6], [-2.5, -7], [2, -7], [5.3, -5.5], [5.8, 2],
      [3, 6], [0, 7.5], [-4.4, 5], [-5.6, 0]], color(m.shadow));
    polygon(ctx, [[-4.8, -5.8], [-1.1, -6.5], [1, -5], [0.2, 4.8], [-3.8, 3.9], [-4.8, -0.7]], color(m.edge));
    polygon(ctx, [[0.2, -5.7], [4.4, -4.8], [4.8, 1.4], [2.6, 4.8], [0.2, 5.9]], color(m.base));
    line(ctx, [[-4.5, -5.9], [-1.3, -6.7], [2, -6.1], [4.5, -4.8]], color(m.trim), 0.7);
    if (plate) {
      line(ctx, [[-3.8, -2], [-0.2, -0.5], [3.7, -1.8]], color(m.shadow), 0.7);
      line(ctx, [[0, -4.5], [0, 4.6]], color(m.edge), 0.65);
      const mark = hash(piece.seed) % 2;
      polygon(ctx, [[-0.8, -3.8], [mark ? 0 : 0.8, -4.5], [1.2, -3.5], [0.2, -2.3]], color(m.trim));
    } else {
      for (let stitch = 0; stitch < 4; stitch++) {
        line(ctx, [[-3.7, -4.6 + stitch * 1.8], [-2.9, -4.3 + stitch * 1.8]], color(m.trim), 0.5);
      }
    }
    // Two overlapping waist lames flex independently from the breastplate.
    for (let band = 0; band < 2; band++) {
      polygon(ctx, [[-4.4, 5 + band * 1.7], [0, 6.3 + band * 1.5], [4.4, 5 + band * 1.7],
        [4.1, 6.4 + band * 1.7], [0, 7.6 + band * 1.5], [-4.2, 6.4 + band * 1.7]], color(band ? m.shadow : m.base));
      line(ctx, [[-4, 5.1 + band * 1.7], [0, 6.2 + band * 1.5], [4, 5.1 + band * 1.7]], color(m.edge), 0.45);
    }
  }
  line(ctx, [[-5.3, 8.1], [5.3, 8.1]], color('#644834'), 2);
  ctx.fillStyle = color('#d4ae72'); ctx.fillRect(-1.4, 6.8, 2.8, 2.4);
  ctx.fillStyle = color('#392e2b'); ctx.fillRect(-0.5, 7.4, 1, 1.1);
  polygon(ctx, [[3.5, 8.1], [6.5, 8.8], [6.1, 12], [3.5, 11.7]], color('#5c4638'));
  line(ctx, [[3.8, 8.8], [6.2, 9.4]], color('#b59a6d'), 0.5);
  ctx.restore();
}

function shoulderArmor(ctx: CanvasRenderingContext2D, side: number, piece: ArmorPiece | null, color: Color, sway: number): void {
  if (!piece) return;
  ctx.save();
  ctx.translate(side * 6.5, -26 + side * sway);
  ctx.scale(side, 1);
  const m = piece.material;
  const flare = piece.style === 'plate' ? 1 : 0;
  polygon(ctx, [[-1.3, -2.5], [1.2, -3.3], [4.1 + flare, -0.7], [4.4, 2.9], [0.6, 3.4], [-1.4, 0.8]], color(m.shadow));
  polygon(ctx, [[-0.9, -2], [1.1, -2.6], [3.8 + flare * 0.5, -0.6], [3.7, 1.3], [0.8, 1.7], [-1, 0.3]], color(m.base));
  line(ctx, [[-0.8, -2.1], [1.2, -2.8], [3.8 + flare * 0.5, -0.6]], color(m.edge), 0.8);
  line(ctx, [[0.5, 2], [3.7, 1.4]], color(m.trim), 0.6);
  ctx.fillStyle = color(m.trim); ctx.fillRect(1, -1.1, 0.8, 0.8);
  if (piece.style === 'plate') {
    polygon(ctx, [[0.5, 3], [3.4, 2.7], [3.1, 4], [1.2, 4.3]], color(m.base));
    line(ctx, [[1, 3.8], [3, 3.5]], color(m.edge), 0.5);
  }
  ctx.restore();
}

function headArmor(ctx: CanvasRenderingContext2D, piece: ArmorPiece | null, color: Color, facing: number): void {
  ctx.save(); ctx.translate(Math.cos(facing) * 1.4, PLAYER_ATTACHMENTS.head[1]);
  const back = Math.sin(facing) < -0.16;
  const m = piece?.material ?? LEATHER;
  // A neck and gorget separate the face from the chest rather than one solid blob.
  polygon(ctx, [[-2, 4.5], [2.2, 4.5], [2.8, 7], [-2.4, 7]], color('#b79671'));
  line(ctx, [[-3.3, 5.5], [0, 7], [3.7, 5.4]], color(m.trim), 1);
  polygon(ctx, [[-4.8, 3.2], [-5, -1], [-2.7, -4.8], [1.1, -5.7], [4.2, -2.4], [4.9, 1.8], [2.7, 5], [-1.2, 5.5]], color('#25383c'));
  if (piece) {
    polygon(ctx, [[-4, 1.2], [-4.2, -1.2], [-2.2, -4.5], [0.8, -5.2], [3.5, -2], [3.9, 1.6], [1.8, 3.2], [-2.5, 3.5]], color(m.base));
    polygon(ctx, [[-4, 0.8], [-4.2, -1.2], [-2.2, -4.5], [0.2, -4.8], [-0.5, 2.4], [-2.5, 3.5]], color(m.edge));
    line(ctx, [[-2.3, -4.4], [0.4, -5.2], [2.2, -3.4]], color(m.trim), 0.65);
    if (piece.style === 'plate') {
      line(ctx, [[0.4, -5.7], [0.3, -1]], color(m.edge), 0.8);
      line(ctx, [[0.6, -5.3], [1.2, -1.6]], color(m.shadow), 0.65);
    }
  }
  if (!back) {
    const look = Math.cos(facing) * 0.65;
    polygon(ctx, [[-3 + look, -0.2], [2.5 + look, -0.3], [2.6 + look, 3], [0.7 + look, 4.6], [-1.6 + look, 3.8]], color('#c5a17a'));
    polygon(ctx, [[-3 + look, -0.2], [-1.4 + look, 0.3], [-0.7 + look, 3.8], [-1.6 + look, 3.8]], color('#806c59'));
    line(ctx, [[-3.3 + look, -0.3], [2.9 + look, -0.3]], color(m.shadow), 1.1);
    ctx.fillStyle = color('#1b2c31');
    ctx.fillRect(-2.1 + look, 1, 1, 0.65); ctx.fillRect(1 + look, 1, 0.9, 0.65);
    line(ctx, [[0.3 + look, 1.1], [0.7 + look, 2.7]], color('#ead2a0'), 0.55);
    line(ctx, [[-0.8 + look, 3.2], [1.2 + look, 3.2]], color('#6a5349'), 0.55);
    if (piece?.style === 'plate') {
      polygon(ctx, [[-4.2, 0.8], [-2.8, 1], [-2.3, 4.4], [-3.6, 3.5]], color(m.base));
      polygon(ctx, [[3.4, 0.9], [4.1, 1.2], [3.1, 4], [2.4, 4.5]], color(m.shadow));
      line(ctx, [[-4.1, 1], [-3.5, 3.6]], color(m.edge), 0.55);
    }
  } else {
    line(ctx, [[-3.5, 3.3], [0, 4.8], [3.4, 3.2]], color(m.edge), 0.7);
    line(ctx, [[-2.6, 1.4], [0.2, 2.2], [2.8, 1.3]], color(m.shadow), 0.65);
  }
  ctx.restore();
}

/** Geometry shared by the articulated rig and its attached sword effects. */
function playerMotion(pose: CharacterPose) {
  const moving = pose.dead ? 0 : clamp(pose.moving);
  const phase = pose.gaitPhase ?? pose.time * 8;
  const step = Math.sin(phase) * moving;
  const moveAngle = pose.moveAngle ?? pose.angle;
  const moveX = Math.cos(moveAngle), moveY = Math.sin(moveAngle);
  const breath = Math.sin(pose.time * 2.7) * 0.25;
  const bob = (Math.cos(phase * 2) * 0.5 - 0.5) * moving + breath;
  const back = Math.sin(pose.angle) < -0.16;
  const attack = pose.dead ? 0 : clamp(pose.attack);
  const swinging = attack > 0;
  const start = pose.attackStart ?? 0.19, end = pose.attackEnd ?? 0.45;
  const windup = swinging && attack < start ? smooth(attack / start) : 0;
  const active = swinging ? clamp((attack - start) / Math.max(0.01, end - start)) : 0;
  const recovery = swinging ? smooth((attack - end) / Math.max(0.01, 1 - end)) : 0;
  const commitment = swinging
    ? (attack < start ? -windup : (-1 + smooth(active) * 2.1) * (1 - recovery)) : 0;
  const torsoTurn = swinging
    ? (attack < start ? -windup * 0.52 : (-0.52 + smooth(active) * 1.14) * (1 - recovery)) : 0;
  const elbowTuck = !swinging ? 0 : attack < start ? windup : 1 - smooth(active / 0.65);
  const bodyAngle = pose.angle + torsoTurn;
  const crouch = Math.max(0, -commitment) * 1.3;
  const cast = pose.dead ? 0 : smooth(pose.cast ?? 0);
  const idleSway = Math.sin(phase + 0.35) * moving * 0.07 + breath * 0.08;
  const attackBlend = !swinging ? 0 : attack < start ? windup : 1 - recovery;
  const weaponAngle = swinging
    ? getSwingAngle(pose.attackAngle, attack, start, end, pose.attackArc) + idleSway * (1 - attackBlend)
    : pose.angle + WEAPON_REST_ANGLE + idleSway;
  const weaponSide = -Math.sin(bodyAngle);
  const swordBehind = Math.sin(weaponAngle) < -0.18;
  const hipX = -moveY * step * 0.65 + Math.cos(pose.attackAngle) * commitment * 0.55;
  const hipY = Math.cos(phase * 2) * moving * 0.25 + crouch;
  const lean = moving * moveX * 0.065 + Math.cos(pose.attackAngle) * commitment * 0.065;
  const body: Affine = [1, 0, -lean, 1,
    hipX * 0.6 + Math.cos(pose.attackAngle) * commitment * 1.6,
    bob + crouch + Math.sin(pose.attackAngle) * commitment * 1.4];
  const reach = !swinging ? 11 : attack < start ? 11 + windup * 2.3
    : attack < end ? 13.3 + Math.sin(active * Math.PI) ** 2 * 3.5 : 13.3 - recovery * 2.3;
  const hand: Point = [Math.cos(weaponAngle) * reach, -20 + Math.sin(weaponAngle) * reach * 0.9];
  const shoulderSway = Math.cos(bodyAngle) * 1.15 + step * 0.3 + torsoTurn * 2.6;
  const shoulder: Point = [weaponSide * 6.5, -26 + weaponSide * shoulderSway];
  const elbow = elbowFor(shoulder, hand, weaponSide, elbowTuck);
  return { moving, phase, step, moveX, moveY, bob, back, commitment, torsoTurn, cast,
    weaponAngle, weaponSide, swordBehind, hipX, hipY, lean, body, hand, shoulderSway, shoulder, elbow };
}

/** Exact blade tip in scaled player-local coordinates, relative to the ground anchor. */
export function getPlayerSwordTip(pose: CharacterPose): { x: number; y: number } {
  const motion = playerMotion(pose);
  const length = Math.max(8, pose.weapon?.length ?? STARTING_SWORD.visual.length);
  const local: Point = [motion.hand[0] + Math.cos(motion.weaponAngle) * length,
    motion.hand[1] + Math.sin(motion.weaponAngle) * length];
  const body = transformPoint(motion.body, local);
  const tip = transformPoint(characterTransform(pose), [body[0] * PLAYER_ART_SCALE, body[1] * PLAYER_ART_SCALE]);
  return { x: tip[0], y: tip[1] };
}

function player(ctx: CanvasRenderingContext2D, pose: CharacterPose, color: Color): void {
  const outfit: CharacterOutfit = { ...STARTER_OUTFIT, ...pose.outfit };
  const { moving, phase, step, moveX, moveY, bob, back, commitment, torsoTurn, cast,
    weaponAngle, weaponSide, swordBehind, hipX, hipY, lean, body, hand, shoulderSway, shoulder, elbow } = playerMotion(pose);
  const legs = [-1, 1].map(side => {
    const legPhase = phase + (side > 0 ? Math.PI : 0);
    const travel = Math.sin(legPhase) * 5.2 * moving;
    const lift = Math.max(0, Math.cos(legPhase)) * moving * 2.5;
    const mount = side < 0 ? PLAYER_ATTACHMENTS.leftHip : PLAYER_ATTACHMENTS.rightHip;
    const hip: Point = [mount[0] + hipX, mount[1] + hipY];
    const ankle: Point = [side * 3.6 + moveX * travel, moveY * travel * 0.7 - lift];
    const knee: Point = [hip[0] * 0.45 + ankle[0] * 0.55 + moveX * lift * 0.4,
      -6 + ankle[1] * 0.48 - lift * 0.35];
    return { side, hip, ankle, knee };
  }).sort((a, b) => a.ankle[1] - b.ankle[1]);
  for (const leg of legs) {
    const { hip, knee, ankle } = leg;
    taper(ctx, hip, knee, 4.5, 3.5, color('#293d39'));
    taper(ctx, knee, [ankle[0], ankle[1] - 2], 3.5, 2.8, color('#4d5a4c'));
    if (outfit.legs) {
      const m = outfit.legs.material;
      taper(ctx, [hip[0] - 0.3, hip[1]], [knee[0] - 0.3, knee[1] - 0.5], 3.8, 2.7, color(m.base));
      line(ctx, [[hip[0] - 1.4, hip[1]], [knee[0] - 1.2, knee[1] - 1]], color(m.edge), 0.65);
      // Each knee plate follows its actual joint, with exposed fabric behind it.
      polygon(ctx, [[knee[0] - 2, knee[1] - 1.8], [knee[0] + 1.9, knee[1] - 1.4],
        [knee[0] + 2, knee[1] + 0.7], [knee[0], knee[1] + 1.7], [knee[0] - 1.9, knee[1] + 0.3]], color(m.shadow));
      line(ctx, [[knee[0] - 1.6, knee[1] - 1.4], [knee[0] + 1.5, knee[1] - 1.1]], color(m.edge), 0.85);
      if (outfit.legs.style === 'plate') {
        taper(ctx, [hip[0], hip[1] - 0.5], [hip[0] + step * 0.25, hip[1] + 3.4], 4.6, 4.1, color(m.shadow));
        line(ctx, [[hip[0] - 1.8, hip[1] + 2], [hip[0] + 1.8, hip[1] + 2.4]], color(m.trim), 0.65);
      }
    }
    armorBoot(ctx, ankle, outfit.boots, color, moveX * moving);
  }

  ctx.save();
  ctx.transform(...body);
  const swordArm = () => {
    armorArm(ctx, shoulder, elbow, hand, outfit.hands, color);
    sword(ctx, hand, weaponAngle, color, pose.weapon);
    // Fingers cross the grip, keeping the weapon seated in the animated gauntlet.
    ctx.save(); ctx.translate(hand[0], hand[1]); ctx.rotate(weaponAngle);
    line(ctx, [[-0.6, -1.2], [-0.6, 1.3]], color(outfit.hands?.material.edge ?? '#baa078'), 0.7);
    ctx.restore();
  };
  const cape = () => {
    const cloth = outfit.cloak;
    if (!cloth) return;
    const offset = (hash(cloth.seed) % 11) * 0.1;
    const wind = Math.sin(pose.time * 3.6 - 0.6 + offset) * (0.8 + moving * 1.1);
    const lag = Math.sin(phase - 0.7) * moving * 1.8;
    const trailX = -moveX * moving * 5 - Math.cos(pose.attackAngle) * commitment * 2.3
      - Math.sin(pose.attackAngle) * torsoTurn * 3;
    const trailY = -moveY * moving * 3 + Math.cos(pose.attackAngle) * torsoTurn * 1.6;
    const hemX = wind + lag + trailX;
    const hemY = -5.2 + trailY + Math.sin(pose.time * 4.7 - 0.4) * 0.5;
    polygon(ctx, [[-6, -27], [6, -27], [8 + hemX, hemY - 2],
      [3 + hemX * 0.9, hemY + 1], [-1 + hemX * 0.7, hemY - 0.5], [-7 + hemX * 0.6, hemY - 2]], color('#281f2b'));
    polygon(ctx, [[-5, -26], [5, -26], [6.5 + hemX, hemY - 3],
      [2 + hemX * 0.9, hemY - 0.5], [-5.7 + hemX * 0.6, hemY - 3]], color(cloth.base));
    polygon(ctx, [[-4, -25], [-0.5, -25], [hemX * 0.82, hemY - 2],
      [-4.5 + hemX * 0.6, hemY - 4]], color(cloth.highlight));
    polygon(ctx, [[2, -24], [4, -24], [5 + hemX * 0.9, hemY - 4],
      [2 + hemX * 0.7, hemY - 2]], color(cloth.shadow));
    line(ctx, [[-5.7 + hemX * 0.6, hemY - 3], [2 + hemX * 0.9, hemY - 0.5],
      [6.5 + hemX, hemY - 3]], color(cloth.trim), 0.65);
    line(ctx, [[-4.5, -24], [-4.5 + hemX * 0.3, -17], [-4.5 + hemX * 0.6, hemY - 4]], color(cloth.trim), 0.45);
    line(ctx, [[-4, -26], [0, -24.5], [4, -26]], color(cloth.trim), 0.8);
  };
  if (!back) cape();
  if (swordBehind) swordArm();
  const offShoulder: Point = [-weaponSide * 6.5, -25 - weaponSide * shoulderSway];
  const offHand: Point = [(-weaponSide * 8.2 - step * moveX * 1.2) * (1 - cast)
    + Math.cos(pose.angle) * 15 * cast - Math.cos(pose.attackAngle) * commitment * 1.8,
    -15 - step * moveY * 1.2 - cast * 5 + Math.sin(pose.angle) * cast * 8 - Math.max(0, -commitment) * 3];
  const offElbow = elbowFor(offShoulder, offHand, -weaponSide);
  const offArm = () => armorArm(ctx, offShoulder, offElbow, offHand, outfit.hands, color);
  if (offHand[1] < -20) offArm();
  ctx.save();
  ctx.translate(0, PLAYER_ATTACHMENTS.chest[1]);
  ctx.transform(1 - Math.abs(torsoTurn) * 0.08, torsoTurn * 0.12, 0, 1, 0, 0);
  ctx.translate(0, -PLAYER_ATTACHMENTS.chest[1]);
  chestArmor(ctx, outfit.chest, color);
  ctx.restore();
  if (back) cape();
  if (offHand[1] >= -20) offArm();
  for (const side of [-1, 1]) shoulderArmor(ctx, side, outfit.shoulders, color, shoulderSway);
  // The neck counterbalances the moving torso; small facial features stay legible.
  ctx.save(); ctx.translate(lean * -12, -bob * 0.3);
  headArmor(ctx, outfit.head, color, pose.angle);
  ctx.restore();
  if (!swordBehind) swordArm();
  if (cast > 0.05) {
    ctx.save(); ctx.translate(offHand[0], offHand[1]); ctx.rotate(pose.time * 4.5);
    const radius = 1 + cast * 2.8;
    polygon(ctx, [[0, -radius], [radius, 0], [0, radius], [-radius, 0]], color('#ffc276'));
    ctx.fillStyle = color('#fff5c0'); ctx.fillRect(-0.8, -0.8, 1.6, 1.6);
    ctx.restore();
  }
  ctx.restore();
}

function stalker(ctx: CanvasRenderingContext2D, pose: CharacterPose, color: Color): void {
  const step = Math.sin(pose.gaitPhase ?? pose.time * 9) * clamp(pose.moving);
  const pulse = Math.sin(clamp(pose.attack) * Math.PI);
  const windup = pose.attack < 0 ? smooth(-pose.attack) : pose.attack > 0 ? 1 - smooth(pose.attack / 0.25) : 0;
  const faceX = Math.cos(pose.angle) * 2;
  const faceY = Math.sin(pose.angle);
  const bodyY = -18 + Math.abs(step) * 0.8 + windup * 3 - pulse;
  const shoulder: Point = [faceX, bodyY - 4];
  for (const side of [-1, 1]) {
    const ankle: Point = [side * 6.5, -1 + step * side * 2];
    const knee: Point = [side * 8, -8 - step * side];
    taper(ctx, [side * 3, -14], knee, 4.2, 2.8, color('#454c3d'));
    taper(ctx, knee, ankle, 2.9, 1.9, color('#9d9b7b'));
    polygon(ctx, [[ankle[0] - 1.5, ankle[1] - 1], [ankle[0] + 2, ankle[1] - 1], [ankle[0] + side * 3, ankle[1] + 2], [ankle[0] - 1, ankle[1] + 2]], color('#8a9074'));
  }
  polygon(ctx, [[-5, -13], [-9, bodyY - 2], [-5, bodyY - 8], [2, bodyY - 9], [8, bodyY - 3], [5, -12], [1, -9]], color('#323e34'));
  polygon(ctx, [[-6, bodyY - 3], [-4, bodyY - 7], [2, bodyY - 7], [5, bodyY - 2], [3, -13], [-1, -12]], color('#777f64'));
  for (let rib = 0; rib < 3; rib += 1) {
    const y = bodyY - 2 + rib * 2.4;
    line(ctx, [[-5 + rib, y - 1], [0, y + 1], [4 - rib * 0.5, y - 0.5]], color('#a9a78a'), 1);
  }
  for (const side of [-1, 1]) {
    const reach = pulse * 6;
    const elbow: Point = [side * (11 + reach * 0.3 + windup * 2), bodyY + 5 - windup * 6];
    const hand: Point = [side * (10 + reach - windup * 3) + Math.cos(pose.attackAngle) * pulse * 8,
      -3 + Math.sin(pose.attackAngle) * pulse * 9 - windup * 15];
    taper(ctx, [shoulder[0] + side * 5, shoulder[1]], elbow, 4.2, 2.8, color('#8e9579'));
    taper(ctx, elbow, hand, 2.7, 1.6, color('#b5b090'));
    for (let claw = 0; claw < 2; claw += 1) {
      taper(ctx, [hand[0] + claw * 1.8, hand[1]], [hand[0] + side * (2 + claw), hand[1] + 4 - claw], 0.9, 0.3, color('#cbc09a'));
    }
  }
  const headY = bodyY - 6 + faceY;
  polygon(ctx, [[faceX - 5, headY - 6], [faceX + 2, headY - 8], [faceX + 6, headY - 3], [faceX + 4, headY + 3], [faceX, headY + 5], [faceX - 4, headY + 1]], color('#b0ac8c'));
  polygon(ctx, [[faceX - 5, headY - 6], [faceX - 1, headY - 5], [faceX, headY + 5], [faceX - 4, headY + 1]], color('#727b65'));
  ctx.fillStyle = color('#27342d');
  ctx.fillRect(faceX - 2.5, headY - 1.5, 2, 2);
  ctx.fillRect(faceX + 1.7, headY - 1.5, 2, 2);
  ctx.fillStyle = color(windup > 0.65 ? '#ffe798' : '#ddc769');
  ctx.fillRect(faceX - 1.5, headY - 1, 1, 1);
  ctx.fillRect(faceX + 2, headY - 1, 1, 1);
}

function brute(ctx: CanvasRenderingContext2D, pose: CharacterPose, color: Color): void {
  const step = Math.sin(pose.gaitPhase ?? pose.time * 6) * clamp(pose.moving);
  const windup = pose.attack < 0 ? smooth(-pose.attack) : pose.attack > 0 ? 1 - smooth(pose.attack / 0.35) : 0;
  const pulse = Math.sin(clamp(pose.attack) * Math.PI);
  const bob = Math.abs(step) * 0.8 + windup * 2.5 - pulse * 1.7;
  const facingX = Math.cos(pose.angle);
  boot(ctx, -6.5, -step * 2, 3.8, color);
  boot(ctx, 6.5, step * 2, 3.8, color);
  taper(ctx, [-6, -16], [-6.5, -4 - step * 2], 7, 5.2, color('#605d46'));
  taper(ctx, [6, -16], [6.5, -4 + step * 2], 7, 5.2, color('#454d3d'));
  polygon(ctx, [[-10, -27 + bob], [-15, -22 + bob], [-11, -10], [-5, -8], [7, -9], [13, -16], [12, -26 + bob], [5, -32 + bob], [-4, -32 + bob]], color('#4b4a38'));
  polygon(ctx, [[-7, -28 + bob], [5, -29 + bob], [9, -23 + bob], [8, -14], [-4, -12], [-9, -20]], color('#767258'));
  polygon(ctx, [[-9, -23 + bob], [5, -25 + bob], [8, -19], [-5, -17]], color('#5b3d37'));
  line(ctx, [[-9, -12], [8, -13]], color('#302e28'), 3);
  ctx.fillStyle = color('#928466');
  ctx.fillRect(-1, -14, 3, 3);
  for (const side of [-1, 1]) {
    const elbow: Point = [side * (17 + windup), -17 + bob - windup * 8];
    const hand: Point = [side * (16 + pulse * 5 - windup * 3) + Math.cos(pose.attackAngle) * pulse * 5,
      -8 - pulse * 8 - windup * 19 + Math.sin(pose.attackAngle) * pulse * 5];
    taper(ctx, [side * 10, -26 + bob], elbow, 8, 6.5, color('#64674f'));
    taper(ctx, elbow, hand, 6, 4.8, color('#8f8c6a'));
    polygon(ctx, [[side * 8, -30 + bob], [side * 14, -29 + bob], [side * 17, -24 + bob], [side * 14, -20 + bob], [side * 8, -23 + bob]], color('#333e38'));
    line(ctx, [[side * 9, -28 + bob], [side * 14, -27 + bob], [side * 16, -24 + bob]], color('#8e9177'), 1.1);
    if (side === (facingX >= 0 ? 1 : -1)) {
      const restAngle = pose.angle + WEAPON_REST_ANGLE;
      const readyAngle = pose.attackAngle - 1.25;
      const angle = pose.attack > 0
        ? getSwingAngle(pose.attackAngle, 0.2 + clamp(pose.attack) * 0.8, 0.2, 0.58, 2.5)
        : restAngle + Math.atan2(Math.sin(readyAngle - restAngle), Math.cos(readyAngle - restAngle)) * windup;
      ctx.save();
      ctx.translate(hand[0], hand[1]);
      ctx.rotate(angle);
      taper(ctx, [-3, 0], [20, 0], 3.8, 3, color('#6d583b'));
      polygon(ctx, [[13, -4], [22, -5], [27, -2], [26, 3], [21, 5], [13, 3]], color('#707768'));
      polygon(ctx, [[13, -4], [22, -5], [25, -2], [14, -1]], color('#a8aa8e'));
      ctx.restore();
    }
  }
  const headX = facingX * 1.8;
  polygon(ctx, [[headX - 6, -32 + bob], [headX - 4, -38 + bob], [headX + 3, -39 + bob], [headX + 7, -34 + bob], [headX + 5, -27 + bob], [headX - 3, -27 + bob]], color('#a3a180'));
  polygon(ctx, [[headX - 6, -32 + bob], [headX - 4, -38 + bob], [headX, -38 + bob], [headX - 1, -28 + bob], [headX - 3, -27 + bob]], color('#797f65'));
  line(ctx, [[headX - 3.5, -32 + bob], [headX + 4, -32 + bob]], color('#29352e'), 2);
  line(ctx, [[headX - 2, -28 + bob], [headX + 2, -28 + bob]], color('#4c503e'), 1);
}

function caster(ctx: CanvasRenderingContext2D, pose: CharacterPose, color: Color): void {
  const moving = clamp(pose.moving);
  const sway = Math.sin(pose.time * 4) * (0.6 + moving);
  const bob = Math.sin(pose.time * 3) * 0.55;
  const windup = pose.attack < 0 ? smooth(-pose.attack) : 0;
  const attack = pose.attack < 0 ? windup : pose.attack > 0 ? 1 - smooth(pose.attack) : 0;
  const side = Math.cos(pose.angle) >= 0 ? 1 : -1;
  const headX = Math.cos(pose.angle) * 1.3;
  polygon(ctx, [[-5, -26 + bob], [5, -26 + bob], [8, -17], [9 + sway, -3], [5, -1], [1, -3], [-4, 0], [-8 + sway, -2], [-8, -14]], color('#162e32'));
  polygon(ctx, [[-4, -24 + bob], [2, -26 + bob], [4, -14], [5 + sway * 0.5, -3], [0, -5], [-4, -3], [-6, -14]], color('#28666a'));
  polygon(ctx, [[-3, -21 + bob], [-1, -22 + bob], [-1, -7], [-4, -4]], color('#54a08b'));
  line(ctx, [[-5, -4], [0, -6], [5, -4]], color('#84846a'), 0.9);
  const staffHand: Point = [side * 10.5, -17 - attack * 2];
  taper(ctx, [side * 4, -24 + bob], [side * 8, -17], 5.5, 4, color('#314a4b'));
  taper(ctx, [side * 8, -17], staffHand, 3.5, 2, color('#a2a589'));
  const release = pose.attack > 0 ? Math.sin(clamp(pose.attack) * Math.PI) : 0;
  const castingHand: Point = [-side * (9 + attack * 4) + Math.cos(pose.attackAngle) * release * 9,
    -17 - attack * 9 + Math.sin(pose.attackAngle) * release * 8];
  taper(ctx, [-side * 4, -23 + bob], [-side * 9, -19 - attack * 4], 5.5, 4, color('#395757'));
  taper(ctx, [-side * 9, -19 - attack * 4], castingHand, 3, 2, color('#b0ae90'));
  taper(ctx, [side * 11, -1], [side * 11.7, -35], 2, 1.4, color('#7c7050'));
  line(ctx, [[side * 11.7, -30], [side * 8, -35], [side * 11.5, -41], [side * 15, -35], [side * 11.7, -30]], color('#849681'), 1.2);
  polygon(ctx, [[side * 11.5, -39], [side * 13.5, -35], [side * 11.5, -32], [side * 9.4, -35]], color('#94d1be'));
  line(ctx, [[side * 11.4, -38], [side * 11.4, -34]], color('#daf0c9'), 0.8);
  polygon(ctx, [[headX - 6, -29 + bob], [headX - 6, -34 + bob], [headX - 2, -39 + bob], [headX + 2, -39 + bob], [headX + 6, -34 + bob], [headX + 5, -28 + bob], [headX, -25 + bob]], color('#425953'));
  polygon(ctx, [[headX - 4, -29 + bob], [headX - 3, -34 + bob], [headX, -36 + bob], [headX + 3.5, -33 + bob], [headX + 3, -28 + bob], [headX, -27 + bob]], color('#11282d'));
  ctx.fillStyle = color('#b1dbbd');
  ctx.fillRect(headX - 2, -31 + bob, 1.1, 1);
  ctx.fillRect(headX + 1, -31 + bob, 1.1, 1);
  if (attack > 0.12) {
    const radius = 1.5 + attack * 2;
    polygon(ctx, [[castingHand[0], castingHand[1] - radius], [castingHand[0] + radius, castingHand[1]], [castingHand[0], castingHand[1] + radius], [castingHand[0] - radius, castingHand[1]]], color('#a4f8ce'));
    for (let spark = 0; spark < 3; spark += 1) {
      const angle = pose.time * 4 + spark * TAU / 3;
      ctx.fillStyle = color('#77dcb8');
      ctx.fillRect(castingHand[0] + Math.cos(angle) * (4 + attack * 3), castingHand[1] + Math.sin(angle) * (4 + attack * 3), 1, 1);
    }
  }
}

function characterTransform(pose: CharacterPose): Affine {
  let base: Affine = [1, 0, 0, 1, 0, 0];
  if (pose.dead) {
    base = [1, 0, 0.72, 0.27, 7, 0];
  } else if (pose.dodging) {
    const progress = clamp(pose.dodgeProgress ?? 0.4);
    const envelope = Math.pow(Math.max(0, Math.sin(progress * Math.PI)), 0.7);
    const direction = Math.cos(pose.moveAngle ?? pose.angle);
    base = [1 + Math.abs(direction) * envelope * 0.12, 0,
      -direction * envelope * 0.2, 1 - envelope * 0.23,
      direction * envelope * 1.5, -envelope];
  } else if (pose.kind !== 'player' && pose.attack !== 0) {
    const windup = pose.attack < 0 ? smooth(-pose.attack) : 1 - smooth(pose.attack / 0.28);
    const strike = pose.attack > 0 ? Math.sin(clamp(pose.attack) * Math.PI) : 0;
    const commitment = strike * 0.1 - windup * 0.035;
    base = [1, 0, -Math.cos(pose.attackAngle) * commitment,
      1 - windup * 0.035, 0, Math.sin(pose.attackAngle) * strike * 1.5];
  }
  if (!pose.dead && (pose.impact ?? 0) > 0) {
    const elapsed = 1 - clamp(pose.impact!);
    const recoil = elapsed < 0.18 ? smooth(elapsed / 0.18) : 1 - smooth((elapsed - 0.18) / 0.82);
    const angle = pose.impactAngle ?? pose.angle + Math.PI;
    const height = pose.kind === 'player' ? 48 : 38;
    // All terms vanish at y=0. Feet remain planted while the shoulders and head
    // recoil away from the hit and then settle, independently of locomotion.
    const impact: Affine = [1 + recoil * 0.025, 0, -Math.cos(angle) * recoil * 4.2 / height,
      1 - (Math.sin(angle) * 3.4 + 1.1) * recoil / height, 0, 0];
    return compose(base, impact);
  }
  return base;
}

/** Draw an articulated figure around (0, 0), its ground-contact point. */
export function drawHumanoid(ctx: CanvasRenderingContext2D, pose: CharacterPose): void {
  ctx.save();
  const flash = Math.pow(clamp(pose.hitFlash / 0.16), 3.2) * 0.97;
  const color: Color = flash > 0 ? (value) => mixColor(value, '#fff3d9', flash) : (value) => value;
  if (pose.dead) ctx.globalAlpha *= 0.6;
  ctx.transform(...characterTransform(pose));
  if (pose.kind === 'player') {
    ctx.scale(PLAYER_ART_SCALE, PLAYER_ART_SCALE);
    player(ctx, pose, color);
  }
  else if (pose.kind === 'stalker') stalker(ctx, pose, color);
  else if (pose.kind === 'brute') brute(ctx, pose, color);
  else caster(ctx, pose, color);
  ctx.restore();
}
