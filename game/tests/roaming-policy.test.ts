import test from 'node:test';
import assert from 'node:assert/strict';
import { RoamingEncounters, ROAMING_RULES, ROAMING_PACK_BANDS, roamingSpawnAnchor, shouldRetireRoamer, roamingMemberOffset, roamingFormationRadius, roamingMemberRank } from '../src/roaming-encounters.ts';
import { isSpawnHidden } from '../src/spawn-visibility.ts';
import { Simulation } from '../src/simulation.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import type { WorldQuery } from '../src/model.ts';

test('exploration and elapsed time are both required, and blocked placement preserves earned travel', () => {
  const planner = new RoamingEncounters(); planner.reset(0, 0);
  planner.resolved(6, () => 0); planner.advance({ x: 0, y: 0 }, 1);
  planner.resolved(6, () => 0); planner.advance({ x: 0, y: 0 }, 1);
  assert.equal(planner.groupSize(8, .99), 4, 'initial group finishes the bounded warmup');
  planner.resolved(4, () => 0);
  for (let x = 32; x <= 256; x += 32) planner.advance({ x, y: 0 }, .05);
  assert.equal(planner.ready, false, 'fast travel cannot skip the encounter cooldown');
  planner.advance({ x: 256, y: 0 }, 4);
  assert.equal(planner.ready, true);
  planner.resolved(0, () => { throw new Error('Failed placement must not reroll the encounter cadence'); });
  assert.equal(planner.ready, false);
  planner.advance({ x: 256, y: 0 }, 1);
  assert.equal(planner.ready, true, 'retry retains travel credit');
  planner.resolved(1, () => 0);
  planner.advance({ x: 256, y: 0 }, 60);
  assert.equal(planner.ready, false, 'time alone cannot replenish a cleared encounter');
  planner.advance({ x: 10000, y: 0 }, 1);
  assert.equal(planner.ready, false, 'a position discontinuity cannot bank an encounter wave');
  planner.reset(10000, 0);
  assert.equal(planner.ready, true, 'a fresh run has its own initial population');
});

test('spawn anchors protect the entire loose group for portrait, ultrawide and displaced cameras', () => {
  const subject = { x: -430.5, y: 217.75 };
  const bodyRadius = Math.max(...Object.values(ENEMY_DEFINITIONS).map(enemy => enemy.radius));
  for (const [width, height] of [[400, 2000], [4000, 700], [2600, 1650]]) {
    for (const offset of [-.2, 0, .2]) {
      const view = { x: subject.x - width * (.5 + offset), y: subject.y - height * (.5 - offset), width, height };
      for (let direction = 0; direction < 32; direction++) {
        const angle = direction / 32 * Math.PI * 2;
        // Full-circle fallback deliberately exercises every edge, not just forward spawns.
        const anchor = roamingSpawnAnchor(subject, view, { x: 1, y: 0 }, () => direction / 32, 24);
        assert.ok(Number.isFinite(anchor.x) && Number.isFinite(anchor.y));
        for (let member = 0; member < 16; member++) {
          const spread = member / 16 * Math.PI * 2;
          assert.equal(isSpawnHidden(anchor.x + Math.cos(spread) * 100,
            anchor.y + Math.sin(spread) * 100, view, bodyRadius), true,
          `${width}×${height}, offset ${offset}, direction ${angle}, member ${member}`);
        }
      }
    }
  }
});

test('retirement only releases hidden inactive roamers and never interrupts pursuit or an attack', () => {
  const world: WorldQuery = { blocked: () => false, move: (x, y) => ({ x, y }) };
  const sim = new Simulation(world, { spawn: false });
  const enemy = sim.spawnEnemy('stalker', -800, 0)!;
  const player = { x: 0, y: 0, vx: 160, vy: 0 }, heading = { x: 1, y: 0 };
  const view = { x: -500, y: -350, width: 1000, height: 700 };
  enemy.state = 'patrol'; enemy.awareness = 0;
  assert.equal(shouldRetireRoamer(enemy, player, view, heading), true);
  assert.equal(shouldRetireRoamer(enemy, { ...player, vx: 0 }, view, heading), false);
  assert.equal(shouldRetireRoamer(enemy, player, { ...view, x: -900, width: 1800 }, heading), false);
  enemy.awareness = .8;
  assert.equal(shouldRetireRoamer(enemy, player, view, heading), false);
  enemy.awareness = 0;
  for (const state of ['chase', 'windup', 'attack', 'recover', 'dead'] as const) {
    enemy.state = state;
    assert.equal(shouldRetireRoamer(enemy, player, view, heading), false, state);
  }
  enemy.state = 'idle'; enemy.campId = 'retained-garrison';
  assert.equal(shouldRetireRoamer(enemy, player, view, heading), false, 'camp ledger owns its members');
});

test('roaming packs grow by encounter level while preserving the initial population remainder', () => {
  const planner = new RoamingEncounters();
  planner.resolved(ROAMING_RULES.warmupPopulation, () => 0);
  assert.deepEqual([0, .24, .25, .74, .75, .99].map(roll => planner.groupSize(12, roll)), [4, 4, 5, 5, 6, 6]);
  for(const [i,band] of ROAMING_PACK_BANDS.entries())for(const level of [i?ROAMING_PACK_BANDS[i-1].through+1:1,band.through]){
    assert.equal(planner.groupSize(level,0),band.min);assert.equal(planner.groupSize(level,.999),band.max);
  }
  const initial=new RoamingEncounters();assert.equal(initial.groupSize(100,.99),16);
  initial.resolved(14,()=>0);assert.equal(initial.groupSize(100,.99),2);
});

test('full-size formations stay separated and hidden across camera shapes and headings',()=>{
  let seed=42;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
  for(const [width,height] of [[400,2000],[4000,700],[2600,1650]])for(let heading=0;heading<6.28;heading+=.3){
    const view={x:-width/2,y:-height/2,width,height};
    const anchor=roamingSpawnAnchor({x:0,y:0},view,{x:Math.cos(heading),y:Math.sin(heading)},random,0,roamingFormationRadius(20));
    const points=Array.from({length:20},(_,i)=>roamingMemberOffset(20,i,heading,random));
    for(const [i,p] of points.entries()){
      assert.ok(Math.hypot(p.x,p.y)<=roamingFormationRadius(20));
      assert.ok(isSpawnHidden(anchor.x+p.x,anchor.y+p.y,view,32));
      for(const other of points.slice(0,i))assert.ok(Math.hypot(p.x-other.x,p.y-other.y)>=45);
    }
  }
});

test('extra members favor ordinary enemies without excluding veterans or elites',()=>{
  const counts={normal:0,veteran:0,elite:0};
  for(let i=0;i<1000;i++)counts[roamingMemberRank(80,12,(i+.5)/1000)]++;
  assert.deepEqual(counts,{normal:880,veteran:100,elite:20});
});

test('runtime spawns large regional packs safely but keeps an overlevelled home small',()=>{
  for(const x of [0,200000])for(const seed of [7319,18427,90210]){
    let blocked=false,checks=0;
    const sim=new Simulation({seed,blocked:()=>{checks++;return blocked;},move:(x,y)=>({x,y})},{spawn:false,seed,startX:x,startY:0});
    sim.player.level=80;sim['roaming'].resolved(16,()=>0);
    const view={x:x-200,y:-200,width:400,height:400};
    const count=sim['spawnRoamingGroup'](view);
    assert.ok(x?count>=14&&count<=20:count>=4&&count<=6,`${seed} at ${x}: ${count}`);
    for(const e of sim.enemies)assert.ok(isSpawnHidden(e.x,e.y,view,e.radius));
    const saved=sim.enemies.map(e=>({level:e.level,rank:e.rank,seed:e.lootSeed}));sim.player.level++;
    assert.deepEqual(sim.enemies.map(e=>({level:e.level,rank:e.rank,seed:e.lootSeed})),saved);
    blocked=true;checks=0;assert.equal(sim['spawnRoamingGroup'](view),0);
    assert.ok(checks<=ROAMING_RULES.placementBudget);assert.equal(sim.enemies.length,count);
  }
});
