import type { Attack, Player } from './model.ts';
import { getActiveSwingOffset } from './attack-motion.ts';
import { line, polygon, type Point } from './art-primitives.ts';

interface Sweep {
  attack: Attack; x: number; y: number; progress: number; fade: number;
  reach: number; arc: number; angle: number; hand: 'main' | 'off';
  skill: 'cleave' | 'whirlwind'; color: string;
}
const AFTERIMAGE = .24;
/** The same angular progression and outer reach as swept combat, in world coordinates. */
export function skillSweepPoint(angle: number, arc: number, hand: 'main' | 'off', progress: number, reach: number): Point {
  const yaw = angle + getActiveSwingOffset(progress, arc, hand);
  return [Math.cos(yaw) * reach, Math.sin(yaw) * reach];
}

/** Skill reach is an energy blade beyond the actual metal blade; basic attacks retain their ribbon. */
export class SkillMeleeArt {
  private sweeps: Sweep[] = [];
  private dashes: Array<{ x: number; y: number; angle: number; radius: number; life: number }> = [];
  reset(): void { this.sweeps = []; this.dashes = []; }
  update(p: Player, dt: number, alpha = 1): void {
    for (const dash of this.dashes) dash.life -= dt;
    if (p.dash && Math.hypot(p.x-p.prevX,p.y-p.prevY)>0) this.dashes.push({ x:p.x,y:p.y,angle:p.dash.angle,radius:p.dash.radius,life:.18 });
    this.dashes = this.dashes.filter(d=>d.life>0).slice(-24);
    for (const sweep of this.sweeps) sweep.fade -= dt;
    const attack = p.attack;
    if (attack?.kind === 'melee' && (attack.skill === 'cleave' || attack.skill === 'whirlwind')
      && attack.elapsed >= attack.activeStart && attack.elapsed <= attack.activeEnd) {
      let sweep = this.sweeps.find(s => s.attack === attack);
      if (!sweep) {
        sweep = { attack, skill: attack.skill, x: p.x, y: p.y, progress: 0, fade: AFTERIMAGE,
          reach: attack.range, arc: attack.arc, angle: attack.angle, hand: attack.hand,
          color: attack.specialization?.endsWith('-force') ? '#ffc078' : attack.specialization?.endsWith('-reach') ? '#ffe4a8' : '#eec274' };
        this.sweeps.push(sweep);
      }
      sweep.x = p.prevX + (p.x - p.prevX) * alpha;
      sweep.y = p.prevY + (p.y - p.prevY) * alpha;
      sweep.progress = Math.max(0, Math.min(1, (attack.elapsed - attack.activeStart) / (attack.activeEnd - attack.activeStart)));
      sweep.fade = AFTERIMAGE;
    }
    for (const sweep of this.sweeps) if (sweep.progress < 1 && sweep.attack.elapsed >= sweep.attack.activeEnd) {
      sweep.progress = 1; sweep.fade = AFTERIMAGE;
    }
    this.sweeps = this.sweeps.filter(s => s.fade > 0).slice(-6);
  }
  draw(c: CanvasRenderingContext2D, reduced: boolean): void {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const d of this.dashes) {
      const width = d.radius * .5;
      c.save(); c.translate(d.x,d.y-14); c.rotate(d.angle); c.globalAlpha = d.life/.18*.5;
      polygon(c, [[-22,-width],[4,0],[-22,width],[-14,0]], '#b7ead8'); c.restore();
    }
    for (const s of this.sweeps) {
      const life = Math.min(1, s.fade / AFTERIMAGE), end = s.progress;
      const tail = s.skill === 'cleave' ? .46 : .38;
      const start = Math.max(0, end - tail), count = 32;
      if (end <= start) continue;
      c.save(); c.translate(s.x, s.y - 12);
      const outer: Point[] = [], inner: Point[] = [], edge: Point[] = [];
      for (let i = 0; i <= count; i++) {
        const t = i / count, progress = start + (end - start) * t;
        const taper = Math.sin(Math.PI * t) ** .65;
        const spread = reduced ? 0 : (1 - life) * 5;
        outer.push(skillSweepPoint(s.angle, s.arc, s.hand, progress, s.reach + spread));
        inner.push(skillSweepPoint(s.angle, s.arc, s.hand, progress, s.reach * (1 - .25 * taper * life)));
        edge.push(skillSweepPoint(s.angle, s.arc, s.hand, progress, s.reach * (1 - .025 * taper)));
      }
      c.globalAlpha = life * .15; line(c, outer, s.color, 13);
      c.globalAlpha = life * .62; polygon(c, [...outer, ...inner.reverse()], s.color);
      c.globalAlpha = life * .95; line(c, edge, '#fff1ce', 1.8);
      // A second, tighter wake separates Whirlwind's revolving steel from the broad Cleave.
      if (s.skill === 'whirlwind') {
        const wake = outer.map(([x,y]): Point => [x * .72, y * .72]);
        c.globalAlpha = life * .45; line(c, wake, '#d6e6df', 2.2);
      }
      for (let i = 0; i < 9; i++) {
        const t = (i + .5) / 9, progress = start + (end - start) * t;
        const [x,y] = skillSweepPoint(s.angle, s.arc, s.hand, progress, s.reach * (.82 + i % 3 * .055));
        const scatter = reduced ? 0 : (1 - life) * (8 + i % 4 * 4);
        c.globalAlpha = life * (1 - t) * .7;
        line(c, [[x,y], [x + Math.cos(i * 2.4) * scatter, y - 3 - scatter]], '#ffe2a0', 1.2);
      }
      c.restore();
    }
    c.restore();
  }
}
