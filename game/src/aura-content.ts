import type { CharacterSheet } from './character-types.ts';

export const AURA_IDS = ['ironroot','bloodOath','hawkeye','thornbound','elementalResonance','stillwater','elementalSpikes'] as const;
export type AuraId = typeof AURA_IDS[number];
export const AURA_RULES = Object.freeze({ rankPower: .03, rankReservation: .25, maximumRank: 20,
  bloodStacks: 5, bloodDuration: 3, stillDuration: 1.2, pulseInterval: .6, exposureDuration: 3, distantRange: 180, thornRadius: 90, spikeRadius: 70 });
export const AURAS = Object.freeze({
 ironroot: {name:'Ironroot',description:'Strengthens armor and reduces physical hit damage.',domain:'Might',color:'#b8c49a',reservation:35,power:40,territory:'bastion',points:20},
 bloodOath: {name:'Blood Oath',description:'Consecutive melee hits against one enemy build damage. Changing targets resets the oath.',domain:'Might',color:'#df8794',reservation:45,power:4,territory:'forge',points:25},
 hawkeye: {name:'Hawkeye',description:'Arrows fly faster and farther. Distant arrow hits gain critical chance.',domain:'Cunning',color:'#d9daa1',reservation:35,power:20,territory:'hunt',points:29},
 thornbound: {name:'Thornbound',description:'Slows nearby enemies while they remain close. Bosses resist the slow.',domain:'Cunning',color:'#a4c997',reservation:40,power:20,territory:'veil',points:30},
 elementalResonance: {name:'Elemental Resonance',description:'Elemental hits expose enemies to that element. Exposure refreshes without stacking.',domain:'Arcana',color:'#cbb3ed',reservation:45,power:10,territory:'crucible',points:25},
 stillwater: {name:'Stillwater',description:'Standing still gradually reduces mana costs. Moving releases the focus.',domain:'Arcana',color:'#9ad5da',reservation:30,power:12,territory:'wellspring',points:20},
 elementalSpikes: {name:'Elemental Spikes',description:'Short-range spikes cycle through fire, frost and lightning, scaling with melee weapon damage.',domain:'Might',color:'#d9b5a4',reservation:40,power:30,territory:'forge',points:30},
} as const);
for(const aura of Object.values(AURAS))Object.freeze(aura);
export function isAura(id: string | null | undefined): id is AuraId { return !!id && Object.hasOwn(AURAS,id); }
export function auraRank(sheet: CharacterSheet, id: AuraId): number {
 const learned=Math.max(1,Math.min(AURA_RULES.maximumRank,sheet.skillRanks[id]??1));
 return Math.max(1,Math.min(learned,sheet.activeSkillRanks[id]??learned));
}
export function resolveAura(id: AuraId, rank=1) {
 const r=Math.max(1,Math.min(AURA_RULES.maximumRank,rank)),base=AURAS[id];
 return {id,rank:r,reservation:base.reservation-(r-1)*AURA_RULES.rankReservation,power:base.power*(1+(r-1)*AURA_RULES.rankPower)};
}
export function assignedAuras(sheet: CharacterSheet) { return [...new Set(sheet.skillSlots.filter(isAura))].filter(id=>sheet.allocatedNodes.includes(`skill:${id}`)); }
export function auraReservation(sheet: CharacterSheet): number { return assignedAuras(sheet).reduce((sum,id)=>sum+resolveAura(id,auraRank(sheet,id)).reservation,0); }
export function auraSummary(id: AuraId, rank=1): string {
 const {power}=resolveAura(id,rank),n=(v:number)=>Number(v.toFixed(1));
 switch(id){
  case 'ironroot': return `+${n(power)}% armor · ${n(power/8)}% less physical hit damage.`;
  case 'bloodOath': return `+${n(power)}% melee damage per stack · 5 stacks · 3s · one target.`;
  case 'hawkeye': return `+${n(power)}% arrow speed/reach · +${n(power/2)}% critical chance beyond 180 units.`;
  case 'thornbound': return `${n(power)}% slow within ${AURA_RULES.thornRadius} units · half effect on bosses.`;
  case 'elementalResonance': return `Hits expose their element for 3s: +${n(power)}% matching damage taken.`;
  case 'stillwater': return `Up to ${n(power)}% less mana cost after 1.2s standing still.`;
  case 'elementalSpikes': return `${n(power)}% melee weapon damage every ${AURA_RULES.pulseInterval}s within ${AURA_RULES.spikeRadius} units · fire → frost → lightning.`;
 }
}

/** Admission is shared by derivation and runtime, including malformed in-memory previews. */
export function admittedAuras(sheet: CharacterSheet) {
 let reserved=0;
 return assignedAuras(sheet).filter(id=>{const n=resolveAura(id,auraRank(sheet,id)).reservation;if(reserved+n>=100)return false;reserved+=n;return true;});
}
