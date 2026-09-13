import { canUseSkill } from './skill-content.ts';
import { hasUnique, UNIQUE_RULES } from './unique-content.ts';
import type { HitSnapshot, Player, Projectile, ProjectileEffects } from './model.ts';
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
  if(s.ward?.rupture&&!hasUnique(p.character,'broken-seal'))delete s.ward.rupture;
}
export function storeFireballs(p:Player,shots:StoredFireball[]):void {
  const s=p.skillEffects??={echoes:[]};
  (s.embers??=[]).push({remaining:UNIQUE_RULES.emberLifetime,shots});
}
