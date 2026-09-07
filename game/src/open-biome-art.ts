import { polygon, line, type Random, type Point } from './art-primitives.ts';

/** Cached code-drawn silhouettes for the open-landscape studies. */
export function dryGrass(c: CanvasRenderingContext2D, r: Random, scrub = false): void {
  const count = scrub ? 12 : 27;
  for (let i=0;i<count;i++) {
    const x=(r()-.5)*42, h=(scrub?7:16)+r()*(scrub?12:25), lean=4+r()*12;
    const color=(scrub?['#847348','#bcaa78','#6c6945']:['#899353','#ada65f','#c9bc79','#626f3d'])[i%(scrub?3:4)];
    c.beginPath(); c.moveTo(x*.7,0); c.quadraticCurveTo(x+lean*.1,-h*.5,x+lean,-h);
    c.strokeStyle=color;c.lineWidth=.65+r()*.7;c.stroke();
    if(!scrub&&i%3===0) {
      for(let j=0;j<4;j++) line(c,[[x+lean-j*.8,-h+j*1.8],[x+lean+3-j*.7,-h-1+j*1.8]],'#d3c78c',.7);
    }
  }
}
export function thornBrush(c: CanvasRenderingContext2D,r: Random): void {
  for(let i=0;i<12;i++) {
    const x=(r()-.5)*54,h=16+r()*22;
    line(c,[[0,1],[x*.45,-h*.4],[x,-h]],i%2?'#665b43':'#8c8057',1.4);
    line(c,[[x*.6,-h*.6],[x*.6+(i%2?8:-8),-h*.6-5]],'#aaa078',.8);
    for(let j=0;j<3;j++) { const px=x-j*2,py=-h+j*3;polygon(c,[[px-4,py],[px,py-3],[px+4,py+1]],i%3?'#6c7743':'#9b9859'); }
  }
}
export function openStone(c: CanvasRenderingContext2D,r: Random,sand: boolean,small = false): void {
  const h=((sand?43:63)+r()*18)*(small?.5:1),w=(sand?30:16)*(small?.58:1);
  const shape:Point[]=[[-w,0],[-w+3,-h*.5],[-w*.6,-h*.91],[w*.1,-h],[w*.72,-h*.86],[w,-h*.42],[w*.88,0],[0,4]];
  polygon(c,shape,sand?'#9e704c':'#767761');
  polygon(c,[shape[1],shape[2],shape[3],shape[4],[w*.5,-h*.62],[-w*.7,-h*.65]],sand?'#d0a575':'#afa98a');
  polygon(c,[[w*.1,-h],shape[4],shape[5],shape[6],[w*.15,2],[w*.32,-h*.58]],sand?'#886345':'#555f55');
  c.save();c.beginPath();c.moveTo(...shape[0]);for(const p of shape.slice(1))c.lineTo(...p);c.closePath();c.clip();
  for(let i=0;i<(sand?7:4);i++) {
    const y=-h*.12-i*h*.12;
    line(c,[[-w,y],[0,y-2],[w,y-5]],sand?(i%2?'#e2bd854f':'#5f4c4055'):'#cad0b02a',1+r());
  }
  for(let i=0;i<22;i++) {const x=(r()-.5)*w*2,y=-r()*h;c.fillStyle=sand?'#e4bf8530':'#b9b7982b';c.fillRect(x,y,1+r()*3,.7+r());}
  c.restore();
  line(c,[shape[1],shape[2],shape[3]],sand?'#efcc95':'#c8c6a3',1);
  for(let i=0;i<5;i++){const x=(r()-.5)*w*2,y=r()*2;polygon(c,[[x-3,y],[x,y-3],[x+5,y]],sand?'#a88056':'#7d8368');}
}
