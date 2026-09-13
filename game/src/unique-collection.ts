import { UNIQUES, uniqueDefinition } from './unique-content.ts';
import { metric, type ChronicleProgress, type ChronicleSource } from './chronicle.ts';
import type { Item } from './character-types.ts';
/** Called only after a successful pickup. Re-pickups cannot erase or duplicate discovery. */
export function discoverUnique(progress:ChronicleProgress|undefined,item:Item,at:number):void {
  const u=uniqueDefinition(item);if(!progress||!u||item.tier!=='unique')return;
  const source=progress.sources.find(s=>s.id===progress.active);if(!source)return;
  const key=`unique:${u.id}`;
  if(!progress.sources.some(s=>s.unlocked[key]!==undefined))source.unlocked[key]=at;
  metric(progress,`seen:unique:${u.id}`,1);metric(progress,`best:unique:${u.id}`,item.itemLevel);
}
export function uniqueCollection(sources:readonly ChronicleSource[]) {
  return UNIQUES.map(definition=>{
    const key=`unique:${definition.id}`;
    const first=sources.filter(s=>s.unlocked[key]!==undefined).sort((a,b)=>a.unlocked[key]-b.unlocked[key]||a.id.localeCompare(b.id))[0];
    const level=Math.max(0,...sources.map(s=>s.values[`best:unique:${definition.id}`]??0));
    return {definition,found:!!first||level>0,level,firstAt:first?.unlocked[key],finder:first?.name};
  });
}
