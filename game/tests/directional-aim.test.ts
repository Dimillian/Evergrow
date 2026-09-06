import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDirectionalAim, directionalAimProfile } from '../src/ranged-aim.ts';
import { SKILL_EXECUTION } from '../src/skill-execution-content.ts';
import { Simulation } from '../src/simulation.ts';
import type { WorldQuery } from '../src/model.ts';
const world: WorldQuery = { blocked: () => false, move: (x,y,dx,dy) => ({x:x+dx,y:y+dy}) };
const origin={x:0,y:0}, aim={x:300,y:0};
const options={range:500,speed:560,alpha:1,previousTargetId:null,
  bounds:{left:-500,top:-500,width:1000,height:1000},visible:()=>true};
const fixture=()=>new Simulation(world,{spawn:false});

test('directional aim prefers a nearby foe in the cone regardless of virtual cursor distance',()=>{
  const sim=fixture(), near=sim.spawnEnemy('stalker',100,20)!,far=sim.spawnEnemy('stalker',300,0)!;
  assert.equal(resolveDirectionalAim(origin,aim,[far,near],options).targetId,near.id);
  assert.equal(resolveDirectionalAim(origin,{x:60,y:0},[far,near],options).targetId,near.id);
  assert.equal(resolveDirectionalAim(origin,{x:1000,y:0},[near,far],options).targetId,near.id);
});
test('directional aim rejects behind, outside cone, wall, dead, offscreen and distant foes',()=>{
  const sim=fixture(), enemy=sim.spawnEnemy('stalker',100,0)!;
  const behind=sim.spawnEnemy('stalker',-50,0)!,side=sim.spawnEnemy('stalker',20,80)!;
  assert.deepEqual(resolveDirectionalAim(origin,aim,[behind,side],options),{...aim,targetId:null});
  for(const overrides of [{range:50},{visible:()=>false},{bounds:{left:0,top:0,width:20,height:20}}])
    assert.equal(resolveDirectionalAim(origin,aim,[enemy],{...options,...overrides,previousTargetId:enemy.id}).targetId,null);
  enemy.hp=0;assert.equal(resolveDirectionalAim(origin,aim,[enemy],options).targetId,null);
});
test('retention avoids neighbour flicker but releases on deliberate re-aim and much nearer threats',()=>{
  const sim=fixture(),a=sim.spawnEnemy('stalker',100,0)!,b=sim.spawnEnemy('stalker',105,0)!;
  assert.equal(resolveDirectionalAim(origin,aim,[b,a],options).targetId,a.id);
  assert.equal(resolveDirectionalAim(origin,aim,[a,b],{...options,previousTargetId:b.id}).targetId,b.id);
  const close=sim.spawnEnemy('stalker',40,0)!;
  assert.equal(resolveDirectionalAim(origin,aim,[a,b,close],{...options,previousTargetId:b.id}).targetId,close.id);
  assert.equal(resolveDirectionalAim(origin,{x:0,y:300},[a,b],{...options,previousTargetId:b.id}).targetId,null);
  b.x=a.x;assert.equal(resolveDirectionalAim(origin,aim,[b,a],options).targetId,a.id);
});
test('projectile lead is bounded and wall checked; melee aims at the current position',()=>{
  const sim=fixture(),enemy=sim.spawnEnemy('stalker',100,0)!;enemy.vy=1000;
  assert.equal(resolveDirectionalAim(origin,aim,[enemy],options).y,18);
  assert.equal(resolveDirectionalAim(origin,aim,[enemy],{...options,speed:0}).y,0);
  assert.equal(resolveDirectionalAim(origin,aim,[enemy],{...options,visible:(_ax,_ay,_bx,y)=>y===0}).y,0);
  assert.deepEqual(resolveDirectionalAim(origin,origin,[enemy],options),{...origin,targetId:null});
});
test('all action recipes preserve reach and self/ground skill placement',()=>{
  for(const recipe of [SKILL_EXECUTION.meteor,SKILL_EXECUTION.iceNova,SKILL_EXECUTION.bulwark,SKILL_EXECUTION.whirlwind])
    assert.equal(directionalAimProfile(400,'bolt',recipe),null);
  assert.deepEqual(directionalAimProfile(400,'bolt',SKILL_EXECUTION.fireball),{range:400,speed:320});
  assert.deepEqual(directionalAimProfile(50,'melee',SKILL_EXECUTION.cleave),{range:70,speed:0});
  assert.deepEqual(directionalAimProfile(50,'melee',null),{range:50,speed:0});
  assert.deepEqual(directionalAimProfile(400,'arrow',null),{range:400,speed:560});
  for(const recipe of Object.values(SKILL_EXECUTION)) {
    const profile=directionalAimProfile(100,'melee',recipe);
    if(profile){assert.ok(profile.range>0&&Number.isFinite(profile.range));assert.ok(profile.speed>=0);}
  }
});
