import type { CombatEvent, ProjectileStyle } from './model.ts';
import type { PointLight } from './lighting.ts';
import { drawGlow } from './lighting.ts';
import { line, polygon, type Point } from './art-primitives.ts';
import { PROJECTILE_COLORS } from './projectile-art.ts';

interface Area {
  x: number; y: number; radius: number; life: number; max: number; color: string;
  style: ProjectileStyle; kind: 'blast' | 'block'; seed: number; meteor: boolean; earth: boolean;
}
interface Link { points: Point[]; life: number; max: number; color: string; style: ProjectileStyle; }
const TAU = Math.PI * 2;
const bounds = (v: number | undefined, low: number, high: number, fallback: number) =>
  Number.isFinite(v) ? Math.max(low, Math.min(high, v!)) : fallback;

/** Bounded presentation of confirmed blasts, chains, shield blocks and ground casts. */
export class SkillEffects {
  private areas: Area[] = [];
  private links: Link[] = [];
  private strikes: Array<Extract<CombatEvent, { type: 'skill-strike' }> & { life: number }> = [];
  private sequence = 0;

  reset(): void { this.areas = []; this.links = []; this.strikes = []; this.sequence = 0; }

  handle(event: CombatEvent): void {
    if (event.type === 'skill-strike') { this.strikes.push({ ...event, life: .35 }); this.strikes = this.strikes.slice(-12); }
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
    if (event.type === 'blast' || event.type === 'block') {
      const meteor = event.type === 'blast' && event.groundKind === 'meteor';
      const max = meteor ? 1.15 : event.type === 'block' ? .32 : style === 'frost' ? .7 : .56;
      this.areas.push({ x: event.x, y: event.y, radius: event.type === 'block' ? 22 : bounds(event.radius, 8, 512, 55),
        life: max, max, style, color, kind: event.type, meteor, earth: event.skill === 'earthshatter', seed: this.sequence++ });
      if (this.areas.length > 20) this.areas.shift();
    }
  }

  update(dt: number): void {
    for (const strike of this.strikes) strike.life -= dt;
    this.strikes = this.strikes.filter(s => s.life > 0);
    for (const area of this.areas) area.life -= dt;
    for (const link of this.links) link.life -= dt;
    this.areas = this.areas.filter(area => area.life > 0);
    this.links = this.links.filter(link => link.life > 0);
  }

  getLights(): PointLight[] {
    return this.areas.slice(-3).map(area => ({
      x: area.x, y: area.y - 12, radius: Math.max(65, area.radius * 2.1), color: area.color, power: area.life / area.max * .95,
    }));
  }

  draw(c: CanvasRenderingContext2D, reducedMotion = false): void {
    c.save();
    for (const area of this.areas) this.drawArea(c, area, reducedMotion);
    c.globalCompositeOperation = 'lighter';
    for (const strike of this.strikes) this.drawStrike(c, strike, reducedMotion);
    for (const link of this.links) {
      const life = Math.max(0, link.life / link.max);
      if (link.style === 'spirit') {
        c.globalAlpha = life * .4; line(c, link.points, '#84e4b6', 3);
        const at = Math.min(link.points.length - 1, Math.floor((reducedMotion ? .5 : 1 - life) * link.points.length));
        const [x,y] = link.points[at]; drawGlow(c, x, y, 18, '#a6ffc8', life);
        c.globalAlpha = life; polygon(c, [[x-3,y],[x,y-6],[x+3,y],[x,y+3]], '#ddffeb');
        continue;
      }
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

  private drawStrike(c: CanvasRenderingContext2D, s: Extract<CombatEvent, { type: 'skill-strike' }> & { life: number }, reduced: boolean): void {
    const life = s.life / .35;
    c.save(); c.translate(s.x, s.y - 14); c.rotate(s.angle);
    if (s.skill === 'shieldBash' || s.skill === 'repulse') {
      const radius = s.range * (reduced ? 1 : .9 + (1 - life) * .1);
      c.globalAlpha = life * .25;
      c.fillStyle = '#a4e0da'; c.beginPath(); c.moveTo(0,0); c.arc(0,0,radius,-s.arc/2,s.arc/2); c.closePath(); c.fill();
      c.globalAlpha = life; c.strokeStyle = '#dbf7e9'; c.lineWidth = 2.5;
      c.beginPath(); c.arc(0,0,radius,-s.arc/2,s.arc/2); c.stroke();
      polygon(c, [[20,-12],[31,-8],[30,8],[20,16],[13,7],[13,-8]], '#c5dacc');
    } else {
      const width = s.rear ? 9 : 5;
      c.globalAlpha = life * .55;
      polygon(c, [[5,-width],[s.range*.65,-width*.5],[s.range,0],[s.range*.65,width*.5],[5,width]], s.rear ? '#ffc6ed' : '#b7e3d1');
      c.globalAlpha = life; line(c, [[8,0],[s.range,0]], '#f0ffdf', 1.6);
      if (s.rear) {
        c.translate(s.range,0); c.rotate(-s.angle); c.globalAlpha = life;
        line(c, [[-9,-9],[9,9]], '#fff0cc', 2); line(c, [[-9,9],[9,-9]], '#ffcae6', 2);
      }
    }
    c.restore();
  }

  private drawArea(c: CanvasRenderingContext2D, area: Area, reducedMotion: boolean): void {
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
    if (area.earth) {
      c.globalAlpha = life * .9;
      for (let i = 0; i < 11; i++) {
        const a = i / 11 * TAU + area.seed * .7;
        const points: Point[] = Array.from({ length: 5 }, (_,j) => {
          const r = area.radius * j / 4, bend = Math.sin(i * 7 + j * 3) * .12;
          return [Math.cos(a + bend) * r, Math.sin(a + bend) * r];
        });
        line(c, points, '#3b2920', 5 * life + 1);
        line(c, points, '#efbc7c', 1.6 * life);
      }
      c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#e8c5a0'; c.lineWidth = 5 * life;
      c.beginPath(); c.arc(0,0,area.radius * (reducedMotion ? 1 : .65 + progress * .35),0,TAU); c.stroke();
      c.restore(); return;
    }
    if (area.meteor) {
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = life * .22; c.fillStyle = '#292321';
      c.beginPath(); c.arc(0, 0, area.radius * (.65 + progress * .35), 0, TAU); c.fill();
      c.globalCompositeOperation = 'lighter';
      // Rolling pressure front and tall flame crown, not another persistent damage pulse.
      const spread = reducedMotion ? .8 : 1 - Math.pow(life, 4);
      c.strokeStyle = '#ffc77e'; c.lineWidth = 2 + life * 10; c.globalAlpha = life * .55;
      c.beginPath(); c.arc(0, 0, area.radius * spread, 0, TAU); c.stroke();
      for (let i = 0; i < 11; i++) {
        const x = Math.sin(i * 2.4) * area.radius * spread * .65;
        const y = Math.cos(i * 2.4) * area.radius * spread * .35;
        const height = reducedMotion ? 15 : (35 + i % 4 * 17) * Math.sin(Math.PI * Math.min(1, progress * 1.5));
        c.globalAlpha = life * .5;
        polygon(c, [[x - 10 * life, y], [x - 7, y - height * .5], [x + 3, y - height], [x + 12 * life, y]], i % 2 ? '#ff853d' : '#ffce79');
      }
    }
    const radius = area.radius * (reducedMotion ? 1 : 1 - Math.pow(life, 3));
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
