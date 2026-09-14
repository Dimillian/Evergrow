import test from 'node:test';
import assert from 'node:assert/strict';
import { riftDiscoverySampler } from '../src/rift-map-art.ts';
const rooms=Array.from({length:9},(_,id)=>({id,x:id%3*640,y:Math.floor(id/3)*640,width:640,height:640}));
test('rift fog feathers only the unknown frontier, never internal sector borders',()=>{
 const alpha=riftDiscoverySampler(rooms,new Set([3,4]));
 assert.equal(alpha(640,960),1,'no seam between adjacent discovered sectors');
 assert.equal(alpha(960,960),1);
 assert.equal(alpha(1280,960),0,'unknown sector remains hidden');
 assert.equal(alpha(1300,960),0);
 assert.ok(alpha(1270,960)>0&&alpha(1270,960)<.02);
 assert.ok(alpha(1200,960)>alpha(1270,960));
 assert.equal(alpha(100,10),0);
});
test('discovery is monotonic and the outside of the finite rift stays hidden',()=>{
 const before=riftDiscoverySampler(rooms,new Set([4])),after=riftDiscoverySampler(rooms,new Set([3,4,5]));
 for(let x=0;x<1920;x+=17)assert.ok(after(x,960)>=before(x,960));
 const all=riftDiscoverySampler(rooms,new Set(rooms.map(r=>r.id)));
 assert.equal(all(-1,960),0);assert.equal(all(1920,960),0);
 assert.ok(all(1,960)<.001);assert.equal(all(640,640),1);
});

test('rift terrain draws adjacent non-overlapping destinations and caches fog between frames',async t=>{
 const {drawRiftMapTerrain}=await import('../src/rift-map-art.ts');
 const {generateDungeon}=await import('../src/dungeon.ts');
 let masks=0;
 const makeCanvas=()=>{
  const canvas={width:0,height:0,getContext:()=>context};
  const context={fillStyle:'',fillRect(){},clearRect(){},drawImage(){},
   getImageData:(_x:number,_y:number,w:number,h:number)=>{masks++;return {data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};
  return canvas;
 };
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:makeCanvas}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');});
 const tag={attempt:1},floor=generateDungeon(7319,25,{biome:'verdant',rift:tag});
 const seen=new Set(floor.rooms.map(r=>r.id)),draws:number[][]=[];
 const c={save(){},restore(){},imageSmoothingEnabled:false,drawImage(_image:unknown,...args:number[]){draws.push(args);}};
 drawRiftMapTerrain(c as unknown as CanvasRenderingContext2D,floor,seen,{x:0,y:0,width:1023,height:511});
 assert.equal(draws.length,2);assert.deepEqual(draws.map(d=>d.slice(4)),[[0,0,512,512],[512,0,512,512]]);
 const first=masks;
 drawRiftMapTerrain(c as unknown as CanvasRenderingContext2D,floor,seen,{x:0,y:0,width:1023,height:511});
 assert.equal(masks,first,'stationary map does not rebuild fog or read pixels every frame');
});
