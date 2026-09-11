import { enemyWindupDuration } from '../src/enemy-threat.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { newExpeditionRoute, expeditionChoices, expeditionRewardItems, dungeonChestMask } from '../src/expedition-route.ts';
import { Simulation } from '../src/simulation.ts';
import { World } from '../src/world.ts';
import { DungeonWorld } from '../src/dungeon-world.ts';
import { generateDungeon, dungeonBlocked } from '../src/dungeon.ts';
import { currentDungeon } from '../src/dungeon-state.ts';
import { planDungeonTravel, claimDungeonChest, expeditionTableProblem } from '../src/dungeon-command.ts';
import { validExpeditions } from '../src/dungeon-validation.ts';
import { validItem } from '../src/item-validation.ts';
import { decodeCharacterSave, type CharacterCheckpoint } from '../src/character-save.ts';
const ok=()=>({ok:true,message:''});
function setup(){const world=new World(7319),table=world.getBuildings(-1500,-2200,3000,3000).find(b=>b.kind==='expedition')!;assert.ok(table);const sim=new Simulation(world,{spawn:false,startX:table.door.x,startY:table.door.y+18});sim.player.level=20;sim.player.character.skillPoints=19;sim.player.character.statPoints=95;return {world,table,sim};}
function restore(sim:Simulation,c:CharacterCheckpoint,world:World){const r=currentDungeon(c.expeditions!);sim.world=r?new DungeonWorld(generateDungeon(r.entrance.seed,r.entrance.level,r.entrance),r.entrance):world;sim.restoreCheckpoint(c);}
function decoded(c:CharacterCheckpoint){return decodeCharacterSave(JSON.stringify({version:4,id:'test',name:'Test',createdAt:1,updatedAt:2,worldSeed:7319,worldVersion:10,checkpoint:c}));}
test('ten-stage routes are deterministic, vary forks, expose source difficulty, and build larger safe floors',()=>{let forks=0,single=0;const themes=new Set();for(let seed=0;seed<18;seed++){const route=newExpeditionRoute(seed,20,1);for(let stage=0;stage<10;stage++){route.cleared=stage;const choices=expeditionChoices(route);assert.deepEqual(choices,expeditionChoices(route));choices.length===1?single++:forks++;for(const e of choices){themes.add(e.theme);assert.equal(e.level,20+stage+(e.expedition!.modifier==='peril'?2:0));const f=generateDungeon(e.seed,e.level,e);assert.ok(f.rooms.length>=10&&f.rooms.length<=12);for(const m of f.members)assert.equal(dungeonBlocked(f,m.x,m.y,25),false);}}}assert.equal(themes.size,6);assert.ok(forks&&single);});
test('level gate and failed entry cannot create or reroll a route',async()=>{const {world,table,sim}=setup(),action={kind:'expedition',tableId:table.id,choice:0,attempt:0} as const;sim.player.level=19;assert.equal((await planDungeonTravel(sim,action,world,ok)).ok,false);sim.player.level=20;const before=sim.captureCheckpoint();assert.equal((await planDungeonTravel(sim,action,world,()=>({ok:false,message:'disk full'}))).ok,false);assert.deepEqual(sim.captureCheckpoint(),before);const r=await planDungeonTravel(sim,action,world,ok);assert.ok(r.ok);assert.ok(validExpeditions(r.checkpoint.expeditions));assert.ok(decoded(r.checkpoint));});
test('stage rewards commit exactly once, resume across town visits, and death resets only expedition progress',async()=>{const {world,table,sim}=setup();const entry=await planDungeonTravel(sim,{kind:'expedition',tableId:table.id,choice:0,attempt:0},world,ok);assert.ok(entry.ok);restore(sim,entry.checkpoint,world);let run=currentDungeon(sim.expeditions)!;run.states.warden.hp=0;const chest=sim.dungeonFloor!.chests[2];sim.player.x=chest.x;sim.player.y=chest.y;const before=sim.captureCheckpoint();assert.equal((await claimDungeonChest(sim,2,()=>({ok:false,message:'disk full'}))).ok,false);assert.deepEqual(sim.captureCheckpoint(),before);assert.equal((await claimDungeonChest(sim,2,ok)).ok,true);assert.equal(sim.expeditions.route!.cleared,1);assert.equal(sim.groundItems.length,3);assert.equal((await claimDungeonChest(sim,2,ok)).ok,false);assert.ok(decoded(sim.captureCheckpoint()));sim.player.x=sim.dungeonFloor!.exit.x;sim.player.y=sim.dungeonFloor!.exit.y;const exit=await planDungeonTravel(sim,{kind:'exit'},world,ok);assert.ok(exit.ok);restore(sim,exit.checkpoint,world);const next=await planDungeonTravel(sim,{kind:'expedition',tableId:table.id,choice:0,attempt:1},world,ok);assert.ok(next.ok);restore(sim,next.checkpoint,world);run=currentDungeon(sim.expeditions)!;assert.equal(run.entrance.expedition!.stage,1);sim.player.hp=0;sim.player.dead=true;const died=await planDungeonTravel(sim,{kind:'death'},world,ok);assert.ok(died.ok);assert.equal(died.checkpoint.expeditions!.route!.status,'failed');assert.equal(died.checkpoint.expeditions!.runs.length,0);assert.equal(died.checkpoint.character.skillPoints,19);assert.equal(died.checkpoint.travel!.returnTo,null);assert.ok(decoded(died.checkpoint));});
test('grand chest has six valid deterministic high-tier rolls and independent claim bits',()=>{let epic=0,legendary=0,count=0;for(let seed=0;seed<100;seed++){const route=newExpeditionRoute(seed,20,1);route.cleared=9;const e=expeditionChoices(route)[0],items=expeditionRewardItems(e);assert.equal(items.length,6);assert.deepEqual(items,expeditionRewardItems(e));for(const i of items){assert.ok(validItem(i));assert.ok(['rare','epic','legendary'].includes(i.tier));assert.equal(i.itemLevel,e.level+3);epic+=Number(i.tier==='epic');legendary+=Number(i.tier==='legendary');count++;}assert.equal(dungeonChestMask({entrance:e} as never,2),127);}assert.ok(epic/count>.55&&epic/count<.75);assert.ok(legendary/count>.1&&legendary/count<.3);});

test('ten stages survive saves, permit loot recovery, and finish a partial grand chest exactly once', async () => {
  const {world, table, sim} = setup();
  for (let stage = 0; stage < 10; stage++) {
    const entry = await planDungeonTravel(sim, {kind:'expedition',tableId:table.id,choice:0,attempt:stage?1:0}, world, ok);
    assert.ok(entry.ok, entry.message);
    restore(sim, entry.checkpoint, world);
    const run = currentDungeon(sim.expeditions)!;
    assert.equal(run.entrance.expedition!.stage, stage);
    run.states.warden.hp = 0;
    Object.assign(sim.player, sim.dungeonFloor!.chests[2]);
    if (stage === 9) {
      sim.groundGold = Array.from({length:128}, (_,i)=>({id:1000+i,x:sim.player.x,y:sim.player.y,amount:1,age:0}));
      assert.equal((await claimDungeonChest(sim, 2, ok)).ok, true);
      assert.equal(currentDungeon(sim.expeditions)!.chestMasks[2], 63);
      assert.equal(sim.expeditions.route!.cleared, 9);
      assert.equal(sim.groundItems.length, 6);
      assert.ok(decoded(sim.captureCheckpoint()));
      restore(sim,sim.captureCheckpoint(),world);
      sim.groundGold.pop();
    }
    assert.equal((await claimDungeonChest(sim, 2, ok)).ok, true);
    assert.equal(sim.expeditions.route!.cleared, stage+1);
    assert.equal(sim.groundItems.length, stage===9?6:3);
    assert.equal((await claimDungeonChest(sim, 2, ok)).ok, false);
    assert.ok(decoded(sim.captureCheckpoint()));
    Object.assign(sim.player,sim.dungeonFloor!.exit);
    const exit=await planDungeonTravel(sim,{kind:'exit'},world,ok);
    assert.ok(exit.ok);restore(sim,exit.checkpoint,world);
    const resume=await planDungeonTravel(sim,{kind:'expedition',tableId:table.id,choice:-1,attempt:1,resume:run.entrance.id},world,ok);
    assert.ok(resume.ok);restore(sim,resume.checkpoint,world);
    assert.equal(sim.groundItems.length,stage===9?6:3);
    assert.equal(sim.expeditions.route!.cleared,stage+1);
    const back=await planDungeonTravel(sim,{kind:'exit'},world,ok);
    assert.ok(back.ok);restore(sim,back.checkpoint,world);
  }
  assert.equal(sim.expeditions.route!.status,'complete');
  const last=sim.expeditions.runs.at(-1)!;
  const resume=await planDungeonTravel(sim,{kind:'expedition',tableId:table.id,choice:-1,attempt:1,resume:last.entrance.id},world,ok);
  assert.ok(resume.ok);restore(sim,resume.checkpoint,world);
  sim.player.hp=0;sim.player.dead=true;
  const death=await planDungeonTravel(sim,{kind:'death'},world,ok);
  assert.ok(death.ok);
  assert.equal(death.checkpoint.expeditions!.route!.cleared,0);
  assert.equal(death.checkpoint.expeditions!.route!.status,'failed');
  assert.ok(decoded(death.checkpoint),'dying after the grand chest still produces a valid checkpoint');
});

test('Rime and Astral fracture attacks use their own elements, timings, and one hit per attack', async () => {
  const {updateWarden,wardenProfile}=await import('../src/dungeon-boss.ts');
  const world={blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy}),isSanctuary:()=>false};
  const sim=new Simulation(world,{spawn:false,startX:0,startY:0});
  for(const theme of ['rime','astral'] as const){
    const e=sim.spawnEnemy('warden',sim.player.x-300,sim.player.y)!;
    e.dungeonTheme=theme;e.state='chase';e.bossTurns=2;e.hp=e.maxHp;
    const hits:string[]=[];
    const context={player:sim.player,enemies:sim.enemies,world:{...world,isSanctuary:()=>false},time:0,trial:null,visible:()=>true,move:()=>{},hurt:(_n:number,_a:number,_e:typeof e,element:string)=>hits.push(element),shoot:()=>{},emit:()=>{}};
    updateWarden(e,1/120,context);
    assert.equal(e.bossMove,'fracture');
    assert.equal(e.stateDuration,enemyWindupDuration(e,wardenProfile(theme).warning));
    e.stateTime=e.stateDuration;updateWarden(e,1/120,context);
    for(let i=0;i<110;i++){e.stateTime+=1/120;updateWarden(e,1/120,context);}
    assert.deepEqual(hits,[theme==='rime'?'frost':'arcane']);
    sim.enemies=[];
  }
});

test('forks never repeat a theme or modifier, and the full modifier pool is offered', async () => {
  const {EXPEDITION_MODIFIER_IDS}=await import('../src/expedition-modifiers.ts');
  const seen=new Set<string>();
  for(let seed=0;seed<100;seed++)for(let stage=0;stage<10;stage++){
    const choices=expeditionChoices({...newExpeditionRoute(seed,20,1),cleared:stage});
    assert.equal(new Set(choices.map(e=>e.theme)).size,choices.length);
    assert.equal(new Set(choices.map(e=>e.expedition!.modifier)).size,choices.length);
    choices.forEach(e=>seen.add(e.expedition!.modifier));
  }
  assert.deepEqual([...seen].sort(),[...EXPEDITION_MODIFIER_IDS].sort());
});

test('new modifier recipes change real chamber guards and boss reinforcements', async () => {
  const {EXPEDITION_MODIFIER_IDS}=await import('../src/expedition-modifiers.ts');
  const entry=expeditionChoices(newExpeditionRoute(7319,20,1))[0];
  for(const modifier of EXPEDITION_MODIFIER_IDS){
    const e={...entry,expedition:{...entry.expedition!,modifier}};
    const floor=generateDungeon(e.seed,e.level,e),run=(await import('../src/dungeon-state.ts')).createDungeonRun(e);
    for(const member of floor.members){
      const i=Number(member.id.split(':').at(-1));
      if(member.id.startsWith('room:')){
        if(modifier==='elite'&&i%4===0)assert.equal(member.rank,'elite');
        if(modifier==='veterans'&&i%2===0)assert.notEqual(member.rank,'normal');
        const kinds={ranged:'archer',brutes:'brute',coven:'caster',hunt:'hound'};
        if(modifier in kinds&&i%3===0)assert.equal(member.kind,kinds[modifier as keyof typeof kinds]);
      }
      if(modifier==='retinue'&&member.id.startsWith('buried:'))assert.equal(member.rank,'elite');
      assert.ok(run.states[member.id].hp>0);assert.equal(dungeonBlocked(floor,member.x,member.y,25),false);
    }
  }
});

test('saved chosen dungeons retain their identity when the available content pool changes', async () => {
  const {world,table,sim}=setup();
  const route=newExpeditionRoute(world.seed,20,1);route.choice=0;
  // A valid older roll need not match the choices generated by today's modifier pool.
  const original={...expeditionChoices(route,{x:table.door.x,y:table.door.y+14})[0],seed:99871,theme:'rime' as const,level:20,scaling:{base:20,min:19,max:21}};
  original.expedition={...original.expedition!,modifier:'elite'};
  const {createDungeonRun}=await import('../src/dungeon-state.ts');
  const run=createDungeonRun(original);
  sim.expeditions.route=route;sim.expeditions.runs=[run];
  assert.ok(validExpeditions(sim.expeditions));
  const next=await planDungeonTravel(sim,{kind:'expedition',tableId:table.id,choice:0,attempt:1},world,ok);
  assert.ok(next.ok);assert.deepEqual(currentDungeon(next.checkpoint.expeditions!)!.entrance,original);
  assert.ok(decoded(next.checkpoint));
  const bad=structuredClone(next.checkpoint.expeditions!);bad.runs[0].entrance.expedition!.modifier='fake' as never;
  assert.equal(validExpeditions(bad),false);
});


test('level-25 characters enter from every reachable table side, including behind its solid footprint',async()=>{
  const {world,table,sim}=setup();
  try {
    sim.player.level=25;sim.player.character.skillPoints=24;sim.player.character.statPoints=120;
    for(const [side,x,y] of [
      ['front',table.door.x,table.door.y+25],
      ['back',table.door.x,table.y-25],
      ['left',table.x-25,table.y+table.height/2],
      ['right',table.x+table.width+25,table.y+table.height/2],
    ] as const){
      sim.player.x=x;sim.player.y=y;
      assert.equal(world.blocked(x,y,sim.player.radius),false,side);
      assert.equal(expeditionTableProblem(table,sim.player,world),null,side);
      let saved=false;
      const result=await planDungeonTravel(sim,{kind:'expedition',tableId:table.id,choice:0,attempt:0},world,()=>{saved=true;return ok();});
      assert.equal(result.ok,true,side);assert.equal(saved,true,side);
      if(result.ok)assert.ok(decoded(result.checkpoint),side);
    }
  } finally {world.dispose();}
});

test('table entry distinguishes level, distance, missing table and obstruction without saving',async()=>{
  const {world,table,sim}=setup();const action={kind:'expedition',tableId:table.id,choice:0,attempt:0} as const;
  let writes=0;const persist=()=>{writes++;return ok();};
  try {
    sim.player.level=19;
    assert.deepEqual(await planDungeonTravel(sim,action,world,persist),{ok:false,message:'Expeditions unlock at level 20.'});
    sim.player.level=25;
    assert.deepEqual(await planDungeonTravel(sim,{...action,tableId:'missing'},world,persist),{ok:false,message:'Visit an expedition table.'});
    sim.player.y=table.door.y+100;
    assert.deepEqual(await planDungeonTravel(sim,action,world,persist),{ok:false,message:'Move closer to the expedition table.'});
    sim.player.x=table.door.x;sim.player.y=table.y-25;
    // An actual wall between the player and table remains a blocker.
    const blockedWorld=Object.create(world) as World;
    blockedWorld.blocked=(x,y,r)=>Math.abs(y-(table.y-12))<3||world.blocked(x,y,r);
    assert.match(expeditionTableProblem(table,sim.player,blockedWorld)!,/blocked/);
    const denied=await planDungeonTravel(sim,action,blockedWorld,persist);
    assert.equal(denied.ok,false);assert.match(denied.message,/blocked/);assert.equal(writes,0);
  } finally {world.dispose();}
});
