import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.ts';
import { RiftWorld } from '../src/rift-world.ts';
import { generateDungeon } from '../src/dungeon.ts';
import { hasLineOfSight } from '../src/combat-geometry.ts';
import { hasWalkableSegment } from '../src/world-navigation.ts';
import { EnemyNeighbors } from '../src/enemy-neighbors.ts';
import { Simulation } from '../src/simulation.ts';

test('batched landscape rays exactly match sampled collision, including props, towns and sanctuaries',()=>{
 for(const seed of [7319,7342,90210]){
  const entry={id:'dungeon:rift:1',name:'Test',seed,level:30,biome:'verdant' as const,x:0,y:0,rift:{attempt:1}};
  for(const world of [new World(seed),new RiftWorld(generateDungeon(seed,30,entry),entry)]){
   const sampled={blocked:world.blocked.bind(world),isSanctuary:world.isSanctuary.bind(world)};
   for(let i=0;i<220;i++){
    const ax=(i*317)%4500-2250,ay=(i*193)%3500-2300,bx=ax+Math.sin(i)*540,by=ay+Math.cos(i)*540;
    assert.equal(hasLineOfSight(world,ax,ay,bx,by),hasLineOfSight(sampled,ax,ay,bx,by),`sight ${seed}:${i}`);
    for(const radius of [12,25])assert.equal(hasWalkableSegment(world,ax,ay,bx,by,radius),hasWalkableSegment(sampled,ax,ay,bx,by,radius),`walk ${seed}:${i}:${radius}`);
   }
   for(const target of [{x:0,y:0},{x:120,y:0},{x:500,y:0}])assert.equal(hasWalkableSegment(world,-500,0,target.x,target.y,13),hasWalkableSegment(sampled,-500,0,target.x,target.y,13));
   world.dispose();
  }
 }
});
test('accelerated queries respect custom collision worlds instead of bypassing walls',()=>{
 const world=new World(7342,true);world.blocked=(x)=>x>=20&&x<60;
 assert.equal(hasLineOfSight(world,0,0,100,0),false);
 assert.equal(hasWalkableSegment(world,0,0,100,0,12),false);
 assert.equal(hasLineOfSight(world,0,0,10,0),true);
});
test('neighbor index retains brute-force neighbors and ordering after crossing cell boundaries',()=>{
 const sim=new Simulation({blocked:()=>false,move:(x,y,dx,dy)=>({x:x+dx,y:y+dy})},{spawn:false});
 for(let i=0;i<160;i++)sim.spawnEnemy(i%9?'stalker':'brute',(i%16)*37-300,Math.floor(i/16)*43-250);
 const index=new EnemyNeighbors();index.rebuild(sim.enemies);
 for(let pass=0;pass<2;pass++)for(const e of sim.enemies){
  if(pass){e.x+=137;e.y-=79;index.update(e);}
  const touches=(other:typeof e)=>other!==e&&other.state!=='dead'&&Math.hypot(e.x-other.x,e.y-other.y)<e.radius+other.radius+5;
  assert.deepEqual(index.around(e,5).filter(touches),sim.enemies.filter(touches));
 }
 sim.enemies[0].state='dead';index.rebuild(sim.enemies);
 assert.equal(index.around(sim.enemies[1],200).includes(sim.enemies[0]),false);
});
