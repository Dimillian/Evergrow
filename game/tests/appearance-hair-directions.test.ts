import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_APPEARANCE, HAIR_STYLES, HAIR_PALETTES } from '../src/appearance-content.ts';
import { appearanceHeadShapes } from '../src/appearance-shapes.ts';
import { profileHairShapes, backHairShapes } from '../src/appearance-hair-directions.ts';
import { hairShapes } from '../src/appearance-hair-shapes.ts';
import type { Point } from '../src/art-primitives.ts';

function inside(point:Point,polygon:readonly Point[]):boolean {
  let hit=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [x,y]=polygon[i],[xx,yy]=polygon[j];
    if((y>point[1])!==(yy>point[1])&&point[0]<(xx-x)*(point[1]-y)/(yy-y)+x)hit=!hit;
  }
  return hit;
}

test('all profile hairstyles leave the visible eye, nose and mouth clear',()=>{
  for(const {id}of HAIR_STYLES) {
    const layers=profileHairShapes(id,HAIR_PALETTES[0]);
    for(const point of [[2.2,.8],[4,2.1],[2.6,3.2]] as Point[]) {
      assert.ok(!layers.front.some(shape=>shape.fill&&inside(point,shape.points)),`${id} obscures facial feature ${point}`);
    }
  }
  const locs=hairShapes('locs',HAIR_PALETTES[0],Math.PI/2);
  for(const x of [-1.6,1.6])assert.ok(!locs.front.some(shape=>shape.fill&&inside([x,1.25],shape.points)),'locs keep both front eyes visible');
});

test('gathered profile hair attaches behind the skull and the mohawk follows the crown',()=>{
  for(const style of ['braid','ponytail'] as const) {
    const shapes=profileHairShapes(style,HAIR_PALETTES[0]);
    const tail=[...shapes.rear,...shapes.front].flatMap(s=>s.points).filter(([,y])=>y>5);
    assert.ok(tail.length>0);
    assert.ok(tail.every(([x])=>x< -2),`${style} hangs behind the nape, not from the face`);
  }
  const crest=profileHairShapes('mohawk',HAIR_PALETTES[0]).front.filter(s=>s.fill).flatMap(s=>s.points).filter(([,y])=>y< -4);
  assert.ok(Math.max(...crest.map(([x])=>x))-Math.min(...crest.map(([x])=>x))>6,'side crest spans the crown instead of remaining a front-view spike');
  assert.notDeepEqual(profileHairShapes('lowbun',HAIR_PALETTES[0]),profileHairShapes('bun',HAIR_PALETTES[0]));
  assert.notDeepEqual(backHairShapes('locs',HAIR_PALETTES[0]),backHairShapes('long',HAIR_PALETTES[0]));
});

test('every hairstyle and palette stays bounded, mirrors in profile and disappears under helmet coverage',()=>{
  for(const hair of HAIR_STYLES)for(const palette of HAIR_PALETTES) {
    const look={...DEFAULT_APPEARANCE,hair:hair.id,hairColor:palette.id,accessory:'none' as const,facialHair:'none' as const};
    const right=appearanceHeadShapes(look,0,false),left=appearanceHeadShapes(look,Math.PI,false);
    assert.deepEqual(left.map(s=>s.points),right.map(s=>s.points.map(([x,y])=>[-x,y])));
    for(let i=0;i<8;i++) {
      const angle=i*Math.PI/4;
      const points=appearanceHeadShapes(look,angle,false).flatMap(s=>s.points);
      assert.ok(points.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<9&&y> -10&&y<13),hair.id);
      assert.deepEqual(appearanceHeadShapes(look,angle,true),appearanceHeadShapes({...look,hair:'bald'},angle,true),'covered styles never leak hair through the helmet');
    }
  }
});
