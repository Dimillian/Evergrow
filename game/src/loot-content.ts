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
    tierWeights: Object.freeze({ common: 75, magic: 22, rare: 2.7, epic: .28, legendary: .02 }) }),
  veteran: Object.freeze({ guaranteedItems: 0, bonusItemChance: .7, itemLevelBonus: 1,
    tierWeights: Object.freeze({ common: 60, magic: 32, rare: 7, epic: .95, legendary: .05 }) }),
  elite: Object.freeze({ guaranteedItems: 1, bonusItemChance: .25, itemLevelBonus: 2,
    tierWeights: Object.freeze({ common: 40, magic: 45, rare: 13, epic: 1.9, legendary: .1 }) }),
});

export function getLootTable(rank: EnemyRank): EnemyLootTable { return ENEMY_LOOT_TABLES[rank]; }

/** All twelve equipment kinds remain eligible. The foe's archetype supplies a readable tendency. */
export const ENEMY_ITEM_KIND_WEIGHTS: Readonly<Record<EnemyKind, Readonly<Record<ItemKind, number>>>> = Object.freeze({
  goblin: Object.freeze({ grimoire: 1, orb: 1, weapon: 30, shield: 8, head: 5, chest: 5, gloves: 8, legs: 8, boots: 14, cloak: 6, amulet: 3, ring: 11 }),
  goblinChief: Object.freeze({ grimoire: 1, orb: 1, weapon: 30, shield: 14, head: 12, chest: 10, gloves: 6, legs: 6, boots: 6, cloak: 6, amulet: 3, ring: 5 }),
  stalker: Object.freeze({ grimoire: 2, orb: 2, weapon: 28, shield: 6, head: 8, chest: 8, gloves: 10, legs: 8, boots: 12, cloak: 8, amulet: 3, ring: 5 }),
  brute: Object.freeze({ grimoire: 2, orb: 2, weapon: 23, shield: 18, head: 10, chest: 15, gloves: 7, legs: 10, boots: 5, cloak: 3, amulet: 2, ring: 3 }),
  hound: Object.freeze({ grimoire: 2, orb: 2, weapon: 14, shield: 5, head: 5, chest: 7, gloves: 13, legs: 10, boots: 22, cloak: 10, amulet: 5, ring: 5 }),
  archer: Object.freeze({ grimoire: 2, orb: 2, weapon: 34, shield: 3, head: 7, chest: 6, gloves: 11, legs: 7, boots: 10, cloak: 8, amulet: 4, ring: 6 }),
  wisp: Object.freeze({ grimoire: 10, orb: 10, weapon: 20, shield: 3, head: 8, chest: 4, gloves: 4, legs: 4, boots: 6, cloak: 15, amulet: 8, ring: 8 }),
  caster: Object.freeze({ grimoire: 10, orb: 10, weapon: 28, shield: 3, head: 6, chest: 6, gloves: 5, legs: 5, boots: 5, cloak: 14, amulet: 4, ring: 4 }),
});

export interface BiomeProfileWeights {
  readonly weapon: Readonly<Record<string, number>>;
  readonly grimoire: Readonly<Record<string, number>>;
  readonly orb: Readonly<Record<string, number>>;
  readonly shield: Readonly<Record<string, number>>;
}

/** Relative weights within a dropped weapon/shield; a weight of one is still fully eligible. */
export const BIOME_PROFILE_WEIGHTS: Readonly<Record<BiomeId, BiomeProfileWeights>> = Object.freeze({
  deadwood: Object.freeze({
    weapon: Object.freeze({ longsword: 3, 'hand-axe': 1, 'flanged-mace': 2, 'rondel-dagger': 1,
      greatblade: 3, greataxe: 2, 'grave-maul': 3, 'thorn-shortbow': 1, 'crescent-recurve': 1,
      'warden-longbow': 1, 'ember-staff': 2, 'rime-staff': 1, 'storm-staff': 1, 'cinder-wand': 2, 'hoarfrost-wand': 1, 'spark-wand': 1, 'star-wand': 2 }),
    grimoire: Object.freeze({ 'ember-codex': 2, 'rime-folio': 1, 'astral-grimoire': 1 }),
    orb: Object.freeze({ 'cinder-orb': 2, 'rime-orb': 1, 'astral-orb': 1 }),
    shield: Object.freeze({ 'iron-buckler': 1, 'vigil-kite': 2, 'bastion-tower': 3 }),
  }),
  verdant: Object.freeze({
    weapon: Object.freeze({ longsword: 1, 'hand-axe': 2, 'flanged-mace': 1, 'rondel-dagger': 3,
      greatblade: 1, greataxe: 1, 'grave-maul': 1, 'thorn-shortbow': 3, 'crescent-recurve': 4,
      'warden-longbow': 3, 'ember-staff': 1, 'rime-staff': 1, 'storm-staff': 1, 'cinder-wand': 1, 'hoarfrost-wand': 1, 'spark-wand': 1, 'star-wand': 2 }),
    grimoire: Object.freeze({ 'ember-codex': 1, 'rime-folio': 1, 'astral-grimoire': 1 }),
    orb: Object.freeze({ 'cinder-orb': 1, 'rime-orb': 1, 'astral-orb': 1 }),
    shield: Object.freeze({ 'iron-buckler': 3, 'vigil-kite': 2, 'bastion-tower': 1 }),
  }),
  swamp: Object.freeze({
    weapon: Object.freeze({ longsword: 1, 'hand-axe': 1, 'flanged-mace': 1, 'rondel-dagger': 2,
      greatblade: 1, greataxe: 1, 'grave-maul': 1, 'thorn-shortbow': 1, 'crescent-recurve': 1,
      'warden-longbow': 1, 'ember-staff': 2, 'rime-staff': 4, 'storm-staff': 3, 'cinder-wand': 2, 'hoarfrost-wand': 4, 'spark-wand': 3, 'star-wand': 2 }),
    grimoire: Object.freeze({ 'ember-codex': 2, 'rime-folio': 4, 'astral-grimoire': 3 }),
    orb: Object.freeze({ 'cinder-orb': 2, 'rime-orb': 4, 'astral-orb': 3 }),
    shield: Object.freeze({ 'iron-buckler': 3, 'vigil-kite': 1, 'bastion-tower': 1 }),
  }),
  frostpine: Object.freeze({
    weapon: Object.freeze({ longsword: 1, 'hand-axe': 2, 'flanged-mace': 1, 'rondel-dagger': 1,
      greatblade: 1, greataxe: 2, 'grave-maul': 2, 'thorn-shortbow': 2, 'crescent-recurve': 2,
      'warden-longbow': 3, 'ember-staff': 1, 'rime-staff': 5, 'storm-staff': 2, 'cinder-wand': 1, 'hoarfrost-wand': 5, 'spark-wand': 2, 'star-wand': 2 }),
    grimoire: Object.freeze({ 'ember-codex': 1, 'rime-folio': 5, 'astral-grimoire': 2 }),
    orb: Object.freeze({ 'cinder-orb': 1, 'rime-orb': 5, 'astral-orb': 2 }),
    shield: Object.freeze({ 'iron-buckler': 1, 'vigil-kite': 3, 'bastion-tower': 2 }),
  }),
  emberfall: Object.freeze({
    weapon: Object.freeze({ longsword: 1, 'hand-axe': 2, 'flanged-mace': 3, 'rondel-dagger': 1,
      greatblade: 2, greataxe: 4, 'grave-maul': 3, 'thorn-shortbow': 1, 'crescent-recurve': 1,
      'warden-longbow': 1, 'ember-staff': 5, 'rime-staff': 1, 'storm-staff': 1, 'cinder-wand': 5, 'hoarfrost-wand': 1, 'spark-wand': 1, 'star-wand': 2 }),
    grimoire: Object.freeze({ 'ember-codex': 5, 'rime-folio': 1, 'astral-grimoire': 1 }),
    orb: Object.freeze({ 'cinder-orb': 5, 'rime-orb': 1, 'astral-orb': 1 }),
    shield: Object.freeze({ 'iron-buckler': 1, 'vigil-kite': 2, 'bastion-tower': 4 }),
  }),
  autumn: Object.freeze({
    weapon: Object.freeze({ longsword: 2, 'hand-axe': 3, 'flanged-mace': 1, 'rondel-dagger': 4,
      greatblade: 1, greataxe: 1, 'grave-maul': 1, 'thorn-shortbow': 3, 'crescent-recurve': 3,
      'warden-longbow': 2, 'ember-staff': 1, 'rime-staff': 1, 'storm-staff': 2, 'cinder-wand': 1, 'hoarfrost-wand': 1, 'spark-wand': 2, 'star-wand': 2 }),
    grimoire: Object.freeze({ 'ember-codex': 1, 'rime-folio': 1, 'astral-grimoire': 2 }),
    orb: Object.freeze({ 'cinder-orb': 1, 'rime-orb': 1, 'astral-orb': 2 }),
    shield: Object.freeze({ 'iron-buckler': 4, 'vigil-kite': 2, 'bastion-tower': 1 }),
  }),
  highlands: Object.freeze({
    weapon: Object.freeze({ longsword: 3, 'hand-axe': 1, 'flanged-mace': 3, 'rondel-dagger': 1,
      greatblade: 3, greataxe: 2, 'grave-maul': 3, 'thorn-shortbow': 1, 'crescent-recurve': 1,
      'warden-longbow': 4, 'ember-staff': 1, 'rime-staff': 1, 'storm-staff': 4, 'cinder-wand': 1, 'hoarfrost-wand': 1, 'spark-wand': 4, 'star-wand': 2 }),
    grimoire: Object.freeze({ 'ember-codex': 1, 'rime-folio': 1, 'astral-grimoire': 4 }),
    orb: Object.freeze({ 'cinder-orb': 1, 'rime-orb': 1, 'astral-orb': 4 }),
    shield: Object.freeze({ 'iron-buckler': 1, 'vigil-kite': 3, 'bastion-tower': 3 }),
  }),
});

/** Numerous fragile followers carry less equipment and coin than full-strength foes. */
export const ENEMY_LOOT_YIELD: Readonly<Partial<Record<EnemyKind, number>>> = Object.freeze({ goblin: .3 });
