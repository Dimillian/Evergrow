import type { Sprite } from './art-types.ts';
import type { Prop } from './world.ts';
import type { CameraView } from './camera.ts';
import { propDefinition } from './biome-props.ts';
import { biomeWind } from './biome-wind.ts';
import { SKY_DIRECTION, shadowProjection } from './scene-light-style.ts';
import type { GearLight } from './gear-material.ts';

/** Low-resolution silhouettes are reused; no pixel readback or per-frame blur. */
export class SceneShadows {
  private silhouettes = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
  reset() { this.silhouettes = new WeakMap(); }
  private mask(source: HTMLCanvasElement) {
    let mask = this.silhouettes.get(source);
    if (mask) return mask;
    mask = document.createElement('canvas');
    const scale = Math.min(1, 144 / Math.max(source.width, source.height));
    mask.width = Math.max(1, Math.ceil(source.width * scale)); mask.height = Math.max(1, Math.ceil(source.height * scale));
    const c = mask.getContext('2d')!;
    c.drawImage(source, 0, 0, mask.width, mask.height);
    c.globalCompositeOperation = 'source-in'; c.fillStyle = '#09131c'; c.fillRect(0, 0, mask.width, mask.height);
    this.silhouettes.set(source, mask); return mask;
  }
  drawProps(c: CanvasRenderingContext2D, props: readonly Prop[], view: CameraView,
    spriteFor: (prop: Prop) => Sprite, time: number, reduced: boolean) {
    const projection = shadowProjection(SKY_DIRECTION);
    c.save(); c.imageSmoothingEnabled = true;
    let count = 0;
    for (const prop of props) {
      if (prop.radius <= 0 || prop.x < view.left - 220 || prop.x > view.left + view.width + 220
        || prop.y < view.top - 140 || prop.y > view.top + view.height + 100) continue;
      if (count++ >= 100) break;
      const sprite = spriteFor(prop), definition = propDefinition(prop.kind);
      const wind = biomeWind(prop.x, prop.y, time, prop.biome ?? 'deadwood', reduced);
      c.save(); c.translate(prop.x, prop.y + 1); c.scale(prop.scale, prop.scale);
      // Actual trunk/rock silhouette, anchored at its contact with the terrain.
      c.save(); c.transform(1, 0, -projection.x, -projection.y, 0, 0);
      c.globalAlpha = definition.canopy ? .18 : .24;
      c.drawImage(this.mask(sprite.image), -sprite.anchorX, -sprite.anchorY, sprite.width, sprite.height); c.restore();
      for (const [layer, foliage] of (sprite.foliage ?? []).entries()) {
        const gust = biomeWind(prop.x, prop.y, time - layer * .18, prop.biome ?? 'deadwood', reduced).x * definition.sway * 2.2;
        c.save(); c.transform(1, 0, -projection.x + gust * (layer ? -.009 : -.005), -projection.y, wind.x * 1.4, wind.y);
        c.globalAlpha = .115;
        const mask = this.mask(foliage);
        // Two faint offset samples give a soft penumbra without a Canvas blur filter.
        c.drawImage(mask, -sprite.anchorX - 2, -sprite.anchorY - 1, sprite.width + 4, sprite.height + 2);
        c.globalAlpha = .09; c.drawImage(mask, -sprite.anchorX, -sprite.anchorY, sprite.width, sprite.height);
        c.restore();
      }
      c.restore();
    }
    c.restore();
  }
  drawActor(c: CanvasRenderingContext2D, x: number, y: number, radius: number, height: number, light: GearLight, wet: boolean) {
    const p = shadowProjection(light.direction), dx = p.x * height, dy = p.y * height;
    c.save(); c.translate(x, y + 2); c.rotate(Math.atan2(dy, dx));
    // Contact stays dense; the directional body shadow broadens and fades away from the feet.
    const length = Math.hypot(dx, dy);
    for (const [spread, opacity] of [[1.35, .06], [1, .13]]) {
      c.globalAlpha = opacity * (wet ? .3 : 1);
      c.fillStyle = '#030a13'; c.beginPath(); c.ellipse(length * .42, 0, Math.max(radius, length * .62), radius * .56 * spread, 0, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
}
