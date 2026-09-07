import type { CharacterPose } from './art-types.ts';
import { polygon, line, taper, type Color, type Point } from './art-primitives.ts';
import { drawGlow } from './lighting.ts';
import { BOSS_PALETTES, type WildernessBossKind } from './wilderness-boss-content.ts';

/** Articulated silhouettes: living bark/claws, furnace masonry, and a crowned iron swordsman. */
function figure(c:CanvasRenderingContext2D,p:CharacterPose,color:Color,kind:WildernessBossKind):void {
  const tree=kind==='briarMatriarch',forge=kind==='ashColossus',glow=BOSS_PALETTES[kind];
  const metal=tree?'#556e45':forge?'#675e55':'#5c7280',edge=tree?'#a5b982':forge?'#b49676':'#c3ced0';
  const time=p.time,bob=Math.sin(time*2)*1.4,step=Math.sin(p.gaitPhase??time*7)*p.moving*8;
  const wind=p.attack<0?Math.min(1,-p.attack):0,strike=p.attack>0?Math.sin(p.attack*Math.PI):0;
  const face=Math.cos(p.angle),back=Math.sin(p.angle)<-.4;
  if(!tree){
    polygon(c,[[-23,-68],[22,-68],[31+Math.sin(time*2)*3,-5],[8,2],[-11,-4],[-34,-1]],color(forge?'#302726':'#30283e'));
    for(const side of [-1,1])line(c,[[side*19,-62],[side*23,-17],[side*28,-5]],color(forge?'#5e4331':'#736281'),2);
  }
  for(const side of [-1,1]){
    const foot:Point=[side*15,-side*step],knee:Point=[side*14,-24+side*step*.35];
    taper(c,[side*11,-42],knee,14,11,color(metal));taper(c,knee,foot,11,tree?6:13,color(metal));
    polygon(c,[[foot[0]-8,foot[1]-7],[foot[0]+8,foot[1]-7],[foot[0]+11,foot[1]+3],[foot[0]-10,foot[1]+3]],color(tree?'#344735':'#34424a'));
    line(c,[[side*14-3,-36],[knee[0]-3,knee[1]],[foot[0]-5,foot[1]-6]],color(edge),1.8);
  }
  polygon(c,[[-20,-73+bob],[-31,-60+bob],[-24,-41],[-14,-33],[16,-34],[27,-48],[29,-65+bob],[12,-79+bob]],color(metal));
  polygon(c,[[-18,-68+bob],[0,-76+bob],[20,-66+bob],[17,-48],[0,-40],[-19,-49]],color(tree?'#758557':forge?'#393a37':'#8b9ca3'));
  for(let i=0;i<3;i++)line(c,[[-17,-60+i*7],[0,-55+i*7],[17,-61+i*7]],color(forge?'#d78646':'#344540'),3);
  if(!back){drawGlow(c,face*2,-60+bob,forge?29:18,glow,forge?.4:.23);polygon(c,[[-5,-65+bob],[0,-70+bob],[6,-63+bob],[4,-53+bob],[0,-49+bob],[-5,-55+bob]],color(glow));line(c,[[0,-65+bob],[1,-54+bob]],color('#fff0d0'),2);}
  for(const side of [-1,1]){
    const elbow:Point=[side*(35+wind*4),-48+bob-wind*9];
    const hand:Point=[side*(38-wind*6)+Math.cos(p.attackAngle)*strike*20,-27-wind*30+Math.sin(p.attackAngle)*strike*15];
    taper(c,[side*22,-67+bob],elbow,17,12,color(metal));taper(c,elbow,hand,12,8,color(forge?'#81725e':metal));
    polygon(c,[[side*18,-76+bob],[side*34,-73+bob],[side*40,-61+bob],[side*26,-58+bob]],color(edge));
    if(tree){
      for(let i=0;i<3;i++){const base:Point=[hand[0]+(i-1)*4,hand[1]];line(c,[base,[base[0]+side*(8+i*3),base[1]+9],[base[0]+side*(4+i*3),base[1]+18]],color(edge),2.5);}
      line(c,[[side*25,-70],[side*39,-83],[side*42,-96]],color('#718c62'),4);
    }else if(forge){
      polygon(c,[[hand[0]-11,hand[1]-8],[hand[0]+13,hand[1]-8],[hand[0]+15,hand[1]+7],[hand[0]-12,hand[1]+10]],color('#4d504b'));
      line(c,[[hand[0]-7,hand[1]-5],[hand[0]+3,hand[1]],[hand[0]-2,hand[1]+6]],color('#ffb568'),2);
    }else if(side===(face>=0?1:-1)){
      c.save();c.translate(...hand);c.rotate(-1.12+wind*.5+strike*1.7);
      polygon(c,[[-8,-3],[0,-8],[58,-4],[78,0],[58,4],[0,6]],color('#596f7c'));
      polygon(c,[[0,-8],[58,-4],[78,0],[2,0]],color('#d0d9d6'));line(c,[[0,-12],[0,12]],color('#b6a67c'),4);c.restore();
    }
  }
  const hx=face*3,hy=-83+bob;
  polygon(c,[[hx-13,hy],[hx-12,hy-16],[hx,hy-23],[hx+13,hy-16],[hx+14,hy],[hx+4,hy+9],[hx-6,hy+7]],color(metal));
  polygon(c,[[hx-10,hy-14],[hx,hy-20],[hx+9,hy-13],[hx+8,hy+2],[hx,hy+6],[hx-8,hy]],color(back?metal:'#253337'));
  if(!back){line(c,[[hx-7,hy-7],[hx-2,hy-5]],color(glow),2.5);line(c,[[hx+2,hy-5],[hx+7,hy-7]],color(glow),2.5);drawGlow(c,hx,hy-6,14,glow,.25);}
  for(const side of [-1,1]){
    if(tree){line(c,[[hx+side*10,hy-10],[hx+side*20,hy-26],[hx+side*15,hy-37]],color(edge),4);line(c,[[hx+side*19,hy-25],[hx+side*29,hy-29],[hx+side*32,hy-36]],color(edge),2);}
    else if(!forge)polygon(c,[[hx+side*3,hy-20],[hx+side*6,hy-31],[hx+side*11,hy-20],[hx+side*17,hy-26],[hx+side*13,hy-13]],color('#aa9a71'));
  }
}
export const briarMatriarch=(c:CanvasRenderingContext2D,p:CharacterPose,color:Color)=>figure(c,p,color,'briarMatriarch');
export const ashColossus=(c:CanvasRenderingContext2D,p:CharacterPose,color:Color)=>figure(c,p,color,'ashColossus');
export const graveMarshal=(c:CanvasRenderingContext2D,p:CharacterPose,color:Color)=>figure(c,p,color,'graveMarshal');
