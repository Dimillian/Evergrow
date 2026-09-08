import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { generateDungeon } from '../src/dungeon.ts';
import { DungeonWorld } from '../src/dungeon-world.ts';
import { createDungeonRun, emptyContents } from '../src/dungeon-state.ts';
import { startDungeonEvent, advanceDungeonEvents } from '../src/dungeon-events.ts';
import { claimDungeonChest } from '../src/dungeon-command.ts';
import { DUNGEON_EVENTS } from '../src/dungeon-content.ts';
import { validExpeditions } from '../src/dungeon-validation.ts';
import { isSpawnHidden } from '../src/spawn-visibility.ts';

const persist=()=>({ok:true,message:''});
test('dungeon encounters start durably, admit hidden waves, persist and pay once', async()=>{
  const kinds=new Set<string>();
  for(const seed of [7317,7318,7319]) {
    const entrance={id:'dungeon:event-test',name:'Test dungeon',seed,level:8,biome:'deadwood' as const,x:0,y:0};
    const floor=generateDungeon(seed,8);
    for(const event of floor.events!){
      const run=createDungeonRun(entrance),sim=new Simulation(new DungeonWorld(floor,entrance),{spawn:false,startX:event.x,startY:event.y});
      sim.dungeonFloor=floor;sim.expeditions={location:entrance.id,runs:[run],surface:emptyContents(),surfaceX:0,surfaceY:0};
      sim.captureCheckpoint();const before=structuredClone(sim.expeditions);
      assert.equal((await startDungeonEvent(sim,event.id,()=>({ok:false,message:'Disk full'}))).ok,false);assert.deepEqual(sim.expeditions,before);
      assert.ok((await startDungeonEvent(sim,event.id,persist)).ok);
      const current=sim.expeditions.runs[0],state=current.events![event.id],recipe=DUNGEON_EVENTS[event.kind];kinds.add(event.kind);
      const view={x:event.x-350,y:event.y-230,width:700,height:460};
      const witnessed=new Set<number>();
      const input={moveX:0,moveY:0,aimX:event.x,aimY:event.y,attack:false,dodge:false,heal:false,skillSlot:null};
      sim.setSpawnExclusion(view);
      for(let wave=0;wave<recipe.rules.count;wave++){
        // Guards must move through the narrow entrance before later members fit.
        // Observe births at fixed-step boundaries, then exercise real enemy movement.
        for(let i=0;i<1200;i++){
          sim.player.hp=sim.player.maxHp;
          sim.update(FIXED_STEP,input);
          for(const e of sim.enemies)if(!witnessed.has(e.id)){
            assert.ok(isSpawnHidden(e.x,e.y,view,e.radius),'birth is hidden');witnessed.add(e.id);
          }
          if(floor.members.filter(m=>m.event===event.id&&m.eventWave===wave).every(m=>current.states[m.id].admitted))break;
        }
        const roster=floor.members.filter(m=>m.event===event.id&&m.eventWave===wave);
        assert.ok(roster.every(m=>current.states[m.id].admitted),`${event.kind} wave ${wave}: admission`);

        for(const m of roster){current.states[m.id].hp=0;const e=sim.enemies.find(e=>e.campMemberId===m.id);if(e){e.hp=0;e.state='dead';}}
        advanceDungeonEvents(sim,Math.max(FIXED_STEP,recipe.rules.hold),()=>{});
        assert.equal(state.cleared,wave+1);
        assert.ok(validExpeditions(sim.captureCheckpoint().expeditions),`${event.kind}: save validates`);
      }
      assert.equal(state.finished,true);
      // Completion can deliver treasure from the altar without a second interaction.
      sim.player.x=event.x;sim.player.y=event.y;
      assert.equal((await claimDungeonChest(sim,event.chest,()=>({ok:false,message:'Disk full'}))).ok,false);
      assert.equal(sim.groundItems.length,0);
      assert.equal((await claimDungeonChest(sim,event.chest,persist)).ok,true);
      const count=sim.groundItems.length;assert.ok(count>0);
      assert.equal((await claimDungeonChest(sim,event.chest,persist)).ok,false);assert.equal(sim.groundItems.length,count);
    }
  }
  assert.equal(kinds.size,3);
});
