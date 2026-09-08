import type { Room } from './dungeon.ts';
type Point = {x:number;y:number};
/** A swept, varying-width passage. The same polygon drives drawing and collision. */
export function dungeonPassage(points: readonly Point[], width: number, connection: number): Room {
    const a=points[0],b=points.at(-1)!,corner=points.length===3?points[1]:null;
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;
    const handed=connection%2?-1:1;
    const bow=corner?0:Math.min(135,length*.22)*handed;
    const c=corner?{x:a.x+(corner.x-a.x)*.8,y:a.y+(corner.y-a.y)*.8}:{x:a.x+dx/3+nx*bow,y:a.y+dy/3+ny*bow};
    const d=corner?{x:b.x+(corner.x-b.x)*.8,y:b.y+(corner.y-b.y)*.8}:{x:b.x-dx/3-nx*bow*.65,y:b.y-dy/3-ny*bow*.65};
    const steps=Math.max(12,Math.ceil((corner?Math.hypot(corner.x-a.x,corner.y-a.y)+Math.hypot(b.x-corner.x,b.y-corner.y):length)/40));
    const path:Point[]=[];
    for(let i=0;i<=steps;i++){
        const t=i/steps,u=1-t;
        path.push({x:u*u*u*a.x+3*u*u*t*c.x+3*u*t*t*d.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c.y+3*u*t*t*d.y+t*t*t*b.y});
    }
    const left:Point[]=[],right:Point[]=[];
    path.forEach((p,i)=>{
        const before=path[Math.max(0,i-1)],after=path[Math.min(steps,i+1)],vx=after.x-before.x,vy=after.y-before.y,n=Math.hypot(vx,vy),t=i/steps;
        // A wider landing in the middle, with gently uneven stone shoulders.
        const half=width/2+Math.sin(Math.PI*t)**2*(18+12*Math.sin(t*9+connection));
        const wear=Math.sin(i*2.1+connection)*3;
        left.push({x:p.x-vy/n*(half+wear),y:p.y+vx/n*(half+wear)});
        right.push({x:p.x+vy/n*(half-wear),y:p.y-vx/n*(half-wear)});
    });
    const outline=[...left,...right.reverse()];
    const x=Math.min(...outline.map(p=>p.x)),y=Math.min(...outline.map(p=>p.y));
    return {id:-1,kind:'combat',connection,x,y,width:Math.max(...outline.map(p=>p.x))-x,height:Math.max(...outline.map(p=>p.y))-y,outline,path};
}
