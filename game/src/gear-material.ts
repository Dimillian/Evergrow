import { mixColor, type Point } from './art-primitives.ts';
import type { GearShape } from './weapon-shapes.ts';

import { GEAR_MATERIALS, type GearMaterial } from './gear-material-content.ts';
export { GEAR_MATERIALS, GEAR_MATERIAL_IDS, type GearMaterial } from './gear-material-content.ts';
export interface GearSurface { material: GearMaterial; normal: readonly [number, number, number]; seed: number; facet?: boolean; albedo?: string }
export interface GearLight { direction: readonly [number, number, number]; color: string; power: number }
export const DEFAULT_GEAR_LIGHT: Readonly<GearLight> = Object.freeze({ direction: [-.45,-.6,.66] as const, color:'#e9f1ff',power:1 });
export function gearSurface(material: GearMaterial, seed = 0, normal: readonly [number, number, number] = [-.24, -.32, .916]): GearSurface {
  const length = Math.hypot(...normal) || 1;
  return { material, seed, normal: normal.map(n => n / length) as [number, number, number] };
}
/** Explicit material identity, independent of item rarity and palette tint. */
export function materializeGear(shapes: GearShape[], material: GearMaterial, seed: number,
  accents: ReadonlyMap<string, GearMaterial> = new Map()): GearShape[] {
  return shapes.map((shape, i) => !shape.surface ? { ...shape,
    surface: gearSurface(accents.get(shape.fill ?? shape.stroke ?? '') ?? material, seed + i * 37) } : shape);
}
/** Shared roughness / metallic response for Canvas, SVG and the gallery shader. */
export function gearLightResponse(surface: GearSurface, light: GearLight = DEFAULT_GEAR_LIGHT, facing = 0) {
  const m=GEAR_MATERIALS[surface.material], [nx,ny,nz]=surface.normal;
  const [x,y,z]=light.direction, length=Math.hypot(x,y,z)||1;
  const lx=(x*Math.cos(facing)+y*Math.sin(facing))/length,ly=(-x*Math.sin(facing)+y*Math.cos(facing))/length,lz=z/length;
  const diffuse=Math.max(0,nx*lx+ny*ly+nz*lz), hlen=Math.hypot(lx,ly,lz+1);
  const halfDot=Math.max(0,(nx*lx+ny*ly+nz*(lz+1))/hlen);
  const specular=Math.pow(halfDot,6+(1-m.roughness)*90)*(1-m.roughness)*(m.metalness*.56+.12)*Math.min(1.5,Math.max(0,light.power));
  return { diffuse, specular, metalness:m.metalness };
}
export function gearMaterialStops(base: string, surface: GearSurface, facing = 0, light: GearLight = DEFAULT_GEAR_LIGHT): Array<readonly [number, string]> {
  base=surface.albedo??base;
  const m = GEAR_MATERIALS[surface.material], response=gearLightResponse(surface,light,facing);
  const power=Math.min(1.5,Math.max(0,light.power));
  const highlight=mixColor(m.light,light.color,.45);
  const shade=(1-response.diffuse)*.27;
  let pigment=mixColor(base,m.shade,shade);
  pigment=mixColor(pigment,highlight,Math.min(.62,response.diffuse*.09*power+response.specular));
  if(surface.facet) return [[0,pigment],[1,pigment]];
  // Soft cylindrical variation, with restrained metallic reflection bands.
  const reflection=.36+Math.sin(facing+surface.normal[0]*1.7)*.14;
  const sheen=(1-m.roughness)*(.07+response.specular*.65)*power;
  return [[0,mixColor(pigment,highlight,.04)], [reflection,mixColor(pigment,highlight,Math.min(.4,sheen))],
    [Math.min(.82,reflection+.22),pigment],[1,mixColor(pigment,m.shade,.1+m.metalness*.04)]];
}
const canvasLights = new WeakMap<CanvasRenderingContext2D, GearLight>();
export const gearCanvasLight = (ctx: CanvasRenderingContext2D) => canvasLights.get(ctx) ?? DEFAULT_GEAR_LIGHT;
export function withGearLight(ctx: CanvasRenderingContext2D, light: GearLight, draw:()=>void):void {
  const previous=canvasLights.get(ctx);canvasLights.set(ctx,light);
  try {draw();} finally {if(previous)canvasLights.set(ctx,previous);else canvasLights.delete(ctx);}
}
/** Sparse surface-specific marks; tiny facets stay clean. */
export function gearMaterialMarks(surface: GearSurface, bounds: readonly [number, number, number, number]): Point[][] {
  const [x, y, w, h] = bounds;
  if (w < 1 || h < 1 || surface.facet || surface.material === 'gem' || surface.material === 'cloth' || surface.material === 'silk' || surface.material === 'velvet' || surface.material === 'starweave') return [];
  const out: Point[][] = [];
  for (let i = 0; i < 3; i++) {
    const u = ((surface.seed * 13 + i * 47) % 97 + 97) % 97 / 97;
    const v = ((surface.seed * 7 + i * 31) % 89 + 89) % 89 / 89;
    const px = x + w * (.13 + u * .74), py = y + h * (.12 + v * .76);
    const wood = surface.material === 'wood', leather = surface.material === 'leather';
    out.push([[px, py], [px + w * (wood ? .22 : leather ? .035 : .09), py + h * (wood ? .015 : leather ? .025 : -.04)]]);
  }
  return out;
}
