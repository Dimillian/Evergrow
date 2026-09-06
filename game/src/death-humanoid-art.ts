import type { EnemyKind } from './model.ts';
import type { DeathAnimation } from './death-content.ts';
import { DeathMesh } from './death-mesh.ts';
import { humanoidDeathPose, frame3, at, ease, vadd, vmul, solveLimb, type Vec3, type Frame3 } from './death-rig.ts';
import { mixColor } from './art-primitives.ts';

export type HumanoidKind=Exclude<EnemyKind,'hound'|'wisp'>;
interface Material { scale:number; width:number; skin:string; bone:string; cloth:string; chest:string; metal:string }
export const DEATH_MATERIALS: Readonly<Record<HumanoidKind,Material>>={
  stalker:{scale:1,width:1,skin:'#8e9579',bone:'#b0ac8c',cloth:'#394f49',chest:'#777f64',metal:'#a9a78a'},
  brute:{scale:1.07,width:1.6,skin:'#8f8c6a',bone:'#a3a180',cloth:'#5b3d37',chest:'#767258',metal:'#778077'},
  caster:{scale:1,width:.92,skin:'#a2a589',bone:'#b0ae90',cloth:'#28666a',chest:'#314a4b',metal:'#849681'},
  archer:{scale:1,width:.95,skin:'#a0a587',bone:'#cec6a3',cloth:'#233d39',chest:'#565c40',metal:'#a5a16e'},
  goblin:{scale:.76,width:1,skin:'#819963',bone:'#b6be7a',cloth:'#4a4042',chest:'#82634b',metal:'#c7cdac'},
  goblinChief:{scale:1.14,width:1,skin:'#76834e',bone:'#b6be7a',cloth:'#9c4941',chest:'#536574',metal:'#697781'},
  warden:{scale:2.42,width:1.4,skin:'#69786b',bone:'#969c81',cloth:'#263a3a',chest:'#9a9f80',metal:'#65746b'},
};

function gear(mesh:DeathMesh,kind:HumanoidKind,hand:Vec3,recipe:DeathAnimation,age:number):void {
  if(kind==='stalker') return;
  const t=ease((age-recipe.delay)/(recipe.settle-recipe.delay));
  const pitch=kind==='caster'?t*1.55:.45+t*1.12;
  const f=frame3(hand,pitch,kind==='archer'?.35:0);
  if(kind==='caster') {
    mesh.bone(at(f,0,0,-7),at(f,0,0,24),1.8,1.3,'#7c7050');
    mesh.solid({...f,origin:at(f,0,0,25)},[[-3,0],[0,6],[3,0],[0,-5]],2,'#849681');
    mesh.solid({...f,origin:at(f,0,1.2,25)},[[-1.5,0],[0,3],[1.5,0],[0,-2]],1,mixColor('#94d1be','#344841',t));
  } else if(kind==='archer') {
    const curve=[at(f,0,0,-15),at(f,4,0,-10),at(f,6,0,0),at(f,4,0,10),at(f,0,0,15)];
    for(let i=1;i<curve.length;i++) mesh.bone(curve[i-1],curve[i],1.4,1,'#658c76');
    mesh.face([curve[0],at(f,.5,0,0),curve[4]],'#d4cc9a',.45);
  } else {
    const boss=kind==='warden',club=kind==='brute',length=boss?31:club?24:16;
    mesh.bone(at(f,0,0,-3),at(f,0,0,length),boss?2.6:club?2:1.4,1.4,'#6d583b');
    if(boss) mesh.solid({...f,origin:at(f,0,0,24)},[[-1,-4],[-9,1],[-11,7],[-7,12],[3,10],[10,6],[8,-1],[2,-2]],2.2,'#82917c');
    else if(club) mesh.solid({...f,origin:at(f,0,0,19)},[[-4,-3],[-5,4],[-2,8],[3,7],[5,2],[3,-4]],4,'#707768');
    else mesh.solid({...f,origin:at(f,0,0,5)},[[-1.5,0],[-2,9],[0,13],[2,8],[1.5,0]],.8,'#c7cdac');
  }
}

/** Archetype-specific volumes and equipment riding independent body joints. */
export function drawHumanoidDeath(c:CanvasRenderingContext2D,kind:HumanoidKind,recipe:DeathAnimation,age:number,facing:number):void {
  const m=DEATH_MATERIALS[kind],k=humanoidDeathPose(recipe,age),mesh=new DeathMesh(facing,m.scale);
  const broad=(v:Vec3):Vec3=>[v[0]*m.width,v[1],v[2]];
  const body=frame3(k.hip,k.pitch,k.twist);
  const b=(x:number,y:number,z:number)=>at(body,x*m.width,y,z);
  const shoulder=b(0,0,10),headCenter=vadd(shoulder,vmul(frame3([0,0,0],k.headPitch).up,7));
  const head=frame3(headCenter,k.headPitch,k.twist*.6);
  const h=(x:number,y:number,z:number)=>at(head,x,y,z);
  const heavy=kind==='brute'||kind==='warden',goblin=kind==='goblin'||kind==='goblinChief';
  const robed=kind==='caster'||kind==='archer'||kind==='warden';
  const held:Vec3[]=[];
  for(let i=0;i<2;i++) {
    const s=i?1:-1,root=b(s*3,0,0);
    const leg=solveLimb(root,broad(k.feet[i]),vadd(root,[s*3,11,-6]),8,8.5);
    mesh.bone(leg[0],leg[1],heavy?6:3.8,heavy?4.5:2.7,m.chest);
    mesh.bone(leg[1],leg[2],heavy?4.5:2.7,heavy?3.8:1.8,m.skin);
    mesh.solid(frame3(vadd(leg[2],[0,1,0])),[[-2,0],[-2,2],[2.3,2],[3,0]],heavy?6:4,goblin?'#463c30':heavy?'#222b30':m.bone);
    const armRoot=b(s*5,0,10),target=broad(k.hands[i]);
    const arm=solveLimb(armRoot,target,vadd(armRoot,[s*12,-2,-7]),9,10.5);
    mesh.bone(arm[0],arm[1],heavy?6:3.8,heavy?4.5:2.5,m.skin);
    mesh.bone(arm[1],arm[2],heavy?4.5:2.6,heavy?3:1.6,m.bone);
    held.push(arm[2]);
    if(kind==='stalker') for(let claw=0;claw<2;claw++) mesh.bone(vadd(arm[2],[claw*1.5,0,0]),vadd(arm[2],[claw*1.5+s,3,0]),.8,.15,'#cbc09a');
    if(heavy) mesh.solid({...body,origin:armRoot},[[-3,0],[-4,4],[0,6],[5,3],[4,-2],[0,-3]],5,m.metal);
  }
  const chest:Frame3={...body,right:vmul(body.right,m.width)};
  mesh.solid(chest,[[-4,-1],[-7,5],[-6,11],[-3,13],[4,13],[7,8],[5,0],[0,-2]],heavy?7:5,m.chest);
  if(kind==='stalker'||kind==='warden') {
    for(let i=0;i<(kind==='warden'?4:3);i++) mesh.face([b(-4,3.7,10-i*2.6),b(0,4.2,8.5-i*2.6),b(4,3.7,10-i*2.6)],kind==='warden'?'#263a39':'#c0b797',kind==='warden'?1.1:1);
  } else {
    mesh.face([b(-4,3.6,10),b(4,3.6,3)],goblin?'#c19a62':m.metal,1.4);
    mesh.face([b(-4,3.6,0),b(4,3.6,0)],'#ac8d56',1.5);
  }
  if(robed) {
    // Cloth drapes from hips toward the feet; it is separate from the rigid chest.
    const hem=k.feet.map(v=>broad(v));
    mesh.face([b(-5,-3,11),b(5,-3,11),vadd(hem[1],[4,-3,1]),vadd(hem[1],[-2,-3,0]),vadd(hem[0],[2,-3,0]),vadd(hem[0],[-4,-3,1])],m.cloth);
    mesh.face([b(-4,3,1),b(4,3,1),vadd(hem[1],[1,2,1]),vadd(hem[0],[-1,2,1])],m.cloth);
    mesh.face([b(-2,3.7,11),b(-1,3.7,11),b(-2,4,-6)],kind==='caster'?'#a0926a':'#708063');
  } else if(kind==='stalker') {
    mesh.face([b(-6,2,11),b(-3,3,11),b(-4,4,3),b(-7,2,-4),b(-8,1,0)],m.cloth);
    mesh.face([b(-5,3,10),b(-5,4,4),b(-7,3,-2)],'#769080',.6);
  } else mesh.solid({...chest,origin:b(0,0,-1)},[[-5,1],[5,1],[4,-4],[0,-2],[-4,-4]],5,m.cloth);
  mesh.bone(shoulder,headCenter,3,3,m.skin);
  const skull:readonly (readonly [number,number])[]=goblin?[[-5,-4],[-6,1],[-4,5],[2,6],[6,2],[4,-5],[0,-7]]:
    kind==='warden'?[[-5,-4],[-5,4],[0,7],[6,4],[5,-4],[0,-8]]:[[-4,-4],[-5,2],[-2,6],[3,5],[5,1],[4,-5],[0,-7]];
  mesh.solid(head,skull,6,kind==='caster'?'#425953':kind==='archer'?'#48684c':m.bone);
  const hood=kind==='caster'||kind==='archer'||kind==='warden';
  if(hood) mesh.face([h(-3.5,3.1,1.5),h(0,3.2,3.7),h(3.5,3.1,.7),h(2.5,3.1,-4),h(0,3.2,-5),h(-3,3.1,-3)],'#11282d');
  const eye=mixColor(kind==='warden'?'#b3e6c2':'#ddc769','#27342d',ease(age/.24));
  for(const s of [-1,1]) {
    mesh.face([h(s*2-.9,3.3,-.4),h(s*2+.8,3.3,-.4)],'#27342d',1.6);
    mesh.face([h(s*2-.5,3.4,-.4),h(s*2+.5,3.4,-.4)],eye,.8);
    if(goblin) {
      mesh.solid({...head,origin:h(s*5,0,1)},[[0,0],[s*8,4],[s*5,-3],[0,-2]],1.6,m.skin);
      mesh.face([h(s*11,1,3),h(s*6,1,-1)],'#bb9a78',.8);
    }
    if(kind==='caster'||kind==='warden') {
      mesh.bone(h(s*4,0,4),h(s*7,0,10),1.5,.7,m.metal);
      if(kind==='warden')mesh.bone(h(s*7,0,10),h(s*8,0,6),.7,.4,'#b8b58a');
    }
  }
  if(kind==='stalker') {
    mesh.bone(h(-3,0,4),h(-5,0,9),1.2,.6,'#748169');
    mesh.bone(h(-5,0,8),h(-8,0,9),.8,.3,'#9ba180');
    mesh.face([h(1,3.1,4),h(-.3,3.1,1),h(1,3.1,-1)],'#535f50',.7);
  }
  if(goblin) {
    mesh.solid({...head,origin:h(0,3,-2)},[[0,1],[4,-1],[0,-2]],2,m.bone);
    mesh.face([h(-2,3.4,-4),h(3,3.4,-4)],'#27322a',.9);
  }
  if(kind==='goblinChief') {
    mesh.solid({...head,origin:h(0,0,4)},[[-6,0],[-5,5],[-1,2],[2,6],[6,1],[5,-1]],6,m.metal);
    const flag=frame3(b(-6,-3,0),k.pitch*(.6+.4*ease(age/recipe.settle))+.12*Math.sin(Math.min(age,recipe.settle)*6)*(1-ease(age/recipe.settle)),k.twist);
    mesh.bone(at(flag,0,0,0),at(flag,0,0,31),1.5,1,'#756049');
    mesh.face([at(flag,0,0,31),at(flag,15,0,28),at(flag,12,1,22),at(flag,6,2,25),at(flag,0,0,24)],'#9b443c');
    mesh.face([at(flag,4,.2,28),at(flag,8,.2,27),at(flag,8,1,25)],'#d5c99a',1.5);
  }
  if(kind==='archer') {
    for(const s of [-1,1]) {
      mesh.bone(b(s*4,0,11),b(s*7,-1,16),1.3,1,'#6b7460');
      mesh.bone(b(s*7,-1,16),b(s*9,-1,21),1,.5,'#a4a480');
      mesh.bone(b(s*7,-1,16),b(s*12,-1,17),.8,.4,'#a4a480');
    }
    const quiver={...body,origin:b(-4,-5,2)};
    mesh.solid(quiver,[[-2,0],[2,0],[2,16],[-2,16]],3,'#343c35');
    for(let i=0;i<3;i++) mesh.bone(at(quiver,i-1,0,12),at(quiver,i-1,0,22+i%2*2),.6,.5,'#b7a779');
  }
  gear(mesh,kind,held[1],recipe,age);
  if(kind==='goblinChief') mesh.solid(frame3(held[0],k.pitch),[[-1,0],[-8,3],[-10,0],[-4,-2]],3,'#d5b577');
  else if(kind==='goblin') mesh.solid(frame3(held[0],k.pitch),[[-3,-3],[-4,2],[1,4],[3,2],[2,-3]],2,'#635548');
  mesh.draw(c);
}
