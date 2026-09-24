import { RIFT_ENCOUNTERS, RIFT_ENCOUNTER_ORDER, riftFormation } from './rift-encounters.ts';
import type { DungeonFloor, DungeonMember, Room } from './dungeon.ts';
import type { BiomeId } from './biomes.ts';
import { bossForBiome } from './wilderness-boss-content.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { riftBonus, riftRandom, type RiftTag } from './rift-content.ts';
import { WorldLandscape } from './world-landscape.ts';

import { RIFT_FIELD, riftPackCount } from './rift-field.ts';
const half=RIFT_FIELD.sectors*RIFT_FIELD.sectorSize/2;
const floors=new Map<string,DungeonFloor>();
function sectorAt(x:number,y:number):number {
  const cell=(v:number)=>Math.max(0,Math.min(RIFT_FIELD.sectors-1,Math.floor((v+half)/RIFT_FIELD.sectorSize)));
  return cellAt(cell(x),cell(y));
}
const cellAt=(x:number,y:number)=>y*RIFT_FIELD.sectors+x;

/** Shared biome landscape shaped into reconnecting combat clearings and encounter formations.
 * Rooms are invisible discovery/streaming sectors only. They never carve terrain. */
export function buildClearingRiftFloor(seed:number,biome:BiomeId,rift:RiftTag):DungeonFloor {
  const key=`${seed}:${biome}:${rift.attempt}:${rift.keySeed}:${rift.keyTier}`,cached=floors.get(key);
  if(cached)return cached;
  const random=riftRandom(seed),world=new WorldLandscape(seed,true,true),members:DungeonMember[]=[],rooms:Room[]=[];
  const dry=(x:number,y:number,radius:number)=>world.sampleWater(x,y).coverage<.12&&!world.blocked(x,y,radius);
  const clearNear=(x:number,y:number,radius:number)=>{
    for(let i=0;i<2000;i++){
      const angle=i*2.399963229728653,range=Math.sqrt(i)*16;
      const p={x:x+Math.cos(angle)*range,y:y+Math.sin(angle)*range};
      if(dry(p.x,p.y,radius))return p;
    }
    throw new Error('Rift landscape has no clear landing');
  };
  const entry={x:0,y:0},boss=clearNear(0,850,110),chest=clearNear(boss.x+125,boss.y+120,65),exit=clearNear(boss.x-140,boss.y+120,65);
  for(let y=0;y<RIFT_FIELD.sectors;y++)for(let x=0;x<RIFT_FIELD.sectors;x++){
    const id=cellAt(x,y);
    rooms.push({id,x:x*RIFT_FIELD.sectorSize-half,y:y*RIFT_FIELD.sectorSize-half,width:RIFT_FIELD.sectorSize,height:RIFT_FIELD.sectorSize,
      kind:id===sectorAt(boss.x,boss.y)?'boss':id===sectorAt(0,0)?'entry':'combat'});
  }
  const sites=world.riftShape!.clearings.slice(1),packCount=riftPackCount(rift);
  const placedAll:{x:number;y:number;radius:number}[]=[];
  for(let pack=0;pack<packCount;pack++){
    const site=sites[pack%sites.length],kind=RIFT_ENCOUNTER_ORDER[(pack+seed%4)%4],recipe=RIFT_ENCOUNTERS[kind];
    // Density keys add smaller reinforcement groups to clearings, not closed passages.
    const count=pack<sites.length?recipe.min+Math.floor(random()*(recipe.max-recipe.min+1)):24;
    const facing=Math.atan2(-site.y,-site.x),cos=Math.cos(facing),sin=Math.sin(facing);
    const neighbors=placedAll.filter(p=>Math.hypot(p.x-site.x,p.y-site.y)<1100);
    let placed=0;
    for(let attempt=0;placed<count&&attempt<count*500;attempt++){
      const angle=random()*Math.PI*2,range=Math.sqrt(random())*recipe.radius;
      const leader=placed===0&&pack<sites.length;
      const local=leader?{kind:kind==='ritual'?'caster' as const:'brute' as const,x:kind==='ritual'?-120:0,y:0}:riftFormation(kind,placed/count,angle,range);
      // A rejected leader position searches a small patch rather than retrying the same point.
      if(leader&&attempt){local.x+=Math.cos(angle)*Math.min(160,attempt*8);local.y+=Math.sin(angle)*Math.min(160,attempt*8);}
      const x=site.x+local.x*cos-local.y*sin,y=site.y+local.x*sin+local.y*cos;
      const radius=ENEMY_DEFINITIONS[local.kind].radius*1.28;
      if(!dry(x,y,radius+4)||world.riftShape!.distance(x,y)>-radius-20||neighbors.some(p=>Math.hypot(p.x-x,p.y-y)<p.radius+radius+8))continue;
      const roll=random(),rank=leader?'elite':roll<.04+riftBonus(rift,'court')/100?'elite':roll<.20?'veteran':'normal';
      members.push({id:`rift:${pack}:${placed}${leader?':'+recipe.mechanic:''}`,kind:local.kind,rank,room:sectorAt(x,y),x,y,seed:Math.floor(random()*4294967296)});
      const body={x,y,radius};neighbors.push(body);placedAll.push(body);placed++;
    }
    if(placed<count)throw new Error(`Rift clearing ${pack} has insufficient formation space (${placed}/${count})`);
  }
  members.push({id:'warden',kind:bossForBiome(biome),rank:'elite',room:sectorAt(boss.x,boss.y),...boss,seed:(seed^731)>>>0});
  const floor:DungeonFloor={rift,seed,rooms,edges:[],corridors:[],members,entry,exit,
    chests:[{...entry,room:sectorAt(0,0)},{...entry,room:sectorAt(0,0)},{...chest,room:sectorAt(chest.x,chest.y)}],events:[],props:[]};
  for(const list of [rooms,floor.edges,floor.corridors,members,floor.chests]){list.forEach(Object.freeze);Object.freeze(list);}
  Object.freeze(entry);Object.freeze(exit);Object.freeze(floor);world.dispose();
  if(floors.size>=8)floors.delete(floors.keys().next().value!);floors.set(key,floor);
  return floor;
}
