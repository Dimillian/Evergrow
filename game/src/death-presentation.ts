import type { CombatEvent, EnemyKind } from './model.ts';
import { enemyDeathAnimation, type DeathVariant } from './death-content.ts';
import { ease, clamp01 } from './death-rig.ts';

export interface EnemyRemains {
  id: number; x: number; y: number; angle: number; facing: number;
  kind: EnemyKind; age: number; duration: number;
  readonly variant: DeathVariant;
}
export function deathPose(remains: EnemyRemains, reducedMotion = false) {
  const recipe=enemyDeathAnimation(remains.kind,remains.variant);
  const age=reducedMotion?recipe.settle:remains.age;
  return { age, settled:age>=recipe.settle, opacity:ease((remains.duration-remains.age)/3),
    dust:reducedMotion?0:Math.sin(clamp01((age-recipe.contact)/.38)*Math.PI) };
}

/** Transient presentation only: no corpses in collision, rewards or saves. */
export class EnemyDeaths {
  readonly remains: EnemyRemains[] = [];
  // Presentation-local entropy. Never advance Simulation or loot RNG for art.
  private readonly random: () => number;
  constructor(random: () => number = Math.random) { this.random=random; }
  handle(event: CombatEvent): void {
    if (event.type !== 'kill' || this.remains.some(r => r.id === event.targetId)) return;
    const variant=Math.min(3,Math.max(0,Math.floor(this.random()*4))) as DeathVariant;
    this.remains.push({ id: event.targetId, x: event.x, y: event.y, angle: event.angle, variant,
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
