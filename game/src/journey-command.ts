import { journeyComplete, type JourneyFacts } from './journey-director.ts';
import { planJourney, type JourneyState, type JourneyCommand } from './journey-state.ts';
import type { CharacterCheckpoint } from './character-save.ts';
interface JourneyOwner { journeys:JourneyState; captureCheckpoint():CharacterCheckpoint }
/** Persist before applying UI choices; no character resource or world reward mutations. */
export async function executeJourneyCommand(owner:JourneyOwner,command:JourneyCommand,persist:(checkpoint:CharacterCheckpoint)=>{ok:boolean;message:string}|Promise<{ok:boolean;message:string}>,facts:JourneyFacts):Promise<{ok:boolean;message:string}>{
  const ids=command.type==='acceptAll'?command.ids:command.type==='accept'||command.type==='track'?[command.id]:[];
  const goals=new Map([...owner.journeys.accepted,...owner.journeys.offers].map(g=>[g.id,g]));
  for(const id of ids){
    if(command.type==='track'&&(owner.journeys.nearestTown?.id===id||owner.journeys.townPin?.id===id))continue;
    const goal=goals.get(id);
    if(!goal||goal.finishedAt!==undefined||journeyComplete(goal,facts))return {ok:false,message:'This activity has already been completed or is no longer listed.'};
  }
  const planned=planJourney(owner.journeys,command);
  if(!planned)return {ok:false,message:'This activity has changed. Select it again and retry.'};
  const checkpoint=owner.captureCheckpoint();checkpoint.journeys=planned;
  const result=await persist(checkpoint);if(!result.ok)return result;
  owner.journeys=planned;return {ok:true,message:''};
}
