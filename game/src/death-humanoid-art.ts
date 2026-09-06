import type { EnemyKind } from './model.ts';
import type { DeathAnimation } from './death-content.ts';
import { DeathMesh } from './death-mesh.ts';
import { humanoidDeathPose, humanoidDeathArm, frame3, at, ease, vadd, vmul, solveLimb, type Vec3 } from './death-rig.ts';
import { mixColor } from './art-primitives.ts';
import { weaponShapes } from './weapon-shapes.ts';
import { deathWeaponFrame } from './death-weapon.ts';

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
  const f=deathWeaponFrame(kind,recipe,age,hand,DEATH_MATERIALS[kind].width);
  if(kind==='caster') {
    mesh.bone(at(f,0,0,-7),at(f,0,0,24),1.8,1.3,'#7c7050');
    for(const side of [-1,1]) mesh.face([at(f,0,side*.7,20),at(f,-3.5,side*.7,25),at(f,0,side*.7,31),at(f,3.5,side*.7,25),at(f,0,side*.7,20)],'#849681',1.2);
    const crystal=mesh.solid({...f,origin:at(f,0,0,25)},[[-2.1,0],[0,4],[2,0],[0,-3]],1,mixColor('#94d1be','#344841',t));
    for(const side of [-1,1]) mesh.detail(crystal,[[0,3],[0,-1]],mixColor('#daf0c9','#849681',t),.8,side);
  } else if(kind==='archer') {
    const shapes=weaponShapes({kind:'bow',length:30,width:15,gripLength:9,metal:'#658c76',edge:'#d4cc9a',grip:'#5b6040',guard:'#a5a274'});
    const curve=shapes[0].points;
    const bow=mesh.solid(f,[...curve.map(([x,z])=>[x-1.9,z] as const),...[...curve].reverse().map(([x,z])=>[x+1.9,z] as const)],1.6,'#192830');
    const side=mesh.visibleSide(bow);
    for(const shape of shapes.slice(1)) mesh.detail(bow,shape.points,shape.fill??shape.stroke!,shape.fill?0:shape.width,side);

  } else {
    const boss=kind==='warden',club=kind==='brute',length=boss?31:club?24:16;
    mesh.bone(at(f,0,0,-3),at(f,0,0,length),boss?2.6:club?2:1.4,1.4,'#6d583b');
    if(boss) {
      const axe=mesh.solid(f,[[-4,39],[-28,60],[-25,68],[0,75],[20,65],[17,52],[4,58]].map(([x,z])=>[x/2.42,z/2.42]),2.2,'#82917c');
      for(const side of [-1,1]) mesh.detail(axe,[[-26,60],[-21,69],[0,74],[18,66]].map(([x,z])=>[x/2.42,z/2.42]),'#c4c69c',2/2.42,side);
    }
    else if(club) {
      const hammer=mesh.solid(f,[[-4,13],[-5,22],[-2,27],[3,26],[5,21],[3,13]],4,'#707768');
      for(const side of [-1,1]) {
        mesh.detail(hammer,[[-4,13],[-5,22],[-2,25],[-1,14]],'#a8aa8e',0,side);
        mesh.detail(hammer,[[-3.8,16],[3,16],[4,21]],'#c1ad78',1,side);
        mesh.detail(hammer,[[-3,22],[0,24],[2,21.5]],'#363f3b',1.1,side);
      }
    }
    else {
      const blade=mesh.solid(f,[[-1.75,0],[-1.4,17],[1.4,17],[1.75,0]],.8,'#313e40');
      for(const side of [-1,1]) {
        mesh.detail(blade,[[0,4],[0,17]],'#c7cdac',2,side);
        mesh.detail(blade,[[-.4,17],[-.4,0]],'#ead5a0',.65,side);
      }
    }
  }
}

/** Archetype-specific volumes and equipment riding independent body joints. */
export function drawHumanoidDeath(c:CanvasRenderingContext2D,kind:HumanoidKind,recipe:DeathAnimation,age:number,facing:number):void {
  const m=DEATH_MATERIALS[kind],k=humanoidDeathPose(recipe,age),mesh=new DeathMesh(facing,m.scale);
  const broad=(v:Vec3):Vec3=>[v[0]*m.width,v[1],v[2]];
  const body=frame3(k.hip,k.pitch,k.twist);
  const b=(x:number,y:number,z:number)=>at(body,x*m.width,y,z);
  const shoulder=b(0,0,10),headCenter=vadd(shoulder,vmul(frame3([0,0,0],k.headPitch).up,7));
  let head=frame3(headCenter,k.headPitch,k.twist*.6);
  if(kind==='goblin'||kind==='goblinChief') head={...head,right:vmul(head.right,1.25)};
  const h=(x:number,y:number,z:number)=>at(head,x,y,z);
  const heavy=kind==='brute'||kind==='warden',goblin=kind==='goblin'||kind==='goblinChief';
  const robed=kind==='caster'||kind==='archer'||kind==='warden';
  const held:Vec3[]=[];
  for(let i=0;i<2;i++) {
    const s=i?1:-1,root=b(s*3,0,0);
    const leg=solveLimb(root,broad(k.feet[i]),vadd(root,[s*3,11,-6]),8,8.5);
    mesh.bone(leg[0],leg[1],heavy?6:3.8,heavy?4.5:2.7,kind==='brute'?(i?'#454d3d':'#605d46'):m.chest);
    mesh.bone(leg[1],leg[2],heavy?4.5:2.7,heavy?3.8:1.8,kind==='brute'?(i?'#454d3d':'#605d46'):kind==='archer'?'#73684e':m.skin);
    mesh.solid(frame3(vadd(leg[2],[0,1,0])),[[-2,0],[-2,2],[2.3,2],[3,0]],heavy?6:4,goblin?'#463c30':heavy||kind==='archer'?'#222b30':m.bone);
    const armRoot=b(s*5,0,10),arm=humanoidDeathArm(k,m.width,i);
    mesh.bone(arm[0],arm[1],heavy?6:kind==='caster'?5.5:3.8,heavy?4.5:kind==='caster'?4:2.5,kind==='caster'?(i?'#314a4b':'#395757'):m.skin);
    mesh.bone(arm[1],arm[2],heavy?4.5:2.6,heavy?3:1.6,m.bone);
    if(kind==='archer') mesh.face([vadd(arm[1],[-.5,1,0]),vadd(arm[2],[-.5,1,0])],'#d0c6a0',.65);
    held.push(arm[2]);
    if(kind==='stalker') for(let claw=0;claw<2;claw++) mesh.bone(vadd(arm[2],[claw*1.5,0,0]),vadd(arm[2],[claw*1.5+s,3,0]),.8,.15,'#cbc09a');
    if(heavy) {
      const plate=mesh.solid({...body,origin:armRoot},[[-3,0],[-4,4],[0,6],[5,3],[4,-2],[0,-3]],5,kind==='brute'?'#333e38':m.metal);
      if(kind==='brute') mesh.face([at(plate,-3,2.6,3),at(plate,0,2.6,4.5),at(plate,3.5,2.6,2)],'#8e9177',1.1);
    }
  }
  const chest=mesh.solid({...body,right:vmul(body.right,m.width)},[[-4,-1],[-7,5],[-6,11],[-3,13],[4,13],[7,8],[5,0],[0,-2]],heavy?7:5,kind==='warden'?'#65746b':m.chest);
  if(kind==='brute') {
    const plate=(points:readonly (readonly [number,number])[],color:string,width=0)=>mesh.detail(chest,points.map(([x,z])=>[x/m.width,z]),color,width);
    plate([[-9,8],[5,10],[8,4],[-5,2]],'#5b3d37');
    plate([[-6,14],[1,16],[7,12],[7,3],[1,-1],[-5,2]],'#343d3b');
    plate([[-5,13],[1,15],[1,2],[-3.8,3.5]],'#778077');
    plate([[-4.7,12.5],[1,14.5],[5.5,11.5]],'#b4b496',1);
    plate([[1,12],[1,4]],'#b39b6e',1.1);
    plate([[-1.8,8],[3.7,8]],'#b39b6e',.9);
    mesh.face([b(-5.6,3.8,-3),b(5,3.8,-2)],'#302e28',3);
    mesh.solid({...body,origin:b(.3,4,-3)},[[-1,1],[2,1],[2,-2],[-1,-2]],.5,'#928466');
  }
  if(kind==='warden') {
    mesh.detail(chest,[[-4.4,12],[4.1,12],[3.5,-.5],[0,-3],[-3.8,-1.5]],'#9a9f80');
    for(let i=0;i<4;i++) mesh.detail(chest,[[-3.8,10.3-i*2.9],[0,8.7-i*2.9],[3.8,10.3-i*2.9]],'#263a39',3/2.42);
  } else if(kind==='stalker') {
    for(let i=0;i<3;i++) mesh.detail(chest,[[-5+i,8-i*2.4],[0,6-i*2.4],[4-i*.5,7.5-i*2.4]],'#a9a78a',1);
  } else if(kind==='archer') {
    mesh.detail(chest,[[-4,7],[0,5],[4,7]],'#a5a16e',.8);
    mesh.detail(chest,[[-4,-1],[4,-1]],'#ac8d56',1.8);
    mesh.detail(chest,[[-1,0],[1.5,0],[1.5,-2.3],[-1,-2.3]],'#cbbb7d');
  } else if(kind!=='brute'&&kind!=='caster') {
    mesh.face([b(-4,3.6,10),b(4,3.6,3)],goblin?'#c19a62':m.metal,1.4);
    mesh.face([b(-4,3.6,0),b(4,3.6,0)],'#ac8d56',1.5);
  }
  if(robed) {
    // Cloth drapes from hips toward the feet; it is separate from the rigid chest.
    const hem=k.feet.map(v=>broad(v));
    mesh.face([b(-5,-3,11),b(5,-3,11),vadd(hem[1],[4,-3,1]),vadd(hem[1],[-2,-3,0]),vadd(hem[0],[2,-3,0]),vadd(hem[0],[-4,-3,1])],m.cloth);
    mesh.face([b(-4,3,1),b(4,3,1),vadd(hem[1],[1,2,1]),vadd(hem[0],[-1,2,1])],m.cloth);
    if(kind==='caster') {
      mesh.detail(chest,[[-4,11],[2,13],[4,0],[-4,0]],'#28666a');
      mesh.detail(chest,[[-3,9],[-1,10],[-1,0],[-4,0]],'#54a08b');
      mesh.detail(chest,[[-2.6,12],[-.9,12],[-1,-1],[-3,-1]],'#746d58');
      mesh.detail(chest,[[1.8,12],[3,11],[4,-1],[2,-1]],'#a0926a');
      for(let seal=0;seal<2;seal++) mesh.detail(chest,[[2.2+seal*.2,7-seal*4],[3.3+seal*.2,5.8-seal*4],[2.7+seal*.2,4.8-seal*4]],'#294644',.7);
      mesh.detail(chest,[[-1,10],[1,8],[-1,5],[-3,8]],'#c9bc8c');
      mesh.detail(chest,[[-1,9],[0,8],[-1,6.5],[-2,8]],'#93cdb0');
      const left=vadd(hem[0],[3,2.5,1]),right=vadd(hem[1],[-3,2.5,1]);
      mesh.face([b(-2.6,3.2,0),b(-1,3.2,0),vadd(left,[1,0,0]),vadd(left,[-1,0,-1]),vadd(left,[-2,0,1])],'#746d58');
      mesh.face([b(2,3.2,0),b(4,3.2,0),vadd(right,[1,0,1]),vadd(right,[-1,0,-1]),vadd(right,[-2,0,1])],'#a0926a');
      mesh.face([vadd(left,[-2,0,0]),vadd(left,[1,0,2]),vadd(right,[2,0,0])],'#84846a',.9);
    }
  } else if(kind==='stalker') {
    const shroud=mesh.solid({...body,origin:at(chest,-1,2.8,0)},[[-6,10],[-3,12],[-2,4],[-4,-5],[-6,-2],[-7,-8],[-8,0]],.5,m.cloth);
    mesh.detail(shroud,[[-5.5,9],[-4,4],[-6,-3]],'#769080',.65);
  } else mesh.solid({...chest,origin:b(0,0,-1)},[[-5,1],[5,1],[4,-4],[0,-2],[-4,-4]],5,m.cloth);
  mesh.bone(shoulder,headCenter,3,3,m.skin);
  const skull:readonly (readonly [number,number])[]=goblin?[[-5,-4],[-6,1],[-4,5],[2,6],[6,2],[4,-5],[0,-7]]:
    kind==='warden'?[[-5,-4],[-5,4],[0,7],[6,4],[5,-4],[0,-8]]:[[-4,-4],[-5,2],[-2,6],[3,5],[5,1],[4,-5],[0,-7]];
  head=mesh.solid(head,skull,6,goblin?m.skin:kind==='caster'?'#425953':kind==='archer'?'#48684c':m.bone);
  const hood=kind==='caster'||kind==='archer'||kind==='warden';
  if(hood) mesh.detail(head,[[-3.5,1.5],[0,3.7],[3.5,.7],[2.5,-4],[0,-5],[-3,-3]],'#11282d');
  if(kind==='warden') mesh.detail(head,[[-3.7,1.65],[3.7,1.65],[2.9,-3.7],[0,-5],[-3.3,-3.3]],'#112825');
  if(kind==='archer') mesh.detail(head,[[-4.4,0],[-3.4,4],[-1,6.2],[0,2],[-1,-2]],'#829570');
  if(kind==='brute') {
    mesh.detail(head,[[-4,2],[-2,5],[0,5],[-1,-4],[-3,-4]],'#797f65');
    mesh.detail(head,[[-3.5,.6],[4,.6],[4,-1.4],[-3.5,-1.4]],'#29352e');
    mesh.detail(head,[[-2,-4],[2,-4]],'#4c503e',1);
  }
  const eye=mixColor(kind==='warden'?'#b3e6c2':'#ddc769','#27342d',ease(age/.24));
  for(const s of [-1,1]) {
    if(kind!=='stalker'&&!goblin&&kind!=='brute') {
      mesh.detail(head,[[s*2-.9,-.4],[s*2+.8,-.4]],'#27342d',1.6);
      mesh.detail(head,[[s*2-.5,-.4],[s*2+.5,-.4]],eye,.8);
    }
    if(goblin) {
      const ear=mesh.solid({...head,origin:h(s*5,0,1)},[[0,0],[s*8,4],[s*5,-3],[0,-2]],1.6,m.skin);
      mesh.detail(ear,[[s*6,2],[s,-2]],'#bb9a78',.8);
    }
    if(kind==='caster'||kind==='warden') {
      mesh.bone(h(s*4,0,4),h(s*7,0,8),kind==='caster'?1.9:1.5,1,m.metal);
      if(kind==='caster') {
        mesh.bone(h(s*7,0,8),h(s*6,0,13),1,.6,'#6d8373');
        mesh.face([h(s*4,.9,4),h(s*6.5,.9,8)],'#c8c39a',.65);
      }
      if(kind==='warden') {
        mesh.bone(h(s*4,0,4),h(s*7.4,0,9.1),1.24,1.24,'#b8b58a');
        mesh.bone(h(s*7.4,0,9.1),h(s*8.3,0,4.5),1.24,.6,'#b8b58a');
      }
    }
  }
  if(kind==='stalker') {
    mesh.detail(head,[[-4,4],[-1,3],[0,-6],[-3,-3]],'#727b65');
    mesh.detail(head,[[1,5],[-.3,1.8],[1,.2]],'#535f50',.7);
    mesh.bone(h(-3,0,4),h(-5,0,8),1.5,.9,'#748169');
    mesh.bone(h(-5,0,8),h(-3.6,0,10.5),.9,.4,'#748169');
    mesh.bone(h(-4.4,0,7.8),h(-7.1,0,8.7),.85,.3,'#9ba180');
    for(const x of [-2.5,1.7]) mesh.detail(head,[[x,.5],[x+2,.5],[x+2,-1.5],[x,-1.5]],'#27342d');
  }
  if(goblin) {
    mesh.detail(head,[[-5,3],[-2,2],[-1,-6],[-4,-4]],'#3a5145');
    mesh.detail(head,[[1,0],[7,-2],[2,-4]],m.bone);
    for(const x of [-3,2]) mesh.detail(head,[[x,0],[x+3,0],[x+3,-2],[x,-2]],'#192c26');
    mesh.detail(head,[[-2,-5],[3,-5]],'#27322a',1);
    mesh.detail(head,[[-1,-5],[-1,-3.5]],'#dfd5b7',1);
  }
  if(kind==='goblinChief') {
    const crown=mesh.solid({...head,origin:h(0,0,4)},[[-6,0],[-5,5],[-1,2],[2,6],[6,1],[5,-1]],6,m.metal);
    mesh.detail(crown,[[-5,0],[4,0]],'#d4b475',1);
    const flag=frame3(b(-6,-3,0),k.pitch*(.6+.4*ease(age/recipe.settle))+.12*Math.sin(Math.min(age,recipe.settle)*6)*(1-ease(age/recipe.settle)),k.twist);
    mesh.bone(at(flag,0,0,0),at(flag,0,0,31),1.5,1,'#756049');
    const banner=mesh.solid(flag,[[0,31],[17,28],[14,21],[10,23],[1,24]],.3,'#9b443c');
    for(const side of [-1,1]) {
      mesh.detail(banner,[[1,30],[16,27]],'#d59b60',.7,side);
      mesh.detail(banner,[[5,28],[9,27],[10,24],[6,23],[4,25]],'#d5c99a',0,side);
      for(const x of [6,8]) mesh.detail(banner,[[x,26],[x+1,26],[x+1,25],[x,25]],'#443c32',0,side);
    }
  }
  if(kind==='archer') {
    for(const s of [-1,1]) {
      mesh.bone(b(s*4,0,11),b(s*7,-1,16),1.3,1,'#6b7460');
      mesh.bone(b(s*7,-1,16),b(s*9,-1,21),1,.5,'#a4a480');
      mesh.bone(b(s*7,-1,16),b(s*12,-1,17),.8,.4,'#a4a480');
      mesh.bone(b(s*12,-1,17),b(s*13,-1,20),.8,.4,'#a4a480');
    }
    const quiver={...body,origin:b(-4,-5,-4)};
    const caseFrame=mesh.solid(quiver,[[-3,0],[0,-2],[3,0],[3,16],[-3,16]],3,'#343c35');
    for(const side of [-1,1]) mesh.detail(caseFrame,[[-3,15],[3,15],[3,1]],'#9b8656',1,side);
    for(let i=0;i<3;i++) {
      const x=-2+i*2;
      mesh.bone(at(quiver,x,0,12),at(quiver,x,0,22+i%2*2),.7,.5,'#b7a779');
      mesh.solid({...quiver,origin:at(quiver,x,0,0)},[[0,21],[-1.5,24],[0,25],[1.5,22]],.8,'#718e83');
    }
  }
  gear(mesh,kind,held[1],recipe,age);
  if(kind==='goblinChief') mesh.solid(frame3(held[0],k.pitch),[[-1,0],[-8,3],[-10,0],[-4,-2]],3,'#d5b577');
  else if(kind==='goblin') mesh.solid(frame3(held[0],k.pitch),[[-3,-3],[-4,2],[1,4],[3,2],[2,-3]],2,'#635548');
  mesh.draw(c);
}
