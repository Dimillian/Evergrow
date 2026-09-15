import test from 'node:test';
import assert from 'node:assert/strict';
import { bootProjection } from '../src/boot-projection.ts';
import { bootShapes } from '../src/boot-shapes.ts';
import { armorBoot, STARTER_OUTFIT } from '../src/equipment-art.ts';
import { withGearLight } from '../src/gear-material.ts';
import { playerLegRig, projectLegPoint, PLAYER_SHIN_LENGTH } from '../src/player-leg-rig.ts';
import { playerMotion } from '../src/character-motion.ts';
import type { CharacterPose } from '../src/art-types.ts';
import type { Point } from '../src/art-primitives.ts';

test('boot cuffs remain below the knee through foreshortened walking poses', () => {
  let reproduced = false;
  for (let direction = 0; direction < 8; direction++) {
    const angle = direction * Math.PI / 4;
    for (const gaitPhase of [1.37445, ...Array.from({length:96}, (_,i)=>i*Math.PI/48)]) {
      const pose: CharacterPose = {kind:'player', angle, moveAngle:angle, gaitPhase, time:0,
        moving:1, attack:0, attackAngle:angle, hitFlash:0, dodging:false};
      const motion = playerMotion(pose);
      for (const leg of playerLegRig(angle, angle, gaitPhase, 1, motion.hipX, motion.hipY)) {
        const ankle = projectLegPoint(leg.ankle), knee = projectLegPoint(leg.knee);
        const dx = knee[0]-ankle[0], dy = knee[1]-ankle[1], length = Math.hypot(dx,dy);
        if (direction===2 && gaitPhase===1.37445 && length<2.2) reproduced = true;
        const project = bootProjection(ankle,knee);
        for (const style of ['leather','plate'] as const) {
          for (const shape of bootShapes({...STARTER_OUTFIT.boots!,style},angle)) {
            for (const source of shape.points) {
              const point = project(source);
              assert.ok(point.every(Number.isFinite));
              if (source[1]>=-2) assert.deepEqual(point,source,'foot contact stays unchanged');
              if (source[1]<=-5) {
                const reach = (point[0]*dx+(point[1]+2)*dy)/length;
                assert.ok(reach<length,'upper cuff stays below the knee along the projected shin');
              }
            }
          }
        }
        const cuff = project([0,-6]);
        assert.ok(Math.abs(Math.hypot(cuff[0],cuff[1]+2)-length*4/PLAYER_SHIN_LENGTH)<1e-9);
      }
    }
  }
  assert.ok(reproduced,'exercise the reported south-facing short shin');
  assert.ok(bootProjection([0,0],[0,0])([1,-6]).every(Number.isFinite));
});

test('boot drawing reuses material shading across poses and refreshes when lighting changes', () => {
  const piece = {...STARTER_OUTFIT.boots!,seed:91827};
  const shapes = bootShapes(piece,Math.PI/2);
  const original = structuredClone(shapes);
  let reads = 0;
  for (const shape of shapes) {
    const surface = shape.surface!, normal = surface.normal;
    Object.defineProperty(surface,'normal',{configurable:true,get(){reads++;return normal;}});
  }
  const points: Point[] = [];
  const ctx = {getTransform:()=>({a:1,b:0}),save(){},restore(){},translate(){},
    beginPath(){},closePath(){},fill(){},stroke(){},
    moveTo(x:number,y:number){points.push([x,y]);},lineTo(x:number,y:number){points.push([x,y]);}
  } as unknown as CanvasRenderingContext2D;
  const draw = (knee:Point) => armorBoot(ctx,[0,0],piece,value=>value,Math.PI/2,[0,-2],knee);
  draw([0,-9]);
  const firstReads = reads, firstPoints = [...points];
  assert.ok(firstReads>0,'first draw computes material response');
  points.length = 0;
  draw([0,-9]);
  assert.equal(reads,firstReads,'stationary redraw reuses shading');
  points.length = 0;
  draw([2,-4]);
  assert.equal(reads,firstReads,'deformed pose reuses shading');
  assert.notDeepEqual(points,firstPoints,'geometry still follows the new shin');
  withGearLight(ctx,{direction:[1,0,1],color:'#ffddaa',power:.7},()=>draw([2,-4]));
  assert.ok(reads>firstReads,'changed lighting recomputes shading');
  assert.deepEqual(shapes,original,'drawing does not mutate cached source shapes');
});
