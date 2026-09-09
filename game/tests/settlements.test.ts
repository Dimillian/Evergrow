import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.ts';
import { settlementPlace } from '../src/world-geography.ts';
import { generateSettlement, freezeSettlement, contains, circleHitsRect, settlementPavingWeight, MAX_TOWN_RADIUS } from '../src/settlements.ts';
import { buildingNPC, canInteractNPC } from '../src/npcs.ts';
import { townPortalAnchor } from '../src/travel.ts';
import { settlementResidents } from '../src/settlement-residents.ts';

test('three seeded settlement tiers have their own services, homes, walls and immutable connected layouts',()=>{
 const tiers=new Set(),layouts=new Set();
 for(const seed of[7319,9,18427,90210,79,80])for(let cell=0;cell<8;cell++){
  const place=settlementPlace(seed,cell,0),town=generateSettlement(seed,place);tiers.add(town.kind);layouts.add(town.layout);
  assert.deepEqual(town,generateSettlement(seed,place));assert.ok(town.radius<=MAX_TOWN_RADIUS);
  if(!cell){assert.equal(town.kind,'settlement');assert.equal(town.buildings.filter(b=>b.form==='house').length,0);assert.equal(town.buildings.filter(b=>b.form==='stall').length,4);}
  for(const kind of['blacksmith','merchant','chapel','gambler','stash','hearth'])assert.ok(town.buildings.some(b=>b.kind===kind));
  if(town.kind==='city')assert.ok(town.buildings.some(b=>b.kind==='noble'));
  assert.equal(new Set(town.buildings.map(b=>b.id)).size,town.buildings.length);
  for(const b of town.buildings)for(const [x,y]of [[b.x,b.y],[b.x+b.width,b.y+b.height]])assert.ok(Math.hypot(x-town.x,y-town.y)<town.radius);
  const solid=town.buildings.flatMap(b=>[...b.walls,...b.furniture]);
  for(const path of town.paths)for(let i=1;i<path.points.length;i++){
   const a=path.points[i-1],b=path.points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/8);
   for(let k=0;k<=n;k++){const x=a[0]+(b[0]-a[0])*k/n,y=a[1]+(b[1]-a[1])*k/n;
    assert.ok(!solid.some(r=>circleHitsRect(x,y,16,r)),`${seed}/${cell} ${town.kind}: clear path at ${x-town.x},${y-town.y}`);
    assert.ok(settlementPavingWeight(town,x,y,0)>.8);
   }
  }
  const frozen=freezeSettlement(town);assert.throws(()=>{frozen.paths[0].points[0][0]++;},TypeError);
 }
 assert.equal(tiers.size,3);assert.equal(layouts.size,3);
});
test('home gates, full-size entrances, vendors and portal remain reachable with runtime collision',()=>{
 for(const seed of[7319,9,18427]){
  const w=new World(seed),town=w.getNearestSettlement(0,-1150),anchor=townPortalAnchor(town);
  assert.equal(w.blocked(anchor.x,anchor.y,18),false);
  for(const b of town.buildings){
   if(b.form==='fixture'||b.form==='tent')continue;
   assert.equal(w.blocked(b.door.x,b.door.y,16),false,b.id);
   const npc=buildingNPC(b);if(npc)assert.ok(canInteractNPC(npc,{x:npc.x,y:npc.y+30},w));
   if(b.form==='house'){
    const moved=w.move(b.door.x,b.door.y+30,0,-60,16);assert.ok(Math.abs(moved.y-(b.door.y-30))<1e-7);
    assert.equal(w.getBuildingAt(moved.x,moved.y)?.id,b.id);
   }else assert.equal(w.getBuildingAt(b.door.x,b.door.y-20),null);
  }
  assert.ok(w.getPOIs(town.x-town.radius,town.y-town.radius,town.radius*2,town.radius*2).some(p=>p.kind==='gambler'));
  assert.equal(w.getPOIs(town.x-town.radius,town.y-town.radius,town.radius*2,town.radius*2).some(p=>p.name.includes('Home')),false,'private homes have no map marker');
  w.dispose();
 }
});
test('families remain inside houses; residents walk generated clear routes and have stable identities',()=>{
 for(const cell of[0,1,2,3]){
  const town=generateSettlement(7319,settlementPlace(7319,cell,0));const ids=settlementResidents(town,0).map(n=>n.id);
  for(let time=0;time<100;time+=7){const residents=settlementResidents(town,time);assert.deepEqual(residents.map(n=>n.id),ids);
   for(const n of residents){
    assert.ok(town.buildings.every(b=>![...b.walls,...b.furniture].some(r=>circleHitsRect(n.x,n.y,5,r))));
    const house=town.buildings.find(b=>b.id===n.household);if(house)assert.ok(contains(house,n.x,n.y));
   }
  }
 }
});
