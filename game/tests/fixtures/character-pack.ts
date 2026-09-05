import { createCharacterSheet, generateItem } from '../../src/items.ts';
import type { CharacterSheet, ItemKind } from '../../src/character-types.ts';

/** Explicit gear corpus for inventory transaction tests; never part of a new character. */
export function stockTestGear(sheet: CharacterSheet): CharacterSheet {
  const gear: readonly [ItemKind, string?][] = [['weapon', 'longsword'], ['chest'], ['ring'], ['boots'],
    ['shield', 'iron-buckler'], ['weapon', 'thorn-shortbow'], ['weapon', 'ember-staff'], ['weapon', 'rondel-dagger']];
  gear.forEach(([kind, profile], index) => { sheet.inventory[index] = generateItem(4201 + index * 313, 1, kind, profile); });
  return sheet;
}
export function characterWithTestLoot(): CharacterSheet { return stockTestGear(createCharacterSheet()); }
