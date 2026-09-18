import { GAME_FONT_STACK } from './font.ts';
import { areaBannerLayout, areaBannerOpacity, areaLevelLabel, areaThreat, AREA_BANNER_TIMING, type AreaBannerNotice } from './area-banner.ts';

function line(c: CanvasRenderingContext2D, points: readonly (readonly number[])[]) {
  c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.stroke();
}
function diamond(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  line(c,[[x,y-r],[x+r,y],[x,y+r],[x-r,y],[x,y-r]]);
}
function label(c: CanvasRenderingContext2D, value: string, y: number, size: number, width: number, color: string) {
  c.font=`400 ${size}px ${GAME_FONT_STACK}`;
  while(c.measureText(value).width>width && size>12) { size--; c.font=`400 ${size}px ${GAME_FONT_STACK}`; }
  if(c.measureText(value).width>width) {
    while(value.length && c.measureText(`${value}…`).width>width)value=value.slice(0,-1);
    value+='…';
  }
  c.fillStyle=color;c.fillText(value,0,y);
}
/** Gilded Horizon on the native UI canvas, after world post-processing. */
export function drawAreaBanner(c: CanvasRenderingContext2D, notice: Readonly<AreaBannerNotice> | null,
  age: number, playerLevel: number, width: number, height: number, reducedMotion: boolean): void {
  if(!notice || width<=0 || height<=0)return;
  const opacity=areaBannerOpacity(age);if(opacity<=0)return;
  const {x,y,radius,vertical,titleSize,smallSize}=areaBannerLayout(width,height),danger=areaThreat(notice,playerLevel);
  c.save();c.translate(x,y);c.globalAlpha*=opacity;
  const halo=c.createRadialGradient(0,0,0,0,0,1);
  halo.addColorStop(0,'#0710148c');halo.addColorStop(.6,'#07101448');halo.addColorStop(1,'#07101400');
  c.save();c.scale(radius*1.22,112*vertical);c.fillStyle=halo;c.fillRect(-1,-1,2,2);c.restore();
  c.save();c.scale(radius/270,vertical);
  if(!reducedMotion)c.scale(.96+.04*Math.min(1,age/AREA_BANNER_TIMING.enter),1);
  c.lineWidth=1;c.strokeStyle='#baa276';c.shadowColor='#baa276';c.shadowBlur=4;
  for(const side of [-1,1]) {
    c.save();c.scale(side,1);
    line(c,[[20,-60],[158,-60],[175,-56],[237,-56]]);
    line(c,[[44,68],[126,68],[141,64],[210,64]]);
    c.save();c.globalAlpha*=.48;line(c,[[30,-64],[135,-64]]);c.restore();
    diamond(c,246,-56,3);c.restore();
  }
  diamond(c,0,-60,7);diamond(c,0,68,4);c.restore();
  c.textAlign='center';c.textBaseline='middle';c.shadowColor='#03090c';c.shadowBlur=7;
  const [name,...biome]=notice.name.split(' · '),compact=vertical<.7;
  label(c,name,compact?Math.max(-13,-60*vertical+13):-19*vertical,titleSize,radius*1.82,'#eee5cd');
  if(biome.length)label(c,biome.join(' · '),compact?6:10*vertical,smallSize,radius*1.85,'#c5c6b9');
  label(c,areaLevelLabel(notice),compact?Math.min(23,68*vertical-8):39*vertical,smallSize,radius*1.95,danger.color);
  c.restore();
}
