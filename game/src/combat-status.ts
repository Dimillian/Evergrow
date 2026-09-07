import { isBossKind } from './wilderness-boss-content.ts';
import { WARDEN_RULES } from './dungeon-boss.ts';
import type { Enemy, ProjectileStyle } from './model.ts';
import { interruptStaggeredEnemy } from './enemy-state.ts';

export interface SlowEffect { readonly duration: number; readonly factor: number }
export interface BurnEffect { readonly duration: number; readonly dps: number }
export const STATUS_RULES = Object.freeze({ burnInterval: .5 });

/** Reapplication retains the strongest value and longest remaining duration;
 * it does not add stacks or restart the accrued burn tick. Dead targets ignore effects. */
export function applySlow(enemy: Enemy, effect: SlowEffect): void {
  if (enemy.state === 'dead') return;
  if (isBossKind(enemy.kind)) effect = { duration: effect.duration * .5, factor: Math.max(.65, effect.factor) };
  enemy.slowTime = Math.max(enemy.slowTime, effect.duration);
  enemy.slowFactor = Math.min(enemy.slowFactor, effect.factor);
}
export function applyBurn(enemy: Enemy, effect: BurnEffect): void {
  if (enemy.state === 'dead') return;
  enemy.burnTime = Math.max(enemy.burnTime, effect.duration);
  enemy.burnDps = Math.max(enemy.burnDps, effect.dps);
}
export function applyStun(enemy: Enemy, duration: number, kind: 'stun' | 'freeze' | 'stagger' = 'stun'): void {
  if (enemy.state === 'dead') return;
  if (isBossKind(enemy.kind)) { if ((enemy.controlImmunity ?? 0) > 0) return; duration = Math.min(.35, duration * WARDEN_RULES.controlFactor); enemy.controlImmunity = WARDEN_RULES.controlImmunity; }
  enemy.stagger = Math.max(enemy.stagger, duration); enemy.interrupted = true;
  if (kind === 'freeze') enemy.freezeTime = Math.max(enemy.freezeTime ?? 0, duration);
  if (kind === 'stun') enemy.stunTime = Math.max(enemy.stunTime ?? 0, duration);
}

/** Run after state time advances and before AI. False suppresses this tick's AI. */
export function advanceEnemyStatuses(enemy: Enemy, dt: number, damage: (enemy: Enemy, amount: number) => void): boolean {
  if (enemy.state === 'dead') return false;
  enemy.freezeTime = Math.max(0, (enemy.freezeTime ?? 0) - dt);
  enemy.stunTime = Math.max(0, (enemy.stunTime ?? 0) - dt);
  enemy.controlImmunity = Math.max(0, (enemy.controlImmunity ?? 0) - dt);
  if (enemy.slowTime > 0) enemy.slowTime = Math.max(0, enemy.slowTime - dt);
  if (enemy.slowTime <= 0) enemy.slowFactor = 1;
  if (enemy.burnTime > 0) {
    enemy.burnTick += Math.min(dt, enemy.burnTime);
    const remainingBurn = enemy.burnTime - dt;
    enemy.burnTime = remainingBurn > 1e-9 ? remainingBurn : 0;
    if (enemy.burnTick > 1e-9 && (enemy.burnTick + 1e-9 >= STATUS_RULES.burnInterval || enemy.burnTime <= 0)) {
      damage(enemy, enemy.burnDps * enemy.burnTick);
      enemy.burnTick = 0;
    }
    if (enemy.burnTime <= 0) enemy.burnDps = 0;
    if (enemy.hp <= 0) return false;
  }
  if (enemy.stagger > 0) {
    interruptStaggeredEnemy(enemy);
    enemy.stagger = Math.max(0, enemy.stagger - dt);
    enemy.vx = enemy.vy = 0;
    return false;
  }
  return true;
}

/** Elemental contacts share one non-stacking status rule across weapons and spells. */
export const ELEMENTAL_CONTACT = Object.freeze({ burnDuration: 2, burnFractionPerSecond: .15, chillDuration: 1.5, chillFactor: .8, lightningInterrupt: .12 });
export function applyElementalContact(enemy: Enemy, style: ProjectileStyle | undefined, damage: number): void {
  if (damage <= 0 || !Number.isFinite(damage) || enemy.state === 'dead') return;
  if (style === 'fire') applyBurn(enemy, { duration: ELEMENTAL_CONTACT.burnDuration, dps: damage * ELEMENTAL_CONTACT.burnFractionPerSecond });
  else if (style === 'frost') applySlow(enemy, { duration: ELEMENTAL_CONTACT.chillDuration, factor: ELEMENTAL_CONTACT.chillFactor });
  else if (style === 'lightning') applyStun(enemy, ELEMENTAL_CONTACT.lightningInterrupt, 'stagger');
}
