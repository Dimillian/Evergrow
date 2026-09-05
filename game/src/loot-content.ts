import type { BiomeId } from './biomes.ts';
import type { ItemKind, ItemTier } from './character-types.ts';
import type { EnemyKind } from './model.ts';
import type { EnemyRank } from './progression-content.ts';

export interface EnemyLootTable {
  readonly guaranteedItems: 0 | 1;
  /** One independent extra-item roll, made after the guaranteed items. */
  readonly bonusItemChance: number;
  readonly itemLevelBonus: number;
  /** Conditional on an item dropping; percentage weights sum to 100. */
  readonly tierWeights: Readonly<Record<ItemTier, number>>;
}

/** Initial authored rewards. Encounter rank changes yield and rarity, never the player's current level. */
export const ENEMY_LOOT_TABLES: Readonly<Record<EnemyRank, EnemyLootTable>> = Object.freeze({
  normal: Object.freeze({ guaranteedItems: 0, bonusItemChance: .28, itemLevelBonus: 0,
    tierWeights: Object.freeze({ common: 55, magic: 32, rare: 11, epic: 1.8, legendary: .2 }) }),
  veteran: Object.freeze({ guaranteedItems: 0, bonusItemChance: .7, itemLevelBonus: 1,
    tierWeights: Object.freeze({ common: 15, magic: 45, rare: 32, epic: 7.5, legendary: .5 }) }),
  elite: Object.freeze({ guaranteedItems: 1, bonusItemChance: .25, itemLevelBonus: 2,
    tierWeights: Object.freeze({ common: 0, magic: 40, rare: 45, epic: 13, legendary: 2 }) }),
});

export function getLootTable(rank: EnemyRank): EnemyLootTable { return ENEMY_LOOT_TABLES[rank]; }

/** All ten equipment kinds remain eligible. The foe's archetype supplies a readable tendency. */
export const ENEMY_ITEM_KIND_WEIGHTS: Readonly<Record<EnemyKind, Readonly<Record<ItemKind, number>>>> = Object.freeze({
  stalker: Object.freeze({ weapon: 32, shield: 6, head: 8, chest: 8, gloves: 10, legs: 8, boots: 12, cloak: 8, amulet: 3, ring: 5 }),
  brute: Object.freeze({ weapon: 27, shield: 18, head: 10, chest: 15, gloves: 7, legs: 10, boots: 5, cloak: 3, amulet: 2, ring: 3 }),
  caster: Object.freeze({ weapon: 28, shield: 3, head: 6, chest: 6, gloves: 5, legs: 5, boots: 5, cloak: 14, amulet: 14, ring: 14 }),
});

export interface BiomeProfileWeights {
  readonly weapon: Readonly<Record<string, number>>;
  readonly shield: Readonly<Record<string, number>>;
}

/** Relative weights within a dropped weapon/shield; a weight of one is still fully eligible. */
export const BIOME_PROFILE_WEIGHTS: Readonly<Record<BiomeId, BiomeProfileWeights>> = Object.freeze({
  deadwood: Object.freeze({
    weapon: Object.freeze({ longsword: 3, 'hand-axe': 1, 'flanged-mace': 2, 'rondel-dagger': 1,
      greatblade: 3, greataxe: 2, 'grave-maul': 3, 'thorn-shortbow': 1, 'crescent-recurve': 1,
      'warden-longbow': 1, 'ember-staff': 2, 'rime-staff': 1, 'storm-staff': 1 }),
    shield: Object.freeze({ 'iron-buckler': 1, 'vigil-kite': 2, 'bastion-tower': 3 }),
  }),
  verdant: Object.freeze({
    weapon: Object.freeze({ longsword: 1, 'hand-axe': 2, 'flanged-mace': 1, 'rondel-dagger': 3,
      greatblade: 1, greataxe: 1, 'grave-maul': 1, 'thorn-shortbow': 3, 'crescent-recurve': 4,
      'warden-longbow': 3, 'ember-staff': 1, 'rime-staff': 1, 'storm-staff': 1 }),
    shield: Object.freeze({ 'iron-buckler': 3, 'vigil-kite': 2, 'bastion-tower': 1 }),
  }),
  swamp: Object.freeze({
    weapon: Object.freeze({ longsword: 1, 'hand-axe': 1, 'flanged-mace': 1, 'rondel-dagger': 2,
      greatblade: 1, greataxe: 1, 'grave-maul': 1, 'thorn-shortbow': 1, 'crescent-recurve': 1,
      'warden-longbow': 1, 'ember-staff': 2, 'rime-staff': 4, 'storm-staff': 3 }),
    shield: Object.freeze({ 'iron-buckler': 3, 'vigil-kite': 1, 'bastion-tower': 1 }),
  }),
});
