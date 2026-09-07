import type { CombatEvent } from './model.ts';
import { siteHash } from './wilderness-sites.ts';

type BreakEvent = Extract<CombatEvent, { type: 'container-break' }>;
export type ContainerRemains = BreakEvent & { age: number };
export const CONTAINER_DEBRIS_LIMIT = 32;
/** Bounded, presentation-only splinters. Exact destruction lives in the save, not these remains. */
export class ContainerDebris {
  readonly remains: ContainerRemains[] = [];
  handle(event: CombatEvent): void {
    if (event.type !== 'container-break') return;
    this.remains.push({ ...event, age: 0 });
    if (this.remains.length > CONTAINER_DEBRIS_LIMIT) this.remains.shift();
  }
  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (let i = this.remains.length - 1; i >= 0; i--) {
      this.remains[i].age += dt;
      if (this.remains[i].age >= 6.5) this.remains.splice(i, 1);
    }
  }
  reset(): void { this.remains.length = 0; }
}
export function drawContainerDebris(c: CanvasRenderingContext2D, remains: ContainerRemains, reducedMotion: boolean): void {
  const age = reducedMotion ? Math.max(1, remains.age) : remains.age;
  const fade = Math.min(1, Math.max(0, (6.5 - remains.age) / 2));
  const random = (i: number) => siteHash(remains.seed, i, 57191) / 0x100000000;
  c.save(); c.translate(remains.x, remains.y); c.globalAlpha *= fade;
  if (!reducedMotion && age < .65) {
    c.save(); c.globalAlpha *= (1 - age / .65) * .25; c.fillStyle = '#baaa87';
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      c.beginPath(); c.ellipse(Math.cos(a) * age * 36, Math.sin(a) * age * 16 - 5,
        3 + age * 16, 2 + age * 8, a, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  for (let i = 0; i < 14; i++) {
    const direction = i * 2.39996 + random(i) * .5;
    const flight = .32 + random(i + 20) * .3, t = Math.min(age / flight, 1);
    const travel = (1 - Math.pow(1 - t, 2)) * (13 + random(i + 40) * 29);
    const x = Math.cos(direction) * travel + Math.cos(remains.angle) * t * 9;
    const y = Math.sin(direction) * travel * .6 + Math.sin(remains.angle) * t * 7;
    const height = age < flight ? 12 * (1 - t) + Math.sin(t * Math.PI) * (8 + random(i + 60) * 20)
      : age < flight + .18 ? Math.sin((age - flight) / .18 * Math.PI) * 3 : 0;
    const length = 4 + random(i + 80) * 9, thickness = 1.5 + random(i + 100) * 2;
    c.save(); c.globalAlpha *= .3; c.fillStyle = '#020908'; c.beginPath(); c.ellipse(x + 2, y + 2, length * .6, 1.5, 0, 0, Math.PI * 2); c.fill(); c.restore();
    c.save(); c.translate(x, y - height); c.rotate(direction + t * (random(i + 120) - .5) * 8);
    if (remains.kind === 'barrel' && i < 2) {
      c.strokeStyle = '#78817d'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, 8, 4, 0, .3, 5.3); c.stroke();
    } else {
      c.fillStyle = ['#76603c', '#ab8b52', '#574731', '#c3a66b'][i % 4];
      c.beginPath(); c.moveTo(-length / 2, -thickness / 2); c.lineTo(length / 2, -thickness * .25);
      c.lineTo(length * .3, thickness / 2); c.lineTo(-length * .6, thickness * .3); c.closePath(); c.fill();
      c.strokeStyle = '#d2b580'; c.globalAlpha *= .5; c.lineWidth = .6;
      c.beginPath(); c.moveTo(-length * .4, 0); c.lineTo(length * .35, 0); c.stroke();
    }
    c.restore();
  }
  c.restore();
}
