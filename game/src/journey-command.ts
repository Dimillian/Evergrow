import { journeyAvailable, type JourneyFacts } from './journey-director.ts';
import { planJourney, type JourneyState, type JourneyCommand } from './journey-state.ts';
import type { CharacterCheckpoint } from './character-save.ts';
interface JourneyOwner { journeys:JourneyState; captureCheckpoint():CharacterCheckpoint }
/** Persist before applying UI choices; no character resource or world reward mutations. */
export async function executeJourneyCommand(owner:JourneyOwner,command:JourneyCommand,persist:(checkpoint:CharacterCheckpoint)=>{ok:boolean;message:string}|Promise<{ok:boolean;message:string}>,facts:JourneyFacts):Promise<{ok:boolean;message:string}>{
  if(command.type==='track'){
    const goal=[...owner.journeys.accepted,...owner.journeys.offers].find(g=>g.id===command.id);
    if(!goal||!journeyAvailable(goal,facts))return {ok:false,message:'This activity is no longer available.'};
  }
  const planned=planJourney(owner.journeys,command);
  if(!planned)return {ok:false,message:'This activity is no longer available, or three activities are already accepted.'};
  const checkpoint=owner.captureCheckpoint();checkpoint.journeys=planned;
  const result=await persist(checkpoint);if(!result.ok)return result;
  owner.journeys=planned;return {ok:true,message:''};
}
