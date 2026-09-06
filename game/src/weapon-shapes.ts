import type { ShieldDefinition, WeaponVisual } from './model.ts';
import { mixColor, type Point } from './art-primitives.ts';

export interface GearShape { points: readonly Point[]; fill?: string; stroke?: string; width?: number; fine?: boolean; }
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const poly = (points: readonly Point[], fill: string): GearShape => ({ points, fill });
const stroke = (points: readonly Point[], color: string, width = .7): GearShape => ({ points, stroke: color, width });
const gem = (x: number, y: number, rx: number, ry: number): Point[] => [[x - rx, y], [x, y - ry], [x + rx, y], [x, y + ry]];

/** Staff proportions fit a walking-staff carry; held effects share this tip. */
export const weaponArtLength = (visual: WeaponVisual) => clamp(visual.length, 8, 60) * (visual.kind === 'staff' ? .82 : 1);

/** The string and the support-hand anchor consume exactly the same draw offset. */
export const bowStringOffset = (draw: number) => -5 - clamp(draw, 0, 1) * 11;

/** Shared procedural silhouettes for worn weapons and inventory icons. +X is the attack direction. */
export function weaponShapes(visual: WeaponVisual, draw = 0): GearShape[] {
  if (visual.kind === 'unarmed') return [];
  const length = weaponArtLength(visual), half = Math.max(.7, visual.width * .5);
  const grip = clamp(visual.gripLength ?? 12, 6, visual.kind === 'staff' ? 13 : 22), shapes: GearShape[] = [];
  if (visual.kind === 'bow') {
    const span = length * .64, tipX = -3 - clamp(draw, 0, 1) * 2, curve: Point[] = [], edge: Point[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = -1 + i / 10, y = span * t;
      const x = tipX * t * t + Math.sin(Math.abs(t) * Math.PI) * 3
        + Math.sin(Math.abs(t) * Math.PI * 2) * (visual.width >= 15 ? 2.2 : .6);
      curve.push([x, y]); edge.push([x + 1.2, y]);
    }
    const limbWidth = clamp(visual.width * .19, 2, 3.4);
    shapes.push(stroke(curve, '#192830', limbWidth + 1.1), stroke(curve, visual.grip, limbWidth), stroke(edge, visual.edge, .7));
    shapes.push(stroke([[tipX, -span], [bowStringOffset(draw), 0], [tipX, span]], '#d4d8c4', .45));
    shapes.push(poly([[-1.2, -3.2], [2.8, -3], [3.1, 0], [2.8, 3], [-1.2, 3.2]], visual.grip));
    for (let i = -2.5; i <= 2.5; i += 1.25) shapes.push(stroke([[-.6, i], [2.6, i + .3]], mixColor(visual.grip, visual.guard, .5), .4));
    shapes.push(poly(gem(tipX + .5, -span + 1, .7, 1.2), visual.guard), poly(gem(tipX + .5, span - 1, .7, 1.2), visual.guard));
    shapes.push(stroke(curve.map(([x, y]) => [x - .8, y] as Point), mixColor(visual.grip, '#080f16', .5), .65));
    if (draw > .05) {
      const nock = bowStringOffset(draw), tip = nock + 30;
      shapes.push(stroke([[nock, 0], [tip, 0]], '#bdab7d', 1));
      shapes.push(poly([[tip - 1, -2], [tip + 6, 0], [tip - 1, 2]], visual.edge));
      shapes.push(poly([[nock, 0], [nock - 3, -3], [nock + 2, -2], [nock + 5, 0]], '#a7c6b7'));
      shapes.push(poly([[nock, 0], [nock - 3, 3], [nock + 2, 2], [nock + 5, 0]], '#627f7d'));
    }
    return shapes;
  }
  shapes.push(poly([[-grip, -1.35], [length * .8, -1.35], [length * .8, 1.35], [-grip, 1.35]], visual.grip));
  const wrappedEnd = visual.kind === 'sword' || visual.kind === 'dagger' ? 1 : length * .5;
  for (let wrap = -grip + 1; wrap < wrappedEnd; wrap += 2) shapes.push(stroke([[wrap, -1.2], [wrap + .8, 1.2]], visual.guard, .45));
  if (visual.kind === 'sword' || visual.kind === 'dagger') {
    const broad = visual.kind === 'dagger' ? half * 1.4 : half;
    shapes.push(poly([[3, -broad], [length * .77, -broad * .66], [length, 0], [length * .77, broad * .68], [3, broad]], '#233b43'));
    shapes.push(poly([[3.5, -broad * .73], [length * .77, -broad * .43], [length, 0], [length * .77, broad * .48], [3.5, broad * .8]], visual.metal));
    shapes.push(poly([[3, -broad], [length * .77, -broad * .66], [length, 0], [length * .76, -broad * .34], [4, -.15]], visual.edge));
    shapes.push(poly([[5, .25], [length * .77, 0], [length * .69, broad * .35], [5, broad * .52]], '#476572'));
    shapes.push(stroke([[6, -.1], [length * .7, -.1]], visual.edge, .35));
    const guard = Math.max(3.6, broad * 2.4);
    const dagger = visual.kind === 'dagger';
    shapes.push(poly(dagger
      ? [[.1, -guard + 1], [1.5, -guard], [3.5, -guard + 1], [3.5, guard - 1], [1.5, guard], [.1, guard - 1]]
      : [[-.5, -guard], [1.4, -guard - .8], [3.1, -guard + .4], [3.3, -1.6], [4.7, 0], [3.3, 1.6], [3.1, guard - .4], [1.4, guard + .8], [-.5, guard], [1, guard - 1.4], [1, -guard + 1.4]], visual.guard));
    shapes.push(stroke([[.1, -guard + .2], [1.5, -guard + .1], [2.1, -2.2], [3.8, 0], [2.1, 2.2]], visual.edge, .55));
    shapes.push(poly(gem(1.8, 0, 1.6, 1.3), '#344e56'), poly(gem(1.5, -.2, .65, .6), visual.edge));
    if (!dagger) shapes.push(stroke([[5.5, -broad * .55], [8, -.25], [5.5, broad * .55]], visual.guard, .45));
  } else if (visual.kind === 'axe') {
    const head = length * .68, blade = 5.8 + half * .85;
    shapes.push(poly([[head - 3, -3], [head - 7, -blade], [length - 1, -blade + 1], [length + 2, -blade * .25], [length - 2, -1], [head + 2, 2]], visual.metal));
    shapes.push(poly([[head - 7, -blade], [length - 1, -blade + 1], [length + 2, -blade * .25], [length - 2, -1], [length - 1, -blade + 3], [head - 5, -blade + 2]], visual.edge));
    shapes.push(stroke([[head - 2, -3], [length - 4, -blade + 4]], visual.guard, .8));
    shapes.push(poly([[head - 3, -4], [head - 4, -blade + 3], [length - 5, -blade + 4], [length - 3, -4], [head + 1, -2]], '#39515a'));
    shapes.push(stroke([[head - 1, -5], [head - 2, -blade + 5], [length - 6, -blade + 5]], visual.metal, 1.1));
    shapes.push(poly(gem(length - 5, -blade * .55, 1.3, 1.7), visual.guard));
    if (length > 31) {
      shapes.push(poly([[head - 3, 3], [head - 6, blade * .7], [length - 1, blade * .75], [length + 1, blade * .2], [length - 2, 1]], visual.metal));
      shapes.push(stroke([[head - 6, blade * .7], [length - 1, blade * .75], [length + 1, blade * .2]], visual.edge, 1));
    } else shapes.push(poly([[head, 0], [head - 1, 5], [length - 2, 2], [length - 3, 0]], visual.guard));
    shapes.push(poly(gem(head, 0, 2.5, 2), visual.guard));
  } else if (visual.kind === 'mace') {
    const head = length - 6, breadth = 4 + half * .75;
    shapes.push(poly([[head - 5, -breadth], [head + 5, -breadth], [length + 1, -breadth + 3], [length + 1, breadth - 3], [head + 5, breadth], [head - 5, breadth], [head - 7, breadth - 3], [head - 7, -breadth + 3]], visual.metal));
    shapes.push(poly([[head - 5, -breadth], [head + 5, -breadth], [length + 1, -breadth + 3], [head - 4, -breadth + 3]], visual.edge));
    for (const y of [-breadth + 2, 0, breadth - 2]) {
      shapes.push(poly([[head - 6, y], [head - 3, y - 1.3], [length - 1, y - 1.3], [length + 2, y], [length - 1, y + 1.5], [head - 3, y + 1.5]], y === 0 ? visual.guard : '#3e5656'));
      shapes.push(stroke([[head - 3, y - 1.2], [length - 1, y - 1.2], [length + 1, y]], visual.edge, .55));
    }
    shapes.push(poly(gem(head + 1, 0, 2.5, 2.5), visual.guard));
  } else if (visual.kind === 'staff') {
    const head = length - 4, glow = visual.glow ?? '#a99acf';
    const iron = mixColor(visual.metal, '#121c28', .72), lit = mixColor(visual.metal, '#bdc7cc', .25);
    // Tapered wood, recessed bindings and a small forged cage around an elemental core.
    shapes.push(poly([[-grip, -.9], [head - 6, -1.6], [head - 6, 1.4], [-grip, 1]], visual.grip));
    shapes.push(stroke([[-grip, -.8], [head - 7, -1.1]], mixColor(visual.grip, '#e2d2af', .3), .45));
    shapes.push(stroke([[-grip + 2, .6], [head - 6, .8]], mixColor(visual.grip, '#0a1217', .5), .5));
    for (const x of [-grip + 1, -5, 1, head - 8]) {
      shapes.push(poly([[x, -1.7], [x + 1.3, -1.7], [x + 1.3, 1.7], [x, 1.7]], iron),
        stroke([[x, -1.7], [x + 1.3, -1.7]], lit, .4));
    }
    shapes.push(poly([[head - 9, -2], [head - 5, -3], [head + 1, -6], [length + 3, -3.8],
      [head + 1, -4.2], [head - 3, -1.5], [head - 3, 1.5], [head + 1, 4.2], [length + 3, 3.8],
      [head + 1, 6], [head - 5, 3], [head - 9, 2]], iron));
    shapes.push(stroke([[head - 8, -1.8], [head - 4, -2.2], [head + 1, -5], [length + 2, -3.8]], lit, .65));
    shapes.push(stroke([[head - 5, 2.8], [head + 1, 5.4], [length + 2, 4.1]], visual.guard, .45));
    if (visual.element === 'fire') {
      shapes.push(poly([[head - 2, 0], [head + 1, -2.8], [length + 2, -.8], [length + 1, 1.6], [head + 1, 2.8]], '#783d38'),
        poly([[head - 1, 0], [head + 1, -2], [length + 1, -.7], [head + 2, 1.6]], glow),
        poly([[head + 1, -.8], [length, -.4], [head + 2, .8]], '#ffe0a0'));
    } else if (visual.element === 'frost') {
      shapes.push(poly([[head - 2, 0], [head + 2, -3.2], [length + 4, 0], [head + 2, 3.2]], glow),
        poly([[head - 2, 0], [head + 2, -3.2], [length + 4, 0], [head + 2, -.4]], '#d9eff0'),
        poly([[head + 2, -.4], [length + 4, 0], [head + 2, 3.2]], '#5989b0'));
    } else {
      shapes.push(poly(gem(head + 3, 0, 4, 3), glow),
        poly([[head - 1, 0], [head + 3, -3], [head + 2, .2]], '#ddd6f5'),
        poly([[head + 2, .2], [head + 3, 3], [head + 7, 0]], '#6863ab'));
    }
    shapes.push(poly(gem(head - 6, 0, 1.3, 1.7), visual.guard));
    for (let mark = 6; mark < head - 10; mark += 8) shapes.push({ ...stroke([[mark, -.6], [mark + 1.1, 0], [mark, .6]], lit, .28), fine: true });
  }
  const pommel: Point[] = [[-2, -.7], [-1.1, -1.7], [.2, -1.4], [.8, -.6], [.8, .6], [.2, 1.4], [-1.1, 1.7], [-2, .7]];
  shapes.push(poly(pommel.map(([x, y]) => [x - grip, y]), mixColor(visual.guard, '#23313a', .25)));
  shapes.push(stroke([[-grip - 1.6, -.5], [-grip - 1, -1.2], [-grip + .1, -.9]], visual.edge, .35));
  if (visual.glow && visual.kind !== 'staff') shapes.push(stroke([[Math.max(5, length * .35), -half], [length * .8, -half * .6], [length, 0]], visual.glow, .6));
  if (visual.kind !== 'staff') {
    const dark = mixColor(visual.metal, '#101b24', .65);
    for (let i = 0; i < 3; i++) {
      const x = length * (.32 + i * .16);
      shapes.push({ ...stroke([[x, -.2], [x + .9, -.55]], dark, .25), fine: true });
    }
    for (let wrap = -grip + 1; wrap < -1; wrap += 2) {
      shapes.push(stroke([[wrap, -.9], [wrap + .5, .8]], mixColor(visual.grip, '#172027', .55), .35));
    }
  }
  return shapes;
}

/** Shields face the viewer; wrist attachment remains centered behind their boss. */
export function shieldShapes(visual: ShieldDefinition['visual']): GearShape[] {
  const edge: Point[] = visual.kind === 'buckler'
    ? Array.from({ length: 12 }, (_, i): Point => [Math.cos(i * Math.PI / 6) * 8.8, Math.sin(i * Math.PI / 6) * 9.5])
    : visual.kind === 'tower' ? [[-7, -11], [0, -13], [7, -11], [8, 9], [4, 12], [-4, 12], [-8, 9]]
      : [[0, -11], [8, -8], [7, 4], [0, 14], [-7, 4], [-8, -8]];
  const inner = edge.map(([x, y]): Point => [x * .79, y * .84]);
  const shapes = [poly(edge, '#172832'), stroke([...edge, edge[0]], visual.edge, 1.3),
    poly(inner, visual.base), stroke([...inner, inner[0]], visual.trim, .65),
    poly([[0, -9], [5.7, -6.5], [5.7, 3.5], [0, visual.kind === 'buckler' ? 7.5 : 10.8]], visual.shadow),
    stroke([[-5.8, -6.4], [-6.1, 0], [-4.4, 4]], visual.edge, .65)];
  if (visual.kind === 'buckler') {
    const ring = Array.from({ length: 13 }, (_, i): Point => [Math.cos(i * Math.PI / 6) * 5.4, Math.sin(i * Math.PI / 6) * 5.8]);
    shapes.push(stroke(ring, visual.shadow, 1.3), stroke(ring, visual.trim, .6));
    for (let spoke = 0; spoke < 8; spoke++) {
      const angle = spoke * Math.PI / 4;
      shapes.push(stroke([[Math.cos(angle) * 4.6, Math.sin(angle) * 4.8], [Math.cos(angle) * 6.6, Math.sin(angle) * 7]], visual.trim, .65));
    }
    shapes.push(poly([[-3.3, 0], [-2.1, -2.8], [.2, -3.4], [2.7, -1.8], [3.3, .7], [1.2, 3], [-1.7, 2.6]], visual.shadow),
      poly([[-2.7, -.5], [-1.7, -2.3], [.2, -2.7], [2.2, -1.3], [1.1, .6], [-1.1, 1.2]], visual.edge));
  } else if (visual.kind === 'kite') {
    // A split heraldic wing follows the shield ridge instead of a generic cross.
    shapes.push(stroke([[0, -8.7], [0, 10.8]], visual.edge, .9),
      poly([[-.8, -2.4], [-5, -6.3], [-4.8, -2.1], [-2.2, -.2], [-4.4, -.8], [-3.1, 2.7], [-.8, 4.1]], visual.trim),
      poly([[.8, -2.4], [5, -6.3], [4.8, -2.1], [2.2, -.2], [4.4, -.8], [3.1, 2.7], [.8, 4.1]], visual.trim),
      poly(gem(0, -2, 1.9, 2.5), visual.shadow), poly(gem(-.3, -2.4, 1, 1.6), visual.edge));
  } else {
    shapes.push(stroke([[-4.9, 7.5], [-4.9, -6], [0, -9.7], [4.9, -6], [4.9, 7.5]], visual.trim, 1),
      stroke([[-2.9, 6], [-2.9, -4.8], [0, -7.3], [2.9, -4.8], [2.9, 6]], visual.edge, .6),
      poly([[0, -4.2], [1.8, -1.4], [.8, .3], [1.3, 5.7], [0, 8.8], [-1.3, 5.7], [-.8, .3], [-1.8, -1.4]], visual.trim),
      poly(gem(-.2, -1.1, .8, 1.7), visual.edge));
  }
  for (const [x, y] of [[-5, -6], [5, -6], [-4, 5], [4, 5]]) shapes.push(poly(gem(x, y, .7, .7), visual.trim));
  return shapes;
}

/** SVG and Canvas use these same points, keeping icons faithful to equipped silhouettes. */
export function gearShapesSVG(shapes: readonly GearShape[], fine = true): string {
  const color = (value: string) => /^#[a-f0-9]{6}$/i.test(value) ? value : '#829487';
  return shapes.filter(shape => fine || !shape.fine).map(shape => `<${shape.fill ? 'polygon' : 'polyline'} points="${shape.points.map(p => p.map(v => Math.round(v * 100) / 100).join(',')).join(' ')}" fill="${shape.fill ? color(shape.fill) : 'none'}"${shape.stroke ? ` stroke="${color(shape.stroke)}" stroke-width="${shape.width ?? .7}" stroke-linejoin="round" stroke-linecap="round"` : ''}/>`).join('');
}
