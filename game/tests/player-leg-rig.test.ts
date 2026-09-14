import test from 'node:test';
import assert from 'node:assert/strict';
import { playerLegRig, projectLegPoint, type LegPoint } from '../src/player-leg-rig.ts';
import { playerMotion } from '../src/character-motion.ts';
import type { CharacterPose } from '../src/art-types.ts';

const distance=(a:LegPoint,b:LegPoint)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const pose:CharacterPose={kind:'player',angle:0,moveAngle:0,time:1.25,moving:1,attack:0,attackAngle:0,hitFlash:0,dodging:false};

test('leg bones keep their length through forward, backward and strafing cycles in all facings',()=>{
  const rest=playerLegRig(0,0,0,0)[0];
  const thigh=distance(rest.hip,rest.knee),shin=distance(rest.knee,rest.ankle);
  for(let direction=0;direction<8;direction++) for(let phase=0;phase<96;phase++) {
    for(const offset of [0,Math.PI/2,-Math.PI/2,Math.PI]) for(const moving of [0,.5,1]) {
      const angle=direction*Math.PI/4,gaitPhase=phase*Math.PI/48,moveAngle=angle+offset;
      const m=playerMotion({...pose,angle,moveAngle,gaitPhase,moving});
      const legs=playerLegRig(angle,moveAngle,gaitPhase,moving,m.hipX,m.hipY);
      for(const leg of legs) {
        assert.ok(Math.abs(distance(leg.hip,leg.knee)-thigh)<1e-8,'thigh never stretches or collapses');
        assert.ok(Math.abs(distance(leg.knee,leg.ankle)-shin)<1e-8,'shin never stretches or collapses');
        assert.ok(leg.foot[2]>=0&&leg.foot[2]<=3.4);
        assert.ok([leg.hip,leg.knee,leg.ankle,leg.foot].every(p=>p.every(Number.isFinite)));
      }
      assert.ok(legs.some(l=>l.lift===0),'at least one foot remains planted');
    }
  }
});

test('side-view hips and feet overlap on screen while retaining separate depth tracks',()=>{
  const side=playerLegRig(0,0,0,0),front=playerLegRig(Math.PI/2,Math.PI/2,0,0);
  assert.equal(side[0].hip[0],side[1].hip[0]);
  assert.equal(Math.abs(side[0].foot[0]-side[1].foot[0]),0);
  assert.ok(side[0].hip[1]<side[1].hip[1]);
  assert.ok(Math.abs(front[0].hip[0]-front[1].hip[0])>5);
  const point:LegPoint=[2,4,0],lifted:LegPoint=[2,4,3];
  assert.equal(projectLegPoint(lifted)[1],projectLegPoint(point)[1]-3);
  assert.equal(lifted[1],point[1],'lift does not change ground depth');
});

test('joint motion closes continuously at cycle boundaries and standing ignores the stride phase',()=>{
  for(let direction=0;direction<8;direction++) {
    const facing=direction*Math.PI/4;
    const rest=playerLegRig(facing,facing,0,0);
    for(const phase of [0,Math.PI,.58*Math.PI*2,Math.PI*2]) {
      const standing=playerLegRig(facing,facing,phase,0);
      for(let i=0;i<2;i++) for(const joint of ['hip','knee','ankle','foot'] as const)
        assert.equal(distance(standing[i][joint],rest[i][joint]),0);
      const before=playerLegRig(facing,facing,phase-1e-7,1).sort((a,b)=>a.side-b.side);
      const after=playerLegRig(facing,facing,phase+1e-7,1).sort((a,b)=>a.side-b.side);
      for(let i=0;i<2;i++) for(const joint of ['hip','knee','ankle','foot'] as const)
        assert.ok(distance(before[i][joint],after[i][joint])<.0001);
    }
  }
});
