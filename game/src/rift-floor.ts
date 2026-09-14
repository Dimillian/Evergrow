import type { DungeonFloor, DungeonMember, Room } from './dungeon.ts';
import type { BiomeId } from './biomes.ts';
import { bossForBiome } from './wilderness-boss-content.ts';
import { riftBonus, riftRandom, type RiftTag } from './rift-content.ts';
/** Broad branching clearings, with extra loops. No event or reward-bearing world content. */
export function buildRiftFloor(seed:number,biome:BiomeId,rift:RiftTag):DungeonFloor {
  const random=riftRandom(seed), rooms:Room[]=[], edges:[number,number][]=[], corridors:Room[]=[], members:DungeonMember[]=[];
  const center=(r:Room)=>({x:r.x+r.width/2,y:r.y+r.height/2});
  for(let i=0;i<16;i++){
    const width=850+Math.floor(random()*180),height=850+Math.floor(random()*180);
    rooms.push({id:i,x:(i%4)*1200-width/2,y:Math.floor(i/4)*1200-height/2,width,height,kind:i===0?'entry':i===15?'boss':'combat',shape:'octagon'});
    if(i){const parent=i%4===0?i-4:i<4?i-1:random()<.5?i-1:i-4;edges.push([parent,i]);}
  }
  for(let i=0;i<16;i++)for(const next of [i%4<3?i+1:-1,i<12?i+4:-1])if(next>=0&&random()<.6&&!edges.some(([a,b])=>a===i&&b===next))edges.push([i,next]);
  for(const [a,b]of edges){const p=center(rooms[a]),q=center(rooms[b]);corridors.push({id:100+corridors.length,connection:corridors.length,x:Math.min(p.x,q.x)-190,y:Math.min(p.y,q.y)-190,width:Math.abs(p.x-q.x)+380,height:Math.abs(p.y-q.y)+380,kind:'combat',shape:'hall'});}
  const roster:DungeonMember['kind'][]=['stalker','archer','brute','hound','caster','thornReaver','mireSpitter'];
  for(const room of rooms){if(!room.id)continue;const c=center(room);
    for(let i=0;i<36;i++){const roll=random(), rank=roll<.10+riftBonus(rift,'court')/100?'elite':roll<.31?'veteran':'normal';members.push({id:`rift:${room.id}:${i}`,kind:roster[Math.floor(random()*roster.length)],rank,room:room.id,x:c.x+(i%6-2.5)*110+(random()-.5)*30,y:c.y+(Math.floor(i/6)-2.5)*110+(random()-.5)*30,seed:Math.floor(random()*4294967296)});}
  }
  const boss=center(rooms[15]);members.push({id:'warden',kind:bossForBiome(biome),rank:'elite',room:15,...boss,seed:(seed^731)>>>0});
  const floor:DungeonFloor={rift,seed,rooms,edges,corridors,members,entry:center(rooms[0]),exit:{x:boss.x+180,y:boss.y+160},chests:[0,0,15].map(id=>({...center(rooms[id]),y:center(rooms[id]).y+160,room:id})),events:[],props:[]};
  for(const list of [rooms,edges,corridors,members,floor.chests]){list.forEach(Object.freeze);Object.freeze(list);}return Object.freeze(floor);
}
