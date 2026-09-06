import assert from 'node:assert/strict';
import test from 'node:test';
import { armorReduction, itemPowerScale, MAX_CONTENT_LEVEL, normalizeLevel } from '../src/progression-content.ts';
import { enemyLootSeed, getZoneAt, scaledEnemyStats } from '../src/zone-progression.ts';
import { deriveCharacterStats } from '../src/character-stats.ts';
import { createCharacterSheet } from '../src/items.ts';

test('regional danger has a safe start, fixed identities, and uneven nearby levels', () => {
  for (const seed of [7319,18427,90210]) {
    assert.equal(getZoneAt(0,0,seed).level,1);
    const levels=new Set<number>(), hazards=[];
    for(let angle=0;angle<6.28;angle+=.18)levels.add(getZoneAt(Math.cos(angle)*10000,Math.sin(angle)*10000,seed).level);
    assert.ok(levels.size>=3,'equal distances have varied regional danger');
    for(let y=-12000;y<=12000;y+=2400)for(let x=-12000;x<=12000;x+=2400){const z=getZoneAt(x,y,seed);if(z.hazardous)hazards.push(z);assert.equal(getZoneAt(z.x,z.y,seed).id,z.id);}
    assert.ok(hazards.length>0);
  }
});

test('invalid coordinates and content levels have finite bounded results', () => {
  for (const coordinate of [NaN,Infinity,-Infinity]) assert.equal(getZoneAt(coordinate,1).level,1);
  assert.deepEqual([0,-1,2.9,NaN,1e12].map(normalizeLevel),[1,1,2,1,MAX_CONTENT_LEVEL]);
});

test('normal enemies and rank multipliers use one authored source-level curve', () => {
  assert.deepEqual([1, 5, 10, 20, 50].map(level => scaledEnemyStats('stalker', level, 'normal')),
    [{ maxHp: 48, damage: 8, xpReward: 20 }, { maxHp: 89, damage: 12, xpReward: 34 },
      { maxHp: 156, damage: 16, xpReward: 52 }, { maxHp: 341, damage: 25, xpReward: 88 },
      { maxHp: 1307, damage: 51, xpReward: 196 }]);
  assert.deepEqual(scaledEnemyStats('stalker', 1, 'elite'), { maxHp: 192, damage: 12, xpReward: 100 });
  for (const kind of ['stalker', 'brute', 'caster'] as const) {
    const deep = scaledEnemyStats(kind, MAX_CONTENT_LEVEL, 'elite');
    assert.ok(Object.values(deep).every(value => Number.isSafeInteger(value) && value > 0));
  }
});

test('matching-level armor investment holds its mitigation while stronger attackers reduce its protection', () => {
  for (const level of [1, 5, 20, 50, MAX_CONTENT_LEVEL]) {
    assert.ok(Math.abs(armorReduction(120 * itemPowerScale(level), level) - .5) < 1e-10);
  }
  assert.ok(armorReduction(120, 10) < armorReduction(120, 1));
  assert.equal(armorReduction(1e12, 1), .8);
  assert.equal(armorReduction(NaN, 1), 0);
  const sheet = createCharacterSheet(); sheet.equipped.chest!.implicit = { armor: 120 };
  assert.equal(deriveCharacterStats(sheet, {}, 10).damageReduction, armorReduction(120, 10));
});

test('loot source identity depends only on spawn seed, ordinal and original location', () => {
  assert.equal(enemyLootSeed(17, 4, -3300, 900), enemyLootSeed(17, 4, -3300, 900));
  const seeds = new Set(Array.from({ length: 1000 }, (_, i) => enemyLootSeed(17, i + 1, -3300, 900)));
  assert.equal(seeds.size, 1000);
  assert.notEqual(enemyLootSeed(17, 4, -3300, 900), enemyLootSeed(18, 4, -3300, 900));
  assert.notEqual(enemyLootSeed(17, 4, -3300, 900), enemyLootSeed(17, 4, -3301, 900));
});
