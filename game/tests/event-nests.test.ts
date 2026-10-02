import test from 'node:test';
import assert from 'node:assert/strict';
import { eventSealTarget } from '../src/event-recipes.ts';
import { eventInteractionSites, eventSite, focusEvent, type EventSite } from '../src/poi-content.ts';
import { World } from '../src/world.ts';
import { executeEvent } from '../src/poi-command.ts';
import { validEvents } from '../src/poi-validation.ts';
import { Simulation } from '../src/simulation.ts';
import type { WorldQuery } from '../src/model.ts';
import type { WildernessSite } from '../src/wilderness-sites.ts';
import { drawEventObjectives } from '../src/poi-art.ts';

const site: EventSite = { id: 'site:7319:nest-test', name: 'The Red Nest', kind: 'beastDen', seed: 0, biome: 'frostpine', level: 1, x: 0, y: 30 };
const nests = [{x:140,y:0}, {x:0,y:-140}, {x:-140,y:0}].map((point,i) => ({...point, id:`nest-${i}`, kind:'nest' as const, radius:16, scale:1.1+i*.1, angle:0, seed:i}));
const blueprint: WildernessSite = {...site, kind:'beastDen', description:'', radius:160, entrance:{x:0,y:160}, members:[], decor:nests};
function fixture() {
  let wall = false;
  const world: WorldQuery = {
    getWildernessSites: () => [blueprint],
    blocked: (x,y,r) => (wall && x>160 && x<170) || nests.some(n=>Math.hypot(x-n.x,y-n.y)<n.radius+r),
    move: (x,y,dx,dy) => ({x:x+dx,y:y+dy}),
  };
  return {world, sim:new Simulation(world,{spawn:false}), setWall:()=>{wall=true;}};
}
const persist = () => ({ok:true,message:''});

test('generated rotated dens expose every physical nest from a clear nearby position',()=>{
  const world=new World(7319);
  const dens=world.getWildernessSites(-8000,-8000,16000,16000).filter(s=>s.kind==='beastDen');
  assert.ok(dens.length>0);
  for(const den of dens) for(let wave=0;wave<3;wave++) {
    const s=eventSite(den,7319), target=eventSealTarget(s,wave,world);
    assert.deepEqual(target.nest,den.decor.filter(d=>d.kind==='nest')[wave]);
    const reachable=Array.from({length:16},(_,i)=>({x:target.x+Math.cos(i*Math.PI/8)*55,y:target.y+Math.sin(i*Math.PI/8)*55,dead:false}))
      .some(p=>!world.blocked(p.x,p.y,18)&&focusEvent([{...s,...target}],p,world));
    assert.ok(reachable,`${den.id} nest ${wave+1} is interactable`);
  }
  world.dispose();
});
function clearWave(sim: Simulation) {
  const trial=sim.eventState.trial!;
  for(const g of trial.guardians.filter(g=>g.wave===trial.wave)) {g.admitted=true;g.dead=true;g.hp=0;}
  trial.started=true;trial.sealReady=true;
}

test('brood markers and interactions use the existing nests, including an already-started saved trial', async()=>{
  const {sim,world}=fixture();
  assert.ok((await executeEvent(sim,site,null,persist)).ok);
  for(let wave=0;wave<3;wave++) {
    clearWave(sim);
    const saved=sim.captureCheckpoint();
    assert.ok(validEvents(saved.events));
    sim.restoreCheckpoint(saved);
    const target=eventSealTarget(sim.eventState.sites[site.id],wave,world);
    assert.deepEqual({x:target.x,y:target.y},{x:nests[wave].x,y:nests[wave].y});
    sim.player.x=target.x+50;sim.player.y=target.y;
    const candidates=eventInteractionSites([],sim.eventState,world);
    assert.equal(focusEvent(candidates,sim.player,world)?.id,site.id,'solid nest itself does not block interaction');
    assert.ok((await executeEvent(sim,site,null,persist)).ok,'command resolves the same physical nest from the original site');
    assert.ok(validEvents(sim.eventState));
    if(wave<2) assert.equal(sim.eventState.trial!.wave,wave+1);
  }
  assert.equal(sim.eventState.trial,null);
  assert.equal(sim.eventState.sites[site.id].phase,'completed');
});

test('walls, distance and failed persistence cannot advance a nest objective',async()=>{
  const {sim,world,setWall}=fixture();
  assert.ok((await executeEvent(sim,site,null,persist)).ok);clearWave(sim);
  sim.player.x=190;sim.player.y=0;
  const before=structuredClone(sim.eventState);
  assert.equal((await executeEvent(sim,site,null,()=>({ok:false,message:'Save failed'}))).ok,false);
  assert.deepEqual(sim.eventState,before);
  sim.player.x=240;
  assert.equal(focusEvent(eventInteractionSites([],sim.eventState,world),sim.player,world),undefined);
  assert.equal((await executeEvent(sim,site,null,persist)).ok,false);
  sim.player.x=190;setWall();
  assert.equal(focusEvent(eventInteractionSites([],sim.eventState,world),sim.player,world),undefined);
  assert.equal((await executeEvent(sim,site,null,persist)).ok,false);
  assert.deepEqual(sim.eventState,before);
});

test('the objective artwork is anchored over the same physical nest as the interaction',async()=>{
  const {sim,world}=fixture();await executeEvent(sim,site,null,persist);clearWave(sim);
  const translations:number[][]=[];
  const context=new Proxy({}, { get:(_,key)=>key==='translate' ? (...args:number[])=>translations.push(args)
    : key==='createRadialGradient' ? ()=>({addColorStop(){}}) : ()=>{} });
  drawEventObjectives(context as CanvasRenderingContext2D,sim.eventState,0,world);
  assert.deepEqual(translations[0],[nests[0].x,nests[0].y]);
  assert.deepEqual(translations[1],[0,-28]);
});
