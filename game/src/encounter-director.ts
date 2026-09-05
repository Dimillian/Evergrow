import { ENEMY_DEFINITIONS } from './combat-content.ts';
import type { Enemy, EnemyKind } from './model.ts';
import type { BiomeId } from './biomes.ts';
import { normalizeLevel, type EnemyRank } from './progression-content.ts';

export const ENCOUNTER_RULES = Object.freeze({
  spawnInterval: 2, sanctuaryDelay: 1.5, initialCount: 3, initialKind: 'stalker' as const,
  initialMinDistance: 220, initialMaxDistance: 270, spawnMinDistance: 300, spawnMaxDistance: 450,
  maxSpawnAttempts: 12, spawnClearance: 7, minimumSeparation: 45,
  basePopulation: 5, levelsPerPopulation: 3, targetPopulationCap: 10, hardPopulationCap: 12,
  veteranCap: 2, eliteCap: 1,
  initialIdleMin: .45, initialIdleRange: .35, corpseDuration: .5, despawnDistance: 850,
  activeAttackCaps: Object.freeze({ pack: 2, special: 1 }),
});

/** Available archetypes vary with the landscape; kill count never makes an old area harder. */
export const ENCOUNTER_WEIGHTS = Object.freeze({
  deadwood: Object.freeze({ stalker: 70, brute: 22, caster: 8 }),
  verdant: Object.freeze({ stalker: 72, brute: 12, caster: 16 }),
  swamp: Object.freeze({ stalker: 55, brute: 15, caster: 30 }),
});

export function livingEnemyCount(enemies: readonly Enemy[]): number {
  let count = 0;
  for (const enemy of enemies) if (enemy.state !== 'dead') count++;
  return count;
}

export function encounterPopulationTarget(level: number): number {
  return Math.min(ENCOUNTER_RULES.targetPopulationCap,
    ENCOUNTER_RULES.basePopulation + Math.floor((normalizeLevel(level) - 1) / ENCOUNTER_RULES.levelsPerPopulation));
}

/** Policy is independent of placement/collision; random is read only when a roll is needed. */
export function chooseEncounterEnemy(enemies: readonly Enemy[], level: number, biome: BiomeId, random: () => number): EnemyKind | null {
  const counts: Record<EnemyKind, number> = { stalker: 0, brute: 0, caster: 0 };
  let living = 0;
  for (const enemy of enemies) if (enemy.state !== 'dead') { counts[enemy.kind]++; living++; }
  if (living >= encounterPopulationTarget(level)) return null;
  const entries = (Object.entries(ENCOUNTER_WEIGHTS[biome]) as [EnemyKind, number][])
    .filter(([kind]) => kind === 'stalker' || counts[kind] < 2);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.max(0, Math.min(1 - Number.EPSILON, random())) * total;
  for (const [kind, weight] of entries) { if (roll < weight) return kind; roll -= weight; }
  return entries[entries.length - 1][0];
}

export function encounterRankChances(level: number): Readonly<Record<EnemyRank, number>> {
  level = normalizeLevel(level);
  const veteran = level === 1 ? 0 : Math.min(.20, .12 + (level - 2) * .01);
  const elite = level < 3 ? 0 : Math.min(.08, .04 + (level - 3) * .005);
  return { normal: 1 - veteran - elite, veteran, elite };
}

/** Stronger ranks change per-foe stakes while concurrent threats remain bounded. */
export function chooseEncounterRank(enemies: readonly Enemy[], level: number, roll: number): EnemyRank {
  const chances = encounterRankChances(level);
  const count = (rank: EnemyRank) => enemies.filter(enemy => enemy.state !== 'dead' && enemy.rank === rank).length;
  if (roll < chances.elite && count('elite') < ENCOUNTER_RULES.eliteCap) return 'elite';
  if (roll >= chances.elite && roll < chances.elite + chances.veteran && count('veteran') < ENCOUNTER_RULES.veteranCap) return 'veteran';
  return 'normal';
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
