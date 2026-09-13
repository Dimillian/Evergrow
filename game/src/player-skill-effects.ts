import { advanceUniqueEffects, type StoredEmbers, type WardBurst } from './unique-combat.ts';
import { hasUnique } from './unique-content.ts';
import type { HitSnapshot, Player, ProjectileEffects } from './model.ts';
import type { SkillId } from './character-types.ts';
import type { ProjectileDefinition } from './combat-content.ts';
import { canUseSkill } from './skill-content.ts';
export interface TimedSkillStance { remaining: number; reduction: number; charges: number; bonus: number; }
export interface SkillEcho { delay: number; x: number; y: number; angle: number; definition: ProjectileDefinition; effects: ProjectileEffects; }
export interface PlayerSkillEffects {
  brace?: TimedSkillStance; rallyOfIron?: TimedSkillStance; ghostHunt?: TimedSkillStance;
  shelters?: Partial<Record<SkillId, { remaining: number; reduction: number }>>;
  embers?: StoredEmbers[];
  ward?: { remaining: number; capacity: number; rupture?: {absorbed:number;cap:number;radius:number;offense:HitSnapshot} };
  echoes: SkillEcho[];
}
export const skillEffects = (p: Player): PlayerSkillEffects => p.skillEffects ??= { echoes: [] };
export function snapshotSkillOffense(p: Player, skill?: SkillId): HitSnapshot {
  return { ...(skill ? { skill } : {}), critChance:p.derived.critChance,critMultiplier:p.derived.critMultiplier,lifeOnHit:p.derived.lifeOnHit,directDamageMultiplier:p.derived.directDamageMultiplier ?? 1 };
}
/** Consume at manual action commitment, once for a sweep/volley, never per contact. */
export function consumeRally(p: Player, melee: boolean): number {
  const buff=p.skillEffects?.rallyOfIron;
  if(!melee || !buff || buff.remaining<=0 || buff.charges<=0 || !canUseSkill('rallyOfIron',p.equipment))return 1;
  buff.charges--;return 1+buff.bonus;
}
/** One delayed first-arrow snapshot per action. Topology and crit survive; healing/statuses/recursion do not. */
export function queueSkillEcho(p: Player, x:number,y:number,angle:number,definition:ProjectileDefinition,effects:ProjectileEffects):void {
  const state=p.skillEffects,buff=state?.ghostHunt;
  if(!state || !buff || buff.remaining<=0 || buff.charges<=0 || state.echoes.length>=5 || effects.style!=='arrow' || !canUseSkill('ghostHunt',p.equipment))return;
  buff.charges--;
  state.echoes.push({delay:.32,x,y,angle,definition:{...definition,damage:definition.damage*buff.bonus},effects:{style:'arrow',pierce:effects.pierce,chain:effects.chain,chainRange:effects.chainRange,offense:{skill:'ghostHunt',critChance:effects.offense?.critChance??0,critMultiplier:effects.offense?.critMultiplier??1.5,lifeOnHit:0,directDamageMultiplier:effects.offense?.directDamageMultiplier??1}}});
}
/** Highest stance mitigation wins; a finite ward consumes only the remaining damage. */
export function mitigateSkillHit(p: Player, amount:number):{damage:number;absorbed:number;burst?:WardBurst} {
  const s=p.skillEffects;if(!s)return{damage:amount,absorbed:0};
  const reduction=Math.max(...Object.entries(s.shelters??{}).map(([id,b])=>b.remaining&&canUseSkill(id as SkillId,p.equipment)?b.reduction:0),s.brace?.remaining? s.brace.reduction:0,s.rallyOfIron?.remaining&&canUseSkill('rallyOfIron',p.equipment)?s.rallyOfIron.reduction:0);
  amount=Math.max(1,Math.round(amount*(1-reduction)));
  const ward=s.ward?.remaining&&canUseSkill('runicWard',p.equipment)?s.ward:undefined;
  const absorbed=ward?Math.min(amount,ward.capacity):0;
  let burst:WardBurst|undefined;
  if(ward){
    ward.capacity-=absorbed;
    if(ward.rupture)ward.rupture.absorbed+=absorbed;
    if(ward.capacity<=0){
      if(ward.rupture&&hasUnique(p.character,'broken-seal'))burst={damage:Math.min(ward.rupture.absorbed,ward.rupture.cap),radius:ward.rupture.radius,offense:ward.rupture.offense};
      delete s.ward;
    }
  }
  return{damage:amount-absorbed,absorbed,...(burst?{burst}:{})};
}
export function advanceSkillEffects(p: Player,dt:number,emitEcho?:(echo:SkillEcho)=>void):void {
  const s=p.skillEffects;if(!s)return;if(p.dead){p.skillEffects=undefined;return;}
  advanceUniqueEffects(p,dt);
  for(const id of ['brace','rallyOfIron','ghostHunt'] as const){const b=s[id];if(b){b.remaining=Math.max(0,b.remaining-dt);if(!b.remaining||!p.character.allocatedNodes.includes(`skill:${id}`)||!canUseSkill(id,p.equipment))delete s[id];}}
  for(const [id,b]of Object.entries(s.shelters??{})){b.remaining=Math.max(0,b.remaining-dt);if(!b.remaining||!p.character.allocatedNodes.includes(`skill:${id}`)||!canUseSkill(id as SkillId,p.equipment))delete s.shelters![id as SkillId];}
  if(s.ward){s.ward.remaining=Math.max(0,s.ward.remaining-dt);s.ward.capacity=Math.min(s.ward.capacity,p.maxHp*.35);if(!s.ward.remaining||!p.character.allocatedNodes.includes('skill:runicWard')||!canUseSkill('runicWard',p.equipment))delete s.ward;}
  if(!p.character.allocatedNodes.includes('skill:ghostHunt')||!canUseSkill('ghostHunt',p.equipment))s.echoes=[];
  for(const echo of s.echoes)echo.delay-=dt;
  if(emitEcho){const due=s.echoes.filter(e=>e.delay<=0);s.echoes=s.echoes.filter(e=>e.delay>0);for(const echo of due)emitEcho(echo);}
}
