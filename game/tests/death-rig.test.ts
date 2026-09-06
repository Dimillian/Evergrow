import assert from 'node:assert/strict';
import test from 'node:test';
import { frame3, solveLimb, vdot, vsub, humanoidDeathPose, humanoidDeathArm } from '../src/death-rig.ts';
import { DEATH_KINDS, ENEMY_DEATHS } from '../src/death-content.ts';
import { drawDeathFigure } from '../src/death-art.ts';
import { DeathMesh } from '../src/death-mesh.ts';
import { deathWeaponFrame, weaponReleaseTime } from '../src/death-weapon.ts';
import { DEATH_MATERIALS } from '../src/death-humanoid-art.ts';

test('rig rotations preserve all three dimensions and limb lengths even at degenerate targets',()=>{
  for(const pitch of [-1.6,-.8,0,.7,1.57])for(const yaw of [0,.4,2,5])for(const roll of [0,.5,1.6]) {
    const f=frame3([0,0,0],pitch,yaw,roll);
    for(const axis of [f.right,f.forward,f.up])assert.ok(Math.abs(Math.hypot(...axis)-1)<1e-10);
    assert.ok(Math.abs(vdot(f.up,f.right))<1e-10);
    assert.ok(Math.abs(vdot(f.forward,f.right))<1e-10);
    assert.ok(Math.abs(vdot(f.forward,f.up))<1e-10);
  }
  for(const target of [[0,0,0],[0,0,100],[0,0,-.1],[20,8,1]] as const) {
    const [root,joint,end]=solveLimb([0,0,0],target,[0,0,0],9,10.5);
    assert.ok(Math.abs(Math.hypot(...vsub(joint,root))-9)<1e-8);
    assert.ok(Math.abs(Math.hypot(...vsub(end,joint))-10.5)<1e-8);
  }
});

test('fourth humanoid pose retains a seated torso and delayed head bend for every humanoid',()=>{
  for(const kind of DEATH_KINDS.filter(k=>k!=='hound'&&k!=='wisp')) {
    const d=ENEMY_DEATHS[kind][3],pose=humanoidDeathPose(d,d.settle);
    assert.equal(d.family,'sit');assert.ok(pose.hip[2]>=4);
    assert.ok(Math.cos(pose.pitch)>.9,'torso keeps its vertical height');
    assert.ok(pose.headPitch-pose.pitch>.5,'head bows separately from the torso');
    assert.deepEqual(pose,humanoidDeathPose(d,30),'rest never drifts after settling');
  }
});

class GeometryContext {
  globalAlpha=.6;fillStyle='';strokeStyle='';lineWidth=1;lineJoin='';lineCap='';
  private stack: number[]=[];points=0;max=0;geometry:number[]=[];
  save(){this.stack.push(this.globalAlpha);} restore(){this.globalAlpha=this.stack.pop()!;}
  beginPath(){} closePath(){} fill(){} stroke(){}
  moveTo(x:number,y:number){assert.ok(Number.isFinite(x)&&Number.isFinite(y));this.max=Math.max(this.max,Math.abs(x),Math.abs(y));this.points++;this.geometry.push(x,y);}
  lineTo(x:number,y:number){this.moveTo(x,y);}
  ellipse(...args:number[]){assert.ok(args.every(Number.isFinite));assert.ok(args[2]>0&&args[3]>0);}
  get depth(){return this.stack.length;}
}
test('all 36 animations draw finite bounded volume geometry at eight facings and contact boundaries',()=>{
  for(const kind of DEATH_KINDS)for(const variant of [0,1,2,3] as const) {
    const d=ENEMY_DEATHS[kind][variant];assert.ok(d.contact>0&&d.settle>d.contact);
    for(const age of [.1,d.contact*.6,d.contact,d.contact+.05,d.settle,10])for(let i=0;i<8;i++) {
      const ctx=new GeometryContext();drawDeathFigure(ctx as unknown as CanvasRenderingContext2D,kind,variant,age,i*Math.PI/4);
      assert.ok(ctx.points>20);assert.ok(ctx.max<(kind==='warden'?192:96),`${kind} ${variant} ${age}: ${ctx.max}`);
      assert.equal(ctx.depth,0);assert.equal(ctx.globalAlpha,.6);
    }
  }
});

test('body, held gear and secondary parts stop moving exactly at the shared settle time',()=>{
  for(const kind of DEATH_KINDS)for(const variant of [0,1,2,3] as const) {
    const d=ENEMY_DEATHS[kind][variant],a=new GeometryContext(),b=new GeometryContext();
    drawDeathFigure(a as unknown as CanvasRenderingContext2D,kind,variant,d.settle,.8);
    drawDeathFigure(b as unknown as CanvasRenderingContext2D,kind,variant,10,.8);
    assert.deepEqual(a.geometry,b.geometry,`${kind} ${variant} must not snap when cached`);
  }
});

test('surface markings retain their parent floor correction and paint after its face',()=>{
  for(const pitch of [-1.53,0,1.51])for(const facing of [0,.8,Math.PI,4.7]) {
    const mesh=new DeathMesh(facing,1),ctx=new GeometryContext();
    const paints:{color:string;points:number[]}[]=[];
    ctx.beginPath=()=>{ctx.geometry=[];};
    ctx.fill=()=>{paints.push({color:ctx.fillStyle,points:[...ctx.geometry]});};
    const outline=[[-3,-3],[3,-3],[3,3],[-3,3]] as const;
    const placed=mesh.solid(frame3([0,0,-1],pitch),outline,4,'#778077');
    assert.ok(placed.origin[2]>-1,'the floor lifts this entire part');
    mesh.detail(placed,outline,'#b39b6e');
    mesh.draw(ctx as unknown as CanvasRenderingContext2D);
    const surface=paints.findIndex(p=>p.color==='#778077');
    assert.equal(paints[surface+1].color,'#b39b6e');
    assert.deepEqual(paints[surface+1].points,paints[surface].points,'marking follows the exact visible surface through the fall');
  }
});

test('released weapons detach continuously, stop following the hand, and rest on their side',()=>{
  for(const kind of ['brute','caster','archer','goblin','goblinChief','warden'] as const) {
    const width=DEATH_MATERIALS[kind].width;
    for(const recipe of ENEMY_DEATHS[kind]) {
      const time=weaponReleaseTime(recipe);
      const hand=(age:number)=>humanoidDeathArm(humanoidDeathPose(recipe,age),width,1)[2];
      const sample=(age:number)=>deathWeaponFrame(kind,recipe,age,hand(age),width);
      if(recipe.weapon==='held') {assert.deepEqual(sample(recipe.settle).origin,hand(recipe.settle));continue;}
      assert.ok(Math.hypot(...vsub(sample(time+1e-7).origin,sample(time).origin))<.001,`${kind} ${recipe.family}: release must not teleport`);
      const final=sample(recipe.settle);
      assert.ok(Math.hypot(...vsub(final.origin,hand(recipe.settle)))>5,`${kind}: weapon leaves the hand`);
      assert.ok(Math.abs(final.forward[2])>.99,'the broad weapon face rests parallel to the floor');
      assert.deepEqual(final,sample(30),'the cached weapon must remain still');
      assert.deepEqual(final,deathWeaponFrame(kind,recipe,30,[999,999,999],width),'a released weapon no longer follows hand motion');
    }
  }
});
