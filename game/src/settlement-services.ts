/** Settlement size improves choice and odds; the region still owns item level. */
export type SettlementTier='settlement'|'village'|'city';
export const SETTLEMENT_SERVICES=Object.freeze({
 settlement:Object.freeze({smithStock:12,jewelerStock:8,premium:0,gamblePrice:1,gambleOdds:[45,38,14,2.8,.2] as readonly number[],materialBonus:1}),
 village:Object.freeze({smithStock:18,jewelerStock:12,premium:1,gamblePrice:1.35,gambleOdds:[30,46,20,3.7,.3] as readonly number[],materialBonus:1.7}),
 city:Object.freeze({smithStock:24,jewelerStock:16,premium:3,gamblePrice:1.8,gambleOdds:[15,52,27,5.5,.5] as readonly number[],materialBonus:2.6}),
});
for(const policy of Object.values(SETTLEMENT_SERVICES))Object.freeze(policy.gambleOdds);
export const servicePolicy=(npc:{settlementTier?:SettlementTier})=>SETTLEMENT_SERVICES[npc.settlementTier??'settlement'];
export const settlementBenefits=(tier:SettlementTier)=>tier==='city'?'City · premium stock · best gambling · focused enchanting':tier==='village'?'Village · premium stock · improved gambling':'Settlement · essentials · storage';
