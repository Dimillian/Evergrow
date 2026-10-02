import test from 'node:test';
import assert from 'node:assert/strict';
import { surfaceDot, volumeDiffuse, volumeLightKey } from '../src/surface-lighting.ts';
import { beginRelief, reliefFacet, SurfaceRelief } from '../src/surface-relief.ts';
import type { Sprite } from '../src/art-types.ts';

test('surface lighting responds to the facing plane without depending on vector magnitude', () => {
  assert.equal(surfaceDot([1,0,0],[-1,0,0]),0);
  assert.equal(surfaceDot([1,0,0],[8,0,0]),1);
  assert.equal(surfaceDot([0,0,0],[8,0,0]),0);
  let last=0;
  for(let i=0;i<=100;i++) { const value=volumeDiffuse(i/100);assert.ok(value>=last&&value<=1);last=value; }
  assert.ok(volumeDiffuse(1)-volumeDiffuse(0)>.8);
  assert.equal(volumeLightKey([1,0,.5],1,'white',0),volumeLightKey([1,.001,.501],1.001,'white',10));
  assert.notEqual(volumeLightKey([1,0,.5],1,'white',0),volumeLightKey([-1,0,.5],1,'white',0));
});

test('surface cache bounds moving-light rebakes and reuses warm rasters', () => {
  const original=globalThis.document;
  let allocations=0;
  const canvas=()=>{
    const context={drawImage(){},scale(){},translate(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},fillRect(){}};
    return {width:20,height:20,getContext:()=>context} as unknown as HTMLCanvasElement;
  };
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>{allocations++;return canvas();}}});
  try {
    const source=canvas(),ctx=source.getContext('2d')!;
    beginRelief(ctx,source,20,20);reliefFacet(ctx,[[0,0],[20,0],[0,20]],[1,0,1]);
    const sprite:Sprite={image:source,width:20,height:20,anchorX:10,anchorY:20};
    const relief=new SurfaceRelief(), light={direction:[1,0,1] as const,power:1,color:'#ffffff'};
    relief.beginFrame();assert.ok(relief.draw(ctx,sprite,source,light));
    for(let i=0;i<20;i++) assert.ok(relief.draw(ctx,sprite,source,light));
    assert.equal(relief.bakes,1,'a steady light is drawn from cache');
    for(let i=1;i<20;i++) assert.ok(relief.draw(ctx,sprite,source,{...light,power:i}));
    assert.equal(relief.bakes,6,'light movement cannot trigger unbounded rebakes');
    assert.equal(allocations,3,'only two cached rasters and one scratch canvas');
    relief.beginFrame();assert.ok(relief.draw(ctx,sprite,source,{...light,power:20}));assert.equal(relief.bakes,1);
    assert.equal(allocations,3,'evicted raster storage is reused');
    assert.equal(relief.draw(ctx,{...sprite,image:canvas()},canvas(),light),false,'unsupported art falls back to its usual renderer');
  } finally {
    if(original===undefined) Reflect.deleteProperty(globalThis,'document');
    else Object.defineProperty(globalThis,'document',{configurable:true,value:original});
  }
});
