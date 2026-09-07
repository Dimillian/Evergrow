import assert from 'node:assert/strict';
import test from 'node:test';
import { ARMOR_PARTS, ARMOR_TINTS, tintedOutfit } from '../src/appearance-armor.ts';
import { createCharacterSheet } from '../src/items.ts';
import { outfitFromEquipment } from '../src/item-art.ts';

test('armor tinting isolates each material without changing items, silhouette or trim', () => {
  const sheet=createCharacterSheet('sword'), before=structuredClone(sheet), outfit=outfitFromEquipment(sheet);
  const original=structuredClone(outfit);
  for(const part of ARMOR_PARTS) for(const tint of ARMOR_TINTS) {
    const tinted=tintedOutfit(outfit,{[part.id]:tint.id},true);
    for(const other of ARMOR_PARTS) {
      if(other.id!==part.id) assert.equal(tinted[other.id],outfit[other.id]);
    }
    if(part.id==='cloak') {
      assert.equal(tinted.cloak?.seed,outfit.cloak?.seed);
      assert.equal(tinted.cloak?.trim,outfit.cloak?.trim);
      if(outfit.cloak) assert.notEqual(tinted.cloak?.base,outfit.cloak.base);
    } else {
      const result=tinted[part.id], source=outfit[part.id];
      assert.equal(result?.seed,source?.seed);assert.equal(result?.style,source?.style);
      assert.equal(result?.material.trim,source?.material.trim);
      if(source) assert.notEqual(result?.material.base,source.material.base);
    }
  }
  assert.deepEqual(outfit,original);assert.deepEqual(sheet,before);
});

test('original colors and helmet visibility are independent reversible projections', () => {
  const outfit=outfitFromEquipment(createCharacterSheet('sword'));
  const hidden=tintedOutfit(outfit,{head:'crimson',chest:'teal'},false);
  assert.equal(hidden.head,null);assert.ok(outfit.head);
  assert.notDeepEqual(hidden.chest,outfit.chest);
  assert.deepEqual(tintedOutfit(outfit,{},true),outfit);
  assert.equal(tintedOutfit(outfit,{},false).head,null);
  assert.deepEqual(tintedOutfit(outfit,{head:'crimson'},true).head,tintedOutfit(outfit,{head:'crimson',chest:'teal'},true).head);
  assert.deepEqual(tintedOutfit({head:null,chest:null},{head:'crimson',chest:'teal'},true),{head:null,chest:null});
});
