import { drawFortification } from './settlement-wall-art.ts';
import { drawSupplyCart } from './cart-art.ts';
import { architectureStyle } from './settlement-style.ts';
import { vendorIdentity } from './vendor-identity.ts';
import { drawVendorGlyph } from './vendor-identity-art.ts';
import type { Building } from './settlements.ts';
import { drawGlow } from './lighting.ts';
const poly=(c:CanvasRenderingContext2D,p:number[][],color:string)=>{c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();};
/** Uncached small fixtures share the exact collision footprint; floors never become houses. */
export function drawSettlementFixture(c:CanvasRenderingContext2D,b:Building,time:number):void {
  if(b.wallSegment){drawFortification(c,b);return;}
  if(b.kind==='cart'){drawSupplyCart(c,b);return;}
  c.save();c.translate(b.x,b.y);const w=b.width,h=b.height;
  c.fillStyle='#040b1090';c.beginPath();c.ellipse(w/2+6,h+2,w*.8,8,0,0,Math.PI*2);c.fill();
  if(b.kind==='hearth'){
    for(let i=0;i<9;i++){const a=i*Math.PI*2/9;poly(c,[[w/2+Math.cos(a)*20-4,h/2+Math.sin(a)*13],[w/2+Math.cos(a)*20,h/2+Math.sin(a)*13-5],[w/2+Math.cos(a)*20+6,h/2+Math.sin(a)*13-2],[w/2+Math.cos(a)*20+3,h/2+Math.sin(a)*13+4]],i%2?'#758078':'#505f5b');}
    c.strokeStyle='#57412c';c.lineWidth=6;c.beginPath();c.moveTo(3,17);c.lineTo(29,5);c.moveTo(3,5);c.lineTo(29,18);c.stroke();
    for(let i=0;i<5;i++){const x=6+i*5;poly(c,[[x-5,15],[x-3,-4],[x+Math.sin(time*6+i)*4,-20-Math.sin(time*4+i)*8],[x+5,12]],i%2?'#ffca70':'#e67938');}
    drawGlow(c,w/2,0,58,'#ffae55',.45);
    // Spare firewood is stacked immediately behind the fire.
    for(let i=0;i<4;i++){c.fillStyle='#785d3b';c.fillRect(-16+i*5,-14,5,20);c.fillStyle='#b49a65';c.beginPath();c.ellipse(-13.5+i*5,6,2.5,2,0,0,Math.PI*2);c.fill();}
  }else if(b.kind==='garden'){
    poly(c,[[0,3],[w-3,0],[w,h-2],[2,h]],'#413d2c');
    c.strokeStyle='#897553';c.lineWidth=2;c.strokeRect(0,1,w,h-2);
    for(let row=0;row<3;row++)for(let col=0;col<6;col++){
      const xx=6+col*(w-10)/6+Math.sin(b.seed+col)*1.8,yy=6+row*(h-7)/3;
      c.strokeStyle='#695736';c.lineWidth=1;c.beginPath();c.moveTo(xx-3,yy+2);c.lineTo(xx+5,yy+2);c.stroke();
      poly(c,[[xx,yy+2],[xx-4,yy-3],[xx-2,yy-5],[xx+1,yy-1],[xx+4,yy-6],[xx+6,yy-3]],row%2?'#819568':'#596f4f');
    }
  }else if(b.kind==='well'){
    c.fillStyle='#566260';c.beginPath();c.ellipse(w/2,h/2,w/2,h*.64,0,0,Math.PI*2);c.fill();
    c.fillStyle='#9eaa99';c.beginPath();c.ellipse(w/2,-2,w/2,h*.48,0,0,Math.PI*2);c.fill();
    c.fillStyle='#182c32';c.beginPath();c.ellipse(w/2,-2,w*.32,h*.28,0,0,Math.PI*2);c.fill();
    for(const x of[-3,w]){c.fillStyle='#84714f';c.fillRect(x,-38,4,51);}
    c.fillStyle='#aa8d5e';c.fillRect(-4,-38,w+10,4);c.strokeStyle='#c0ad7b';c.lineWidth=1;c.beginPath();c.moveTo(w/2,-35);c.lineTo(w/2,2);c.stroke();
    c.strokeStyle='#334742';for(let i=0;i<5;i++){c.beginPath();c.moveTo(3+i*6,4);c.lineTo(3+i*6,18);c.stroke();}
  }else if(b.kind==='stash'){
    poly(c,[[0,0],[w,0],[w,h],[0,h]],'#624d35');poly(c,[[0,0],[4,-13],[w-4,-13],[w,0]],'#a68a58');
    c.fillStyle='#bbad77';for(const x of[5,w-9])c.fillRect(x,-11,4,h+11);
    c.strokeStyle='#322f29';c.lineWidth=1;for(let x=12;x<w-9;x+=7){c.beginPath();c.moveTo(x,-10);c.lineTo(x,h);c.stroke();}
    c.fillStyle='#d4bd78';c.fillRect(w/2-4,1,8,8);c.fillStyle='#373b35';c.fillRect(w/2-1,3,2,4);
  }else if(b.kind==='torch'){
    c.fillStyle='#5a4935';c.fillRect(1,-35,5,42);c.fillStyle='#939580';c.fillRect(-1,-36,9,5);
    poly(c,[[-2,-34],[0,-47],[4+Math.sin(time*7+b.seed)*2,-58],[9,-37]],'#f6a653');poly(c,[[1,-35],[4,-47],[7,-35]],'#ffe5a4');drawGlow(c,3,-40,34,'#ffc274',.45);
  }else if(b.kind==='supplies'){
    for(let i=0;i<3;i++){
      const xx=i*7,yy=i%2?0:7;
      poly(c,[[xx,yy],[xx+3,yy-16],[xx+12,yy-16],[xx+16,yy],[xx+12,yy+7],[xx+2,yy+7]],i%2?'#9d926e':'#7d815f');
      c.strokeStyle='#c0af7a';c.lineWidth=1;c.beginPath();c.moveTo(xx+4,yy-14);c.lineTo(xx+11,yy-14);c.stroke();
    }
    c.fillStyle='#684c32';c.fillRect(1,10,w,10);c.strokeStyle='#baa075';c.strokeRect(1,10,w,10);
  }else if(b.kind==='bench'){
    for(const x of[3,w-5]){c.fillStyle='#51412f';c.fillRect(x,-4,3,15);}
    poly(c,[[0,-8],[w,-9],[w+2,-2],[-1,-1]],'#9d8052');c.strokeStyle='#c1a26a';c.beginPath();c.moveTo(2,-7);c.lineTo(w-2,-8);c.stroke();
  }else if(b.kind==='rack'){
    c.strokeStyle='#8c7550';c.lineWidth=3;c.beginPath();c.moveTo(0,h);c.lineTo(4,-36);c.lineTo(w,-36);c.lineTo(w+4,h);c.stroke();
    for(let i=0;i<3;i++){const xx=4+i*5;c.strokeStyle='#bcb6a3';c.lineWidth=1;c.beginPath();c.moveTo(xx,-33);c.lineTo(xx-3,0);c.stroke();poly(c,[[xx-3,-5],[xx-8,-16],[xx-4,-29],[xx+3,-25],[xx+2,-12]],i%2?'#71553e':'#95795a');}
    }c.restore();
}
export function drawMarketCanopy(c:CanvasRenderingContext2D,b:Building,time:number):void{
  const w=b.width,h=b.height,identity=vendorIdentity(b.kind)!,style=architectureStyle(b);
  c.save();c.translate(b.x,b.y);
  // Braced timber frame under a shallow, tensioned canvas roof.
  for(const xx of[3,w-5]){
    c.fillStyle='#64513a';c.fillRect(xx,-37,5,h+37);c.fillStyle='#b39362';c.fillRect(xx,-36,1,h+33);
    c.strokeStyle='#89704c';c.lineWidth=2;c.beginPath();c.moveTo(xx+2,-16);c.lineTo(xx+(xx<w/2?19:-16),-34);c.stroke();
  }
  c.strokeStyle='#ad8e5d';c.lineWidth=4;c.beginPath();c.moveTo(-2,-35);c.lineTo(w+2,-35);c.stroke();
  const front=h*.43-18,sway=Math.sin(time*1.5+b.seed)*.8;
  poly(c,[[-8,-39],[w+5,-39],[w+10,front],[-10,front]],identity.cloth);
  // Unequal broad panels and their fold shadows replace the striped awning rectangles.
  const panels=b.kind==='blacksmith'?3:5;
  for(let i=0;i<panels;i++){
    const x0=-8+(w+13)*i/panels,x1=-8+(w+13)*(i+1)/panels;
    poly(c,[[x0,-39],[x1,-39],[x1+5,front],[x0-2,front]],i%2?identity.dark:identity.cloth);
    c.strokeStyle=identity.color+'60';c.lineWidth=.8;c.beginPath();c.moveTo(x0+1,-36);c.bezierCurveTo(x0+2,-17,x0-2,front-8,x0-2,front);c.stroke();
  }
  c.strokeStyle=style.trim;c.lineWidth=1;c.beginPath();c.moveTo(-8,-39);c.lineTo(w+5,-39);c.lineTo(w+10,front);c.lineTo(-10,front);c.closePath();c.stroke();
  poly(c,[[-10,front],[w+10,front],[w+8,front+9+sway],[w*.7,front+11],[w*.4,front+8],[-9,front+9]],identity.cloth);
  c.strokeStyle=identity.color;c.lineWidth=2;c.beginPath();c.moveTo(-8,front+7);c.lineTo(w+7,front+7);c.stroke();
  // A dedicated side post keeps the emblem clear of the awning, counters and vendor.
  const sx=w+25,sy=front-7;
  c.strokeStyle='#89724c';c.lineWidth=4;c.beginPath();c.moveTo(w+13,h*.65);c.lineTo(w+13,sy-29);c.lineTo(sx+19,sy-29);c.stroke();
  c.strokeStyle='#c4ae7c';c.lineWidth=1;c.beginPath();c.moveTo(sx-10,sy-29);c.lineTo(sx-10,sy-16);c.moveTo(sx+10,sy-29);c.lineTo(sx+10,sy-16);c.stroke();
  poly(c,[[sx-16,sy-16],[sx+16,sy-16],[sx+16,sy+13],[sx,sy+19],[sx-16,sy+13]],identity.dark);
  c.strokeStyle=identity.color;c.lineWidth=1;c.stroke();drawVendorGlyph(c,b.kind,sx,sy,25);if(b.kind==='chapel')drawGlow(c,sx,sy,22,identity.color,.15+Math.sin(time*1.7)*.025);
  if(b.kind==='blacksmith'){
    for(let i=0;i<3;i++){const xx=15+i*9;c.strokeStyle='#c2c9b8';c.lineWidth=2;c.beginPath();c.moveTo(xx,h*.5);c.lineTo(xx-4,h*.5+19);c.stroke();c.strokeStyle='#c5a264';c.lineWidth=2;c.beginPath();c.moveTo(xx-4,h*.5+4);c.lineTo(xx+3,h*.5+5);c.stroke();}
  }
  c.fillStyle='#b99b62';c.fillRect(3,h*.45,9,13);c.fillStyle='#ffe2a8';c.fillRect(5,h*.45+2,5,8);
  c.restore();
}

/** The two side displays retain a clear central approach and use the real counter footprints. */
export function drawMarketWares(c:CanvasRenderingContext2D,b:Building,time:number):void{
  c.save();c.translate(b.x,b.y);const w=b.width,y=b.height*.5,identity=vendorIdentity(b.kind)!;
  for(const xx of[8,w-34]){
    c.fillStyle='#514536';c.fillRect(xx+2,y+2,3,14);c.fillRect(xx+21,y+2,3,14);
    poly(c,[[xx-2,y-7],[xx+28,y-7],[xx+28,y+3],[xx-2,y+3]],'#97764e');
    poly(c,[[xx,y-6],[xx+26,y-6],[xx+26,y+7],[xx+20,y+10],[xx+3,y+8]],identity.dark);
    c.strokeStyle=identity.color;c.lineWidth=.8;c.beginPath();c.moveTo(xx+2,y+6);c.lineTo(xx+24,y+6);c.stroke();
  }
  if(b.kind==='merchant'){
    // Cut gemstones on dark velvet, then a necklace bust and two gold bands.
    for(let i=0;i<3;i++){const xx=14+i*7,yy=y-5-(i%2)*3;poly(c,[[xx-4,yy],[xx,yy-6],[xx+4,yy],[xx,yy+4]],['#76d5bd','#c191e0','#e2c278'][i]);poly(c,[[xx-4,yy],[xx,yy-6],[xx,yy+1]],'#edeee0bb');}
    const xx=w-24;poly(c,[[xx-6,y-3],[xx-6,y-15],[xx-2,y-21],[xx+3,y-21],[xx+7,y-15],[xx+7,y-3]],'#364b50');
    c.strokeStyle='#dbc080';c.lineWidth=1;c.beginPath();c.moveTo(xx-5,y-14);c.quadraticCurveTo(xx,y-1,xx+5,y-14);c.stroke();poly(c,[[xx,y-8],[xx+2,y-5],[xx,y-2],[xx-2,y-5]],'#80e2cc');
    c.strokeStyle='#e1c78e';for(let i=0;i<2;i++){c.beginPath();c.ellipse(w-13-i*7,y-3,2.2,1.5,0,0,Math.PI*2);c.stroke();}
  }else if(b.kind==='chapel'){
    // An illuminated open grimoire and a suspended crystal orb in a metal cradle.
    poly(c,[[9,y-7],[11,y-20],[24,y-17],[37,y-20],[38,y-7],[24,y-4]],'#6d557f');
    poly(c,[[11,y-8],[13,y-18],[24,y-15],[35,y-18],[36,y-8],[24,y-6]],'#d1c69e');
    c.strokeStyle='#6e6772';c.lineWidth=.6;for(let i=0;i<3;i++){c.beginPath();c.moveTo(15,y-15+i*3);c.lineTo(22,y-13+i*2);c.moveTo(27,y-13+i*2);c.lineTo(33,y-15+i*3);c.stroke();}
    const xx=w-21,cy=y-15+Math.sin(time*1.8+b.seed)*1;
    c.strokeStyle='#b9a379';c.lineWidth=1.6;c.beginPath();c.moveTo(xx-9,y-8);c.quadraticCurveTo(xx,y+3,xx+9,y-8);c.moveTo(xx,y-2);c.lineTo(xx,y+2);c.stroke();
    c.fillStyle='#887fbf';c.beginPath();c.arc(xx,cy,6,0,Math.PI*2);c.fill();c.fillStyle='#e5d6ff';c.beginPath();c.arc(xx-2,cy-2,2,0,Math.PI*2);c.fill();drawGlow(c,xx,cy,17,'#b5a0fc',.25);
  }else if(b.kind==='gambler'){
    // A red gaming felt, ivory dice and face-down cards; wrapped prizes on the second table.
    for(let i=0;i<3;i++){const xx=13+i*6;c.fillStyle='#dccba2';c.fillRect(xx,y-13+(i%2)*3,5,8);c.fillStyle='#7f3949';c.fillRect(xx+1,y-12+(i%2)*3,3,6);}
    for(let i=0;i<2;i++){const xx=12+i*11,yy=y-4;c.fillStyle='#e8dab0';c.fillRect(xx,yy,5,4);c.fillStyle='#4d3540';c.fillRect(xx+1,yy+1,1,1);c.fillRect(xx+3,yy+2,1,1);}
    for(let i=0;i<2;i++){const xx=w-33+i*12;poly(c,[[xx,y-6],[xx+1,y-17],[xx+10,y-19],[xx+12,y-5]],i?'#9c8b63':'#7c745e');c.strokeStyle='#d3b981';c.lineWidth=1;c.beginPath();c.moveTo(xx+5,y-18);c.lineTo(xx+6,y-5);c.moveTo(xx+1,y-11);c.lineTo(xx+11,y-12);c.stroke();}
    c.fillStyle='#ddbd68';for(let i=0;i<4;i++){c.beginPath();c.ellipse(w-29+i*5,y-3,2.3,1.4,0,0,Math.PI*2);c.fill();}
  }
  c.restore();
}

/** Three-dimensional canvas planes, sewn edges and grounded pegs; no exposed furniture. */
export function drawCampShelter(c:CanvasRenderingContext2D,b:Building,opacity:number,time:number):void{
  const w=b.width,h=b.height,style=architectureStyle(b),ridge=w*(b.seed%2?.46:.57);
  c.save();c.translate(b.x,b.y);
  c.fillStyle='#09131670';c.beginPath();c.ellipse(w*.52,h*.73,w*.61,h*.36,0,0,Math.PI*2);c.fill();
  c.globalAlpha*=.55+opacity*.45;
  const peak=-28,backPeak=-44,backRidge=ridge-15;
  poly(c,[[2,6],[backRidge,backPeak],[ridge,peak],[-7,h+1]],style.cloth);
  poly(c,[[backRidge,backPeak],[w-9,-2],[w+7,h-3],[ridge,peak]],style.wall);
  poly(c,[[-7,h+1],[ridge,peak],[w+7,h-3]],style.cloth);
  // Broad faceted folds give weight without noisy outlines.
  poly(c,[[-7,h+1],[ridge,peak],[ridge-20,h-1]],style.trim+'55');
  poly(c,[[ridge,peak],[w+7,h-3],[ridge+26,h-2]],'#16252b30');
  const doorwayY=h*.29;
  poly(c,[[ridge,doorwayY],[ridge+24,h-2],[ridge-20,h]],'#101f24');
  const wave=Math.sin(time*1.6+b.seed)*.9;
  poly(c,[[ridge,doorwayY],[ridge+7,h*.65],[ridge+29+wave,h-5],[ridge+24,h-2]],style.wall);
  c.strokeStyle=style.trim;c.lineWidth=1.1;
  for(const [ax,ay,bx,by]of[[2,6,backRidge,backPeak],[backRidge,backPeak,ridge,peak],[ridge,peak,-7,h+1],[ridge,peak,w+7,h-3],[ridge,peak,ridge,doorwayY]]){
    c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.stroke();
  }
  // Small sewn repair, edge binding, and two taut guy ropes.
  poly(c,[[w*.18,h*.55],[w*.3,h*.49],[w*.31,h*.66],[w*.2,h*.71]],style.wall+'99');
  c.strokeStyle=style.trim+'aa';c.lineWidth=.7;
  for(let i=0;i<5;i++){c.beginPath();c.moveTo(w*.19+i*2,h*.54-i*.4);c.lineTo(w*.19+i*2,h*.57-i*.4);c.stroke();}
  c.strokeStyle='#b7a57b';c.lineWidth=.9;c.beginPath();c.moveTo(ridge,peak);c.lineTo(-19,h+13);c.moveTo(backRidge,backPeak);c.lineTo(w+17,h+6);c.stroke();
  c.strokeStyle='#746047';c.lineWidth=3;for(const [xx,yy]of[[-19,h+13],[w+17,h+6]]){c.beginPath();c.moveTo(xx,yy-4);c.lineTo(xx,yy+5);c.stroke();}
  if(style.weather==='snow')poly(c,[[backRidge,backPeak-2],[ridge,peak-2],[w*.75,h*.3],[ridge+10,h*.1]],'#d2e2deaa');
  c.restore();
}
