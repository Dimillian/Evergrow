import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_TIME, worldTimeLabel, worldHour, skyAtTime, skyAtHour } from '../src/world-time.ts';
import { shadowProjection, sceneClimate } from '../src/scene-light-style.ts';
import { BIOME_IDS, type BiomeWeights } from '../src/biomes.ts';
import { Simulation } from '../src/simulation.ts';
import { World } from '../src/world.ts';

test('clock wraps at midnight, starts at nine and follows saved simulation time',()=>{
  assert.equal(worldTimeLabel(0),'09:00');
  assert.equal(worldTimeLabel(WORLD_TIME.daySeconds*15/24),'00:00');
  assert.equal(worldTimeLabel(WORLD_TIME.daySeconds),'09:00');
  assert.equal(worldHour(Number.NaN),9);
  const world=new World(7342),sim=new Simulation(world,{seed:7342,spawn:false});
  try {
    sim.time=1823.75;const before=skyAtTime(sim.time),saved=sim.captureCheckpoint();
    const resumed=new Simulation(world,{seed:7342,spawn:false});resumed.restoreCheckpoint(saved);
    assert.deepEqual(skyAtTime(resumed.time),before);
    assert.equal(worldTimeLabel(resumed.time),worldTimeLabel(sim.time));
  } finally {world.dispose();}
});

test('daylight, bounded shadows and tint change continuously through a full day',()=>{
  assert.equal(skyAtHour(12).daylight,1);assert.equal(skyAtHour(0).daylight,0);
  assert(skyAtHour(6.5).warmth>.4);assert(skyAtHour(17.5).warmth>.4);
  const morning=shadowProjection(skyAtHour(7).direction),noon=shadowProjection(skyAtHour(12).direction),evening=shadowProjection(skyAtHour(17).direction);
  assert(morning.x>0&&evening.x<0);assert(Math.hypot(noon.x,noon.y)<Math.hypot(morning.x,morning.y));
  for(let h=0;h<24;h+=.02){
    const a=skyAtHour(h),b=skyAtHour(h+.001);
    assert(a.power>0&&a.power<=1);assert(a.ambient.every(v=>v>.3&&v<1.2));
    assert(Math.abs(a.daylight-b.daylight)<.002);
    assert(a.direction.every((v,i)=>Math.abs(v-b.direction[i])<.002));
  }
  assert.deepEqual(skyAtHour(0),skyAtHour(24));
});

test('all climates share the sky while enclosed material light stays independent',()=>{
  for(const id of BIOME_IDS){
    const weights=Object.fromEntries(BIOME_IDS.map(b=>[b,b===id?1:0])) as BiomeWeights;
    const noon=sceneClimate(weights,0,skyAtHour(12)),night=sceneClimate(weights,0,skyAtHour(0));
    assert(noon.key.power>night.key.power);assert.notEqual(noon.key.color,night.key.color);
    assert.deepEqual(sceneClimate(weights,1,skyAtHour(12)),sceneClimate(weights,1,skyAtHour(0)));
  }
});
