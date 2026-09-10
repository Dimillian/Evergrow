import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeon, dungeonBlocked, DungeonGeometry, dungeonRandom } from '../src/dungeon.ts';
import { cryptFloorContains, cryptOutline } from '../src/dungeon-contours.ts';
import { DUNGEON_THEME_IDS } from '../src/dungeon-content.ts';
import { DungeonCollision } from '../src/dungeon-collision.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import type { DungeonFloor } from '../src/dungeon.ts';
const exact=(floor:DungeonFloor,x:number,y:number,r:number)=>{
  if(![x,y,r].every(Number.isFinite)||r<0||r>1000||!cryptFloorContains(floor,x,y))return true;
  for(let i=0;i<16;i++){const a=i*Math.PI/8;if(!cryptFloorContains(floor,x+Math.cos(a)*r,y+Math.sin(a)*r))return true;}
  return false;
};

test('indexed collision exactly matches dungeon outlines at walls, corners, seams and negative grid boundaries',()=>{
  for(const theme of DUNGEON_THEME_IDS)for(const seed of [7319,342]){
    const floor=generateDungeon(seed,20,{theme,expedition:{attempt:1,stage:0,choice:0,modifier:'elite'}}),index=new DungeonCollision(floor),random=dungeonRandom(seed);
    const radii=[0,1,10,18,28,60,120,1000];
    const points:{x:number;y:number}[]=[];
    for(const room of [...floor.rooms,...floor.corridors]){
      for(const p of cryptOutline(room))points.push(p);
      for(let i=0;i<12;i++)points.push({x:room.x-80+random()*(room.width+160),y:room.y-80+random()*(room.height+160)});
      for(const epsilon of [-1e-9,0,1e-9])points.push({x:Math.round(room.x/64)*64+epsilon,y:Math.round(room.y/64)*64+epsilon});
    }
    for(let i=0;i<points.length;i++){
      const {x,y}=points[i],radius=radii[i%radii.length],wanted=exact(floor,x,y,radius);
      assert.equal(index.blocked(x,y,radius),wanted,`${theme}:${seed} (${x},${y}) r=${radius}`);
      assert.equal(index.blocked(x,y,radius),wanted,'warm cache agrees');
      assert.equal(dungeonBlocked(floor,x,y,radius),wanted,'runtime uses the same result');
    }
    for(const point of [[NaN,0,1],[0,Infinity,1],[0,0,-1],[0,0,1001]])assert.equal(index.blocked(...point as [number,number,number]),true);
  }
});

test('cached dungeon geometry preserves deterministic crowd combat and movement',()=>{
  const floor=generateDungeon(7319,20,{theme:'rootbound'}),room=floor.rooms.find(r=>r.kind==='combat')!;
  const px=room.x+room.width/2,py=room.y+room.height/2;
  const baseline=new DungeonGeometry(floor);baseline.blocked=(x,y,r)=>exact(floor,x,y,r);
  const sims=[baseline,new DungeonGeometry(floor)].map(world=>{
    const sim=new Simulation(world,{spawn:false,seed:20,startX:px,startY:py});
    for(let i=0;i<16;i++){
      const angle=i*2.399963,e=sim.spawnEnemy(i%2?'archer':'stalker',px+Math.cos(angle)*180,py+Math.sin(angle)*180)!;
      e.state='chase';e.awareness=1;e.seesPlayer=true;e.lastSeenX=px;e.lastSeenY=py;
    }
    return sim;
  });
  const input={moveX:0,moveY:0,aimX:px,aimY:py,attack:false,dodge:false,heal:false,skillSlot:null};
  for(let tick=0;tick<180;tick++)for(const sim of sims){sim.player.hp=sim.player.maxHp;sim.player.dead=false;sim.update(FIXED_STEP,input);}
  assert.deepEqual(sims[1].enemies,sims[0].enemies);
  assert.deepEqual(sims[1].projectiles,sims[0].projectiles);
  assert.equal(sims[1].player.hp,sims[0].player.hp);
  assert.deepEqual(sims[1].drainEvents(),sims[0].drainEvents());
});
