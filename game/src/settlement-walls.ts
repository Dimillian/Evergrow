type Point = readonly [number, number];
export interface WallSegment {
  /** Joined ground ribbon: left start, left end, right end, right start. */
  footprint: [Point, Point, Point, Point];
  distance: number;
  length: number;
  startCap: boolean;
  endCap: boolean;
}

/** One connected boundary, subdivided only for collision and actor depth sorting. */
export function buildWallSegments(points: readonly Point[], closed: boolean, thickness: number,
  allowed: (x:number,y:number)=>boolean): WallSegment[] {
  const spans:Array<{a:Point;b:Point;distance:number;length:number;allowed:boolean}>=[];
  let distance=0;
  for(let edge=0;edge<points.length-(closed?0:1);edge++){
    const a=points[edge],b=points[(edge+1)%points.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length<.001)continue;
    const count=Math.ceil(length/20);
    for(let i=0;i<count;i++){
      const at=(t:number):Point=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
      const p=at(i/count),q=at((i+1)/count),mid=at((i+.5)/count);
      spans.push({a:p,b:q,distance:distance+length*i/count,length:length/count,
        allowed:allowed(...p)&&allowed(...mid)&&allowed(...q)});
    }
    distance+=length;
  }
  const normal=(a:Point,b:Point):Point=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1]);return [-(b[1]-a[1])/l,(b[0]-a[0])/l];};
  const join=(n:Point,other:Point):Point=>{
    const divisor=1+n[0]*other[0]+n[1]*other[1];
    if(divisor<.2)return [n[0]*thickness/2,n[1]*thickness/2];
    return [(n[0]+other[0])*thickness/2/divisor,(n[1]+other[1])*thickness/2/divisor];
  };
  return spans.flatMap((span,i)=>{
    if(!span.allowed)return [];
    const previous=i>0?spans[i-1]:closed?spans.at(-1):undefined;
    const next=i+1<spans.length?spans[i+1]:closed?spans[0]:undefined;
    const n=normal(span.a,span.b),a=join(n,previous?.allowed?normal(previous.a,previous.b):n),b=join(n,next?.allowed?normal(next.a,next.b):n);
    return [{footprint:[[span.a[0]+a[0],span.a[1]+a[1]],[span.b[0]+b[0],span.b[1]+b[1]],
      [span.b[0]-b[0],span.b[1]-b[1]],[span.a[0]-a[0],span.a[1]-a[1]]] as WallSegment['footprint'],
      distance:span.distance,length:span.length,startCap:!previous?.allowed,endCap:!next?.allowed}];
  });
}
