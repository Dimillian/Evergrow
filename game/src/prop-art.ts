import { weatherStone } from './material-art.ts';
import { createTreeSprite } from './tree-art.ts';
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
  if (!ctx) throw new Error('Evergrow needs a 2D canvas context to draw its procedural artwork.');
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
      sprite = createTreeSprite(this.factory, dead ? 'deadTree' : 'tree', hash(variant + (dead ? 8901 : 1741)));
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
    line(ctx, [left, crown, topRight], '#a0a18a', 1);
    weatherStone(ctx, [left, crown, topRight, right, foot, front], Math.floor(random() * 10000));
    if (random() > 0.5) {
      polygon(ctx, [[width * 0.14, height * 0.59], [width * 0.39, height * 0.66], [width * 0.35, height * 0.75], [width * 0.13, height * 0.69]], '#45583c');
    }
    return sprite;
  }
}
