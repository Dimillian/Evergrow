import type { BiomeId } from './biomes.ts';
import type { Item } from './character-types.ts';
import type { EnemyKind } from './model.ts';
import type { EnemyRank } from './progression-content.ts';
import { normalizeLevel } from './progression-content.ts';
import { generateItem } from './items.ts';
import { BIOME_PROFILE_WEIGHTS, ENEMY_ITEM_KIND_WEIGHTS, ENEMY_LOOT_YIELD, getLootTable } from './loot-content.ts';

export interface EnemyLootContext {
  readonly seed: number;
  readonly level: number;
  readonly rank: EnemyRank;
  readonly biome: BiomeId;
  readonly kind: EnemyKind;
  readonly firstKill?: boolean;
}

function randomSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function validateRoll(roll: number): void {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new RangeError('Loot rolls must be within [0, 1).');
}

/** Exact cumulative weight selection used by reward rolls and balance inspection. Zero weights never win. */
export function selectLootWeight<T extends string>(weights: Readonly<Record<T, number>>, roll: number): T {
  validateRoll(roll);
  const entries = Object.entries(weights) as [T, number][];
  let total = 0;
  for (const [, weight] of entries) {
    if (!Number.isFinite(weight) || weight < 0) throw new RangeError('Loot weights must be finite and non-negative.');
    total += weight;
  }
  if (!Number.isFinite(total) || total <= 0) throw new RangeError('A loot table needs a positive total weight.');
  const target = roll * total;
  let cumulative = 0, lastPositive: T | undefined;
  for (const [value, weight] of entries) {
    if (weight <= 0) continue;
    cumulative += weight; lastPositive = value;
    if (target < cumulative) return value;
  }
  // Floating-point summation at the upper boundary must still select an eligible entry.
  return lastPositive!;
}

/** Each foe has at most one chance roll and two rewards. First-kill gear replaces a zero result. */
export function enemyLootCount(rank: EnemyRank, roll: number, firstKill = false): number {
  validateRoll(roll);
  const table = getLootTable(rank);
  const count = table.guaranteedItems + Number(roll < table.bonusItemChance);
  return firstKill ? Math.max(1, count) : count;
}

export function lootItemLevel(monsterLevel: number, rank: EnemyRank): number {
  return normalizeLevel(normalizeLevel(monsterLevel) + getLootTable(rank).itemLevelBonus);
}

/** Isolated reward RNG: combat draws, XP award order, and subsequent player levels cannot change this result. */
export function rollEnemyLoot(context: EnemyLootContext): Item[] {
  const seed = context.seed >>> 0, random = randomSource(seed), table = getLootTable(context.rank);
  const count = enemyLootCount(context.rank, Math.min(1 - Number.EPSILON, random() / (ENEMY_LOOT_YIELD[context.kind] ?? 1)), context.firstKill);
  const itemLevel = lootItemLevel(context.level, context.rank);
  const items: Item[] = [];
  for (let index = 0; index < count; index++) {
    const tier = selectLootWeight(table.tierWeights, random());
    const kind = selectLootWeight(ENEMY_ITEM_KIND_WEIGHTS[context.kind], random());
    const profileId = kind === 'weapon' || kind === 'shield' || kind === 'grimoire' || kind === 'orb'
      ? selectLootWeight(BIOME_PROFILE_WEIGHTS[context.biome][kind], random()) : undefined;
    // Consecutive rewards receive different item-local seeds, independent of how many table draws were needed.
    const itemSeed = (seed + Math.imul(index + 1, 0x9E3779B9)) >>> 0;
    items.push(generateItem(itemSeed, itemLevel, kind, profileId, tier));
  }
  return items;
}
