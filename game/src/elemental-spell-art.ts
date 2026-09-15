import { line, polygon } from './art-primitives.ts';
import { drawGlow } from './lighting.ts';
const TAU = Math.PI * 2;

/** Stateless, bounded particles: no emitter backlog or persistent per-particle allocations. */
export function drawIceCrystal(c: CanvasRenderingContext2D, x: number, y: number, size: number, angle = 0): void {
  c.save(); c.translate(x, y); c.rotate(angle);
  polygon(c, [[0,-size],[size*.3,-size*.2],[size*.18,size*.25],[-size*.24,size*.12],[-size*.32,-size*.25]], '#448fb8');
  polygon(c, [[0,-size],[size*.3,-size*.2],[0,size*.2]], '#b7eefe');
  polygon(c, [[0,-size],[0,size*.2],[-size*.24,size*.12]], '#78bcd7');
  line(c, [[0,-size],[0,size*.12]], '#f0ffff', 1);
  c.restore();
}

/** Local projectile coordinates, pointing right. Only the authored player spells use this art. */
export function drawElementalMissile(c: CanvasRenderingContext2D, frost: boolean, seed: number, time: number, wake: number, reduced: boolean): void {
  const t = reduced ? 0 : time;
  if (frost) {
    c.globalCompositeOperation = 'lighter';
    for (let i=0;i<3;i++) {
      c.globalAlpha=.18;
      line(c, [[-85*wake,(i-1)*7],[-35*wake,(i-1)*4],[18,0]], i===1?'#e0ffff':'#659edc', 2+i);
    }
    c.globalAlpha=1; c.globalCompositeOperation='source-over';
    drawIceCrystal(c, 2, 0, 30, Math.PI/2);
    drawIceCrystal(c, -17, -5, 12, Math.PI*.35);
    drawIceCrystal(c, -20, 5, 10, Math.PI*.68);
  } else {
    c.globalCompositeOperation='lighter';
    for(let i=0;i<5;i++) {
      const side=(i-2)*3, curl=Math.sin(t*15+seed+i*2)*5;
      c.globalAlpha=.28;
      polygon(c, [[12,0],[-8,-10+side],[-38*wake,side+curl],[-78*wake,side*1.5],[-33*wake,side+6],[-8,10+side]], i%2?'#ff6d27':'#ffbc52');
    }
    for(let i=0;i<6;i++) {
      const a=i/6*TAU+t*3, r=5+Math.sin(t*13+i)*1.5;
      c.globalAlpha=.42;c.fillStyle=i%2?'#ff7c2c':'#ffd06b';
      c.beginPath();c.ellipse(Math.cos(a)*5-2,Math.sin(a)*4,r*1.4,r,0,0,TAU);c.fill();
    }
    c.globalAlpha=.95;c.fillStyle='#ffe3a0';c.beginPath();c.ellipse(2,0,9,5.5,0,0,TAU);c.fill();
    c.fillStyle='#fff9df';c.beginPath();c.ellipse(4,-1,5,3.5,0,0,TAU);c.fill();
  }
  if (!reduced) for(let i=0;i<12;i++) {
    const phase=(t*(frost?1.2:1.8)+i/12+seed*.17)%1;
    const x=-(18+phase*92)*wake, y=Math.sin(i*9+seed)*phase*(frost?17:23);
    c.globalAlpha=(1-phase)*.7;
    if(frost) drawIceCrystal(c,x,y,2+phase*4,phase*3+i);
    else line(c,[[x+4,y],[x,y-2-phase*4]],i%3?'#ff9642':'#ffe8ad',1.5);
  }
  c.globalAlpha=1;
}

/** Confirmed frost contact. Growth is aftermath, never delayed damage. */
export function drawFrostBloom(c: CanvasRenderingContext2D, radius: number, life: number, seed: number, reduced: boolean, ultimate=false): void {
  const p=1-life, spread=reduced?1:1-Math.pow(life,5);
  const count=ultimate?24:14;
  c.globalCompositeOperation='lighter';
  for(let i=0;i<count;i++) {
    const a=i/count*TAU+seed*.21, extent=radius*(.7+(i%3)*.12)*spread;
    const dx=Math.cos(a),dy=Math.sin(a);
    c.globalAlpha=life*.5;
    line(c,[[dx*radius*.18,dy*radius*.18],[dx*extent*.35-dy*8,dy*extent*.35+dx*8],[dx*extent*.55+dy*5,dy*extent*.55-dx*5],[dx*extent*.8-dy*4,dy*extent*.8+dx*4],[dx*extent,dy*extent]],'#91d4ee',1.2);
    for(const side of [-1,1]) line(c,[[dx*extent*.65,dy*extent*.65],[dx*extent*.48-dy*side*12,dy*extent*.48+dx*side*12]],'#aee5f2',.8);
  }
  c.globalAlpha=life*.7;c.strokeStyle='#c7f6ff';c.lineWidth=1.5;
  c.beginPath();c.arc(0,0,radius*spread,0,TAU);c.stroke();
  if(!reduced) for(let i=0;i<18;i++) {
    const a=i*2.399+seed,d=radius*(.35+p*.65),x=Math.cos(a)*d,y=Math.sin(a)*d;
    c.globalAlpha=life*.45;
    line(c,[[x,y-p*12],[x-Math.cos(a)*5,y-p*12-Math.sin(a)*5]],'#e1ffff',1);
  }
  c.globalCompositeOperation='source-over';
  for(let i=0;i<count;i++) {
    const a=i/count*TAU+seed*.21, d=radius*(.63+(i%4)*.09);
    const grow=reduced?.7:Math.sin(Math.PI*Math.min(1,p*1.5));
    c.globalAlpha=life*.9;
    drawIceCrystal(c,Math.cos(a)*d,Math.sin(a)*d,Math.min(radius*.22,ultimate?35:20)*grow+(i%3)*Math.min(3,radius*.035),a*.1);
  }
  c.globalAlpha=1;drawGlow(c,0,0,radius*.7,'#78c9f5',life*.2);
}

export function drawFireImpact(c: CanvasRenderingContext2D, radius: number, life: number, seed: number, reduced: boolean, meteor: boolean): void {
  const p=1-life, spread=reduced?.85:1-Math.pow(life,5), count=meteor?24:16;
  c.globalCompositeOperation='lighter';
  c.globalAlpha=life*.65;c.strokeStyle='#ffd4a1';c.lineWidth=1+life*3;
  c.beginPath();c.arc(0,0,radius*spread,0,TAU);c.stroke();
  for(let i=0;i<count;i++) {
    const a=i/count*TAU+seed*.7, d=radius*spread*(.6+(i%4)*.1);
    const x=Math.cos(a)*d,y=Math.sin(a)*d;
    const h=reduced?8:Math.sin(p*Math.PI)*(meteor?60:28)*( .5+(i%3)*.3);
    c.globalAlpha=life*.55;
    polygon(c,[[x-10*life,y],[x-8*life,y-h*.3],[x-3,y-h*.65],[x+4,y-h],[x+2,y-h*.5],[x+10*life,y-h*.2],[x+8*life,y]],i%3?'#fa7b32':'#ffd68e');
    c.globalAlpha=life*.13;c.fillStyle='#fa8540';
    c.beginPath();c.ellipse(x,y-h*.25,6+life*8,5+life*12,-a,0,TAU);c.fill();
    if(!reduced) {
      const lift=Math.sin(p*Math.PI)*(meteor?75:32);
      c.globalAlpha=life;
      line(c,[[x,y-lift],[x-Math.cos(a)*7,y-lift-5]],'#ffdca2',1.3);
      if(meteor&&i%2===0) {
        c.globalCompositeOperation='source-over';
        polygon(c,[[x-4,y-lift],[x-2,y-lift-6],[x+4,y-lift-3],[x+3,y-lift+2]],'#5e453e');
        line(c,[[x-2,y-lift-6],[x+4,y-lift-3]],'#fda66c',1);
        c.globalCompositeOperation='lighter';
      }
    }
  }
  c.globalAlpha=1;drawGlow(c,0,-8,radius*.55,'#ffb15a',Math.pow(life,3)*.6);
  if(meteor) {
    c.globalCompositeOperation='source-over';c.globalAlpha=life*.18;c.fillStyle='#342222';
    c.beginPath();c.ellipse(0,0,radius*.55,radius*.45,0,0,TAU);c.fill();
    c.globalCompositeOperation='lighter';
    for(let i=0;i<8;i++) {
      const a=i/8*TAU+seed,d=radius*.5;
      c.globalAlpha=life*.6;line(c,[[Math.cos(a)*d*.3,Math.sin(a)*d*.3],[Math.cos(a+.14)*d*.6,Math.sin(a+.14)*d*.6],[Math.cos(a)*d,Math.sin(a)*d]],'#ffb76e',1.4);
    }
  }
}

/** Storm boundary follows the live field; narrow strikes use its actual pulse clock. */
export function drawTempestField(c: CanvasRenderingContext2D, radius: number, seed: number, time: number, pulse: number, fade: number, reduced: boolean): void {
  const turn=reduced?0:time*.45;
  c.globalCompositeOperation='lighter';
  for(let i=0;i<5;i++) {
    c.globalAlpha=fade*.3;c.strokeStyle=i%2?'#8897e7':'#addce9';c.lineWidth=1.2;
    c.beginPath();c.arc(0,0,radius*(.83+i*.03),turn+i*TAU/5,turn+i*TAU/5+.65);c.stroke();
  }
  if(!reduced) for(let i=0;i<16;i++) {
    const a=i/16*TAU+turn,d=radius*(.84+(i%3)*.06),x=Math.cos(a)*d,y=Math.sin(a)*d;
    c.globalAlpha=fade*.35;
    line(c,[[x,y],[Math.cos(a-.035)*d,Math.sin(a-.035)*d-2]],i%3?'#929eda':'#e5f9ff',1.3);
  }
  for(let i=0;i<4;i++) {
    const a=seed+i*2.4+turn*.5,d=radius*(.58+i*.09),x=Math.cos(a)*d,y=Math.sin(a)*d;
    c.globalAlpha=fade*(reduced?.25:Math.pow(pulse,3)*.8);
    line(c,[[x-12,y-85],[x+5,y-51],[x-6,y-34],[x,y]],'#8483e6',4);
    line(c,[[x-12,y-85],[x+5,y-51],[x-6,y-34],[x,y]],'#d9f5ff',1.1);
  }
}
