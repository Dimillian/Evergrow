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
  private actorStamp?: HTMLCanvasElement;
  private contactStamp?: HTMLCanvasElement;
  reset() { this.silhouettes = new WeakMap(); this.actorStamp = undefined; this.contactStamp = undefined; }
  drawContact(c: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
    if (!this.contactStamp) {
      const image = document.createElement('canvas'); image.width = 128; image.height = 48;
      const target = image.getContext('2d')!; target.scale(1, .375);
      const g = target.createRadialGradient(64,64,3,64,64,64);
      g.addColorStop(0,'#07101ed0'); g.addColorStop(.32,'#0b172779'); g.addColorStop(1,'#0b172700');
      target.fillStyle=g; target.fillRect(0,0,128,128); this.contactStamp=image;
    }
    c.drawImage(this.contactStamp,x-width,y-height,width*2,height*2);
  }
  private actorMask() {
    if (this.actorStamp) return this.actorStamp;
    const stamp = document.createElement('canvas'); stamp.width = 128; stamp.height = 64;
    const c = stamp.getContext('2d')!;
    c.translate(64, 32); c.scale(64, 32);
    // One continuous footprint: dense at the feet, feathered along the cast tail.
    const gradient = c.createRadialGradient(-.4, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, '#030a138c'); gradient.addColorStop(.3, '#030a135c');
    gradient.addColorStop(.7, '#030a1324'); gradient.addColorStop(1, '#030a1300');
    c.fillStyle = gradient; c.fillRect(-1, -1, 2, 2);
    this.actorStamp = stamp; return stamp;
  }
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
    spriteFor: (prop: Prop) => Sprite, time: number, reduced: boolean, direction: GearLight['direction'] = SKY_DIRECTION, strength = 1, volume = true) {
    const projection = shadowProjection(direction);
    c.save(); c.imageSmoothingEnabled = true;
    let count = 0;
    for (const prop of props) {
      if (prop.radius <= 0 || prop.x < view.left - 220 || prop.x > view.left + view.width + 220
        || prop.y < view.top - 140 || prop.y > view.top + view.height + 100) continue;
      if (count++ >= 100) break;
      const sprite = spriteFor(prop), definition = propDefinition(prop.kind);
      const wind = biomeWind(prop.x, prop.y, time, prop.biome ?? 'deadwood', reduced);
      c.save(); c.translate(prop.x, prop.y + 1); c.scale(prop.scale, prop.scale);
      if (volume) this.drawContact(c, 0, 0, definition.shadow[0] * .95, Math.max(3, definition.shadow[1] * .65));
      // Actual trunk/rock silhouette, anchored at its contact with the terrain.
      c.save(); c.transform(1, 0, -projection.x, -projection.y, 0, 0);
      c.globalAlpha = (definition.canopy ? .18 : .24) * strength;
      c.drawImage(this.mask(sprite.image), -sprite.anchorX, -sprite.anchorY, sprite.width, sprite.height); c.restore();
      for (const [layer, foliage] of (sprite.foliage ?? []).entries()) {
        const gust = biomeWind(prop.x, prop.y, time - layer * .18, prop.biome ?? 'deadwood', reduced).x * definition.sway * 2.2;
        c.save(); c.transform(1, 0, -projection.x + gust * (layer ? -.009 : -.005), -projection.y, wind.x * 1.4, wind.y);
        c.globalAlpha = .115 * strength;
        const mask = this.mask(foliage);
        // Two faint offset samples give a soft penumbra without a Canvas blur filter.
        c.drawImage(mask, -sprite.anchorX - 2, -sprite.anchorY - 1, sprite.width + 4, sprite.height + 2);
        c.globalAlpha = .09 * strength; c.drawImage(mask, -sprite.anchorX, -sprite.anchorY, sprite.width, sprite.height);
        c.restore();
      }
      c.restore();
    }
    c.restore();
  }
  drawActor(c: CanvasRenderingContext2D, x: number, y: number, radius: number, height: number, light: GearLight, wet: boolean) {
    const p = shadowProjection(light.direction), dx = p.x * height, dy = p.y * height;
    c.save(); c.translate(x, y + 2); c.rotate(Math.atan2(dy, dx));
    const length = Math.hypot(dx, dy), width = Math.max(radius * 2, length * 1.15 + radius);
    c.globalAlpha *= (wet ? .3 : 1) * Math.min(1, .3 + light.power);
    c.imageSmoothingEnabled = true;
    // The stamp's dense focus is at 30% of its width, exactly on the feet.
    c.drawImage(this.actorMask(), -width * .3, -radius * .65, width, radius * 1.3);
    c.restore();
  }
}
