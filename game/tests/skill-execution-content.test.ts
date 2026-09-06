import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILL_EXECUTION, groundEffectPulseCount, skillDamageSuffix, skillUtilityLabel } from '../src/skill-execution-content.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { scheduleGroundEffect, advanceGroundEffects, type ActiveGroundEffect, type GroundEffectRequest } from '../src/ground-effects.ts';
import { Simulation } from '../src/simulation.ts';
import type { CombatEvent } from '../src/model.ts';

test('every skill has immutable finite execution content and numeric UI reads its recipe', () => {
  assert.deepEqual(Object.keys(SKILL_EXECUTION).sort(), Object.keys(SKILL_DEFINITIONS).sort());
  const verify = (value: unknown): void => {
    if (typeof value === 'number') assert.ok(Number.isFinite(value));
    if (value && typeof value === 'object') {
      assert.ok(Object.isFrozen(value));
      for (const child of Object.values(value)) verify(child);
    }
  };
  verify(SKILL_EXECUTION);
  assert.equal(skillUtilityLabel('bulwark'), `${SKILL_EXECUTION.bulwark.duration}s guard`);
  assert.equal(skillDamageSuffix('volley'), ' / arrow');
  assert.equal(skillDamageSuffix('rainOfArrows'), ' / wave');
  assert.equal(skillDamageSuffix('meteor'), '');
  assert.ok(SKILL_DEFINITIONS.arcLightning.description.includes(String(SKILL_EXECUTION.arcLightning.jumps)));
  assert.ok(SKILL_DEFINITIONS.rainOfArrows.description.includes(String(groundEffectPulseCount(SKILL_EXECUTION.rainOfArrows))));
});

test('scheduled ground attacks snapshot burn and damage, and cannot hit unseen targets', () => {
  const sim = new Simulation({ blocked: () => false, move: (x, y) => ({ x, y }) }, { spawn: false });
  const near = sim.spawnEnemy('brute', 20, 0)!, hidden = sim.spawnEnemy('brute', 25, 0)!;
  const events: CombatEvent[] = [], effects: ActiveGroundEffect[] = [];
  const burn = { duration: 3, dps: 5 };
  const request: GroundEffectRequest = { kind: 'meteor', skill: 'meteor', x: 0, y: 0, radius: 50,
    delay: .05, duration: 0, interval: 1, damage: 12, style: 'fire', burn };
  scheduleGroundEffect(effects, request, { nextId: () => 1, emit: event => events.push(event) });
  request.damage = 500; burn.duration = 10; burn.dps = 500; request.radius = 1000;
  const result = advanceGroundEffects(effects, .1, {
    player: sim.player, enemies: sim.enemies, visible: (_ax, _ay, bx) => bx !== hidden.x,
    damage: (enemy, amount) => { enemy.hp -= amount; }, emit: event => events.push(event),
  });
  assert.equal(near.hp, near.maxHp - 12); assert.equal(hidden.hp, hidden.maxHp);
  assert.equal(near.burnTime, 3); assert.equal(near.burnDps, 5); assert.equal(hidden.burnTime, 0);
  assert.equal(result.length, 0); assert.deepEqual(events.map(event => event.type), ['ground', 'blast']);
  const blast = events.find(event => event.type === 'blast')!; assert.equal(blast.radius, 50);
});

test('Tempest follows its caster, pays each pulse and ends without free damage when upkeep fails', () => {
  const sim=new Simulation({blocked:()=>false,move:(x,y)=>({x,y})},{spawn:false});
  const p=sim.player;
  // Exercise the ground executor independently of the input/gear transaction layer.
  p.equipment={mainHand:{...p.equipment.mainHand,family:'staff',attackKind:'bolt'},offHand:null};
  p.x=100; p.mana=18;
  const enemy=sim.spawnEnemy('brute',110,0)!;
  let effects:ActiveGroundEffect[]=[], hits=0;
  scheduleGroundEffect(effects,{kind:'storm',skill:'tempest',x:0,y:0,radius:30,delay:0,duration:6,interval:.5,damage:3,style:'lightning',follow:true,upkeep:18}, {nextId:()=>1,emit:()=>{}});
  const context={player:p,enemies:sim.enemies,visible:()=>true,damage:()=>{hits++;},emit:()=>{}};
  effects=advanceGroundEffects(effects,.5,context); assert.equal(hits,1); assert.equal(p.mana,9); assert.equal(effects[0].x,100);
  p.x=200; enemy.x=210;
  effects=advanceGroundEffects(effects,.5,context); assert.equal(hits,2); assert.equal(p.mana,0); assert.equal(effects[0].x,200);
  effects=advanceGroundEffects(effects,.5,context); assert.equal(hits,2); assert.equal(effects.length,0);
});

test('Tempest cancels on death or loss of its staff and does not charge again',()=>{
  for(const reason of ['death','weapon'] as const) {
    const sim=new Simulation({blocked:()=>false,move:(x,y)=>({x,y})},{spawn:false});
    const p=sim.player; p.equipment={mainHand:{...p.equipment.mainHand,family:'staff',attackKind:'bolt'},offHand:null};
    const effects:ActiveGroundEffect[]=[];
    scheduleGroundEffect(effects,{kind:'storm',skill:'tempest',x:0,y:0,radius:30,delay:0,duration:6,interval:.5,damage:3,style:'lightning',follow:true,upkeep:18}, {nextId:()=>1,emit:()=>{}});
    if(reason==='death') p.dead=true; else p.equipment.mainHand={...p.equipment.mainHand,family:'sword',attackKind:'melee'};
    assert.equal(advanceGroundEffects(effects,.5,{player:p,enemies:[],visible:()=>true,damage:()=>assert.fail('cancelled storm hit'),emit:()=>{}}).length,0);
    assert.equal(p.mana,100);
  }
});

test('Absolute Zero snapshots frost and gives elites a shorter freeze without bypassing walls',()=>{
  const sim=new Simulation({blocked:()=>false,move:(x,y)=>({x,y})},{spawn:false});
  const normal=sim.spawnEnemy('brute',20,0)!, elite=sim.spawnEnemy('brute',30,0,'elite')!, hidden=sim.spawnEnemy('brute',40,0)!;
  const slow={duration:4,factor:.25};
  const effects:ActiveGroundEffect[]=[];
  scheduleGroundEffect(effects,{kind:'frost',skill:'absoluteZero',x:0,y:0,radius:50,delay:0,duration:0,interval:1,damage:3,style:'frost',slow,stun:1.5},{nextId:()=>1,emit:()=>{}});
  slow.factor=.9;
  advanceGroundEffects(effects,.01,{player:sim.player,enemies:sim.enemies,visible:(_x,_y,x)=>x!==hidden.x,damage:()=>{},emit:()=>{}});
  assert.equal(normal.stagger,1.5); assert.ok(Math.abs(elite.stagger-.3)<1e-8);
  assert.equal(normal.slowFactor,.25); assert.equal(hidden.stagger,0); assert.equal(hidden.slowTime,0);
});
