import { clamp, smooth, type Point } from './art-primitives.ts';

/** Ground depth is independent of foot lift, just as it is in the upper rig. */
export type LegPoint = readonly [x: number, depth: number, height: number];
export const LEG_DEPTH_SCALE = .45;
const THIGH_LENGTH = 8.1, SHIN_LENGTH = 7.1;
export interface LegRig {
  side: number;
  hip: LegPoint;
  knee: LegPoint;
  ankle: LegPoint;
  foot: LegPoint;
  facing: number;
  lift: number;
  depth: number;
}

export function projectLegPoint([x, depth, height]: LegPoint): Point {
  return [x, depth * LEG_DEPTH_SCALE - height];
}

/** Compact heel-to-toe stance followed by a folded, lifted return. */
export function playerFootCycle(phase: number) {
  const t = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
  const stance = .58;
  if (t < stance) return { travel: 5.4 - t / stance * 10.8, lift: 0 };
  const swing = (t - stance) / (1 - stance);
  return { travel: -5.4 + smooth(swing) * 10.8, lift: Math.sin(swing * Math.PI) ** 1.3 * 3.4 };
}

function kneeBetween(hip: LegPoint, ankle: LegPoint, facing: number): LegPoint {
  const delta = ankle.map((v,i)=>v-hip[i]);
  const distance = Math.hypot(...delta);
  const axis = delta.map(v=>v/distance);
  const along = (THIGH_LENGTH**2 - SHIN_LENGTH**2 + distance**2)/(2*distance);
  const bend = Math.sqrt(Math.max(0, THIGH_LENGTH**2-along**2));
  // Knees bend toward the character's front, even while strafing or backing up.
  const forward = [Math.cos(facing),Math.sin(facing),0];
  const dot = forward.reduce((sum,v,i)=>sum+v*axis[i],0);
  const pole = forward.map((v,i)=>v-dot*axis[i]);
  const length = Math.hypot(...pole);
  const joint = (i: number) => hip[i]+axis[i]*along+pole[i]/length*bend;
  return [joint(0),joint(1),joint(2)];
}

/** Both hip sockets and stance tracks rotate with facing. Movement supplies
 * only the foot's travel vector; it never replaces the anatomical left/right. */
export function playerLegRig(facing: number, moveAngle: number, phase: number, moving: number, hipX = 0, hipY = 0): LegRig[] {
  const amount = clamp(moving), lateralX = -Math.sin(facing), lateralDepth = Math.cos(facing);
  const settle = amount * .8 * (.5 + .5 * Math.cos(phase * 2));
  return [-1,1].map(side => {
    const cycle = playerFootCycle(phase+(side>0?Math.PI:0));
    const travel = cycle.travel*amount, lift=cycle.lift*amount;
    const hip: LegPoint = [lateralX*side*2.7+hipX,lateralDepth*side*2.7,16.8-hipY-settle];
    const foot: LegPoint = [lateralX*side*2.8+Math.cos(moveAngle)*travel,
      lateralDepth*side*2.8+Math.sin(moveAngle)*travel,lift];
    const ankle: LegPoint = [foot[0],foot[1],foot[2]+2];
    const knee = kneeBetween(hip,ankle,facing);
    return {side,hip,knee,ankle,foot,facing:facing+side*.12,lift,
      depth:(hip[1]+knee[1]+foot[1])/3};
  }).sort((a,b)=>a.depth-b.depth);
}
