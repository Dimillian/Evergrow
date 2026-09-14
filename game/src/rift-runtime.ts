import type { Enemy } from './model.ts';
import type { Simulation } from './simulation.ts';
import { currentDungeon } from './dungeon-state.ts';
import { RIFT_RULES, riftPoints, freshRiftLedger } from './rift-content.ts';
export function tickRift(sim:Simulation,dt:number):void {
  const r=currentDungeon(sim.expeditions)?.rift;if(!r||r.phase==='failed'||r.phase==='complete')return;
  r.elapsed=Math.min(RIFT_RULES.duration,r.elapsed+dt);
  if(sim.player.dead||r.elapsed>=RIFT_RULES.duration)r.phase='failed';
}
/** Called only by the exactly-once death commitment. */
export function riftKill(sim:Simulation,enemy:Enemy):void {
  const run=currentDungeon(sim.expeditions),r=run?.rift;
  if(!run||!r||enemy.campId!==run.entrance.id||r.phase==='failed'||r.phase==='complete'||sim.player.dead)return;
  if(enemy.campMemberId==='warden'){
    if(r.phase!=='boss'||r.elapsed>=RIFT_RULES.duration)return;
    r.phase='complete';
    // Completion dissolves the remaining roster without awarding kills or loot.
    for(const actor of sim.enemies)if(actor.campId===run.entrance.id&&actor!==enemy){actor.hp=0;actor.state='dead';}
    for(const state of Object.values(run.states))state.hp=0;
    const ledger=sim.expeditions.rifts??=freshRiftLedger();ledger.clears++;ledger.highest=Math.max(ledger.highest,run.entrance.level);
    const record={level:run.entrance.level,seconds:r.elapsed,keyTier:run.entrance.rift!.keyTier??0};
    const old=ledger.best.find(b=>b.level===record.level&&b.keyTier===record.keyTier);
    if(old)old.seconds=Math.min(old.seconds,record.seconds);else {ledger.best.push(record);ledger.best.sort((a,b)=>b.level-a.level);ledger.best=ledger.best.slice(0,600);}
  }else if(r.phase==='hunt') {r.points=Math.min(RIFT_RULES.progress,r.points+riftPoints(enemy.rank));if(r.points>=RIFT_RULES.progress)r.phase='boss';}
}
