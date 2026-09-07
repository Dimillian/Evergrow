import test from 'node:test';
import assert from 'node:assert/strict';
import { mixColor } from '../src/art-primitives.ts';
import { gearMaterialStops, gearSurface, GEAR_MATERIALS } from '../src/gear-material.ts';
import { gearShapeColor } from '../src/weapon-shapes.ts';
import { bootShapes } from '../src/boot-shapes.ts';
import type { ArmorPiece } from '../src/art-types.ts';

test('repeated pigment blending preserves RGB colors instead of shading them from black', () => {
  const pigment = mixColor('#ffffff', '#000000', .5);
  assert.equal(pigment, 'rgb(128,128,128)');
  assert.equal(mixColor(pigment, '#ffffff', .5), 'rgb(192,192,192)');
  assert.equal(mixColor('#ffffff', pigment, .5), 'rgb(192,192,192)');
  for (const material of Object.keys(GEAR_MATERIALS) as Array<keyof typeof GEAR_MATERIALS>) {
    for (const facet of [false,true]) {
      const surface = { ...gearSurface(material, 7), facet };
      const normalized = (base:string) => gearMaterialStops(base,surface).map(([at,color])=>[at,gearShapeColor(color)]);
      assert.deepEqual(normalized(pigment),normalized('#808080'));
    }
  }
});

test('boots preserve ankle attachment and foot contact across facings and materials', () => {
  for (const style of ['leather','plate'] as const) {
    const piece:ArmorPiece={style,seed:1,material:{base:'#776655',shadow:'#223344',edge:'#bbbbbb',trim:'#aabbcc'}};
    for(const facing of [-1,-.5,0,.5,1]) {
      const shapes=bootShapes(piece,facing), points=shapes.flatMap(s=>s.points);
      assert.ok(points.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<3.2&&y>=-6&&y<=1.2));
      assert.ok(shapes[0].points.some(([x,y])=>x<0&&y===-6));
      assert.ok(shapes[0].points.some(([x,y])=>x>0&&y===-6));
      assert.strictEqual(bootShapes(piece,facing),shapes);
    }
  }
});

test('iron has a stronger, sharper reflection than matte leather and cloth', async () => {
  const {gearLightResponse}=await import('../src/gear-material.ts');
  const face=(material:keyof typeof GEAR_MATERIALS)=>gearSurface(material,1,[0,0,1]);
  const lamp={direction:[0,0,1] as const,color:'#ffffff',power:1};
  const steel=gearLightResponse(face('steel'),lamp),leather=gearLightResponse(face('leather'),lamp),cloth=gearLightResponse(face('cloth'),lamp);
  assert.ok(steel.specular>leather.specular*8);
  assert.ok(leather.specular>cloth.specular*3);
  const grazing={...lamp,direction:[.9,0,.2] as const};
  assert.ok(gearLightResponse(face('steel'),grazing).specular/steel.specular < gearLightResponse(face('leather'),grazing).specular/leather.specular);
});

test('scene material lights respect range, crypt clipping and the scene budget', async () => {
  const {sampleGearLight}=await import('../src/gear-scene-light.ts');
  const {DEFAULT_GEAR_LIGHT}=await import('../src/gear-material.ts');
  const light={x:30,y:0,radius:120,color:'#ff8844',power:1};
  assert.strictEqual(sampleGearLight(500,0,[light]),DEFAULT_GEAR_LIGHT);
  const lit=sampleGearLight(0,0,[light]);
  assert.ok(lit.direction[0]>0);
  assert.ok(lit.direction.every(Number.isFinite));
  const blocked={...light,clip:[{x:20,y:-20},{x:40,y:-20},{x:40,y:20},{x:20,y:20}]};
  assert.strictEqual(sampleGearLight(0,0,[blocked]),DEFAULT_GEAR_LIGHT);
  assert.deepEqual(sampleGearLight(0,0,Array(20).fill(light)),sampleGearLight(0,0,Array(18).fill(light)));
});

test('every gallery piece has bounded shared geometry and assigned surface materials', async () => {
  const {equipmentExhibits}=await import('../src/equipment-review-fixtures.ts');
  const {itemDropShapes}=await import('../src/item-art.ts');
  const exhibits=equipmentExhibits();
  assert.equal(exhibits.length,196);
  assert.equal(new Set(exhibits.map(e=>e.item.id)).size,exhibits.length);
  for(const {item} of exhibits) for(const shape of itemDropShapes(item)) {
    assert.ok(shape.surface,`${item.baseName} missing a material`);
    assert.ok(shape.points.every(p=>p.every(Number.isFinite)));
    assert.ok(Math.abs(Math.hypot(...shape.surface.normal)-1)<.001);
  }
});
