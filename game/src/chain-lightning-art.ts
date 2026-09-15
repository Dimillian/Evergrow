import { line, type Point } from './art-primitives.ts';
import { drawGlow, type PointLight } from './lighting.ts';

export interface LightningLink {
  points: Point[]; life: number; max: number; color: string; travel: number; seed: number;
}
export function lightningHead(link: LightningLink): Point {
  const progress = link.travel ? Math.min(1, (link.max - link.life) / link.travel) : 1;
  const at = Math.max(0, progress) * (link.points.length - 1), i = Math.min(link.points.length - 2, Math.floor(at));
  const t = at - i, a = link.points[i], b = link.points[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
export function lightningLight(link: LightningLink): PointLight {
  const [x, y] = lightningHead(link), fading = Math.min(1, link.life / Math.max(.01, link.max - link.travel));
  return { x, y, radius: 108, color: '#a5baff', power: .8 * fading };
}
/** A short ionized trail, growing leader, forked filaments and bounded sparks; no full-screen flash. */
export function drawLightning(c: CanvasRenderingContext2D, link: LightningLink, reducedMotion: boolean): void {
  const age = link.max - link.life, progress = link.travel ? Math.min(1, age / link.travel) : 1;
  const fade = Math.min(1, link.life / Math.max(.01, link.max - link.travel));
  const head = lightningHead(link), end = Math.floor(progress * (link.points.length - 1));
  const points: Point[] = [...link.points.slice(0, end + 1), head];
  // Reduced motion retains the readable arrival, but suppresses restless branching and flying debris.
  c.globalAlpha = fade * .12; line(c, points, '#667ee8', 13);
  c.globalAlpha = fade * .4; line(c, points, link.color, 5);
  c.globalAlpha = fade * .95; line(c, points, '#c5e3ff', 2.1);
  c.globalAlpha = fade; line(c, points, '#f4fcff', .85);
  if (!reducedMotion) {
    for (let i = 2; i < points.length - 1; i += 3) {
      const p = points[i], phase = link.seed * 2.7 + i * 1.9;
      const length = 7 + Math.sin(phase) * 4, a = phase + Math.sin(age * 12 + i) * .3;
      c.globalAlpha = fade * .48;
      line(c, [p, [p[0] + Math.cos(a) * length, p[1] + Math.sin(a) * length],
        [p[0] + Math.cos(a + .8) * length * 1.7, p[1] + Math.sin(a + .8) * length * 1.7]], '#9bbcff', .8);
    }
    for (let i = 0; i < 9; i++) {
      const phase = (age * 2.4 + i / 9) % 1;
      const a = link.seed + i * 2.399, r = phase * (progress < 1 ? 13 : 27);
      const x = head[0] + Math.cos(a) * r, y = head[1] + Math.sin(a) * r;
      c.globalAlpha = fade * (1 - phase) * .85;
      line(c, [[x,y],[x-Math.cos(a)*3,y-Math.sin(a)*3]], i % 3 ? '#bcecff' : '#b1a0ff', 1);
    }
  }
  c.globalAlpha = 1;
  drawGlow(c, head[0], head[1], reducedMotion ? 12 : 21, '#8faeff', fade * .8);
  c.globalAlpha = fade;
  line(c, [[head[0]-3,head[1]],[head[0]+3,head[1]]], '#f4fcff', 1.5);
  line(c, [[head[0],head[1]-4],[head[0],head[1]+4]], '#f4fcff', 1);
  if (progress === 1) {
    const impact = Math.max(0, age - link.travel), radius = reducedMotion ? 7 : 4 + impact * 39;
    c.globalAlpha = fade * .45; c.strokeStyle = '#b7cfff'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(head[0], head[1], radius, radius * .62, 0, 0, Math.PI * 2); c.stroke();
  }
}
