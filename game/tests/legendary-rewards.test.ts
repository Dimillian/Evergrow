import { withUniqueChance } from '../src/unique-content.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_CHEST_LOOT_TABLES, ENEMY_LOOT_TABLES } from '../src/loot-content.ts';
import { rollEnemyLoot } from '../src/loot.ts';
import { eventRewards } from '../src/poi-rewards.ts';
import { EXPEDITION_RULES } from '../src/expedition-route.ts';

test('monster Legendary chances include zero-drop kills and the optional elite second item', () => {
  const probability = (rank: keyof typeof ENEMY_LOOT_TABLES) => {
    const t = ENEMY_LOOT_TABLES[rank], p = t.tierWeights.legendary / 100;
    return 1 - (1 - p) ** t.guaranteedItems * (1 - t.bonusItemChance * p);
  };
  for (const [rank, expected] of [['normal', .00014], ['veteran', .00105], ['elite', .00624375]] as const)
    assert.ok(Math.abs(probability(rank) - expected) < 1e-12);
});

test('boss chest odds cover all three rewards and the first can never be below Rare', () => {
  for (const [kind, chance] of [['dungeon', .05], ['raid', .10]] as const) {
    const tables = BOSS_CHEST_LOOT_TABLES[kind];
    assert.equal(tables.length, 3);
    assert.ok(Object.isFrozen(tables));
    assert.equal(tables[0].common + tables[0].magic, 0);
    assert.ok(Math.abs(1 - tables.reduce((p, t) => p * (1 - t.legendary / 100), 1) - chance) < 1e-12);
    for (const table of tables) {
      assert.ok(Object.isFrozen(table));
      assert.ok(Object.values(table).every(value => value >= 0));
      assert.ok(Math.abs(Object.values(table).reduce((a,b) => a+b, 0) - 100) < 1e-10);
    }
  }
  assert.deepEqual(EXPEDITION_RULES.stageRarity, withUniqueChance({rare:60,epic:35,legendary:5}));
  assert.deepEqual(EXPEDITION_RULES.grandRarity, withUniqueChance({rare:15,epic:65,legendary:20}));
});

test('seeded raid and dungeon reward generation uses the advertised tables and preserves identities on retry', () => {
  let raids = 0, dungeons = 0;
  for (let seed = 0; seed < 4000; seed++) {
    const record = {id:`lair:${seed}`,kind:'bossLair' as const,name:'Hoard',seed,level:35,biome:'deadwood' as const,
      x:0,y:0,phase:'completed' as const,choice:null,delivered:0,wavesCleared:0,bonusGranted:false};
    const raid = eventRewards(record).items;
    const dungeon = BOSS_CHEST_LOOT_TABLES.dungeon.map((tierWeights, i) => rollEnemyLoot({
      seed: seed + 2 * 1777 + i * 97, level:35, rank:(['normal','veteran','elite'] as const)[i],
      biome:'deadwood',kind:'stalker',firstKill:true,encounter:'bossChest',tierWeights,
    })[0]);
    assert.equal(raid.length, 3);
    assert.ok(['rare','epic','legendary','unique'].includes(raid[0].tier));
    assert.ok(['rare','epic','legendary','unique'].includes(dungeon[0].tier));
    raids += Number(raid.some(item => item.tier === 'legendary'));
    dungeons += Number(dungeon.some(item => item.tier === 'legendary'));
    if (seed === 3) assert.deepEqual(eventRewards(record).items, raid);
  }
  assert.ok(raids >= 320 && raids <= 480, String(raids));
  assert.ok(dungeons >= 150 && dungeons <= 250, String(dungeons));
});
