import type { DungeonFloor } from './dungeon.ts';
import { riftLandscape } from './rift-floor.ts';
const SIZE=512, SAMPLE=32;
const maps=new WeakMap<DungeonFloor,Map<string,HTMLCanvasElement>>();
/** Cached terrain from the real landscape, shared by atlas, minimap and static review. */
export function drawRiftMapTerrain(c:CanvasRenderingContext2D,floor:DungeonFloor,seen:ReadonlySet<number>,bounds:{x:number;y:number;width:number;height:number}) {
  let tiles=maps.get(floor);if(!tiles){tiles=new Map();maps.set(floor,tiles);}
  c.save();c.beginPath();
  for(const sector of floor.rooms)if(seen.has(sector.id))c.rect(sector.x,sector.y,sector.width,sector.height);
  c.clip();
  const world=riftLandscape(floor);
  for(let ty=Math.floor(bounds.y/SIZE);ty<=Math.floor((bounds.y+bounds.height)/SIZE);ty++)for(let tx=Math.floor(bounds.x/SIZE);tx<=Math.floor((bounds.x+bounds.width)/SIZE);tx++){
    if(!floor.rooms.some(r=>seen.has(r.id)&&r.x<tx*SIZE+SIZE&&r.x+r.width>tx*SIZE&&r.y<ty*SIZE+SIZE&&r.y+r.height>ty*SIZE))continue;
    const key=`${tx}:${ty}`;let tile=tiles.get(key);
    if(!tile){
      tile=document.createElement('canvas');tile.width=tile.height=SIZE/SAMPLE;const ctx=tile.getContext('2d')!;
      for(let y=0;y<SIZE/SAMPLE;y++)for(let x=0;x<SIZE/SAMPLE;x++){
        ctx.fillStyle=world.mapColor(tx*SIZE+(x+.5)*SAMPLE,ty*SIZE+(y+.5)*SAMPLE,SAMPLE);ctx.fillRect(x,y,1,1);
      }
      if(tiles.size>=324)tiles.delete(tiles.keys().next().value!);tiles.set(key,tile);
    }
    c.drawImage(tile,tx*SIZE,ty*SIZE,SIZE,SIZE);
  }
  c.restore();
}
