import { ENEMY_DEFINITIONS } from './combat-content.ts';
import type { Enemy, EnemyKind } from './model.ts';
import type { BiomeId } from './biomes.ts';
import { normalizeLevel, type EnemyRank } from './progression-content.ts';

export const ENCOUNTER_RULES = Object.freeze({
  maxSpawnAttempts: 24, spawnClearance: 7, minimumSeparation: 45,
  basePopulation: 9, levelsPerPopulation: 4, targetPopulationCap: 14, hardPopulationCap: 24, roamingReserve: 9,
  veteranCap: 2, eliteCap: 1,
  initialIdleMin: .45, initialIdleRange: .35, corpseDuration: .5, despawnDistance: 1800,
  activeAttackCaps: Object.freeze({ pack: 2, special: 1 }),
});

/** Available archetypes vary with the landscape; kill count never makes an old area harder. */
export const ENCOUNTER_WEIGHTS: Readonly<Record<BiomeId, Readonly<Record<EnemyKind, number>>>> = Object.freeze({
  deadwood: Object.freeze({ stalker: 34, brute: 20, caster: 10, hound: 14, archer: 16, wisp: 6 }),
  verdant: Object.freeze({ stalker: 22, brute: 8, caster: 8, hound: 30, archer: 24, wisp: 8 }),
  swamp: Object.freeze({ stalker: 22, brute: 10, caster: 24, hound: 8, archer: 10, wisp: 26 }),
  frostpine: Object.freeze({ stalker: 16, brute: 16, caster: 8, hound: 24, archer: 14, wisp: 22 }),
  emberfall: Object.freeze({ stalker: 18, brute: 26, caster: 26, hound: 10, archer: 12, wisp: 8 }),
  autumn: Object.freeze({ stalker: 24, brute: 10, caster: 8, hound: 24, archer: 28, wisp: 6 }),
  highlands: Object.freeze({ stalker: 18, brute: 28, caster: 10, hound: 10, archer: 26, wisp: 8 }),
});

export function livingEnemyCount(enemies: readonly Pick<Enemy, 'state'>[]): number {
  let count = 0;
  for (const enemy of enemies) if (enemy.state !== 'dead') count++;
  return count;
}

export function encounterPopulationTarget(level: number): number {
  return Math.min(ENCOUNTER_RULES.targetPopulationCap,
    ENCOUNTER_RULES.basePopulation + Math.floor((normalizeLevel(level) - 1) / ENCOUNTER_RULES.levelsPerPopulation));
}

/** Policy is independent of placement/collision; random is read only when a roll is needed. */
export type EncounterActor = Pick<Enemy, 'state' | 'kind' | 'rank' | 'campId'>;
export function chooseEncounterEnemy(enemies: readonly EncounterActor[], level: number, biome: BiomeId, random: () => number, preferred?: EnemyKind): EnemyKind | null {
  const counts: Record<EnemyKind, number> = { stalker: 0, brute: 0, caster: 0, hound: 0, archer: 0, wisp: 0 };
  let living = 0;
  for (const enemy of enemies) if (enemy.state !== 'dead' && !enemy.campId) { counts[enemy.kind]++; living++; }
  if (living >= encounterPopulationTarget(level) || livingEnemyCount(enemies) >= ENCOUNTER_RULES.hardPopulationCap) return null;
  const entries = (Object.entries(ENCOUNTER_WEIGHTS[biome]) as [EnemyKind, number][])
    .filter(([kind]) => ENEMY_DEFINITIONS[kind].attackGroup === 'pack' || counts[kind] < 2);
  if (preferred && entries.some(([kind]) => kind === preferred)) return preferred;
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
export function chooseEncounterRank(enemies: readonly EncounterActor[], level: number, roll: number): EnemyRank {
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
