import type { EnemyKind } from './model.ts';
import type { DeathAnimation } from './death-content.ts';
import { at, clamp01, ease, frame3, humanoidDeathArm, humanoidDeathPose, type Frame3, type Vec3 } from './death-rig.ts';

type ArmedKind=Exclude<EnemyKind,'stalker'|'hound'|'wisp'>;
export const weaponReleaseTime=(recipe:DeathAnimation)=>recipe.weapon==='held'?Infinity:recipe.contact*(recipe.weapon==='toss'?.32:.58);

/** Presentation-only release: sample the hand once in time, then follow an independent arc. */
export function deathWeaponFrame(kind:ArmedKind,recipe:DeathAnimation,age:number,hand:Vec3,width:number):Frame3 {
  const held=(point:Vec3,time:number)=>{
    const t=ease((time-recipe.delay)/(recipe.settle-recipe.delay));
    return frame3(point,kind==='caster'?t*1.55:.45+t*1.12,kind==='archer'?.35:0);
  };
  const release=weaponReleaseTime(recipe);
  if(age<=release) return held(hand,age);
  const start=held(humanoidDeathArm(humanoidDeathPose(recipe,release),width,1)[2],release);
  const landing=release+(recipe.settle-release)*.72;
  const u=clamp01((age-release)/(landing-release)),v=clamp01((age-landing)/(recipe.settle-landing));
  const toss=recipe.weapon==='toss',heavy=kind==='brute'||kind==='warden';
  const startPitch=Math.atan2(start.up[1],start.up[2]);
  const rotation=ease(u),bounce=Math.sin(v*Math.PI)*(1-v)*(heavy?.65:1.5);
  const pitch=startPitch+(Math.PI/2-startPitch)*rotation+Math.sin(u*Math.PI)*(toss?.35:.1)+Math.sin(v*Math.PI*2)*(1-v)*.07;
  const spin=(kind==='archer'?.35:0)*(1-rotation)+Math.sin(u*Math.PI)*(toss?.8:.25);
  const turned=frame3([0,0,0],pitch,spin),azimuth=(toss?-.65:.5)*rotation;
  const turn=(v:Vec3):Vec3=>[v[0]*Math.cos(azimuth)-v[1]*Math.sin(azimuth),v[0]*Math.sin(azimuth)+v[1]*Math.cos(azimuth),v[2]];
  const orientation={...turned,right:turn(turned.right),forward:turn(turned.forward),up:turn(turned.up)};
  // Ground the whole weapon, including its handle, blade/cage and thickness.
  const bounds=kind==='archer'?[-7,10,-20,20,2]:kind==='caster'?[-4,4,-7,31,1.3]:kind==='warden'?[-12,9,-3,31,1.4]:kind==='brute'?[-5,5,-3,27,2]:[-2,2,-3,17,.8];
  const low=Math.min(...[bounds[0],bounds[1]].flatMap(x=>[-bounds[4],bounds[4]].flatMap(y=>[bounds[2],bounds[3]].map(z=>at(orientation,x,y,z)[2]))));
  const floor=.12-low;
  const travel=toss?18:12;
  // Resolve any inherited held-pose floor overlap smoothly, without moving the grip at release.
  const clearance=Math.max(0,floor-start.origin[2])*(1-ease(u*5));
  const origin:Vec3=[start.origin[0]+travel*u,start.origin[1]+(toss?-10:7)*u,
    Math.max(floor-clearance,start.origin[2]*(1-u)+floor*u+(heavy?3:6)*4*u*(1-u))+bounce];
  return {...orientation,origin};
}
