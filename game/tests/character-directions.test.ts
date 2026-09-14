import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_APPEARANCE, HAIR_STYLES, FACIAL_HAIR, ACCESSORIES } from '../src/appearance-content.ts';
import { appearanceHeadShapes } from '../src/appearance-shapes.ts';
import { armorShapes } from '../src/armor-shapes.ts';
import { STARTER_OUTFIT } from '../src/equipment-art.ts';
import { torsoFacing } from '../src/character-facing.ts';

test('side heads expose one eye and a projecting nose, while front and back retain their own faces', () => {
  const bare = {...DEFAULT_APPEARANCE, hair: 'bald' as const};
  for (let direction=0; direction<8; direction++) {
    const shapes=appearanceHeadShapes(bare,direction*Math.PI/4,false);
    const eyes=shapes.filter(s=>s.stroke==='#263239');
    assert.equal(eyes.length,direction===0||direction===4?1:direction>4?0:2);
    if(direction===0||direction===4) {
      const sign=direction===0?1:-1;
      const xs=shapes.flatMap(s=>s.points.map(([x])=>x*sign));
      assert.ok(Math.max(...xs)>4.5,'nose projects beyond the forehead');
      assert.ok(Math.min(...xs)>-4.5,'rear skull stays rounded');
    }
  }
});

test('profile cosmetics and helmets stay finite, keep recipes intact and mirror their silhouette', () => {
  for(const [key,catalog] of Object.entries({hair:HAIR_STYLES,facialHair:FACIAL_HAIR,accessory:ACCESSORIES})) {
    for(const value of catalog) for(const covered of [false,true]) {
      const look={...DEFAULT_APPEARANCE,[key]:value.id};
      const before=structuredClone(look);
      for(let direction=0;direction<8;direction++) {
        const shapes=appearanceHeadShapes(look,direction*Math.PI/4,covered);
        assert.ok(shapes.length>0);
        assert.ok(shapes.every(s=>s.points.every(p=>p.every(Number.isFinite))));
        assert.ok(shapes.flatMap(s=>s.points).every(([x,y])=>Math.abs(x)<12&&Math.abs(y)<15));
      }
      assert.deepEqual(look,before);
    }
  }
  const right=armorShapes('head',STARTER_OUTFIT.head!,0);
  const left=armorShapes('head',STARTER_OUTFIT.head!,Math.PI);
  assert.deepEqual(left.map(s=>s.points),right.map(s=>s.points.map(([x,y])=>[-x,y])));
});

test('torso turns continuously with a narrower solid side and distinct front and back surfaces', () => {
  assert.ok(torsoFacing(0).width<torsoFacing(Math.PI/2).width*.6);
  assert.equal(torsoFacing(Math.PI/2).back,false);
  assert.equal(torsoFacing(-Math.PI/2).back,true);
  let previous=torsoFacing(0);
  for(let i=1;i<=360;i++) {
    const next=torsoFacing(i*Math.PI/180);
    assert.ok(next.width>=.5&&next.width<=1.001);
    assert.ok(Math.abs(next.width-previous.width)<.02);
    assert.ok(Math.abs(next.surfaceOffset-previous.surfaceOffset)<.06);
    previous=next;
  }
});
