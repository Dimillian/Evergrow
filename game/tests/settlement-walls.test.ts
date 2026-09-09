import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWallSegments } from '../src/settlement-walls.ts';

const near=(a:readonly number[],b:readonly number[])=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<1e-8));
test('closed fortifications share both edges at every joint, including the wraparound and stepped corners',()=>{
  const walls=buildWallSegments([[0,0],[120,0],[120,70],[80,70],[80,140],[0,140]],true,22,()=>true);
  for(const [i,wall]of walls.entries()){
    const next=walls[(i+1)%walls.length];
    near(wall.footprint[1],next.footprint[0]);near(wall.footprint[2],next.footprint[3]);
    assert.equal(wall.startCap,false);assert.equal(wall.endCap,false);
    assert.ok(wall.length<=20);assert.ok(wall.footprint.flat().every(Number.isFinite));
  }
});
test('gate exclusions break connectivity cleanly without leaving wall spans across the opening',()=>{
  const walls=buildWallSegments([[0,0],[200,0]],false,12,x=>x<70||x>130);
  assert.equal(walls.filter(w=>w.startCap).length,2);assert.equal(walls.filter(w=>w.endCap).length,2);
  for(const wall of walls){
    const xs=wall.footprint.map(p=>p[0]);
    assert.ok(Math.max(...xs)<70||Math.min(...xs)>130);
  }
});
test('diagonal timber boundaries keep continuous grain distance and joined thickness in either direction',()=>{
  for(const points of [[[0,0],[80,110],[150,90]],[[150,90],[80,110],[0,0]]] as const){
    const walls=buildWallSegments(points,false,10,()=>true);
    assert.equal(walls[0].startCap,true);assert.equal(walls.at(-1)!.endCap,true);
    for(let i=1;i<walls.length;i++){
      near([walls[i].distance],[walls[i-1].distance+walls[i-1].length]);
      near(walls[i-1].footprint[1],walls[i].footprint[0]);near(walls[i-1].footprint[2],walls[i].footprint[3]);
    }
  }
});
