import type { CombatEvent } from './model.ts';
import type { Simulation } from './simulation.ts';
import { currentDungeon } from './dungeon-state.ts';
import { DUNGEON_EVENTS } from './dungeon-content.ts';
import { advanceWaves } from './wave-system.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import type { PersistDungeon } from './dungeon-command.ts';
import { alertEnemy } from './enemy-state.ts';

export async function startDungeonEvent(sim: Simulation, id: number, persist: PersistDungeon) {
    const run=currentDungeon(sim.expeditions),event=sim.dungeonFloor?.events?.find(e=>e.id===id),p=sim.player;
    if(!run||!event||p.dead||Math.hypot(p.x-event.x,p.y-event.y)>75||!hasLineOfSight(sim.world,p.x,p.y,event.x,event.y))return {ok:false,message:'Move closer to the altar.'};
    const state=run.events?.[id];
    if(!state||state.started||state.finished)return {ok:false,message:state?.finished?'Completed.':'Already active.'};
    if(Object.values(run.events??{}).some(e=>e.started&&!e.finished))return {ok:false,message:'Finish the active chamber first.'};
    const checkpoint=sim.captureCheckpoint();currentDungeon(checkpoint.expeditions!)!.events![id].started=true;
    const result=await persist(checkpoint);
    if(!result.ok)return result;
    sim.expeditions=checkpoint.expeditions!;
    return {ok:true,message:DUNGEON_EVENTS[event.kind].objective};
}

/** Dungeon events retain the shared wave clock, stored roster and normal kill rewards. */
export function advanceDungeonEvents(sim: Simulation, dt: number, emit: (event:CombatEvent)=>void): void {
    const run=currentDungeon(sim.expeditions),floor=sim.dungeonFloor;
    if(!run||!floor||sim.player.dead)return;
    for(const event of floor.events??[]) {
        const state=run.events?.[event.id];if(!state?.started||state.finished)continue;
        const nearby=Math.hypot(sim.player.x-event.x,sim.player.y-event.y)<650;
        if(!nearby)continue;
        const members=floor.members.filter(m=>m.event===event.id&&m.eventWave===state.wave);
        for(const enemy of sim.enemies)if(members.some(m=>m.id===enemy.campMemberId))alertEnemy(enemy,sim.player);
        // Admission waits for a safe hidden route; it does not consume hold time.
        const admitted=members.some(m=>run.states[m.id].admitted);
        if(!admitted&&state.rest<=0)continue;
        advanceWaves(state,DUNGEON_EVENTS[event.kind].rules,dt,{admitted,defeated:members.length>0&&members.every(m=>run.states[m.id].hp<=0),inObjective:Math.hypot(sim.player.x-event.x,sim.player.y-event.y)<155});
        if(state.finished)emit({type:'blast',x:event.x,y:event.y,radius:130,duration:.7,color:'#d9c487'});
    }
}
