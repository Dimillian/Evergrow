import type { Enemy } from './model.ts';
import { enemyModifiers, enemyVisualScale } from './enemy-modifiers.ts';
import { drawGlow } from './lighting.ts';
/** Bounded emissive signatures: no particles, dynamic lights or extra character draws. */
export function drawEnemyTraits(c:CanvasRenderingContext2D,enemy:Enemy,x:number,y:number,time:number,reduced:boolean):void {
 const traits=enemyModifiers(enemy);if(!traits.length)return;
 const scale=enemyVisualScale(enemy),radius=Math.max(20,enemy.radius*1.6),t=reduced?0:time;
 const rank=enemy.rank==='elite'?'#f2bf6a':'#74c8ff';
 c.save();c.translate(x,y);c.scale(scale,scale);
 drawGlow(c,0,-23,radius*1.7,rank,.34);
 c.strokeStyle=rank;c.lineWidth=1.3;c.globalAlpha=.8;
 c.beginPath();c.ellipse(0,2,radius,radius*.3,0,0,Math.PI*2);c.stroke();
 for(const trait of traits){
  c.strokeStyle=trait.color;c.fillStyle=trait.color;c.lineWidth=1.6;c.globalAlpha=.85;
  if(trait.id==='swift'){
   for(let i=0;i<3;i++){const side=i%2?1:-1,yy=-12-i*11+Math.sin(t*3+i)*2;c.beginPath();c.moveTo(side*(radius+5),yy+7);c.quadraticCurveTo(side*(radius+12),yy,side*(radius+2),yy-8);c.stroke();}
  }else if(trait.id==='relentless'){
   for(const side of [-1,1]){const yy=-24+Math.sin(t*4+side)*4;c.beginPath();c.moveTo(side*(radius-2),yy-10);c.lineTo(side*(radius+5),yy-3);c.lineTo(side*(radius-1),yy+2);c.lineTo(side*(radius+5),yy+9);c.stroke();}
  }else if(trait.id==='savage'){
   for(const side of [-1,1])for(let i=0;i<2;i++){c.beginPath();c.moveTo(side*(radius+i*4-5),-10);c.lineTo(side*(radius+i*4),-28);c.lineTo(side*(radius+i*4-3),-37);c.stroke();}
  }else{
   c.beginPath();c.ellipse(0,-23,radius*.95,28,Math.sin(t)*.08,0,Math.PI*2);c.stroke();
   for(const side of [-1,1]){c.beginPath();c.moveTo(side*radius,-27);c.lineTo(side*radius+4,-23);c.lineTo(side*radius,-19);c.lineTo(side*radius-4,-23);c.closePath();c.fill();}
  }
 }
 c.restore();
}
