import type { Enemy } from './model.ts';
import { isWildernessBoss, LAIR_RULES as R, BOSS_PALETTES } from './wilderness-boss-content.ts';
import { line, polygon, type Point } from './art-primitives.ts';
import { drawGlow } from './lighting.ts';
/** Short lived impact surfaces share the exact attack origins and lengths used by contact. */
export function drawWildernessBossImpact(c:CanvasRenderingContext2D,e:Enemy,time:number,reduced:boolean):void {
 if(!isWildernessBoss(e.kind)||e.state!=='attack')return;
 const tint=BOSS_PALETTES[e.kind],progress=Math.min(1,e.stateTime/Math.max(.01,e.stateDuration));
 c.save();
 if(e.bossMove==='fracture'){
  for(let lane=0;lane<3;lane++){
   if(e.stateTime<lane*.2)continue;
   const age=(e.stateTime-lane*.2)/.5,fade=Math.max(0,1-age);
   c.save();c.translate(e.bossOriginX??e.x,e.bossOriginY??e.y);c.rotate(e.attackAngle+(lane-1)*.55);
   const points:Point[]=Array.from({length:15},(_,i)=>[i*R.fractureLength/14,Math.sin(i*4.17+lane)*R.fractureWidth*.35]);
   c.globalAlpha=fade;line(c,points,e.kind==='briarMatriarch'?'#334a30':'#231f21',9);line(c,points,tint,3.5);line(c,points,'#fff0d0',.9);
   for(let i=2;i<14;i+=2){const [x,y]=points[i];const side=i%4?1:-1;polygon(c,[[x-8,y],[x+4,y-4],[x+side*10,y-17*(1-age)],[x+9,y+5]],e.kind==='briarMatriarch'?'#77946a':'#a18b74');drawGlow(c,x,y,27,tint,.3*fade);}
   c.restore();
  }
 }else if(e.bossMove==='eruption'){
  c.translate(e.attackTargetX,e.attackTargetY);c.globalAlpha=1-progress*.75;
  drawGlow(c,0,0,R.eruptionRadius,tint,.5*(1-progress));
  for(let i=0;i<18;i++){const a=i*2.39996,r=R.eruptionRadius*(.25+(i%5)*.15),x=Math.cos(a)*r,y=Math.sin(a)*r;
   const h=(reduced?12:10+Math.sin(time*13+i)*6)*(1-progress*.6);
   polygon(c,[[x-4,y],[x-1,y-h],[x+3,y-h*.45],[x+5,y]],i%3?'#e99750':'#fff0be');}
 }else if(e.bossMove==='rush'){
  line(c,[[e.bossOriginX??e.x,e.bossOriginY??e.y],[e.x,e.y]],tint+'55',5);
  drawGlow(c,e.x,e.y-15,55,tint,.28);
 }else if(e.bossMove==='sweep'){
  c.translate(e.x,e.y);c.rotate(e.attackAngle);c.strokeStyle=tint;c.lineWidth=3*(1-progress)+1;c.globalAlpha=1-progress;
  c.beginPath();c.arc(0,0,R.sweepReach*.85,-R.sweepArc*.5,-R.sweepArc*.5+R.sweepArc*Math.max(.08,progress));c.stroke();
 }
 c.restore();
}
