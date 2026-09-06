import { drawHumanoid } from './art.ts';
import { drawHumanoidDeath, DEATH_MATERIALS } from './death-humanoid-art.ts';
import { drawHoundDeath, drawWispDeath } from './death-creature-art.ts';
import { enemyDeathAnimation, type DeathVariant } from './death-content.ts';
import { deathPose, type EnemyRemains } from './death-presentation.ts';
import { ease, humanoidDeathPose } from './death-rig.ts';
import type { EnemyKind } from './model.ts';

/** Shared by the gameplay renderer and the complete creature comparison. */
export function drawDeathFigure(c:CanvasRenderingContext2D,kind:EnemyKind,variant:DeathVariant,age:number,facing:number):void {
  const recipe=enemyDeathAnimation(kind,variant);
  const scale=kind==='hound'||kind==='wisp'?1:DEATH_MATERIALS[kind].scale;
  const travel=recipe.travel*ease(age/recipe.contact)*scale;
  c.save();
  c.fillStyle='#050c0990';c.beginPath();
  c.ellipse(Math.cos(facing)*travel*.45,Math.sin(facing)*travel*.25+1,kind==='warden'?32:kind==='brute'?20:14,kind==='warden'?10:4,0,0,Math.PI*2);c.fill();
  // Short silhouette handoff. There is no transformation of the standing image.
  const blend=ease(age/.1);
  if(blend<1) {
    c.save();c.globalAlpha*=1-blend;
    drawHumanoid(c,{kind,angle:facing,time:0,moving:0,attack:0,attackAngle:facing,hitFlash:0,dodging:false});c.restore();
  }
  if(blend>0) {
    c.save();c.globalAlpha*=blend;
    if(kind==='hound')drawHoundDeath(c,recipe,age,facing);
    else if(kind==='wisp')drawWispDeath(c,recipe,age,facing);
    else drawHumanoidDeath(c,kind,recipe,age,facing);
    c.restore();
  }
  const impact=(age-recipe.contact)/.38;
  if(impact>0&&impact<1&&age<recipe.settle) {
    c.save();c.globalAlpha*=(1-impact)*.16;c.fillStyle='#b0a184';
    for(let i=0;i<7;i++) {
      const angle=i*2.399,spread=(3+impact*15)*scale;
      c.beginPath();c.ellipse(Math.cos(facing)*travel+Math.cos(angle)*spread,Math.sin(facing)*travel*.55+Math.sin(angle)*spread*.4-2*scale,
        (1+impact*2)*scale,(.6+impact)*scale,0,0,Math.PI*2);c.fill();
    }
    c.restore();
  }
  c.restore();
}

const settledArt=new Map<EnemyRemains,HTMLCanvasElement>();
/** A bounded, disposable raster cache of final articulated poses. */
export function resetDeathArt():void { settledArt.clear(); }
export function deathDepth(r:EnemyRemains):number {
  const recipe=enemyDeathAnimation(r.kind,r.variant);
  const distance=r.kind==='hound'||r.kind==='wisp'?recipe.travel*ease(r.age/recipe.contact):humanoidDeathPose(recipe,r.age).hip[1]*DEATH_MATERIALS[r.kind].scale;
  return r.y+Math.sin(r.facing)*distance*.55;
}
export function drawEnemyRemains(c:CanvasRenderingContext2D,r:EnemyRemains,reducedMotion:boolean):void {
  const pose=deathPose(r,reducedMotion);
  c.save();c.translate(r.x,r.y);c.globalAlpha*=pose.opacity;
  if(pose.settled&&typeof document!=='undefined') {
    let art=settledArt.get(r);
    const size=r.kind==='warden'?384:192;
    if(!art) {
      art=document.createElement('canvas');art.width=art.height=size*2;
      const ctx=art.getContext('2d')!;ctx.translate(size,size);ctx.scale(2,2);
      drawDeathFigure(ctx,r.kind,r.variant,enemyDeathAnimation(r.kind,r.variant).settle,r.facing);
      if(settledArt.size>=45) settledArt.delete(settledArt.keys().next().value!);
      settledArt.set(r,art);
    }
    c.drawImage(art,-size/2,-size/2,size,size);
  } else drawDeathFigure(c,r.kind,r.variant,pose.age,r.facing);
  c.restore();
}
