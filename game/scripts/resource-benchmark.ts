import { resolveSkill } from '../src/skill-progression.ts';
import { writeFileSync } from 'node:fs';
import { benchmarkPlayer, resourceBenchmark, BENCHMARK_SKILLS, type BenchmarkStyle, type BenchmarkGear } from '../src/resource-benchmark.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { freshChronicle, chronicleValues } from '../src/chronicle.ts';
import type { Input } from '../src/model.ts';

/** Fixed open-terrain headless encounter. No browser, storage, cloud, or gameplay session. */
export function resourceEncounter(level:number,style:BenchmarkStyle,gear:BenchmarkGear,encounter:'pack'|'elite'|'boss',duration=45) {
  const sim=new Simulation({blocked:()=>false,move:(x,y,dx,dy)=>({x:x+dx,y:y+dy})},{spawn:false,seed:7319});
  sim.setCombatViewport({x:-500,y:-500,width:1000,height:1000});
  Object.assign(sim.player,benchmarkPlayer(level,style,gear));sim.player.chronicle=freshChronicle();
  const count=encounter==='pack'?8:1;
  const actors=Array.from({length:count},(_,i)=>{
    const a=(i-(count-1)/2)*.12,r=style==='melee'?35:110;
    const e=sim.spawnEnemy(encounter==='boss'?'warden':'stalker',Math.cos(a)*r,Math.sin(a)*r,
      encounter==='elite'?'elite':'normal',undefined,{base:level+(encounter==='pack'?0:encounter==='elite'?2:3),min:level,max:level+3,fixed:true})!;
    e.state='chase';e.awareness=1;return e;
  });
  const skillCost=resolveSkill(BENCHMARK_SKILLS[style],sim.player.derived,sim.player.character).mana;
  sim.drainEvents();let attacks=0,firstHit:number|null=null,clearTime:number|null=null,starved=0,damage=0,overkill=0;
  for(let tick=0;tick<duration/FIXED_STEP;tick++) {
    const target=actors.find(e=>e.state!=='dead');if(!target||sim.player.dead)break;
    const before=actors.map(e=>e.state);
    const input:Input={moveX:0,moveY:0,aimX:target.x,aimY:target.y,attack:false,dodge:false,
      heal:sim.player.mana<sim.player.maxMana*.25,skillSlot:0};
    sim.update(FIXED_STEP,input);
    if(sim.player.mana<skillCost)starved+=FIXED_STEP;
    actors.forEach((e,i)=>{if(e.state==='attack'&&before[i]!=='attack')attacks++;});
    for(const event of sim.drainEvents())if(event.type==='hit'){firstHit??=event.value;damage+=event.actualValue??event.value;overkill+=event.value-(event.actualValue??event.value);}
    if(actors.every(e=>e.state==='dead')){clearTime=(tick+1)*FIXED_STEP;break;}
  }
  const values=chronicleValues(sim.player.chronicle!.sources);
  return {level,style,gear,skill:BENCHMARK_SKILLS[style],encounter,clearTime,dead:sim.player.dead,endingLevel:sim.player.level,
    kills:values.kills??0,enemyAttacks:attacks,firstHit,damage,overkill,manaSpent:values.manaSpent??0,manaRestored:values.manaRestored??0,
    manaSources:Object.fromEntries(['passive','kill','vial','potion'].map(k=>[k,values['manaRecovery:'+k]??0])),
    insufficientManaSeconds:starved,endingMana:sim.player.mana};
}
if(process.argv[1]?.endsWith('/resource-benchmark.ts')) {
  const builds=resourceBenchmark();
  const report={version:1,builds,encounters:builds.flatMap(b=>(['pack','elite','boss'] as const).map(e=>resourceEncounter(b.level,b.style,b.gear,e))),
    assumptions:'Synthetic seeded gear. Stationary player repeatedly casts core skill; drinks below 25% mana. No dodge, retreat or deliberate pickup collection. Actual 120 Hz simulation, damage, AI, mana and incidental pickups; 45-second limit. Null clear time means uncleared, not zero. Full-grid recovery fixture is an extreme specialization, not normal gear. No claim about Dimillian. Source recovery is available only from instrumented checkpoints.'};
  const json=JSON.stringify(report,null,2);if(process.argv[2])writeFileSync(process.argv[2],json);else console.log(json);
}
