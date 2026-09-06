import type { CharacterPose } from './art-types.ts';
import { polygon, line, taper, type Color, type Point } from './art-primitives.ts';

/** Lean, oversized-eared scavengers with individual scrap blades; rooted at their feet. */
export function goblin(c: CanvasRenderingContext2D, p: CharacterPose, color: Color): void {
  drawGoblin(c, p, color, false);
}
export function goblinChief(c: CanvasRenderingContext2D, p: CharacterPose, color: Color): void {
  drawGoblin(c, p, color, true);
}
function drawGoblin(c: CanvasRenderingContext2D, p: CharacterPose, color: Color, chief: boolean): void {
  c.save();
  const scale = chief ? 1.5 : 1;
  c.scale(scale, scale);
  const step = Math.sin(p.gaitPhase ?? p.time * 13) * Math.min(1, p.moving);
  const windup = Math.max(0, -p.attack), strike = Math.sin(Math.max(0, p.attack) * Math.PI);
  const bob = Math.abs(step) * 1.2 + windup * 2, face = Math.cos(p.angle) * 2.3;
  const skin = chief ? '#76834e' : '#819963', shade = '#3a5145', edge = '#b6be7a';
  if (chief) {
    // Back-mounted pennant and bone trophies establish a distinct commanding silhouette.
    line(c, [[-7,-10],[-9,-36]], color('#756049'), 1.6);
    polygon(c, [[-9,-36],[8,-33],[5,-26],[1,-28],[-8,-29]], color('#9b443c'));
    line(c, [[-8,-35],[7,-32]], color('#d59b60'), .7);
    polygon(c, [[-4,-33],[0,-32],[1,-29],[-3,-28],[-5,-30]], color('#d5c99a'));
    c.fillStyle=color('#443c32');c.fillRect(-3,-31,1,1);c.fillRect(-1,-31,1,1);
  }
  for (const side of [-1,1]) {
    const knee:Point=[side*6,-7+step*side], foot:Point=[side*6+step*side*2,-1];
    taper(c,[side*3,-13+bob],knee,3,2.2,color(shade));
    taper(c,knee,foot,2.3,1.6,color(skin));
    polygon(c,[[foot[0]-2,-2],[foot[0]+2,-2],[foot[0]+4,1],[foot[0]-2,1]],color('#463c30'));
  }
  polygon(c,[[-5,-21+bob],[3,-22+bob],[7,-16+bob],[4,-8],[-4,-9],[-7,-15+bob]],color(shade));
  polygon(c,[[-5,-20+bob],[3,-21+bob],[5,-14+bob],[1,-11],[-4,-13]],color(chief?'#536574':'#82634b'));
  line(c,[[-5,-18+bob],[4,-13+bob]],color('#c19a62'),1.8);
  polygon(c,[[-5,-12],[5,-12],[4,-6],[0,-8],[-4,-6]],color(chief?'#9c4941':'#4a4042'));
  const arm:Point=[7,-19+bob], hand:Point=[10+strike*7-windup*3,-10+bob-windup*10];
  taper(c,arm,[11,-15+bob],3,2,color(skin));
  taper(c,[11,-15+bob],hand,2,1.5,color(edge));
  const a=p.attackAngle + (p.attack<0?-1.7:p.attack>0?-1.7+p.attack*3.6:.7);
  const tip:Point=[hand[0]+Math.cos(a)*13,hand[1]+Math.sin(a)*13];
  line(c,[hand,tip],color('#313e40'),3.5);
  line(c,[[hand[0]+Math.cos(a)*3,hand[1]+Math.sin(a)*3],tip],color('#c7cdac'),2);
  line(c,[[tip[0]-.4,tip[1]-.4],hand],color('#ead5a0'),.65);
  const horn = chief && p.commandWarning;
  const off:Point=horn?[-5,-24+bob]:[-9,-11+bob-step];
  taper(c,[-5,-19+bob],[-10,-17+bob],3,2.5,color(skin));taper(c,[-10,-17+bob],off,2.2,1.5,color(edge));
  if(chief){polygon(c,[[off[0],off[1]],[off[0]-7,off[1]-4],[off[0]-10,off[1]-1],[off[0]-5,off[1]+2]],color('#d5b577'));}
  else {polygon(c,[[off[0]-3,off[1]-4],[off[0]+2,off[1]-4],[off[0]+3,off[1]+2],[off[0]-1,off[1]+4],[off[0]-4,off[1]]],color('#635548'));}
  const hy=-24+bob;
  polygon(c,[[face-5,hy-1],[face-14,hy-5],[face-10,hy+2],[face-4,hy+4]],color(skin));
  polygon(c,[[face+4,hy-1],[face+13,hy-5],[face+10,hy+2],[face+3,hy+4]],color(skin));
  line(c,[[face-12,hy-3],[face-6,hy+1]],color('#bb9a78'),.8);line(c,[[face+11,hy-3],[face+5,hy+1]],color('#bb9a78'),.8);
  polygon(c,[[face-5,hy-3],[face+2,hy-5],[face+6,hy-1],[face+4,hy+6],[face-2,hy+7],[face-6,hy+2]],color(skin));
  polygon(c,[[face-5,hy-3],[face-2,hy-2],[face-1,hy+6],[face-4,hy+4]],color(shade));
  polygon(c,[[face+1,hy],[face+7,hy+2],[face+2,hy+4]],color(edge));
  c.fillStyle=color('#192c26');c.fillRect(face-3,hy,3,2);c.fillRect(face+2,hy,3,2);
  c.fillStyle=color(p.command==='rush'&&!p.commandWarning?'#ffd095':'#e3c96f');c.fillRect(face-2,hy,1.3,1);c.fillRect(face+3,hy,1.3,1);
  line(c,[[face-2,hy+5],[face+3,hy+5]],color('#27322a'),1);
  line(c,[[face-1,hy+5],[face-1,hy+3.5]],color('#dfd5b7'),1);
  if(chief){polygon(c,[[face-6,hy-3],[face-5,hy-8],[face-1,hy-5],[face+2,hy-9],[face+6,hy-4],[face+5,hy-1]],color('#697781'));line(c,[[face-5,hy-3],[face+4,hy-3]],color('#d4b475'),1);}
  if(chief&&p.command){
    const ink=p.command==='rush'?'#edab76':'#9acabd';c.strokeStyle=color(ink);c.globalAlpha*=p.commandWarning?.85:.35;c.lineWidth=.9;
    c.beginPath();c.ellipse(0,2,p.commandWarning?20:16,6,0,0,Math.PI*2);c.stroke();
    if(horn){for(const r of [5,9]){c.beginPath();c.arc(off[0]-9,off[1]-1,r,Math.PI*.75,Math.PI*1.25);c.stroke();}}
  }
  c.restore();
}
