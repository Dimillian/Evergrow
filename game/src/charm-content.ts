import type { Item, ItemTier, StatKey } from './character-types.ts';
import type { AffixDefinition } from './equipment-affix-content.ts';

/** Conditional on an item reward; never an extra item or a chance per kill. */
export const CHARM_DROP_CHANCE = .05;
/** Equipment-kind weights total 100; normalize the charm weight to the same chance. */
export const CHARM_DROP_WEIGHT = 100 * CHARM_DROP_CHANCE / (1 - CHARM_DROP_CHANCE);

export const CHARM_SIZES = Object.freeze([
  { id: 'pebble', name: 'Pebble', width: 1, height: 1, affixes: 1, potency: .28, counts: [1,1,2,2,2], weight: 30 },
  { id: 'shard', name: 'Shard', width: 1, height: 2, affixes: 1, potency: .50, counts: [1,2,2,2,2], weight: 25 },
  { id: 'tablet', name: 'Tablet', width: 2, height: 2, affixes: 2, potency: .64, counts: [2,2,3,3,4], weight: 16 },
  { id: 'spire', name: 'Spire', width: 1, height: 3, affixes: 2, potency: .57, counts: [2,2,2,3,3], weight: 16 },
  { id: 'heart', name: 'Heartstone', width: 2, height: 3, affixes: 3, potency: .86, counts: [3,3,4,4,5], weight: 9 },
  { id: 'monolith', name: 'Monolith', width: 2, height: 4, affixes: 4, potency: 1.12, counts: [4,4,5,6,6], weight: 4 },
].map(value=>Object.freeze({...value,counts:Object.freeze(value.counts)})));
export const CHARM_FLAVORS = Object.freeze([
  { id:'ember', name:'Ember', base:'#713e37', edge:'#edb386', glow:'#ff9c69', stats:['fireResistance','maxHp'] },
  { id:'rime', name:'Rime', base:'#416576', edge:'#c4e9e6', glow:'#87dcf4', stats:['frostResistance','maxMana'] },
  { id:'storm', name:'Storm', base:'#454765', edge:'#d6c9f0', glow:'#c5afff', stats:['lightningResistance','attackSpeedPercent','castSpeedPercent'] },
  { id:'astral', name:'Astral', base:'#574272', edge:'#d2b9ed', glow:'#d1a1ff', stats:['arcaneResistance','xpGainPercent','manaRegen'] },
  { id:'jade', name:'Jade', base:'#355e4d', edge:'#aed2a0', glow:'#86edac', stats:['allResistance','lifeRegen','maxHp'] },
  { id:'amber', name:'Amber', base:'#76532d', edge:'#e4c179', glow:'#ffe39a', stats:['goldFindPercent','moveSpeedPercent','maxMana'] },
].map(value=>Object.freeze({...value,stats:Object.freeze(value.stats)})));
export const CHARM_PROFILES = Object.freeze(CHARM_SIZES.flatMap(size => CHARM_FLAVORS.map(flavor => Object.freeze({
  id:`${flavor.id}-${size.id}`, name:`${flavor.name} ${size.name}`, size, flavor,
}))));
export const charmProfile = (item: Pick<Item,'recipe'>) => CHARM_PROFILES.find(p=>p.id===item.recipe.profileId);
const tiers: Record<ItemTier,number> = {common:0,magic:1,rare:2,epic:3,legendary:4,unique:4};
export const charmAffixCount = (item: Pick<Item,'recipe'|'tier'>) => charmProfile(item)?.size.counts[tiers[item.tier]] ?? 1;
export const CHARM_UTILITY_AFFIXES: readonly AffixDefinition[] = Object.freeze([
  {name:'Prosperity',stat:'goldFindPercent',base:8,growth:.16,weight:2},
  {name:'Wisdom',stat:'xpGainPercent',base:5,growth:.1,weight:1.4},
].map(value=>Object.freeze(value)) as AffixDefinition[]);
export const CHARM_WEIGHTS: Partial<Record<StatKey,number>> = Object.freeze({
  fireResistance:2,frostResistance:2,lightningResistance:2,arcaneResistance:2,allResistance:.65,
  goldFindPercent:2,xpGainPercent:1.4,attackSpeedPercent:1.5,castSpeedPercent:1.5,maxHp:2,maxMana:2,
  manaRegen:1.2,lifeRegen:1.2,moveSpeedPercent:.6,manaCostPercent:.6,cooldownPercent:.4,
  vitality:.5,intelligence:.5,strength:.3,dexterity:.5,critChance:.3,critDamage:.3,damagePercent:.3,spellDamagePercent:.3,
});
export const CHARM_REWARD_CAPS = Object.freeze({ gold: 100, xp: 50 });

/** The first roll establishes the stone's identity, including after enchanting. */
export function charmThematicStat(item: Pick<Item,'recipe'>, stat: StatKey): boolean {
  return charmProfile(item)?.flavor.stats.includes(stat as never) ?? false;
}
