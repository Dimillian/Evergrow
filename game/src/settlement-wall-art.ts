import type { Building } from './settlements.ts';
import type { WallSegment } from './settlement-walls.ts';
import { SKY_DIRECTION, shadowProjection } from './scene-light-style.ts';
type Point=readonly [number,number];
const polygon=(c:CanvasRenderingContext2D,points:readonly Point[],color?:string)=>{
  c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();
  if(color){c.fillStyle=color;c.fill();}
};
const fill=(c:CanvasRenderingContext2D,p:readonly Point[],color:string)=>{c.beginPath();polygon(c,p,color);};
const line=(c:CanvasRenderingContext2D,a:Point,b:Point,color:string,width=1)=>{c.beginPath();c.moveTo(...a);c.lineTo(...b);c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const up=(p:Point,h:number):Point=>[p[0],p[1]-h];
const at=(a:Point,b:Point,t:number):Point=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const height=(b:Building)=>b.kind==='tower'?(b.fortification==='stone'?82:68):b.fortification==='stone'?54:b.fortification==='palisade'?49:34;
const slice=(s:WallSegment,start:number,end:number):WallSegment['footprint']=>{
  const [a,b,c,d]=s.footprint,u=start/s.length,v=end/s.length;
  return [at(a,b,u),at(a,b,v),at(d,c,v),at(d,c,u)];
};
/** Visible sides of a ground ribbon extruded vertically; no front-facing sprite rotations. */
function prism(c:CanvasRenderingContext2D,q:WallSegment['footprint'],h:number,base:number,
  colors:readonly [string,string,string],startCap:boolean,endCap:boolean){
  const edges:Array<[Point,Point,boolean]>=[[q[0],q[1],true],[q[1],q[2],endCap],[q[2],q[3],true],[q[3],q[0],startCap]];
  for(const [a,b,enabled]of edges){
    // The ribbon has negative signed area in screen coordinates. Only its south-facing sides are visible.
    if(!enabled||b[0]<=a[0])continue;
    const dx=b[0]-a[0],dy=b[1]-a[1];
    fill(c,[up(a,base),up(b,base),up(b,h),up(a,h)],Math.abs(dy)>Math.abs(dx)*.6?colors[1]:colors[0]);
  }
  fill(c,q.map(p=>up(p,h)),colors[2]);
}

/** All spans share one ground fill, so joins never darken into a chain of oval stamps. */
export function drawFortificationShadows(c:CanvasRenderingContext2D,buildings:readonly Building[]){
  const walls=buildings.filter(b=>b.wallSegment);
  if(!walls.length)return;
  const projection=shadowProjection(SKY_DIRECTION);
  c.save();c.fillStyle='#040d1740';c.beginPath();
  for(const b of walls){
    const q=b.wallSegment!.footprint,dx=projection.x*height(b),dy=projection.y*height(b);
    polygon(c,q);
    for(let i=0;i<4;i++){const a=q[i],z=q[(i+1)%4];
      // Same winding for every overlapping extrusion keeps the union solid.
      const p:Point[]=[a,z,[z[0]+dx,z[1]+dy],[a[0]+dx,a[1]+dy]];
      const area=p.reduce((sum,a,i)=>{const z=p[(i+1)%p.length];return sum+a[0]*z[1]-z[0]*a[1];},0);
      polygon(c,area<0?p:p.reverse());
    }
    polygon(c,q.map(p=>[p[0]+dx,p[1]+dy] as Point));
  }
  c.fill();c.restore();
}

export function drawFortification(c:CanvasRenderingContext2D,b:Building){
  const s=b.wallSegment;if(!s)return;
  const stone=b.fortification==='stone',h=height(b),snow=b.biome==='frostpine';
  c.save();
  if(stone){
    const colors:readonly [string,string,string]=['#626f70','#495960',snow?'#c4d3cc':'#9aa397'];
    prism(c,s.footprint,h,0,colors,s.startCap,s.endCap);
    // Mortar follows the actual face and continuous distance along the whole wall run.
    const q=s.footprint;
    for(const [a,z,reverse]of [[q[0],q[1],false],[q[3],q[2],true]] as const){
      if((z[0]-a[0])*(reverse?-1:1)<=0)continue;
      for(let row=0;row<Math.ceil(h/9);row++){
        const y=row*9;
        line(c,up(a,y),up(z,y),'#34484d',.8);
        const offset=(row%2)*11;
        for(let d=Math.ceil((s.distance-offset)/23)*23+offset;d<s.distance+s.length;d+=23){
          const p=at(a,z,(d-s.distance)/s.length);
          line(c,up(p,y),up(p,Math.min(h,y+9)),'#34484d',.8);
        }
      }
    }
    // A continuous coping course joins at mitred corners. Battlements keep a single rhythm.
    for(let d=Math.floor(s.distance/27)*27;d<s.distance+s.length;d+=27){
      const start=Math.max(0,d-s.distance),end=Math.min(s.length,d+15-s.distance);
      if(end<=start)continue;
      prism(c,slice(s,start,end),h+9,h,colors,start===d-s.distance||s.startCap,end===d+15-s.distance||s.endCap);
    }
    if(s.startCap||s.endCap){
      const start=s.startCap?0:Math.max(0,s.length-7),end=s.startCap?Math.min(7,s.length):s.length;
      prism(c,slice(s,start,end),h+13,0,['#75817d','#526265',snow?'#d5e1db':'#a3ab9b'],true,true);
    }
  }else{
    // Individual timbers stand vertically but their depth and rails follow the wall's direction.
    for(let d=Math.floor(s.distance/7)*7;d<s.distance+s.length;d+=7){
      const start=Math.max(0,d+.35-s.distance),end=Math.min(s.length,d+6.65-s.distance);
      if(end<=start)continue;
      const index=Math.round(d/7),rise=h+Math.sin(index*7.13)*2.4;
      const q=slice(s,start,end),colors:readonly [string,string,string]=index%3===0?
        ['#88704c','#584a35',snow?'#c9d8d0':'#b19a68']:['#786346','#4d4432',snow?'#bdcfc5':'#a78c58'];
      prism(c,q,rise-4,0,colors,true,true);
      const middle=at(at(q[0],q[1],.5),at(q[3],q[2],.5),.5);
      const tips=q.map((a,edge)=>({a,z:q[(edge+1)%4],edge})).sort((a,b)=>a.a[1]+a.z[1]-b.a[1]-b.z[1]);
      for(const {a,z,edge}of tips)fill(c,[up(a,rise-4),up(z,rise-4),up(middle,rise+2)],edge%2?colors[1]:colors[2]);
      const forward=q[1][0]>=q[0][0],faceA=forward?q[0]:q[3],faceB=forward?q[1]:q[2],p=at(faceA,faceB,.3);
      line(c,up(p,3),up(p,rise-7),'#b49b6855',.7);
    }
    for(const elevation of [10,h*.65])prism(c,s.footprint,elevation+3,elevation,['#655439','#493f30','#947b52'],s.startCap,s.endCap);
    if(s.startCap||s.endCap){
      const p=s.startCap?at(s.footprint[0],s.footprint[3],.5):at(s.footprint[1],s.footprint[2],.5);
      line(c,up(p,3),up(p,h+5),'#5b4b32',5);
      for(const y of [11,h*.65+1])line(c,[p[0]-3,p[1]-y],[p[0]+3,p[1]-y],'#c2ae7b',1.5);
    }
  }
  c.restore();
}
