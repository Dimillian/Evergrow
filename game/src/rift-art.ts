import { drawGlow, type PointLight } from './lighting.ts';

const TAU = Math.PI * 2;
// Keep artwork, emission and scene illumination at the same compact size.
const PORTAL_SCALE = .78;
const TENDRIL_ROOTS = [
  { x: 6, y: -5, reach: 29, rise: -7, curl: 12 },
  { x: 21, y: -39, reach: 26, rise: 17, curl: -9 },
  { x: 20, y: -72, reach: 25, rise: -9, curl: 10 },
  { x: 9, y: -98, reach: 21, rise: -22, curl: -6 },
] as const;
/** Shared slow breath for the aperture, ground spill and actual scene light. */
export function riftPortalPulse(time: number): number {
  return .5 + .5 * Math.sin(time * 1.65);
}
export function riftPortalLight(x: number, y: number, time: number, scale = 1): PointLight {
  scale *= PORTAL_SCALE;
  return { x, y: y - 40 * scale, radius: 175 * scale, color: '#ef548b',
    power: .52 + riftPortalPulse(time) * .16, stationary: true };
}

function aperture(c: CanvasRenderingContext2D, time: number) {
  const bend = Math.sin(time * .8) * 2;
  c.beginPath(); c.moveTo(1, -109);
  c.bezierCurveTo(-15 + bend, -91, -32, -70, -24, -43);
  c.bezierCurveTo(-19, -23, -16, -10, 0, 3);
  c.bezierCurveTo(17, -12, 14, -34, 25, -57);
  c.bezierCurveTo(30, -78, 13 + bend, -95, 1, -109);
  c.closePath();
}

/** Tapered, articulated ribbons: fixed work and no particle allocations. */
function tendril(c: CanvasRenderingContext2D, side: number, index: number, time: number) {
  const root = TENDRIL_ROOTS[index], phase = index * 1.7 + side * .8;
  const point = (u: number) => ({
    x: side * (root.x + Math.sin(u * 2.1) * root.reach
      + Math.sin(time * 1.1 - u * 4 + phase) * 3 * u),
    y: root.y + root.rise * u + Math.sin(u * Math.PI) * root.curl
      + Math.sin(u * 5 + time * .8 + phase) * 4 * u,
  });
  c.beginPath();
  for (let j = 0; j <= 16; j++) {
    const u = j / 16, p = point(u), width = (1 - u) * (2.7 - index * .25);
    if (!j) c.moveTo(p.x, p.y - width); else c.lineTo(p.x, p.y - width);
  }
  for (let j = 16; j >= 0; j--) {
    const u = j / 16, p = point(u); c.lineTo(p.x, p.y + (1 - u) * (2.7 - index * .25));
  }
  c.closePath(); c.fillStyle = '#291426'; c.fill();
  c.lineWidth = .8; c.strokeStyle = '#873354'; c.stroke();
  c.beginPath();
  for (let j = 0; j <= 16; j++) {
    const p = point(j / 16); if (!j) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
  }
  c.lineWidth = 1.25; c.strokeStyle = index % 2 ? '#d56792' : '#aa4d83'; c.stroke();
  // A small charge travels from the root toward the tip, fading at both ends.
  const u = ((time * .17 + index * .23 + (side + 1) * .14) % 1 + 1) % 1, p = point(u);
  drawGlow(c, p.x, p.y, 9, '#ff96bd', Math.sin(u * Math.PI) * .33);
}

/** Living crimson tear, shared by town fixtures, rift exits and entry UI. */
export function drawRiftPortal(c: CanvasRenderingContext2D, x: number, y: number, time: number, scale = 1): void {
  const pulse = riftPortalPulse(time);
  scale *= PORTAL_SCALE;
  c.save(); c.translate(x, y); c.scale(scale, scale); c.lineCap = 'round'; c.lineJoin = 'round';
  c.fillStyle = '#0b0716a0'; c.beginPath(); c.ellipse(0, 5, 39, 12, 0, 0, TAU); c.fill();
  c.save(); c.scale(1, .3); drawGlow(c, 0, 9, 72, '#dc286b', .38 + pulse * .1); c.restore();
  drawGlow(c, 0, -49, 99, '#b92967', .24 + pulse * .08);
  for (let i = 3; i >= 0; i--) for (const side of [-1, 1]) tendril(c, side, i, time);
  aperture(c, time);
  const glass = c.createLinearGradient(-26, -90, 25, 0);
  glass.addColorStop(0, '#681c4b'); glass.addColorStop(.35, '#210f34');
  glass.addColorStop(.63, '#080b1b'); glass.addColorStop(1, '#4e183e');
  c.fillStyle = glass; c.fill();
  c.save(); c.clip();
  // Descending parallax currents orbit a dark, off-center core.
  drawGlow(c, 11, -76, 35, '#983dc0', .5);
  drawGlow(c, -12, -24, 29, '#ed387c', .45 + pulse * .15);
  for (let i = 0; i < 13; i++) {
    const depth = ((i / 13 + time * .085) % 1 + 1) % 1;
    const radius = 4 + depth * 39, angle = time * .34 + i * .49;
    c.beginPath();
    for (let j = 0; j <= 22; j++) {
      const a = angle + j / 22 * Math.PI * 1.7;
      const xx = 3 + Math.cos(a) * radius * .62;
      const yy = -54 + Math.sin(a) * radius * 1.8;
      if (!j) c.moveTo(xx, yy); else c.lineTo(xx, yy);
    }
    c.globalAlpha = Math.sin(depth * Math.PI) * .38;
    c.strokeStyle = i % 3 ? '#dc609d' : '#bb8cef'; c.lineWidth = .6 + depth; c.stroke();
  }
  c.globalAlpha = 1;
  const core = c.createRadialGradient(2, -54, 1, 2, -54, 22);
  core.addColorStop(0, '#050916'); core.addColorStop(.5, '#080b1be8'); core.addColorStop(1, '#080b1b00');
  c.fillStyle = core; c.fillRect(-26, -90, 54, 90); c.restore();
  // Broad translucent emission under a crisp, pale glass edge; no canvas blur.
  aperture(c, time);
  for (const [width, color] of [[10, '#e4428020'], [5, '#ef609c50'], [2.1, '#ef88b1'], [.65, '#ffe1e7']] as const) {
    c.lineWidth = width; c.strokeStyle = color; c.stroke();
  }
  for (let i = 0; i < 16; i++) {
    const u = ((time * .13 + i * .618) % 1 + 1) % 1, side = i % 2 ? 1 : -1;
    const xx = side * (22 + Math.sin(u * Math.PI) * (12 + i % 5 * 4));
    const yy = 8 - u * 122, opacity = Math.sin(u * Math.PI) ** 2;
    c.globalAlpha = opacity * .7; c.strokeStyle = i % 3 ? '#e879b0' : '#fcd0df'; c.lineWidth = i % 3 ? .8 : 1.3;
    c.beginPath(); c.moveTo(xx, yy + 3); c.lineTo(xx - side * 1.3, yy); c.stroke();
  }
  c.restore();
}

/** Soft emission survives world darkening without repainting opaque silhouettes. */
export function drawRiftPortalEmission(c: CanvasRenderingContext2D, x: number, y: number, time: number, scale = 1): void {
  scale *= PORTAL_SCALE;
  const pulse = riftPortalPulse(time);
  drawGlow(c, x, y - 48 * scale, 72 * scale, '#df397e', .17 + pulse * .055);
  drawGlow(c, x + 2 * scale, y - 101 * scale, 17 * scale, '#ffbed9', .3 + pulse * .12);
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
