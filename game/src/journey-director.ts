import { journeyWasCompleted } from './journey-rewards.ts';
import { JOURNEY_KINDS, recommendedJourney, journeyLevelFit, type JourneyGoal, type JourneyKind, type JourneyState } from './journey-state.ts';
import { eventClaimed, type EventState } from './poi-content.ts';
import type { Expeditions } from './dungeon-state.ts';
import type { WorldPOI } from './world-pois.ts';
import { getZoneAt } from './zone-progression.ts';
import { roadPaths, pathDistance } from './road-shape.ts';
export interface JourneyFacts {
  areaId?:string; areaLevel?:number;
  events:EventState; expeditions:Expeditions; x:number;y:number;level:number;time:number;
  discovered(id:string):boolean; campCleared(id:string):boolean;
}
export function journeyObjective(goal:JourneyGoal,facts:JourneyFacts):string {
  if(goal.finishedAt!==undefined)return 'Completed';
  if(goal.kind==='dungeon'){
    const run=facts.expeditions.runs.find(r=>r.entrance.id===goal.id);
    return !run?'Enter the crypt':run.states.warden?.hp>0?'Defeat the Hollow Warden':'Claim the Warden’s chest';
  }
  if(goal.kind==='camp')return facts.campCleared(goal.id)?'Open the strongbox':'Clear the garrison';
  if(goal.kind==='caravan')return 'Choose goods or coin';
  if(goal.kind==='watchtower')return 'Light the beacon';
  if(goal.kind==='town')return 'Reach the settlement';
  if(goal.kind==='frontier')return 'Follow the road into new territory';
  const record=facts.events.sites[goal.id];
  if(record?.phase==='completed')return 'Claim the reward';
  if(record?.phase==='active'){
    const trial=facts.events.trial;
    return trial?.siteId===goal.id?`Guardians ${trial.guardians.filter(g=>g.dead).length} / ${trial.guardians.length}`:'Complete the trial';
  }
  return goal.kind==='reliquary'?'Open the reliquary':'Begin the trial';
}
export function journeyComplete(goal:JourneyGoal,facts:JourneyFacts):boolean {
  if(goal.kind==='dungeon')return !!facts.expeditions.cleared?.includes(goal.id)||!!facts.expeditions.runs.find(r=>r.entrance.id===goal.id&&(r.chestMasks[2]&15)===15);
  if(goal.kind==='town'||goal.kind==='frontier')return !facts.expeditions.location&&Math.hypot(goal.x-facts.x,goal.y-facts.y)<(goal.kind==='town'?260:180);
  return eventClaimed(facts.events,goal.id);
}
/** Derive completion from durable source records; never grant a second reward. */
export function reconcileJourneys(state:JourneyState,facts:JourneyFacts,safe:boolean):JourneyState {
  const next:JourneyState={...state,accepted:[],offers:[],history:[...state.history]};
  for(const collection of ['accepted','offers'] as const)for(const original of state[collection]){
    const goal=original.finishedAt===undefined&&!['town','frontier'].includes(original.kind)&&journeyComplete(original,facts)?{...original,finishedAt:facts.time}:original;
    if(goal.finishedAt!==undefined&&next.tracked===goal.id)next.tracked=null;
    if(safe&&goal.finishedAt!==undefined&&facts.time-goal.finishedAt>=2)next.history.push(goal);
    else next[collection].push(goal);
  }
  next.history=next.history.slice(-64);if(next.recommended&&!next.offers.some(g=>g.id===next.recommended&&g.finishedAt===undefined))next.recommended=null;return next;
}
export interface JourneyWorld {
  seed:number; getPOIs(x:number,y:number,width:number,height:number):WorldPOI[];
  blocked(x:number,y:number,radius:number):boolean;
  getDungeonEntrances(x:number,y:number,width:number,height:number):Array<{id:string;level:number}>;
}
export function journeyAvailable(goal:JourneyGoal,facts:JourneyFacts):boolean {
  if(journeyComplete(goal,facts))return false;
  if(goal.kind==='dungeon'){
    const run=facts.expeditions.runs.find(r=>r.entrance.id===goal.id);
    if(!run&&facts.expeditions.runs.some(r=>r.states.warden?.hp>0))return false;
  }
  if(['graveyard','standingStones'].includes(goal.kind)&&facts.events.trial&&facts.events.trial.siteId!==goal.id)return false;
  return true;
}
export function eligibleJourney(goal:JourneyGoal,state:JourneyState,facts:JourneyFacts):boolean {
  return !journeyWasCompleted(state,goal.id)&&!state.dismissed.includes(goal.id)&&![...state.accepted,...state.history].some(g=>g.id===goal.id)
    &&!(goal.kind==='town'&&facts.discovered(goal.id))&&journeyAvailable(goal,facts);
}
/** Only meaningful travel, an outgrown lead or lost availability can replace an offer. */
export function journeyNeedsRefresh(state:JourneyState,facts:JourneyFacts):boolean {
  const elapsed=facts.time-state.refreshedAt;
  if(elapsed<8)return false;
  const lead=recommendedJourney(state);
  return (facts.areaId!==undefined&&facts.areaId!==state.areaId)||state.level!==facts.level
    ||(!lead||!journeyAvailable(lead,facts))&&elapsed>=15
    ||Math.hypot(facts.x-state.x,facts.y-state.y)>700&&elapsed>=15;

}
/** Stable scoring: level match, proximity, route access and activity variety. No combat RNG. */
export function rankJourneyCandidates(candidates:JourneyGoal[],state:JourneyState,facts:JourneyFacts,seed:number):JourneyGoal[]{
  const last=state.history.at(-1)?.kind;
  return candidates.filter(g=>eligibleJourney(g,state,facts)&&g.level<=facts.level+2).map(g=>{
    const currentLevel=facts.areaLevel??getZoneAt(facts.x,facts.y,seed).level;
    const gap=g.level-facts.level, distance=Math.hypot(g.x-facts.x,g.y-facts.y);
    const danger=gap>1?(gap-1)*1200:gap< -1?(-gap-1)*1700:Math.abs(gap)*80;
    const challenge=['dungeon','graveyard','standingStones'].includes(g.kind)?550:0;
    // Reject obvious hazardous direct approaches; a coarse hint is never advertised as pathfinding.
    let unsafe=false;
    for(let i=1;i<=4;i++){const t=i/5;if(getZoneAt(facts.x+(g.x-facts.x)*t,facts.y+(g.y-facts.y)*t,seed).level>Math.max(facts.level+3,g.level+1,currentLevel))unsafe=true;}
    return {g,score:distance+danger+challenge-(journeyLevelFit(currentLevel,facts.level)==='Good level'&&journeyLevelFit(g.level,facts.level)==='Good level'&&distance<=2400?4000:0)+(last===g.kind?400:0)+Math.min(600,pathDistance(g.x,g.y,seed))*.3-(facts.discovered(g.id)?220:0),unsafe};
  }).filter(v=>!v.unsafe).sort((a,b)=>a.score-b.score||a.g.id.localeCompare(b.g.id)).slice(0,12).map(v=>v.g);
}
/** One incremental cell per step. Hard caps bound world generation and candidate scoring. */
export class JourneySearch {
  private cell=0; private candidates=new Map<string,JourneyGoal>();
  readonly origin:{x:number;y:number};
  constructor(privateWorld:JourneyWorld,facts:JourneyFacts,known:WorldPOI[]){
    this.world=privateWorld;this.origin={x:facts.x,y:facts.y};
    for(const poi of known.sort((a,b)=>Math.hypot(a.x-facts.x,a.y-facts.y)-Math.hypot(b.x-facts.x,b.y-facts.y)).slice(0,32))this.add(poi);
  }
  private world:JourneyWorld;
  private add(poi:WorldPOI){
    if(this.candidates.size>=64||!JOURNEY_KINDS.includes(poi.kind as JourneyKind))return;
    const zone=getZoneAt(poi.x,poi.y,this.world.seed);
    const level=poi.kind==='dungeon'?this.world.getDungeonEntrances(poi.x-1,poi.y-1,2,2).find(e=>e.id===poi.id)?.level:zone.level;
    if(level===undefined)return;
    this.candidates.set(poi.id,{id:poi.id,kind:poi.kind as JourneyKind,name:poi.name,x:poi.x,y:poi.y,level,region:zone.name});
  }
  step():boolean {
    const cells=[[0,0],[0,-1],[1,0],[0,1],[-1,0],[1,-1],[-1,-1],[1,1],[-1,1]];
    if(this.cell>=cells.length||this.candidates.size>=64)return true;
    const [dx,dy]=cells[this.cell++],span=2400;
    for(const p of this.world.getPOIs(this.origin.x+dx*span-span/2,this.origin.y+dy*span-span/2,span,span))this.add(p);
    return this.cell>=cells.length||this.candidates.size>=64;
  }
  result(state:JourneyState,facts:JourneyFacts):{offers:JourneyGoal[];recommended:string|null}{
    const candidates=[...this.candidates.values()];
    const ranked=rankJourneyCandidates(candidates,state,facts,this.world.seed);
    let recommended=ranked.find(g=>journeyLevelFit(g.level,facts.level)==='Good level');
    if(!recommended){
      const currentLevel=facts.areaLevel??getZoneAt(facts.x,facts.y,this.world.seed).level;
      const tooHard=currentLevel>facts.level+2;
      const routes=roadPaths(facts.x-3600,facts.y-3600,7200,7200,this.world.seed);
      const points=routes.flatMap(r=>r.points).filter(([x,y])=>{
        const distance=Math.hypot(x-facts.x,y-facts.y),outward=Math.hypot(x,y)-Math.hypot(facts.x,facts.y);
        return distance>1100&&distance<5200&&(tooHard?outward< -400:outward>800)&&!this.world.blocked(x,y,22);
      });
      const frontier=points.slice(0,64).map(([x,y])=>{const zone=getZoneAt(x,y,this.world.seed);return {id:`frontier:${Math.round(x)}:${Math.round(y)}`,kind:'frontier' as const,name:tooHard?'Back to safer ground':'The road ahead',x,y,level:zone.level,region:zone.name};});
      recommended=rankJourneyCandidates(frontier,state,facts,this.world.seed)[0]??ranked[0];
    }
    // Nearby is geography, not an endorsement: retain higher/lower-level local activities.
    const nearby=candidates.filter(g=>eligibleJourney(g,state,facts)&&Math.hypot(g.x-facts.x,g.y-facts.y)<=2400)
      .sort((a,b)=>Math.hypot(a.x-facts.x,a.y-facts.y)-Math.hypot(b.x-facts.x,b.y-facts.y));
    const offers=[...(recommended?[recommended]:[]),...nearby.filter(g=>g.id!==recommended?.id)].slice(0,12);
    return {offers,recommended:recommended?.id??null};
  }
}
