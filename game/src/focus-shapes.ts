import type { FocusDefinition } from './model.ts';
import { gearShapeColor, type GearShape } from './weapon-shapes.ts';
import { mixColor as mixRGB, type Point } from './art-primitives.ts';

const mixColor = (from: string, to: string, amount: number) => gearShapeColor(mixRGB(from, to, amount));
const TAU = Math.PI * 2;
const ring = (x: number, y: number, rx: number, ry = rx, start = 0, end = TAU, tilt = 0): Point[] =>
  Array.from({ length: 33 }, (_, i) => {
    const phase = start + (end - start) * i / 32, u = Math.cos(phase) * rx, v = Math.sin(phase) * ry;
    return [x + u * Math.cos(tilt) - v * Math.sin(tilt), y + u * Math.sin(tilt) + v * Math.cos(tilt)];
  });

/** Decorated covers face outward; an open book's reading surface faces its owner.
 * Orbs float above the palm. All motion stays inside the same bounded silhouette. */
export function focusShapes(v: FocusDefinition['visual'], time = 0, facing = Math.PI / 2): GearShape[] {
  const shapes: GearShape[] = [];
  const fill = (points: readonly Point[], fill: string) => shapes.push({ points, fill });
  const line = (points: readonly Point[], stroke: string, width = .6, fine = false) => shapes.push({ points, stroke, width, fine });
  const diamond = (x: number, y: number, r: number): Point[] => [[x, y - r], [x + r * .7, y], [x, y + r], [x - r * .7, y]];
  if (v.kind === 'grimoire') {
    const leather = mixColor(v.base, v.shadow, .65), inset = mixColor(v.shadow, '#0b1122', .4);
    // A single, thick leather cover, angled toward the caster. Only the page
    // block at its fore-edge is visible, never a spread facing the viewer.
    fill([[-5.8, -12.4], [3.8, -14], [6.1, -12], [5.1, .8], [-4.9, 3], [-6.1, 1.4]], v.shadow);
    fill([[4.1, -12.8], [5.4, -11.6], [4.7, .6], [-4.7, 2.5], [-4.5, 1.1], [3.8, -.8]], '#b8b39e');
    line([[4.7, -11.8], [4.3, .1], [-3.6, 1.8]], '#ece2c4', .4);
    fill([[-5.8, -12.4], [3.8, -14], [4.8, -12.6], [3.9, .2], [-5.3, 2], [-6.1, .8]], leather);
    fill([[-3.6, -11.1], [2.1, -12.2], [2.8, -1.5], [-3.9, -.2]], inset);
    line([[-4.6, -11.8], [3, -13.1], [3.6, -.5], [-4.6, 1], [-4.6, -11.8]], v.trim, .42);
    line([[-5.6, -11.7], [-5.4, .7]], mixColor(v.base, v.edge, .3), .55);
    for (const y of [-10.4, -6.5, -2.6]) line([[-5.9, y], [-4.7, y + .3]], v.trim, .8);
    // Metal corner guards frame a restrained illuminated seal.
    for (const [x, y, sx, sy] of [[-4.5, -11.7, 1, 1], [2.9, -13, -1, 1], [-4.5, .6, 1, -1], [3.4, -.5, -1, -1]]) {
      fill([[x, y], [x + sx * 1.6, y + sy * .1], [x + sx * .65, y + sy * .6], [x, y + sy * 1.8]], v.trim);
      line([[x, y + sy * 1.3], [x, y], [x + sx * 1.1, y]], v.edge, .3);
    }
    const cx = -.5, cy = -6;
    line(ring(cx, cy, 2.4, 3), v.trim, .38);
    line(diamond(cx, cy, 3.8).concat([[cx, cy - 3.8]]), mixColor(v.trim, v.glow, .45), .38);
    fill(diamond(cx, cy, 1.9), mixColor(v.glow, v.shadow, .5));
    line(diamond(cx, cy, 1.7).concat([[cx, cy - 1.7]]), v.glow, .6);
    if (v.motif === 'ember') line([[cx - .5, cy + .7], [cx + .5, cy], [cx, cy - 1]], '#fff0c6', .45);
    else if (v.motif === 'rime') {
      line([[cx, cy - 1.1], [cx, cy + 1.1]], '#e4faff', .45);
      line([[cx - .75, cy - .4], [cx + .75, cy + .4]], v.glow, .4);
    } else fill(diamond(cx, cy, .65), '#f0e4ff');
    for (const y of [-10.4, -2.1]) line([[-1.7, y], [-.7, y - .4], [.2, y], [1, y - .3]], v.trim, .35, true);
    fill([[3, -6.9], [5, -7.2], [5, -5.5], [3, -5.3]], v.trim);
    fill([[3.4, -6.6], [4.5, -6.7], [4.5, -5.8], [3.4, -5.7]], v.shadow);
    fill([[.9, 1.2], [2, 1], [2.4, 4.2], [1.6, 3.6], [1, 4.3]], mixColor(v.glow, v.shadow, .45));
    // The cover narrows continuously in side views instead of staying billboard-flat.
    const width = .62 + .38 * Math.abs(Math.sin(facing)), skew = Math.cos(facing) * .12;
    return shapes.map(shape => ({ ...shape, points: shape.points.map(([x, y]): Point => [x * width + y * skew, y]) }));
  }

  const cy = -8.8 + Math.sin(time * 1.6) * .35, r = 3.8;
  const tilt = -.5 + Math.sin(time * .65) * .16;
  // Thin orbital traces behind the glass, with a gap between the focus and palm.
  line(ring(0, cy, 6.3, 2.1, Math.PI, TAU, tilt), mixColor(v.glow, v.shadow, .55), .4);
  line(ring(0, cy, 5.1, 4.8, .2, 2.9, -tilt), mixColor(v.trim, v.shadow, .4), .3);
  fill(ring(0, cy, r + .4), mixColor(v.glow, '#071523', .8));
  // Nested pigment layers form round luminous glass in both Canvas and SVG;
  // no large triangular facets or solid metal cage interrupt the sphere.
  for (let i = 0; i < 16; i++) {
    const t = i / 15, radius = r * (1 - t * .84);
    const color = mixColor(mixColor(v.glow, '#112238', .72), v.glow, t * .88);
    fill(ring(-t * .6, cy - t * .7, radius), color);
  }
  line(ring(0, cy, r, r, 3.55, 5.35), mixColor(v.glow, '#f1f8ff', .5), .4);
  line(ring(0, cy, 3.2, 1.1, .15 + time * .35, 2.6 + time * .35, .65), mixColor(v.glow, '#dceeff', .45), .42);
  line(ring(-.2, cy, 2.3, 1.3, 3.3 - time * .25, 5.8 - time * .25, -.5), v.glow, .45);
  const core = v.motif === 'ember' ? '#ffe9af' : v.motif === 'rime' ? '#dfffff' : '#f3ddff';
  fill(diamond(-.4, cy - .35, 1.25), mixColor(v.glow, core, .45));
  fill(diamond(-.4, cy - .35, .65), core);
  line([[-2.4, cy - 1.1], [-2.1, cy - 2], [-1.3, cy - 2.4]], '#e8f6ff', .55);
  line(ring(0, cy, 6.3, 2.1, 0, Math.PI, tilt), mixColor(v.glow, v.edge, .25), .4);
  for (let i = 0; i < 3; i++) {
    const phase = time * .55 + i * TAU / 3;
    const x = Math.cos(phase) * 6.3, y = Math.sin(phase) * 2.1;
    const px = x * Math.cos(tilt) - y * Math.sin(tilt), py = cy + x * Math.sin(tilt) + y * Math.cos(tilt);
    line([[px - .55, py], [px, py - .65], [px + .55, py], [px, py + .65]], v.glow, .35);
  }
  // A faint suspended sigil directly above the open palm anchors the levitation.
  line([[-1.8, -1.2], [0, -1.8], [1.8, -1.2], [0, -.65], [-1.8, -1.2]], mixColor(v.glow, v.shadow, .3), .35);
  return shapes;
}
