import type { Sprite } from './art-types.ts';
import type { Prop } from './world.ts';
import { propDefinition } from './biome-props.ts';

/** A cached relief pass for existing painted sprites. Gear uses its authored normals;
 * scenery keeps its painted facets, with a soft upper-left key and a narrow lit edge. */
export class PropSurfaceLight {
  private masks = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
  reset() { this.masks = new WeakMap(); }
  private mask(source: HTMLCanvasElement) {
    const cached = this.masks.get(source); if (cached) return cached;
    const image = document.createElement('canvas');
    image.width = source.width; image.height = source.height;
    const c = image.getContext('2d')!;
    c.drawImage(source, 0, 0);
    c.globalCompositeOperation = 'source-in';
    const gradient = c.createLinearGradient(0, 0, image.width, image.height);
    gradient.addColorStop(0, '#e1e9cf48'); gradient.addColorStop(.42, '#c5d8d411');
    gradient.addColorStop(.67, '#10203b08'); gradient.addColorStop(1, '#08112642');
    c.fillStyle = gradient; c.fillRect(0, 0, image.width, image.height);
    this.masks.set(source, image); return image;
  }
  draw(c: CanvasRenderingContext2D, prop: Prop, sprite: Sprite, image = sprite.image) {
    const definition = propDefinition(prop.kind);
    if (definition.radius[1] === 0) return;
    c.save();
    // Broad matte foliage/wood versus more readable stone planes. Surface emissions
    // are drawn separately after illumination and must not acquire a painted tint.
    c.globalAlpha *= definition.canopy ? .55 : definition.emissive ? .4 : .85;
    c.drawImage(this.mask(image), -sprite.anchorX, -sprite.anchorY, sprite.width, sprite.height);
    c.restore();
  }
}
