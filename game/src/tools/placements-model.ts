import { World } from '../world.ts';
import { getZoneAt } from '../zone-progression.ts';
export interface Survey { seed:number; x:number; y:number; size:number; }
export function surveyPlaces(world:World, query:Survey) {
  if(!Number.isInteger(query.seed)||query.seed<0||query.seed>4294967295||![query.x,query.y,query.size].every(Number.isFinite)||Math.abs(query.x)>1000000||Math.abs(query.y)>1000000||query.size<1000||query.size>24000)throw new Error('Survey exceeds the bounded local inspection area.');
  const left=query.x-query.size/2,top=query.y-query.size/2;
  return world.getPOIs(left,top,query.size,query.size)
    .filter(p=>p.x>=left&&p.y>=top&&p.x<=left+query.size&&p.y<=top+query.size)
    .map(p=>({...p,biome:world.sampleBiome(p.x,p.y).name,zone:getZoneAt(p.x,p.y,world.seed)}))
    .sort((a,b)=>Math.hypot(a.x-query.x,a.y-query.y)-Math.hypot(b.x-query.x,b.y-query.y));
}
