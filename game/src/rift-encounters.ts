import type { Enemy, EnemyKind } from './model.ts';
export type RiftEncounterKind='battery'|'hunt'|'ritual'|'swarm';
export const RIFT_ENCOUNTERS=Object.freeze({
  battery:Object.freeze({name:'Guarded battery',min:54,max:72,radius:375,mechanic:'storm' as const}),
  hunt:Object.freeze({name:'Hunting pack',min:34,max:48,radius:380,mechanic:'fire' as const}),
  ritual:Object.freeze({name:'Ritual gathering',min:48,max:64,radius:375,mechanic:'ritual' as const}),
  swarm:Object.freeze({name:'Infested clearing',min:105,max:130,radius:400,mechanic:'storm' as const}),
});
export const RIFT_ENCOUNTER_ORDER:readonly RiftEncounterKind[]=Object.freeze(['hunt','swarm','battery','ritual']);
export type RiftMechanic='ritual'|'storm'|'fire';
export const RIFT_TACTICS=Object.freeze({wardRadius:300,wardReduction:.3,stormRadius:95,fireRadius:230,fireArc:Math.PI*.55,warning:1.4,cooldown:7,globalGap:2.1,range:600,damageMultiplier:.85});
export function riftMechanic(enemy:Pick<Enemy,'campMemberId'|'rift'>):RiftMechanic|undefined {
  if(!enemy.rift)return;
  const role=enemy.campMemberId?.split(':')[3];
  return role==='ritual'||role==='storm'||role==='fire'?role:undefined;
}
/** Formation positions are local to the facing towards the arrival, before terrain validation. */
export function riftFormation(kind:RiftEncounterKind,fraction:number,a:number,r:number):{kind:EnemyKind;x:number;y:number} {
  if(kind==='battery')return fraction<.6?{kind:fraction<.16?'brute':'stalker',x:110+Math.abs(Math.cos(a)*r*.55),y:Math.sin(a)*r}:{kind:'archer',x:-100-Math.abs(Math.cos(a)*r*.5),y:Math.sin(a)*r};
  if(kind==='hunt')return {kind:fraction<.7?'hound':'thornReaver',x:Math.cos(a)*r*.65,y:(fraction<.35?-1:1)*(110+Math.abs(Math.sin(a)*r*.65))};
  if(kind==='ritual')return {kind:fraction<.65?'stalker':fraction<.85?'brute':'caster',x:Math.cos(a)*r,y:Math.sin(a)*r};
  return {kind:fraction<.78?'duneScuttler':fraction<.94?'hound':'mireSpitter',x:Math.cos(a)*r,y:Math.sin(a)*r};
}
