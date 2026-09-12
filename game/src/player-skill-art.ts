import type { Player } from './model.ts';
/** Bounded, read-only stance engravings drawn beside the actor in the world pass. */
export function drawPlayerSkillEffects(c:CanvasRenderingContext2D,p:Player,x:number,y:number,time:number):void {
 const s=p.skillEffects;if(!s||p.dead)return;c.save();c.translate(x,y);c.lineWidth=1.4;
 for(const [id,b]of Object.entries(s.shelters??{})){c.strokeStyle=id==='smokeVeil'?'#9bbfc6':'#f0d5a2';c.globalAlpha=Math.min(.7,b.remaining*2);for(let i=0;i<6;i++){const a=i*Math.PI/3+time*.1;c.beginPath();c.ellipse(0,-8,27+i%2*3,16+i%2*4,0,a,a+.55);c.stroke();}}
 if(s.ward){const strength=Math.min(1,s.ward.capacity/Math.max(1,p.maxHp*.18));c.strokeStyle='#9ed6d5';c.globalAlpha=.35+strength*.4;c.beginPath();c.ellipse(0,-18,19,27,0,0,Math.PI*2);c.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3+time*.15;c.beginPath();c.moveTo(Math.cos(a)*19,Math.sin(a)*27-18);c.lineTo(Math.cos(a)*23,Math.sin(a)*31-18);c.stroke();}}
 for(const [id,color]of [['brace','#cfb88f'],['rallyOfIron','#dc9a64'],['ghostHunt','#b9d9c9']] as const){const b=s[id];if(!b)continue;c.globalAlpha=Math.min(.7,b.remaining*2);c.strokeStyle=color;c.beginPath();c.ellipse(0,2,id==='brace'?19:25,7,0,0,Math.PI*2);c.stroke();if(b.charges)for(let i=0;i<b.charges;i++){const a=Math.PI+(i+1)*Math.PI/(b.charges+1);c.fillStyle=color;c.fillRect(Math.cos(a)*24-1,Math.sin(a)*18-15,2,5);}}
 c.restore();
}
