import type { ShieldDefinition, WeaponVisual } from './model.ts';
import type { Point } from './art-primitives.ts';

export interface GearShape { points: readonly Point[]; fill?: string; stroke?: string; width?: number; }
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const poly = (points: readonly Point[], fill: string): GearShape => ({ points, fill });
const stroke = (points: readonly Point[], color: string, width = .7): GearShape => ({ points, stroke: color, width });
const gem = (x: number, y: number, rx: number, ry: number): Point[] => [[x - rx, y], [x, y - ry], [x + rx, y], [x, y + ry]];

/** The string and the support-hand anchor consume exactly the same draw offset. */
export const bowStringOffset = (draw: number) => -5 - clamp(draw, 0, 1) * 11;

/** Shared procedural silhouettes for worn weapons and inventory icons. +X is the attack direction. */
export function weaponShapes(visual: WeaponVisual, draw = 0): GearShape[] {
  if (visual.kind === 'unarmed') return [];
  const length = clamp(visual.length, 8, 60), half = Math.max(.7, visual.width * .5);
  const grip = clamp(visual.gripLength ?? 12, 6, 22), shapes: GearShape[] = [];
  if (visual.kind === 'bow') {
    const span = length * .64, curve: Point[] = [], edge: Point[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = -1 + i / 10, y = span * t;
      const x = 2 + 8 * (1 - t * t) - Math.cos(t * Math.PI) * 3 + Math.sin(Math.abs(t) * Math.PI * 2) * (visual.width >= 15 ? 2.2 : .6);
      curve.push([x, y]); edge.push([x + 1.2, y]);
    }
    const limbWidth = clamp(visual.width * .19, 2, 3.4);
    shapes.push(stroke(curve, '#192830', limbWidth + 1.1), stroke(curve, visual.grip, limbWidth), stroke(edge, visual.edge, .7));
    shapes.push(stroke([[2, -span], [bowStringOffset(draw), 0], [2, span]], '#d4d8c4', .55));
    shapes.push(poly([[-1.8, -4], [7, -4], [7, 4], [-1.8, 4]], visual.grip));
    for (let i = -3; i <= 3; i += 1.5) shapes.push(stroke([[0, i], [5.5, i + .5]], visual.guard, .65));
    shapes.push(poly(gem(3, -span + 2, 2.2, 3), visual.guard), poly(gem(3, span - 2, 2.2, 3), visual.guard));
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
    shapes.push(poly([[3, -broad], [length * .77, -broad * .66], [length, 0], [length * .77, broad * .68], [3, broad]], visual.metal));
    shapes.push(poly([[3, -broad], [length * .77, -broad * .66], [length, 0], [4, -.15]], visual.edge));
    shapes.push(stroke([[5, .3], [length * .74, .3]], '#456664', .55));
    const guard = Math.max(3.6, broad * 2.4);
    shapes.push(poly([[.5, -guard + .8], [2.5, -guard], [4, -guard + 1.2], [3.8, guard - 1], [2, guard], [.8, guard - .4]], visual.guard));
    shapes.push(stroke([[1, -guard + 1], [2.5, -guard + .7], [3, guard - 1]], visual.edge, .55));
  } else if (visual.kind === 'axe') {
    const head = length * .68, blade = 7 + half * 1.6;
    shapes.push(poly([[head - 3, -3], [head - 7, -blade], [length - 1, -blade + 1], [length + 2, -blade * .25], [length - 2, -1], [head + 2, 2]], visual.metal));
    shapes.push(poly([[head - 7, -blade], [length - 1, -blade + 1], [length + 2, -blade * .25], [length - 2, -1], [length - 1, -blade + 3], [head - 5, -blade + 2]], visual.edge));
    shapes.push(stroke([[head - 2, -3], [length - 4, -blade + 4]], visual.guard, .8));
    if (length > 31) {
      shapes.push(poly([[head - 3, 3], [head - 6, blade * .7], [length - 1, blade * .75], [length + 1, blade * .2], [length - 2, 1]], visual.metal));
      shapes.push(stroke([[head - 6, blade * .7], [length - 1, blade * .75], [length + 1, blade * .2]], visual.edge, 1));
    } else shapes.push(poly([[head, 0], [head - 1, 5], [length - 2, 2], [length - 3, 0]], visual.guard));
    shapes.push(poly(gem(head, 0, 2.5, 2), visual.guard));
  } else if (visual.kind === 'mace') {
    const head = length - 6, breadth = 5 + half * 1.15;
    shapes.push(poly([[head - 5, -breadth], [head + 5, -breadth], [length + 1, -breadth + 3], [length + 1, breadth - 3], [head + 5, breadth], [head - 5, breadth], [head - 7, breadth - 3], [head - 7, -breadth + 3]], visual.metal));
    shapes.push(poly([[head - 5, -breadth], [head + 5, -breadth], [length + 1, -breadth + 3], [head - 4, -breadth + 3]], visual.edge));
    for (const y of [-breadth + 2, 0, breadth - 2]) shapes.push(stroke([[head - 5, y], [length, y]], y === 0 ? visual.guard : '#3e5656', y === 0 ? 2 : .8));
    shapes.push(poly(gem(head + 1, 0, 2.5, 2.5), visual.guard));
  } else if (visual.kind === 'staff') {
    const head = length - 5, glow = visual.glow ?? '#bda0f1';
    shapes.push(stroke([[-grip - 5, -1], [head - 7, -1]], visual.edge, .7));
    if (visual.element === 'fire') {
      shapes.push(poly([[head - 8, -2], [head - 4, -8], [head + 1, -9], [head - 1, -4], [head + 2, -6], [length + 5, -3], [head + 5, -2],
        [length + 7, 0], [head + 5, 2], [length + 3, 5], [head + 1, 4], [head - 2, 8], [head - 6, 6], [head - 8, 2]], visual.guard));
      shapes.push(poly([[head - 4, 0], [head + 1, -5], [head + 3, -2], [length + 3, 0], [head + 3, 2], [head, 5]], glow));
      shapes.push(poly([[head - 1, 0], [head + 3, -2], [length + 1, 0], [head + 2, 2]], '#ffe8a1'));
    } else if (visual.element === 'frost') {
      shapes.push(poly([[head - 8, -2], [head - 5, -7], [head - 2, -4], [head - 4, 0], [head - 2, 4], [head - 5, 7], [head - 8, 2]], visual.guard));
      shapes.push(poly([[head - 5, 0], [head + 1, -5], [length + 8, 0], [head + 1, 5]], glow));
      shapes.push(poly([[head - 5, 0], [head + 1, -5], [length + 8, 0], [head + 1, -.5]], '#dcfbff'));
      shapes.push(poly([[head - 2, -3], [head - 1, -10], [head + 5, -4]], '#9cdce9'));
      shapes.push(poly([[head - 2, 3], [head + 2, 9], [head + 5, 4]], '#78b9d7'));
      shapes.push(stroke([[head - 5, 0], [length + 7, 0]], visual.edge, .7));
    } else if (visual.element === 'lightning') {
      shapes.push(poly([[head - 8, -2], [head - 5, -9], [head + 3, -10], [length + 4, -6], [head + 3, -7], [head - 3, -6], [head - 4, 0],
        [head - 3, 6], [head + 3, 7], [length + 4, 6], [head + 3, 10], [head - 5, 9], [head - 8, 2]], visual.guard));
      shapes.push(poly([[head + 1, -6], [head - 1, 0], [head + 3, -1], [head + 1, 6], [length + 6, -2], [head + 5, 0], [head + 8, -5]], glow));
      shapes.push(stroke([[head + 1, -5], [head, -1], [head + 5, -2], [head + 2, 5]], '#f5f0ff', .8));
    } else {
      shapes.push(poly([[head - 8, -2], [head - 5, -7], [head + 2, -8], [length + 2, -3], [head + 3, -5], [head - 3, -4], [head - 5, 0], [head - 3, 4], [head + 3, 5], [length + 2, 3], [head + 2, 8], [head - 5, 7], [head - 8, 2]], visual.guard));
      shapes.push(poly(gem(head + 1, 0, 6, 4.2), glow));
      shapes.push(poly([[head - 5, 0], [head + 1, -4.2], [head + 2, 0], [head + 1, 4.2]], visual.edge));
    }
    for (let mark = 2; mark < head - 8; mark += 6) shapes.push(stroke([[mark, -2], [mark + 2, 0], [mark, 2]], glow, .7));
  }
  shapes.push(poly([[-grip - 2, -1.1], [-grip - .5, -2], [-grip + .8, -.8], [-grip + .8, .8], [-grip - .5, 2], [-grip - 2, 1]], visual.guard));
  if (visual.glow && visual.kind !== 'staff') shapes.push(stroke([[Math.max(5, length * .35), -half], [length * .8, -half * .6], [length, 0]], visual.glow, .6));
  return shapes;
}

/** Shields face the viewer; wrist attachment remains centered behind their boss. */
export function shieldShapes(visual: ShieldDefinition['visual']): GearShape[] {
  const edge: Point[] = visual.kind === 'buckler'
    ? Array.from({ length: 12 }, (_, i): Point => [Math.cos(i * Math.PI / 6) * 8.8, Math.sin(i * Math.PI / 6) * 9.5])
    : visual.kind === 'tower' ? [[-7, -11], [0, -13], [7, -11], [8, 9], [4, 12], [-4, 12], [-8, 9]]
      : [[0, -11], [8, -8], [7, 4], [0, 14], [-7, 4], [-8, -8]];
  const inner = edge.map(([x, y]): Point => [x * .78, y * .82]);
  return [poly(edge, visual.shadow), stroke([...edge, edge[0]], visual.edge, 1.2), poly(inner, visual.base),
    stroke([[0, -8], [0, 10]], visual.trim, 1.1), stroke([[-5, -3], [0, -1], [5, -3]], visual.edge, .8),
    poly(gem(0, 0, 3.6, 4), visual.trim), poly(gem(-.5, -.5, 1.8, 2.3), visual.edge),
    ...[[-5, -6], [5, -6], [-4, 5], [4, 5]].map(([x, y]) => poly(gem(x, y, .7, .7), visual.trim))];
}

/** SVG and Canvas use these same points, keeping icons faithful to equipped silhouettes. */
export function gearShapesSVG(shapes: readonly GearShape[]): string {
  const color = (value: string) => /^#[a-f0-9]{6}$/i.test(value) ? value : '#829487';
  return shapes.map(shape => `<${shape.fill ? 'polygon' : 'polyline'} points="${shape.points.map(p => p.map(v => Math.round(v * 100) / 100).join(',')).join(' ')}" fill="${shape.fill ? color(shape.fill) : 'none'}"${shape.stroke ? ` stroke="${color(shape.stroke)}" stroke-width="${shape.width ?? .7}" stroke-linejoin="round" stroke-linecap="round"` : ''}/>`).join('');
}
