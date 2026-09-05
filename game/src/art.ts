/** Procedural art only: every cached image below is drawn from geometry. */
export interface Sprite {
  image: HTMLCanvasElement;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
}

export interface CharacterPose {
  kind: 'player' | 'stalker' | 'brute' | 'caster';
  /** Canvas radians: zero faces right, PI / 2 faces down. */
  angle: number;
  /** Elapsed animation time in seconds. */
  time: number;
  moving: number;
  /** Normalized swing progress, with zero reserved for idle. */
  attack: number;
  attackAngle: number;
  combo: number;
  hitFlash: number;
  dodging: boolean;
  dead?: boolean;
}

type Point = readonly [number, number];
type Random = () => number;
type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;
type Color = (value: string) => string;

const TAU = Math.PI * 2;
const TREE_VARIANTS = 48;
const ROCK_VARIANTS = 32;
const GRASS_VARIANTS = 32;

function clamp(value: number, low = 0, high = 1): number {
  return Math.max(low, Math.min(high, value));
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
          blade % 2 === 0 ? '#35412e' : '#29382c');
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
      [-0.21, 0.24, 0.22, 0.14, '#293d2d'],
      [0.10, 0.19, 0.24, 0.15, '#34432e'],
      [-0.32, 0.39, 0.18, 0.16, '#26382a'],
      [0.29, 0.36, 0.20, 0.17, '#2b3d2c'],
      [-0.03, 0.38, 0.27, 0.19, '#34432e'],
      [-0.23, 0.56, 0.22, 0.15, '#35462f'],
      [0.19, 0.55, 0.23, 0.16, '#2d402c'],
      [-0.02, 0.55, 0.21, 0.17, '#3c4b32'],
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
      // A sparse, quiet material mark stays inside each large foliage mass.
      ctx.globalAlpha = 0.17;
      ctx.fillStyle = '#77815a';
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

function jointedArm(
  ctx: CanvasRenderingContext2D,
  shoulder: Point,
  elbow: Point,
  hand: Point,
  color: Color,
  thick = 3.4,
): void {
  taper(ctx, shoulder, elbow, thick + 1.4, thick, color('#222c2c'));
  taper(ctx, elbow, hand, thick, thick - 0.7, color('#75796c'));
  taper(ctx, [elbow[0] - 0.5, elbow[1]], [hand[0] - 0.5, hand[1]], 1.1, 0.8, color('#aba88d'));
  polygon(ctx, [[hand[0] - 1.8, hand[1] - 1.5], [hand[0] + 1.7, hand[1] - 1.8], [hand[0] + 1.8, hand[1] + 1.7], [hand[0] - 1.2, hand[1] + 2]], color('#796e53'));
}

function sword(ctx: CanvasRenderingContext2D, hand: Point, angle: number, color: Color): void {
  ctx.save();
  ctx.translate(hand[0], hand[1]);
  ctx.rotate(angle);
  polygon(ctx, [[-4, -1], [3, -1], [3, 1], [-4, 1]], color('#715332'));
  polygon(ctx, [[3, -1.7], [20, -1.1], [25, 0], [20, 1.4], [3, 1.4]], color('#aaaea0'));
  polygon(ctx, [[3, -1.7], [20, -1.1], [25, 0], [4, 0]], color('#e2dec3'));
  polygon(ctx, [[1, -4], [3, -4], [4, 4], [2, 4]], color('#b09154'));
  ctx.fillStyle = color('#d2b878');
  ctx.fillRect(-5, -1.5, 2, 3);
  ctx.restore();
}

function player(ctx: CanvasRenderingContext2D, pose: CharacterPose, color: Color): void {
  const moving = pose.dead ? 0 : clamp(pose.moving);
  const step = Math.sin(pose.time * 11) * moving;
  const bob = Math.abs(Math.sin(pose.time * 11)) * moving * 0.7;
  const back = Math.sin(pose.angle) < -0.16;
  const facingX = Math.cos(pose.angle);
  const headX = facingX * 1.25;
  const attack = pose.dead ? 0 : clamp(pose.attack);
  const swinging = attack > 0;
  const direction = pose.combo % 2 === 0 ? 1 : -1;
  const swingEase = attack * attack * (3 - 2 * attack);
  const weaponAngle = swinging
    ? pose.attackAngle + (-1.35 + swingEase * 2.7) * direction
    : -1.05 + facingX * 0.22;
  const weaponSide = swinging ? (Math.cos(weaponAngle) >= 0 ? 1 : -1) : (back ? 1 : -1);
  const hand: Point = swinging
    ? [Math.cos(weaponAngle) * 12, -20 + Math.sin(weaponAngle) * 8]
    : [weaponSide * 9, -17 - step * 0.8];
  const shoulder: Point = [weaponSide * 7, -26 + bob];
  const elbow: Point = [weaponSide * 10 + (swinging ? Math.cos(weaponAngle) * 2 : 0), -20 + (hand[1] + 20) * 0.4];
  const swordBehind = swinging ? Math.sin(weaponAngle) < -0.20 : back;

  boot(ctx, -3.6, -step * 2.3, 2.4, color);
  boot(ctx, 3.6, step * 2.3, 2.4, color);
  taper(ctx, [-3.5, -13], [-3.6, -3 - step * 2.3], 4.3, 3.2, color('#343a34'));
  taper(ctx, [3.5, -13], [3.6, -3 + step * 2.3], 4.3, 3.2, color('#293433'));

  const cape = () => {
    const flutter = Math.sin(pose.time * 5.1) * (0.6 + moving * 1.7);
    polygon(ctx, [[-6, -27 + bob], [6, -27 + bob], [8 + flutter, -7], [3, -4.8], [-1, -6], [-7 + flutter * 0.6, -7]], color('#242329'));
    polygon(ctx, [[-5, -26 + bob], [5, -26 + bob], [6.5 + flutter, -8], [2, -6.2], [-5.7 + flutter * 0.6, -8]], color('#65323a'));
    polygon(ctx, [[-4, -24 + bob], [-1, -25 + bob], [-1 + flutter * 0.3, -8], [-4.5 + flutter * 0.5, -9]], color('#814348'));
    line(ctx, [[4, -23 + bob], [4 + flutter * 0.5, -10]], color('#482b32'), 1);
  };
  if (!back) cape();
  if (swordBehind) {
    jointedArm(ctx, shoulder, elbow, hand, color);
    sword(ctx, hand, weaponAngle, color);
  }
  jointedArm(ctx, [-weaponSide * 7, -25 + bob], [-weaponSide * 9.2, -20 - step * 0.4], [-weaponSide * 8.2, -15 + step], color);

  polygon(ctx, [[-6, -28 + bob], [6, -28 + bob], [7, -15], [4, -10], [-5, -10], [-7, -17]], color('#242d2f'));
  polygon(ctx, [[-5, -26 + bob], [4, -26 + bob], [5, -17], [2, -13], [-4, -14]], color('#555e57'));
  polygon(ctx, [[-5, -26 + bob], [0, -26 + bob], [-1, -16], [-4, -17]], color('#788075'));
  line(ctx, [[-5, -13], [5, -13]], color('#877351'), 2);
  if (back) cape();

  for (const side of [-1, 1]) {
    polygon(ctx, [[side * 5, -28 + bob], [side * 8, -29 + bob], [side * 11, -26 + bob], [side * 10, -22 + bob], [side * 6, -23 + bob]], color('#1b272a'));
    polygon(ctx, [[side * 5.6, -27.5 + bob], [side * 8, -28 + bob], [side * 10, -25.5 + bob], [side * 9, -23.4 + bob], [side * 6.6, -24 + bob]], color(side < 0 ? '#9ca18d' : '#7b8579'));
    line(ctx, [[side * 6, -27 + bob], [side * 8, -27.5 + bob], [side * 10, -25.5 + bob]], color('#d0c6a7'), 0.65);
  }

  // Helmet stays upright; a pointed silhouette reads at the world camera scale.
  polygon(ctx, [[headX - 5.5, -29 + bob], [headX - 5, -34 + bob], [headX - 1, -39 + bob], [headX + 2, -38 + bob], [headX + 5, -33 + bob], [headX + 5, -29 + bob], [headX, -26.5 + bob]], color('#101c21'));
  polygon(ctx, [[headX - 4, -30 + bob], [headX - 3.5, -34 + bob], [headX, -37.5 + bob], [headX + 3.5, -33 + bob], [headX + 4, -30 + bob], [headX, -28 + bob]], color('#596960'));
  polygon(ctx, [[headX - 4, -31 + bob], [headX - 3.5, -34 + bob], [headX, -37.5 + bob], [headX - 0.3, -29 + bob]], color('#8b9380'));
  if (!back) {
    line(ctx, [[headX - 3.4, -31.4 + bob], [headX + 3, -31 + bob]], color('#142125'), 1.6);
    line(ctx, [[headX, -32 + bob], [headX + 0.4, -28.5 + bob]], color('#b7b49b'), 0.8);
  } else {
    line(ctx, [[headX - 4, -29.6 + bob], [headX, -27.8 + bob], [headX + 4, -29.6 + bob]], color('#b5b298'), 0.7);
  }

  if (!swordBehind) {
    jointedArm(ctx, shoulder, elbow, hand, color);
    sword(ctx, hand, weaponAngle, color);
  }
}

function stalker(ctx: CanvasRenderingContext2D, pose: CharacterPose, color: Color): void {
  const step = Math.sin(pose.time * 12.5) * clamp(pose.moving);
  const pulse = Math.sin(clamp(pose.attack) * Math.PI);
  const faceX = Math.cos(pose.angle) * 2;
  const faceY = Math.sin(pose.angle);
  const bodyY = -18 + Math.abs(step) * 0.8;
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
    const elbow: Point = [side * (11 + reach * 0.3), bodyY + 5];
    const hand: Point = [side * (10 + reach) + Math.cos(pose.attackAngle) * pulse * 4, -3 + Math.sin(pose.attackAngle) * pulse * 6];
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
  ctx.fillStyle = color('#cbbe72');
  ctx.fillRect(faceX - 1.5, headY - 1, 1, 1);
  ctx.fillRect(faceX + 2, headY - 1, 1, 1);
}

function brute(ctx: CanvasRenderingContext2D, pose: CharacterPose, color: Color): void {
  const step = Math.sin(pose.time * 7.5) * clamp(pose.moving);
  const bob = Math.abs(step) * 0.8;
  const pulse = Math.sin(clamp(pose.attack) * Math.PI);
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
    const elbow: Point = [side * 17, -17 + bob];
    const hand: Point = [side * (16 + pulse * 5), -8 - pulse * 8];
    taper(ctx, [side * 10, -26 + bob], elbow, 8, 6.5, color('#64674f'));
    taper(ctx, elbow, hand, 6, 4.8, color('#8f8c6a'));
    polygon(ctx, [[side * 8, -30 + bob], [side * 14, -29 + bob], [side * 17, -24 + bob], [side * 14, -20 + bob], [side * 8, -23 + bob]], color('#333e38'));
    line(ctx, [[side * 9, -28 + bob], [side * 14, -27 + bob], [side * 16, -24 + bob]], color('#8e9177'), 1.1);
    if (side === (facingX >= 0 ? 1 : -1)) {
      const angle = pose.attack > 0 ? pose.attackAngle - 1.1 + clamp(pose.attack) * 2.2 : -1.1;
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
  const attack = Math.sin(clamp(pose.attack) * Math.PI);
  const side = Math.cos(pose.angle) >= 0 ? 1 : -1;
  const headX = Math.cos(pose.angle) * 1.3;
  polygon(ctx, [[-5, -26 + bob], [5, -26 + bob], [8, -17], [9 + sway, -3], [5, -1], [1, -3], [-4, 0], [-8 + sway, -2], [-8, -14]], color('#162e32'));
  polygon(ctx, [[-4, -24 + bob], [2, -26 + bob], [4, -14], [5 + sway * 0.5, -3], [0, -5], [-4, -3], [-6, -14]], color('#355054'));
  polygon(ctx, [[-3, -21 + bob], [-1, -22 + bob], [-1, -7], [-4, -4]], color('#4f6a67'));
  line(ctx, [[-5, -4], [0, -6], [5, -4]], color('#84846a'), 0.9);
  const staffHand: Point = [side * 10.5, -17 - attack * 2];
  taper(ctx, [side * 4, -24 + bob], [side * 8, -17], 5.5, 4, color('#314a4b'));
  taper(ctx, [side * 8, -17], staffHand, 3.5, 2, color('#a2a589'));
  const castingHand: Point = [-side * (9 + attack * 4), -17 - attack * 9];
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
    polygon(ctx, [[castingHand[0], castingHand[1] - radius], [castingHand[0] + radius, castingHand[1]], [castingHand[0], castingHand[1] + radius], [castingHand[0] - radius, castingHand[1]]], color('#a8d6b4'));
    for (let spark = 0; spark < 3; spark += 1) {
      const angle = pose.time * 4 + spark * TAU / 3;
      ctx.fillStyle = color('#73a79b');
      ctx.fillRect(castingHand[0] + Math.cos(angle) * 5, castingHand[1] + Math.sin(angle) * 5, 1, 1);
    }
  }
}

/** Draw an articulated figure around (0, 0), its ground-contact point. */
export function drawHumanoid(ctx: CanvasRenderingContext2D, pose: CharacterPose): void {
  ctx.save();
  const flash = clamp(pose.hitFlash) * 0.84;
  const color: Color = flash > 0 ? (value) => mixColor(value, '#efe5c6', flash) : (value) => value;
  if (pose.dead) {
    ctx.globalAlpha *= 0.6;
    ctx.transform(1, 0, 0.72, 0.27, 7, 0);
  } else if (pose.dodging) {
    ctx.transform(1, 0, Math.cos(pose.angle) * 0.15, 0.83, 0, -1);
  }
  if (pose.kind === 'player') player(ctx, pose, color);
  else if (pose.kind === 'stalker') stalker(ctx, pose, color);
  else if (pose.kind === 'brute') brute(ctx, pose, color);
  else caster(ctx, pose, color);
  ctx.restore();
}
