import type { Enemy, EnemyKind } from './model.ts';
import type { EnemyRank } from './progression-content.ts';
import { isBossKind } from './wilderness-boss-content.ts';

/** Rank pressure and control recovery; individual attack recipes own warnings and damage ratios. */
export const ENEMY_THREAT = Object.freeze({
  normal: Object.freeze({ damage: 1, recovery: 1, controlFactor: 1, controlMaximum: Infinity, controlRest: 0, knockback: 1 }),
  veteran: Object.freeze({ damage: 1, recovery: 1, controlFactor: .8, controlMaximum: 1, controlRest: 3.5, knockback: .65 }),
  elite: Object.freeze({ damage: 1.25, recovery: .65, controlFactor: .5, controlMaximum: .6, controlRest: 4, knockback: .35 }),
  boss: Object.freeze({ damage: 1.25, recovery: .65, controlFactor: .25, controlMaximum: .35, controlRest: 2.5, knockback: .15 }),
});
export function enemyThreat(enemy: { kind: EnemyKind; rank: EnemyRank }) {
  return ENEMY_THREAT[isBossKind(enemy.kind) ? 'boss' : enemy.rank];
}
export function enemyRecoveryDuration(enemy: Pick<Enemy, 'kind' | 'rank'>, authored: number): number {
  return authored * enemyThreat(enemy).recovery;
}

/** Small additive delays vary each actor's rhythm without shortening any warning.
 * No shared attack slots, simulation RNG consumption or level-based speed scaling. */
export function enemyRhythmDelay(enemy: Pick<Enemy,'lootSeed'|'attackTurns'|'bossTurns'>): number {
  let n = Math.imul(enemy.lootSeed ^ Math.imul((enemy.bossTurns ?? enemy.attackTurns ?? 0) + 1, 0x9E3779B9), 0x45d9f3b);
  n = Math.imul(n ^ n >>> 16, 0x45d9f3b);
  return ((n ^ n >>> 16) >>> 0) / 4294967296 * .12;
}
export function enemyWindupDuration(enemy: Pick<Enemy,'lootSeed'|'attackTurns'|'bossTurns'>, authored: number): number {
  return authored + enemyRhythmDelay(enemy);
}
