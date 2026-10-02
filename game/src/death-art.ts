import { ENEMY_BODY_BOUNDS } from './enemy-body.ts';
import { isRegionalEnemy } from './combat-content.ts';
import { drawRegionalDeath } from './regional-enemy-art.ts';
import { isBossKind } from './wilderness-boss-content.ts';
import { drawHumanoid } from './art.ts';
import { drawHumanoidDeath, DEATH_MATERIALS } from './death-humanoid-art.ts';
import { drawHoundDeath, drawWispDeath } from './death-creature-art.ts';
import { DEATH_RESPONSE_TIMING, enemyDeathAnimation, type DeathVariant } from './death-content.ts';
import { deathPose, type EnemyRemains } from './death-presentation.ts';
import { ease, humanoidDeathPose } from './death-rig.ts';
import type { EnemyKind } from './model.ts';

/** Shared by the gameplay renderer and the complete creature comparison. */
export function drawDeathFigure(c:CanvasRenderingContext2D,kind:EnemyKind,variant:DeathVariant,age:number,facing:number,motion?:EnemyRemains['motion']):void {
  const recipe=enemyDeathAnimation(kind,variant);
  const scale=kind==='hound'||kind==='wisp'||isRegionalEnemy(kind)?1:DEATH_MATERIALS[kind].scale;
  const travel=recipe.travel*ease(age/recipe.contact)*scale;
  c.save();
  const blend=ease(age/.1);
  c.save();c.globalAlpha*=blend;
  c.fillStyle='#050c0990';c.beginPath();
  c.ellipse(Math.cos(facing)*travel*.45,Math.sin(facing)*travel*.25+1,isBossKind(kind)?32:kind==='brute'?20:14,isBossKind(kind)?10:4,0,0,Math.PI*2);c.fill();c.restore();
  // Short silhouette handoff. There is no transformation of the standing image.
  if(blend<1) {
    c.save();c.globalAlpha*=1-blend;
    drawHumanoid(c,{kind,angle:facing,time:motion?.phase??0,moving:Math.min(1,Math.hypot(motion?.vx??0,motion?.vy??0)/70),moveAngle:Math.atan2(motion?.vy??0,motion?.vx??0),attack:motion?.attack??0,attackAngle:motion?.attackAngle??facing,hitFlash:0,dodging:false});c.restore();
  }
  if(blend>0) {
    c.save();c.globalAlpha*=blend;
    if(isRegionalEnemy(kind))drawRegionalDeath(c,kind,recipe,age,facing);
    else if(kind==='hound')drawHoundDeath(c,recipe,age,facing);
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
export function deathDepth(r:EnemyRemains,reducedMotion=false):number {
  const pose=deathPose(r,reducedMotion),age=r.element==='frost'?0:pose.age;
  const recipe=enemyDeathAnimation(r.kind,r.variant);
  const distance=r.kind==='hound'||r.kind==='wisp'||isRegionalEnemy(r.kind)?recipe.travel*ease(age/recipe.contact):humanoidDeathPose(recipe,age).hip[1]*DEATH_MATERIALS[r.kind].scale;
  return r.y+pose.y+Math.sin(r.facing)*distance*.55*(r.motion?.scale??1);
}
export function drawEnemyRemains(c:CanvasRenderingContext2D,r:EnemyRemains,reducedMotion:boolean):void {
  const pose=deathPose(r,reducedMotion);
  if(pose.opacity<=.001)return;
  c.save();c.translate(r.x+pose.x,r.y+pose.y);c.scale(r.motion?.scale??1,r.motion?.scale??1);c.globalAlpha*=pose.opacity;
  if((pose.settled || r.element === 'frost')&&typeof document!=='undefined') {
    let art=settledArt.get(r);
    const size=isBossKind(r.kind)?384:192;
    if(!art) {
      art=document.createElement('canvas');art.width=art.height=size*2;
      const ctx=art.getContext('2d')!;ctx.translate(size,size);ctx.scale(2,2);
      drawDeathFigure(ctx,r.kind,r.variant,r.element === 'frost' ? 0 : enemyDeathAnimation(r.kind,r.variant).settle,r.facing,r.motion);
      if (r.element === 'frost' || r.element === 'fire') {
        ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = r.element === 'frost' ? '#83d9eeb5' : '#211e20b8';
        ctx.fillRect(-size, -size, size * 2, size * 2);
        if (r.element === 'frost') { ctx.strokeStyle = '#e5fcffb0'; ctx.lineWidth = .65;
          for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(-32 + i * 8, -60); ctx.lineTo(-19 + i * 5, -29); ctx.lineTo(-30 + i * 8, 10); ctx.stroke(); }
        }
      }
      if(settledArt.size>=45) settledArt.delete(settledArt.keys().next().value!);
      settledArt.set(r,art);
    }
    c.drawImage(art,-size/2,-size/2,size,size);
  } else drawDeathFigure(c,r.kind,r.variant,pose.age,r.facing,r.motion);
  if (!reducedMotion && r.element === 'lightning' && r.age < DEATH_RESPONSE_TIMING.lightningArcs) {
    c.save(); c.globalCompositeOperation='lighter'; c.globalAlpha *= (1-r.age/DEATH_RESPONSE_TIMING.lightningArcs);
    for(let strand=0;strand<3;strand++) {
      c.beginPath();
      for(let i=0;i<7;i++) {
        const x=(strand-1)*ENEMY_BODY_BOUNDS[r.kind].radiusX*.55+Math.sin(i*2.7+r.id+Math.floor(r.age*24))*5;
        const y=ENEMY_BODY_BOUNDS[r.kind].top*(1-i/6);
        if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
      }
      c.strokeStyle='#719ef47a';c.lineWidth=3;c.stroke();
      c.strokeStyle='#d9f8ff';c.lineWidth=.7;c.stroke();
    }
    c.restore();
  }
  c.restore();
}
