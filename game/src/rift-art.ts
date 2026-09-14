import { drawGlow } from './lighting.ts';
/** A torn aperture and living tendrils, unlike the town portal's circular stone arch. */
export function drawRiftPortal(c:CanvasRenderingContext2D,x:number,y:number,time:number,scale=1):void {
  c.save();c.translate(x,y);c.scale(scale,scale);
  drawGlow(c,0,-42,108,'#b92967',.33);drawGlow(c,0,-40,62,'#f34771',.24);
  c.fillStyle='#100b1888';c.beginPath();c.ellipse(0,5,57,17,0,0,Math.PI*2);c.fill();
  for(let i=0;i<8;i++){
    const side=i%2?1:-1,base=8+i*3,reach=30+i*5,wave=Math.sin(time*.7+i)*7;
    c.beginPath();c.moveTo(side*base,0);c.bezierCurveTo(side*(reach+12),-25-i*4,side*(reach+12+wave),18-i*9,side*(reach-3),-12-i*8);
    c.lineWidth=9-i*.7;c.strokeStyle='#321627';c.stroke();c.lineWidth=3-i*.2;c.strokeStyle=i%3?'#a34770':'#df789b';c.stroke();
  }
  c.beginPath();c.moveTo(0,-108);c.bezierCurveTo(-24,-87,-28,-68,-24,-43);c.bezierCurveTo(-18,-27,-23,-11,0,4);c.bezierCurveTo(20,-15,13,-34,24,-54);c.bezierCurveTo(29,-77,13,-91,0,-108);
  const g=c.createLinearGradient(-25,0,25,-100);g.addColorStop(0,'#260e2c');g.addColorStop(.5,'#060911');g.addColorStop(1,'#6d153f');c.fillStyle=g;c.fill();c.lineWidth=3;c.strokeStyle='#f175a1';c.stroke();
  c.save();c.clip();for(let i=0;i<9;i++){const yy=-105+((time*15+i*13)%118);c.strokeStyle=i%2?'#e362af66':'#8a4ccd66';c.lineWidth=1.2;c.beginPath();c.moveTo(-26,yy);c.bezierCurveTo(-4,yy-18,3,yy+18,28,yy-7);c.stroke();}c.restore();
  c.strokeStyle='#ffd1dc';c.lineWidth=.9;c.beginPath();c.moveTo(0,-105);c.bezierCurveTo(-16,-79,-18,-61,-21,-50);c.stroke();
  for(let i=0;i<10;i++){const a=i*2.4+time*.16,r=36+i*3,xx=Math.cos(a)*r,yy=-45+Math.sin(a)*r*.9;c.fillStyle=i%3?'#d884b1':'#ffe0d9';c.globalAlpha=.3+.35*Math.sin(time+i)**2;c.fillRect(xx,yy,1.6,2.8);}c.restore();
}

/** One local storm: a gathering seal, converging lightning and a short arrival flare. */
export function drawRiftArrival(c:CanvasRenderingContext2D,x:number,y:number,age:number,duration:number,reduced:boolean):void {
 if(age<0||age>duration+.55)return;
 const charge=Math.min(1,age/duration),after=Math.max(0,age-duration),fade=after?Math.max(0,1-after/.55):1;
 c.save();c.translate(x,y);c.globalAlpha=fade;
 drawGlow(c,0,-35,160,'#bd2868',.4+charge*.3);
 c.strokeStyle='#ef72b1';c.lineWidth=2;c.beginPath();c.ellipse(0,0,90,33,0,0,Math.PI*2);c.stroke();
 c.strokeStyle='#ffa1ce';c.lineWidth=1;c.beginPath();c.ellipse(0,0,105-charge*14,39-charge*5,0,0,Math.PI*2);c.stroke();
 const phase=reduced?0:age*1.2;
 for(let i=0;i<8;i++){const a=i*Math.PI/4+phase,xx=Math.cos(a)*90,yy=Math.sin(a)*33;c.beginPath();c.moveTo(xx-4,yy);c.lineTo(xx,yy-6);c.lineTo(xx+4,yy);c.lineTo(xx,yy+6);c.closePath();c.stroke();}
 if(!reduced){
  for(let bolt=0;bolt<3;bolt++){
   const spread=(1-charge)*80,offset=(bolt-1)*spread;
   c.beginPath();c.moveTo(offset,-370);
   for(let i=1;i<=9;i++){const yy=-370+i*40,jitter=Math.sin(i*9+bolt*4+age*12)*24*(1-i/10);c.lineTo(offset*(1-i/9)+jitter,yy);}
   c.lineTo(0,0);c.strokeStyle='#d5438c';c.lineWidth=5+charge*3;c.globalAlpha=fade*(.2+charge*.4);c.stroke();
   c.strokeStyle='#ffd1eb';c.lineWidth=1.3;c.globalAlpha=fade*(.35+charge*.55);c.stroke();
  }
 }
 if(after>0){c.globalAlpha=fade;drawGlow(c,0,-30,150+after*100,'#f8a6d5',.75*fade);}
 c.restore();
}
