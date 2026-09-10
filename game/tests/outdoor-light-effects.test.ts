import test from 'node:test';
import assert from 'node:assert/strict';
import { outdoorLightCell, OUTDOOR_LIGHT_RULES, type OutdoorLightWorld } from '../src/outdoor-light-content.ts';
import { OutdoorLightEffects } from '../src/outdoor-light-effects.ts';
import { skyAtHour } from '../src/world-time.ts';
import { BIOME_IDS, type BiomeWeights } from '../src/biomes.ts';
import { cameraView } from '../src/camera.ts';
import type { World } from '../src/world.ts';

const weights = (verdant:number,swamp:number):BiomeWeights=>Object.fromEntries(BIOME_IDS.map(id=>[id,id==='verdant'?verdant:id==='swamp'?swamp:id==='deadwood'?1-verdant-swamp:0])) as BiomeWeights;
function ground(w:BiomeWeights,indoors=false,simulatedWater=false):OutdoorLightWorld {
  return {seed:7319,sampleBiome:()=>({id:'swamp',name:'Test',weights:w}),sampleGroundContact:()=>({weights:w,indoors,simulatedWater,water:.8,natural:1})};
}
test('outdoor metadata blends climates, keeps interiors dry and does not duplicate simulated water highlights',()=>{
  const a=outdoorLightCell(ground(weights(1,0)),123,-500),b=outdoorLightCell(ground(weights(0,1)),123,-500),mixed=outdoorLightCell(ground(weights(.5,.5)),123,-500);
  assert.deepEqual(a.slice(0,2),[255,0]);assert.deepEqual(b.slice(0,2),[0,255]);assert.deepEqual(mixed.slice(0,2),[128,128]);
  assert.equal(outdoorLightCell(ground(weights(0,1),true),123,-500)[2],0);
  assert.equal(outdoorLightCell(ground(weights(0,1),true),123,-500)[3],0);
  assert.equal(outdoorLightCell(ground(weights(0,1),false,true),123,-500)[2],0);
  assert.equal(outdoorLightCell(ground(weights(0,1),false,true),123,-500)[3],255,'water still receives atmospheric light');
  for(const id of BIOME_IDS){const w=Object.fromEntries(BIOME_IDS.map(b=>[b,b===id?1:0])) as BiomeWeights;const cell=outdoorLightCell(ground(w),123,-500);assert.equal(cell.length,12);assert.equal(cell[3],255);assert(cell.slice(0,2).concat(cell.slice(4,11)).some(v=>v===255),id);}
  for(let x=-1000;x<1000;x+=53){const cell=outdoorLightCell(ground(weights(.3,.7)),x,-x);assert(cell.every(v=>Number.isInteger(v)&&v>=0&&v<=255));assert.deepEqual(cell,outdoorLightCell(ground(weights(.3,.7)),x,-x));}
});

test('outdoor light caches geographic samples, bounds buffers, throttles canopy uploads and restores contexts',t=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else Reflect.deleteProperty(globalThis,'document');});
  let unit=0,contexts=0,samples=0;const uploads:number[]=[],uniforms:Record<string,number>={},handlers=new Map<string,(event:{preventDefault():void})=>void>();
  const gl=new Proxy({TEXTURE0:100,TEXTURE1:101,createShader:()=>({}),createProgram:()=>({}),createTexture:()=>({}),createBuffer:()=>({}),
    getShaderParameter:()=>true,getProgramParameter:()=>true,isContextLost:()=>false,getUniformLocation:(_:unknown,n:string)=>n,
    activeTexture:(n:number)=>{unit=n-100;},uniform1f:(n:string,v:number)=>{uniforms[n]=v;},texImage2D:()=>uploads.push(unit),texSubImage2D:()=>uploads.push(unit),
  },{get:(o,k)=>k in o?Reflect.get(o,k):()=>{}});
  const context=new Proxy({},{get:()=>()=>{}}),canvases:{width:number;height:number}[]=[];
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>{
    const canvas={width:1,height:1,getContext:(type:string)=>{if(type==='2d')return context;contexts++;return gl;},addEventListener:(n:string,c:(e:{preventDefault():void})=>void)=>handlers.set(n,c)};canvases.push(canvas);return canvas;
  }}});
  const effects=new OutdoorLightEffects(),view=cameraView(1600,1100,0,0,1),props:never[]=[];
  const base=ground(weights(.4,.6)),world={...base,sampleGroundContact:(x:number,y:number)=>{samples++;return base.sampleGroundContact(x,y);}} as World;
  const sprite=()=>{throw Error('No props in fixture');};
  const prepare=(time:number,reduced=false,v=view,w=world)=>effects.prepare(w,v,props,sprite,[],time,reduced,0,1600,1100);
  assert.equal(effects.prepare(world,view,props,sprite,[],0,false,1,1600,1100),false);assert.equal(contexts,0,'fully enclosed scenes allocate no context');
  assert(prepare(0));assert.deepEqual(uploads,[0,2,3,1]);assert.equal(canvases[0].width,OUTDOOR_LIGHT_RULES.maxAxis);const initialSamples=samples;
  uploads.length=0;prepare(.02);assert.deepEqual(uploads,[]);assert.equal(samples,initialSamples);
  prepare(.11);assert.deepEqual(uploads,[1],'only canopy coverage changes with wind');
  uploads.length=0;prepare(8,true);assert.equal(uniforms.time,0);uploads.length=0;prepare(10,true);assert.deepEqual(uploads,[],'reduced motion freezes wind coverage');
  uploads.length=0;prepare(10,true,{...view,left:view.left+96});assert.equal(uploads[0],0);assert(samples>initialSamples);assert(samples<initialSamples*1.3,'streaming reuses overlapping ground cells');
  handlers.get('webglcontextlost')!({preventDefault(){}});assert.equal(prepare(0),false);handlers.get('webglcontextrestored')!({preventDefault(){}});uploads.length=0;assert(prepare(0));assert.deepEqual(uploads,[0,2,3,1]);
  uploads.length=0;effects.prepare(world,view,props,sprite,[],0,true,0,1600,1100,skyAtHour(18));assert.deepEqual(uploads,[1],'changing sun direction refreshes only canopy projection');
  effects.reset();uploads.length=0;assert(prepare(0));assert.deepEqual(uploads,[0,2,3,1]);
});
