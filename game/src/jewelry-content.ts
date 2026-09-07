import type { ItemKind, StatModifiers, StatKey } from './character-types.ts';
export interface JewelryProfile { readonly id:string; readonly kind:'ring'|'amulet'; readonly name:string; readonly implicit:Readonly<StatModifiers>; readonly color:string; readonly affinity:readonly StatKey[] }
const profile=(id:string,kind:'ring'|'amulet',name:string,implicit:StatModifiers,color:string,affinity:StatKey[]):Readonly<JewelryProfile>=>Object.freeze({id,kind,name,implicit:Object.freeze(implicit),color,affinity:Object.freeze(affinity)});
export const JEWELRY_PROFILES=Object.freeze([
  profile('garnet-band','ring','Garnet Band',{damagePercent:2},'#d88273',['damagePercent','strength','dexterity','critChance','critDamage']),
  profile('sapphire-ring','ring','Sapphire Ring',{spellDamagePercent:2},'#769ede',['spellDamagePercent','intelligence','maxMana','manaRegen']),
  profile('moonstone-ring','ring','Moonstone Ring',{manaRegen:.3},'#b8b0e5',['maxMana','manaRegen','manaOnKill','intelligence']),
  profile('jade-signet','ring','Jade Signet',{maxHp:8},'#8fbc91',['maxHp','vitality','lifeRegen','maxMana']),
  profile('lion-pendant','amulet','Lion Pendant',{strength:2},'#dfa970',['strength','damagePercent','armor','lifeOnHit']),
  profile('hawk-talisman','amulet','Hawk Talisman',{dexterity:2},'#9dbb89',['dexterity','damagePercent','critChance','critDamage']),
  profile('sage-pendant','amulet','Sage Pendant',{intelligence:2},'#92a4e1',['intelligence','spellDamagePercent','maxMana','manaRegen']),
  profile('warden-amulet','amulet','Warden Amulet',{vitality:2},'#bc858b',['vitality','maxHp','armor','lifeRegen']),
]);
export const jewelryProfiles=(kind:ItemKind)=>JEWELRY_PROFILES.filter(p=>p.kind===kind);
