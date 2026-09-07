import { appearancePalette, HAIR_PALETTES, SKIN_PALETTES, type CharacterAppearance } from './appearance-content.ts';
import { mixColor, type Point } from './art-primitives.ts';
import type { GearShape } from './weapon-shapes.ts';
import { hairShapes } from './appearance-hair-shapes.ts';
import { facialHairShapes, faceAccessoryShapes } from './appearance-face-details.ts';

const fill = (points: readonly Point[], color: string): GearShape => ({ points, fill: color });
const line = (points: readonly Point[], color: string, width = .6): GearShape => ({ points, stroke: color, width });

/** All shapes are local to the existing head mount. Body proportions never change. */
export function appearanceHeadShapes(appearance: Readonly<CharacterAppearance>, facing: number, covered: boolean): GearShape[] {
  const skin = appearancePalette(SKIN_PALETTES, appearance.skin);
  const hair = appearancePalette(HAIR_PALETTES, appearance.hairColor);
  const back = Math.sin(facing) < -.16, side = Math.cos(facing), look = side * .8;
  const shapes: GearShape[] = [];
  const shape = (points: readonly Point[], color: string) => shapes.push(fill(points, color));
  const stroke = (points: readonly Point[], color: string, width = .6) => shapes.push(line(points, color, width));
  const hairLayers = covered ? {rear:[],front:[]} : hairShapes(appearance.hair,hair,facing);
  shapes.push(...hairLayers.rear);
  shape([[-4.2, -.8], [-3.2, -3.9], [.6, -4.8], [3.7, -2.7], [4.2, .6], [2.7, 4.1], [.7, 5.3], [-2, 4.6], [-3.9, 1.8]], back ? skin.shadow : '#403b39');
  if (!back) {
    shape([[-3 + look, -1.4], [.2 + look, -2.6], [2.7 + look, -1.3], [3 + look, 2.4], [1.1 + look, 4.7], [-1.1 + look, 4.4], [-2.6 + look, 2.6]], skin.base);
    shape([[-3 + look, -1.4], [-1.1 + look, -.7], [-.7 + look, 3.8], [-1.1 + look, 4.4], [-2.6 + look, 2.6]], skin.shadow);
    shape([[.2 + look, 1.1], [1 + look, 2.2], [.4 + look, 2.7], [-.1 + look, 2.1]], skin.light);
    for (const eye of [-1, 1]) {
      const width = .9 - Math.max(0, side * eye) * .35;
      stroke([[eye * 1.6 + look - width / 2, 1.25], [eye * 1.6 + look + width / 2, 1.25]], '#263239', .65);
    }
    stroke([[-.8 + look, 3.1], [.9 + look, 3.3]], mixColor(skin.shadow, '#553c3e', .3), .55);
    stroke([[-.5 + look, 4.2], [.8 + look, 4.3]], skin.light, .45);
    shapes.push(...facialHairShapes(appearance.facialHair,hair,skin,look));
  } else {
    shape([[-2.8, -3.4], [.5, -4], [3, -2.5], [3.3, .8], [1.8, 4], [-.7, 4.4], [-2.7, 2.5]], skin.base);
  }
  const underHair = ['eyepatch','spectacles','nosering'].includes(appearance.accessory);
  if(underHair) shapes.push(...faceAccessoryShapes(appearance.accessory,facing,covered));
  shapes.push(...hairLayers.front);
  if(!underHair) shapes.push(...faceAccessoryShapes(appearance.accessory,facing,covered));
  return shapes;
}
