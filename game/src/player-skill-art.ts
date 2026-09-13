import { AURA_IDS, AURAS } from './aura-content.ts';
import { auraPower } from './auras.ts';
import { SPELLWEAVE_FEEDBACK_DURATION } from './affix-combat.ts';
import type { CharacterPose } from './art-types.ts';
import { playerMotion, characterTransform, PLAYER_ART_SCALE } from './character-motion.ts';
import { projectArmPoint } from './player-arm-rig.ts';
import { transformPoint } from './art-primitives.ts';
import { UNIQUE_RULES } from './unique-content.ts';
import { deriveAttackStats } from './equipment.ts';
import type { Player } from './model.ts';
/** Bounded, read-only stance engravings drawn beside the actor in the world pass. */
export function drawPlayerSkillEffects(c:CanvasRenderingContext2D,p:Player,x:number,y:number,time:number,pose:CharacterPose,reducedMotion=false):void {
 if(p.dead)return;
 const auras=AURA_IDS.filter(id=>auraPower(p,id)>0);
 if(auras.length){
   c.save();c.translate(x,y+2);c.lineWidth=1.4;c.globalAlpha=.65;
   for(let i=0;i<auras.length;i++){
     const angle=(reducedMotion?0:time*.18)+i*Math.PI*2/auras.length;
     c.strokeStyle=c.fillStyle=AURAS[auras[i]].color;
     c.beginPath();c.ellipse(0,0,29,11,0,angle,angle+Math.PI*2/auras.length*.82);c.stroke();
     const ax=Math.cos(angle)*29,ay=Math.sin(angle)*11;
     c.beginPath();c.moveTo(ax,ay-3);c.lineTo(ax+2,ay);c.lineTo(ax,ay+3);c.lineTo(ax-2,ay);c.closePath();c.fill();
   }
   c.restore();
 }

 const weave=p.affixBuffs;
 if(weave && (weave.melee > 0 || weave.spell > 0 || (weave.spent?.remaining ?? 0) > 0)){
   const spent=weave.spent, flash=spent ? spent.remaining/SPELLWEAVE_FEEDBACK_DURATION : 0, motion=playerMotion(pose);
   const hands = [{weapon:p.equipment.mainHand, hand:motion.weaponArm.hand},
     ...(p.equipment.offHand?.kind==='weapon'?[{weapon:p.equipment.offHand.weapon,hand:motion.offArm.hand}]:[])];
   c.save();c.translate(x,y);c.lineWidth=1.4;
   for(const {weapon,hand} of hands){
     const kind=weapon.attackKind==='bolt'?'spell':weapon.attackKind==='melee'?'melee':null;
     if(!kind)continue;
     const ready=weave[kind]>0, pulse=spent?.kind===kind?flash:0, expansion=reducedMotion?0:pulse;
     if(!ready&&!pulse)continue;
     const body=transformPoint(motion.body,projectArmPoint(hand));
     const point=transformPoint(characterTransform(pose),[body[0]*PLAYER_ART_SCALE,body[1]*PLAYER_ART_SCALE]);
     c.strokeStyle=kind==='spell'?'#c7a0ef':'#e5bd80';c.globalAlpha=(ready?.45:0)+pulse*.2;
     c.beginPath();c.ellipse(point[0],point[1],5+expansion*12,9+expansion*10,0,time*.7,time*.7+Math.PI*1.6);c.stroke();
   }
   c.restore();
 }
 const s=p.skillEffects;if(!s)return;c.save();c.translate(x,y);c.lineWidth=1.4;
 for(const [id,b]of Object.entries(s.shelters??{})){c.strokeStyle=id==='smokeVeil'?'#9bbfc6':'#f0d5a2';c.globalAlpha=Math.min(.7,b.remaining*2);for(let i=0;i<6;i++){const a=i*Math.PI/3+time*.1;c.beginPath();c.ellipse(0,-8,27+i%2*3,16+i%2*4,0,a,a+.55);c.stroke();}}
 if(s.embers?.length){for(let i=0;i<s.embers.length;i++){
   const a=time*1.2+i*Math.PI*2/s.embers.length,ex=Math.cos(a)*27,ey=-22+Math.sin(a)*12;
   c.globalAlpha=.8;c.fillStyle='#bc518b';c.beginPath();c.arc(ex,ey,5,0,Math.PI*2);c.fill();
   c.fillStyle='#ffc288';c.beginPath();c.arc(ex,ey,2.5,0,Math.PI*2);c.fill();
 }}
 if(s.returnStep){c.strokeStyle='#c8afdf';c.globalAlpha=Math.min(.65,s.returnStep.remaining);c.beginPath();c.ellipse(s.returnStep.x-p.x,s.returnStep.y-p.y,17,8,0,0,Math.PI*2);c.stroke();}
 if(s.borrowed&&s.borrowed.capacity>0){c.strokeStyle='#da8fb6';c.globalAlpha=.6;c.beginPath();c.ellipse(0,-18,23,30,0,0,Math.PI*2);c.stroke();}
 if(s.ward){const strength=Math.min(1,s.ward.capacity/Math.max(1,p.maxHp*.18));c.strokeStyle='#9ed6d5';c.globalAlpha=.35+strength*.4;c.beginPath();c.ellipse(0,-18,19,27,0,0,Math.PI*2);c.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3+time*.15;c.beginPath();c.moveTo(Math.cos(a)*19,Math.sin(a)*27-18);c.lineTo(Math.cos(a)*23,Math.sin(a)*31-18);c.stroke();}}
 for(const [id,color]of [['brace','#cfb88f'],['rallyOfIron','#dc9a64'],['ghostHunt','#b9d9c9']] as const){const b=s[id];if(!b)continue;c.globalAlpha=Math.min(.7,b.remaining*2);c.strokeStyle=color;c.beginPath();c.ellipse(0,2,id==='brace'?19:25,7,0,0,Math.PI*2);c.stroke();if(b.charges)for(let i=0;i<b.charges;i++){const a=Math.PI+(i+1)*Math.PI/(b.charges+1);c.fillStyle=color;c.fillRect(Math.cos(a)*24-1,Math.sin(a)*18-15,2,5);}}
 if(s.draw&&!s.draw.released){
   const fill=Math.min(1,s.draw.elapsed/UNIQUE_RULES.drawTime);
   c.strokeStyle=fill>=1?'#e4efd0':'#a9cf9e';c.globalAlpha=.35+fill*.5;c.lineWidth=1.5;
   c.beginPath();c.ellipse(0,2,26,10,0,Math.PI,Math.PI+Math.PI*2*fill);c.stroke();
   c.translate(Math.cos(p.angle)*24,Math.sin(p.angle)*12-23);c.rotate(p.angle);
   c.beginPath();c.moveTo(-4-fill*6,0);c.lineTo(8+fill*8,0);c.moveTo(3+fill*8,-4);c.lineTo(8+fill*8,0);c.lineTo(3+fill*8,4);c.stroke();
 }
 if(s.bastion){
   const fill=Math.min(1,s.bastion.damage/Math.max(1,deriveAttackStats(p.stats,p.equipment.mainHand).damage*UNIQUE_RULES.bastionCap));
   c.strokeStyle='#e8cf99';c.globalAlpha=Math.min(.85,s.bastion.remaining)*fill;c.lineWidth=2;
   c.beginPath();c.moveTo(-20,-29);c.lineTo(-20,-14);c.lineTo(-13,-8);c.lineTo(-6,-14);c.lineTo(-6,-29);c.stroke();
   for(let i=0;i<3;i++){c.globalAlpha=i/3<fill?.8:.15;c.beginPath();c.moveTo(-18,-24+i*5);c.lineTo(-13,-21+i*5);c.lineTo(-8,-24+i*5);c.stroke();}
 }
 c.restore();
}
/** World-anchored conduit, kept in actor depth order independently of the player. */
export function drawConductor(c:CanvasRenderingContext2D,p:Player):void {
 const s=p.skillEffects?.conductor;if(!s||p.dead)return;
 c.save();c.translate(s.x,s.y);c.globalAlpha=Math.min(1,s.remaining*2);c.strokeStyle='#baa5ee';c.lineWidth=1.5;
 c.beginPath();c.ellipse(0,0,19,8,0,0,Math.PI*2);c.stroke();
 c.fillStyle='#292139';c.beginPath();c.moveTo(0,-37);c.lineTo(7,-19);c.lineTo(0,-9);c.lineTo(-7,-19);c.closePath();c.fill();c.stroke();
 c.strokeStyle='#e2d8ff';c.beginPath();c.moveTo(1,-29);c.lineTo(-3,-20);c.lineTo(3,-20);c.lineTo(0,-12);c.stroke();
 c.beginPath();c.moveTo(0,-8);c.lineTo(0,-1);c.stroke();c.restore();
}
export function drawHarvestMark(c:CanvasRenderingContext2D,p:Player,id:number,x:number,y:number):void {
 const mark=p.skillEffects?.harvest?.find(m=>m.target===id);if(!mark)return;
 c.save();c.translate(x,y-66);c.globalAlpha=Math.min(.85,mark.remaining*2);c.strokeStyle='#f198aa';c.lineWidth=1.5;
 c.beginPath();c.moveTo(0,-9);c.lineTo(6,0);c.lineTo(0,7);c.lineTo(-6,0);c.closePath();c.stroke();
 c.beginPath();c.moveTo(-9,-4);c.lineTo(-3,2);c.moveTo(9,-4);c.lineTo(3,2);c.stroke();c.restore();
}
