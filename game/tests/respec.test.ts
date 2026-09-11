import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { refreshCharacter } from '../src/character.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { quoteService, planService, respecPoints } from '../src/commerce.ts';
import { executeService } from '../src/commerce-command.ts';
import type { TownNPC } from '../src/npcs.ts';
const world={seed:7319,blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
const npc:TownNPC={id:'enchanter',buildingId:'shop',name:'Vesper',role:'enchanter',x:0,y:0,seed:1,level:1};
function setup(){const sim=new Simulation(world,{spawn:false}),p=sim.player;p.level=20;p.character.skillPoints=19;p.character.statPoints=95;p.character.gold=10000;p.x=p.y=0;assert.ok(executeCharacterCommand(p,{type:'allocateNode',id:'skill:cleave'}).ok);assert.ok(executeCharacterCommand(p,{type:'upgradeSkill',skill:'cleave'}).ok);executeCharacterCommand(p,{type:'assignSkill',slot:0,skill:'cleave'});return p;}
test('respec refunds nodes and extra ranks exactly, without changing attributes or equipment',()=>{const p=setup(),before=structuredClone(p.character),count=respecPoints(before),q=quoteService(before,npc,p.level,{type:'respec'});assert.ok(q.ok);assert.equal(q.quote.price,count*25);const result=planService(before,npc,p.level,q.quote);assert.ok(result.ok);assert.equal(result.character.skillPoints,19);assert.equal(result.character.gold,10000-count*25);assert.deepEqual(result.character.allocatedNodes,['origin']);assert.deepEqual(result.character.skillSlots,Array(5).fill(null));assert.deepEqual(result.character.equipped,before.equipped);assert.deepEqual(result.character.attributes,before.attributes);assert.equal(planService(result.character,npc,p.level,q.quote).ok,false);assert.deepEqual(p.character,before);});
test('respec rechecks spent points, funds and service ownership',()=>{const p=setup(),q=quoteService(p.character,npc,p.level,{type:'respec'});assert.ok(q.ok);assert.equal(quoteService(p.character,{...npc,role:'gambler'},20,{type:'respec'}).ok,false);executeCharacterCommand(p,{type:'upgradeSkill',skill:'cleave'});assert.equal(planService(p.character,npc,20,q.quote).ok,false);p.character.gold=0;const fresh=quoteService(p.character,npc,20,{type:'respec'});assert.ok(fresh.ok);assert.equal(planService(p.character,npc,20,fresh.quote).ok,false);});
test('failed persistence leaves build, wallet, cooldowns and resources intact; success does not heal',async()=>{const p=setup();p.hp=12;p.mana=9;p.skillCooldowns={cleave:3};const before=structuredClone(p),q=quoteService(p.character,npc,20,{type:'respec'});assert.ok(q.ok);assert.equal((await executeService(p,npc,world,q.quote,()=>({ok:false}))).ok,false);assert.deepEqual(p,before);assert.equal((await executeService(p,npc,world,q.quote,()=>({ok:true}))).ok,true);assert.equal(p.hp,12);assert.equal(p.mana,9);assert.deepEqual(p.skillCooldowns,{});});

test('free attribute reset refunds only assigned points and preserves skills and equipment',()=>{
  const p=setup();p.character.attributes={strength:30,dexterity:20,intelligence:50,vitality:25};p.character.statPoints=10;p.character.gold=0;
  const before=structuredClone(p.character),q=quoteService(before,npc,20,{type:'resetAttributes'});assert.ok(q.ok);assert.equal(q.quote.price,0);
  const result=planService(before,npc,20,q.quote);assert.ok(result.ok);
  assert.equal(result.character.statPoints,95);assert.deepEqual(result.character.attributes,{strength:10,dexterity:10,intelligence:10,vitality:10});
  assert.equal(result.character.gold,0);assert.equal(result.character.attributeResetUsed,true);
  assert.deepEqual(result.character.equipped,before.equipped);assert.deepEqual(result.character.skillRanks,before.skillRanks);
  assert.deepEqual(result.character.allocatedNodes,before.allocatedNodes);assert.deepEqual(result.character.skillSlots,before.skillSlots);
  assert.deepEqual(p.character,before);
  result.character.attributes.intelligence++;result.character.statPoints--;
  assert.equal(quoteService(result.character,npc,20,{type:'resetAttributes'}).ok,false);
});

test('attribute reset rejects unspent builds, other vendors and stale allocations',()=>{
  const p=setup();assert.equal(quoteService(p.character,npc,20,{type:'resetAttributes'}).ok,false);
  p.character.attributes.strength++;p.character.statPoints--;
  const q=quoteService(p.character,npc,20,{type:'resetAttributes'});assert.ok(q.ok);
  assert.equal(quoteService(p.character,{...npc,role:'gambler'},20,{type:'resetAttributes'}).ok,false);
  p.character.attributes.intelligence++;p.character.statPoints--;
  assert.equal(planService(p.character,npc,20,q.quote).ok,false);
});

test('attribute reset consumes its entitlement only after persistence and does not clear cooldowns or heal',async()=>{
  const p=setup();p.character.attributes.intelligence+=50;p.character.statPoints-=50;p.hp=12;p.mana=9;p.skillCooldowns={cleave:3};
  const before=structuredClone(p),q=quoteService(p.character,npc,20,{type:'resetAttributes'});assert.ok(q.ok);
  assert.equal((await executeService(p,npc,world,q.quote,()=>({ok:false}))).ok,false);assert.deepEqual(p,before);
  assert.equal((await executeService(p,npc,world,q.quote,(sheet,hp,mana)=>{assert.equal(sheet.attributeResetUsed,true);assert.equal(hp,12);assert.equal(mana,9);return {ok:true};})).ok,true);
  assert.equal(p.hp,12);assert.equal(p.mana,9);assert.deepEqual(p.skillCooldowns,{cleave:3});assert.equal(p.character.attributeResetUsed,true);
});


test('attribute refund clamps both resources before saving and after live commitment',async()=>{
  const p=setup();p.character.attributes.intelligence+=50;p.character.attributes.vitality+=40;p.character.statPoints-=90;
  refreshCharacter(p);p.hp=p.maxHp;p.mana=p.maxMana;
  assert.ok(p.hp>100&&p.mana>100);
  const q=quoteService(p.character,npc,20,{type:'resetAttributes'});assert.ok(q.ok);
  assert.equal((await executeService(p,npc,world,q.quote,(_sheet,hp,mana)=>{assert.equal(hp,100);assert.equal(mana,100);return {ok:true};})).ok,true);
  assert.equal(p.hp,100);assert.equal(p.mana,100);assert.equal(p.character.statPoints,95);
});
