import type { AppearancePalette, CharacterAppearance } from './appearance-content.ts';
import { mixColor, type Point } from './art-primitives.ts';
import type { GearShape } from './weapon-shapes.ts';
const fill=(points:readonly Point[],color:string):GearShape=>({points,fill:color});
const line=(points:readonly Point[],color:string,width=.55):GearShape=>({points,stroke:color,width});

export function facialHairShapes(style:CharacterAppearance['facialHair'], hair:AppearancePalette, skin:AppearancePalette, look:number):GearShape[] {
  const shapes:GearShape[]=[];
  const f=(p:readonly Point[],c:string)=>shapes.push(fill(p.map(([x,y])=>[x+look,y]),c));
  const l=(p:readonly Point[],c:string,w=.45)=>shapes.push(line(p.map(([x,y])=>[x+look,y]),c,w));
  if(['stubble','beard','fullbeard','chinbraid'].includes(style)) {
    const bottom=style==='stubble'?4.9:style==='fullbeard'?8.1:6.2;
    f([[-2.7,2.1],[-1.5,3.3],[.1,3.7],[1.6,3.2],[2.8,1.9],[2.5,4.2],[.5,bottom],[-1.5,bottom-.7],[-2.6,3.5]],style==='stubble'?mixColor(skin.base,hair.shadow,.42):hair.base);
    if(style!=='stubble') {f([[.5,4.1],[2.4,3.5],[1.7,bottom-.5],[.5,bottom],[-.3,bottom-.6]],hair.shadow);l([[-1.7,3.8],[-1,5],[0,bottom-.8]],hair.light);}
    if(style==='fullbeard') {l([[.4,4.8],[.2,6.5]],hair.light,.35);l([[-2.1,3.3],[-1.7,5.4]],hair.shadow,.4);}
  }
  if(style==='goatee') {f([[-1.2,3.7],[.6,3.9],[1.4,3.6],[1,5.9],[0,6.7],[-1.1,5.5]],hair.base);l([[-.5,4.3],[-.3,5.8]],hair.light);}
  if(style!=='none'&&style!=='stubble') {
    f([[.1,2.6],[.8,2.7],[1.8,3.5],[.8,3.3],[0,3.1],[-1,3.4],[-1.8,3.3],[-.8,2.7]],hair.base);
  }
  if(style==='handlebar') {
    l([[-.7,3],[-1.6,3.5],[-2.5,3.1],[-2.6,2.5]],hair.base,.8);
    l([[.7,3],[1.5,3.5],[2.4,3.1],[2.6,2.5]],hair.base,.8);
    l([[-1.6,3.4],[-2.3,3.1]],hair.light,.3);l([[1.5,3.4],[2.2,3.1]],hair.light,.3);
  }
  if(style==='chinbraid') {
    for(let i=0;i<3;i++){const y=5.5+i*1.1;f([[-.8,y],[0,y-.25],[.85,y+.4],[0,y+1.3],[-.75,y+.75]],i%2?hair.shadow:hair.base);l([[-.5,y+.2],[.4,y+.7]],hair.light,.3);}
    l([[-.55,8.85],[.65,8.85]],'#c6ad76',.6);
  }
  return shapes;
}

/** Shared eye anchor: the patch and both strap ends move with the eye, not the forehead. */
export function eyePatchAnchor(facing:number):Point {return [-1.6+Math.cos(facing)*.8,1.25];}
export function faceAccessoryShapes(style:CharacterAppearance['accessory'], facing:number, covered:boolean):GearShape[] {
  const shapes:GearShape[]=[], side=Math.cos(facing), look=side*.8, back=Math.sin(facing)<-.16;
  const f=(p:readonly Point[],c:string)=>shapes.push(fill(p,c)), l=(p:readonly Point[],c:string,w=.55)=>shapes.push(line(p,c,w));
  const earSides=back?[-1,1]:Math.abs(side)>.65?[side>0?1:-1]:[-1,1];
  if(!covered&&['hoop','studs','earcuff'].includes(style)) for(const s of earSides) {
    const x=s*3.5;
    if(style==='hoop') {l([[x,1.5],[x+s*.65,1.9],[x+s*.9,2.9],[x+s*.55,3.7],[x-s*.1,3.5],[x-s*.35,2.6],[x,1.5]],'#d5b478',.55);l([[x+s*.6,2],[x+s*.85,2.8]],'#f0d9a4',.3);}
    if(style==='studs') f([[x,1.1],[x+.5,1.65],[x,2.2],[x-.5,1.65]],'#d2dbda');
    if(style==='earcuff') {l([[x-s*.3,.4],[x+s*.5,.7],[x+s*.55,1.6],[x-s*.15,1.9]],'#c9d5d7',.65);l([[x-s*.2,1],[x+s*.55,1.2]],'#74939b',.35);}
  }
  if(back) {if(style==='eyepatch') l([[-3.6,.8],[0,1.5],[3.6,.8]],'#323035',.65);return shapes;}
  if(!covered&&style==='circlet') {
    l([[-3.7,-.9],[-1.8,-.6],[look,-.2],[2.1,-.6],[3.7,-1.2]],'#839ca2',1);
    l([[-3.7,-1.1],[look,-.5],[3.7,-1.4]],'#d5dcca',.4);
    f([[look,-1.1],[look+.65,-.2],[look,.8],[look-.65,-.2]],'#abd2d5');
  }
  if(style==='eyepatch') {
    const [x,y]=eyePatchAnchor(facing), half=.8-Math.max(0,-side)*.2;
    // Both segments terminate on the patch rim. Far-eye perspective follows the eye drawing.
    l([[-3.5,.5],[x-half,y-.15]],'#303038',.6);
    l([[x+half,y-.15],[1.1+look,-.15],[3.5,-.8]],'#303038',.6);
    f([[x-half,y-.65],[x+half,y-.65],[x+half*.9,y+.55],[x+.1,y+.95],[x-half*.85,y+.6]],'#222a2f');
    l([[x-half*.7,y-.4],[x+half*.6,y-.4]],'#697c7c',.3);
  }
  if(style==='spectacles') {
    for(const s of [-1,1]) {const x=s*1.6+look, rx=.98-Math.max(0,side*s)*.25;
      const rim:Point[]=[[x-rx,.75],[x-rx*.65,.25],[x+rx*.6,.25],[x+rx,.8],[x+rx,1.7],[x+rx*.6,2.2],[x-rx*.6,2.2],[x-rx,1.7],[x-rx,.75]];
      l(rim,'#343c3d',.8);l(rim,'#d3bc86',.35);}
    l([[-.6+look,1],[.6+look,1]],'#343c3d',.8);l([[-.6+look,1],[.6+look,1]],'#d3bc86',.35);l([[-3.6,.4],[-2.7+look,.9]],'#7b725f',.45);l([[2.6+look,.9],[3.7,.4]],'#7b725f',.45);
  }
  if(style==='nosering') {const x=look+.45;l([[x,2.15],[x+.55,2.25],[x+.65,2.8],[x+.25,3.05],[x-.2,2.75]],'#e0c38b',.3);}
  return shapes;
}
