import assert from 'node:assert/strict';
import test from 'node:test';
import { createCharacterSheet, deriveItem, generateItem, generateUnique, itemModifiers } from '../src/items.ts';
import { enhancementGains, enhancementStepGains, previewEnhancement } from '../src/service-presentation.ts';
import { improveItem, nextEnhancementLevel } from '../src/item-improvement.ts';

const stats = (item: ReturnType<typeof generateItem>) => ({ modifiers: itemModifiers(item), weapon: item.weapon, shield: item.shield, focus: item.focus });

test('every rank previews actual derived stats without changing item recipes or ownership', () => {
  const samples = (['weapon','shield','head','chest','ring','amulet','orb','grimoire','charm'] as const)
    .map((kind,i)=>generateItem(430+i,20,kind,undefined,'epic'));
  samples.push(generateUnique(910,20));
  for (const item of samples) {
    const before=JSON.stringify(item);
    for (let rank=0;rank<=10;rank++) {
      const preview=previewEnhancement(item,rank);
      assert.equal(preview.recipe.enhancement,rank);
      assert.equal(preview.id,item.id);
      assert.equal(preview.recipe.revision,item.recipe.revision);
      assert.deepEqual(stats(preview),stats(deriveItem({...item,recipe:{...item.recipe,enhancement:rank}})));
      assert.equal(JSON.stringify(item),before);
    }
  }
});

test('starter previews match every next effective paid upgrade, including rounded-away ranks', () => {
  const sheet=createCharacterSheet();
  for (const starting of Object.values(sheet.equipped).filter(item=>!!item)) {
    let item=starting!;
    assert.deepEqual(previewEnhancement(item,item.recipe.enhancement),item);
    while (nextEnhancementLevel(item)!==null) {
      const rank=nextEnhancementLevel(item)!;
      const preview=previewEnhancement(item,rank);
      const upgraded=improveItem(item,'enhance',20,1);
      assert.deepEqual(stats(preview),stats(upgraded));
      assert.deepEqual(enhancementGains(item,preview),enhancementGains(item,upgraded));
      assert.ok(enhancementGains(item,preview).length);
      item=upgraded;
    }
  }
});

test('preview rejects invalid ranks and unenhanceable keys', () => {
  const item=generateItem(430,20,'chest');
  for (const rank of [-1,11,1.5,NaN,Infinity]) assert.throws(()=>previewEnhancement(item,rank),RangeError);
  assert.throws(()=>previewEnhancement({...item,kind:'riftKey'},1),RangeError);
});


test('rank tooltips show just the preceding step, regardless of the currently owned rank', () => {
  const base=generateItem(231,20,'weapon',undefined,'epic');
  const expected=enhancementGains(previewEnhancement(base,4),previewEnhancement(base,5));
  assert.ok(expected.length);
  assert.notDeepEqual(expected,enhancementGains(base,previewEnhancement(base,5)));
  for (const ownedRank of [0,2,5,9,10]) {
    const item=previewEnhancement(base,ownedRank), before=JSON.stringify(item), next=nextEnhancementLevel(item);
    assert.deepEqual(enhancementStepGains(item,5),expected);
    assert.equal(JSON.stringify(item),before);
    assert.equal(nextEnhancementLevel(item),next);
  }
});

test('rank tooltips retain empty steps without inventing bonuses or changing free skips', () => {
  const item=createCharacterSheet().equipped.legs!;
  const original=JSON.stringify(item), next=nextEnhancementLevel(item);
  assert.deepEqual(enhancementStepGains(item,0),[]);
  assert.ok(Array.from({length:10},(_,i)=>i+1).some(rank=>enhancementStepGains(item,rank).length===0));
  for (let rank=1;rank<=10;rank++) {
    const rows=enhancementStepGains(item,rank);
    assert.deepEqual(rows,enhancementGains(previewEnhancement(item,rank-1),previewEnhancement(item,rank)));
  }
  assert.equal(JSON.stringify(item),original);
  assert.equal(nextEnhancementLevel(item),next);
});
