import { ENEMY_DEFINITIONS } from './combat-content.ts';
import type { Enemy, EnemyKind } from './model.ts';

export const ENCOUNTER_RULES = Object.freeze({
  spawnInterval: 2, sanctuaryDelay: 1.5, initialCount: 3, initialKind: 'stalker' as const,
  initialMinDistance: 220, initialMaxDistance: 270, spawnMinDistance: 300, spawnMaxDistance: 450,
  maxSpawnAttempts: 12, spawnClearance: 7, minimumSeparation: 45,
  basePopulation: 5, killsPerPopulation: 7, targetPopulationCap: 10, hardPopulationCap: 12,
  initialIdleMin: .45, initialIdleRange: .35, corpseDuration: .5, despawnDistance: 850,
  activeAttackCaps: Object.freeze({ pack: 2, special: 1 }),
});

/** Ordered priorities deliberately preserve both the original mix and RNG draw order. */
export const SPECIAL_ENCOUNTERS = Object.freeze([
  Object.freeze({ kind: 'caster' as const, unlockKills: 6, minimum: 1, cap: 2, rollThreshold: .18 }),
  Object.freeze({ kind: 'brute' as const, unlockKills: 3, minimum: 1, cap: 2, rollThreshold: .38 }),
]);

export function livingEnemyCount(enemies: readonly Enemy[]): number {
  let count = 0;
  for (const enemy of enemies) if (enemy.state !== 'dead') count++;
  return count;
}

export function encounterPopulationTarget(kills: number): number {
  return Math.min(ENCOUNTER_RULES.targetPopulationCap,
    ENCOUNTER_RULES.basePopulation + Math.floor(kills / ENCOUNTER_RULES.killsPerPopulation));
}

/** Policy is independent of placement/collision; random is read only when a roll is needed. */
export function chooseEncounterEnemy(enemies: readonly Enemy[], kills: number, random: () => number): EnemyKind | null {
  const counts: Record<EnemyKind, number> = { stalker: 0, brute: 0, caster: 0 };
  let living = 0;
  for (const enemy of enemies) if (enemy.state !== 'dead') { counts[enemy.kind]++; living++; }
  if (living >= encounterPopulationTarget(kills)) return null;
  for (const entry of SPECIAL_ENCOUNTERS) {
    if (kills >= entry.unlockKills && counts[entry.kind] < entry.minimum) return entry.kind;
  }
  const roll = random();
  for (const entry of SPECIAL_ENCOUNTERS) {
    if (kills >= entry.unlockKills && counts[entry.kind] < entry.cap && roll < entry.rollThreshold) return entry.kind;
  }
  return 'stalker';
}

/** Small enemies share two attack slots; heavy/ranged enemies share one other slot. */
export function canEnemyJoinAttack(enemy: Enemy, enemies: readonly Enemy[]): boolean {
  const group = ENEMY_DEFINITIONS[enemy.kind].attackGroup;
  let attacking = 0;
  for (const other of enemies) {
    if (other !== enemy && (other.state === 'windup' || other.state === 'attack')
      && ENEMY_DEFINITIONS[other.kind].attackGroup === group) attacking++;
  }
  return attacking < ENCOUNTER_RULES.activeAttackCaps[group];
}
