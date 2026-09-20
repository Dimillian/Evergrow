import type { Simulation } from './simulation.ts';
import type { CharacterCheckpoint } from './character-save.ts';
import type { ActionResult } from './character-types.ts';
import type { LocationContents } from './dungeon-state.ts';
import { lesserDifficulty, validWorldDifficulty, worldDifficulty, type WorldDifficulty } from './world-difficulty.ts';

export function difficultyChangeProblem(sim:Simulation):string|null {
  if(sim.player.dead)return 'Return to town alive to change difficulty.';
  if(sim.expeditions.location || !sim.world.isSanctuary?.(sim.player.x,sim.player.y))return 'Change difficulty while safely in town.';
  return null;
}
/** Live state changes only after persistence. Normal-equivalent saved HP preserves all wounds. */
export async function changeWorldDifficulty(sim:Simulation,id:WorldDifficulty,persist:(checkpoint:CharacterCheckpoint)=>Promise<ActionResult>):Promise<ActionResult> {
  if(!validWorldDifficulty(id))return {ok:false,message:'Choose a valid difficulty.'};
  const problem=difficultyChangeProblem(sim);
  if(problem)return {ok:false,message:problem};
  if(worldDifficulty(sim.player.character.difficulty).id===id)return {ok:true,message:'Difficulty is already selected.'};
  const checkpoint=sim.captureCheckpoint();
  checkpoint.character.difficulty=id;
  const reduceContents=(contents:Pick<LocationContents,'actors'|'campWounds'|'encounterScales'>)=>{
    for(const a of [...contents.actors,...(contents.campWounds??[])])a.rewardDifficulty=lesserDifficulty(a.rewardDifficulty,id);
    for(const scale of Object.values(contents.encounterScales??{}))scale.difficulty=lesserDifficulty(scale.difficulty,id);
  };
  reduceContents({...checkpoint,actors:checkpoint.actors??[]});
  const expeditions=checkpoint.expeditions;
  if(expeditions?.surface)reduceContents(expeditions.surface);
  for(const run of expeditions?.runs??[]){
    reduceContents(run.contents);
    // Each partially delivered chest has its own frozen recipe. Unfinished
    // encounters must still lose bonus rewards when their remaining fights get easier.
    if(Object.values(run.states).some(s=>s.hp>0))run.difficulty=lesserDifficulty(run.difficulty,id);
  }
  for(const site of Object.values(checkpoint.events?.sites??{}))
    if(site.phase==='active'||site.phase==='paused')site.difficulty=lesserDifficulty(site.difficulty,id);
  const result=await persist(checkpoint);
  if(!result.ok)return result;
  sim.restoreCheckpoint(checkpoint);
  return {ok:true,message:`${worldDifficulty(id).name} difficulty selected.`};
}
