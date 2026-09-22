import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_APPEARANCE, HAIR_STYLES, HAIR_PALETTES, SKIN_PALETTES } from '../src/appearance-content.ts';
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

test('shaved front and diagonal scalps are skin through the crown and temples',()=>{
  for(const skin of SKIN_PALETTES)for(const angle of [Math.PI/4,Math.PI/2,Math.PI*3/4]) {
    const look={...DEFAULT_APPEARANCE,skin:skin.id,hair:'bald' as const,facialHair:'none' as const,accessory:'none' as const};
    const shapes=appearanceHeadShapes(look,angle,false);
    for(const point of [[0,-3.7],[-2.4,-2.8],[2.3,-2.7],[-3.2,0],[3.3,.5]] as Point[]) {
      const visible=shapes.filter(s=>s.fill&&inside(point,s.points)).at(-1)?.fill;
      assert.ok(visible===skin.base||visible===skin.shadow||visible===skin.light,`${skin.id}: scalp at ${point} must be skin, got ${visible}`);
    }
    for(const hairColor of HAIR_PALETTES)assert.deepEqual(appearanceHeadShapes({...look,hairColor:hairColor.id},angle,false),shapes,'shaved scalp is independent of hair color');
  }
});

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

test('long front hairstyles frame an open neck instead of painting a beard below the chin',()=>{
  for(const style of ['bob','long','waves','locs','halfup','longside'] as const) {
    for(const angle of [Math.PI/4,Math.PI/2,Math.PI*3/4]) {
      const layers=hairShapes(style,HAIR_PALETTES[0],angle);
      for(const point of [[-1,5.8],[0,6.4],[1,5.8],[0,8]] as Point[]) {
        assert.ok(![...layers.rear,...layers.front].some(shape=>shape.fill&&inside(point,shape.points)),`${style} covers the neck at ${point}`);
      }
    }
  }
});

test('all front hairstyles preserve the eyes and mouth across front diagonals',()=>{
  for(const {id}of HAIR_STYLES)for(const angle of [Math.PI/4,Math.PI/2,Math.PI*3/4]) {
    const look=Math.cos(angle)*.8,layers=hairShapes(id,HAIR_PALETTES[0],angle);
    for(const point of [[-1.6+look,1.25],[1.6+look,1.25],[look,3.2]] as Point[]) {
      assert.ok(!layers.front.some(shape=>shape.fill&&inside(point,shape.points)),`${id} obscures facial feature ${point}`);
    }
  }
});

test('topknot temples remain shaved and locs form a continuous rear layer above their loose ends',()=>{
  const topknot=hairShapes('topknot',HAIR_PALETTES[0],Math.PI/2);
  for(const point of [[-3.3,.5],[3.7,.5]] as Point[])assert.ok(!topknot.front.some(s=>s.fill&&inside(point,s.points)),'topknot keeps its shaved temple');
  const locs=backHairShapes('locs',HAIR_PALETTES[0]);
  for(let x=-2.5;x<=2.5;x+=.1)for(const y of [3,4,5,6,7]) {
    assert.ok(locs.front.some(s=>s.fill&&inside([x,y],s.points)),`rear locs expose a gap through the nape at ${x},${y}`);
  }
});
