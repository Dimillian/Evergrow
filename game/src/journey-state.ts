/** Per-character guidance, source identities and bounded completion receipts. */
export const JOURNEY_KINDS = ['camp','caravan','watchtower','graveyard','standingStones','reliquary','dungeon','town','frontier'] as const;
export type JourneyKind = typeof JOURNEY_KINDS[number];
export interface JourneyGoal { id:string; kind:JourneyKind; name:string; x:number; y:number; level:number; region:string; finishedAt?:number; rewardXP?:number }
export interface JourneyState {
  completed?:string[]; recommended?:string|null; areaId?:string;
  accepted:JourneyGoal[]; offers:JourneyGoal[]; history:JourneyGoal[]; dismissed:string[];
  tracked:string|null; collapsed:boolean; suggestions:boolean; refreshedAt:number; level:number; x:number; y:number;
}
export const freshJourneys=():JourneyState=>({completed:[],recommended:null,accepted:[],offers:[],history:[],dismissed:[],tracked:null,collapsed:false,suggestions:true,refreshedAt:-90,level:1,x:0,y:0});
export const JOURNEY_CONTENT:Readonly<Record<JourneyKind,{reward:string;category:string}>>=Object.freeze({
  camp:{reward:'Equipment, gold',category:'Garrison'},
  caravan:{reward:'Equipment or gold',category:'Discovery'},
  watchtower:{reward:'Map reveal',category:'Exploration'},
  graveyard:{reward:'Equipment, guardian XP',category:'Guardian trial'},
  standingStones:{reward:'Blessing, guardian XP',category:'Guardian trial'},
  reliquary:{reward:'Gold, possible equipment',category:'Discovery'},
  dungeon:{reward:'Boss loot, chest',category:'Boss expedition'},
  town:{reward:'Town services',category:'Settlement'},
  frontier:{reward:'New activities',category:'Exploration'},
});
export type JourneyCommand={type:'track'|'untrack'|'dismiss';id:string}|{type:'collapse'|'suggestions';value:boolean};
/** Pure plan; the caller persists the proposed checkpoint before applying it. */
export function planJourney(state:JourneyState,command:JourneyCommand):JourneyState|null {
  const next:JourneyState=JSON.parse(JSON.stringify(state));
  if(command.type==='collapse'){next.collapsed=command.value;return next;}
  if(command.type==='suggestions'){next.suggestions=command.value;return next;}
  if(command.type==='untrack'){if(next.tracked!==command.id)return null;next.tracked=null;return next;}
  if(!('id' in command))return null;
  const goal=[...next.accepted,...next.offers].find(g=>g.id===command.id);
  if(!goal||goal.finishedAt!==undefined)return null;
  if(command.type==='track'){
    if(!next.accepted.some(g=>g.id===goal.id)){
      if(next.accepted.length>=3)return null;
      next.accepted.push(goal);next.offers=next.offers.filter(g=>g.id!==goal.id);
    }
    next.tracked=goal.id;
    if(next.recommended===goal.id)next.recommended=null;
  }else{
    if(next.offers.some(g=>g.id===goal.id))next.suggestions=false;
    next.accepted=next.accepted.filter(g=>g.id!==goal.id);next.offers=next.offers.filter(g=>g.id!==goal.id);
    if(next.tracked===goal.id)next.tracked=null;
    if(next.recommended===goal.id)next.recommended=null;
    next.dismissed=[...next.dismissed.filter(id=>id!==goal.id),goal.id].slice(-128);
  }
  return next;
}
export function journeyLevelFit(level:number, playerLevel:number): 'Easier'|'Good level'|'Harder' {
  return level<playerLevel-2?'Easier':level>playerLevel+2?'Harder':'Good level';
}
export function recommendedJourney(state:JourneyState):JourneyGoal|undefined {
  return state.offers.find(g=>g.id===(state.recommended===undefined?state.offers[0]?.id:state.recommended)&&g.finishedAt===undefined);
}
export function nearbyJourneys(state:JourneyState,position:{x:number;y:number}=state):JourneyGoal[] {
  return state.offers.filter(g=>g.finishedAt===undefined&&g.kind!=='frontier'&&Math.hypot(g.x-position.x,g.y-position.y)<=2400)
    .sort((a,b)=>Math.hypot(a.x-position.x,a.y-position.y)-Math.hypot(b.x-position.x,b.y-position.y));
}
export function miniJourneys(state:JourneyState,position:{x:number;y:number}=state):JourneyGoal[]{
  const tracked=state.accepted.find(g=>g.id===state.tracked&&g.finishedAt===undefined);
  const recommended=state.suggestions?recommendedJourney(state):undefined;
  const nearby=state.suggestions?nearbyJourneys(state,position).filter(g=>g.id!==recommended?.id):[];
  return [...(tracked?[tracked]:[]),...(recommended?[recommended]:[]),...nearby].slice(0,3);
}
export function validJourneys(value:unknown):value is JourneyState {
  if(!value||typeof value!=='object')return false;
  const v=value as JourneyState;
  const str=(s:unknown,max:number)=>typeof s==='string'&&s.length>0&&s.length<=max;
  const coord=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=4e7;
  const goal=(g:JourneyGoal)=>g&&typeof g==='object'&&str(g.id,180)&&str(g.name,120)&&str(g.region,120)
    &&(g.rewardXP===undefined||Number.isSafeInteger(g.rewardXP)&&g.rewardXP>=0)
    &&JOURNEY_KINDS.includes(g.kind)&&coord(g.x)&&coord(g.y)&&Number.isInteger(g.level)&&g.level>=1&&g.level<=1e6
    &&(g.finishedAt===undefined||typeof g.finishedAt==='number'&&Number.isFinite(g.finishedAt)&&g.finishedAt>=0);
  if(v.completed!==undefined&&(!Array.isArray(v.completed)||!v.completed.every(id=>str(id,180))||new Set(v.completed).size!==v.completed.length))return false;
  if(!Array.isArray(v.accepted)||v.accepted.length>3||!v.accepted.every(goal)||!Array.isArray(v.offers)||v.offers.length>12||!v.offers.every(goal)
    ||!Array.isArray(v.history)||v.history.length>64||!v.history.every(g=>goal(g)&&g.finishedAt!==undefined)
    ||!Array.isArray(v.dismissed)||v.dismissed.length>128||!v.dismissed.every(id=>str(id,180))||new Set(v.dismissed).size!==v.dismissed.length
    ||typeof v.collapsed!=='boolean'||typeof v.suggestions!=='boolean'||!coord(v.x)||!coord(v.y)
    ||!Number.isInteger(v.level)||v.level<1||v.level>1e6||typeof v.refreshedAt!=='number'||!Number.isFinite(v.refreshedAt)||v.refreshedAt< -90)return false;
  if(v.areaId!==undefined&&!str(v.areaId,180))return false;
  if(v.recommended!==undefined&&v.recommended!==null&&!v.offers.some(g=>g.id===v.recommended))return false;
  const ids=[...v.accepted,...v.offers,...v.history].map(g=>g.id);
  return new Set(ids).size===ids.length&&(v.tracked===null||v.accepted.some(g=>g.id===v.tracked&&g.finishedAt===undefined));
}
