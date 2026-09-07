import { metric, type ChronicleProgress } from './chronicle.ts';
import type { CombatEvent, Enemy, Player } from './model.ts';
const hybridHits=new WeakMap<Player,Map<number,number>>();
export function trackChronicleEvent(p:Player,enemies:readonly Enemy[],e:CombatEvent):void {
 const c=p.chronicle;if(!c)return;
 switch(e.type){
 case 'hit': {
   const n=e.actualValue??e.value;metric(c,'damage',n);metric(c,e.periodic?'periodicDamage':'directDamage',n);metric(c,'hits');
   const element=e.style==='fire'||e.style==='frost'||e.style==='lightning'||e.style==='arcane'?e.style:null;
   const elemental=element?Math.min(n,e.elementalValue??n):0;metric(c,'damage:physical',n-elemental);if(element)metric(c,'damage:'+element,elemental);
   if(!e.periodic){let marks=hybridHits.get(p);if(!marks){marks=new Map();hybridHits.set(p,marks);}if(marks.size>=256&&!marks.has(e.targetId))marks.delete(marks.keys().next().value!);marks.set(e.targetId,(marks.get(e.targetId)??0)|(e.melee?1:element?2:0));}
   if(e.skill)metric(c,'skillDamage:'+e.skill,n);else metric(c,e.periodic?'burnDamage':'basicDamage',n);
   if(e.heavy)metric(c,'crits');metric(c,'largestHit',n);break;
 }
 case 'kill':{if(hybridHits.get(p)?.get(e.targetId)===3)metric(c,'feat:spellblade');hybridHits.get(p)?.delete(e.targetId);metric(c,'kills');metric(c,'enemy:'+e.enemyKind);const enemy=enemies.find(a=>a.id===e.targetId);
   if(enemy){metric(c,'rank:'+enemy.rank);metric(c,'highestEnemy',enemy.level);if(enemy.rank==='elite'&&p.hp/p.maxHp<.1)metric(c,'feat:lastbreath');
     if(enemy.campMemberId==='warden'){metric(c,'bosses');metric(c,'crypts');}}
   break;}
 case 'hurt': metric(c,'damageTaken',e.actualValue??e.value);if(e.remainingHp===0){metric(c,'deaths');const s=c.sources.find(s=>s.id===c.active)!;metric(c,'highestDeathTime',s.values.time??0);}break;
 case 'heal':metric(c,'healing',e.value);break;
 case 'potion':metric(c,'potions');metric(c,'healing',e.life);metric(c,'manaRestored',e.mana);break;
 case 'pickup':metric(c,e.heavy?'healing':'manaRestored',e.value);break;
 case 'dodge':metric(c,'dodges');break;
 case 'block':metric(c,'blocks');metric(c,'damageBlocked',e.value);break;
 case 'gold':metric(c,'goldFound',e.amount);metric(c,'goldEarned',e.amount);metric(c,'largestGold',e.amount);break;
 case 'loot':metric(c,'items');metric(c,'items:'+e.item.tier);metric(c,'itemKind:'+e.item.kind);if(e.item.recipe.materialId)metric(c,'material:'+e.item.recipe.materialId);break;
 case 'journey':metric(c,'journeys');break;
 case 'experience':metric(c,'xp',e.amount);break;
 case 'level':metric(c,'highestLevel',e.level);break;
 case 'container-break':metric(c,'containers');break;
 }
}
export function trackCommerce(c:ChronicleProgress|undefined,before:number,after:number,enhancement=0):void {
 if(after<before)metric(c,'goldSpent',before-after);
 if(after>before){metric(c,'goldSales',after-before);metric(c,'goldEarned',after-before);}
 metric(c,'highestEnhancement',enhancement);
}
