import { type BiomeId, type BiomeWeights } from './biomes.ts';
import { propDefinition, type PropKind } from './biome-props.ts';

function hash(x:number,y:number,seed:number):number {
  let h=seed^Math.imul(x|0,73856093)^Math.imul(y|0,19349663);
  h=Math.imul(h^h>>>16,0x7feb352d);h=Math.imul(h^h>>>15,0x846ca68b);return ((h^h>>>16)>>>0)/4294967296;
}
const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function landscapeNoise(x:number,y:number,seed:number):number {
  const ix=Math.floor(x),iy=Math.floor(y),tx=smooth(0,1,x-ix),ty=smooth(0,1,y-iy);
  return (hash(ix,iy,seed)*(1-tx)+hash(ix+1,iy,seed)*tx)*(1-ty)+(hash(ix,iy+1,seed)*(1-tx)+hash(ix+1,iy+1,seed)*tx)*ty;
}
export function landscapeFields(x:number,y:number,seed:number) {
  const warp=(landscapeNoise(x/1600,y/1600,seed+5)-.5)*330;
  const grove=smooth(.34,.68,landscapeNoise((x+warp)/620,(y-warp)/620,seed+37));
  // Narrow continuous low-density seams link clearings without painted trails.
  const corridor=1-smooth(.025,.105,Math.abs(landscapeNoise(x/1050,y/1050,seed+719)-.5));
  const rock=smooth(.53,.79,landscapeNoise((x-warp)/470,(y+warp)/470,seed+91));
  return {grove:grove*(1-corridor*.92),rock:rock*(1-corridor*.95),corridor};
}
const TREE_DENSITY:Record<BiomeId,number>={deadwood:.9,verdant:1.1,swamp:.8,frostpine:.95,emberfall:.7,autumn:1,highlands:.24,steppe:.2,sunscar:0};
const ROCKS=new Set<PropKind>(['rock','limestone','basalt','emberRock','iceCrystal','sandstone','sandstoneShard','steppeStone']);
/** Shared seeded distribution used by gameplay, terrain workers and map studies. */
export function landscapePropProbability(x:number,y:number,seed:number,kind:PropKind,biome:BiomeId):number {
    const {grove,rock,corridor}=landscapeFields(x,y,seed);
    if(propDefinition(kind).canopy||kind==='stump') return Math.min(.95,(.15+grove*1.2)*TREE_DENSITY[biome]);
    if(ROCKS.has(kind)) return (.025+rock*.9)*(1-corridor*.8);
    if(kind==='thornBrush')return .05+grove*.45;
    if(kind==='desertScrub')return .08+grove*.24;
    if(kind==='dryGrass')return biome==='sunscar'?.12:.52+grove*.35;
    return .4+grove*.45;
}
export function landscapeRelief(x:number,y:number,seed:number,w:BiomeWeights):number {
    if(w.sunscar+w.steppe<.001)return 0;
    const warp=(landscapeNoise(x/1400,y/1400,seed+445)-.5)*300;
    const phase=(x*.38+y+warp)/150;
    const dune=Math.sin(phase)+Math.sin(phase*.48+1)*.32;
    const light=Math.cos(phase)*10 + Math.pow(Math.max(0,dune),3)*8;
    const meadow=(landscapeNoise(x/410,y/410,seed+37)-.5)*18;
    return w.sunscar*light+w.steppe*meadow;
}
