import type { Sprite } from './art-types.ts';
import { hash, randomFromSeed, between, polygon, line, taper, type CanvasFactory, type Point, type Random } from './art-primitives.ts';

const TREE_VARIANTS = 48;

const ROCK_VARIANTS = 32;

const GRASS_VARIANTS = 32;

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
