import { polygon, line, mixColor, type Point } from './art-primitives.ts';
import { surfaceDot, volumeDiffuse, volumeLightKey } from './surface-lighting.ts';
import type { GearLight } from './gear-material.ts';
import type { Sprite } from './art-types.ts';
export interface ReliefFacet { points: readonly Point[]; normal: readonly [number, number, number]; occlusion: number; bevel: number }
interface Surface { width: number; height: number; x: number; y: number; facets: ReliefFacet[] }
const authored = new WeakMap<HTMLCanvasElement, Surface>();
const drawing = new WeakMap<CanvasRenderingContext2D, Surface>();
export function beginRelief(c: CanvasRenderingContext2D, image: HTMLCanvasElement, width: number, height: number, x = 0, y = 0) {
  const surface = { width, height, x, y, facets: [] }; authored.set(image, surface); drawing.set(c, surface);
}
export function reliefFacet(c: CanvasRenderingContext2D, points: readonly Point[], normal: ReliefFacet['normal'], occlusion = 0, bevel = 0) {
  drawing.get(c)?.facets.push({ points, normal, occlusion, bevel });
}
export function reliefCrown(c: CanvasRenderingContext2D, points: readonly Point[], x: number, y: number, rx: number, ry: number) {
  // Shallow central dome, broad sloped sides and a recessed underside; no tiny tessellation.
  const inner = points.map(([px, py]) => [x + (px - x) * .57, y + (py - y) * .52 - ry * .16] as Point);
  reliefFacet(c, inner, [0, -.25, .97], .01);
  for (let i = 0; i < points.length; i += 2) {
    const j = (i + 2) % points.length, mid = points[(i + 1) % points.length];
    const nx = (mid[0] - x) / rx, ny = (mid[1] - y) / ry;
    reliefFacet(c, [inner[i], points[i], mid, points[j], inner[j]], [nx * .72, ny * .72, .58], Math.max(0, ny) * .22, ny < -.1 ? .35 : 0);
  }
}
export function reliefFacetCount(image: HTMLCanvasElement) { return authored.get(image)?.facets.length ?? 0; }

/** Cached pigment + authored planes. Two rasters per source, six small rebakes per frame, no readback. */
export class SurfaceRelief {
  private cache = new WeakMap<HTMLCanvasElement, Array<{ key: string; image: HTMLCanvasElement }>>();
  private scratch?: HTMLCanvasElement;
  private budget = 6;
  bakes = 0;
  beginFrame() { this.budget = 6; this.bakes = 0; }
  reset() { this.cache = new WeakMap(); this.scratch = undefined; }
  draw(c: CanvasRenderingContext2D, sprite: Sprite, source: HTMLCanvasElement, light: GearLight, distance = 0): boolean {
    const surface = authored.get(source); if (!surface?.facets.length) return false;
    // Quantized color avoids dozens of nearly identical variants beside flickering lamps.
    const match = light.color.match(/\d+/g);
    const channels = light.color.startsWith('#') ? [1, 3, 5].map(i => parseInt(light.color.slice(i, i + 2), 16)) : (match ?? []).slice(0, 3).map(Number);
    const color = `rgb(${channels.map(v => Math.min(255, Math.round(v / 24) * 24)).join(',')})`;
    const key = volumeLightKey(light.direction, light.power, color, distance);
    const variants = this.cache.get(source) ?? [];
    let result = variants.find(v => v.key === key);
    if (!result && this.budget > 0) {
      this.budget--; this.bakes++;
      const image = variants.length === 2 ? variants.shift()!.image : document.createElement('canvas');
      image.width = source.width; image.height = source.height;
      const target = image.getContext('2d')!;
      target.drawImage(source, 0, 0);
      const mask = this.scratch ??= document.createElement('canvas');
      mask.width = source.width; mask.height = source.height;
      const paint = mask.getContext('2d')!;
      paint.scale(source.width / surface.width, source.height / surface.height); paint.translate(surface.x, surface.y);
      const strength = Math.min(1.25, Math.max(.3, light.power)), distant = distance > 460;
      // Opaque facet painting follows the asset's own overlap order. A rear crown
      // must never brighten or darken a foreground crown through repeated blends.
      for (const face of surface.facets) {
        const lit = volumeDiffuse(surfaceDot(face.normal, light.direction));
        const value = Math.max(0, Math.min(1, .12 + lit * .88 - face.occlusion));
        const pigment = mixColor('#4d6078', mixColor('#ffffe9', color, .16 * strength), value);
        polygon(paint, face.points, pigment);
        if (face.bevel && !distant) {
          paint.globalAlpha = lit * .38;
          line(paint, face.points.slice(1, 4), '#fff3ce', face.bevel); paint.globalAlpha = 1;
        }
      }
      target.globalCompositeOperation = 'multiply'; target.globalAlpha = distant ? .6 : .84; target.drawImage(mask, 0, 0);
      target.globalAlpha = 1; target.globalCompositeOperation = 'destination-in'; target.drawImage(source, 0, 0);
      if (distant) { target.globalCompositeOperation = 'source-atop'; target.globalAlpha = .045; target.fillStyle = '#95aaa9'; target.fillRect(0, 0, image.width, image.height); }
      result = { key, image }; variants.push(result); this.cache.set(source, variants);
    }
    result ??= variants[variants.length - 1];
    if (!result) return false;
    c.drawImage(result.image, -sprite.anchorX, -sprite.anchorY, sprite.width, sprite.height);
    return true;
  }
}
