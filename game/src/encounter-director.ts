import type { Enemy, EnemyKind } from './model.ts';
import type { BiomeId } from './biomes.ts';
import { normalizeLevel, type EnemyRank } from './progression-content.ts';

export const ENCOUNTER_RULES = Object.freeze({
  maxSpawnAttempts: 24, spawnClearance: 7, minimumSeparation: 45,
  basePopulation: 16,
  initialIdleMin: .45, initialIdleRange: .35, corpseDuration: .5, despawnDistance: 1800,
});

/** Available archetypes vary with the landscape; kill count never makes an old area harder. */
export const ENCOUNTER_WEIGHTS: Readonly<Record<BiomeId, Readonly<Record<EnemyKind, number>>>> = Object.freeze({
  deadwood: Object.freeze({ warden: 0, goblin: 0, goblinChief: 0, stalker: 34, brute: 20, caster: 10, hound: 14, archer: 16, wisp: 6 }),
  verdant: Object.freeze({ warden: 0, goblin: 0, goblinChief: 0, stalker: 22, brute: 8, caster: 8, hound: 30, archer: 24, wisp: 8 }),
  swamp: Object.freeze({ warden: 0, goblin: 0, goblinChief: 0, stalker: 22, brute: 10, caster: 24, hound: 8, archer: 10, wisp: 26 }),
  frostpine: Object.freeze({ warden: 0, goblin: 0, goblinChief: 0, stalker: 16, brute: 16, caster: 8, hound: 24, archer: 14, wisp: 22 }),
  emberfall: Object.freeze({ warden: 0, goblin: 0, goblinChief: 0, stalker: 18, brute: 26, caster: 26, hound: 10, archer: 12, wisp: 8 }),
  autumn: Object.freeze({ warden: 0, goblin: 0, goblinChief: 0, stalker: 24, brute: 10, caster: 8, hound: 24, archer: 28, wisp: 6 }),
  highlands: Object.freeze({ warden: 0, goblin: 0, goblinChief: 0, stalker: 18, brute: 28, caster: 10, hound: 10, archer: 26, wisp: 8 }),
});

export function livingEnemyCount(enemies: readonly Pick<Enemy, 'state'>[]): number {
  let count = 0;
  for (const enemy of enemies) if (enemy.state !== 'dead') count++;
  return count;
}

/** Policy is independent of placement/collision; random is read only when a roll is needed. */
export function chooseEncounterEnemy(biome: BiomeId, random: () => number, preferred?: EnemyKind): EnemyKind {
  const entries = (Object.entries(ENCOUNTER_WEIGHTS[biome]) as [EnemyKind, number][]).filter(([, weight]) => weight > 0);
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

/** Geographic rank odds are independent of the current population. */
export function chooseEncounterRank(level: number, roll: number): EnemyRank {
  const chances = encounterRankChances(level);
  if (roll < chances.elite) return 'elite';
  if (roll >= chances.elite && roll < chances.elite + chances.veteran) return 'veteran';
  return 'normal';
}
