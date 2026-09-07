import type { ArmorPiece } from './art-types.ts';
import { mixColor, type Point } from './art-primitives.ts';
import { gearSurface, materializeGear } from './gear-material.ts';
import type { GearShape } from './weapon-shapes.ts';

export type ArmorAccessory = 'bracer'|'glove'|'thigh'|'knee'|'cloak';
const cache = new WeakMap<ArmorPiece, Map<ArmorAccessory,readonly GearShape[]>>();
/** Shared rigid panels. Articulated mounts and cloth motion remain renderer-owned. */
export function armorAccessoryShapes(kind:ArmorAccessory,piece:ArmorPiece):readonly GearShape[] {
  let variants=cache.get(piece);if(!variants){variants=new Map();cache.set(piece,variants);}
  const cached=variants.get(kind);if(cached)return cached;
  const m=piece.material,plate=piece.style==='plate',material=kind==='cloak'?'cloth':m.surface??(plate?'steel':'leather');
  const shapes:GearShape[]=[],binding=mixColor(m.trim,m.base,plate?.15:.55);
  const face=(points:Point[],fill:string,normal:readonly [number,number,number]=[-.2,-.3,.93])=>shapes.push({points,fill,surface:gearSurface(material,piece.seed+shapes.length*13,normal)});
  const seam=(points:Point[],stroke:string,width=.25,fine=false)=>shapes.push({points,stroke,width,fine});
  if(kind==='bracer'||kind==='thigh') {
    const w=kind==='thigh'?2:1.65,h=kind==='thigh'?7:6;
    face([[-w,0],[w,0],[w*.8,h-.7],[0,h],[-w*.8,h-.7]],m.shadow);
    face([[-w*.8,.35],[0,.1],[w*.7,.35],[w*.53,h-1],[0,h-.45],[-w*.7,h-1]],m.base);
    face([[-w*.8,.35],[-.3,.2],[-.45,h-1],[-w*.7,h-1]],mixColor(m.base,m.edge,.22),[-.6,-.1,.8]);
    face([[.3,.25],[w*.7,.35],[w*.53,h-1],[.3,h-.6]],mixColor(m.base,m.shadow,.2),[.55,.1,.82]);
    seam([[-w*.8,.6],[w*.65,.6]],binding,.32);
    if(plate){seam([[-w*.65,h-1.2],[0,h-.8],[w*.53,h-1.2]],m.edge,.24);seam([[0,.5],[0,h-1]],m.edge,.18,true);}
    else for(let y=1.4;y<h-1;y+=1)seam([[-w*.58,y],[-w*.42,y+.22]],binding,.12,true);
    seam([[-w*.8,h-2.1],[w*.63,h-2.1]],binding,.4);
  } else if(kind==='glove') {
    face([[-1.6,-1.65],[.7,-1.9],[1.5,-1.1],[1.4,.6],[.8,1.65],[-1.5,1.4],[-1.9,.3]],m.shadow);
    face([[-1.3,-1.35],[.5,-1.6],[1.15,-.8],[.8,.9],[-1.4,.85]],m.base);
    face([[-1.3,-1.35],[-.45,-1.5],[-.5,.6],[-1.4,.85]],mixColor(m.base,m.edge,.18),[-.55,-.25,.8]);
    seam([[-1.3,-1.25],[.3,-1.45],[1,-.85]],plate?m.edge:binding,.25);
    for(let finger=0;finger<3;finger++){const x=-1+finger*.62;seam([[x,.65],[x+.08,1.22]],m.shadow,.14);}
    face([[1,-.95],[1.75,-.6],[1.75,.3],[1.3,.8],[.9,.35]],m.base,[.45,-.1,.89]);
    if(plate) for(let i=0;i<3;i++){const x=-1.1+i*.65;face([[x,-.2],[x+.45,-.3],[x+.55,.4],[x,.45]],m.base,[0,-.6,.8]);}
    else {seam([[-1,-.7],[.6,-.9]],binding,.15,true);seam([[-.9,-.45],[-.6,.55]],m.shadow,.16);}
  } else if(kind==='knee') {
    face([[-2,-1.8],[1.9,-1.4],[2,.7],[0,1.7],[-1.9,.3]],m.shadow);
    face([[-1.6,-1.3],[0,-1.65],[1.5,-1.1],[1.5,.4],[0,1.1],[-1.5,.15]],m.base);
    face([[-1.6,-1.3],[0,-1.65],[-.15,.15],[-1.5,.15]],mixColor(m.base,m.edge,.25),[-.6,-.3,.74]);
    seam([[-1.5,-1.2],[0,-1.5],[1.4,-1]],plate?m.edge:binding,.23);
  } else {
    face([[-4,-8],[0,-10],[4,-8],[5,-2],[9,9],[3,8],[0,10],[-4,8],[-9,10],[-5,-2]],m.shadow);
    face([[-3,-7],[0,-9],[3,-7],[3,-1],[6,8],[0,7],[-6,8],[-3,-1]],m.base);
    face([[-3,-7],[-1,-8],[-1.5,5],[-5,7]],mixColor(m.base,m.edge,.2),[-.5,-.1,.86]);
    face([[1,-8],[3,-7],[3,-1],[6,8],[2.5,6.7]],mixColor(m.base,m.shadow,.27),[.5,.1,.86]);
    face([[-.7,-6],[.6,-6],[1.1,7],[0,8],[-1.3,7]],mixColor(m.base,m.shadow,.23));
    seam([[-6,8],[0,7],[6,8]],binding,.3);
    seam([[-3,-6],[0,-4],[3,-6]],binding,.4);
    shapes.push({points:[[-.6,-4.4],[0,-5.2],[.6,-4.4],[0,-3.7]],fill:m.trim,surface:gearSurface('brass',3)});
    for(let i=0;i<7;i++)seam([[-5+i*1.5,7.8],[-4.8+i*1.5,8]],binding,.1,true);
  }
  const result=materializeGear(shapes,material,piece.seed);variants.set(kind,result);return result;
}
