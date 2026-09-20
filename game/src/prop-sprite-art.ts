import type { Sprite } from './art-types.ts';
import { propDefinition } from './biome-props.ts';
import { biomeWind } from './biome-wind.ts';
import type { Prop } from './world.ts';
import type { OcclusionRect } from './enemy-occlusion.ts';

/** One transform recipe for scenery and its exact alpha mask. */
export function drawPropSprite(c: CanvasRenderingContext2D, prop: Prop, sprite: Sprite,
  time: number, reducedMotion: boolean, bend: number, foliageOpacity: number,
  light?: (c: CanvasRenderingContext2D, image: HTMLCanvasElement) => void): void {
  const definition = propDefinition(prop.kind);
  c.save(); c.translate(prop.x, prop.y); c.scale(prop.scale, prop.scale);
  if (!sprite.foliage && definition.radius[1] === 0) {
    const wind = biomeWind(prop.x, prop.y, time, prop.biome ?? 'deadwood', reducedMotion).x * definition.sway;
    c.transform(1, 0, -bend * .35, 1 - Math.abs(bend) * .18, 0, 0);
    c.transform(1, 0, wind * -.012, 1, 0, 0);
  }
  const draw = (image: HTMLCanvasElement) => {
    c.drawImage(image, -sprite.anchorX, -sprite.anchorY, sprite.width, sprite.height);
    light?.(c, image);
  };
  draw(sprite.image);
  for (const [layer, foliage] of (sprite.foliage ?? []).entries()) {
    c.save();
    const gust = biomeWind(prop.x, prop.y, time - layer * .18, prop.biome ?? 'deadwood', reducedMotion).x * definition.sway * 2.2;
    c.transform(1, 0, gust * (layer ? -.009 : -.005), 1, 0, 0);
    c.globalAlpha *= foliageOpacity; draw(foliage); c.restore();
  }
  c.restore();
}

export function propSpriteBounds(prop: Prop, sprite: Sprite): OcclusionRect {
  // Broad phase only: actual wind, holes and translucency come from drawPropSprite.
  const padding = 24 * prop.scale;
  return { left: prop.x - sprite.anchorX * prop.scale - padding,
    top: prop.y - sprite.anchorY * prop.scale - padding,
    width: sprite.width * prop.scale + padding * 2, height: sprite.height * prop.scale + padding * 2 };
}
