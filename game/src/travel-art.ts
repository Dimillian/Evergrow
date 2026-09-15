import type { PortalAnchor } from './travel.ts';
import type { PortalDestination } from './portal-destination.ts';
import type { BiomeId } from './biomes.ts';

const PORTAL_BIOME_VISUALS: Readonly<Record<BiomeId, { color: string; mote: 'ash'|'leaf'|'mist'|'snow'|'ember'|'petal'|'shard'|'grass'|'sand' }>> = Object.freeze({
  deadwood:{color:'#8faeb9',mote:'ash'}, verdant:{color:'#78c795',mote:'leaf'}, swamp:{color:'#65bac1',mote:'mist'},
  frostpine:{color:'#b9e2f2',mote:'snow'}, emberfall:{color:'#ed8065',mote:'ember'}, autumn:{color:'#d8aa55',mote:'petal'},
  highlands:{color:'#aaa2d3',mote:'shard'}, steppe:{color:'#c1bd75',mote:'grass'}, sunscar:{color:'#e4bc79',mote:'sand'},
});

function drawDestinationMote(c:CanvasRenderingContext2D, kind:string, x:number, y:number, size:number, angle:number) {
  c.save(); c.translate(x,y); c.rotate(angle);
  if(kind==='snow'){c.fillRect(-size*.5,-.5,size,1);c.fillRect(-.5,-size*.5,1,size);}
  else if(kind==='leaf'){c.beginPath();c.ellipse(0,0,size*1.45,size*.5,0,0,Math.PI*2);c.fill();}
  else if(kind==='petal'){for(let i=0;i<4;i++){c.rotate(Math.PI/2);c.beginPath();c.ellipse(0,-size*.65,size*.42,size*.8,0,0,Math.PI*2);c.fill();}}
  else if(kind==='mist'){c.globalAlpha*=.45;c.fillRect(-size*2,-.5,size*4,1);}
  else if(kind==='shard'){c.beginPath();c.moveTo(0,-size);c.lineTo(size*.65,size);c.lineTo(-size*.45,size*.35);c.closePath();c.fill();}
  else if(kind==='grass'){c.fillRect(-.5,-size,1,size*2);}
  else if(kind==='sand'){c.beginPath();c.arc(0,0,size*.55,0,Math.PI*2);c.fill();}
  else if(kind==='ember'){c.fillRect(-size*.45,-size,size*.9,size*1.7);}
  else {c.fillRect(-size*.6,-size*.6,size*1.2,size*1.2);}
  c.restore();
}

/** Layered procedural rings, threads and motes; no images or simulation-owned particles. */
export function drawPortal(c: CanvasRenderingContext2D, x: number, y: number, time: number, progress = 1, destination?: PortalDestination, reduced = false) {
  const t = reduced ? 0 : time, p = Math.max(0, Math.min(1, progress));
  const visual = destination ? PORTAL_BIOME_VISUALS[destination.biome] : undefined;
  const accent = visual?.color ?? '#b5a0ee';
  c.save(); c.translate(x, y);
  c.fillStyle = '#080e1cb0'; c.beginPath(); c.ellipse(0, 1, 32, 13, 0, 0, Math.PI * 2); c.fill();
  for (let ring = 0; ring < 2; ring++) {
    c.strokeStyle = ring ? '#d8d8d788' : '#b5a0ee'; c.lineWidth = ring ? .6 : 1.3;
    c.beginPath(); c.ellipse(0, 0, 25 + ring * 7, 9 + ring * 4, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); c.stroke();
  }
  c.globalAlpha=.75;c.strokeStyle=accent;c.lineWidth=1.15;c.beginPath();
  c.ellipse(0,0,29,11,0,-Math.PI*.18,Math.PI*.62);c.stroke();c.beginPath();c.ellipse(0,0,29,11,0,Math.PI*.82,Math.PI*1.62);c.stroke();c.globalAlpha=1;
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6; c.strokeStyle = '#cad3df88'; c.beginPath();
    c.moveTo(Math.cos(a) * 28, Math.sin(a) * 11); c.lineTo(Math.cos(a) * 32, Math.sin(a) * 14); c.stroke();
  }
  c.globalCompositeOperation = 'lighter';
  const height = 26 + p * 38, cy = -height * .51;
  const glow = c.createRadialGradient(0, cy, 1, 0, cy, height * .65);
  glow.addColorStop(0, `${accent}62`); glow.addColorStop(.6,`${accent}24`); glow.addColorStop(1, `${accent}00`);
  c.fillStyle = glow; c.fillRect(-48, -height - 20, 96, height + 34);
  const membrane=c.createLinearGradient(-18,cy,18,cy);membrane.addColorStop(0,`${accent}08`);membrane.addColorStop(.5,`${accent}38`);membrane.addColorStop(1,`${accent}08`);
  c.fillStyle=membrane;c.beginPath();c.ellipse(0,cy,17,height*.48,0,0,Math.PI*2);c.fill();
  for (let i = 0; i < 5; i++) {
    const phase = t * (.4 + i * .035) + i * 1.256;
    c.lineWidth = i === 0 ? 1.5 : i < 3 ? 1.45 : 1; c.strokeStyle = i === 0 ? '#cec5eacc' : accent;
    c.beginPath();
    for (let j = 0; j <= 65; j++) {
      const a = j / 65 * Math.PI * 2, wave = Math.sin(a * 4 + phase * 2) * (reduced ? .5 : 1.6);
      const px = Math.cos(a) * (18 + i * .65 + wave), py = cy + Math.sin(a) * height * .5;
      if (j === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.stroke();
  }
  for (let i = 0; i < 24; i++) {
    const f = (i / 24 + t * .15) % 1, a = i * 2.39996 + t * .6;
    c.globalAlpha = Math.sin(f * Math.PI) * .85; c.fillStyle = i % 5 === 0 ? '#eff2fa' : accent;
    const mx=Math.cos(a)*(45-f*30),my=-f*height+Math.sin(a)*8;
    if(visual&&i%5!==0)drawDestinationMote(c,visual.mote,mx,my,visual.mote==='mist'?1.5:i%3===0?1.8:1.25,a);
    else c.fillRect(mx,my,i%5===0?2:1,2);
  }
  c.globalAlpha=.7;c.strokeStyle=accent;c.lineWidth=1;c.beginPath();c.moveTo(0,-8);c.lineTo(7,0);c.lineTo(0,7);c.lineTo(-7,0);c.closePath();c.stroke();
  if (destination?.kind === 'hazardous' || destination?.kind === 'dungeon') {
    c.globalAlpha = destination.kind === 'hazardous' ? .9 : .8; c.strokeStyle = destination.kind === 'hazardous' ? '#ff9a72' : '#d6c5ff';
    c.lineWidth = destination.kind === 'hazardous' ? 1.2 : 1; c.beginPath();
    const pulse = reduced ? 0 : Math.sin(t * 2.2) * 1.5;
    if(destination.kind==='hazardous'){c.moveTo(-14-pulse,-4);c.lineTo(0,-15);c.lineTo(14+pulse,-4);c.stroke();}
    else {for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;c.moveTo(Math.cos(a)*7,cy+Math.sin(a)*7);c.lineTo(Math.cos(a)*14,cy+Math.sin(a)*18);}c.stroke();c.beginPath();c.arc(0,cy,8,0,Math.PI*2);c.stroke();}
  }
  c.restore();
}
export function drawTownAnchor(c: CanvasRenderingContext2D, anchor: PortalAnchor, home: boolean) {
  c.save(); c.translate(anchor.x, anchor.y);
  c.fillStyle = '#101c22'; c.beginPath(); c.ellipse(0, 0, 35, 16, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = home ? '#aba1cb' : '#697579'; c.lineWidth = 1.5; c.stroke();
  c.beginPath(); c.ellipse(0, -2, 27, 11, 0, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    c.beginPath(); c.moveTo(Math.cos(a) * 30, Math.sin(a) * 13); c.lineTo(Math.cos(a) * 35, Math.sin(a) * 16); c.stroke();
  }
  c.strokeStyle = home ? '#d7ccef' : '#7e939d'; c.beginPath();
  c.moveTo(0, -11); c.lineTo(8, -2); c.lineTo(0, 7); c.lineTo(-8, -2); c.closePath(); c.stroke(); c.restore();
}
