import type { DeathAnimation } from './death-content.ts';
import { DeathMesh } from './death-mesh.ts';
import { frame3, at, ease, clamp01, vadd, solveLimb, type Vec3 } from './death-rig.ts';
import { mixColor } from './art-primitives.ts';

export function drawHoundDeath(c:CanvasRenderingContext2D,recipe:DeathAnimation,age:number,facing:number):void {
  const t=clamp01(age/recipe.settle),fall=ease(age/recipe.contact),settle=ease((age-recipe.contact)/(recipe.settle-recipe.contact));
  const roll=recipe.family==='roll'?fall*1.5:recipe.family==='curl'?fall*.65:0;
  const pitch=recipe.family==='chest'?Math.sin(fall*Math.PI)*.42:recipe.family==='haunch'?-Math.sin(fall*Math.PI)*.4:fall*.08;
  const height=12-fall*(recipe.family==='haunch'?7.5:8.6);
  const body=frame3([0,recipe.travel*fall,height],pitch,recipe.twist*fall,roll);
  const b=(x:number,y:number,z:number)=>at(body,x,y,z),mesh=new DeathMesh(facing,1);
  for(const end of [-1,1]) for(const side of [-1,1]) {
    const root=b(side*3,end*6.5,-1);
    const tuck=recipe.family==='curl'?fall*4:recipe.family==='haunch'&&end<0?fall*5:0;
    const target:Vec3=[side*(4.7+(recipe.family==='roll'?fall*4:0)),end*7.2+recipe.travel*fall*.45-end*tuck,1];
    const leg=solveLimb(root,target,vadd(root,[side*3,end*2+3,-6]),6.4,6.8);
    mesh.bone(leg[0],leg[1],3.2,2,'#b2bba1');mesh.bone(leg[1],leg[2],1.8,1.2,'#82968b');
    mesh.solid(frame3(leg[2]),[[-1.7,0],[-1.6,1.3],[1.7,1.3],[2.2,0]],3.3,'#d4cfaf');
  }
  const rings=[[-9,.6],[-5,1],[1,1.05],[6,.85],[9,.5]].map(([y,s])=>
    [[-3,-2],[-4,1],[-3,3.5],[0,4.5],[3.5,2.5],[3,-1],[0,-3]].map(([x,z])=>b(x*s,y,z*s)));
  for(let r=1;r<rings.length;r++)for(let j=0;j<7;j++)mesh.face([rings[r-1][j],rings[r-1][(j+1)%7],rings[r][(j+1)%7],rings[r][j]],j<3?'#617d6d':'#788f7e');
  for(let i=0;i<5;i++) {
    const y=-6+i*2.6;mesh.face([b(-4,y,1),b(-3,y,4),b(0,y,5.4),b(4,y,2),b(4,y,-2)],'#c4c5a7',1.1);
    mesh.solid({...body,origin:b(0,y,5)},[[-.6,0],[0,4],[1.1,0]],1.5,'#b7b493');
  }
  const skull=frame3(vadd(b(0,11,2),[0,0,-settle*(recipe.family==='haunch'?5:3)]),pitch+settle*.35,recipe.family==='curl'?fall*.65:recipe.twist*fall,roll*.8);
  const h=(x:number,y:number,z:number)=>at(skull,x,y,z);
  mesh.solid(skull,[[-3,-1],[-4,3],[-2,6],[2,6],[4,3],[3,-2]],10,'#e0d4ab');
  mesh.solid({...skull,origin:h(0,7,0)},[[-2,-1],[-2.5,2],[2.5,2],[2,-1]],7,'#c9c69f');
  mesh.bone(h(-2,2,-2),h(-1.7,10,-2-settle*.2),1.1,.8,'#a7b099');
  mesh.bone(h(2,2,-2),h(1.7,10,-2-settle*.2),1.1,.8,'#a7b099');
  for(const s of [-1,1]) {
    mesh.solid({...skull,origin:h(s*2.8,-2,4)},[[-1,0],[0,6],[1.8,1]],1.5,'#a6b394');
    mesh.face([h(s*3.8,2,2),h(s*3.7,4,2)],mixColor('#e9bd63','#263833',ease(age/.18)),1.2);
    mesh.bone(h(s*2.3,7,-.4),h(s*2.3,7,-3),.9,.2,'#ede0ba');
  }
  const tail=[b(0,-9,1),b(.8,-15,2-fall),b(1.3,-21,8*(1-ease(t*1.2)))];
  mesh.bone(tail[0],tail[1],2.2,1.4,'#adb89a');mesh.bone(tail[1],tail[2],1.4,.4,'#adb89a');
  mesh.draw(c);
}

export function drawWispDeath(c:CanvasRenderingContext2D,recipe:DeathAnimation,age:number,facing:number):void {
  const t=clamp01(age/recipe.settle),fall=ease((age-.12)/(recipe.contact-.12)),settle=ease((age-recipe.contact)/(recipe.settle-recipe.contact));
  const tumble=recipe.family==='tumble',spiral=recipe.family==='spiral',snuff=recipe.family==='snuff';
  const pitch=tumble?fall*1.4+Math.sin(settle*Math.PI*2)*(1-settle)*.13:spiral?Math.sin(fall*Math.PI)*.4:0;
  const yaw=spiral?fall*Math.PI*1.8:tumble?fall*.5:0;
  const roll=tumble?fall*.3:0;
  const height=Math.abs(Math.cos(pitch)*Math.cos(roll))*12+Math.abs(Math.sin(pitch))*8+Math.abs(Math.sin(roll))*8;
  const frame=frame3([spiral?Math.sin(fall*Math.PI*2)*4:0,recipe.travel*fall,22*(1-fall)+height*fall],pitch,yaw,roll);
  const b=(x:number,y:number,z:number)=>at(frame,x,y,z),mesh=new DeathMesh(facing,1);
  mesh.solid({...frame,origin:b(0,0,8)},[[-8,0],[-5,3],[5,3],[8,0],[5,-2],[-5,-2]],10,'#7e958b');
  mesh.solid({...frame,origin:b(0,0,-8)},[[-6,1],[6,1],[4,-3],[0,-5],[-4,-3]],8,'#344a4e');
  for(const x of [-6,6]) for(const y of [-4,4]) {
    mesh.bone(b(x,y,8),b(x*1.08,y,0),1.5,1.4,'#a1b29b');
    mesh.bone(b(x*1.08,y,0),b(x*.65,y*.7,-8),1.4,1.2,'#a1b29b');
  }
  for(const x of [-3,3]) mesh.bone(b(x,5,8),b(x,5,-7),.9,.8,'#344c4d');
  const ring=[b(-2,0,11),b(-3,0,14),b(0,0,17),b(3,0,14),b(2,0,11)];
  mesh.face(ring,'#9aa88b',1.1);
  // Solid iron keeps its dimensions. Only the flame changes size/opacity.
  for(let i=0;i<3;i++) {
    const z=-12-i*.5,x=(i-1)*3;
    mesh.face([b(x-1,0,-7),b(x+1,0,-7),b(x+2,1,z-5*(1-fall)),b(x-1,1,z-7*(1-fall))],'#527e77');
  }
  mesh.draw(c);
  const flameLife=1-ease(age/(snuff?1.05:spiral?.95:.44));
  if(flameLife>0) {
    c.save();c.globalAlpha*=flameLife;
    const flame=new DeathMesh(facing,1),lift=snuff?ease(t)*30:spiral?Math.sin(t*Math.PI)*13:0;
    const center=vadd(frame.origin,[spiral?Math.sin(t*12)*5:0,0,lift]);
    const f=frame3(center,0,spiral?t*7:0);
    const size=snuff?1:Math.max(.1,flameLife);
    flame.solid(f,[[-5*size,-3],[-3*size,5],[0,11*size],[2*size,4],[5*size,1],[3*size,-4],[0,-6]],4*size,'#407c78');
    flame.solid({...f,origin:at(f,0,2,0)},[[-2*size,-2],[-1*size,3],[1*size,7*size],[2*size,0],[0,-4]],2*size,'#d9edbe');
    flame.draw(c);c.restore();
  }
}
