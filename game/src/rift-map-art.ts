import type { DungeonFloor } from './dungeon.ts';
import { riftLandscape } from './rift-floor.ts';
const SIZE=512, SAMPLE=32, MASK_SAMPLE=8, FEATHER=192;
interface Tile { terrain:HTMLCanvasElement; surface:HTMLCanvasElement; revision:string; }
const maps=new WeakMap<DungeonFloor,Map<string,Tile>>();
type Sector=Pick<DungeonFloor['rooms'][number],'id'|'x'|'y'|'width'|'height'>;
/** Fade inward from unknown sectors. Internal discovery edges stay fully opaque. */
export function riftDiscoverySampler(rooms:readonly Sector[],seen:ReadonlySet<number>):(x:number,y:number)=>number {
  if(!rooms.length)return ()=>0;
  const unknown=rooms.filter(r=>!seen.has(r.id));
  // The generated sector rectangle is finite; its outside is also undiscovered.
  const left=Math.min(...rooms.map(r=>r.x)),top=Math.min(...rooms.map(r=>r.y));
  const right=Math.max(...rooms.map(r=>r.x+r.width)),bottom=Math.max(...rooms.map(r=>r.y+r.height));
  const width=rooms[0].width,height=rooms[0].height,columns=Math.round((right-left)/width);
  // Rifts use a uniform streaming lattice. Compile local frontier neighbors once,
  // rather than scanning the full map for every fog sample.
  const cells=new Map<number,readonly Sector[]>();
  for(const r of rooms)if(seen.has(r.id))cells.set(Math.round((r.y-top)/height)*columns+Math.round((r.x-left)/width),
    unknown.filter(u=>u.x<r.x+r.width+FEATHER&&u.x+u.width>r.x-FEATHER&&u.y<r.y+r.height+FEATHER&&u.y+u.height>r.y-FEATHER));
  return (x,y)=>{
  if(x<left||x>=right||y<top||y>=bottom)return 0;
  const neighbors=cells.get(Math.floor((y-top)/height)*columns+Math.floor((x-left)/width));
  if(!neighbors)return 0;
  let distance=Math.min(FEATHER,x-left,right-x,y-top,bottom-y);
  for(const r of neighbors) {
    const dx=Math.max(r.x-x,0,x-r.x-r.width),dy=Math.max(r.y-y,0,y-r.y-r.height);
    if(dx<distance&&dy<distance)distance=Math.min(distance,Math.hypot(dx,dy));
  }
  const t=Math.max(0,Math.min(1,distance/FEATHER));return t*t*(3-2*t);
  };
}
/** Disjoint tile destinations prevent dark grid seams on the translucent Tab map. */
export function drawRiftMapTerrain(c:CanvasRenderingContext2D,floor:DungeonFloor,seen:ReadonlySet<number>,bounds:{x:number;y:number;width:number;height:number}) {
  let tiles=maps.get(floor);if(!tiles){tiles=new Map();maps.set(floor,tiles);}
  const revision=[...seen].sort((a,b)=>a-b).join(','),world=riftLandscape(floor),alpha=riftDiscoverySampler(floor.rooms,seen);
  c.save();c.imageSmoothingEnabled=true;
  for(let ty=Math.floor(bounds.y/SIZE);ty<=Math.floor((bounds.y+bounds.height)/SIZE);ty++)for(let tx=Math.floor(bounds.x/SIZE);tx<=Math.floor((bounds.x+bounds.width)/SIZE);tx++){
    if(!floor.rooms.some(r=>seen.has(r.id)&&r.x<tx*SIZE+SIZE&&r.x+r.width>tx*SIZE&&r.y<ty*SIZE+SIZE&&r.y+r.height>ty*SIZE))continue;
    const key=`${tx}:${ty}`;let tile=tiles.get(key);
    if(!tile){
      const terrain=document.createElement('canvas');terrain.width=terrain.height=SIZE/SAMPLE+2;const ctx=terrain.getContext('2d')!;
      for(let y=0;y<terrain.height;y++)for(let x=0;x<terrain.width;x++){
        ctx.fillStyle=world.mapColor(tx*SIZE+(x-.5)*SAMPLE,ty*SIZE+(y-.5)*SAMPLE,SAMPLE);ctx.fillRect(x,y,1,1);
      }
      const surface=document.createElement('canvas');surface.width=surface.height=SIZE/MASK_SAMPLE+2;
      tile={terrain,surface,revision:''};
      if(tiles.size>=324)tiles.delete(tiles.keys().next().value!);tiles.set(key,tile);
    }
    if(tile.revision!==revision){
      const ctx=tile.surface.getContext('2d')!,n=tile.surface.width;
      ctx.clearRect(0,0,n,n);
      // Retain a sample border for filtering, but never paint overlapping world rectangles.
      ctx.drawImage(tile.terrain,(SAMPLE-MASK_SAMPLE)/SAMPLE,(SAMPLE-MASK_SAMPLE)/SAMPLE,
        (SIZE+MASK_SAMPLE*2)/SAMPLE,(SIZE+MASK_SAMPLE*2)/SAMPLE,0,0,n,n);
      const pixels=ctx.getImageData(0,0,n,n);
      for(let y=0;y<n;y++)for(let x=0;x<n;x++)pixels.data[(y*n+x)*4+3]=Math.round(255*alpha(tx*SIZE+(x-.5)*MASK_SAMPLE,ty*SIZE+(y-.5)*MASK_SAMPLE));
      ctx.putImageData(pixels,0,0);tile.revision=revision;
    }
    c.drawImage(tile.surface,1,1,SIZE/MASK_SAMPLE,SIZE/MASK_SAMPLE,tx*SIZE,ty*SIZE,SIZE,SIZE);
  }
  c.restore();
}
