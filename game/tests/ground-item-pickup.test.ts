import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { generateItem } from '../src/items.ts';
import { GROUND_PICKUP_RANGE } from '../src/ground-item-pickup.ts';
import type { Input, WorldQuery } from '../src/model.ts';

const idle: Input = { moveX: 0, moveY: 0, aimX: 300, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const open: WorldQuery = { blocked: () => false, move: (x,y,dx,dy) => ({ x:x+dx,y:y+dy }) };
function setup(world = open, x = 180) {
  const sim = new Simulation(world, { spawn:false, seed:984319 });
  sim.player.x=sim.player.y=0;
  sim.groundItems.push({ id:901,x,y:0,item:generateItem(901,1) });
  return sim;
}
function advance(sim:Simulation, seconds:number, input:Partial<Input>={}) {
  for(let i=0;i<seconds/FIXED_STEP;i++)sim.update(FIXED_STEP,{...idle,...input});
}

test('standing on loot never picks it up; selecting one item leaves its neighbor untouched', () => {
  const sim=setup(open,0);
  sim.groundItems.push({id:902,x:0,y:0,item:generateItem(902,1)});
  advance(sim,1);
  assert.equal(sim.groundItems.length,2);
  assert.equal(sim.requestGroundItem(901),null);
  advance(sim,1);
  assert.deepEqual(sim.groundItems.map(d=>d.id),[902]);
  assert.equal(sim.player.character.inventory.filter(i=>i?.id===generateItem(901,1).id).length,1);
  assert.equal(sim.drainEvents().filter(e=>e.type==='loot').length,1);
});

test('click pickup walks to a distant item inside a town sanctuary', () => {
  const sim=setup({...open,isSanctuary:()=>true});
  assert.equal(sim.requestGroundItem(901),null);
  advance(sim,3);
  assert.equal(sim.groundItems.length,0);
  assert.ok(sim.player.x>=150 && sim.player.x<=180);
  assert.equal(sim.groundPickup.id,null);
});

for(const [name,input] of Object.entries({movement:{moveY:1},attack:{attack:true},dodge:{dodge:true},skill:{skillSlot:0}})) {
  test(`${name} cancels pickup without taking the item`,()=>{
    const sim=setup();sim.requestGroundItem(901);
    advance(sim,.1,input);
    assert.equal(sim.groundPickup.id,null);
    assert.equal(sim.groundItems.length,1);
  });
}

test('damage, menu clearing and removed items cancel the approach',()=>{
  for(const cancel of [(s:Simulation)=>{s.player.hp-=1;},(s:Simulation)=>s.clearInput(),(s:Simulation)=>{s.groundItems=[];}]) {
    const sim=setup();sim.requestGroundItem(901);cancel(sim);advance(sim,.1);
    assert.equal(sim.groundPickup.id,null);
    assert.equal(sim.player.character.inventory.filter(Boolean).length,0);
  }
});

test('too-distant, airborne and full-bag items reject pickup without loss',()=>{
  const sim=setup(open,GROUND_PICKUP_RANGE+1);
  assert.equal(sim.requestGroundItem(901),'Move closer');
  const drop=sim.groundItems[0];drop.x=0;
  drop.flight={at:sim.time,delay:0,x:0,y:0};
  assert.equal(sim.requestGroundItem(901),'Item is landing');
  delete drop.flight;
  sim.player.character.inventory.fill(generateItem(900,1));
  assert.equal(sim.requestGroundItem(901),'Inventory full');
  assert.equal(sim.groundItems.length,1);
  assert.equal(sim.groundPickup.id,null);
});

test('pickup routes around obstacles and gives up when no route exists',()=>{
  const blocked=(x:number,y:number,r=0)=>Math.abs(x-80)<18+r&&Math.abs(y)<50+r;
  const world:WorldQuery={blocked,move:(x,y,dx,dy,r)=>blocked(x+dx,y+dy,r)?{x,y}:{x:x+dx,y:y+dy}};
  const sim=setup(world);sim.requestGroundItem(901);advance(sim,6);
  assert.equal(sim.groundItems.length,0);
  const trapped=setup({...open,blocked:()=>true});trapped.requestGroundItem(901);advance(trapped,3);
  assert.equal(trapped.groundPickup.id,null);
  assert.equal(trapped.groundItems.length,1);
});
