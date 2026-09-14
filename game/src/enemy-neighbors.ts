import type { Enemy } from './model.ts';
/** Rebuilt once per fixed tick; moved actors update immediately to preserve AI ordering. */
export class EnemyNeighbors {
  private cells=new Map<string,Enemy[]>();
  private membership=new Map<Enemy,string>();
  private order=new Map<Enemy,number>();
  private maxRadius=0;
  private key(x:number,y:number){return `${Math.floor(x/96)}:${Math.floor(y/96)}`;}
  rebuild(enemies:readonly Enemy[]){
    this.cells.clear();this.membership.clear();this.order.clear();this.maxRadius=0;
    enemies.forEach((enemy,index)=>{if(enemy.state==='dead')return;this.order.set(enemy,index);this.maxRadius=Math.max(this.maxRadius,enemy.radius);this.update(enemy);});
  }
  update(enemy:Enemy){
    if(!this.order.has(enemy))return;
    const next=this.key(enemy.x,enemy.y),old=this.membership.get(enemy);if(old===next)return;
    if(old){const cell=this.cells.get(old)!;cell.splice(cell.indexOf(enemy),1);if(!cell.length)this.cells.delete(old);}
    let cell=this.cells.get(next);if(!cell){cell=[];this.cells.set(next,cell);}cell.push(enemy);this.membership.set(enemy,next);
  }
  around(enemy:Enemy,padding:number):readonly Enemy[]{
    const radius=enemy.radius+this.maxRadius+padding,out:Enemy[]=[];
    for(let y=Math.floor((enemy.y-radius)/96);y<=Math.floor((enemy.y+radius)/96);y++)for(let x=Math.floor((enemy.x-radius)/96);x<=Math.floor((enemy.x+radius)/96);x++){
      const cell=this.cells.get(`${x}:${y}`);if(cell)out.push(...cell);
    }
    return out.sort((a,b)=>this.order.get(a)!-this.order.get(b)!);
  }
}
