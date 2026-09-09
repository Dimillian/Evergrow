import { charmProfile } from './charm-content.ts';
import type { Item } from './character-types.ts';
import type { GearShape } from './weapon-shapes.ts';
import { mixColor, type Point } from './art-primitives.ts';

/** Cut stone, inset facets and glowing carved marks, shared by bag icons and ground art. */
export function charmShapes(item: Item): GearShape[] {
  const profile=charmProfile(item); if(!profile)return [];
  const {size,flavor}=profile, w=7*size.width,h=8*size.height;
  const count=size.id==='pebble'?9:size.id==='tablet'?6:7;
  const rim:Point[]=Array.from({length:count},(_,i)=>{
    const angle=-Math.PI/2+i*Math.PI*2/count;
    const jitter=.86+(((item.seed>>>((i*3)%24))&7)/7)*.14;
    return [Math.cos(angle)*w*jitter,Math.sin(angle)*h*jitter];
  });
  const face=rim.map(([x,y]):Point=>[x*.73,y*.79]);
  const shapes:GearShape[]=[{points:rim,fill:item.appearance.shadow,stroke:mixColor(flavor.base,flavor.edge,.3),width:.45}];
  for(let i=0;i<count;i++){
    const j=(i+1)%count;
    shapes.push({points:[rim[i],rim[j],face[j],face[i]],fill:mixColor(flavor.base,i<count/2?item.appearance.shadow:flavor.edge,i<count/2?.4:.32)});
  }
  shapes.push({points:face,fill:flavor.base});
  shapes.push({points:[face[0],face[1],[w*.12,h*.25],face[count-1]],fill:mixColor(flavor.base,flavor.edge,.16)});
  // A luminous vein passes through the rock, with a different central rune for each flavor.
  const vein:Point[]=[[-w*.12,-h*.73],[w*.13,-h*.36],[-w*.08,h*.08],[w*.18,h*.62]];
  shapes.push({points:vein,stroke:mixColor(flavor.base,flavor.glow,.4),width:1.2},{points:vein,stroke:flavor.glow,width:.3});
  const r=Math.min(w*.42,h*.35), motifs:Record<string,Point[]>={
    ember:[[0,-r],[-r*.6,r*.7],[r*.65,r*.7],[0,-r]],
    rime:[[0,-r],[0,r],[0,0],[-r,0],[r,0]],
    storm:[[-r*.2,-r],[r*.55,-r*.1],[-r*.45,r*.2],[r*.15,r]],
    astral:[[0,-r],[r,0],[0,r],[-r,0],[0,-r]],
    jade:[[-r,-r*.6],[0,r],[r,-r*.6],[0,0],[-r,-r*.6]],
    amber:[[-r,-r],[r,-r],[r,r],[-r,r],[-r,-r],[r,r]],
  };
  shapes.push({points:motifs[flavor.id],stroke:item.appearance.shadow,width:1.8},{points:motifs[flavor.id],stroke:flavor.glow,width:.65});
  for(let i=0;i<Math.min(4,size.affixes);i++) {
    const x=-w*.4+i*w*.26,y=h*.53;
    shapes.push({points:[[x-.3,y],[x,y-.5],[x+.3,y],[x,y+.5]],fill:flavor.edge});
  }
  return shapes;
}
