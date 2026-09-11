import type { Enemy, EnemyKind } from './model.ts';
import type { EnemyRank } from './progression-content.ts';
import { isBossKind } from './wilderness-boss-content.ts';

/** Dangerous foes gain pressure and control recovery, not extra life or shorter tells. */
export const ENEMY_THREAT = Object.freeze({
  normal: Object.freeze({ damage: 1, recovery: 1, controlFactor: 1, controlMaximum: Infinity, controlRest: 0, knockback: 1 }),
  veteran: Object.freeze({ damage: 1, recovery: 1, controlFactor: .8, controlMaximum: 1, controlRest: 3.5, knockback: .65 }),
  elite: Object.freeze({ damage: 1.25, recovery: .85, controlFactor: .5, controlMaximum: .6, controlRest: 4, knockback: .35 }),
  boss: Object.freeze({ damage: 1.25, recovery: .8, controlFactor: .25, controlMaximum: .35, controlRest: 2.5, knockback: .15 }),
});
export function enemyThreat(enemy: { kind: EnemyKind; rank: EnemyRank }) {
  return ENEMY_THREAT[isBossKind(enemy.kind) ? 'boss' : enemy.rank];
}
export function enemyRecoveryDuration(enemy: Pick<Enemy, 'kind' | 'rank'>, authored: number): number {
  return authored * enemyThreat(enemy).recovery;
}
