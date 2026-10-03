import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { Exploration } from '../src/exploration.ts';
import { executeMapTravel, mapTravelProblem } from '../src/travel-command.ts';
import { POI_DEFINITIONS, type WorldPOI } from '../src/world-pois.ts';
import { WorldMap } from '../src/world-map.ts';
import { LocationController } from '../src/location-controller.ts';

const poi: WorldPOI = { id: 'visited', kind: 'camp', name: 'Old camp', description: 'A camp.', x: 1200, y: 400 };
const world = { seed: 7319, blocked: () => false, move: (x:number,y:number,dx:number,dy:number) => ({x:x+dx,y:y+dy}), getPOIs: () => [poi] };
const known = { getDiscoveredPOI: (id:string) => id === poi.id ? {...poi} : undefined };

test('every visited POI kind can be a map destination; unknown and merely sighted locations cannot', async () => {
  const sim = new Simulation(world, {spawn:false});
  for (const kind of Object.keys(POI_DEFINITIONS) as WorldPOI['kind'][])
    assert.equal(mapTravelProblem(sim, { getDiscoveredPOI: () => ({...poi,kind}) }, poi.id), null, kind);
  for (const discovery of [known, {getDiscoveredPOI:()=>({...poi,sighted:true})}]) {
    let saved=false;
    const result=await executeMapTravel(sim, discovery, 'unknown', ()=>{saved=true;return {ok:true,message:''};});
    assert.equal(result.ok,false); assert.equal(saved,false);
  }
  sim.player.dead=true; assert.match(mapTravelProblem(sim,known,poi.id)!,/defeated/);
  sim.player.dead=false; sim.expeditions.location='dungeon:test';
  assert.match(mapTravelProblem(sim,known,poi.id)!,/dungeon or rift/);
});

test('beacon sightings unlock only after local discovery and destination records cannot be mutated by UI', async () => {
  const chart=new Exploration(world); await chart.ready;
  chart.revealFromBeacon(poi.x,poi.y,poi);
  const sim=new Simulation(world,{spawn:false});
  assert.match(mapTravelProblem(sim,chart,poi.id)!,/Visit/);
  chart.reveal(poi.x,poi.y,600);
  assert.equal(mapTravelProblem(sim,chart,poi.id),null);
  chart.getDiscoveredPOI(poi.id)!.x=9999;
  assert.equal(chart.getDiscoveredPOI(poi.id)!.x,poi.x);
  chart.dispose();
});

test('map travel commits before relocation and preserves resources, return portal and encounter contents', async () => {
  const sim=new Simulation(world,{spawn:false});
  sim.travel.returnTo={x:700,y:800,town:0};
  sim.player.hp=23; sim.player.mana=12; sim.player.flasks=1;
  const enemy=sim.spawnEnemy('stalker',2000,2000)!; enemy.hp=11;
  const before=sim.captureCheckpoint();
  let settle!:(result:{ok:boolean;message:string})=>void;
  const calls:string[]=[];
  const controller=new LocationController({simulation:()=>sim,surface:()=>world,
    persist:checkpoint=>{
      assert.equal(checkpoint.x,poi.x);assert.equal(checkpoint.y,poi.y+42);
      assert.deepEqual(checkpoint.travel,before.travel);
      calls.push('save');return new Promise(resolve=>{settle=resolve;});
    },restoreWorld:()=>{throw Error('Surface travel must not reload the world');},
    arrived:()=>{calls.push('arrival');},notify:()=>{calls.push('notice');}});
  const failed=controller.map(poi.id,known);
  assert.deepEqual(sim.captureCheckpoint(),before);
  settle({ok:false,message:'Disk full'});assert.equal((await failed).ok,false);
  assert.deepEqual(sim.captureCheckpoint(),before);assert.deepEqual(calls,['save','notice']);
  calls.length=0;const success=controller.map(poi.id,known);
  assert.deepEqual(calls,['save']);settle({ok:true,message:''});assert.equal((await success).ok,true);
  assert.deepEqual(calls,['save','arrival','notice']);
  assert.equal(sim.player.x,poi.x);assert.equal(sim.player.y,poi.y+42);
  assert.equal(sim.player.prevX,sim.player.x);assert.equal(sim.player.prevY,sim.player.y);
  assert.equal(sim.player.hp,23);assert.equal(sim.player.mana,12);assert.equal(sim.player.flasks,1);
  assert.deepEqual(sim.travel,before.travel);assert.equal(sim.enemies[0],enemy);assert.equal(enemy.hp,11);
  assert.equal(sim.world,world);
});

test('blocked destinations never save or move the character', async () => {
  const sim=new Simulation({...world,blocked:()=>true},{spawn:false});
  const before=sim.captureCheckpoint();
  const result=await executeMapTravel(sim,known,poi.id,()=>{throw Error('Blocked travel must not persist');});
  assert.equal(result.ok,false);assert.match(result.message,/landing/);assert.deepEqual(sim.captureCheckpoint(),before);
});

test('map selection uses visible markers, leaves exploration overlay inert and coalesces travel clicks', async () => {
  let requested=0,finish!:(result:{ok:boolean;message:string})=>void;
  const map=Object.assign(Object.create(WorldMap.prototype),{
    view:{x:0,y:0,width:800,height:500,centerX:poi.x,centerY:poi.y,zoom:.1},
    visiblePOIs:[poi],explorationMode:false,travelBusy:false,opened:true,
    tooltip:{hidden:true},areaInfo:{hidden:true},travelCard:{hidden:true},travelName:{textContent:''},
    travelDescription:{textContent:''},travelButton:{disabled:false,textContent:'',focus(){}},
    travelActions:{problem:()=>null,travel:(id:string)=>{assert.equal(id,poi.id);requested++;return new Promise(resolve=>{finish=resolve;});}},
  });
  map.selectTravel({x:400,y:250});assert.equal(map.travelCard.hidden,false);assert.equal(map.travelName.textContent,poi.name);
  const first=map.travelToSelected();await map.travelToSelected();assert.equal(requested,1);
  finish({ok:false,message:'Storage unavailable'});await first;
  assert.equal(map.travelBusy,false);assert.equal(map.travelButton.disabled,false);
  assert.equal(map.travelDescription.textContent,'Storage unavailable');
  map.selectTravel({x:2,y:2});assert.equal(map.travelCard.hidden,true);
  map.explorationMode=true;map.selectTravel({x:400,y:250});assert.equal(map.travelCard.hidden,true);
});
