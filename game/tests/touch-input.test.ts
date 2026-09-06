import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchInput } from '../src/touch-input.ts';
import { TouchGesture } from '../src/touch-gesture.ts';
import { touchTargeting } from '../src/touch-targeting.ts';
import { SKILL_EXECUTION } from '../src/skill-execution-content.ts';
import { skillTargetPoint } from '../src/skill-target-point.ts';
import { PanelCoordinator, type PanelPhase } from '../src/panel-coordinator.ts';
const point={x:100,y:100}, aim={x:200,y:300};

test('movement and aimed attack belong to independent pointers and preserve analog magnitude',()=>{
  const input=new TouchInput();
  assert.ok(input.down(7,'move',point)); input.update(7,{x:128.5,y:100});
  assert.ok(input.down(19,'attack',point));input.update(19,{x:100,y:20});
  const state=input.consume(aim);assert.equal(state.moveX,.5);assert.equal(state.moveY,0);assert.equal(state.attack,true);assert.deepEqual(input.aim,{x:0,y:-1});
  input.up(999);assert.equal(input.consume(aim).attack,true,'unowned release cannot stop attack');
  input.up(7);assert.equal(input.consume(aim).attack,true);assert.equal(input.move.x,0);
  input.up(19);assert.equal(input.consume(aim).attack,false);
});
test('skill aiming takes ownership from a held attack without stealing movement',()=>{
  const input=new TouchInput(); input.down(1,'move',point);input.update(1,{x:150,y:100});input.down(2,'attack',point);
  input.down(3,'skill-4',point,'ground');input.update(3,{x:0,y:100});
  input.update(2,{x:200,y:100});assert.equal(input.aim.x,-1,'attack finger cannot overwrite skill aim');
  assert.equal(input.consume(aim).attack,false);assert.equal(input.consume(aim).moveX,1);
  assert.equal(input.down(4,'skill-0',point),false,'only one skill preview');
  input.up(3);let state=input.consume(aim);assert.equal(state.attack,false);assert.equal(state.skillSlot,4);
  state=input.consume(aim);assert.equal(state.skillSlot,null);assert.equal(state.attack,true,'still-held basic resumes on a later frame');
});
test('cancel zone, system cancel, and capture loss do not commit a skill',()=>{
  for(const canceledBy of ['zone','system'] as const) {
    const input=new TouchInput();input.down(3,'skill-2',point);input.update(3,point,canceledBy==='zone');input.up(3,canceledBy==='system');
    assert.equal(input.consume(aim).skillSlot,null);
  }
});
test('quick taps deliver one action; duplicate releases and held utilities do not repeat',()=>{
  const input=new TouchInput();input.down(1,'heal',point);assert.equal(input.consume(aim).heal,false);input.up(1);input.up(1);
  assert.equal(input.consume(aim).heal,true);assert.equal(input.consume(aim).heal,false);
  input.down(2,'attack',point);input.up(2);assert.equal(input.consume(aim).attack,true);assert.equal(input.consume(aim).attack,false);
  input.down(3,'dodge',point);input.up(3,true);assert.equal(input.consume(aim).dodge,false);
});
test('every application phase discards held and queued touch input before later releases',()=>{
  const phases=['ready','playing','paused','dead','map','character','skills','service','event','journeys'] as const;
  for(const phase of phases) {
    const input=new TouchInput();const panels={} as Record<PanelPhase,{open():void;close():void}>;
    for(const id of ['map','character','skills','service','event','journeys'] as PanelPhase[])panels[id]={open(){},close(){}};
    const coordinator=new PanelCoordinator(panels,{clearInput:()=>input.clear(),changed(){},resumeGameplay(){},save(){}});
    input.down(1,'move',point);input.update(1,{x:160,y:100});input.down(2,'attack',point);input.down(3,'skill-1',point);input.down(4,'heal',point);input.up(4);
    coordinator.transition(phase);
    input.update(1,{x:200,y:100});input.up(2);input.up(3);input.up(4);
    const state=input.consume(aim);assert.equal(state.moveX,0);assert.equal(state.attack,false);assert.equal(state.skillSlot,null);assert.equal(state.heal,false);assert.equal(input.preview,null);
    assert.ok(input.down(5,'attack',point),'fresh contacts still work');
  }
});
test('duplicate roles, capacity and invalid coordinates cannot corrupt touch state',()=>{
  const input=new TouchInput();assert.equal(input.down(1,'move',{x:NaN,y:0}),false);
  assert.ok(input.down(1,'move',point));assert.equal(input.down(2,'move',point),false);
  input.update(1,{x:Infinity,y:0});assert.equal(input.move.x,0);
  input.update(1,{x:10000,y:10000});assert.ok(Math.hypot(input.move.x,input.move.y)<=1.000001);
});
test('tap versus pan uses intent threshold and pinch never selects a node',()=>{
  const g=new TouchGesture();g.down(1,point);assert.equal(g.move(1,{x:104,y:102}),null);assert.deepEqual(g.up(1),{x:104,y:102});
  g.down(1,point);assert.equal(g.move(1,{x:120,y:100})!.dx,20);assert.equal(g.up(1),null);
  g.down(1,point);g.down(2,{x:200,y:100});assert.equal(g.down(3,point),false);assert.equal(g.up(2),null);assert.equal(g.up(1),null);
});
test('pinch midpoint and scale are incremental, with no jump returning to one finger',()=>{
  const g=new TouchGesture();g.down(1,{x:0,y:0});g.down(2,{x:100,y:0});
  const delta=g.move(2,{x:200,y:0})!;assert.deepEqual(delta,{dx:50,dy:0,scale:2,at:{x:100,y:0}});
  g.up(1);assert.equal(g.move(2,{x:205,y:0})!.dx,5);assert.equal(g.up(2),null);
});
test('gesture reset and unknown pointer endings cannot affect the remaining pointer',()=>{
  const g=new TouchGesture();g.down(1,point);g.up(2);assert.equal(g.size,1);g.clear();assert.equal(g.move(1,{x:150,y:0}),null);assert.equal(g.up(1),null);
});
test('all twenty recipes have explicit touch targeting, including omnidirectional melee',()=>{
  assert.equal(Object.keys(SKILL_EXECUTION).length,20);
  for(const recipe of Object.values(SKILL_EXECUTION))assert.ok(['self','ground','direction'].includes(touchTargeting(recipe)));
  assert.equal(touchTargeting(SKILL_EXECUTION.whirlwind),'self');assert.equal(touchTargeting(SKILL_EXECUTION.cleave),'direction');
  assert.equal(touchTargeting(SKILL_EXECUTION.meteor),'ground');assert.equal(touchTargeting(SKILL_EXECUTION.bulwark),'self');
});
test('ground preview and action target obey weapon range and walls',()=>{
  const player={x:0,y:0,angle:0};
  assert.deepEqual(skillTargetPoint({blocked:()=>false},player,{x:1000,y:0},120),{x:120,y:0});
  const stop=skillTargetPoint({blocked:x=>x>=40},player,{x:1000,y:0},120);assert.equal(stop.x,36);
  assert.deepEqual(skillTargetPoint({blocked:()=>true},player,aim,120),{x:0,y:0});
});

test('dropping a touch attack buffer does not cancel an already committed swing',async()=>{
  const { Simulation }=await import('../src/simulation.ts');
  const sim=new Simulation({blocked:()=>false,move:(x,y,dx,dy)=>({x:x+dx,y:y+dy})},{spawn:false});
  const input=new TouchInput();input.down(1,'attack',point);
  sim.update(1/60,input.consume(aim));const committed=sim.player.attack;assert.ok(committed);
  input.up(1);sim.clearBasicAttackInput();
  assert.equal(sim.player.attack,committed);
  for(let i=0;i<120;i++)sim.update(1/120,input.consume(aim));
  assert.equal(sim.player.attack,null);
  assert.equal(sim.drainEvents().filter(e=>e.type==='swing').length,1);
});


test('aim stick is bounded, retains facing at center, and recenters independently on release or cancel',()=>{
  const input=new TouchInput();
  input.down(1,'move',point);input.update(1,{x:150,y:100});
  input.down(2,'attack',point);input.update(2,{x:100,y:-900});
  assert.deepEqual(input.attackStick,{x:0,y:-1});
  assert.deepEqual(input.aim,{x:0,y:-1});
  input.update(2,point);
  assert.deepEqual(input.attackStick,{x:0,y:0});
  assert.deepEqual(input.aim,{x:0,y:-1},'recentering does not snap facing');
  input.update(2,{x:140,y:100});input.up(2,true);
  assert.deepEqual(input.attackStick,{x:0,y:0});
  assert.equal(input.move.x,1,'releasing aim does not interrupt movement');
  input.down(3,'attack',point);input.update(3,{x:130,y:130});input.clear();
  input.update(3,{x:160,y:160});
  assert.deepEqual(input.attackStick,{x:0,y:0},'stale pointer cannot move the knob after a panel opens');
});
