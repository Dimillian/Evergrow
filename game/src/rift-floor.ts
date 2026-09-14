import type { DungeonFloor, DungeonMember, Room } from './dungeon.ts';
import type { BiomeId } from './biomes.ts';
import { bossForBiome } from './wilderness-boss-content.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { riftBonus, riftRandom, type RiftTag } from './rift-content.ts';
import { WorldLandscape } from './world-landscape.ts';

export const RIFT_FIELD = Object.freeze({ sectors:13, sectorSize:640, packs:28, minPack:64, maxPack:96, radius:380, admissionRange:1500, retirementRange:2200, admissionInterval:.25 });
const half = RIFT_FIELD.sectors * RIFT_FIELD.sectorSize / 2;
const landscapes = new WeakMap<DungeonFloor, WorldLandscape>();
const floors = new Map<string, DungeonFloor>();
/** Shared real-world collision; no room walls or artificial arena boundary. */
export function riftLandscape(floor:DungeonFloor):WorldLandscape {
  let world=landscapes.get(floor);
  if(!world){world=new WorldLandscape(floor.seed,true);landscapes.set(floor,world);}
  return world;
}
function sectorAt(x:number,y:number):number {
  const cell=(v:number)=>Math.max(0,Math.min(RIFT_FIELD.sectors-1,Math.floor((v+half)/RIFT_FIELD.sectorSize)));
  return cellAt(cell(x),cell(y));
}
const cellAt=(x:number,y:number)=>y*RIFT_FIELD.sectors+x;

/** Unmodified overworld landscape, populated with irregular, tightly gathered warbands.
 * Rooms are invisible discovery/streaming sectors only. They never carve terrain. */
export function buildRiftFloor(seed:number,biome:BiomeId,rift:RiftTag):DungeonFloor {
  const key=`${seed}:${biome}:${rift.attempt}:${rift.keySeed}:${rift.keyTier}`,cached=floors.get(key);
  if(cached)return cached;
  const random=riftRandom(seed),world=new WorldLandscape(seed,true),members:DungeonMember[]=[],rooms:Room[]=[];
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
  const centers:{x:number;y:number}[]=[];
  const roster:DungeonMember['kind'][]=['stalker','archer','brute','hound','caster','thornReaver','mireSpitter'];
  for(let tries=0;centers.length<RIFT_FIELD.packs&&tries<8000;tries++){
    const angle=random()*Math.PI*2,range=900+Math.sqrt(random())*2400;
    const center={x:Math.cos(angle)*range,y:Math.sin(angle)*range};
    if(!dry(center.x,center.y,40)||centers.some(p=>Math.hypot(p.x-center.x,p.y-center.y)<780))continue;
    const pack=centers.length,placed:{x:number;y:number;radius:number}[]=[],count=RIFT_FIELD.minPack+Math.floor(random()*(RIFT_FIELD.maxPack-RIFT_FIELD.minPack+1));
    // Keep composition coherent within a pack, with a few supporting archetypes.
    const main=roster[Math.floor(random()*roster.length)],support=roster[Math.floor(random()*roster.length)];
    for(let attempt=0;placed.length<count&&attempt<count*100;attempt++){
      const a=random()*Math.PI*2,r=Math.sqrt(random())*RIFT_FIELD.radius;
      const x=center.x+Math.cos(a)*r,y=center.y+Math.sin(a)*r;
      const kind=random()<.72?main:support,radius=ENEMY_DEFINITIONS[kind].radius*1.28;
      if(Math.hypot(x,y)<600||!dry(x,y,radius+4)||placed.some(p=>Math.hypot(p.x-x,p.y-y)<p.radius+radius+8))continue;
      const roll=random(),rank=roll<.10+riftBonus(rift,'court')/100?'elite':roll<.31?'veteran':'normal';
      members.push({id:`rift:${pack}:${placed.length}`,kind,rank,room:sectorAt(x,y),x,y,seed:Math.floor(random()*4294967296)});
      placed.push({x,y,radius});
    }
    centers.push(center);
  }
  if(centers.length!==RIFT_FIELD.packs)throw new Error('Rift landscape has insufficient pack sites');
  members.push({id:'warden',kind:bossForBiome(biome),rank:'elite',room:sectorAt(boss.x,boss.y),...boss,seed:(seed^731)>>>0});
  const floor:DungeonFloor={rift,seed,rooms,edges:[],corridors:[],members,entry,exit,
    chests:[{...entry,room:sectorAt(0,0)},{...entry,room:sectorAt(0,0)},{...chest,room:sectorAt(chest.x,chest.y)}],events:[],props:[]};
  for(const list of [rooms,floor.edges,floor.corridors,members,floor.chests]){list.forEach(Object.freeze);Object.freeze(list);}
  Object.freeze(entry);Object.freeze(exit);Object.freeze(floor);landscapes.set(floor,world);
  if(floors.size>=8)floors.delete(floors.keys().next().value!);floors.set(key,floor);
  return floor;
}
