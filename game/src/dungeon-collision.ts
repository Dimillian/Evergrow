import { cryptContains, cryptOutline } from './dungeon-contours.ts';
import type { DungeonFloor, Room } from './dungeon.ts';

const CELL=64;
const RING=Array.from({length:16},(_,i)=>({x:Math.cos(i*Math.PI/8),y:Math.sin(i*Math.PI/8)}));
interface Cell { rooms:Room[]; uniform?:boolean|null }
/** Broad phase for immutable dungeon silhouettes. Boundary cells still use exact polygons. */
export class DungeonCollision {
  private cells=new Map<number,Cell>();
  private left:number;
  private top:number;
  private width:number;
  private height:number;
  constructor(floor:DungeonFloor){
    const rooms=[...floor.rooms,...floor.corridors];
    this.left=Math.floor(Math.min(...rooms.map(r=>r.x-88))/CELL);
    this.top=Math.floor(Math.min(...rooms.map(r=>r.y-88))/CELL);
    this.width=Math.floor(Math.max(...rooms.map(r=>r.x+r.width+88))/CELL)-this.left+1;
    this.height=Math.floor(Math.max(...rooms.map(r=>r.y+r.height+88))/CELL)-this.top+1;
    for(const room of rooms)for(let y=Math.floor((room.y-88)/CELL);y<=Math.floor((room.y+room.height+88)/CELL);y++)
      for(let x=Math.floor((room.x-88)/CELL);x<=Math.floor((room.x+room.width+88)/CELL);x++){
        const key=(y-this.top)*this.width+x-this.left;
        let cell=this.cells.get(key);
        if(!cell){cell={rooms:[]};this.cells.set(key,cell);}
        cell.rooms.push(room);
      }
  }
  private cell(gx:number,gy:number):Cell|undefined {
    const x=gx-this.left,y=gy-this.top;
    if(x<0||y<0||x>=this.width||y>=this.height)return undefined;
    const cell=this.cells.get(y*this.width+x);
    if(!cell||cell.uniform!==undefined)return cell;
    const left=gx*CELL,top=gy*CELL,right=left+CELL,bottom=top+CELL;
    cell.uniform=null;
    // No polygon edge can enter a uniform cell. Bounding-box overlap is conservative.
    for(const room of cell.rooms){
      const points=cryptOutline(room);
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const a=points[i],b=points[j];
        if(Math.max(a.x,b.x)>=left&&Math.min(a.x,b.x)<=right&&Math.max(a.y,b.y)>=top&&Math.min(a.y,b.y)<=bottom)return cell;
      }
    }
    cell.uniform=cell.rooms.some(r=>cryptContains(r,left+CELL/2,top+CELL/2));
    return cell;
  }
  contains(x:number,y:number):boolean {
    const cell=this.cell(Math.floor(x/CELL),Math.floor(y/CELL));
    return !!cell&&(cell.uniform??cell.rooms.some(r=>cryptContains(r,x,y)));
  }
  blocked(x:number,y:number,radius:number):boolean {
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(radius)||radius<0||radius>1000)return true;
    if(!this.contains(x,y))return true;
    if(radius===0)return false;
    if(radius<=CELL){
      let clear=true;
      for(let gy=Math.floor((y-radius)/CELL);clear&&gy<=Math.floor((y+radius)/CELL);gy++)
        for(let gx=Math.floor((x-radius)/CELL);gx<=Math.floor((x+radius)/CELL);gx++)
          if(this.cell(gx,gy)?.uniform!==true){clear=false;break;}
      if(clear)return false;
    }
    for(const p of RING)if(!this.contains(x+p.x*radius,y+p.y*radius))return true;
    return false;
  }
}
const caches=new WeakMap<DungeonFloor,DungeonCollision>();
export function dungeonCollision(floor:DungeonFloor):DungeonCollision {
  let cache=caches.get(floor);
  if(!cache){cache=new DungeonCollision(floor);caches.set(floor,cache);}
  return cache;
}
