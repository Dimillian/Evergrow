import type { CombatEvent, EnemyKind } from './model.ts';

export interface EnemyRemains {
  id: number; x: number; y: number; angle: number; facing: number;
  kind: EnemyKind; age: number; duration: number;
}
export const DEATH_SETTLE_SECONDS = .65;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export function deathPose(remains: EnemyRemains, reducedMotion = false) {
  const t = reducedMotion ? 1 : clamp(remains.age / DEATH_SETTLE_SECONDS);
  const fall = t * t * (3 - 2 * t);
  const fade = clamp((remains.duration - remains.age) / 3);
  return { fall, opacity: fade * fade * (3 - 2 * fade),
    x: Math.cos(remains.angle) * fall * 9, y: Math.sin(remains.angle) * fall * 5,
    dust: reducedMotion ? 0 : Math.sin(clamp((remains.age - .25) / .9) * Math.PI) };
}

/** Transient presentation only: no corpses in collision, rewards or saves. */
export class EnemyDeaths {
  readonly remains: EnemyRemains[] = [];
  handle(event: CombatEvent): void {
    if (event.type !== 'kill' || this.remains.some(r => r.id === event.targetId)) return;
    this.remains.push({ id: event.targetId, x: event.x, y: event.y, angle: event.angle,
      facing: event.facing, kind: event.enemyKind, age: 0, duration: event.enemyKind === 'wisp' ? 5 : 14 });
    if (this.remains.length > 45) this.remains.shift();
  }
  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (const r of this.remains) r.age += dt;
    for (let i = this.remains.length - 1; i >= 0; i--)
      if (this.remains[i].age >= this.remains[i].duration) this.remains.splice(i, 1);
  }
  reset(): void { this.remains.length = 0; }
}
