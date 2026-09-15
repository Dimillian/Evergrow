import type { AppearancePalette, CharacterAppearance } from './appearance-content.ts';
import { mixColor, type Point } from './art-primitives.ts';
import type { GearShape } from './weapon-shapes.ts';

type Hair = CharacterAppearance['hair'];
type Layers = { rear: GearShape[]; front: GearShape[] };
const fill = (points: readonly Point[], color: string): GearShape => ({points,fill:color});
const line = (points: readonly Point[], color: string, width=.45): GearShape => ({points,stroke:color,width});
const round = (x:number,y:number,rx:number,ry:number,lobes=0):Point[] => Array.from({length:32},(_,i)=>{
  const a=i*Math.PI/16,r=1+Math.cos(a*lobes)*.045;
  return [x+Math.cos(a)*rx*r,y+Math.sin(a)*ry*r];
});
const longLengths: Partial<Record<Hair,number>> = {bob:5.7,long:9.7,waves:9.7,locs:10,halfup:9.1,longside:10};
function bun(out:GearShape[],p:AppearancePalette,x:number,y:number,r:number):void {
  out.push(fill(round(x,y,r,r*.85,7),p.shadow),fill(round(x-.2,y-.2,r*.78,r*.65,6),p.base),
    line([[x-r*.55,y+.1],[x-r*.3,y-r*.4],[x+r*.3,y-r*.42]],p.light),
    line([[x-r*.55,y+r*.65],[x+r*.55,y+r*.65]],'#bca073',.5));
}
function braid(out:GearShape[],p:AppearancePalette,x:number,y:number,count:number):void {
  for(let i=0;i<count;i++) {
    const yy=y+i*1.35,xx=x+Math.sin(i*.65)*.25;
    out.push(fill([[xx-.85,yy],[xx,yy-.3],[xx+.9,yy+.45],[xx+.2,yy+1.5],[xx-.8,yy+1]],i%2?p.shadow:p.base),
      line([[xx-.45,yy+.2],[xx+.4,yy+.85]],p.light,.3));
  }
  out.push(line([[x-.6,y+count*1.35],[x+.7,y+count*1.35]],'#c6ad76',.55));
}

/** Authored right-facing silhouettes: crown, temple and nape are separate from
 * front-view bangs. The caller mirrors the complete head for west. */
export function profileHairShapes(style:Hair,p:AppearancePalette):Layers {
  const rear:GearShape[]=[],front:GearShape[]=[];
  if(style==='bald')return {rear,front};
  const length=longLengths[style];
  if(length) {
    rear.push(fill([[-3.5,-3.3],[-.7,-4.8],[1.1,-2.8],[.4,2.7],[.7,length-1.4],[-.5,length],[-2,length-.35],[-4.1,length-.9],[-4.8,length-2.5],[-4.3,1]],p.shadow));
    front.push(fill([[-3.7,-2.1],[-1.7,-3.5],[-.5,-1.3],[-1.5,1.2],[-1.5,4.1],[-.6,length-1.1],[-1.9,length-.4],[-3.8,length-1.3],[-4.2,2.2]],p.base));
    front.push(line([[-3.1,-1.3],[-3.4,2.2],[-2.8,length-2]],p.light,.55));
    if(style==='waves') {
      front.push(fill([[-3.8,-1],[-4.6,1.7],[-3.6,4],[-4.4,6.3],[-3.4,9],[-1.8,9.6],[-2.5,6.4],[-1.8,4],[-2.8,1.5]],p.base),
        line([[-3.2,0],[-3.7,1.8],[-2.8,4],[-3.4,6.4],[-2.6,8.6]],p.light,.55));
    }
    if(style==='locs') {
      front.length=0;
      for(let i=0;i<4;i++) {
        const x=-4+i*.95, end=8.4+(i%2)*1.1;
        front.push(fill([[x-.5,-2.9],[x+.5,-3.3],[x+.7,2],[x+.55,end],[x-.1,end+.5],[x-.55,end-.2],[x-.7,2]],i%2?p.shadow:p.base),
          line([[x,-1.8],[x+.15,3],[x,end-.6]],p.light,.3));
      }
    }
  }
  // Gathered hair attaches behind the skull instead of dangling from the chin.
  if(style==='ponytail') rear.push(fill([[-3.8,-2.7],[-5.5,-1.9],[-5.9,1],[-5.4,4.6],[-4.7,8.8],[-3.3,10],[-3.7,6],[-3.5,2],[-2.8,-1.2]],p.shadow),
    fill([[-4.4,-1.8],[-5,1],[-4.7,4],[-4,8.1],[-4.1,2],[-3.6,-1]],p.base),
    line([[-4.6,-1],[-4.8,2],[-4.3,6.3]],p.light));
  if(style==='braid')braid(rear,p,-3.7,1.1,6);
  if(style==='twinbraids')braid(rear,p,-2.5,2.5,5);
  if(style==='lowbun')bun(rear,p,-4.1,2.3,2.15);
  if(style==='doublebun')bun(rear,p,-2.7,-4.5,1.8);
  const pulled:readonly Point[]=[[-3.7,2.1],[-4.3,-.9],[-3.5,-3.7],[-1.5,-5.2],[1.2,-5],[3.1,-3.3],[3.35,-1.2],[2.3,-1.8],[1.1,-2.4],[-.2,-1.4],[-1.3,-.6],[-2.1,2.3]];
  const caps:Record<Exclude<Hair,'bald'>,readonly Point[]>={
    swept:[[-3.7,2],[-4.3,-.9],[-3.5,-3.8],[-1.2,-5.3],[1.7,-4.9],[3.5,-3.3],[3.65,-.6],[2.7,-1.3],[1,-3],[-.5,-2.1],[-1.6,-.3],[-2.4,2.4]],
    crop:[[-3.6,1.6],[-4.1,-1],[-3.3,-3.7],[-1.2,-5],[1.6,-4.6],[3.2,-3],[3.25,-1.2],[1.8,-2],[.1,-2.6],[-1.6,-1.5],[-2.5,1.5]],
    pixie:[[-3.7,2.4],[-4.5,.4],[-4,-1],[-4.4,-2.4],[-2.8,-4.7],[-1.2,-4.9],[.3,-5.6],[2.6,-4.1],[3.5,-2.3],[3.1,-.5],[2.1,-1.5],[1.6,-.8],[.3,-2.4],[-1.4,-1],[-2.3,2.5]],
    sidepart:[[-3.8,2],[-4.2,-1.1],[-3.5,-3.6],[-1.4,-5.2],[1.5,-5],[3.4,-3.3],[3.4,-.9],[2.5,-1.3],[1.5,-3.1],[.6,-3.3],[-1.5,-.8],[-2.3,2]],
    undercut:[[-3.9,-1.1],[-3.6,-3.9],[-1.5,-5.9],[1.4,-5.5],[3.5,-3.7],[3.7,-1.1],[2.5,-1.5],[.8,-2.9],[-1.3,-2.7]],
    quiff:[[-3.9,1.5],[-4.4,-1.6],[-3.5,-4.4],[-1.4,-5.8],[1.6,-7],[3.6,-6.2],[4,-4.4],[3.1,-2],[1.2,-3.1],[-.7,-2.7],[-2,-.7],[-2.6,1.9]],
    fringe:[[-3.7,2],[-4.3,-1.2],[-3.3,-4.3],[-1.2,-5.5],[1.7,-5],[3.4,-3.3],[3.55,-.2],[2.75,-.1],[2.35,-.8],[1.5,-.45],[.9,-1.5],[-.5,-1.9],[-1.7,-.5],[-2.4,2.1]],
    mohawk:[[-3.4,1.9],[-4.4,-1],[-4.2,-4.7],[-3.4,-6.5],[-1.7,-8],[.3,-8.5],[2.3,-7.4],[3.1,-5.5],[2.7,-3],[1.1,-3.7],[-1.3,-3.5],[-2.7,-1.4]],
    bob:pulled,long:pulled,waves:pulled,locs:pulled,halfup:pulled,longside:[[-3.9,2],[-4.4,-1.4],[-3.4,-4.2],[-1.2,-5.6],[1.7,-5],[3.4,-3.1],[3.3,-.3],[2.3,-1],[1.5,-2.5],[.5,-2.7],[-1.1,-.2],[-2,3]],
    braid:pulled,bun:pulled,ponytail:pulled,twinbraids:pulled,lowbun:pulled,doublebun:pulled,topknot:[[-3.5,-1.5],[-3,-3.8],[-1.3,-5.2],[1.5,-4.8],[3.1,-3.1],[3.2,-1.4],[1,-2.8],[-1.6,-2.1]],
    curls:pulled,afro:pulled,
  };
  if(style==='curls'||style==='afro') {
    const big=style==='afro',rx=big?5.2:4.3,ry=big?5.5:4.4;
    rear.push(fill(round(-1.1,-2.2,rx,ry,11),p.shadow));
    front.push(fill([[-4.4,2.3],[-1-rx,-.6],[-1-rx,-3.4],[-3.5,-2.2-ry],[-1,-2.5-ry],[1.7,-1.8-ry],[3.4,-4.1],[3.6,-1.5],[2.7,-.6],[1.6,-1.9],[.5,-1.6],[-.5,-2.2],[-1.9,-1.2],[-2.2,1.4],[-3.1,2.4]],p.base));
    for(const [x,y]of [[-4,-2],[-3.2,-4.7],[-1.4,-5.7],[.7,-5.3],[2.4,-3.5]])front.push(line([[x-.4,y+.2],[x-.2,y-.4],[x+.5,y-.35],[x+.65,y]],p.light,.45));
  } else {
    front.push(fill(caps[style],p.base));
    front.push(line(style==='mohawk'?[[-3.2,-3.1],[-2.5,-5.5],[-.5,-6.8],[1.2,-6]]:[[-3.3,-1.5],[-2.6,-3.5],[-.7,-4.3],[1.4,-3.9]],p.light,.5));
    if(style==='sidepart')front.push(line([[.6,-4.7],[.8,-3.4],[2,-2.1]],p.shadow,.6));
    if(style==='quiff')front.push(line([[-1.2,-4.5],[1.2,-5.8],[2.6,-5.4]],p.light,.55));
  }
  if(style==='bun')bun(front,p,-2.1,-5.9,2.25);
  if(style==='halfup')bun(front,p,-3,-3.7,1.8);
  if(style==='topknot')bun(front,p,-1.4,-6,1.65);
  if(style==='doublebun')bun(front,p,-1.9,-4.2,2.1);
  if(style==='twinbraids')braid(front,p,-2.8,2,5);
  return {rear,front};
}

/** Back views close the hairline around the nape, without painting a front
 * fringe or filling every long style with the same rectangular panel. */
export function backHairShapes(style:Hair,p:AppearancePalette):Layers {
  const front:GearShape[]=[],rear:GearShape[]=[];
  if(style==='bald')return {rear,front};
  const length=longLengths[style];
  const shaved=style==='undercut'||style==='topknot';
  const bottom=style==='locs'?2.4:length??(shaved?-.6:style==='crop'?3.1:style==='pixie'?3.5:4.2);
  const sheen=mixColor(p.base,p.light,.3);
  if(style==='mohawk') {
    front.push(fill([[-1.1,3.6],[-1.5,-3.8],[-1.4,-7.4],[0,-8.8],[1.4,-7.3],[1.6,-3.7],[1,3.6],[0,4.1]],p.base),line([[0,-7.1],[.3,-2.5],[0,2.6]],p.light));
    return {rear,front};
  }
  if(style==='curls'||style==='afro') {
    const r=style==='afro'?6.3:5.1;
    front.push(fill(round(0,-1.8,r,r*.95,12),p.shadow),fill(round(-.15,-2.2,r*.93,r*.89,11),p.base));
    for(const [x,y]of [[-3.4,-3.5],[-1.4,-5],[1,-5.2],[3.4,-3.6],[-3.8,-.5],[-1.8,1],[1.7,1],[3.7,-.7]])front.push(line([[x-.45,y+.15],[x-.2,y-.45],[x+.4,y-.4],[x+.6,y+.1]],p.light,.45));
    return {rear,front};
  }
  const top=style==='quiff'?-6.8:style==='undercut'?-5.7:-5.2;
  front.push(fill([[-4,1],[-4.5,-2.2],[-3,-4.6],[-.7,top],[1.9,top+.5],[3.9,-3],[4.3,.2],
    [length?4.8:3.8,bottom-1.4],[2.5,bottom-.1],[.7,bottom+.3],[-1.4,bottom],[-3.8,bottom-.8]],p.shadow));
  front.push(fill([[-3.8,-2.1],[-2.7,-4.1],[-.6,top+.5],[1.7,top+1],[3.3,-2.7],[3.6,.2],[length?3.9:3.1,bottom-1.1],[1.5,bottom-.3],[-.5,bottom-.5],[-2.8,bottom-1],[-3.5,1]],p.base));
  front.push(fill([[-2.7,-3],[-1.3,-4.3],[.3,-4.2],[-.9,-2.2],[-1.3,bottom-1.5],[-2.3,bottom-1.8]],sheen));
  if(length && style!=='locs')front.push(line([[1,-3.7],[1.9,-1],[2.1,3],[1.7,bottom-1]],mixColor(p.base,p.shadow,.4),.55));
  if(style==='pixie')front.push(fill([[-3.9,.5],[-4.3,2.6],[-3,2.1],[-2.7,3.7],[-1.4,3.2],[-.5,4.1],[1.1,3.1],[2.6,3.6],[3.2,2.1],[4.1,1.6],[3.7,.1]],p.base));
  if(style==='waves')for(const x of [-3.2,0,3.2])front.push(line([[x,-2.8],[x+.5,.3],[x-.35,3],[x+.5,6],[x,8.7]],x===0?mixColor(p.base,p.shadow,.45):sheen,.5));
  if(style==='locs')for(let i=0;i<6;i++) {
    const x=-3.4+i*1.35,end=8.2+(i%3)*.6;
    front.push(fill([[x-.65,-2.9],[x+.4,-3.5],[x+.7,-.5],[x+.55,end],[x-.05,end+.6],[x-.65,end]],i%2?p.base:p.shadow),line([[x,-2],[x+.1,3],[x,end-.4]],sheen,.4));
  }
  if(style==='ponytail')front.push(fill([[-1.5,-.8],[.1,-1.5],[1.6,-.4],[2.2,3.4],[1.5,8.2],[.2,10.5],[-1.2,8.6],[-1.8,3]],p.shadow),fill([[-.7,-.3],[.5,-.4],[1.2,3],[.8,7.8],[0,9],[-.5,5]],p.base),line([[-.2,.4],[.5,3.5],[.1,7.5]],p.light));
  if(style==='braid')braid(front,p,0,2.2,5);
  if(style==='twinbraids'){braid(front,p,-3.2,2,5);braid(front,p,3.2,2,5);}
  if(style==='bun')bun(front,p,0,-5.8,2.4);
  if(style==='halfup')bun(front,p,0,-2.7,2);
  if(style==='lowbun')bun(front,p,0,2.3,2.4);
  if(style==='topknot')bun(front,p,0,-6.1,1.75);
  if(style==='doublebun'){bun(front,p,-3.8,-3.8,2.1);bun(front,p,3.8,-3.8,2.1);}
  return {rear,front};
}
