import test from 'node:test';
import assert from 'node:assert/strict';
import { RiftAtmosphereArt, RIFT_ATMOSPHERE, riftLightning } from '../src/rift-atmosphere-art.ts';
import { BIOME_IDS, type BiomeId } from '../src/biomes.ts';
import type { World } from '../src/world.ts';
import type { RiftProgress } from '../src/rift-content.ts';

const view={left:600,top:500,width:1100,height:900};
const state:RiftProgress={elapsed:12,points:500,phase:'hunt',claimed:false};
function world(biome:BiomeId='verdant'){
  let queries=0;
  return {get queries(){return queries;},value:{seed:7350,riftShape:{distance(x:number){queries++;return Math.sin(x/700)*110;}},
    sampleWater:()=>({coverage:0}),sampleBiome:()=>({id:biome})} as unknown as World};
}
class Context {
  globalAlpha=1;globalCompositeOperation='source-over';lineWidth=1;lineCap='butt';lineJoin='miter';fillStyle='';strokeStyle='';
  commands:unknown[]=[];depth=0;
  save(){this.depth++;} restore(){this.depth--;assert.ok(this.depth>=0);}
  point(...n:number[]){assert.ok(n.every(Number.isFinite));this.commands.push(n);}
  beginPath(){} closePath(){} moveTo(...n:number[]){this.point(...n);} lineTo(...n:number[]){this.point(...n);}
  translate(...n:number[]){this.point(...n);} quadraticCurveTo(...n:number[]){this.point(...n);} ellipse(...n:number[]){this.point(...n);}
  fill(){this.commands.push([this.fillStyle,this.globalAlpha]);} stroke(){this.commands.push([this.strokeStyle,this.globalAlpha,this.lineWidth]);}
}
test('rift detail candidates stay at clearing edges, cache by world cell and bound extreme views',()=>{
  const w=world(),art=new RiftAtmosphereArt();art.prepare(w.value,view,state,false);
  assert.ok(art.visible.length>0);const queries=w.queries,scars=structuredClone(art.visible);
  for(const p of art.visible){const d=Math.sin(p.x/700)*110;assert.ok(d>=-65&&d<=100);assert.ok(Math.hypot(p.x,p.y)>=420);}
  art.prepare(w.value,view,{...state,elapsed:300},false);assert.equal(w.queries,queries);assert.deepEqual(art.visible,scars);
  const huge={left:-1e6,top:-1e6,width:2e6,height:2e6};art.prepare(w.value,huge,state,false);
  const after=w.queries;art.prepare(w.value,huge,state,false);assert.equal(w.queries,after,'no cache churn in oversized views');
  assert.ok(art.cacheSize<=RIFT_ATMOSPHERE.cache);assert.ok(art.visible.length<=RIFT_ATMOSPHERE.visible);
  art.prepare(w.value,view,undefined,false);assert.equal(art.visible.length,0);assert.equal(art.cacheSize,0);
});
test('every biome paints finite geometry and reduced motion freezes all decorative animation',()=>{
  for(const biome of BIOME_IDS){
    const art=new RiftAtmosphereArt(),w=world(biome);
    const draw=(time:number)=>{
      art.prepare(w.value,view,{...state,elapsed:time},true);const c=new Context(),ctx=c as unknown as CanvasRenderingContext2D;
      art.drawGround(ctx);for(const scar of art.visible)if(scar.float)art.drawFragment(ctx,scar);art.drawEmission(ctx,view);
      assert.equal(c.depth,0);return c.commands;
    };
    const first=draw(10);assert.ok(first.length>0);assert.deepEqual(draw(150),first,biome);
  }
});
test('guardian approach increases admitted lightning windows without flashing or changing event phase',()=>{
  let early=0,late=0;
  for(let i=0;i<36000;i++){
    const a=riftLightning(7350,i/10,0,false),b=riftLightning(7350,i/10,1,false);
    assert.ok(a>=0&&b>=0&&a<=1&&b<=1);
    if(a){early++;assert.equal(a,b,'existing event timing does not jump with progress');}if(b)late++;
    assert.equal(riftLightning(7350,i/10,1,true),0);
  }
  assert.ok(early>0&&late>early*3);
});
