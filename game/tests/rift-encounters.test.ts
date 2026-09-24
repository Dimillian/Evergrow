import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRiftFloor,riftPackCount } from '../src/rift-floor.ts';
import { RIFT_TACTICS as R,riftMechanic } from '../src/rift-encounters.ts';
import { RiftTactics,riftWardActive } from '../src/rift-tactics.ts';
import { WorldLandscape } from '../src/world-landscape.ts';
import { Simulation } from '../src/simulation.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import { riftPoints,validRiftTag } from '../src/rift-content.ts';
import { enemyWarnings } from '../src/enemy-warning-art.ts';
import { damageEnemy } from '../src/combat-damage.ts';
import type { EnemyAIContext } from '../src/enemy-ai.ts';
const surface={seed:7,blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
function fixture(){
 const sim=new Simulation(surface,{spawn:false});sim.player.x=100;sim.player.y=0;
 const source=sim.spawnEnemy('caster',0,0,'elite')!,ally=sim.spawnEnemy('stalker',50,0,'normal')!;
 source.rift=ally.rift={attempt:1,layout:'clearings'};source.campMemberId='rift:0:0:ritual';source.campId=ally.campId='dungeon:rift:1';
 source.state=ally.state='chase';source.awareness=ally.awareness=1;
 const hits:{amount:number;type:string}[]=[];
 const context:EnemyAIContext={player:sim.player,enemies:sim.enemies,world:surface,time:0,trial:null,visible:()=>true,move:()=>{},hurt:(amount,_angle,_enemy,type)=>hits.push({amount,type}),shoot:()=>{},emit:()=>{}};
 return {sim,source,ally,hits,context,director:new RiftTactics()};
}
test('connected rifts retain dry, body-clear routes across seeds and key densities',()=>{
 for(const seed of [0,1,8,31,73,7342,90210])for(const keyTier of [undefined,5]){
  const tag={attempt:1,layout:'clearings' as const,...(keyTier?{keyTier,keySeed:seed}:{})};
  const floor=buildRiftFloor(seed,'verdant',tag),world=new WorldLandscape(seed,true,true);
  assert.equal(new Set(floor.members.filter(m=>m.id!=='warden').map(m=>m.id.split(':')[1])).size,riftPackCount(tag));
  assert.ok(floor.members.reduce((n,m)=>n+riftPoints(m.rank),0)>2400);
  assert.equal(floor.members.filter(m=>m.id.endsWith(':ritual')).length,7);
  for(const m of floor.members){assert.equal(world.blocked(m.x,m.y,ENEMY_DEFINITIONS[m.kind].radius*1.28+4),false,m.id);assert.ok(world.sampleWater(m.x,m.y).coverage<.12);}
  for(const {a,b} of world.riftShape!.trails)for(let t=0;t<=1;t+=.04){const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;assert.equal(world.blocked(x,y,55),false,'wide connected route');assert.ok(world.sampleWater(x,y).coverage<.12);}
  // Every clearing reaches arrival through a trail graph with additional loops.
  const seen=new Set([-1]);for(let n=0;n<30;n++)for(const {a,b} of world.riftShape!.trails){if(seen.has(a.index))seen.add(b.index);if(seen.has(b.index))seen.add(a.index);}
  assert.equal(seen.size,29);assert.ok(world.riftShape!.trails.length>28);
  assert.equal(validRiftTag(tag),true);world.dispose();
 }
});
test('ritual support reduces actual damage without stacking, and death/range/interrupt break it immediately',()=>{
 const f=fixture();f.director.tick(f.context,.01,true);assert.equal(f.ally.riftWardSource,f.source);assert.equal(f.source.riftWardSource,undefined);
 assert.equal(riftWardActive(f.ally),true);
 f.ally.hp=f.ally.maxHp=1000;f.sim.player.derived.critChance=0;
 const ctx={player:f.sim.player,enemies:f.sim.enemies,random:()=>1,visible:()=>true,emit:()=>{},killed:()=>{}};
 damageEnemy(f.ally,100,0,false,ctx,true);assert.equal(f.ally.hp,930);
 f.source.hp=0;damageEnemy(f.ally,100,0,false,ctx,true);assert.equal(f.ally.hp,830);
 f.source.hp=100;f.source.stunTime=1;assert.equal(riftWardActive(f.ally),false);
 f.source.stunTime=0;f.source.x=R.wardRadius+100;assert.equal(riftWardActive(f.ally),false);
 f.source.x=0;assert.equal(riftWardActive(f.ally,()=>false),false);
 f.director.tick(f.context,.2,false);assert.equal(f.ally.riftWardSource,undefined);
});
test('lightning locks the old player position, telegraphs its real footprint, and permits dodging',()=>{
 const f=fixture();f.source.campMemberId='rift:0:0:storm';f.source.riftSpecialCooldown=0;
 f.director.tick(f.context,2.01,true);assert.equal(riftMechanic(f.source),'storm');assert.equal(f.source.riftWarning?.x,100);
 const warnings=enemyWarnings(f.source);assert.deepEqual(warnings[0].shape,{kind:'circle',radius:R.stormRadius});
 f.sim.player.x=400;f.director.tick(f.context,R.warning,true);assert.equal(f.hits.length,0);assert.equal(f.source.riftWarning,undefined);
});
test('fire sweep hits in front, misses behind, and uses the shared warning angle',()=>{
 for(const behind of [false,true]){
  const f=fixture();f.source.campMemberId='rift:0:0:fire';f.source.riftSpecialCooldown=0;
  f.director.tick(f.context,2.01,true);assert.equal(f.source.riftWarning?.angle,0);
  if(behind)f.sim.player.x=-100;
  f.director.tick(f.context,R.warning,true);assert.equal(f.hits.length,behind?0:1);if(!behind)assert.equal(f.hits[0].type,'fire');
 }
});
test('special starts are staggered; stun, source death and end of hunt cancel pending hits',()=>{
 for(const cancel of ['stun','death','complete']){
  const f=fixture();f.source.campMemberId='rift:0:0:storm';f.ally.campMemberId='rift:1:0:storm';
  f.source.riftSpecialCooldown=f.ally.riftSpecialCooldown=0;
  f.director.tick(f.context,2.01,true);assert.equal(f.sim.enemies.filter(e=>e.riftWarning).length,1);
  if(cancel==='stun')f.source.stunTime=2;if(cancel==='death')f.source.hp=0;
  f.director.tick(f.context,R.warning,cancel!=='complete');assert.equal(f.hits.length,0);
 }
});
