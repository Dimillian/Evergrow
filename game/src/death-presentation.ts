import { isRegionalEnemy } from './combat-content.ts';
import type { CombatEvent, EnemyKind, ProjectileStyle } from './model.ts';
import { DEATH_RESPONSE_TIMING, enemyDeathAnimation, type DeathVariant } from './death-content.ts';
import { ease, clamp01 } from './death-rig.ts';

export interface EnemyRemains {
  id: number; x: number; y: number; angle: number; facing: number;
  kind: EnemyKind; age: number; duration: number;
  readonly motion?: Extract<CombatEvent, {type:'kill'}>['motion'];
  readonly element?: ProjectileStyle;
  readonly variant: DeathVariant;
}
export function deathPose(remains: EnemyRemains, reducedMotion = false) {
  const recipe=enemyDeathAnimation(remains.kind,remains.variant);
  const age=remains.element==='frost'?0:reducedMotion?recipe.settle:remains.element === 'lightning' ? Math.max(0, remains.age - DEATH_RESPONSE_TIMING.lightningHold) : remains.age;
  const fade = Math.min(3, remains.duration * .3);
  let opacity = ease((remains.duration-remains.age)/fade);
  if(remains.element==='frost')opacity=1-ease((remains.age-DEATH_RESPONSE_TIMING.frostHold)/DEATH_RESPONSE_TIMING.frostFade);
  if(remains.element==='fire')opacity*=1-ease((remains.age-DEATH_RESPONSE_TIMING.fireFadeStart)/(DEATH_RESPONSE_TIMING.fireLifetime-DEATH_RESPONSE_TIMING.fireFadeStart));
  const drift = reducedMotion ? 1 : 1 - Math.exp(-remains.age * 8);
  const weight = remains.kind === 'brute' ? .55 : remains.kind === 'wisp' ? .4 : .85;
  const speed = Math.hypot(remains.motion?.vx ?? 0, remains.motion?.vy ?? 0);
  const velocityScale = Math.min(1, 100 / Math.max(1, speed)) * .075;
  const shove = remains.element === 'frost' ? 0 : 8 * weight;
  return { age, settled:age>=recipe.settle, opacity,
    x: drift * ((remains.motion?.vx ?? 0) * velocityScale + Math.cos(remains.angle) * shove),
    y: drift * ((remains.motion?.vy ?? 0) * velocityScale + Math.sin(remains.angle) * shove) * .65,
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
    let variant=Math.min(3,Math.max(0,Math.floor(this.random()*4))) as DeathVariant;
    // Bias front/back collapses by the actual incoming blow; keep side/slump variety.
    if (event.motion && event.enemyKind !== 'hound' && event.enemyKind !== 'wisp' && variant < 3) {
      const front = Math.cos(event.angle - event.facing);
      if (Math.abs(front) > .45) variant = (front > 0 ? (isRegionalEnemy(event.enemyKind) ? 0 : 2) : 1);
    }
    this.remains.push({ id: event.targetId, x: event.x, y: event.y, angle: event.angle, variant,
      motion: event.motion, facing: event.facing, kind: event.enemyKind, element: event.style, age: 0, duration: event.style === 'frost' ? DEATH_RESPONSE_TIMING.frostLifetime : event.style === 'fire' ? DEATH_RESPONSE_TIMING.fireLifetime : event.enemyKind === 'wisp' ? 5 : 14 });
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
