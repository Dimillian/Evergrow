import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, deriveItem, generateItem, rebalanceItemOffense } from '../src/items.ts';
import { deriveCharacterStats } from '../src/character-stats.ts';
import { validItem } from '../src/item-validation.ts';
import { addInventoryItem } from '../src/inventory.ts';

function rolledHead(level:number, stat:'intelligence'|'strength'|'spellDamagePercent'|'vitality') {
  const item=generateItem(555,level,'head',undefined,'epic',stat==='strength'||stat==='vitality'?'iron':'cloth');
  item.affixes=[{name:'Test',stat,value:1}];item.recipe.rolls=[.5];item.recipe.enhancement=5;
  return deriveItem(item);
}

test('allocated, equipment, charm and tree attributes share the reduced conversion in combat',()=>{
  const sheet=createCharacterSheet();sheet.equipped.weapon=null;sheet.inventory.fill(null);
  sheet.attributes.strength+=20;sheet.attributes.intelligence+=20;
  const ring=generateItem(8,35,'ring','moonstone-ring','rare');
  ring.implicit={};ring.affixes=[{name:'Might',stat:'strength',value:10},{name:'Insight',stat:'intelligence',value:10}];sheet.equipped.ring1=ring;
  const charm=generateItem(9,35,'charm','storm-pebble','rare');charm.affixes=[{name:'Insight',stat:'intelligence',value:4}];
  assert.ok(addInventoryItem(sheet,charm));
  const stats=deriveCharacterStats(sheet,{strength:5,intelligence:5,damagePercent:20,spellDamagePercent:30},35);
  assert.equal(stats.attackDamageMultiplier,1.725);
  assert.equal(stats.spellDamageMultiplier,1.885);
  assert.equal(stats.maxMana,178);assert.equal(stats.manaRegeneration,1);
});

test('midgame offensive rolls taper while dedicated damage and Vitality keep their budgets',()=>{
  assert.equal(rolledHead(35,'intelligence').affixes[0].value,9);
  assert.equal(rolledHead(35,'strength').affixes[0].value,9);
  assert.equal(rolledHead(35,'spellDamagePercent').affixes[0].value,19);
  assert.equal(rolledHead(35,'vitality').affixes[0].value,18);
  const values=[1,10,20,35,50,100,1000000].map(l=>rolledHead(l,'intelligence').affixes[0].value);
  assert.ok(values.every(Number.isInteger));assert.ok(values.every((v,i)=>!i||v>=values[i-1]));
  assert.ok(values.at(-1)!<25);
  for(const profile of ['sage-pendant','lion-pendant']) {
    const item=generateItem(55,35,'amulet',profile,'epic');item.recipe.enhancement=5;
    const value=deriveItem(item).implicit[profile==='sage-pendant'?'intelligence':'strength']!;
    assert.ok(value>=8&&value<=14,`${profile}: ${value}`);
  }
  const stone=(size:string)=>{const item=generateItem(555,35,'charm','storm-'+size,'rare');item.affixes=[{name:'Insight',stat:'intelligence',value:1}];item.recipe.rolls=[.5];return deriveItem(item).affixes[0].value;};
  assert.equal(stone('pebble'),2);assert.equal(stone('monolith'),7);
});

test('existing offense reprices exactly once without altering dedicated damage or item identity',()=>{
  const item=generateItem(89,35,'amulet','sage-pendant','rare');
  item.affixes=[{name:'Insight',stat:'intelligence',value:99},{name:'Sorcery',stat:'spellDamagePercent',value:42}];
  item.recipe.rolls=[.3,.6];item.implicit={intelligence:99};item.locked=true;delete item.recipe.offenseVersion;
  const original=structuredClone(item),next=rebalanceItemOffense(item);
  assert.ok(validItem(next));assert.equal(next.id,item.id);assert.equal(next.locked,true);
  assert.deepEqual(next.recipe.rolls,item.recipe.rolls);assert.deepEqual(next.affixes[1],item.affixes[1]);
  assert.ok(next.affixes[0].value<99);assert.ok(next.implicit.intelligence!<99);
  assert.equal(rebalanceItemOffense(next),next);assert.deepEqual(item,original);
  assert.equal(validItem({...next,recipe:{...next.recipe,offenseVersion:2}}),false);
});
