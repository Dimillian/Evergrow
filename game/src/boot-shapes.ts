import type { ArmorPiece } from './art-types.ts';
import { mixColor, type Point } from './art-primitives.ts';
import { gearSurface, materializeGear, type GearMaterial } from './gear-material.ts';
import type { GearShape } from './weapon-shapes.ts';

const cache = new WeakMap<ArmorPiece, Map<number, readonly GearShape[]>>();
/** An ankle-mounted boot. The sole stays on the existing foot contact plane. */
export function bootShapes(piece: ArmorPiece, direction = 0): readonly GearShape[] {
  const turn = Math.round(Math.max(-1, Math.min(1, direction)) * 8);
  let variants = cache.get(piece);
  if (!variants) { variants = new Map(); cache.set(piece, variants); }
  const cached = variants.get(turn);
  if (cached) return cached;
  const m = piece.material, plate = piece.style === 'plate', toe = turn / 8 * 1.1;
  const material: GearMaterial = m.surface ?? (plate ? 'steel' : 'leather');
  const shapes: GearShape[] = [];
  const face = (points: Point[], fill: string, normal: readonly [number, number, number] = [-.24, -.32, .916]) =>
    shapes.push({ points, fill, surface: gearSurface(material, piece.seed + shapes.length * 17, normal) });
  const seam = (points: Point[], stroke: string, width: number, fine = false) => shapes.push({ points, stroke, width, fine });
  // Slim shaft, seated heel, and a chamfered toe instead of a rectangular slab.
  face([[-1.65,-6],[1.65,-6],[1.45,-2.3],[2+toe,-.3],[2+toe,.6],[1.35+toe,1.1],[-1.4+toe,1.1],[-1.95+toe,.65],[-1.8,-1.3]],m.shadow);
  face([[-1.3,-5.65],[1.3,-5.65],[1.13,-2.6],[.78,-1.7],[-1.05,-1.8],[-1.42,-2.8]],m.base);
  face([[-1.25,-5.5],[-.48,-5.55],[-.55,-2.55],[-1.1,-1.9],[-1.4,-2.8]],mixColor(m.base,m.edge,.18),[-.55,-.15,.82]);
  // Raised instep rolls into a low toe cap; its two edges define the foot volume.
  face([[-1.08,-2.05],[.92,-2.05],[1.62+toe,-.4],[1.15+toe,.32],[-1.05+toe,.4],[-1.5+toe,-.2]],mixColor(m.base,m.edge,.12),[0,-.6,.8]);
  face([[-1.5+toe,-.2],[-1.05+toe,.4],[1.15+toe,.32],[1.62+toe,-.4],[1.7+toe,.45],[1.16+toe,.75],[-1.1+toe,.8],[-1.55+toe,.45]],m.base,[0,.35,.94]);
  // Thin welt and dark sole, with the heel directly beneath the ankle.
  seam([[-1.6+toe,.5],[-1.12+toe,.9],[1.2+toe,.85],[1.75+toe,.45]],mixColor(m.base,m.edge,.2),.22);
  seam([[-1.65+toe,.88],[-1.12+toe,1.12],[1.3+toe,1.08],[1.92+toe,.63]],'#182327',.32);
  const binding = mixColor(m.trim,m.base,.55);
  seam([[-1.38,-5.3],[1.38,-5.3]],binding,.45);
  seam([[-1.22,-3.15],[1.15,-3.15]],m.shadow,.45);
  if (plate) {
    seam([[-1.05,-1.8],[.9,-1.8]],m.edge,.3);
    seam([[-1.2+toe,-.65],[1.35+toe,-.7]],m.shadow,.25);
  } else {
    for(let i=0;i<3;i++) seam([[-.4,-4.65+i*.65],[.35,-4.35+i*.65]],binding,.17,true);
    seam([[-1.14,-5.1],[-1.12,-3.6]],mixColor(m.edge,m.base,.5),.12,true);
  }
  const result=materializeGear(shapes,material,piece.seed);
  variants.set(turn,result);
  return result;
}
