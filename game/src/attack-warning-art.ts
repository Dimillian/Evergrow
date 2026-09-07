import { drawGlow } from './lighting.ts';
import { line } from './art-primitives.ts';

export type WarningShape = { kind: 'circle'; radius: number }
  | { kind: 'sector'; radius: number; arc: number }
  | { kind: 'lane'; length: number; width: number };
const TAU = Math.PI * 2;
function outline(c: CanvasRenderingContext2D, shape: WarningShape, scale = 1): void {
  c.beginPath();
  if (shape.kind === 'lane') c.rect(0, -shape.width, shape.length * scale, shape.width * 2);
  else if (shape.kind === 'circle') c.arc(0, 0, shape.radius * scale, 0, TAU);
  else { c.moveTo(0, 0); c.arc(0, 0, shape.radius * scale, -shape.arc / 2, shape.arc / 2); c.closePath(); }
}
/** Stable true contact boundary, with gathering material/light inside it. No hit geometry lives here. */
export function drawAttackWarning(c: CanvasRenderingContext2D, shape: WarningShape, progress: number,
  color: string, time: number, reducedMotion = false, locked = true): void {
  const t = Math.max(0, Math.min(1, progress)), reach = shape.kind === 'lane' ? shape.length : shape.radius;
  const phase = reducedMotion ? .6 : (time * .65) % 1;
  c.save();
  outline(c, shape); c.save(); c.clip();
  const wash = c.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, reach));
  wash.addColorStop(0, color + '00'); wash.addColorStop(.65, color + '08'); wash.addColorStop(1, color + '32');
  c.fillStyle = wash; c.fillRect(-reach, -reach, reach * 2, reach * 2);
  c.globalCompositeOperation = 'lighter';
  // Two soft moving fronts communicate the approach to contact without blinking the edge.
  for (let i = 0; i < 2; i++) {
    const flow = (phase + i * .5) % 1;
    c.globalAlpha = reducedMotion ? .13 : Math.sin(flow * Math.PI) * (.13 + t * .24);
    c.strokeStyle = color; c.lineWidth = 4;
    outline(c, shape, shape.kind === 'circle' ? 1 - flow * .65 : .2 + flow * .8); c.stroke();
  }
  c.globalAlpha = .28 + t * .35;
  for (let i = 0; i < 12; i++) {
    const f = reducedMotion ? .5 : (time * .42 + i * .173) % 1;
    if (shape.kind === 'lane') {
      const x = (1 - f) * shape.length, y = Math.sin(i * 12.3) * shape.width * .75;
      line(c, [[x, y], [x + 5 + t * 6, y]], color, .7);
    } else {
      const angle = shape.kind === 'circle' ? i * 2.39996 : (i / 11 - .5) * shape.arc;
      const r = shape.radius * (.45 + f * .55);
      line(c, [[Math.cos(angle) * r, Math.sin(angle) * r], [Math.cos(angle) * (r - 4), Math.sin(angle) * (r - 4)]], color, .8);
    }
  }
  c.restore();
  // Broad dim rim + fine hot edge replace flat filled polygons/dashed target circles.
  outline(c, shape); c.strokeStyle = color; c.globalAlpha = .08 + t * .12; c.lineWidth = 6; c.stroke();
  c.globalAlpha = (locked ? .52 : .32) + t * .32; c.lineWidth = 1.1; c.stroke();
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = .55;
  c.strokeStyle = '#fff0d6'; c.lineWidth = 1;
  if (shape.kind === 'circle') { c.beginPath(); c.arc(0, 0, reach - 3, -Math.PI / 2, -Math.PI / 2 + TAU * t); c.stroke(); }
  else { outline(c, shape, .22 + t * .78); c.stroke(); }
  drawGlow(c, 0, 0, Math.min(30, reach * .3), color, .12 + t * .18);
  c.restore();
}
