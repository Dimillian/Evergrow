import { line, polygon } from './art-primitives.ts';
import { RADIANT_COLORS as INK } from './radiant-content.ts';

/** The same broken, engraved seal belongs to the book, release and confirmed impact. */
export function drawRadiantSeal(c: CanvasRenderingContext2D, radius: number, width = 1): void {
  c.strokeStyle = INK.gold; c.lineWidth = width;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    c.beginPath(); c.ellipse(0, 0, radius, radius, 0, a + .18, a + 1.18); c.stroke();
    line(c, [[Math.cos(a) * radius * .82, Math.sin(a) * radius * .82],
      [Math.cos(a) * radius * 1.12, Math.sin(a) * radius * 1.12]], INK.light, width * .8);
  }
  const r = radius * .62;
  line(c, [[0, -r], [r, 0], [0, r], [-r, 0], [0, -r]], INK.light, width * .65);
}

/** Local projectile space: restrained ribbons, a pointed ivory core, no flame plume. */
export function drawRadiantBolt(c: CanvasRenderingContext2D, radius: number, wake: number, time: number): void {
  c.save(); c.globalCompositeOperation = 'lighter';
  const tail = 44 * wake, bend = Math.sin(time * 5) * 1.2;
  c.globalAlpha *= .45;
  for (const side of [-1, 1]) {
    c.fillStyle = INK.gold;
    c.beginPath(); c.moveTo(2, side * 1.4);
    c.quadraticCurveTo(-tail * .42, side * 4.5 + bend, -tail, side * 2);
    c.quadraticCurveTo(-tail * .4, side * 2 + bend, 2, 0); c.fill();
  }
  c.globalAlpha /= .45;
  polygon(c, [[radius + 8, 0], [-3, -2.6], [-tail * .72, 0], [-3, 2.6]], INK.light);
  polygon(c, [[radius + 7, 0], [-2, -1], [-13 * wake, 0], [-2, 1]], INK.core);
  line(c, [[-5, -4], [-3, 0], [-5, 4]], INK.gold, .7);
  // Two small, fading script fragments stay inside the short wake.
  c.globalAlpha *= .4 * wake;
  for (let i = 0; i < 2; i++) {
    const x = -(19 + i * 14) * wake, y = (i ? -1 : 1) * (3 + bend);
    line(c, [[x - 2, y], [x, y - 1.5], [x + 2, y]], INK.light, .7);
  }
  c.restore();
}
