import test from 'node:test';
import assert from 'node:assert/strict';
import { BIOME_PROFILE_WEIGHTS, ENEMY_ITEM_KIND_WEIGHTS, ENEMY_LOOT_TABLES, getLootTable } from '../src/loot-content.ts';
import { enemyLootCount, lootItemLevel, rollEnemyLoot, selectLootWeight } from '../src/loot.ts';
import { ITEM_KINDS } from '../src/items.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../src/weapon-content.ts';
import { BIOMES, type BiomeId } from '../src/biomes.ts';
import type { EnemyRank } from '../src/progression-content.ts';

const ranks: readonly EnemyRank[] = ['normal', 'veteran', 'elite'];
const biomes = Object.keys(BIOMES) as BiomeId[];
const source = { seed: 410, level: 12, rank: 'elite' as const, biome: 'swamp' as const, kind: 'caster' as const };

test('reward content is deeply immutable and every authored weight table is complete', () => {
  assert.ok(Object.isFrozen(ENEMY_LOOT_TABLES));
  for (const rank of ranks) {
    const table = getLootTable(rank);
    assert.ok(Object.isFrozen(table) && Object.isFrozen(table.tierWeights));
    assert.equal(Object.values(table.tierWeights).reduce((total, weight) => total + weight, 0), 100);
    assert.ok(table.bonusItemChance >= 0 && table.bonusItemChance <= 1);
  }
  assert.ok(Object.isFrozen(ENEMY_ITEM_KIND_WEIGHTS));
  for (const weights of Object.values(ENEMY_ITEM_KIND_WEIGHTS)) {
    assert.ok(Object.isFrozen(weights));
    assert.deepEqual(Object.keys(weights).sort(), [...ITEM_KINDS].sort());
    assert.equal(Object.values(weights).reduce((sum, weight) => sum + weight, 0), 100);
    assert.ok(Object.values(weights).every(weight => weight > 0));
  }
  assert.ok(Object.isFrozen(BIOME_PROFILE_WEIGHTS));
  assert.deepEqual(Object.keys(BIOME_PROFILE_WEIGHTS).sort(), Object.keys(BIOMES).sort());
  for (const biome of biomes) {
    const profiles = BIOME_PROFILE_WEIGHTS[biome];
    assert.ok(Object.isFrozen(profiles) && Object.isFrozen(profiles.weapon) && Object.isFrozen(profiles.shield));
    assert.deepEqual(Object.keys(profiles.weapon).sort(), WEAPON_PROFILES.map(profile => profile.id).sort());
    assert.deepEqual(Object.keys(profiles.shield).sort(), SHIELD_PROFILES.map(profile => profile.id).sort());
    assert.ok([...Object.values(profiles.weapon), ...Object.values(profiles.shield)].every(weight => weight > 0));
  }
});

test('rank count thresholds are exclusive, bounded, and first-kill gear only replaces a zero result', () => {
  for (const rank of ranks) {
    const table = getLootTable(rank);
    assert.equal(enemyLootCount(rank, 0), table.guaranteedItems + 1);
    assert.equal(enemyLootCount(rank, table.bonusItemChance - Number.EPSILON), table.guaranteedItems + 1);
    assert.equal(enemyLootCount(rank, table.bonusItemChance), table.guaranteedItems);
    assert.equal(enemyLootCount(rank, 1 - Number.EPSILON), table.guaranteedItems);
    assert.equal(enemyLootCount(rank, 1 - Number.EPSILON, true), Math.max(1, table.guaranteedItems));
    assert.equal(enemyLootCount(rank, 0, true), table.guaranteedItems + 1);
  }
  assert.equal(getLootTable('normal').bonusItemChance, .28);
  assert.equal(getLootTable('veteran').bonusItemChance, .7);
  assert.equal(getLootTable('elite').guaranteedItems + getLootTable('elite').bonusItemChance, 1.25);
  for (const invalid of [-1, 1, NaN, Infinity]) assert.throws(() => enemyLootCount('normal', invalid), RangeError);
});

test('conditional tier tables select the exact authored mass and zero-weight tiers never appear', () => {
  for (const rank of ranks) {
    const weights = getLootTable(rank).tierWeights;
    const counts = { common: 0, magic: 0, rare: 0, epic: 0, legendary: 0 };
    for (let index = 0; index < 10_000; index++) counts[selectLootWeight(weights, (index + .5) / 10_000)]++;
    for (const tier of Object.keys(counts) as (keyof typeof counts)[]) assert.equal(counts[tier], Math.round(weights[tier] * 100));
  }
  assert.equal(selectLootWeight(getLootTable('elite').tierWeights, 0), 'common');
  assert.equal(selectLootWeight(getLootTable('normal').tierWeights, .75), 'magic');
  assert.equal(selectLootWeight(getLootTable('normal').tierWeights, .97), 'rare');
  assert.equal(selectLootWeight(getLootTable('normal').tierWeights, .9971), 'epic');
  assert.equal(selectLootWeight(getLootTable('normal').tierWeights, .9999), 'legendary');
  assert.throws(() => selectLootWeight({ a: 0 }, .5), RangeError);
  assert.throws(() => selectLootWeight({ a: -1, b: 2 }, .5), RangeError);
  assert.throws(() => selectLootWeight({ a: Infinity }, .5), RangeError);
  assert.throws(() => selectLootWeight({ a: 1 }, 1), RangeError);
});

test('loot generation is repeatable, independent across calls, and each reward owns its item state', () => {
  const first = rollEnemyLoot(source), second = rollEnemyLoot(source);
  assert.deepEqual(first, second);
  for (let seed = 0; seed < 100; seed++) rollEnemyLoot({ ...source, seed });
  assert.deepEqual(second, rollEnemyLoot(source));
  first[0].name = 'Changed'; first[0].affixes.push({ name: 'Changed', stat: 'strength', value: 500 });
  first[0].appearance.base = '#000';
  assert.deepEqual(second, rollEnemyLoot(source));
});

test('rank owns item level and at most two individually seeded rewards at valid and malformed level boundaries', () => {
  for (const rank of ranks) {
    for (let seed = 0; seed < 300; seed++) {
      const items = rollEnemyLoot({ ...source, seed, rank, firstKill: true });
      assert.ok(items.length >= 1 && items.length <= (rank === 'elite' ? 2 : 1));
      assert.equal(new Set(items.map(item => item.id)).size, items.length);
      assert.equal(new Set(items.map(item => item.seed)).size, items.length);
      for (const item of items) {
        assert.equal(item.itemLevel, 12 + getLootTable(rank).itemLevelBonus);
        assert.equal(item.requiredLevel, item.itemLevel - 2);
        assert.ok(getLootTable(rank).tierWeights[item.tier] > 0);
      }
    }
    assert.equal(lootItemLevel(10.8, rank), 10 + getLootTable(rank).itemLevelBonus);
    assert.equal(lootItemLevel(1_000_000, rank), 1_000_000);
    for (const level of [NaN, Infinity, -Infinity, -1, 0]) {
      assert.equal(lootItemLevel(level, rank), 1 + getLootTable(rank).itemLevelBonus);
      for (const item of rollEnemyLoot({ ...source, level, rank, firstKill: true })) {
        assert.equal(item.itemLevel, lootItemLevel(level, rank));
      }
    }
  }
});

test('archetypes and biomes create authored tendencies without excluding any equipment profile', () => {
  assert.ok(ENEMY_ITEM_KIND_WEIGHTS.brute.shield > ENEMY_ITEM_KIND_WEIGHTS.stalker.shield);
  assert.ok(ENEMY_ITEM_KIND_WEIGHTS.caster.amulet > ENEMY_ITEM_KIND_WEIGHTS.stalker.amulet);
  assert.ok(ENEMY_ITEM_KIND_WEIGHTS.stalker.boots > ENEMY_ITEM_KIND_WEIGHTS.brute.boots);
  assert.ok(BIOME_PROFILE_WEIGHTS.verdant.weapon['crescent-recurve'] > BIOME_PROFILE_WEIGHTS.deadwood.weapon['crescent-recurve']);
  assert.ok(BIOME_PROFILE_WEIGHTS.swamp.weapon['rime-staff'] > BIOME_PROFILE_WEIGHTS.deadwood.weapon['rime-staff']);
  assert.ok(BIOME_PROFILE_WEIGHTS.deadwood.weapon['grave-maul'] > BIOME_PROFILE_WEIGHTS.verdant.weapon['grave-maul']);
  for (const biome of biomes) {
    const profiles = new Set<string>();
    for (let seed = 0; seed < 3000; seed++) {
      for (const item of rollEnemyLoot({ ...source, biome, seed, firstKill: true })) {
        if (item.weapon || item.shield) profiles.add(item.baseName);
      }
    }
    assert.deepEqual([...profiles].sort(), [...WEAPON_PROFILES, ...SHIELD_PROFILES].map(profile => profile.name).sort());
  }
});


test('climate changes profile tendencies without changing rank yield, rarity, or source item level', () => {
  for (let seed = 0; seed < 200; seed++) {
    for (const rank of ranks) {
      const rewards = biomes.map(biome => rollEnemyLoot({ ...source, biome, rank, seed }).map(item =>
        ({ tier: item.tier, kind: item.kind, level: item.itemLevel, required: item.requiredLevel })));
      for (const reward of rewards) assert.deepEqual(reward, rewards[0]);
    }
  }
});
