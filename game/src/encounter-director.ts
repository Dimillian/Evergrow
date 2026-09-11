import type { Enemy, EnemyKind } from './model.ts';
import type { BiomeId } from './biomes.ts';
import { ENEMY_DEFINITIONS, type EnemyDefinition } from './combat-content.ts';
import { normalizeLevel, type EnemyRank } from './progression-content.ts';

export const ENCOUNTER_RULES = Object.freeze({
  maxSpawnAttempts: 24, spawnClearance: 7, minimumSeparation: 45,
  basePopulation: 16,
  initialIdleMin: .45, initialIdleRange: .35, corpseDuration: .5, despawnDistance: 1800,
});

/** Available archetypes vary with the landscape; kill count never makes an old area harder. */
export const ENCOUNTER_WEIGHTS: Readonly<Record<BiomeId, Readonly<Record<EnemyKind, number>>>> = Object.freeze({
  steppe: Object.freeze({ briarMatriarch: 0, ashColossus: 0, graveMarshal: 0, warden: 0, goblin: 0, goblinChief: 0, thornReaver: 5, mireSpitter: 0, frostRevenant: 0, emberAcolyte: 0, duneScuttler: 30, stormSentinel: 0, stalker: 12, brute: 8, caster: 3, hound: 24, archer: 15, wisp: 3 }),
  sunscar: Object.freeze({ briarMatriarch: 0, ashColossus: 0, graveMarshal: 0, warden: 0, goblin: 0, goblinChief: 0, thornReaver: 0, mireSpitter: 0, frostRevenant: 0, emberAcolyte: 18, duneScuttler: 42, stormSentinel: 0, stalker: 10, brute: 10, caster: 6, hound: 4, archer: 8, wisp: 2 }),
  deadwood: Object.freeze({ briarMatriarch: 0, ashColossus: 0, graveMarshal: 0, warden: 0, goblin: 0, goblinChief: 0, thornReaver: 32, mireSpitter: 8, frostRevenant: 6, emberAcolyte: 0, duneScuttler: 0, stormSentinel: 0, stalker: 19, brute: 10, caster: 8, hound: 7, archer: 6, wisp: 4 }),
  verdant: Object.freeze({ briarMatriarch: 0, ashColossus: 0, graveMarshal: 0, warden: 0, goblin: 0, goblinChief: 0, thornReaver: 40, mireSpitter: 8, frostRevenant: 0, emberAcolyte: 0, duneScuttler: 0, stormSentinel: 0, stalker: 10, brute: 4, caster: 4, hound: 20, archer: 10, wisp: 4 }),
  swamp: Object.freeze({ briarMatriarch: 0, ashColossus: 0, graveMarshal: 0, warden: 0, goblin: 0, goblinChief: 0, thornReaver: 10, mireSpitter: 45, frostRevenant: 0, emberAcolyte: 0, duneScuttler: 0, stormSentinel: 0, stalker: 10, brute: 5, caster: 15, hound: 3, archer: 2, wisp: 10 }),
  frostpine: Object.freeze({ briarMatriarch: 0, ashColossus: 0, graveMarshal: 0, warden: 0, goblin: 0, goblinChief: 0, thornReaver: 0, mireSpitter: 0, frostRevenant: 45, emberAcolyte: 0, duneScuttler: 0, stormSentinel: 10, stalker: 6, brute: 8, caster: 3, hound: 14, archer: 6, wisp: 8 }),
  emberfall: Object.freeze({ briarMatriarch: 0, ashColossus: 0, graveMarshal: 0, warden: 0, goblin: 0, goblinChief: 0, thornReaver: 0, mireSpitter: 0, frostRevenant: 0, emberAcolyte: 45, duneScuttler: 12, stormSentinel: 0, stalker: 7, brute: 15, caster: 10, hound: 4, archer: 5, wisp: 2 }),
  autumn: Object.freeze({ briarMatriarch: 0, ashColossus: 0, graveMarshal: 0, warden: 0, goblin: 0, goblinChief: 0, thornReaver: 32, mireSpitter: 0, frostRevenant: 0, emberAcolyte: 0, duneScuttler: 12, stormSentinel: 0, stalker: 10, brute: 6, caster: 4, hound: 18, archer: 14, wisp: 4 }),
  highlands: Object.freeze({ briarMatriarch: 0, ashColossus: 0, graveMarshal: 0, warden: 0, goblin: 0, goblinChief: 0, thornReaver: 0, mireSpitter: 0, frostRevenant: 12, emberAcolyte: 0, duneScuttler: 8, stormSentinel: 40, stalker: 7, brute: 12, caster: 3, hound: 5, archer: 10, wisp: 3 }),
});

export function livingEnemyCount(enemies: readonly Pick<Enemy, 'state'>[]): number {
  let count = 0;
  for (const enemy of enemies) if (enemy.state !== 'dead') count++;
  return count;
}

/** Policy is independent of placement/collision; random is read only when a roll is needed. */
export function chooseEncounterEnemy(biome: BiomeId, random: () => number, preferred?: EnemyKind, role?: EnemyDefinition['role']): EnemyKind {
  const eligible = (Object.entries(ENCOUNTER_WEIGHTS[biome]) as [EnemyKind, number][]).filter(([, weight]) => weight > 0);
  const matching = role ? eligible.filter(([kind]) => ENEMY_DEFINITIONS[kind].role === role) : eligible;
  const entries = matching.length ? matching : eligible;
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
