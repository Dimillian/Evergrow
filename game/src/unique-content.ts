import type { CharacterSheet, EquipmentSlot, Item, ItemKind, SkillId, StatKey } from './character-types.ts';
import type { ItemMaterialId } from './item-materials.ts';

export const UNIQUE_COLOR = '#ef82ad';
export const UNIQUE_EDGE = '#ba8bf1';
export const UNIQUE_SYMBOL = '✧';
export const UNIQUE_RULES = Object.freeze({ storedCasts: 3, emberLifetime: 20, shieldSpeed: 380, shieldRange: 220,
  wardRadius: 140, wardSpellCap: 3, novaRange: 420, decoyDuration: 2, decoyLife: .2, returnWindow: 2, fissureRange: 350, fissureSpeed: 310, shatterDelay: .6, shatterRadius: 70, borrowedLife: .2, borrowedDuration: 4 });
export interface UniqueDefinition {
  readonly id: string; readonly name: string; readonly kind: ItemKind; readonly profile?: string;
  readonly material: ItemMaterialId; readonly skill: SkillId; readonly power: string;
  readonly affixes: readonly StatKey[];
}
export const UNIQUES: readonly UniqueDefinition[] = Object.freeze([
  {id:'dervish-grasp',name:'Dervish’s Grasp',kind:'gloves',material:'leather',skill:'whirlwind',
    power:'Hold Whirlwind to spin while moving at full speed. Each revolution deals its normal damage and costs its normal mana.',
    affixes:['attackSpeedPercent','damagePercent','areaPercent','maxHp']},
  {id:'returning-verdict',name:'Returning Verdict',kind:'shield',profile:'iron-buckler',material:'iron',skill:'shieldBash',
    power:'Shield Bash throws your shield outward and back. Each enemy can be struck and stunned once on each journey.',
    affixes:['damagePercent','blockChance','armor','areaPercent']},
  {id:'homeward-thorn',name:'Homeward Thorn',kind:'weapon',profile:'crescent-recurve',material:'ashwood',skill:'volley',
    power:'Thorn Volley arrows return to their firing position. Each journey has its own hits and piercing allowance.',
    affixes:['damagePercent','attackSpeedPercent','critChance','critDamage']},
  {id:'cinderheart-testament',name:'Cinderheart Testament',kind:'grimoire',profile:'ember-codex',material:'leather',skill:'fireball',
    power:'Fireball stores up to 3 paid casts for 20 seconds. Your next basic attack releases every stored fireball toward your aim.',
    affixes:['spellDamagePercent','intelligence','maxHp','spellweavePercent']},
  {id:'winters-reach',name:'Winter’s Reach',kind:'orb',profile:'rime-orb',material:'glass',skill:'iceNova',
    power:'Ice Nova erupts at your aim, up to 420 reach. Echoing Frost repeats at the same position. Solid terrain blocks targeting.',
    affixes:['spellDamagePercent','areaPercent','castSpeedPercent','maxHp']},
  {id:'broken-seal',name:'The Broken Seal',kind:'grimoire',profile:'astral-grimoire',material:'leather',skill:'runicWard',
    power:'When enemy damage breaks Runic Ward, release an arcane explosion equal to damage absorbed, capped at 300% weapon spell damage. Expiration does not trigger it.',
    affixes:['spellDamagePercent','maxHp','armor','intelligence']},
  {id:'ashen-double',name:'Ashen Double',kind:'cloak',material:'cloth',skill:'smokeVeil',
    power:'Smoke Veil leaves a fragile double for 2 seconds. Nearby ordinary enemies may attack it; already committed attacks, elites and bosses are not redirected.',
    affixes:['dexterity','maxHp','armor','critChance']},
  {id:'duelists-return',name:'Duelist’s Return',kind:'boots',material:'leather',skill:'lunge',
    power:'After Lunge, reactivate within 2 seconds to dash back toward your starting position. Returning costs no mana, deals no damage and does not reset the cooldown.',
    affixes:['moveSpeedPercent','damagePercent','maxHp','armor']},
  {id:'gravetide',name:'Gravetide',kind:'weapon',profile:'grave-maul',material:'iron',skill:'earthshatter',
    power:'Earthshatter sends a traveling fissure along your aim. It carries the full damage and stun through each enemy once, stopping at solid terrain.',
    affixes:['damagePercent','strength','areaPercent','critDamage']},
  {id:'pale-huntsman',name:'Pale Huntsman’s Signet',kind:'ring',profile:'garnet-band',material:'silver',skill:'ghostHunt',
    power:'Ghost Hunt leaves a spectral archer at your casting position. Your arrow actions trigger its finite echoes toward your aim while you reposition.',
    affixes:['damagePercent','dexterity','critChance','maxHp']},
  {id:'rimeheart-spire',name:'Rimeheart Spire',kind:'weapon',profile:'hoarfrost-wand',material:'ashwood',skill:'frostLance',
    power:'Frost Lances lodge at their final contact and shatter after 0.6 seconds, dealing their full damage and slow in a small area. Piercing hits remain intact.',
    affixes:['spellDamagePercent','castSpeedPercent','intelligence','areaPercent']},
  {id:'borrowed-life',name:'Vessel of Borrowed Life',kind:'amulet',profile:'warden-amulet',material:'silver',skill:'siphon',
    power:'Unused Soul Siphon healing becomes a barrier for 4 seconds, up to 20% maximum life. It shares capacity with Runic Ward and cannot trigger The Broken Seal.',
    affixes:['maxHp','spellDamagePercent','intelligence','armor']},
].map(def => Object.freeze({...def,affixes:Object.freeze(def.affixes)})) as UniqueDefinition[]);
export function uniqueSlot(definition:UniqueDefinition):EquipmentSlot {
  const kind=definition.kind;return kind==='ring'?'ring1':['shield','grimoire','orb'].includes(kind)?'offhand':kind as EquipmentSlot;
}
export function uniqueDefinition(item: Pick<Item,'recipe'>): UniqueDefinition | undefined { return UNIQUES.find(u=>u.id===item.recipe.uniqueId); }
export function hasUnique(sheet: CharacterSheet, id: string): boolean {
  return Object.values(sheet.equipped).some(item=>item?.tier==='unique'&&item.recipe.uniqueId===id);
}
/** Preserve Legendary probability exactly; take the equal Unique share proportionally from lower tiers. */
export function withUniqueChance(weights: Readonly<Partial<Record<Item['tier'],number>>>): Record<Item['tier'],number> {
  const result={common:0,magic:0,rare:0,epic:0,legendary:0,unique:0,...weights};
  if(result.unique>0)return result;
  const other=result.common+result.magic+result.rare+result.epic;
  const unique=Math.min(other,result.legendary), factor=other?(other-unique)/other:1;
  for(const key of ['common','magic','rare','epic'] as const)result[key]*=factor;
  result.unique=unique;return result;
}
