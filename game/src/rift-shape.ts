/** Seeded wilderness clearings and broad reconnecting trails. Shared by terrain,
 * collision, map rendering and encounter placement. */
export interface RiftClearing { x:number; y:number; radius:number; index:number }
export interface RiftTrail { a:RiftClearing; b:RiftClearing; bend:{x:number;y:number}; width:number }
export interface RiftShape { clearings:readonly RiftClearing[]; trails:readonly RiftTrail[]; distance(x:number,y:number):number }
export function createRiftShape(seed:number):RiftShape {
  let state=(seed^0x68bc21eb)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const clearings:RiftClearing[]=[{x:0,y:0,radius:340,index:-1}],trails:RiftTrail[]=[];
  // Best-candidate spacing gives irregular geography, without a ring or tile pattern.
  for(let i=0;i<28;i++){
    let best={x:0,y:0},score=-Infinity;
    for(let candidate=0;candidate<96;candidate++){
      const angle=random()*Math.PI*2,range=900+Math.sqrt(random())*(Math.min(3500,1250+i*100)-900);
      const point={x:Math.cos(angle)*range,y:Math.sin(angle)*range};
      const gap=Math.min(...clearings.map(p=>Math.hypot(p.x-point.x,p.y-point.y)));
      if(gap>score){score=gap;best=point;}
    }
    clearings.push({...best,radius:430+random()*95,index:i});
  }
  const link=(a:RiftClearing,b:RiftClearing)=>{
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),bend=(random()-.5)*150;
    trails.push({a,b,bend:{x:(a.x+b.x)/2-dy/length*bend,y:(a.y+b.y)/2+dx/length*bend},width:155+random()*30});
  };
  // Minimum spanning tree guarantees arrival access. Short extra links create choices.
  const connected=new Set([clearings[0]]);
  while(connected.size<clearings.length){
    let pair:[RiftClearing,RiftClearing]|undefined,shortest=Infinity;
    for(const a of connected)for(const b of clearings)if(!connected.has(b)){
      const d=Math.hypot(a.x-b.x,a.y-b.y);if(d<shortest){shortest=d;pair=[a,b];}
    }
    link(...pair!);connected.add(pair![1]);
  }
  for(const a of clearings.slice(1)){
    const neighbors=clearings.filter(b=>b!==a&&!trails.some(t=>t.a===a&&t.b===b||t.a===b&&t.b===a))
      .sort((b,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(a.x-c.x,a.y-c.y));
    const b=neighbors[0];
    if(b&&Math.hypot(a.x-b.x,a.y-b.y)<1550&&random()<.4)link(a,b);
  }
  const segments=trails.flatMap(t=>[[t.a,t.bend],[t.bend,t.b]].map(([a,b])=>({x:a.x,y:a.y,dx:b.x-a.x,dy:b.y-a.y,length2:(b.x-a.x)**2+(b.y-a.y)**2,width:t.width})));
  const distance=(x:number,y:number)=>{
    let d=Infinity;
    for(const p of clearings)d=Math.min(d,Math.hypot(x-p.x,y-p.y)-p.radius);
    for(const segment of segments){
      const {dx,dy}=segment,t=Math.max(0,Math.min(1,((x-segment.x)*dx+(y-segment.y)*dy)/segment.length2));
      d=Math.min(d,Math.hypot(x-segment.x-dx*t,y-segment.y-dy*t)-segment.width);
    }
    return d+Math.sin(x/113+seed)*Math.cos(y/127)*23;
  };
  clearings.forEach(Object.freeze);trails.forEach(t=>{Object.freeze(t.bend);Object.freeze(t);});
  return Object.freeze({clearings:Object.freeze(clearings),trails:Object.freeze(trails),distance});
}
