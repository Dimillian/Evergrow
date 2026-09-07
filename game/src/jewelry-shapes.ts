import { JEWELRY_PROFILES } from './jewelry-content.ts';
import type { Item } from './character-types.ts';
import { mixColor, type Point } from './art-primitives.ts';
import { TIER_COLORS } from './items.ts';
import { gearSurface, materializeGear } from './gear-material.ts';
import type { GearShape } from './weapon-shapes.ts';

/** Shared settings, bevels and gem facets for icons and physical drops. */
export function jewelryShapes(item: Item): GearShape[] {
  const {base:trim,shadow,edge}=item.appearance, shapes:GearShape[]=[];
  const poly=(points:Point[],fill:string,material:'brass'|'gem'='brass',normal:readonly[number,number,number]=[-.3,-.4,.86])=>shapes.push({points,fill,surface:{...gearSurface(material==='brass'?(item.appearance.surface??'brass'):material,item.seed,normal),facet:true}});
  const ring=item.kind==='ring';
  if(ring) {
    for(let i=0;i<16;i++) {
      const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
      const p=(angle:number,r:number):Point=>[Math.cos(angle)*r,2+Math.sin(angle)*r*1.12];
      poly([p(a,6.5),p(b,6.5),p(b,4.95),p(a,4.95)],trim,'brass',[Math.cos((a+b)/2)*.6,Math.sin((a+b)/2)*.6,.8]);
      poly([p(a,6.5),p(b,6.5),p(b,6.14),p(a,6.14)],mixColor(trim,edge,.38),'brass',[Math.cos((a+b)/2)*.4,Math.sin((a+b)/2)*.4,.9]);
      poly([p(a,5.25),p(b,5.25),p(b,4.95),p(a,4.95)],mixColor(trim,shadow,.3),'brass',[-Math.cos((a+b)/2)*.6,-Math.sin((a+b)/2)*.6,.7]);
      shapes.push({points:[p(a,4.85),p(b,4.85)],stroke:shadow,width:.28});
    }
  } else {
    const chain:Point[]=Array.from({length:25},(_,i)=>{const a=i*Math.PI/24;return[Math.cos(a)*6.1,Math.sin(a)*6-10];});
    shapes.push({points:chain,stroke:shadow,width:.95},{points:chain,stroke:trim,width:.55});
    poly([[-.65,-5],[.65,-5],[1,-2],[-1,-2]],trim);
  }
  const cy=ring?-5.3:2.5,rx=ring?3.9:4.9,ry=ring?3.7:6.1;
  const rim=Array.from({length:8},(_,i):Point=>[Math.cos(i*Math.PI/4)*rx,cy+Math.sin(i*Math.PI/4)*ry]);
  poly(rim.map(([x,y]):Point=>[x*1.11,cy+(y-cy)*1.11+.3]),shadow);
  poly(rim,trim);
  const gem=rim.map(([x,y]):Point=>[x*.77,cy+(y-cy)*.77]);
  const inner=gem.map(([x,y]):Point=>[x*.46-.15,cy+(y-cy)*.42-.35]);
  const color=JEWELRY_PROFILES.find(p=>p.id===item.recipe.profileId)?.color??TIER_COLORS[item.tier];
  for(let i=0;i<8;i++) {
    const n=(i+1)%8,a=(i+.5)*Math.PI/4;
    poly([gem[i],gem[n],inner[n],inner[i]],mixColor(color,i<4?shadow:edge,i<4?.42:.23),'gem',[Math.cos(a)*.75,Math.sin(a)*.75,.65]);
  }
  poly(inner,mixColor(color,edge,.22),'gem');
  shapes.push({points:[gem[5],gem[6],gem[7]],stroke:edge,width:.16});
  for(const i of [0,2,4,6]) {
    const [x,y]=rim[i],[gx,gy]=gem[i];
    shapes.push({points:[[x,y],[gx,gy]],stroke:trim,width:.55},{points:[[x-.06,y-.12],[gx-.06,gy-.12]],stroke:edge,width:.16});
  }
  return materializeGear(shapes,item.appearance.surface??'brass',item.seed);
}
