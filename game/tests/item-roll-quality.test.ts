import test from 'node:test';
import assert from 'node:assert/strict';
import { itemRollMultiplier } from '../src/item-roll-content.ts';
import { deriveItem, generateItem, rebalanceItemRolls, ITEM_KINDS } from '../src/items.ts';
import { validItem } from '../src/item-validation.ts';

test('wider rolls preserve midpoint and give excellent gear substantially higher bonuses',()=>{
  assert.equal(itemRollMultiplier(0),.65);assert.equal(itemRollMultiplier(.5),1);assert.equal(itemRollMultiplier(1),1.35);
  const item=generateItem(555,35,'gloves',undefined,'legendary','cloth');
  item.affixes=[{name:'Invocation',stat:'castSpeedPercent',value:1}];
  const values=[0,.5,1].map(q=>{item.recipe.rolls=[q];return deriveItem(item).affixes[0].value;});
  assert.deepEqual(values,[22,34,45]);
  const charm=generateItem(555,35,'charm','storm-monolith','rare');charm.recipe.rolls=charm.recipe.rolls.map(()=>0);
  const low=deriveItem(charm);charm.recipe.rolls=charm.recipe.rolls.map(()=>1);const high=deriveItem(charm);
  assert.ok(high.affixes.every((a,i)=>a.value>=low.affixes[i].value));assert.ok(high.affixes.some((a,i)=>a.value>low.affixes[i].value*1.5));
});

test('fresh generation and service reconstruction use identical roll ranges for every item kind',()=>{
  for(const kind of ITEM_KINDS)for(let seed=0;seed<30;seed++){
    const item=generateItem(seed,35,kind,undefined,'legendary');
    assert.deepEqual(deriveItem(item).affixes,item.affixes,`${kind} ${seed}`);assert.ok(validItem(item));
  }
});

test('old quality rolls reprice once, preserving percentile, unrelated implicit, identity and enhancement',()=>{
  const item=generateItem(8,35,'weapon','ember-staff','epic');
  item.affixes=[{name:'Sorcery',stat:'spellDamagePercent',value:1},{name:'Insight',stat:'intelligence',value:1},{name:'Precision',stat:'critChance',value:1}];
  item.recipe.rolls=[.95,.1,.7];item.recipe.enhancement=5;delete item.recipe.rollVersion;item.locked=true;
  const before=structuredClone(item),current=rebalanceItemRolls(item);
  assert.deepEqual(current.affixes,deriveItem(item).affixes);assert.deepEqual(current.implicit,item.implicit);
  assert.deepEqual(current.weapon,item.weapon);assert.equal(current.locked,true);assert.equal(current.id,item.id);
  assert.deepEqual(current.recipe.rolls,item.recipe.rolls);assert.equal(current.recipe.enhancement,5);assert.ok(validItem(current));
  assert.equal(rebalanceItemRolls(current),current);assert.deepEqual(item,before);
  assert.equal(validItem({...current,recipe:{...current.recipe,rollVersion:2}}),false);
});
