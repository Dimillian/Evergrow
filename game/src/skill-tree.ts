import { SKILL_SPECIALIZATIONS, specializationNode, OVERLOAD_NODE } from './skill-progression.ts';
import type { ActionResult, CharacterSheet, SkillId, StatKey, StatModifiers } from './character-types.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { SKILL_TERRITORIES, TERRITORY_SPECIALTIES, SKILL_DOCTRINES, BORDER_GARDENS, OUTER_SPECIALTIES } from './skill-tree-content.ts';
export { SKILL_TERRITORIES, SKILL_DOCTRINES } from './skill-tree-content.ts';
export type SkillDomain = 'Might' | 'Cunning' | 'Arcana';
export interface SkillNode {
  readonly id: string; readonly name: string; readonly description: string;
  readonly x: number; readonly y: number;
  readonly kind: 'origin' | 'minor' | 'major' | 'notable';
  readonly domain: SkillDomain; readonly territory?: string;
  readonly bonuses: Readonly<StatModifiers>;
  readonly skill?: SkillId; readonly specialization?: string; readonly developmentSkill?: SkillId;
  readonly doctrine?: string; readonly keystone?: boolean;
  readonly cluster?: string; readonly role?: 'travel' | 'cluster' | 'choice';
  readonly neighbors: readonly string[];
}
interface Point { x: number; y: number; }
export interface SkillEdge { readonly from: string; readonly to: string; readonly control?: Readonly<Point>; }
export interface SkillCluster { readonly id: string; readonly name: string; readonly domain: SkillDomain; readonly territory?: string; readonly x: number; readonly y: number; readonly radius: number; }
export const SKILL_TREE_ORIGIN = 'origin';
export const SKILL_TREE_VERSION = 2;
type MutableNode = Omit<SkillNode, 'neighbors'> & { neighbors: string[] };
// Different access structures: fork, loop, ladder, spur, fan, bridge, split path, long commitment.
const SHAPES = [
  {p:[[0,0],[55,-32],[55,32],[110,-55],[110,55],[163,0]],e:[[0,1],[0,2],[1,3],[2,4],[3,5],[4,5]]},
  {p:[[0,0],[42,-58],[107,-68],[152,-15],[107,45],[42,50]],e:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]]},
  {p:[[0,0],[52,-38],[52,38],[110,-38],[110,38],[168,-38],[168,38]],e:[[0,1],[0,2],[1,3],[2,4],[3,5],[4,6],[3,4]]},
  {p:[[0,0],[52,0],[103,0],[156,0],[103,-55]],e:[[0,1],[1,2],[2,3],[2,4]]},
  {p:[[0,0],[52,0],[107,-66],[124,0],[107,66]],e:[[0,1],[1,2],[1,3],[1,4]]},
  {p:[[0,0],[47,-40],[98,-40],[147,0],[98,40],[47,40],[98,92]],e:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[4,6]]},
  {p:[[0,0],[48,-40],[98,-65],[158,-38],[48,40],[98,65],[158,38]],e:[[0,1],[1,2],[2,3],[0,4],[4,5],[5,6]]},
  {p:[[0,0],[43,-25],[82,10],[123,-25],[165,10],[202,-25]],e:[[0,1],[1,2],[2,3],[3,4],[4,5]]},
] as const;
// Distances are authored from the origin; Techniques are optional one-point leaves.
const ACTIVE_ROUTES: Readonly<Record<string, readonly [SkillId,number,number][]>> = {
 bastion:[['brace',1,-1],['shieldBash',3,1],['bulwark',5,-1],['repulse',14,1],['ironCitadel',32,-1]],
 forge:[['cleave',1,-1],['lunge',4,1],['whirlwind',8,-1],['earthshatter',12,1],['rallyOfIron',22,-1]],
 hunt:[['volley',1,-1],['ricochet',7,1],['piercingShot',9,-1],['rainOfArrows',12,1],['ghostHunt',22,-1]],
 veil:[['backstab',1,1],['sidestep',2,-1],['vaultingShot',7,-1],['smokeVeil',13,1],['nightReaping',32,-1]],
 crucible:[['fireball',1,-1],['arcLightning',2,1],['meteor',13,-1],['cataclysm',23,1],['tempest',25,-1]],
 wellspring:[['iceNova',2,1],['runicWard',4,-1],['siphon',7,1],['frostLance',10,-1],['absoluteZero',23,1]],
};
function buildTree() {
 const nodes: MutableNode[] = [], edges: SkillEdge[] = [], clusters: SkillCluster[] = [];
 const byId = new Map<string,MutableNode>();
 const add=(n:Omit<MutableNode,'neighbors'>)=>{ if(byId.has(n.id))throw Error(n.id); const v={...n,bonuses:Object.freeze({...n.bonuses}),neighbors:[] as string[]};nodes.push(v);byId.set(v.id,v);return v; };
 const link=(a:string,b:string)=>{const x=byId.get(a)!,y=byId.get(b)!;if(x.neighbors.includes(b))return;x.neighbors.push(b);y.neighbors.push(a);edges.push(Object.freeze({from:a,to:b}));};
 add({id:'origin',name:'The Root',description:'Six territories grow from this shared beginning. Follow roads, take a Doctrine, unlock an action, or cross into another territory. Techniques are optional; keystones never obstruct a road.',x:0,y:0,domain:'Might',kind:'origin',bonuses:{}});
 // Preserve the inner atlas, then ease into compact, continuously turning outer roads.
 // Work in display-space arc length: polar angle steps stretched the horizontal tips.
 const innerPoint=(t:typeof SKILL_TERRITORIES[number],i:number)=>{
  const a=t.angle+t.bend*Math.sin(i/8),r=100+112*i;
  return{x:Math.cos(a)*r*1.8,y:Math.sin(a)*r*.72};
 };
 const roadFrames=new Map<string,{x:number;y:number;angle:number}[]>();
 for(const t of SKILL_TERRITORIES){
  const frames=[];
  const start=innerPoint(t,14),before=innerPoint(t,13.99),after=innerPoint(t,14.01);
  const heading=Math.atan2(after.y-before.y,after.x-before.x),speed=Math.hypot(after.x-before.x,after.y-before.y)/.02;
  let x=start.x,y=start.y;
  for(let i=0;i<=32;i++){
   if(i<=14){const p=innerPoint(t,i),a=innerPoint(t,i-.01),b=innerPoint(t,i+.01);frames.push({...p,angle:Math.atan2(b.y-a.y,b.x-a.x)});continue;}
   // Substeps integrate a smooth heading and spacing transition, without a corner at the join.
   for(let k=0;k<16;k++){
    const d=i-15+(k+.5)/16,turn=.13*(d-3*(1-Math.exp(-d/3)));
    const step=96+(speed-96)*Math.exp(-d/3);
    x+=Math.cos(heading+turn)*step/16;y+=Math.sin(heading+turn)*step/16;
   }
   const d=i-14;frames.push({x,y,angle:heading+.13*(d-3*(1-Math.exp(-d/3)))});
  }
  roadFrames.set(t.id,frames);
 }
 const frame=(t:typeof SKILL_TERRITORIES[number],i:number)=>roadFrames.get(t.id)![i];
 const point=(t:typeof SKILL_TERRITORIES[number],i:number,side=0,out=0)=>{
  const p=frame(t,i),a=p.angle;
  return{x:p.x+Math.cos(a)*out-Math.sin(a)*side,y:p.y+Math.sin(a)*out+Math.cos(a)*side};
 };
 for(const [ti,t] of SKILL_TERRITORIES.entries()) {
  const last=Math.max(20,...ACTIVE_ROUTES[t.id].map(v=>v[1]));
  for(let i=1;i<=last;i++) {
   const attr=t.domain==='Might'?'strength':t.domain==='Cunning'?'dexterity':'intelligence';
   const bonus:StatModifiers=i%4===0?{maxHp:5}:i%4===2?{maxMana:4}:{[attr]:2};
   add({id:`road:${t.id}:${i}`,name:`${t.name} road ${i}`,description:`A connecting road in ${t.name}. ${t.motto}.`,...point(t,i),domain:t.domain,territory:t.id,kind:'minor',role:'travel',bonuses:bonus});
   link(i===1?'origin':`road:${t.id}:${i-1}`,`road:${t.id}:${i}`);
  }
  for(const [j,f] of TERRITORY_SPECIALTIES[t.id].entries()) {
   const depth=[3,5,7,9,11,14,17,20][j],side=(j%2?1:-1),shape=SHAPES[(j+ti)%SHAPES.length],origin=point(t,depth,side*145);
   const a=frame(t,depth).angle+Math.PI/2*side, id=`${t.id}:${j}`;
   const members=shape.p.map(([u,v],k)=>{
    const reward=k===shape.p.length-1 || (shape===SHAPES[6]&&k===3);
    return add({id:`${id}:${k}`,name:reward?f.name:`${f.name} · ${k+1}`,description:f.description,x:origin.x+Math.cos(a)*u-Math.sin(a)*v,y:origin.y+Math.sin(a)*u+Math.cos(a)*v,domain:t.domain,territory:t.id,kind:reward?'notable':'minor',cluster:id,role:'cluster',bonuses:reward?f.reward:f.small});
   });
   shape.e.forEach(([a,b])=>link(members[a].id,members[b].id));link(`road:${t.id}:${depth}`,members[0].id);
   const cx=members.reduce((s,n)=>s+n.x,0)/members.length,cy=members.reduce((s,n)=>s+n.y,0)/members.length;
   clusters.push({id,name:f.name,domain:t.domain,territory:t.id,x:cx,y:cy,radius:Math.max(...members.map(n=>Math.hypot(n.x-cx,n.y-cy)))+12});
  }
  for(const [skill,depth,side] of ACTIVE_ROUTES[t.id]) {
   const terminal=depth===last;
   const def=SKILL_DEFINITIONS[skill],p=point(t,depth,terminal?0:side*190,terminal?150:35);
   const direction=frame(t,depth).angle+(terminal?0:side*Math.PI/2);
   const id=`skill:${skill}`,cluster=`development:${skill}`;
   add({id,name:def.name,description:def.description,...p,kind:'major',domain:def.domain,territory:t.id,skill,cluster,bonuses:{}});link(`road:${t.id}:${depth}`,id);
   const variants=SKILL_SPECIALIZATIONS.filter(v=>v.skill===skill);
   variants.forEach((v,k)=>{
    const a=direction+(k-(variants.length-1)/2)*.72;
    const n=add({id:specializationNode(v.id),name:v.name,description:v.description,x:p.x+Math.cos(a)*100,y:p.y+Math.sin(a)*100,kind:'notable',domain:def.domain,territory:t.id,specialization:v.id,developmentSkill:skill,cluster,bonuses:{}});link(id,n.id);
   });
   clusters.push({id:cluster,name:def.name,domain:t.domain,territory:t.id,...p,radius:115});
  }
  // Optional late investments break up the long journeys to Bastion and Veil's capstones.
  for(const [j,f] of (OUTER_SPECIALTIES[t.id]??[]).entries()){
   const depth=23+j*3,side=j%2?-1:1,shape=SHAPES[[1,4,0][j]],p=point(t,depth,side*145);
   const a=frame(t,depth).angle+side*Math.PI/2,id=`outer:${t.id}:${j}`;
   const members=shape.p.map(([u,v],k)=>add({id:`${id}:${k}`,name:k===shape.p.length-1?f.name:`${f.name} · ${k+1}`,description:f.description,x:p.x+Math.cos(a)*u-Math.sin(a)*v,y:p.y+Math.sin(a)*u+Math.cos(a)*v,domain:t.domain,territory:t.id,kind:k===shape.p.length-1?'notable':'minor',cluster:id,role:'cluster',bonuses:k===shape.p.length-1?f.reward:f.small}));
   shape.e.forEach(([a,b])=>link(members[a].id,members[b].id));link(`road:${t.id}:${depth}`,members[0].id);
   clusters.push({id,name:f.name,domain:t.domain,territory:t.id,...p,radius:180});
  }
  SKILL_DOCTRINES.filter(d=>d.territory===t.id).forEach((d,j)=>{
   const depth=j?18:11,p=point(t,depth,j?-190:200,60),a=frame(t,depth).angle;
   d.choices.forEach((choice,k)=>{const n=add({id:`doctrine:${d.id}:${k}`,name:choice.name,description:`${d.name}: choose one of three. ${choice.description} Other choices in this family are mutually exclusive.`,x:p.x+Math.cos(a)*(k-1)*58,y:p.y+Math.sin(a)*(k-1)*58,kind:'notable',domain:t.domain,territory:t.id,doctrine:d.id,bonuses:choice.bonuses,role:'choice'});link(`road:${t.id}:${depth}`,n.id);});
  });
 }
 // Hybrid gardens fill the space between roads. Each is an optional investment,
 // Six mid-depth gardens also join their neighboring road, without bypassing active timing.
 for(const [gi,garden] of BORDER_GARDENS.entries()) {
  const t=SKILL_TERRITORIES.find(t=>t.id===garden.from)!;
  const other=SKILL_TERRITORIES.find(t=>t.id===garden.to)!;
  garden.specialties.forEach((f,j)=>{
   const depth=4+j*3,from=point(t,depth),to=point(other,depth),mix=j%2?.62:.38;
   const cx=from.x+(to.x-from.x)*mix,cy=from.y+(to.y-from.y)*mix;
   const shape=SHAPES[(gi*3+j)%SHAPES.length],a=Math.atan2(cy,cx)+Math.PI/2;
   const id=`garden:${garden.from}:${garden.to}:${j}`;
   const members=shape.p.map(([u,v],k)=>add({id:`${id}:${k}`,name:k===shape.p.length-1?f.name:`${f.name} · ${k+1}`,description:f.description,x:cx+Math.cos(a)*(u-80)-Math.sin(a)*v,y:cy+Math.sin(a)*(u-80)+Math.cos(a)*v,domain:t.domain,territory:j%2?other.id:t.id,kind:k===shape.p.length-1?'notable':'minor',cluster:id,role:'cluster',bonuses:k===shape.p.length-1?f.reward:f.small}));
   shape.e.forEach(([a,b])=>link(members[a].id,members[b].id));
   const anchor=j%2?other:t;
   link(`road:${anchor.id}:${depth}`,members[0].id);
   if(j===3)link(members[members.length-1].id,`road:${anchor===t?other.id:t.id}:${depth}`);
   clusters.push({id,name:f.name,domain:t.domain,territory:anchor.id,x:cx,y:cy,radius:140});
  });
 }
 // Six cross-country passes form a mesh; none crosses an active or a tradeoff node.
 for(const [a,b,depth] of [['bastion','wellspring',8],['forge','crucible',10],['hunt','veil',10],['wellspring','hunt',15],['veil','crucible',16],['bastion','forge',16]] as const) {
  const from=byId.get(`road:${a}:${depth}`)!,to=byId.get(`road:${b}:${depth}`)!;let prev=from.id;
  const angleA=Math.atan2(from.y/.72,from.x/1.8),angleB=Math.atan2(to.y/.72,to.x/1.8);
  const delta=Math.atan2(Math.sin(angleB-angleA),Math.cos(angleB-angleA));
  const radius=Math.hypot(from.x/1.8,from.y/.72);
  for(let i=1;i<=4;i++){
   const id=`pass:${a}:${b}:${i}`,angle=angleA+delta*i/5;
   add({id,name:`${a} — ${b} pass`,description:'A cross-country route into another territory.',x:Math.cos(angle)*radius*1.8,y:Math.sin(angle)*radius*.72,domain:from.domain,kind:'minor',role:'travel',bonuses:{maxHp:4,maxMana:3}});link(prev,id);prev=id;
  }link(prev,to.id);
 }
 for(const [id,name,desc,territory,depth] of [
  ['keystone:measured-force','Measured Force','You cannot critically hit. Gain 1% more direct damage for each 1% critical chance, up to 30%. Periodic damage is unaffected.','forge',15],
  ['keystone:open-hand','Open Hand','With one one-handed melee weapon and an empty offhand: 20% more weapon damage and 8% movement speed. With any other loadout: 10% less weapon damage.','veil',16],
  ['keystone:borrowed-flame','Borrowed Flame','Alternating melee and spell actions gain a separate 40% more damage multiplier on Spellweave-empowered actions, beyond its 100% bonus cap. All weapon and spell damage is 15% lower. Works without other Spellweave investment.','crucible',16],
  [OVERLOAD_NODE,'Arcane Overload','Optional toggle: Arcana skills deal 30% more damage but cost 60% more mana, including Tempest upkeep. Utility skills receive no damage benefit.','wellspring',16],
 ] as const) {const t=SKILL_TERRITORIES.find(t=>t.id===territory)!;add({id,name,description:desc,...point(t,depth,-200,55),domain:t.domain,territory,kind:'major',keystone:true,bonuses:{}});link(`road:${territory}:${depth}`,id);}
 // Resolve local engraving collisions by translating whole authored groups. Internal silhouettes never deform.
 const groups=new Map<string,MutableNode[]>();
 for(const n of nodes){const key=n.cluster??(n.doctrine?`doctrine:${n.doctrine}`:n.id);const g=groups.get(key)??[];g.push(n);groups.set(key,g);}
 const fixed=[...groups.values()].filter(g=>g[0].id==='origin'||g[0].role==='travel').flat();
 const roadSegments=edges.filter(e=>e.from.startsWith('road:')&&e.to.startsWith('road:')).map(e=>({a:byId.get(e.from)!,b:byId.get(e.to)!}));
 const segmentDistance=(x:number,y:number,a:Point,b:Point)=>{
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);
 };
 const placed=[...fixed];
 for(const group of groups.values()){
  if(group[0].id==='origin'||group[0].role==='travel')continue;
  let offset:{x:number;y:number}|undefined;
  for(let ring=0;ring<50&&!offset;ring++){
   const candidates=ring?ring*8:1;
   for(let k=0;k<candidates;k++){
    const x=Math.cos(k*Math.PI*2/candidates)*ring*24,y=Math.sin(k*Math.PI*2/candidates)*ring*24;
    const clear=group.every(n=>placed.every(p=>Math.hypot(n.x+x-p.x,n.y+y-p.y)>=(n.kind==='major'&&p.kind==='major'?140:n.kind==='major'||p.kind==='major'?100:n.developmentSkill||p.developmentSkill?76:48)));
    if(clear&&group.every(n=>roadSegments.every(({a,b})=>segmentDistance(n.x+x,n.y+y,a,b)>=(n.kind==='major'?50:34)))){offset={x,y};break;}
   }
  }
  if(!offset)throw Error('No readable atlas position');
  for(const n of group)Object.assign(n,{x:n.x+offset.x,y:n.y+offset.y});placed.push(...group);
 }
 for(const cluster of clusters){const group=groups.get(cluster.id)!;const x=group.reduce((sum,n)=>sum+n.x,0)/group.length,y=group.reduce((sum,n)=>sum+n.y,0)/group.length;Object.assign(cluster,{x,y,radius:Math.max(...group.map(n=>Math.hypot(n.x-x,n.y-y)))+15});}
 // Prefer curves that clear unrelated medallions. The base and light pass share them.
 for(let i=0;i<edges.length;i++) {
  const edge=edges[i],a=byId.get(edge.from)!,b=byId.get(edge.to)!;
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  const road=a.id.startsWith('road:')&&b.id.startsWith('road:')&&a.territory===b.territory;
  if(length<95&&!road)continue;
  let base={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  if(road){
   const frames=roadFrames.get(a.territory!)!,aa=frames[Number(a.id.split(':')[2])].angle,ba=frames[Number(b.id.split(':')[2])].angle;
   const cross=Math.sin(ba-aa);
   if(Math.abs(cross)>1e-5){
    const distance=(dx*Math.sin(ba)-dy*Math.cos(ba))/cross;
    // Tangent intersection gives adjacent road segments the same direction at each star.
    if(distance>0&&distance<length)base={x:a.x+Math.cos(aa)*distance,y:a.y+Math.sin(aa)*distance};
   }
  }
  const pass=a.id.startsWith('pass:')||b.id.startsWith('pass:');
  if(pass){
   const aa=Math.atan2(a.y/.72,a.x/1.8),ba=Math.atan2(b.y/.72,b.x/1.8),delta=Math.atan2(Math.sin(ba-aa),Math.cos(ba-aa));
   const angle=aa+delta/2,radius=(Math.hypot(a.x/1.8,a.y/.72)+Math.hypot(b.x/1.8,b.y/.72))/2/Math.cos(delta/2);
   base={x:Math.cos(angle)*radius*1.8,y:Math.sin(angle)*radius*.72};
  }
  const near=nodes.filter(n=>n!==a&&n!==b&&n.x>=Math.min(a.x,b.x,base.x)-400&&n.x<=Math.max(a.x,b.x,base.x)+400&&n.y>=Math.min(a.y,b.y,base.y)-400&&n.y<=Math.max(a.y,b.y,base.y)+400);
  const control=(bend:number)=>({x:base.x-dy/length*bend,y:base.y+dx/length*bend});
  const score=(bend:number)=>{
   let penalty=Math.abs(bend)*.001;
   const c=control(bend),steps=Math.max(12,Math.ceil((length+Math.abs(bend))/12));
   for(let k=1;k<steps;k++){
    const t=k/steps,u=1-t,x=u*u*a.x+2*u*t*c.x+t*t*b.x,y=u*u*a.y+2*u*t*c.y+t*t*b.y;
    for(const n of near){const clearance=n.kind==='major'?30:n.kind==='notable'?22:16;penalty+=Math.max(0,clearance*clearance-(x-n.x)**2-(y-n.y)**2);}
   }
   return penalty;
  };
  let bend=0,best=score(0);
  if(best>0)for(const candidate of [-60,60,-120,120,-200,200,-320,320,-480,480,-640,640]){
   const value=score(candidate);if(value<best){best=value;bend=candidate;}
   if(best<=Math.abs(candidate)*.001)break;
  }
  if(bend||pass||road)edges[i]=Object.freeze({...edge,control:Object.freeze(control(bend))});
 }
 for(const n of nodes){Object.freeze(n.neighbors);Object.freeze(n);}
 const bounds=Object.freeze({minX:Math.min(...nodes.map(n=>n.x))-180,minY:Math.min(...nodes.map(n=>n.y))-180,maxX:Math.max(...nodes.map(n=>n.x))+180,maxY:Math.max(...nodes.map(n=>n.y))+180});
 return Object.freeze({nodes:Object.freeze(nodes) as readonly SkillNode[],edges:Object.freeze(edges),clusters:Object.freeze(clusters.map(c=>Object.freeze(c))),bounds});
}
export const SKILL_TREE=buildTree();
export const SKILL_NODES:ReadonlyMap<string,SkillNode>=new Map(SKILL_TREE.nodes.map(n=>[n.id,n]));
export function getTreeBonuses(ids:readonly string[]):StatModifiers {const result:StatModifiers={};const families=new Set<string>();for(const id of new Set(ids)){const n=SKILL_NODES.get(id);if(!n || n.doctrine&&families.has(n.doctrine))continue;if(n.doctrine)families.add(n.doctrine);for(const [key,value]of Object.entries(n.bonuses) as [StatKey,number][])result[key]=(result[key]??0)+value;}return result;}
export function unlockedSkills(ids:readonly string[]):SkillId[]{return [...new Set(ids.flatMap(id=>{const s=SKILL_NODES.get(id)?.skill;return s?[s]:[];}))];}
export function doctrineConflict(ids:Iterable<string>,node:SkillNode):boolean{return !!node.doctrine&&[...ids].some(id=>id!==node.id&&SKILL_NODES.get(id)?.doctrine===node.doctrine);}
export function allocateNode(sheet:CharacterSheet,id:string):ActionResult {const n=SKILL_NODES.get(id);if(!n)return{ok:false,message:'Unknown node.'};if(sheet.allocatedNodes.includes(id))return{ok:false,message:'Already allocated.'};if(doctrineConflict(sheet.allocatedNodes,n))return{ok:false,message:'Choose only one Doctrine in each family.'};if(!Number.isSafeInteger(sheet.skillPoints)||sheet.skillPoints<1)return{ok:false,message:'Requires one skill point.'};if(!n.neighbors.some(id=>sheet.allocatedNodes.includes(id)))return{ok:false,message:'Connect this node first.'};sheet.allocatedNodes.push(id);sheet.skillPoints--;if(n.specialization&&n.developmentSkill)sheet.skillSpecializations[n.developmentSkill]=n.specialization;return{ok:true};}

/** An owned Doctrine is one paid choice. Reconfiguring it preserves the point ledger and connectivity. */
export function chooseDoctrine(sheet:CharacterSheet,id:string):ActionResult {
 const node=SKILL_NODES.get(id);if(!node?.doctrine)return{ok:false,message:'Unknown Doctrine.'};
 const current=sheet.allocatedNodes.findIndex(owned=>SKILL_NODES.get(owned)?.doctrine===node.doctrine);
 if(current<0)return{ok:false,message:'Purchase a choice in this Doctrine family first.'};
 if(sheet.allocatedNodes[current]===id)return{ok:false,message:'Already selected.'};
 if(!node.neighbors.some(id=>sheet.allocatedNodes.includes(id)))return{ok:false,message:'Connect this Doctrine first.'};
 sheet.allocatedNodes[current]=id;return{ok:true};
}
