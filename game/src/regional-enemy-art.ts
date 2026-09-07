import type { CharacterPose } from './art-types.ts';
import { polygon, line, taper, clamp, smooth, mixColor, type Color, type Point } from './art-primitives.ts';
import { drawGlow } from './lighting.ts';
import type { RegionalEnemyKind } from './combat-content.ts';
import type { DeathAnimation } from './death-content.ts';

type V = readonly [number, number, number];
/** Facing-relative anatomy, projected before depth sorting; limbs can fold independently
 * during attacks and collapse. The same material facets are used alive and dead. */
class CreatureRig {
  private layers: { depth: number; paint: () => void }[] = [];
  private c: CanvasRenderingContext2D;
  private angle: number;
  private color: Color;
  private offset: Point;
  constructor(c: CanvasRenderingContext2D, angle: number, color: Color, offset: Point = [0,0]) { this.c=c; this.angle=angle; this.color=color; this.offset=offset; }
  point([forward, side, height]: V): Point {
    return [this.offset[0] + Math.cos(this.angle) * forward - Math.sin(this.angle) * side,
      this.offset[1] + (Math.sin(this.angle) * forward + Math.cos(this.angle) * side) * .55 - height];
  }
  private depth(v: V): number { return Math.sin(this.angle) * v[0] + Math.cos(this.angle) * v[1]; }
  plate(center: V, shape: readonly Point[], base: string, edge: string, scale = 1): void {
    const p = this.point(center), points = shape.map(([x,y]):Point => [p[0]+x*scale,p[1]+y*scale]);
    this.layers.push({ depth: this.depth(center), paint: () => {
      polygon(this.c, points, this.color(base));
      // One directional bevel, not a uniform bright outline around every face.
      polygon(this.c, [points[0], points[1], [p[0],p[1]]], this.color(edge));
      line(this.c, points.slice(0,3), this.color(edge), .65);
    }});
  }
  limb(a: V, b: V, width: number, base: string, edge: string): void {
    const p=this.point(a),q=this.point(b);
    this.layers.push({depth:(this.depth(a)+this.depth(b))*.5,paint:()=>{
      taper(this.c,p,q,width,width*.48,this.color(base));
      line(this.c,[[p[0]-.55,p[1]],[q[0]-.55,q[1]]],this.color(edge),Math.max(.55,width*.19));
    }});
  }
  glow(at: V, radius: number, color: string, power: number): void {
    if (typeof document === 'undefined') return;
    const p=this.point(at);
    this.layers.push({depth:this.depth(at)+.1,paint:()=>drawGlow(this.c,p[0],p[1],radius,color,power)});
  }
  draw(): void { this.layers.sort((a,b)=>a.depth-b.depth); for(const layer of this.layers)layer.paint(); }
}
const diamond: readonly Point[] = [[-6,0],[0,-10],[7,0],[2,9],[-4,6]];
const shell: readonly Point[] = [[-11,-4],[-6,-10],[7,-9],[13,-1],[8,8],[-6,9],[-13,2]];
const skull: readonly Point[] = [[-5,-5],[0,-8],[6,-4],[5,4],[2,7],[-4,5]];

/** Tall split trunk, antlers and hooked roots, with a deliberately narrow waist. */
function reaver(r: CreatureRig,p:CharacterPose,fall:number):void {
  const gait=(p.gaitPhase??p.time*9),wind=clamp(-p.attack),hit=p.attack>0?Math.sin(p.attack*Math.PI):0;
  const h=1-fall*.83,lean=fall*16+hit*6-wind*3;
  for(const side of [-1,1]) {
    const step=Math.sin(gait+side*1.57)*p.moving*5,hip:V=[lean,side*4,21*h];
    const knee:V=[4+step+fall*7,side*(6+fall*5),10*h],foot:V=[step+fall*10,side*(7+fall*8),1];
    r.limb(hip,knee,5,'#414a32','#8e9460');r.limb(knee,foot,3,'#4b5134','#a7a676');
    for(let i=0;i<3;i++)r.limb(foot,[foot[0]+5+i,foot[1]+side*(i-1)*2,0],1.7,'#52583a','#a8a076');
    const shoulder:V=[lean,side*9,36*h],elbow:V=[lean-4-wind*5+hit*13,side*(15+wind*3+fall*4),25*h+wind*10];
    const hand:V=[lean+3+hit*19,side*(18-hit*8+fall*6),13*h+wind*18];
    r.limb(shoulder,elbow,7,'#3b4c37','#849367');r.limb(elbow,hand,4,'#556046','#a7af7d');
    for(let i=0;i<3;i++)r.limb(hand,[hand[0]+8+hit*4,hand[1]+side*(i-1)*3,hand[2]-5-i],2,'#889578','#d0ca9b');
    r.limb([lean,side*3,46*h],[lean-3,side*11,56*h],2.5,'#4d5b3c','#a7ae77');
    r.limb([lean-3,side*9,53*h],[lean+2,side*16,55*h],1.6,'#60724b','#b5bd8a');
  }
  r.plate([lean,0,31*h],[[-9,-12],[-2,-17],[8,-11],[6,5],[2,11],[-5,8]],'#495c3e','#82966a');
  r.plate([lean+2,0,43*h],skull,'#374b3a','#8fa27b');
  for(const side of [-1,1])r.plate([lean+7,side*2.7,45*h],[[-1,-1],[1,-1],[1,1],[-1,1]],fall? '#435543':'#dfdf8b','#eef5b9');
}
/** Heavy wet abdomen, four splayed legs, luminous throat and an open spitting maw. */
function spitter(r:CreatureRig,p:CharacterPose,fall:number):void {
  const wind=clamp(-p.attack),pulse=(Math.sin(p.time*3)*.5+.5)*(1-fall),h=1-fall*.62;
  for(const side of [-1,1])for(let i=0;i<2;i++) {
    const step=Math.sin(p.time*8+i*Math.PI+side)*p.moving*4;
    const knee:V=[i*15-9+step,side*(16+fall*5),7*h];
    r.limb([i*12-9,side*6,12*h],knee,5,'#344b43','#647966');
    r.limb(knee,[i*17-10+step,side*(20+fall*4),1],3,'#42594d','#8a9771');
  }
  for(let i=0;i<4;i++) {
    r.plate([-13+i*6,0,(12+(i===1?3:0))*h],shell,'#364f48',i%2?'#5f7a65':'#7c8c69',1-i*.1);
    for(const side of [-1,1])r.plate([-13+i*6,side*5,(20-i)*h],diamond,'#68704c','#b4ac73',.25);
  }
  const throat:V=[12+wind*2,0,(15+wind*7)*h];
  r.glow(throat,14,'#8fc88c',(.12+pulse*.06+wind*.13)*(1-fall));
  r.plate(throat,shell,'#77936a','#bfd197',.65+wind*.18);
  r.plate([17+wind*2,0,(16+wind*7)*h],skull,'#263e3b','#668274',1.1);
  r.plate([21,0,(12+wind*4)*h],[[-5,-3],[4,-3],[3,3],[-4,3]],'#101e22','#567767');
  for(const side of [-1,1])r.plate([21,side*4,(20+wind*6)*h],diamond,fall?'#63736a':'#d6e7a5','#ebedbd',.18);
}
/** Six legs, faceted carapace, oversized pincers and a segmented stinger. */
function scuttler(r:CreatureRig,p:CharacterPose,fall:number):void {
  const wind=clamp(-p.attack),hit=p.attack>0?Math.sin(p.attack*Math.PI):0,h=1-fall*.65;
  for(const side of [-1,1]) {
    for(let i=0;i<3;i++) {
      const step=Math.sin(p.time*13+i*2.1+side)*p.moving*4;
      const knee:V=[-10+i*9+step,side*(17-fall*7),8*h];
      r.limb([-9+i*8,side*6,10*h],knee,2.7,'#766142','#bf9d65');
      r.limb(knee,[-14+i*13+step,side*(24-fall*10),1],1.8,'#94754b','#d2b27c');
    }
    const hand:V=[19+hit*9-wind*4,side*(12-hit*4),12*h];
    r.limb([5,side*7,12*h],[13,side*14,10*h],4,'#6d533b','#b18a54');
    r.limb([13,side*14,10*h],hand,5,'#876440','#d5ab69');
    r.plate(hand,[[-6,-3],[-3,-8],[3,-9],[1,-3],[6,-7],[7,0],[3,6],[-3,4]],'#8b6841','#d0a56a',.8);
  }
  for(let i=0;i<3;i++)r.plate([-9+i*7,0,12*h],shell,i%2?'#826443':'#9b7b4a','#d6b579',.72);
  let start:V=[-13,0,13*h];
  for(let i=0;i<5;i++) {
    const a=i*.54,tip:V=[-16-Math.sin(a)*11+fall*i*3,0,(16+i*4+wind*i)*h];
    r.limb(start,tip,4-i*.45,'#9a7d51','#d9bb80');start=tip;
  }
  r.plate(start,[[-2,-4],[3,-3],[4,2],[0,5]],'#2d3940','#9fa79c');
  for(const side of [-1,1])r.plate([13,side*3,16*h],diamond,fall?'#796748':'#f1b96b','#ffe0a1',.17);
}
/** Broken plate armor and a frost-cleaver; folded joints retain that silhouette in death. */
function revenant(r:CreatureRig,p:CharacterPose,fall:number):void {
  const wind=clamp(-p.attack),hit=p.attack>0?Math.sin(p.attack*Math.PI):0,h=1-fall*.85,lean=fall*17;
  for(const side of [-1,1]) {
    const step=Math.sin(p.time*7+side*1.57)*p.moving*4;
    r.limb([lean,side*4,23*h],[fall*10+step,side*(5+fall*5),11*h],6,'#344953','#718e9b');
    r.limb([fall*10+step,side*(5+fall*5),11*h],[step,side*(7+fall*8),1],4,'#536773','#a6bbc4');
    r.plate([lean,side*10,36*h],shell,'#435a67','#a4beca',.55);
    const hand:V=[lean+4+hit*14,side*(14+fall*5),side>0?(22+wind*20)*h:22*h];
    r.limb([lean,side*10,36*h],[lean-2,side*15,26*h],5,'#344956','#8099a2');
    r.limb([lean-2,side*15,26*h],hand,3,'#577383','#b6cbd3');
    if(side>0) {
      const tip:V=[hand[0]+hit*14,hand[1],hand[2]+21*(1-fall)];
      r.limb(hand,tip,2,'#586668','#b4bcc1');
      r.plate(tip,[[-5,-3],[-8,-16],[2,-25],[5,-10],[1,0]],'#6d9aac','#d4f5f5');
    }
  }
  r.plate([lean,0,32*h],[[-9,-12],[7,-13],[10,-4],[6,12],[-6,12],[-11,-2]],'#3e5967','#9ab9c8');
  for(let i=0;i<3;i++)r.plate([lean+4,0,(26+i*5)*h],[[-6,0],[5,-1],[4,2],[-4,3]],'#567684','#bad6dd');
  r.plate([lean,0,47*h],skull,'#577c8a','#c1dee4',1.15);
  r.plate([lean+6,0,48*h],[[-4,-1],[4,-1],[3,1],[-3,1]],fall?'#577383':'#b2f1ff','#e4fdff');
}
/** Charred bell-shaped robe, floating embers and a hand-carried censer. */
function acolyte(r:CreatureRig,p:CharacterPose,fall:number):void {
  const h=1-fall*.86,wind=clamp(-p.attack),lean=fall*18;
  r.plate([lean-3,0,18*h],[[-13,16],[-8,-20],[0,-26],[9,-18],[14,16],[6,19],[0,15],[-7,19]],'#332e36','#715048',1-fall*.32);
  for(let i=-1;i<=1;i++)r.limb([lean,i*4,32*h],[lean+2,i*10,3],1.4,'#805849','#b78b62');
  r.plate([lean,0,43*h],[[-9,6],[-8,-5],[0,-14],[8,-4],[10,8],[2,4],[-3,8]],'#49383c','#ac7757');
  r.plate([lean+5,0,42*h],skull,'#151f25','#71524c',.6);
  r.glow([lean+7,0,43*h],17,'#ffa35d',.22*(1-fall));
  for(const side of [-1,1]) {
    const hand:V=[lean+8,side*15,(23+wind*15)*h];
    r.limb([lean,side*7,34*h],[lean,side*12,26*h],6,'#4f3940','#9a6250');
    r.limb([lean,side*12,26*h],hand,3,'#7b614e','#bfa27a');
    if(side>0) {
      r.limb(hand,[hand[0],hand[1],hand[2]-9],.7,'#bca077','#dccaa3');
      r.plate([hand[0],hand[1],hand[2]-13],diamond,'#644c40','#c09b69',.7);
      r.glow([hand[0],hand[1],hand[2]-12],19,'#ff9d57',(.28+wind*.2)*(1-fall));
      r.plate([hand[0]+3,hand[1],hand[2]-11],diamond,fall?'#503d36':'#ffc976','#fff0b8',.22);
    }
  }
}
/** Suspended crystal shards: pieces orbit while alive, fall and scatter individually. */
function sentinel(r:CreatureRig,p:CharacterPose,fall:number):void {
  const wind=clamp(-p.attack),float=(Math.sin(p.time*2)*2)*(1-fall),height=31*(1-fall)+4+float;
  r.glow([0,0,height],25,'#a5baff',(.28+wind*.23)*(1-fall));
  r.plate([0,0,height],diamond,fall?'#435169':'#788cab',fall?'#77849a':'#e1e7fc',1.25);
  for(let i=0;i<6;i++) {
    const angle=i*Math.PI/3+p.time*.3*(1-fall),radius=14+wind*5+fall*12;
    const at:V=[Math.cos(angle)*radius,Math.sin(angle)*radius,(26+Math.sin(angle*2)*11)*(1-fall)+3];
    r.plate(at,diamond,i%2?'#445972':'#63738d','#b9d2e6',i%2?.62:.85);
    if(fall<.8)r.limb([0,0,height],at,.6,'#5b708e','#a8bce1');
  }
  r.plate([0,0,55*(1-fall)+4],diamond,'#445971','#c4dceb',.48);
  r.plate([0,0,10*(1-fall)+2],diamond,'#566984','#bcd4eb',.45);
}
const painters: Record<RegionalEnemyKind,(r:CreatureRig,p:CharacterPose,fall:number)=>void> = {
  thornReaver:reaver,mireSpitter:spitter,frostRevenant:revenant,emberAcolyte:acolyte,duneScuttler:scuttler,stormSentinel:sentinel,
};
export function drawRegionalEnemy(c:CanvasRenderingContext2D,p:CharacterPose,color:Color):void {
  const r=new CreatureRig(c,p.angle,color);painters[p.kind as RegionalEnemyKind](r,p,0);r.draw();
}
export function drawRegionalDeath(c:CanvasRenderingContext2D,kind:RegionalEnemyKind,recipe:DeathAnimation,age:number,facing:number):void {
  const fall=smooth(age/recipe.settle),travel=recipe.travel*smooth(age/recipe.contact);

  const pose:CharacterPose={kind,angle:facing+recipe.twist*fall,time:0,moving:0,attack:0,attackAngle:facing,hitFlash:0,dodging:false};
  const r=new CreatureRig(c,pose.angle,value=>mixColor(value,'#233034',fall*.35),[Math.cos(facing)*travel,Math.sin(facing)*travel*.55]);painters[kind](r,pose,fall);r.draw();
}
