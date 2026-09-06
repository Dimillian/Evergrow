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
    mesh.bone(leg[0],leg[1],3.6,2.1,'#3e514c');
    mesh.bone(vadd(leg[0],[-.4,0,.3]),vadd(leg[1],[-.4,0,0]),2.2,1.5,'#b2bba1');
    mesh.bone(leg[1],leg[2],1.8,1.2,'#82968b');
    mesh.solid(frame3(leg[2]),[[-1.7,0],[-1.6,1.3],[1.7,1.3],[2.2,0]],3.3,'#d4cfaf');
  }
  const rings=[[-9,.6],[-5,1],[1,1.05],[6,.85],[9,.5]].map(([y,s])=>
    [[-3,-2],[-4,1],[-3,3.5],[0,4.5],[3.5,2.5],[3,-1],[0,-3]].map(([x,z])=>b(x*s,y,z*s)));
  for(let r=1;r<rings.length;r++)for(let j=0;j<7;j++)mesh.face([rings[r-1][j],rings[r-1][(j+1)%7],rings[r][(j+1)%7],rings[r][j]],j<3?'#617d6d':'#788f7e');
  for(let i=0;i<5;i++) {
    const y=-6+i*2.6;mesh.face([b(-4,y,1),b(-3,y,4),b(0,y,5.4),b(4,y,2),b(4,y,-2)],'#c4c5a7',1.1);
  }
  for(let i=0;i<4;i++) mesh.face([b(0,-6+i*3,4),b(0,-5+i*3,8),b(0,-3.6+i*3,4)],'#b7b493');
  const skull=frame3(vadd(b(0,0,3),[0,0,-settle*(recipe.family==='haunch'?5:3)]),pitch+settle*.35,recipe.family==='curl'?fall*.65:recipe.twist*fall,roll*.8);
  // The living hound's long angular skull, with sockets attached to both sides.
  const sideFrame=mesh.solid({...skull,right:skull.forward,forward:skull.right},[[5,1],[8,6],[12,7],[16,2],[19,1],[19,-1],[13,-2],[8,-1]],7.5,'#e0d4ab',x=>1-clamp01((x-12)/7)*.55);
  const h=(x:number,y:number,z:number)=>at(sideFrame,y,x,z);
  for(const side of [-1,1]) {
    mesh.detail(sideFrame,[[8,4],[12,4],[16,1],[19,1],[17,-1],[10,-1]],'#88947d',0,side);
    mesh.detail(sideFrame,[[9.5,4.5],[12.7,4.2],[12,2.1],[9.9,2.6]],'#263833',0,side);
    mesh.detail(sideFrame,[[10.5,3.6],[11.9,3.6]],mixColor('#e9bd63','#263833',ease(age/.18)),.9,side);
    mesh.detail(sideFrame,[[11,-1],[18,-1],[19,0]],'#a7b099',1.5,side);
    mesh.face([h(side*2.8,7,4),h(side*3.5,7,10),h(side*3,10,6)],side<0?'#a6b394':'#c9c69f');
    mesh.bone(h(side*2.4,15,0),h(side*2.4,15.7,-2.5),1.1,.15,'#ede0ba');
  }
  mesh.face([h(-2.2,11,-1),h(-1.7,18,-1),h(0,19,0),h(1.7,18,-1),h(2.2,11,-1)],'#a7b099',1.5);
  const tail=[b(0,-9,1),b(.8,-15,2-fall),b(1.3,-21,8*(1-ease(t*1.2)))];
  mesh.bone(tail[0],tail[1],2.3,1.8,'#4c6056');mesh.bone(tail[1],tail[2],1.8,.5,'#4c6056');
  mesh.face(tail.map(q=>vadd(q,[0,0,.8])),'#adb89a',.8);
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
  const cap=mesh.solid(frame,[[-9,8],[-5,11],[0,12.5],[5,11],[9,8],[6,6],[-6,6]],4,'#283f46');
  const base=mesh.solid(frame,[[-7,-6],[7,-6],[5,-10],[0,-12],[-5,-10]],5,'#344a4e');
  for(const side of [-1,1]) {
    mesh.detail(cap,[[-9,8],[-5,11],[0,12.5],[5,11],[7,9],[-5,8]],'#7e958b',0,side);
    mesh.detail(cap,[[-7.5,8],[0,9.8],[6.5,8.8]],'#d0c7a0',.7,side);
    mesh.detail(base,[[-6,-6.3],[0,-7.7],[6,-6.3]],'#c7b889',.9,side);
  }
  mesh.solid(frame,[[-1.4,-10],[1.4,-10],[2,-12],[0,-15],[-2,-12]],2,'#9ca488');
  for(const x of [-7,7]) for(const y of [-2,2]) {
    mesh.bone(b(x,y,7.5),b(x*1.14,y,-3),2.2,2.2,'#1c333b');
    mesh.bone(b(x*1.14,y,-3),b(x*.57,y,-8),2.2,2.2,'#1c333b');
    mesh.face([b(x-.4,y+Math.sign(y),7.1),b(x*1.07-.4,y+Math.sign(y),-2.5),b(x*.53,y+Math.sign(y),-7)],'#a1b29b',.65);
  }
  for(const x of [-3,3]) for(const y of [-2.5,2.5]) mesh.bone(b(x,y,8),b(x*1.16,y,-5),1,1,'#344c4d');
  const ring=[b(-2,0,11),b(-3,0,14),b(0,0,17),b(3,0,14),b(2,0,11)];
  mesh.face(ring,'#9aa88b',1.1);
  // Solid iron keeps its dimensions. Only the flame changes size/opacity.
  for(let i=0;i<3;i++) {
    const x=(i-1)*4,drift=Math.sin(3.8+i*1.8)*3*(1-fall),end=-20+fall*7;
    mesh.face([b(x-1,0,-8),b(x+2,0,-8),b(x+drift+1,1,end+4),b(x+drift-3,1,end+i),b(x+drift-1,1,end+6)],i===1?'#527e77':'#263f43');
    mesh.face([b(x,.1,-9),b(x+drift,1.1,end+6)],'#6b9d8d',.55);
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
