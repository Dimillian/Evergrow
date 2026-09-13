import { AURA_RULES, admittedAuras, auraRank, resolveAura, type AuraId } from './aura-content.ts';
import type { Player, Enemy, ProjectileStyle } from './model.ts';
import { isBossKind } from './encounter-scaling.ts';
import { deriveAttackStats } from './equipment.ts';
import { applySlow } from './combat-status.ts';
export interface AuraState {
 powers: Partial<Record<AuraId,number>>; reservation:number; baseManaCost:number;
 blood?: {target:number;stacks:number;remaining:number}; still:number; pulse:number; element:number;
}
/** Rebuilt only with character commands/restoration, never from presentation. */
export function syncAuras(p:Player):void {
 const previous=p.auras;
 const powers:Partial<Record<AuraId,number>>={};let reservation=0;
 for(const id of admittedAuras(p.character)){
  const aura=resolveAura(id,auraRank(p.character,id));
  // Invalid imported combinations fail closed; bar order determines admitted auras.
  if(reservation+aura.reservation>=100)continue;
  reservation+=aura.reservation;powers[id]=aura.power;
 }
 p.auras={powers,reservation,baseManaCost:p.derived.manaCostMultiplier,still:powers.stillwater&&previous?.powers.stillwater?previous.still:0,
  blood:powers.bloodOath&&previous?.powers.bloodOath?previous.blood:undefined,
  pulse:previous?.pulse??AURA_RULES.pulseInterval,element:previous?.element??0};
 p.derived.manaCostMultiplier*=auraCostMultiplier(p);
 p.mana=Math.min(p.mana,manaCapacity(p));
}
export function auraPower(p:Player,id:AuraId):number {return p.dead?0:p.auras?.powers[id]??0;}
export function manaCapacity(p:Player):number {return Math.max(1,Math.floor(p.maxMana*(1-(p.auras?.reservation??0)/100)+1e-9));}
export function auraCostMultiplier(p:Player):number {return 1-auraPower(p,'stillwater')/100*Math.min(1,(p.auras?.still??0)/AURA_RULES.stillDuration);}
export function bloodOathHit(p:Player,enemy:Enemy,melee:boolean):number {
 const power=auraPower(p,'bloodOath');if(!power||!melee||!p.auras)return 1;
 const previous=p.auras.blood,stacks=previous?.target===enemy.id&&previous.remaining>0?previous.stacks:0;
 p.auras.blood={target:enemy.id,stacks:Math.min(AURA_RULES.bloodStacks,stacks+1),remaining:AURA_RULES.bloodDuration};
 return 1+stacks*power/100;
}
export function resonanceHit(p:Player,e:Enemy,style:ProjectileStyle|undefined,periodic:boolean):number {
 const element=style==='spirit'?'arcane':style;
 if(!element||element==='arrow')return 1;
 const existing=e.auraExposure?.[element],bonus=existing&&existing.remaining>0?existing.power:0;
 const power=auraPower(p,'elementalResonance');
 if(power&&!periodic)(e.auraExposure??={})[element]={power,remaining:AURA_RULES.exposureDuration};
 return 1+bonus/100;
}
/** Short-range pulses share existing collision, damage/status owners and effect budgets. */
export function advanceAuras(p:Player,enemies:readonly Enemy[],dt:number,moving:boolean,
 visible:(ax:number,ay:number,bx:number,by:number)=>boolean,
 hit:(enemy:Enemy,damage:number,style:ProjectileStyle)=>void,
 pulse:(style:ProjectileStyle,radius:number)=>void):void {
 const s=p.auras;if(!s||p.dead)return;
 if(s.blood&&((s.blood.remaining-=dt)<=0||!enemies.some(e=>e.id===s.blood!.target&&e.state!=='dead')))delete s.blood;
 s.still=s.powers.stillwater?(moving?0:Math.min(AURA_RULES.stillDuration,s.still+dt)):0;
 p.derived.manaCostMultiplier=s.baseManaCost*auraCostMultiplier(p);
 if(!s.powers.thornbound&&!s.powers.elementalSpikes)return;
 s.pulse-=dt;if(s.pulse>0)return;s.pulse=AURA_RULES.pulseInterval;
 const slow=s.powers.thornbound??0,spikes=s.powers.elementalSpikes??0;
 const weapon=[p.equipment.mainHand,...(p.equipment.offHand?.kind==='weapon'?[p.equipment.offHand.weapon]:[])].find(w=>w.attackKind==='melee');
 const element=(['fire','frost','lightning'] as const)[s.element%3];
 const damage=weapon?deriveAttackStats(p.stats,weapon).damage*spikes/100:0;
 let struck=false;
 for(const e of enemies){
  if(e.state==='dead')continue;const range=Math.hypot(e.x-p.x,e.y-p.y);
  if(range>90+e.radius||!visible(p.x,p.y,e.x,e.y))continue;
  // Keep proximity coverage continuous; applySlow halves boss durations too.
  // Boss resistance is expressed by half potency here, not gaps between pulses.
  const boss=isBossKind(e.kind);
  if(slow)applySlow(e,{duration:(AURA_RULES.pulseInterval+.05)*(boss?2:1),factor:1-slow/100*(boss?.5:1)});
  if(damage&&range<=70+e.radius){hit(e,damage,element);struck=true;}
 }
 if(struck)pulse(element,70);
 s.element=(s.element+1)%3;
}
