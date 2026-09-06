import type { DeathAnimation } from './death-content.ts';

export type Vec3 = readonly [number, number, number];
export const vadd = (a: Vec3, b: Vec3): Vec3 => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const vsub = (a: Vec3, b: Vec3): Vec3 => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const vmul = (a: Vec3, n: number): Vec3 => [a[0]*n,a[1]*n,a[2]*n];
export const vdot = (a: Vec3, b: Vec3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const vcross = (a: Vec3,b: Vec3): Vec3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const vunit = (a: Vec3): Vec3 => vmul(a,1/(Math.hypot(...a)||1));
export const clamp01 = (n: number) => Math.max(0,Math.min(1,n));
export const ease = (n: number) => { const t=clamp01(n);return t*t*(3-2*t); };
export const lerp3 = (a: Vec3,b: Vec3,t: number): Vec3 => vadd(a,vmul(vsub(b,a),t));
export interface Frame3 { readonly origin: Vec3; readonly right: Vec3; readonly forward: Vec3; readonly up: Vec3 }
export const at = (f: Frame3,x: number,y: number,z: number): Vec3 => vadd(f.origin,vadd(vmul(f.right,x),vadd(vmul(f.forward,y),vmul(f.up,z))));
/** True orthonormal rotation, retaining thickness in every view. */
export function frame3(origin: Vec3,pitch=0,yaw=0,roll=0): Frame3 {
  const up: Vec3=[0,Math.sin(pitch),Math.cos(pitch)];
  const front: Vec3=[0,Math.cos(pitch),-Math.sin(pitch)];
  const r: Vec3=[Math.cos(yaw),Math.sin(yaw)*front[1],Math.sin(yaw)*front[2]];
  const f=vsub(vmul(front,Math.cos(yaw)),[Math.sin(yaw),0,0]);
  return {origin,right:vadd(vmul(r,Math.cos(roll)),vmul(up,Math.sin(roll))),forward:f,
    up:vsub(vmul(up,Math.cos(roll)),vmul(r,Math.sin(roll)))};
}
/** Bone lengths stay fixed; both too-close and too-far targets are handled. */
export function solveLimb(root: Vec3,target: Vec3,pole: Vec3,upper: number,lower: number): readonly [Vec3,Vec3,Vec3] {
  const delta=vsub(target,root),raw=Math.hypot(...delta);
  const axis: Vec3=raw<1e-6?[0,0,-1]:vmul(delta,1/raw);
  const distance=Math.max(Math.abs(upper-lower)+.001,Math.min(raw,upper+lower-.001));
  const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
  const hint=vsub(pole,root);let normal=vsub(hint,vmul(axis,vdot(hint,axis)));
  if(Math.hypot(...normal)<1e-6) normal=vcross(axis,Math.abs(axis[0])<.9?[1,0,0]:[0,1,0]);
  const bend=Math.sqrt(Math.max(0,upper*upper-along*along));
  return [root,vadd(vadd(root,vmul(axis,along)),vmul(vunit(normal),bend)),vadd(root,vmul(axis,distance))];
}

export interface HumanoidDeathPose {
  hip: Vec3; pitch: number; headPitch: number; twist: number;
  feet: readonly [Vec3,Vec3]; hands: readonly [Vec3,Vec3];
}
/** Shared hand anchor for the body rig and the exact instant a weapon releases. */
export function humanoidDeathArm(pose:HumanoidDeathPose,width:number,index:number):readonly [Vec3,Vec3,Vec3] {
  const side=index?1:-1,body=frame3(pose.hip,pose.pitch,pose.twist);
  const root=at(body,side*5*width,0,10),hand=pose.hands[index];
  return solveLimb(root,[hand[0]*width,hand[1],hand[2]],vadd(root,[side*12,-2,-7]),9,10.5);
}
type PoseKey = readonly [number,Vec3,number,number,readonly [Vec3,Vec3],readonly [Vec3,Vec3]];
const restFeet: readonly [Vec3,Vec3]=[[-6,0,1],[6,0,1]];
const restHands: readonly [Vec3,Vec3]=[[-10,1,5],[10,1,5]];
const rest: PoseKey=[0,[0,0,15],0,0,restFeet,restHands];
/** Separate support-loss/contact/settle keys. Fourth pose keeps a vertical torso. */
export function humanoidDeathPose(recipe: DeathAnimation,age: number): HumanoidDeathPose {
  const t=clamp01(age/recipe.settle),hit=recipe.contact/recipe.settle,d=recipe.travel;
  let keys: readonly PoseKey[];
  if(recipe.family==='sit') keys=[rest,
    [.13,[0,0,14.5],-.1,-.16,restFeet,[[-12,0,11],[12,0,13]]],
    [hit,[0,d,5],-.1,.08,[[-7,9,1],[8,7,1]],[[-12,5,3],[13,5,5]]],
    [.78,[0,d,4],.18,.65,[[-7,9,1],[8,7,1]],[[-8,8,2],[10,7,2]]],
    [1,[0,d,4],.28,1.02,[[-7,9,1],[8,7,1]],[[-8,8,2],[10,7,2]]]];
  else if(recipe.family==='back') keys=[rest,
    [.14,[0,-1,15],-.3,-.1,restFeet,[[-14,0,17],[14,0,20]]],
    [hit*.65,[0,-d*.65,10],-.88,-.6,[[-6,4,1],[7,6,1]],[[-14,-14,16],[16,-10,19]]],
    [hit,[0,-d,4.2],-1.52,-1.36,[[-7,7,1],[8,8,1]],[[-12,-20,5],[13,-15,9]]],
    [Math.min(.9,hit+.12),[0,-d,4.6],-1.45,-1.58,[[-7,7,1],[8,8,1]],[[-13,-22,2],[15,-17,4]]],
    [1,[0,-d,4],-1.53,-1.6,[[-7,7,1],[8,8,1]],[[-13,-22,1],[15,-18,1]]]];
  else if(recipe.family==='front') keys=[rest,
    [.14,[0,2,15],.25,.08,restFeet,[[-11,10,13],[12,12,16]]],
    [hit*.72,[0,d*.75,10],.88,.55,[[-6,0,1],[6,4,1]],[[-12,d+14,2],[13,d+15,2]]],
    [hit,[0,d,4],1.48,1.55,[[-6,0,1],[7,2,1]],[[-10,d+13,1],[12,d+14,1]]],
    [Math.min(.9,hit+.13),[0,d+.5,4.4],1.44,1.4,[[-6,0,1],[7,2,1]],[[-10,d+13,1],[12,d+14,1]]],
    [1,[0,d+.5,4],1.51,1.64,[[-6,0,1],[7,2,1]],[[-9,d+12,1],[11,d+14,1]]]];
  else keys=[rest,
    [.13,[0,0,14],-.12,-.18,restFeet,[[-11,1,10],[12,2,12]]],
    [hit*.58,[0,1,7],.25,.08,[[-6,-4,1],[7,0,1]],[[-7,8,5],[12,10,9]]],
    [hit*.8,[0,d*.7,5],.7,.4,[[-6,-6,1],[7,-2,1]],[[-8,d+11,1],[12,d+13,6]]],
    [hit,[0,d,4],1.45,1.55,[[-6,-6,1],[7,-2,1]],[[-9,d+12,1],[12,d+15,3]]],
    [1,[0,d,4],1.5,1.65,[[-6,-6,1],[7,-2,1]],[[-10,d+12,1],[13,d+15,1]]]];
  const end=keys.findIndex(k=>k[0]>=t),b=keys[end<0?keys.length-1:end],a=keys[Math.max(0,end-1)];
  const u=ease((t-a[0])/(b[0]-a[0]||1));
  return {hip:lerp3(a[1],b[1],u),pitch:a[2]+(b[2]-a[2])*u,headPitch:a[3]+(b[3]-a[3])*u,
    twist:recipe.twist*ease(t*1.7),feet:[lerp3(a[4][0],b[4][0],u),lerp3(a[4][1],b[4][1],u)],
    hands:[lerp3(a[5][0],b[5][0],u),lerp3(a[5][1],b[5][1],u)]};
}
