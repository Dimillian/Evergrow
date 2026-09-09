import { generateSettlement, type Settlement } from './settlements.ts';
import { settlementPlace, placeCell } from './world-geography.ts';
import type { CharacterSave } from './character-save.ts';
import type { Item } from './character-types.ts';
import type { LocationContents } from './dungeon-state.ts';
import type { DecodedExploration } from './exploration-save.ts';
import { settlementPOIs } from './settlements.ts';
import { townPortalAnchor } from './travel.ts';
import { PLAYER_DEFAULTS, ENEMY_DEFINITIONS } from './combat-content.ts';

/** This is a single supported geography upgrade, not permission to load arbitrary generations. */
export const canUpgradeWorld = (from:number,to:number):boolean => from===9 && to===10;
export const canLoadWorld = (from:number,to:number):boolean => from===to || canUpgradeWorld(from,to);

export interface UpgradeWorld { blocked(x:number,y:number,radius:number):boolean;getNearestSettlement(x:number,y:number):Settlement;dispose():void; }
export type UpgradeWorldFactory=(seed:number)=>UpgradeWorld;

function clearNearby(world:UpgradeWorld,x:number,y:number,radius:number):{x:number;y:number}{
  if(!world.blocked(x,y,radius))return {x,y};
  for(let ring=16;ring<=512;ring+=16)for(let i=0;i<32;i++){
    const a=i*Math.PI/16,px=x+Math.cos(a)*ring,py=y+Math.sin(a)*ring;
    if(Math.abs(px)<=4e7&&Math.abs(py)<=4e7&&!world.blocked(px,py,radius))return {x:px,y:py};
  }
  throw new Error('Could not find a safe position for the world upgrade. The previous save is untouched.');
}
function safeArrival(world:UpgradeWorld,x:number,y:number):{x:number;y:number}{
  if(!world.blocked(x,y,PLAYER_DEFAULTS.radius))return {x,y};
  const anchor=townPortalAnchor(world.getNearestSettlement(x,y));
  return clearNearby(world,anchor.x,anchor.y,18);
}

/** Prepare a new record without changing its source; the session must durably commit before entry. */
export function upgradeWorldSave(source:CharacterSave,target:number,createWorld:UpgradeWorldFactory):CharacterSave{
  if(!canUpgradeWorld(source.worldVersion,target))throw new Error('Unsupported world upgrade.');
  const record=JSON.parse(JSON.stringify(source)) as CharacterSave,p=record.checkpoint,world=createWorld(record.worldSeed);
  try{
    const allItems:Array<Item|null>= [...p.character.inventory,...Object.values(p.character.equipped),...(p.character.stash??[]),
      ...p.character.commerce.buyback.map(b=>b.item),...p.groundItems.map(g=>g.item),
      ...(p.expeditions?.surface?.groundItems??[]).map(g=>g.item),
      ...(p.expeditions?.runs??[]).flatMap(r=>r.contents.groundItems.map(g=>g.item))];
    // Retained purchases become owned items, independent of the replacement shops' stock masks.
    // This also prevents a refreshed stock slot from colliding with an already-owned item ID.
    const renamed=new Map<string,string>();
    for(const item of allItems)if(item?.id.startsWith('stock:')){const id='owned:'+item.id;renamed.set(item.id,id);item.id=id;}
    if(p.character.inventoryLayout)p.character.inventoryLayout=Object.fromEntries(Object.entries(p.character.inventoryLayout).map(([id,cell])=>[renamed.get(id)??id,cell]));
    if(p.character.recentItems)p.character.recentItems=p.character.recentItems.map(id=>renamed.get(id)??id);
    p.character.commerce.sold={};p.character.commerce.revision++;
    p.brokenContainers=p.brokenContainers?.filter(id=>!id.startsWith('town:'));
    if(!p.expeditions?.location)Object.assign(p,safeArrival(world,p.x,p.y));
    if(p.travel?.returnTo&&!p.travel.returnTo.dungeon)Object.assign(p.travel.returnTo,safeArrival(world,p.travel.returnTo.x,p.travel.returnTo.y));
    if(p.expeditions){const point=safeArrival(world,p.expeditions.surfaceX,p.expeditions.surfaceY);p.expeditions.surfaceX=point.x;p.expeditions.surfaceY=point.y;}
    const surface:Pick<LocationContents,'actors'|'campWounds'|'groundItems'|'groundGold'|'pickups'>|undefined=p.expeditions?.location?p.expeditions.surface??undefined:
      {actors:p.actors??[],campWounds:p.campWounds,groundItems:p.groundItems,groundGold:p.groundGold??[],pickups:p.pickups??[]};
    if(surface){
      for(const drop of [...surface.groundItems,...surface.groundGold,...surface.pickups])Object.assign(drop,clearNearby(world,drop.x,drop.y,5));
      for(const actor of [...surface.actors,...(surface.campWounds??[])]){
        const radius=ENEMY_DEFINITIONS[actor.kind].radius;
        Object.assign(actor,clearNearby(world,actor.x,actor.y,radius));
        const home=clearNearby(world,actor.homeX,actor.homeY,radius);actor.homeX=home.x;actor.homeY=home.y;
      }
    }
    if(p.journeys){
      const j=p.journeys;
      for(const g of [...j.accepted,...j.offers,...j.history,...(j.nearestTown?[j.nearestTown]:[]),...(j.townPin?[j.townPin]:[])]){
        if(g.kind!=='town')continue;
        const town=world.getNearestSettlement(g.x,g.y);g.name=town.name;g.settlementTier=town.kind;g.x=town.x;g.y=town.y;
      }
      j.refreshedAt=-90;
    }
    record.worldVersion=target;record.updatedAt=Math.max(source.updatedAt+1,Date.now());
    return record;
  }finally{world.dispose();}
}

/** Preserve explored terrain and unrelated discoveries; rebuild known town markers from current geometry. */
export function upgradeWorldChart(chart:DecodedExploration,seed:number):DecodedExploration{
  const result:DecodedExploration={chunks:chart.chunks.map(c=>({...c,words:Uint32Array.from(c.words)})),pois:chart.pois.map(p=>({...p}))},seen=new Set<string>();
  const towns=new Map<number,ReturnType<typeof settlementPOIs>>();
  result.pois=result.pois.flatMap(p=>{
      if(!p.id.startsWith('town:'))return [p];
      const match=/^town:[0-9]+:([0-9]+)(?::|$)/.exec(p.id);if(!match)return [];
      const id=Number(match[1]);let pois=towns.get(id);
      if(!pois){pois=settlementPOIs(generateSettlement(seed,settlementPlace(seed,...placeCell(id))));towns.set(id,pois);}
      const replacement=pois.find(q=>q.kind===p.kind);
      if(!replacement||seen.has(replacement.id))return [];
      seen.add(replacement.id);return [{...replacement,...(p.sighted===undefined?{}:{sighted:p.sighted})}];
    });
    return result;
}
