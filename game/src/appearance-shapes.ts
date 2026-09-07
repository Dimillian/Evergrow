import { appearancePalette, HAIR_PALETTES, SKIN_PALETTES, type CharacterAppearance } from './appearance-content.ts';
import { mixColor, type Point } from './art-primitives.ts';
import type { GearShape } from './weapon-shapes.ts';

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
  if (!covered && ['long', 'bob'].includes(appearance.hair)) {
    const length = appearance.hair === 'bob' ? 6 : 11;
    shape([[-4.1, -2], [4.1, -2], [5, 3], [5.3, length], [2, length - 1], [0, length], [-4.8, length - 1], [-5, 3]], hair.shadow);
    shape([[-4, -.8], [-2.4, -.8], [-2.3, length - 1], [-4.6, length - 2]], hair.base);
    shape([[2.2, -.8], [4, -.8], [4.8, length - 1], [3, length - 2]], hair.base);
  }
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
    if (appearance.facialHair === 'stubble' || appearance.facialHair === 'beard') {
      const full = appearance.facialHair === 'beard';
      shape([[-2.7 + look, 2.1], [-1.5 + look, 3.1], [.1 + look, 3.6], [1.6 + look, 3], [2.8 + look, 1.9], [2.5 + look, 4.2], [.5 + look, full ? 6.6 : 5], [-1.5 + look, full ? 5.7 : 4.5], [-2.6 + look, 3.5]], full ? hair.base : mixColor(skin.base, hair.shadow, .45));
      if (full) stroke([[-1.5 + look, 3.8], [-.7 + look, 5], [.4 + look, 5.7]], hair.light, .4);
    }
    if (appearance.facialHair === 'moustache' || appearance.facialHair === 'beard') {
      shape([[.2 + look, 2.6], [1 + look, 2.7], [2 + look, 3.6], [.9 + look, 3.3], [.1 + look, 3.1], [-1 + look, 3.4], [-1.8 + look, 3.3], [-.8 + look, 2.7]], hair.base);
    }
  } else {
    shape([[-2.8, -3.4], [.5, -4], [3, -2.5], [3.3, .8], [1.8, 4], [-.7, 4.4], [-2.7, 2.5]], skin.base);
  }
  if (!covered && appearance.hair !== 'bald') {
    if (appearance.hair === 'swept') {
      shape([[-4.2, -.7], [-3.2, -3.9], [.6, -4.8], [3.7, -2.7], [3.8, -.6], [2.1, -1.4], [1, -2.5], [-1.5, -1.8], [-2.2, .1], [-3.6, 1.4]], hair.base);
      stroke([[-3.4, -1.5], [-2.6, -3], [.3, -3.7], [2.4, -2.4]], hair.light, .7);
    } else if (appearance.hair === 'crop') {
      shape([[-4, -.4], [-3.5, -3.7], [-2, -4.9], [.8, -5.2], [3.8, -3], [4.1, -.3], [2.5, -1.5], [.4, -2.6], [-2.4, -1.7]], hair.base);
      stroke([[-2.9, -3.6], [-1.2, -4.3], [1.3, -4.1], [2.8, -2.8]], hair.light, .5);
    } else if (appearance.hair === 'curls') {
      shape([[-5.3, -.2], [-5.6, -2.1], [-4.7, -3.3], [-4.9, -4.8], [-3.2, -5.3], [-2.3, -6.5], [-.8, -5.9], [.8, -6.6], [2.1, -5.7], [3.9, -5.6], [4.3, -4.1], [5.2, -3.6], [5, -2], [5.5, -.8], [4.4, 1], [3, .1], [2, -1.7], [.2, -2.5], [-1.4, -1.3], [-3.1, -1.8], [-3.5, 1.6], [-4.8, 1.3]], hair.base);
      for (const [x, y] of [[-3.6, -3.8], [-1.3, -4.9], [1.3, -4.5], [3.1, -3.5], [-4.2, -1]]) stroke([[x - .5, y], [x, y - .6], [x + .8, y - .3]], hair.light, .5);
    } else {
      shape([[-4.5, .7], [-4.6, -2.6], [-3, -5], [.5, -5.5], [3.7, -3.4], [4.5, -.6], [4, 3.8], [2.9, 2.4], [2.3, -1.9], [.3, -3.1], [-.8, -1.6], [-2.9, -.4], [-3.6, 4]], hair.base);
      stroke([[-3.9, -.1], [-3.3, -3], [-1, -4.3], [.2, -4.5]], hair.light, .6);
      stroke([[1.1, -4.4], [3, -2.9], [3.6, -.4]], hair.light, .45);
    }
    if (back) {
      const bottom = appearance.hair === 'long' ? 10.5 : appearance.hair === 'bob' ? 6.3 : 4.8;
      shape([[-3.9, -.4], [3.9, -.4], [4.1, bottom - 2], [2, bottom], [-2.3, bottom - .6], [-4, bottom - 2.5]], hair.base);
      stroke([[-2.6, .5], [-2.4, bottom - 1.5]], hair.light, .45);
      stroke([[1.8, .4], [2.3, bottom - 1.3]], hair.shadow, .7);
    }
    if (appearance.hair === 'bun') {
      shape([[-2.9, -5], [-3.1, -7.2], [-1.8, -8.5], [.8, -8.8], [2.6, -7.6], [2.9, -5.8], [1.2, -4.6]], hair.shadow);
      shape([[-2.2, -5.7], [-2.3, -7], [-.6, -8], [1.5, -7.3], [2, -6.1], [.5, -5.3]], hair.base);
      stroke([[-1.7, -6.6], [-.6, -7.2], [1, -6.9]], hair.light, .6);
      stroke([[-2.1, -5.4], [1.8, -5.2]], '#c6ad76', .6);
    }
    if (appearance.hair === 'braid') {
      const x = back ? 0 : 3.8;
      for (let i = 0; i < 5; i++) {
        const y = 2.4 + i * 1.6;
        shape([[x - 1.4, y], [x + .2, y - .5], [x + 1.6, y + .5], [x + .2, y + 2], [x - 1.3, y + 1.2]], i % 2 ? hair.shadow : hair.base);
        stroke([[x - .9, y + .3], [x + .3, y + 1.1]], hair.light, .4);
      }
      stroke([[x - .9, 10.8], [x + 1, 10.8]], '#c6ad76', .75);
    }
  }
  if (!covered && appearance.accessory === 'hoop') {
    const x = side > .2 ? 3.8 : -3.8;
    stroke([[x, 1.6], [x - .9, 2.4], [x - .7, 4.1], [x + .5, 4.5], [x + 1.2, 3.4], [x + .8, 2.1], [x, 1.6]], '#dcbb72', .65);
  }
  if (!back && !covered && appearance.accessory === 'circlet') {
    stroke([[-3.7, -.4], [-1.8, -.1], [look, .4], [2.1, -.1], [3.7, -.8]], '#839ca2', 1.1);
    stroke([[-3.7, -.6], [look, .1], [3.7, -1]], '#d5dcca', .45);
    shape([[look, -.8], [look + .7, .2], [look, 1.3], [look - .7, .2]], '#abd2d5');
  }
  if (!back && appearance.accessory === 'eyepatch') {
    stroke([[-3.4, -.8], [3.7, 1.5]], '#292b31', .65);
    shape([[-2.5 + look, .55], [-.6 + look, .55], [-.6 + look, 1.9], [-1.7 + look, 2.3], [-2.5 + look, 1.6]], '#20282e');
    stroke([[-2.2 + look, .8], [-.9 + look, .8]], '#677574', .35);
  }
  return shapes;
}
