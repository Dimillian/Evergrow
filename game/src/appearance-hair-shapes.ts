import type { AppearancePalette, CharacterAppearance } from './appearance-content.ts';
import type { Point } from './art-primitives.ts';
import type { GearShape } from './weapon-shapes.ts';

type Hair = CharacterAppearance['hair'];
const fill = (points:readonly Point[], color:string):GearShape => ({points,fill:color});
const line = (points:readonly Point[], color:string, width=.55):GearShape => ({points,stroke:color,width});
const cluster = (x:number,y:number,r:number,lobes=7):Point[] => Array.from({length:lobes*4},(_,i)=> {
  const angle=i/(lobes*4)*Math.PI*2, radius=r*(1+Math.cos(angle*lobes)*.07);
  return [x+Math.cos(angle)*radius,y+Math.sin(angle)*radius];
});

/** Rear lengths are drawn behind the face; fringes and attached tails use the front pass. */
export function hairShapes(style:Hair, p:AppearancePalette, facing:number):{rear:GearShape[];front:GearShape[]} {
  const rear:GearShape[]=[], front:GearShape[]=[];
  if(style==='bald') return {rear,front};
  const back=Math.sin(facing)<-.16, side=Math.cos(facing);
  const lengths:Partial<Record<Hair,number>>={bob:6.3,long:10.5,waves:10,locs:11,halfup:9.5,longside:10.5};
  const length=lengths[style];
  if(length) {
    rear.push(fill([[-4.2,-3],[4.2,-3],[5.2,2],[5.6,length-1],[2.6,length],[0,length-.7],[-2.8,length],[-5.3,length-1.4],[-5,2]],p.shadow));
    for(const x of [-3.9,3.9]) rear.push(fill([[x-.8,-1],[x+.6,-1],[x+1,length-1.6],[x-.8,length-1]],p.base),line([[x,-.2],[x+.25,length-2]],p.light,.45));
  }
  if(style==='ponytail'||style==='lowbun') {
    const x=back?0:-side*3.8+(style==='ponytail'?Math.max(0,Math.sin(facing))*3.3:0);
    const bunY=3.7-Math.max(0,Math.sin(facing))*2.5;
    rear.push(fill(style==='lowbun'?cluster(x,bunY,2.8):[[x-1.7,-1],[x+1.5,-1],[x+2.8,4],[x+1.8,9.5],[x-.6,11],[x-1.1,5],[x-2,2]],p.shadow));
    if(style==='ponytail')rear.push(line([[x-.6,1],[x+.4,4],[x+.3,8.5]],p.light,.65));
  }
  const simple:Partial<Record<Hair,readonly Point[]>>={
    swept:[[-4.2,-.7],[-3.2,-3.9],[.6,-4.8],[3.7,-2.7],[3.8,-.6],[2.1,-1.4],[1,-2.5],[-1.5,-1.8],[-2.2,.1],[-3.6,1.4]],
    crop:[[-4,-.4],[-3.5,-3.7],[-2,-4.9],[.8,-5.2],[3.8,-3],[4.1,-.3],[2.5,-1.5],[.4,-2.6],[-2.4,-1.7]],
    pixie:[[-4.1,1],[-4.5,-2],[-3.1,-4.9],[-1.4,-4.6],[.4,-5.5],[3.8,-3.4],[4,-.8],[2.7,-1.5],[2.2,-.5],[.3,-2.7],[-1.3,-1.2],[-1.8,-2],[-3.1,-.1],[-3.3,2]],
    sidepart:[[-4.2,.3],[-4.4,-2.6],[-2.9,-4.7],[.5,-5.1],[3.7,-3.4],[4.1,-.3],[2.8,-.8],[1.7,-2.6],[.5,-3.4],[-.7,-1.6],[-3.5,.5]],
    undercut:[[-3.3,-2],[-3.2,-4.6],[-1.5,-5.8],[1.2,-5.7],[4,-3.1],[4.2,.1],[2.4,-1.1],[1.1,-2.1],[-1.1,-2.8]],
    quiff:[[-4,-.1],[-4.4,-3],[-3.4,-5.5],[-1.1,-7.2],[1.5,-7],[3.4,-5.6],[3.7,-3],[3.3,-1],[1.5,-2.6],[-.4,-3.3],[-2.7,-1.7]],
    fringe:[[-4.5,1.5],[-4.6,-2.8],[-2.8,-5],[.3,-5.4],[3.8,-3.8],[4.3,1.5],[3,1],[2.9,-.5],[1.8,-.1],[1.7,-.8],[.3,-.3],[-1,-.8],[-2.5,-.1],[-3.1,1.8]],
    mohawk:[[-1.2,-1.7],[-1.5,-5.2],[-1.2,-7.3],[-.2,-8.8],[1.4,-7.3],[1.9,-4.9],[1.5,-1.3],[.2,-2.2]],
    bob:[[-4.7,4.6],[-4.8,-2.4],[-3.2,-4.9],[.4,-5.5],[3.7,-3.8],[4.9,-.7],[4.7,5.7],[3.1,5.2],[2.6,-1.7],[.3,-3],[-1.2,-1.5],[-2.9,-.6],[-3.2,5.7]],
    longside:[[-4.5,5.4],[-4.6,-2.5],[-3,-5],[.3,-5.6],[3.8,-3.9],[4.7,.3],[4.7,9.8],[3,10.4],[3.1,3],[2.5,-2.1],[1.1,-3.3],[-.4,-1.1],[-2.7,.8],[-3.4,5.9]],
  };
  const cap=simple[style]??[[-4.5,.7],[-4.6,-2.6],[-3,-5],[.5,-5.5],[3.7,-3.4],[4.5,-.6],[4,3.8],[2.9,2.4],[2.3,-1.9],[.3,-3.1],[-.8,-1.6],[-2.9,-.4],[-3.6,4]];
  if(style==='curls'||style==='afro') {
    const r=style==='afro'?6.3:5.1, y=style==='afro'?-2.2:-2;
    front.push(fill(cluster(0,y,r,style==='afro'?12:8),p.shadow));
    // A hairline opening keeps the same face visible beneath the surrounding volume.
    front.push(fill([[-r,.7],[-r,-2.6],[-r*.7,-5.5],[0,y-r],[r*.7,-5.3],[r,-2],[r,1.6],[3.4,2.3],[2.8,-.9],[1.2,-1.9],[0,-2.2],[-1.3,-1.3],[-2.7,-1.7],[-3.2,2],[-r,1.5]],p.base));
    // Clear the central cluster fill from the face by moving its full silhouette behind the head.
    rear.push(front.shift()!);
    for(const [x,yy] of [[-4,-3.7],[-2,-5.3],[.5,-5.7],[3,-4.7],[4.4,-2.2],[-4.7,-.4]]) front.push(line([[x-.5,yy],[x,yy-.5],[x+.7,yy-.2]],p.light,.55));
  } else if(style==='waves') {
    front.push(fill([[-5,6],[-4.4,3],[-5,.5],[-4.7,-2.6],[-3.1,-5],[.5,-5.6],[3.8,-3.5],[4.7,-.5],[4.2,2.2],[5.2,5],[4.4,9.6],[3.2,10],[3.5,5.5],[2.8,2],[2.4,-1.7],[.5,-3],[-1.4,-1.6],[-3,-.4],[-3.1,3],[-3.8,6],[-3.1,9.7],[-4.8,10.5]],p.base));
    for(const s of [-1,1]) front.push(line([[s*2.4,-3],[s*3.8,-.3],[s*3.4,2.8],[s*4.2,5.5],[s*3.8,8.9]],p.light,.55));
  } else if(style==='locs') {
    front.push(fill(cap,p.shadow));
    for(let i=0;i<7;i++) {
      const x=-4.2+i*1.4, edge=Math.abs(x)>2.3, bottom=edge?9.4+(i%2):-.8+(i%2)*.8;
      front.push(fill([[x-.65,-3.5+Math.abs(x)*.18],[x,-5.5+Math.abs(x)*.23],[x+.7,-3.8],[x+.65,bottom],[x-.45,bottom+.6]],i%2?p.base:p.shadow),line([[x-.2,-3.5],[x+.1,bottom-.7]],p.light,.4));
    }
  } else {
    front.push(fill(cap,p.base));
    if(style==='mohawk') front.push(line([[0,-6.8],[.7,-4.8],[.6,-2.8]],p.light,.55));
    else front.push(line([[-3.7,-1.4],[-2.7,-3.5],[-.6,-4.4],[1.6,-3.7]],p.light,.55));
    if(style==='sidepart') front.push(line([[.6,-4.7],[.6,-3.3],[2,-1.9]],p.shadow,.75));
    if(style==='undercut') front.push(line([[-3.7,-2.5],[-3.4,.1]],p.shadow,1.2));
    if(style==='quiff') front.push(line([[-2.8,-4.4],[-1,-5.9],[1,-5.8],[2,-4.8]],p.light,.6));
  }
  if(back) {
    const bottom=length??(style==='undercut'||style==='mohawk'||style==='topknot'?0:4.8);
    if(style!=='mohawk') front.push(fill([[-3.9,-1.5],[3.9,-1.5],[4.1,bottom-1.3],[1.8,bottom],[-2.3,bottom-.6],[-4,bottom-2.2]],p.base),line([[-2.6,-.4],[-2.4,bottom-1.5]],p.light,.45));
    if(style==='locs') for(let x=-3;x<=3;x+=1.5) front.push(line([[x,-2],[x+.3,9]],p.shadow,.75));
  }
  const bun=(x:number,y:number,r:number)=> {
    front.push(fill(cluster(x,y,r,8),p.shadow),fill(cluster(x-.25,y-.2,r*.8,7),p.base),line([[x-r*.55,y],[x-r*.25,y-r*.5],[x+r*.35,y-r*.45]],p.light,.6));
    front.push(line([[x-r*.7,y+r*.7],[x+r*.6,y+r*.72]],'#bca073',.6));
  };
  if(style==='bun'||style==='halfup') bun(style==='halfup'?-.5:0,style==='halfup'?-4.8:-6.4,style==='halfup'?2:2.6);
  if(style==='doublebun') {bun(-4.1,-4.3,2.2);bun(4.1,-4.3,2.2);}
  if(style==='topknot') bun(.3,-6.7,1.8);
  if(style==='lowbun'&&back) bun(0,3,2.5);
  if(style==='ponytail'&&back) front.push(fill([[-1.8,-1.5],[1.5,-1.5],[2.5,2],[1.8,7.7],[.3,10.5],[-1.2,8],[-1.6,2]],p.base),line([[-.4,1],[.7,4],[.3,8.5]],p.light,.7));
  const braid=(x:number,start:number,count:number)=> {
    for(let i=0;i<count;i++) {const y=start+i*1.55;front.push(fill([[x-1.05,y],[x+.1,y-.4],[x+1.15,y+.5],[x+.1,y+1.9],[x-1,y+1.15]],i%2?p.shadow:p.base),line([[x-.6,y+.3],[x+.35,y+1]],p.light,.4));}
    front.push(line([[x-.75,start+count*1.55],[x+.8,start+count*1.55]],'#c6ad76',.7));
  };
  if(style==='braid') braid(back?0:3.7,2.2,5);
  if(style==='twinbraids') {braid(-3.5,2,5);braid(3.5,2,5);}
  return {rear,front};
}
