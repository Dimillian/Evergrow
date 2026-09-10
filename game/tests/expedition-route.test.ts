import test from 'node:test';
import assert from 'node:assert/strict';
import { newExpeditionRoute, expeditionChoices, expeditionRewardItems, dungeonChestMask } from '../src/expedition-route.ts';
import { Simulation } from '../src/simulation.ts';
import { World } from '../src/world.ts';
import { DungeonWorld } from '../src/dungeon-world.ts';
import { generateDungeon, dungeonBlocked } from '../src/dungeon.ts';
import { currentDungeon } from '../src/dungeon-state.ts';
import { planDungeonTravel, claimDungeonChest } from '../src/dungeon-command.ts';
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
    e.dungeonTheme=theme;e.state='chase';e.bossTurns=1;e.hp=e.maxHp;
    const hits:string[]=[];
    const context={player:sim.player,enemies:sim.enemies,world:{...world,isSanctuary:()=>false},time:0,trial:null,visible:()=>true,move:()=>{},hurt:(_n:number,_a:number,_e:typeof e,element:string)=>hits.push(element),shoot:()=>{},emit:()=>{}};
    updateWarden(e,1/120,context);
    assert.equal(e.bossMove,'fracture');
    assert.equal(e.stateDuration,wardenProfile(theme).warning);
    e.stateTime=e.stateDuration;updateWarden(e,1/120,context);
    for(let i=0;i<110;i++){e.stateTime+=1/120;updateWarden(e,1/120,context);}
    assert.deepEqual(hits,[theme==='rime'?'frost':'arcane']);
    sim.enemies=[];
  }
});
