import type { CombatEvent, ProjectileStyle } from './model.ts';
import type { PointLight } from './lighting.ts';
import { drawGlow } from './lighting.ts';
import { line, polygon, type Point } from './art-primitives.ts';
import { PROJECTILE_COLORS } from './projectile-art.ts';

interface Area {
  x: number; y: number; radius: number; life: number; max: number; color: string;
  style: ProjectileStyle; kind: 'blast' | 'ground' | 'block'; seed: number;
}
interface Link { points: Point[]; life: number; max: number; color: string; style: ProjectileStyle; }
const TAU = Math.PI * 2;
const bounds = (v: number | undefined, low: number, high: number, fallback: number) =>
  Number.isFinite(v) ? Math.max(low, Math.min(high, v!)) : fallback;

/** Bounded presentation of confirmed blasts, chains, shield blocks and ground casts. */
export class SkillEffects {
  private areas: Area[] = [];
  private links: Link[] = [];
  private sequence = 0;

  reset(): void { this.areas = []; this.links = []; this.sequence = 0; }

  handle(event: CombatEvent): void {
    const style = event.style ?? 'arcane', color = event.color ?? PROJECTILE_COLORS[style];
    if (event.type === 'chain' && Number.isFinite(event.toX) && Number.isFinite(event.toY)) {
      const dx = event.toX - event.x, dy = event.toY - event.y, distance = Math.max(1, Math.hypot(dx, dy));
      const steps = Math.max(3, Math.min(16, Math.ceil(distance / 13)));
      const points: Point[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, offset = i === 0 || i === steps ? 0 : (Math.random() - .5) * (style === 'arrow' ? 3 : 20);
        points.push([event.x + dx * t - dy / distance * offset, event.y + dy * t + dx / distance * offset - 16]);
      }
      const max = bounds(event.duration, .05, 8, style === 'arrow' ? .18 : .28);
      this.links.push({ points, life: max, max, color, style });
      if (this.links.length > 24) this.links.shift();
    }
    if (event.type === 'blast' || event.type === 'ground' || event.type === 'block') {
      const max = event.type === 'ground' ? bounds(event.duration, .15, 8, 1.2) : event.type === 'block' ? .32 : style === 'frost' ? .7 : .56;
      this.areas.push({ x: event.x, y: event.y, radius: event.type === 'block' ? 22 : bounds(event.radius, 8, 250, 55),
        life: max, max, style, color, kind: event.type, seed: this.sequence++ });
      if (this.areas.length > 20) this.areas.shift();
    }
  }

  update(dt: number): void {
    for (const area of this.areas) area.life -= dt;
    for (const link of this.links) link.life -= dt;
    this.areas = this.areas.filter(area => area.life > 0);
    this.links = this.links.filter(link => link.life > 0);
  }

  getLights(): PointLight[] {
    return this.areas.filter(area => area.kind !== 'ground').slice(-3).map(area => ({
      x: area.x, y: area.y - 12, radius: Math.max(65, area.radius * 2.1), color: area.color, power: area.life / area.max * .95,
    }));
  }

  draw(c: CanvasRenderingContext2D): void {
    c.save();
    for (const area of this.areas) this.drawArea(c, area);
    c.globalCompositeOperation = 'lighter';
    for (const link of this.links) {
      const life = Math.max(0, link.life / link.max);
      c.globalAlpha = life * .35;
      line(c, link.points, link.color, link.style === 'arrow' ? 3 : 8);
      c.globalAlpha = life;
      line(c, link.points, link.color, link.style === 'arrow' ? 1.2 : 2.8);
      line(c, link.points, '#edfbff', .9);
      if (link.style !== 'arrow') for (let i = 2; i < link.points.length - 1; i += 3) {
        const point = link.points[i], sign = i % 2 ? -1 : 1;
        line(c, [point, [point[0] + sign * 6, point[1] - 9], [point[0] + sign * 2, point[1] - 18]], link.color, .7);
      }
    }
    c.restore();
  }

  private drawArea(c: CanvasRenderingContext2D, area: Area): void {
    const life = Math.max(0, area.life / area.max), progress = 1 - life;
    c.save(); c.translate(area.x, area.y);
    if (area.kind === 'block') {
      c.translate(0, -22); c.globalCompositeOperation = 'lighter'; c.globalAlpha = life;
      c.strokeStyle = '#d1f1f1'; c.lineWidth = 1.6 * life;
      c.beginPath(); c.arc(0, 0, area.radius * (.8 + progress * .4), -Math.PI * .85, -Math.PI * .15); c.stroke();
      polygon(c, [[0, -10], [8, -6], [6, 4], [0, 10], [-6, 4], [-8, -6]], '#568a9d');
      line(c, [[0, -6], [0, 5]], '#e4faff', 1.3);
      c.restore(); return;
    }
    if (area.kind === 'ground') {
      c.globalAlpha = .23 * Math.min(1, progress * 6) * Math.min(1, life * 8);
      c.fillStyle = area.color; c.beginPath(); c.ellipse(0, 0, area.radius, area.radius * .62, 0, 0, TAU); c.fill();
      c.globalAlpha = .64 * Math.min(1, life * 8); c.strokeStyle = area.color; c.lineWidth = 1;
      c.beginPath(); c.ellipse(0, 0, area.radius, area.radius * .62, 0, 0, TAU); c.stroke();
      for (let i = 0; i < 12; i++) {
        const angle = i / 12 * TAU, r = area.radius * .9;
        line(c, [[Math.cos(angle) * r, Math.sin(angle) * r * .62], [Math.cos(angle) * (r + 5), Math.sin(angle) * (r + 5) * .62]], area.color, .8);
      }
      if (area.style === 'arrow') for (let i = 0; i < 8; i++) {
        const cycle = (progress * 6 + i * .137) % 1, angle = i * 2.4 + area.seed, r = Math.sqrt((i + .5) / 8) * area.radius * .8;
        const x = Math.cos(angle) * r, y = Math.sin(angle) * r * .62;
        c.globalAlpha = Math.sin(cycle * Math.PI) * .7;
        line(c, [[x - (1 - cycle) * 18, y - (1 - cycle) * 80], [x, y]], '#cadbb8', 1);
      }
      c.restore(); return;
    }
    const radius = area.radius * (1 - Math.pow(life, 3));
    c.globalCompositeOperation = 'lighter';
    drawGlow(c, 0, -8, area.radius * .85, area.color, life * .8);
    c.globalAlpha = life * .65; c.strokeStyle = area.color;
    c.lineWidth = 1 + life * (area.style === 'fire' ? 8 : 3);
    c.beginPath(); c.ellipse(0, -5, radius, radius * .7, 0, 0, TAU); c.stroke();
    if (area.style === 'fire') {
      for (let i = 0; i < 14; i++) {
        const angle = i / 14 * TAU + area.seed * .7, r = radius * (.7 + Math.sin(i * 3) * .2);
        const x = Math.cos(angle) * r, y = Math.sin(angle) * r * .65 - 10;
        c.globalAlpha = life * .7;
        polygon(c, [[x - 5 * life, y], [x - 2, y - 9 * life], [x + Math.sin(i) * 7, y - 26 * life], [x + 5 * life, y - 4], [x + 6 * life, y]], i % 3 ? '#e96e2b' : '#f7be5e');
      }
      c.globalAlpha = Math.pow(life, 4);
      c.fillStyle = '#fff5cd'; c.beginPath(); c.ellipse(0, -10, Math.max(1, radius * .6), Math.max(1, radius * .36), 0, 0, TAU); c.fill();
    } else if (area.style === 'frost') {
      for (let i = 0; i < 20; i++) {
        const angle = i / 20 * TAU + area.seed * .21, r = radius * (.7 + (i % 3) * .12);
        const x = Math.cos(angle) * r, y = Math.sin(angle) * r * .7 - 5, size = (8 + i % 4 * 3) * Math.sin(progress * Math.PI);
        c.save(); c.translate(x, y); c.rotate(angle + Math.PI / 2); c.globalAlpha = life;
        polygon(c, [[0, -size], [size * .25, 0], [0, size * .2], [-size * .25, 0]], '#84c6e9');
        line(c, [[0, -size], [0, size * .15]], '#e2fbff', .8); c.restore();
      }
    } else {
      for (let i = 0; i < 10; i++) {
        const angle = i / 10 * TAU + area.seed, inner = radius * .55;
        c.globalAlpha = life * .8;
        line(c, [[Math.cos(angle) * inner, Math.sin(angle) * inner * .7 - 5],
          [Math.cos(angle + .08) * radius * .82, Math.sin(angle + .08) * radius * .82 * .7 - 5],
          [Math.cos(angle) * radius, Math.sin(angle) * radius * .7 - 5]], area.color, 1.2);
      }
    }
    c.restore();
  }
}
