import { metric, syncRiftChronicle } from './chronicle.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { hasLineOfSight } from './combat-geometry.ts';
import { dungeonMemberLevel } from './dungeon-state.ts';
import type { CombatEvent } from './model.ts';
import type { Enemy } from './model.ts';
import type { Simulation } from './simulation.ts';
import { currentDungeon } from './dungeon-state.ts';
import { RIFT_RULES, riftPoints, freshRiftLedger } from './rift-content.ts';
export function tickRift(sim:Simulation,dt:number):void {
  const r=currentDungeon(sim.expeditions)?.rift;if(!r||r.phase==='failed'||r.phase==='complete')return;
  r.elapsed=Math.min(RIFT_RULES.duration,r.elapsed+dt);
  if(sim.player.dead||r.elapsed>=RIFT_RULES.duration){
    r.phase='failed';metric(sim.player.chronicle,sim.player.dead?'riftDeaths':'riftTimeouts');
  }
}
/** Called only by the exactly-once death commitment. */
export function riftKill(sim:Simulation,enemy:Enemy):void {
  const run=currentDungeon(sim.expeditions),r=run?.rift;
  if(!run||!r||enemy.campId!==run.entrance.id||r.phase==='failed'||r.phase==='complete'||sim.player.dead)return;
  if(enemy.campMemberId==='warden'){
    if(r.phase!=='boss'||r.elapsed>=RIFT_RULES.duration)return;
    syncRiftChronicle(sim.player.chronicle,sim.expeditions.rifts);
    r.phase='complete';
    const chronicle=sim.player.chronicle;
    metric(chronicle,'riftClears');metric(chronicle,'highestRiftLevel',run.entrance.level);
    metric(chronicle,'bestRiftSeconds',r.elapsed);
    if(run.entrance.rift?.keyTier){metric(chronicle,'riftKeyedClears');metric(chronicle,'highestRiftKeyTier',run.entrance.rift.keyTier);}
    if(r.elapsed<=300)metric(chronicle,'riftFastClears');
    metric(chronicle,'seen:riftBiome:'+run.entrance.biome);

    // Rewards follow the actual kill, including a guardian pursued away from its arrival.
    r.treasure={x:enemy.x,y:enemy.y};
    r.exit={x:enemy.x,y:enemy.y};
    for(let i=0;i<120;i++){const a=i*2.399963,p={x:enemy.x+Math.cos(a)*150,y:enemy.y+Math.sin(a)*150};if(!sim.world.blocked(p.x,p.y,30)&&hasLineOfSight(sim.world,enemy.x,enemy.y,p.x,p.y)){r.exit=p;break;}}
    run.states.warden.x=enemy.x;run.states.warden.y=enemy.y;
    // Expire in place: completion can happen while the projectile array is iterating.
    for(const projectile of sim.projectiles)if(projectile.owner==='enemy')projectile.life=0;
    // Completion dissolves the remaining roster without awarding kills or loot.
    for(const actor of sim.enemies)if(actor.campId===run.entrance.id&&actor!==enemy){actor.hp=0;actor.state='dead';}
    for(const state of Object.values(run.states))state.hp=0;
    const ledger=sim.expeditions.rifts??=freshRiftLedger();ledger.clears++;ledger.highest=Math.max(ledger.highest,run.entrance.level);
    const record={level:run.entrance.level,seconds:r.elapsed,keyTier:run.entrance.rift!.keyTier??0};
    const old=ledger.best.find(b=>b.level===record.level&&b.keyTier===record.keyTier);
    if(old)old.seconds=Math.min(old.seconds,record.seconds);else {ledger.best.push(record);ledger.best.sort((a,b)=>b.level-a.level);ledger.best=ledger.best.slice(0,600);}
  }else if(r.phase==='hunt') {metric(sim.player.chronicle,'riftKills');metric(sim.player.chronicle,'riftRank:'+enemy.rank);r.points=Math.min(RIFT_RULES.progress,r.points+riftPoints(enemy.rank));if(r.points>=RIFT_RULES.progress){r.phase='boss';clearRiftPack(sim);}}
}

/** Deliberate, announced encounter transition; ordinary streaming still stays offscreen. */
function clearRiftPack(sim:Simulation):void {
 const run=currentDungeon(sim.expeditions)!;
 for(const enemy of sim.enemies)if(enemy.campMemberId!=='warden'){enemy.hp=0;enemy.state='dead';}
 for(const [id,state] of Object.entries(run.states))if(id!=='warden')state.hp=0;
 for(const projectile of sim.projectiles)if(projectile.owner==='enemy')projectile.life=0;
}
function clearArrival(sim:Simulation,radius:number){
 const p=sim.player;
 for(let i=0;i<900;i++){
  const angle=p.angle+i*2.3999632297,range=280+Math.sqrt(i)*14;
  const point={x:p.x+Math.cos(angle)*range,y:p.y+Math.sin(angle)*range};
  if(!sim.world.blocked(point.x,point.y,radius+12)&&!sim.world.isSanctuary?.(point.x,point.y)&&hasLineOfSight(sim.world,p.x,p.y,point.x,point.y))return point;
 }
 return null;
}
export function updateRiftGuardian(sim:Simulation,emit:(event:CombatEvent)=>void=()=>{}):void {
 const run=currentDungeon(sim.expeditions),r=run?.rift,floor=sim.dungeonFloor;
 if(!run||!r||!floor||r.phase!=='boss'||sim.player.dead)return;
 const member=floor.members.find(m=>m.id==='warden')!,state=run.states.warden;
 if(!r.guardian){
  clearRiftPack(sim);
  const point=clearArrival(sim,ENEMY_DEFINITIONS[member.kind].radius);if(!point)return;
  r.guardian={...point,at:r.elapsed};state.x=point.x;state.y=point.y;
  emit({type:'notice',...point,message:'The rift guardian is arriving!'});
 }
 if(r.elapsed-r.guardian.at<RIFT_RULES.guardianArrival||state.hp<=0||sim.enemies.some(e=>e.campMemberId==='warden'&&e.campId===run.entrance.id&&e.hp>0))return;
 const enemy=sim.spawnEnemy(member.kind,state.x,state.y,member.rank,{campId:run.entrance.id,memberId:member.id,lootSeed:member.seed,level:dungeonMemberLevel(run.entrance,member)});
 if(!enemy)return;
 enemy.hp=state.hp;enemy.homeX=state.x;enemy.homeY=state.y;enemy.bossPhases=state.bossPhases??0;
 enemy.state='chase';enemy.awareness=1;enemy.lastSeenX=sim.player.x;enemy.lastSeenY=sim.player.y;state.admitted=true;
 emit({type:'blast',x:enemy.x,y:enemy.y,radius:130,style:'arcane',color:'#f47dbb'});
}
