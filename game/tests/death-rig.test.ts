import assert from 'node:assert/strict';
import test from 'node:test';
import { frame3, solveLimb, vdot, vsub, humanoidDeathPose } from '../src/death-rig.ts';
import { DEATH_KINDS, ENEMY_DEATHS } from '../src/death-content.ts';
import { drawDeathFigure } from '../src/death-art.ts';

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
