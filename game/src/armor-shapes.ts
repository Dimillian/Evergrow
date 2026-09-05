import type { ArmorPiece } from './art-types.ts';
import type { Point } from './art-primitives.ts';
import type { GearShape } from './weapon-shapes.ts';

type ArmorShapeKind = 'head' | 'chest' | 'shoulder';
const fill = (points: readonly Point[], color: string): GearShape => ({ points, fill: color });
const line = (points: readonly Point[], color: string, width = .6): GearShape => ({ points, stroke: color, width });

/** The armory icon and the dressed character use the same forged plates. Coordinates
 * are local to a piece's mount; the articulated rig still owns every attachment. */
export function armorShapes(kind: ArmorShapeKind, piece: ArmorPiece, facing = Math.PI / 2): GearShape[] {
  const { base, shadow, edge, trim } = piece.material;
  const plate = piece.style === 'plate';
  if (kind === 'head') {
    const back = Math.sin(facing) < -.16;
    const face = Math.cos(facing) * 1.15;
    const shapes: GearShape[] = [
      fill(back ? [[-4.7, 2.3], [-4.8, -1.1], [-3.5, -4.1], [-.5, -5.7], [2.6, -4.7], [4.5, -1.7], [4.8, 2.6], [3.4, 4.5], [-3.4, 4.5]]
        : [[-4.7, 2.3], [-4.8, -1.1], [-3.5, -4.1], [-.5, -5.7], [2.6, -4.7], [4.5, -1.7], [4.8, 2.6], [3.4, 4.5], [2.4, 4.5], [2.8, .5], [-2.7, .5], [-2.4, 4.5], [-3.8, 4.2]], shadow),
      fill([[-4.1, .1], [-4.2, -1.3], [-3.1, -3.9], [-.6, -5], [2.2, -4.2], [3.8, -1.7], [3.8, .3], [.2, 1.4]], base),
      fill([[-4.2, -.4], [-4.2, -1.3], [-3.1, -3.9], [-1.1, -4.7], [-1.3, -.6]], edge),
      fill([[.1, -4.9], [2.2, -4.2], [3.8, -1.7], [3.8, .3], [1.1, -.6]], shadow),
      line([[-3.1, -4], [-.6, -5.1], [2.2, -4.3]], edge, .55),
    ];
    if (plate) {
      shapes.push(fill([[-.5, -6.1], [.8, -5.9], [1.1, -.6], [.2, .4], [-.8, -.3]], trim),
        line([[-.3, -5.5], [.1, -1]], edge, .65));
      if (!back) {
        // An open sallet: deep brow, cheek plates, then a visible jaw below.
        shapes.push(fill([[-4.5, .1], [-2.7 + face * .3, .3], [-2.2 + face * .5, 3.9], [-3.3, 5], [-4.3, 3.7]], base),
          fill([[2.8 + face * .2, .1], [4.3, .3], [4, 3.8], [2.7, 5], [2.3 + face * .2, 3.7]], shadow),
          line([[-4.1, .5], [-3.4, 3.7], [-2.8, 4.3]], edge, .65),
          line([[-4.3, -.2], [-1.1 + face, .2], [3.8, -.3]], trim, .7),
          fill([[-3.6, 1.1], [-3, 1.1], [-2.9, 1.7], [-3.5, 1.7]], trim));
      } else {
        shapes.push(fill([[-3.8, .9], [3.8, .9], [4.5, 3.7], [2.8, 5.7], [-2.5, 5.7], [-4.4, 3.8]], base),
          line([[-3.5, 2.8], [0, 3.8], [3.5, 2.8]], shadow, .8),
          line([[-3.8, 3.7], [0, 4.9], [3.6, 3.6]], edge, .65));
      }
    } else {
      shapes.push(line([[-2.4, -3.3], [-2.8, -1.2], [-2, .1]], trim, .55),
        line([[2.5, -2.7], [3.1, -.2], [2.7, 3]], trim, .55),
        fill([[-4.2, .6], [-3.2, 1], [-2.5, 4.5], [-3.8, 3.5]], base));
      if (back) shapes.push(fill([[-3.6, .2], [3.6, .2], [3.4, 4.3], [0, 5.2], [-3.4, 4.2]], base),
        line([[-2.8, 3], [0, 4.1], [2.8, 3]], trim, .65));
    }
    return shapes;
  }
  if (kind === 'shoulder') {
    const flare = plate ? 1 : 0;
    return [
      fill([[-1.8, -1.8], [-.1, -3.1], [2.2, -2.6], [4.5 + flare, -.5], [4.9, 2.1], [3.6, 4], [.6, 4.4], [-1.3, 2]], shadow),
      fill([[-1.2, -1.5], [.1, -2.5], [2.1, -2], [4.2 + flare * .5, -.3], [4.1, 1.3], [.7, 2.2], [-1.1, .7]], base),
      fill([[-1.2, -1.5], [.1, -2.5], [2.1, -2], [4.2 + flare * .5, -.3], [.4, -.7]], edge),
      line([[.2, 2], [3.9, 1.1]], trim, .65),
      fill([[.7, 3], [4.1, 2.4], [3.4, 4.3], [1.2, 4.8]], base),
      line([[1.3, 4], [3.4, 3.6]], edge, .6),
      fill([[.6, -.9], [1.4, -.6], [1.1, .2], [.3, -.1]], trim),
    ];
  }
  const shapes: GearShape[] = [
    fill([[-6, -5.9], [-3, -7.2], [-1.4, -5.8], [1.5, -5.8], [3.1, -7.2], [5.9, -5.7], [5.6, 1.8], [3.8, 5.5], [0, 6.6], [-4.3, 5.1], [-5.7, 1.5]], shadow),
    fill([[-5, -5.5], [-3, -6.4], [-1.2, -4.9], [1.2, -4.9], [3.1, -6.4], [4.8, -5.3], [4.8, .6], [3, 4.4], [.1, 5.7], [-3.6, 4.3], [-4.9, .8]], base),
    fill([[-5, -5.5], [-3, -6.4], [-1.2, -4.9], [-.5, -2.4], [-1.3, 2.7], [-3.6, 4.3], [-4.9, .8]], edge),
    fill([[1.2, -4.9], [3.1, -6.4], [4.8, -5.3], [4.8, .6], [3, 4.4], [.1, 5.7], [1, .8]], shadow),
    line([[-4.8, -5.4], [-3.1, -6.3], [-1.3, -4.9], [1.3, -4.9], [3.1, -6.3], [4.7, -5.2]], trim, .65),
  ];
  if (plate) {
    // A broad polished bevel and small chased marks survive the world resolution.
    shapes.push(fill([[-4.7, -4.6], [-3.4, -5.3], [-2.6, -3], [-3.1, 1.9], [-4.2, .9]], edge),
      line([[-3.7, -4.8], [-3.2, -3.8]], trim, .7),
      line([[2.7, -3.8], [3.8, -3.1]], base, .65));
    for (let mark = 0; mark < 3; mark++) {
      const y = -1.4 + mark * 1.4, x = 2.3 + ((piece.seed + mark) % 3) * .25;
      shapes.push(line([[x, y], [x + .7, y - .45]], edge, .4));
    }
    shapes.push(line([[-4.3, -2.4], [-1.1, -1.6], [0, -.6], [1.2, -1.6], [4, -2.4]], shadow, .85),
      line([[-4, -3], [-1.4, -2.5]], edge, .6),
      fill([[-.7, -3.5], [0, -4.5], [.8, -3.5], [.4, 2.8], [0, 4.6], [-.6, 2.9]], base),
      line([[0, -3.7], [0, 3.4]], edge, .65),
      fill([[-1, -3.8], [0, -4.8], [1, -3.8], [0, -2.8]], trim));
  } else {
    shapes.push(fill([[-4, -5.7], [-2.9, -6], [4.2, 3.2], [3.3, 4.2]], shadow),
      line([[-3.8, -5.5], [3.9, 3.5]], trim, .6),
      fill([[.8, -.4], [2.4, 1.1], [1.4, 2.1], [-.2, .6]], trim));
    for (let row = 0; row < 4; row++) shapes.push(line([[-3.7, -3.4 + row * 1.8], [-2.9, -3.1 + row * 1.8]], shadow, .55));
  }
  for (let band = 0; band < 3; band++) {
    const y = 4.7 + band * 1.55;
    shapes.push(fill([[-4.7, y], [0, y + 1.3], [4.5, y], [4.2, y + 1.6], [0, y + 2.6], [-4.3, y + 1.6]], band === 1 ? base : shadow),
      line([[-4.3, y + .3], [0, y + 1.55], [4.1, y + .3]], edge, .55));
  }
  return shapes;
}
