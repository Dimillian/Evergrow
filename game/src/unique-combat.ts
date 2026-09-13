import { canUseSkill } from './skill-content.ts';
import { hasUnique, UNIQUE_RULES } from './unique-content.ts';
import { deriveAttackStats } from './equipment.ts';
import type { HitSnapshot, Player, Enemy, WorldQuery, Projectile, ProjectileEffects } from './model.ts';
import type { ProjectileDefinition } from './combat-content.ts';

export interface StoredFireball { sourceLevel:number; offset:number; definition:ProjectileDefinition; effects:ProjectileEffects; }
export interface StoredEmbers { remaining:number; shots:StoredFireball[]; }
export interface WardBurst { damage:number; radius:number; offense:HitSnapshot; }
export function returningProjectile(shot:Projectile,x:number,y:number):void {
  shot.effects!.returning={x,y,leg:'out',pierce:shot.effects?.pierce??0};
}
/** Each leg has a separate contact set; return is to the original release position, never homing. */
export function turnProjectile(shot:Projectile):boolean {
  const r=shot.effects?.returning;if(!r||r.leg==='back')return false;
  const distance=Math.hypot(r.x-shot.x,r.y-shot.y);if(distance<1)return false;
  const speed=Math.hypot(shot.vx,shot.vy);
  r.leg='back';shot.hitIds.clear();shot.effects!.pierce=r.pierce;
  shot.angle=Math.atan2(r.y-shot.y,r.x-shot.x);shot.vx=Math.cos(shot.angle)*speed;shot.vy=Math.sin(shot.angle)*speed;
  shot.life=distance/speed;delete shot.launch;return true;
}
/** Do not lose paid casts if projectile/ground-effect capacity is temporarily exhausted. */
export function releaseStoredEmbers(p:Player,availableProjectiles:number,availableGround:number,
  release:(shot:StoredFireball)=>void):boolean {
  const casts=p.skillEffects?.embers;
  if(!casts?.length||!hasUnique(p.character,'cinderheart-testament'))return false;
  const shots=casts.flatMap(c=>c.shots);
  if(shots.length>availableProjectiles||shots.filter(s=>s.effects.groundDuration).length>availableGround)return false;
  p.skillEffects!.embers=[];
  for(const shot of shots)release(shot);
  return true;
}
export function advanceUniqueEffects(p:Player,dt:number):void {
  const s=p.skillEffects;if(!s)return;
  if(s.embers){
    if(!hasUnique(p.character,'cinderheart-testament')||!p.character.allocatedNodes.includes('skill:fireball')||!canUseSkill('fireball',p.equipment))s.embers=[];
    else s.embers=s.embers.filter(c=>(c.remaining-=dt)>0);
  }
  for(const [key,id,skill] of [['decoy','ashen-double','smokeVeil'],['returnStep','duelists-return','lunge'],['archer','pale-huntsman','ghostHunt'],['borrowed','borrowed-life','siphon']] as const){
    const effect=s[key];if(!effect)continue;
    // The return window begins when the outward dash finishes.
    if(key==='returnStep'&&s.returnStep?.outward){
      if(p.dash!==s.returnStep.outward)delete s.returnStep.outward;
    }
    if(key!=='returnStep'||!s.returnStep?.outward)effect.remaining-=dt;
    if(effect.remaining<=0||!hasUnique(p.character,id)||!p.character.allocatedNodes.includes(`skill:${skill}`)||!canUseSkill(skill,p.equipment)){
      delete s[key];if(key==='archer')s.echoes=[];
    }
  }
  if(s.archer?.shotRemaining)s.archer.shotRemaining=Math.max(0,s.archer.shotRemaining-dt);
  if(s.borrowed)s.borrowed.capacity=Math.min(s.borrowed.capacity,Math.max(0,p.maxHp*UNIQUE_RULES.borrowedLife-(s.ward?.capacity??0)));
  if(s.ward?.rupture&&!hasUnique(p.character,'broken-seal'))delete s.ward.rupture;
  for(const [key,id,skill] of [['bastion','patient-bastion','bulwark'],['conductor','stormglass-reliquary','arcLightning']] as const){
    const effect=s[key];if(effect&&((effect.remaining-=dt)<=0||!hasUnique(p.character,id)||!p.character.allocatedNodes.includes(`skill:${skill}`)||!canUseSkill(skill,p.equipment)))delete s[key];
  }
  if(s.harvest){s.harvest=s.harvest.filter(mark=>(mark.remaining-=dt)>0);if(!hasUnique(p.character,'red-harvest')||!canUseSkill('backstab',p.equipment)||!p.character.allocatedNodes.includes('skill:backstab'))delete s.harvest;}
  if(s.draw&&(!hasUnique(p.character,'heartwood-draw')||!canUseSkill('piercingShot',p.equipment)||p.character.skillSlots[s.draw.slot]!=='piercingShot'||!p.character.allocatedNodes.includes('skill:piercingShot')))delete s.draw;
}

export function storeBastion(p:Player,blocked:number):void {
  if(p.dead||p.guardTime<=0||blocked<=0||!hasUnique(p.character,'patient-bastion')||!p.character.allocatedNodes.includes('skill:bulwark'))return;
  const s=p.skillEffects??={echoes:[]},cap=deriveAttackStats(p.stats,p.equipment.mainHand).damage*UNIQUE_RULES.bastionCap;
  s.bastion={damage:Math.min(cap,(s.bastion?.damage??0)+blocked),remaining:UNIQUE_RULES.bastionWindow};
}
export function consumeBastion(p:Player,weaponDamage:number,melee:boolean):number {
  const charge=p.skillEffects?.bastion;
  if(!charge||!melee||!hasUnique(p.character,'patient-bastion')||!canUseSkill('bulwark',p.equipment))return 0;
  delete p.skillEffects!.bastion;
  return charge.remaining>0?Math.min(charge.damage,weaponDamage*UNIQUE_RULES.bastionCap):0;
}
/** A mark is spent before checking the natural rear angle, so rear follow-ups cannot renew it. */
export function harvestRear(p:Player,target:number,naturalRear:boolean):boolean {
  if(!hasUnique(p.character,'red-harvest'))return naturalRear;
  const s=p.skillEffects??={echoes:[]};s.harvest??=[];
  const index=s.harvest.findIndex(mark=>mark.target===target&&mark.remaining>0);
  if(index>=0){s.harvest.splice(index,1);return true;}
  if(naturalRear){if(s.harvest.length>=16)s.harvest.shift();s.harvest.push({target,remaining:UNIQUE_RULES.harvestWindow});}
  return naturalRear;
}
export function storeFireballs(p:Player,shots:StoredFireball[]):void {
  const s=p.skillEffects??={echoes:[]};
  (s.embers??=[]).push({remaining:UNIQUE_RULES.emberLifetime,shots});
}

/** Only unused direct Siphon healing contributes, and never stacks on top of a full ward. */
export function storeBorrowedLife(p:Player,amount:number):void {
  if(p.dead||amount<=0||!hasUnique(p.character,'borrowed-life')||!canUseSkill('siphon',p.equipment))return;
  const s=p.skillEffects??={echoes:[]};
  const capacity=Math.min((s.borrowed?.capacity??0)+amount,Math.max(0,p.maxHp*UNIQUE_RULES.borrowedLife-(s.ward?.capacity??0)));
  if(capacity>0)s.borrowed={capacity,remaining:UNIQUE_RULES.borrowedDuration};
}
export function hurtDecoy(p:Player,id:number,amount:number):boolean {
  const d=p.skillEffects?.decoy;if(!d||d.id!==id||d.hp<=0)return false;
  d.hp=Math.max(0,d.hp-Math.max(0,amount));if(d.hp<=0)delete p.skillEffects!.decoy;
  return true;
}
/** Attack commitment retains its original target even if a double expires or is replaced. */
export function decoyTarget(enemy:Enemy,p:Player,world:WorldQuery,visible:(ax:number,ay:number,bx:number,by:number)=>boolean):Pick<Player,'x'|'y'|'radius'|'dead'> {
  const d=p.skillEffects?.decoy;
  if(!d&&!enemy.decoyTarget)return p;
  if(['idle','patrol','chase','return'].includes(enemy.state)){
    delete enemy.decoyTarget;
    if(enemy.rank==='normal'&&enemy.state!=='return'&&d&&d.hp>0&&d.remaining>0&&!world.isSanctuary?.(p.x,p.y)
      &&Math.hypot(enemy.x-d.x,enemy.y-d.y)<=d.reach&&visible(enemy.x,enemy.y,d.x,d.y)){
      enemy.decoyTarget={id:d.id,x:d.x,y:d.y,radius:d.radius};enemy.seesPlayer=true;enemy.senseTime=0;
    }
  }
  const t=enemy.decoyTarget;return t?{...t,dead:!d||d.id!==t.id||d.hp<=0}:p;
}

/** The free recast is advertised by the HUD and accepted by every input surface. */
export function lungeReturn(p:Player) {
  const step=p.skillEffects?.returnStep;
  return step&&step.remaining>0&&!p.dead&&!p.dash&&p.character.allocatedNodes.includes('skill:lunge')
    &&hasUnique(p.character,'duelists-return')&&canUseSkill('lunge',p.equipment)?step:undefined;
}
