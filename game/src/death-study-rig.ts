import { clamp, smooth, polygon, line, taper, type Point } from './art-primitives.ts';

// Review-only articulation of the stalker's bone, rib and burial-shroud art.
// Positions have separate ground depth and height; no whole-body flattening.
type V = readonly [number, number, number];
interface Key {
  time: number; hip: V; lean: number; turn: number; head: number;
  feet: readonly [V, V]; hands: readonly [V, V];
}
export interface DeathDesign {
  title: string; subtitle: string; detail: string; contact: number; keys: readonly Key[];
}
const rest: Key = { time: 0, hip: [0, 0, 14], lean: 0, turn: 0, head: 0,
  feet: [[-6.5, -2, 0], [6.5, 2, 0]], hands: [[-10, -1, 3], [10, 1, 3]] };
const key = (time: number, hip: V, lean: number, turn: number, head: number,
  feet: readonly [V, V], hands: readonly [V, V]): Key => ({ time, hip, lean, turn, head, feet, hands });

export const DEATH_DESIGNS: readonly DeathDesign[] = [
  { title: 'Knees give way', subtitle: 'Buckle → knees → shoulder', contact: .57,
    detail: 'A compact collapse. The legs lose support before the upper body tips and settles.', keys: [rest,
      key(.09, [1, 0, 13.5], -.13, 0, -.2, rest.feet, [[-11,-1,8],[12,2,10]]),
      key(.29, [1, 0, 8], .35, .12, .15, [[-6,-2,0],[5,3,0]], [[-5,-6,6],[12,5,8]]),
      key(.43, [3, 0, 5], .72, .25, .5, [[-7,-3,0],[1,5,0]], [[9,-6,2],[18,6,5]]),
      key(.57, [5, 0, 4], 1.44, .22, 1.55, [[-7,-3,0],[0,5,0]], [[17,-7,1],[22,7,2]]),
      key(.68, [5, 0, 4.4], 1.4, .25, 1.38, [[-7,-3,0],[0,5,0]], [[18,-7,1],[23,8,1]]),
      key(.9, [5, 0, 4], 1.46, .25, 1.58, [[-7,-3,0],[0,5,0]], [[18,-7,1],[23,8,1]]) ] },
  { title: 'Backwards impact', subtitle: 'Recoil → hips → back', contact: .46,
    detail: 'The chest recoils, the feet slip forward, and the arms finish falling after the back lands.', keys: [rest,
      key(.09, [-1,0,14], -.3, -.08, -.14, rest.feet, [[-13,-3,16],[12,4,18]]),
      key(.27, [-6,0,10], -.8, -.1, -.45, [[1,-4,0],[10,5,0]], [[-21,-5,15],[-2,8,21]]),
      key(.46, [-10,0,4], -1.48, -.08, -1.3, [[4,-5,0],[7,6,0]], [[-26,-6,5],[-15,10,10]]),
      key(.56, [-10.5,0,4.5], -1.4, -.08, -1.55, [[4,-5,0],[7,6,0]], [[-27,-7,1],[-17,11,5]]),
      key(.81, [-11,0,4], -1.48, -.08, -1.61, [[4,-5,0],[7,6,0]], [[-27,-7,1],[-21,12,1]]) ] },
  { title: 'Forward crumple', subtitle: 'Stagger → hands → chest', contact: .5,
    detail: 'A failed attempt to catch the fall. The hands touch first, then the elbows fold under the chest.', keys: [rest,
      key(.1, [2,0,14], .28, .08, .1, rest.feet, [[-4,-5,12],[17,4,15]]),
      key(.28, [7,0,11], .8, .12, .5, [[-5,-3,0],[10,4,0]], [[20,-7,6],[27,6,7]]),
      key(.38, [10,0,8], 1.08, .12, .9, [[-3,-3,0],[7,5,0]], [[26,-7,1],[30,7,1]]),
      key(.5, [11,0,4], 1.5, .1, 1.6, [[-4,-4,0],[2,6,0]], [[27,-7,1],[30,7,1]]),
      key(.6, [12,0,4.3], 1.47, .12, 1.45, [[-3,-4,0],[3,6,0]], [[27,-7,1],[30,7,1]]),
      key(.82, [12,0,4], 1.52, .14, 1.63, [[-3,-4,0],[3,6,0]], [[26,-8,1],[29,7,1]]) ] },
  { title: 'Twisting side fall', subtitle: 'Turn → hip → shoulder roll', contact: .53,
    detail: 'An asymmetric fall. The pelvis turns, one shoulder lands first, and the trailing arm settles last.', keys: [rest,
      key(.1, [1,1,14], .2, -.35, .05, rest.feet, [[-12,-3,10],[13,5,14]]),
      key(.3, [6,3,10], .7, -.8, .5, [[-4,-4,0],[8,7,0]], [[-4,-9,12],[22,8,13]]),
      key(.53, [10,5,4], 1.4, -1, 1.25, [[0,-3,0],[9,13,0]], [[12,-15,2],[26,8,9]]),
      key(.65, [11,5,4.5], 1.47, -.7, 1.55, [[0,-3,0],[9,13,0]], [[13,-14,1],[28,5,4]]),
      key(.94, [11,5,4], 1.5, -.62, 1.62, [[0,-3,0],[9,13,0]], [[13,-14,1],[27,3,1]]) ] },
];

const add = (a: V, b: V): V => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub = (a: V, b: V): V => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul = (a: V, t: number): V => [a[0]*t,a[1]*t,a[2]*t];
const dot = (a: V, b: V) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const unit = (a: V): V => mul(a, 1/(Math.hypot(...a)||1));
const cross = (a: V, b: V): V => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const mix = (a: number, b: number, t: number) => a+(b-a)*t;
const mixV = (a: V, b: V, t: number): V => [mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];

function sample(design: DeathDesign, age: number): Key {
  const keys = design.keys;
  const index = keys.findIndex(k => k.time >= age);
  if (index === 0) return keys[0];
  if (index < 0) return keys[keys.length-1];
  const a = keys[index-1], b = keys[index], t = smooth((age-a.time)/(b.time-a.time));
  return { time: age, hip: mixV(a.hip,b.hip,t), lean: mix(a.lean,b.lean,t), turn: mix(a.turn,b.turn,t),
    head: mix(a.head,b.head,t), feet: [mixV(a.feet[0],b.feet[0],t),mixV(a.feet[1],b.feet[1],t)],
    hands: [mixV(a.hands[0],b.hands[0],t),mixV(a.hands[1],b.hands[1],t)] };
}

/** Fixed bone lengths with a knee/elbow pole; unreachable authored targets clamp. */
function limb(root: V, target: V, pole: V, upper: number, lower: number): readonly [V,V,V] {
  const delta = sub(target,root), distance = Math.max(.01,Math.min(Math.hypot(...delta),upper+lower-.01));
  const axis = unit(delta), end = add(root,mul(axis,distance));
  const along = (upper*upper-lower*lower+distance*distance)/(2*distance);
  const offset = Math.sqrt(Math.max(0,upper*upper-along*along));
  const hint = sub(pole,root), normal = unit(sub(hint,mul(axis,dot(hint,axis))));
  return [root,add(add(root,mul(axis,along)),mul(normal,offset)),end];
}

export function drawDeathStudy(c: CanvasRenderingContext2D, design: DeathDesign, age: number, mirror = false): void {
  const k = sample(design,age), turn = k.turn;
  const up: V = [Math.sin(k.lean),0,Math.cos(k.lean)];
  const right: V = [Math.cos(k.lean)*Math.cos(turn),Math.sin(turn),-Math.sin(k.lean)*Math.cos(turn)];
  const front = cross(right,up);
  const body = (x: number, y: number, z: number): V => add(k.hip,add(mul(right,x),add(mul(front,y),mul(up,z))));
  const shoulder = body(0,0,10);
  const neckUp: V = [Math.sin(k.head),0,Math.cos(k.head)];
  const headRight: V = [Math.cos(k.head)*Math.cos(turn),Math.sin(turn),-Math.sin(k.head)*Math.cos(turn)];
  const headFront = cross(headRight,neckUp), headCenter = add(shoulder,mul(neckUp,7));
  const head = (x: number,y: number,z: number): V => add(headCenter,add(mul(headRight,x),add(mul(headFront,y),mul(neckUp,z))));
  // Slight oblique view exposes volume when a side-facing body lies down.
  const p = (a: V): Point => [(a[0]*.9-a[1]*.43)*(mirror?-1:1),a[0]*.2+a[1]*.48-a[2]];
  const shape = (points: readonly V[], color: string) => polygon(c,points.map(p),color);
  const stroke = (points: readonly V[],color: string,width: number) => line(c,points.map(p),color,width);
  const ellipse = (x: number,y: number,rx: number,ry: number,color: string) => {
    c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();
  };
  c.save();
  const shadows = [k.hip,shoulder,headCenter].map(a => p([a[0],a[1],0]));
  for (const s of shadows) ellipse(s[0],s[1]+1,7,2.6,'#040a0990');
  const pieces: { depth: number; draw: () => void }[] = [];
  const enqueue = (center: V,draw: () => void) => pieces.push({depth:center[0]*.2+center[1]*.48+center[2]*.3,draw});
  for (let i=0;i<2;i++) {
    const side=i===0?-1:1;
    const leg=limb(body(side*3,0,0),k.feet[i],add(k.hip,[side*5,-7,-6]),7.6,8.5);
    enqueue(leg[1],() => {
      taper(c,p(leg[0]),p(leg[1]),4.2,2.8,'#454c3d');
      taper(c,p(leg[1]),p(leg[2]),2.9,1.9,'#9d9b7b');
      stroke([add(leg[1],[-.5,-.6,0]),add(leg[2],[-.5,-.6,0])],'#c3bb96',.65);
      const f=leg[2];shape([add(f,[-1.5,-1,1]),add(f,[2,-1,1]),add(f,[side*3,2,0]),add(f,[-1,2,0])],'#8a9074');
    });
    const arm=limb(body(side*5,0,10),k.hands[i],add(shoulder,[side*15,-3,-4]),9,11);
    enqueue(arm[1],() => {
      taper(c,p(arm[0]),p(arm[1]),4.2,2.8,'#8e9579');
      taper(c,p(arm[1]),p(arm[2]),2.7,1.6,'#b5b090');
      stroke([arm[0],arm[1]],'#c1b99a',.65);
      const hand=arm[2];for(let claw=0;claw<2;claw++) {
        const start=add(hand,[claw*1.4,0,0]);
        taper(c,p(start),p(add(start,[side*2,2,-Math.min(1,hand[2])])),.9,.3,'#cbc09a');
      }
    });
  }
  enqueue(body(0,0,5),() => {
    // Stalker's original angular torso, rib ridges and torn shroud, in a body frame.
    shape([body(-5,0,-1),body(-9,0,6),body(-5,0,12),body(2,0,13),body(8,0,7),body(5,0,0),body(1,0,-3)],'#323e34');
    shape([body(-6,-1,7),body(-4,-2,11),body(2,-2,11),body(5,-2,6),body(3,-2,-1),body(-1,-1,0)],'#777f64');
    shape([body(5,-2,6),body(8,0,7),body(5,2,0),body(1,2,-3),body(3,-2,-1)],'#4d5c47');
    for(let rib=0;rib<3;rib++) {
      const z=8-rib*2.4;stroke([body(-5+rib,-2,z+1),body(0,-3,z-1),body(4-rib*.5,-2,z+.5)],'#a9a78a',1);
    }
    const drag=smooth(age/.65);
    shape([body(-7,-1,9),body(-4,-1,11),body(-3,-1,3),body(-5,-1,-3),
      add(body(-7,0,-1),[-2*drag,2*drag,0]),body(-8,0,-6),body(-9,0,2)],'#394f49');
    stroke([body(-6.5,-2,8),body(-5,-2,3),body(-7,-1,-1)],'#769080',.65);
  });
  enqueue(headCenter,() => {
    stroke([shoulder,headCenter],'#8e9579',3);
    shape([head(-5,0,3),head(-1,0,5),head(4,0,2),head(5,0,-2),head(1,0,-5),head(-4,0,-1)],'#727b65');
    shape([head(-5,-2,3),head(2,-2,5),head(6,-2,0),head(4,-2,-6),head(0,-2,-8),head(-4,-2,-4)],'#b0ac8c');
    shape([head(-5,0,3),head(-5,-2,3),head(-4,-2,-4),head(0,-2,-8),head(-4,0,-1)],'#727b65');
    stroke([head(1,-2,4),head(-.3,-2,.8),head(1,-2,-.8)],'#535f50',.7);
    stroke([head(-3,-1,2),head(-5,-1,6),head(-3.6,-1,8.5)],'#748169',1.5);
    stroke([head(-4.4,-1,5.8),head(-7.1,-1,6.7)],'#9ba180',.85);
    for(const x of [-2,2]) {
      stroke([head(x-1,-2.1,-2),head(x+1,-2.1,-2)],'#27342d',1.8);
      c.globalAlpha=1-smooth(age/.25);
      stroke([head(x-.4,-2.2,-2),head(x+.4,-2.2,-2)],'#ddc769',.85);c.globalAlpha=1;
    }
  });
  pieces.sort((a,b)=>a.depth-b.depth).forEach(piece=>piece.draw());
  // Ground contact is authored per design, not tied to an unrelated fade clock.
  const impact=age-design.contact;
  if(impact>=0 && impact<.35) {
    const t=impact/.35, origin=p([shoulder[0],shoulder[1],0]);
    c.globalAlpha=(1-t)*.22;
    for(let i=0;i<7;i++) {
      const a=i*2.399;ellipse(origin[0]+Math.cos(a)*(3+t*13),origin[1]+Math.sin(a)*(2+t*4)-Math.sin(t*Math.PI)*2,
        1+t*2,.7+t,'#aea083');
    }
  }
  c.restore();
}

export function deathStudyPhase(design: DeathDesign, age: number): string {
  if(age<=0) return 'Alive';
  if(age<.12) return 'Impact';
  if(age<design.contact) return 'Falling';
  if(age<design.keys[design.keys.length-1].time) return 'Settling';
  return 'At rest';
}

export const deathStudyTime = (time: number) => clamp(time-.65,0,1.4);
