import test from 'node:test';
import assert from 'node:assert/strict';
import { EnemyOutlineArt, outlineDensity } from '../src/enemy-outline-art.ts';

test('rank outline surfaces follow displayed density and submit one image without blurring the world', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis,'document');
  t.after(()=>descriptor?Object.defineProperty(globalThis,'document',descriptor):Reflect.deleteProperty(globalThis,'document'));
  const canvases: Array<{width:number;height:number}> = [];
  const context = () => new Proxy({globalAlpha:1,save(){},restore(){},drawImage(){},clearRect(){},scale(){},translate(){},fillRect(){}}, {
    get:(o,k)=>Reflect.get(o,k),set:(o,k,v)=>Reflect.set(o,k,v),
  });
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>{
    const c=context(),canvas={width:0,height:0,getContext:()=>c};canvases.push(canvas);return canvas;
  }}});
  let scale=.8,paints=0;const images:unknown[][]=[];
  const destination={getTransform:()=>({a:scale,b:0}),drawImage:(...args:unknown[])=>images.push(args)} as unknown as CanvasRenderingContext2D;
  // Destination intentionally has no shadow/state methods: only one precomposed
  // image may touch the accumulated scene, independent of rank or creature count.
  const art=new EnemyOutlineArt(),paint=()=>{paints++;};
  art.draw(destination,'hound','#e9bb70',paint);
  const geometry=images[0].slice(1),firstArea=canvases[0].width*canvases[0].height;
  assert.equal(images.length,1);assert.equal(paints,1);assert.equal(canvases.length,3);
  for(let i=0;i<80;i++)art.draw(destination,'hound','#85c9ee',paint);
  assert.equal(canvases.length,3,'actors and tint changes reuse a fixed set of surfaces');
  scale=1.8;art.draw(destination,'hound','#e9bb70',paint);
  assert.deepEqual(images.at(-1)!.slice(1),geometry,'zoom density cannot change body/weapon bounds');
  assert.equal(canvases[3].width*canvases[3].height,firstArea*4);
  scale=.81;art.draw(destination,'hound','#85c9ee',paint);assert.equal(canvases.length,6,'returning zoom reuses its tier');
  art.reset();art.draw(destination,'hound','#e9bb70',paint);assert.equal(canvases.length,9);
  for(const s of [.8,.99,1,1.2,1.49,1.5,1.8,2,3])assert.ok(outlineDensity(s)>=Math.min(s,2));
});
