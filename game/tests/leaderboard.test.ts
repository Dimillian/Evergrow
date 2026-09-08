import test from 'node:test';
import assert from 'node:assert/strict';
import { equippedGearPower } from '../src/leaderboard.ts';
import { createCharacterSheet, generateItem, deriveItem } from '../src/items.ts';

test('gear power only measures equipped recipes, with empty slots contributing zero',()=>{
 const sheet=createCharacterSheet(),initial=equippedGearPower(sheet);
 sheet.inventory[0]=generateItem(901,100,'weapon','longsword','legendary');sheet.attributes.strength=99999;
 assert.equal(equippedGearPower(sheet),initial);
 sheet.equipped.weapon!.power=999999;assert.equal(equippedGearPower(sheet),initial);
 for(const slot of Object.keys(sheet.equipped) as (keyof typeof sheet.equipped)[])sheet.equipped[slot]=null;
 assert.equal(equippedGearPower(sheet),0);
 const staff=generateItem(91,25,'weapon','storm-staff','rare');sheet.equipped.weapon=staff;
 assert.equal(equippedGearPower(sheet),Math.round(deriveItem(staff).power*2/11));
});
test('enhancement raises gear power using the shared item derivation',()=>{
 const sheet=createCharacterSheet();const before=equippedGearPower(sheet);
 sheet.equipped.weapon!.recipe.enhancement=10;
 assert(equippedGearPower(sheet)>before);
});
