import { overlapsOcclusion, type OcclusionRect } from './enemy-occlusion.ts';

export interface OcclusionLayer {
  depth: number;
  /** Stable ordering for actors sharing a ground depth; scenery precedes them. */
  order?: number;
  bounds?: OcclusionRect;
  paint(c: CanvasRenderingContext2D): void;
}
export interface OccludedEnemy extends OcclusionLayer {
  id: number;
  bounds: OcclusionRect;
  strength: number;
}
type Surface = { image: HTMLCanvasElement; c: CanvasRenderingContext2D };

/** Three reusable actor-sized surfaces, independent of actor count and screen size.
 * No pixel readback, full-screen masks, retained actor sprites, or gameplay mutations. */
export class EnemyOcclusionArt {
  private surfaces?: [Surface, Surface, Surface];
  constructor(createCanvas?: () => HTMLCanvasElement) { this.factory = createCanvas ?? (() => document.createElement('canvas')); }
  private factory: () => HTMLCanvasElement;

  draw(c: CanvasRenderingContext2D, actor: OccludedEnemy, props: readonly OcclusionLayer[],
    blockers: readonly OcclusionLayer[], opacity: number): void {
    if (opacity <= .005) return;
    const covers = props.filter(layer => layer.depth > actor.depth && (!layer.bounds || overlapsOcclusion(actor.bounds, layer.bounds)));
    if (!covers.length) return;
    const { left, top, width, height } = actor.bounds;
    const w = Math.ceil(width * 2), h = Math.ceil(height * 2);
    this.surfaces ??= Array.from({ length: 3 }, () => {
      const image = this.factory(); return { image, c: image.getContext('2d')! };
    }) as [Surface, Surface, Surface];
    const [body, tint, mask] = this.surfaces;
    for (const s of this.surfaces) {
      if (s.image.width < w) s.image.width = w;
      if (s.image.height < h) s.image.height = h;
      s.c.clearRect(0, 0, s.image.width, s.image.height);
    }
    const paint = (s: Surface, layer: OcclusionLayer) => {
      s.c.save(); s.c.scale(2, 2); s.c.translate(-left, -top); layer.paint(s.c); s.c.restore();
    };
    paint(body, actor);
    // Tint the real animated body. Build its edge before clipping to scenery so
    // canopy boundaries never acquire an artificial outline.
    body.c.save(); body.c.globalCompositeOperation = 'source-in'; body.c.fillStyle = '#ed9a83';
    body.c.fillRect(0, 0, body.image.width, body.image.height); body.c.restore();
    tint.c.save();
    for (const [x, y] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) tint.c.drawImage(body.image, x, y);
    tint.c.globalCompositeOperation = 'destination-out'; tint.c.drawImage(body.image, 0, 0);
    tint.c.globalCompositeOperation = 'source-over'; tint.c.globalAlpha = .28; tint.c.drawImage(body.image, 0, 0);
    tint.c.restore();
    for (const layer of covers) paint(mask, layer);
    tint.c.save(); tint.c.globalCompositeOperation = 'destination-in'; tint.c.drawImage(mask.image, 0, 0); tint.c.restore();
    // Architectural cover always wins, even when foliage lies in front of it.
    // Foreground bodies also prevent a hidden enemy from painting over the hero.
    mask.c.clearRect(0, 0, mask.image.width, mask.image.height);
    for (const layer of blockers) {
      const inFront = layer.depth > actor.depth || layer.depth === actor.depth && (layer.order ?? 0) > (actor.order ?? 0);
      if (inFront && (!layer.bounds || overlapsOcclusion(actor.bounds, layer.bounds))) paint(mask, layer);
    }
    tint.c.save(); tint.c.globalCompositeOperation = 'destination-out'; tint.c.drawImage(mask.image, 0, 0); tint.c.restore();
    c.save(); c.globalAlpha *= opacity * .85;
    c.drawImage(tint.image, 0, 0, w, h, left, top, w / 2, h / 2); c.restore();
  }
}
