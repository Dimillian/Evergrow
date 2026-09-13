import { SKILL_SPECIALIZATIONS, specializationNode, OVERLOAD_NODE } from './skill-progression.ts';
import type { ActionResult, CharacterSheet, SkillId, StatKey, StatModifiers } from './character-types.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { SKILL_TERRITORIES, TERRITORY_SPECIALTIES, SKILL_DOCTRINES, BORDER_GARDENS, OUTER_SPECIALTIES } from './skill-tree-content.ts';
import { PASSIVE_CLUSTER_SHAPES, passiveClusterShape, type PassiveClusterShape } from './skill-tree-shapes.ts';
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
export interface SkillCluster { readonly id: string; readonly name: string; readonly domain: SkillDomain; readonly territory?: string; readonly shape?: PassiveClusterShape; readonly x: number; readonly y: number; readonly radius: number; }
export const SKILL_TREE_ORIGIN = 'origin';
export const SKILL_TREE_VERSION = 3;
type MutableNode = Omit<SkillNode, 'neighbors'> & { neighbors: string[] };
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
 const potential = new Map<string,number>();
 const add=(n:Omit<MutableNode,'neighbors'>,depth:number)=>{if(byId.has(n.id))throw Error(n.id);const v={...n,bonuses:Object.freeze({...n.bonuses}),neighbors:[] as string[]};nodes.push(v);byId.set(v.id,v);potential.set(v.id,depth);return v;};
 const link=(a:string,b:string)=>{const x=byId.get(a)!,y=byId.get(b)!;if(x.neighbors.includes(b))return;x.neighbors.push(b);y.neighbors.push(a);edges.push({from:a,to:b});};
 const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
 const lens=(n:MutableNode)=>n.kind==='major'?40:n.kind==='notable'?24:n.role==='travel'?12:18;
 const segmentDistance=(p:Point,a:Point,b:Point)=>{const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
 const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 const intersects=(a:Point,b:Point,c:Point,d:Point)=>cross(a,b,c)*cross(a,b,d)<-1e-5&&cross(c,d,a)*cross(c,d,b)<-1e-5;
 const clearLine=(a:MutableNode,b:MutableNode)=>nodes.every(n=>n===a||n===b||segmentDistance(n,a,b)>lens(n)+9)
   &&edges.every(e=>e.from===a.id||e.to===a.id||e.from===b.id||e.to===b.id||!intersects(a,b,byId.get(e.from)!,byId.get(e.to)!));
 const roadPoint=(t:typeof SKILL_TERRITORIES[number],depth:number)=>({x:Math.cos(t.angle)*(240+(depth-1)*80),y:Math.sin(t.angle)*(240+(depth-1)*80)});
 const routeBonus=(t:typeof SKILL_TERRITORIES[number],i:number):StatModifiers=>{
   const damage=t.domain==='Arcana'?'spellDamagePercent':'damagePercent';
   const speed=t.domain==='Arcana'?'castSpeedPercent':'attackSpeedPercent';
   return [{[damage]:5},{maxHp:12,maxMana:6},{[speed]:2},{critChance:.75,critDamage:4},{moveSpeedPercent:1.5},{[damage]:4,manaRegen:.5}][i%6];
 };
 interface Hub extends Point {id:string; members:MutableNode[]; territory:typeof SKILL_TERRITORIES[number]; external:number; road:boolean;}
 const hubs:Hub[]=[];
 add({id:'origin',name:'The Root',description:'Six active-skill branches meet an open network of passive neighborhoods. Follow a branch, cut across a nearby cluster, or develop your current skills.',x:0,y:0,domain:'Might',kind:'origin',bonuses:{}},0);
 // The six readable trunks retain their exact active-skill purchase distances.
 for(const t of SKILL_TERRITORIES)for(let i=1;i<=32;i++){
   const n=add({id:`road:${t.id}:${i}`,name:`${t.name} route ${i}`,description:`A useful step through ${t.name}. Nearby neighborhoods offer alternate routes.`,...roadPoint(t,i),domain:t.domain,territory:t.id,kind:'minor',role:'travel',bonuses:routeBonus(t,i-1)},i);
   link(i===1?'origin':`road:${t.id}:${i-1}`,n.id);hubs.push({...n,members:[n],territory:t,external:0,road:true});
 }
 // Reserve compact skill/Doctrine pockets before placing passive neighborhoods.
 function pocket(parent:MutableNode,t:typeof SKILL_TERRITORIES[number],side:number,make:(p:Point,angle:number)=>Array<Omit<MutableNode,'neighbors'>>,depth:number,cluster?:string){
   let found:Array<Omit<MutableNode,'neighbors'>>|undefined;
   const aim=t.angle+side*Math.PI/2;
   for(const reach of [135,165,195,225,255,285]){
     for(const offset of [0,.25,-.25,.5,-.5,.8,-.8,1.1,-1.1,1.5,-1.5,2,-2,Math.PI]){
       const a=aim+offset,p={x:parent.x+Math.cos(a)*reach,y:parent.y+Math.sin(a)*reach},candidate=make(p,a);
       if(!candidate.every(n=>nodes.every(other=>distance(n,other)>=(n.kind==='major'&&other.kind==='major'?140:(n.kind==='major'?40:24)+lens(other)+24))))continue;
       if(!candidate.every(n=>edges.every(e=>segmentDistance(n,byId.get(e.from)!,byId.get(e.to)!)>(n.kind==='major'?55:35))))continue;
       // The trunk attachment and internal fan must also clear every existing lens/line.
       const pairs=cluster?candidate.slice(1).map(n=>[candidate[0],n]):candidate.map(n=>[parent,n]);
       if(cluster)pairs.push([parent,candidate[0]]);
       if(!pairs.every(([a,b])=>nodes.every(n=>n.id===a.id||n.id===b.id||segmentDistance(n,a,b)>lens(n)+9)&&edges.every(e=>e.from===a.id||e.to===a.id||e.from===b.id||e.to===b.id||!intersects(a,b,byId.get(e.from)!,byId.get(e.to)!))))continue;
       found=candidate;break;
     }if(found)break;
   }
   if(!found)throw Error(`No compact pocket for ${parent.id}`);
   const members=found.map((n,i)=>add(n,depth+(cluster&&i?1:0)));
   if(cluster){link(parent.id,members[0].id);for(const n of members.slice(1))link(members[0].id,n.id);
     const x=members.reduce((s,n)=>s+n.x,0)/members.length,y=members.reduce((s,n)=>s+n.y,0)/members.length;
     clusters.push({id:cluster,name:members[0].name,domain:t.domain,territory:t.id,x,y,radius:Math.max(...members.map(n=>Math.hypot(n.x-x,n.y-y)))+20});
   }else for(const n of members)link(parent.id,n.id);
 }
 for(const {t,skill,depth,side} of SKILL_TERRITORIES.flatMap(t=>ACTIVE_ROUTES[t.id].map(([skill,depth,side])=>({t,skill,depth,side}))).sort((a,b)=>a.depth-b.depth)){
   const def=SKILL_DEFINITIONS[skill],cluster=`development:${skill}`,variants=SKILL_SPECIALIZATIONS.filter(v=>v.skill===skill);
   pocket(byId.get(`road:${t.id}:${depth}`)!,t,side,(p,a)=>[
     {id:`skill:${skill}`,name:def.name,description:def.description,...p,kind:'major',domain:def.domain,territory:t.id,skill,cluster,bonuses:{}},
     ...variants.map((v,k)=>({id:specializationNode(v.id),name:v.name,description:v.description,x:p.x+Math.cos(a+(k-1)*.72)*100,y:p.y+Math.sin(a+(k-1)*.72)*100,kind:'notable' as const,domain:def.domain,territory:t.id,specialization:v.id,developmentSkill:skill,cluster,bonuses:{}}))
   ],depth+1,cluster);
 }
 for(const t of SKILL_TERRITORIES)SKILL_DOCTRINES.filter(d=>d.territory===t.id).forEach((d,j)=>{
   const depth=j?18:11;
   pocket(byId.get(`road:${t.id}:${depth}`)!,t,j?-1:1,(p,a)=>d.choices.map((choice,k)=>({id:`doctrine:${d.id}:${k}`,name:choice.name,description:`${d.name}: choose one of three. ${choice.description} Other choices in this family are mutually exclusive.`,x:p.x+Math.cos(a+Math.PI/2)*(k-1)*70,y:p.y+Math.sin(a+Math.PI/2)*(k-1)*70,kind:'notable' as const,domain:t.domain,territory:t.id,doctrine:d.id,bonuses:choice.bonuses,role:'choice' as const})),depth+1);
 });
 for(const [id,name,description,territory,depth] of [
   ['keystone:measured-force','Measured Force','You cannot critically hit. Gain 1% more direct damage for each 1% critical chance, up to 30%. Periodic damage is unaffected.','forge',15],
   ['keystone:open-hand','Open Hand','With one one-handed melee weapon and an empty offhand: 20% more weapon damage and 8% movement speed. With any other loadout: 10% less weapon damage.','veil',16],
   ['keystone:borrowed-flame','Borrowed Flame','Alternating melee and spell actions gain a separate 40% more damage multiplier on Spellweave-empowered actions, beyond its 100% bonus cap. All weapon and spell damage is 15% lower. Works without other Spellweave investment.','crucible',16],
   [OVERLOAD_NODE,'Arcane Overload','Optional toggle: Arcana skills deal 30% more damage but cost 60% more mana, including Tempest upkeep. Utility skills receive no damage benefit.','wellspring',16],
 ] as const){const t=SKILL_TERRITORIES.find(t=>t.id===territory)!;pocket(byId.get(`road:${territory}:${depth}`)!,t,-1,p=>[{id,name,description,...p,kind:'major',domain:t.domain,territory,keystone:true,bonuses:{}}],depth+1);}
 // A lightly offset triangular packing fills the whole atlas without stretched petals.
 // Compact shape families share consistent spacing and retain room for captions.
 const slots:Point[]=[];
 for(let row=-9;row<=9;row++)for(let col=-9;col<=9;col++){
   const x=(col+(row%2)*.5)*350+Math.sin(row*7+col*3)*16,y=row*303+Math.cos(row*3-col*5)*16,r=Math.hypot(x,y);
   if(r<480||r>2700)continue;
   const p={x,y};
   if(nodes.some(n=>distance(p,n)<(n.kind==='major'?220:n.developmentSkill?178:155)))continue;
   if(edges.some(e=>segmentDistance(p,byId.get(e.from)!,byId.get(e.to)!)<132))continue;
   slots.push(p);
 }
 type Subject=typeof TERRITORY_SPECIALTIES[string][number];
 const takeSlot=(target:Point)=>{let best=-1,score=Infinity;slots.forEach((p,i)=>{const d=distance(p,target);if(d<score){score=d;best=i;}});if(best<0)throw Error('Passive neighborhood packing exhausted');return slots.splice(best,1)[0];};
 function neighborhood(id:string,f:Subject,t:typeof SKILL_TERRITORIES[number],p:Point,name=f.name){
   const shape=passiveClusterShape(f.small,f.reward),recipe=PASSIVE_CLUSTER_SHAPES[shape],rotation=Math.atan2(p.y,p.x)+Math.PI/2;
   const count=recipe.points.length,cos=Math.cos(rotation),sin=Math.sin(rotation);
   const depth=Math.max(2,Math.round((Math.hypot(p.x,p.y)-240)/80)+2);
   const members=recipe.points.map(([x,y],k)=>{
     return add({id:`${id}:${k}`,name:k===count-1?name:`${name} · ${k+1}`,description:f.description,x:p.x+x*cos-y*sin,y:p.y+x*sin+y*cos,domain:t.domain,territory:t.id,kind:k===count-1?'notable':'minor',cluster:id,role:'cluster',bonuses:k===count-1?f.reward:f.small},depth);
   });
   for(const [a,b] of recipe.edges)link(members[a].id,members[b].id);
   clusters.push({id,name,domain:t.domain,territory:t.id,shape,...p,radius:Math.max(...recipe.points.map(([x,y])=>Math.hypot(x,y)))+20});
   hubs.push({id,members,territory:t,...p,external:0,road:false});
 }
 // Keep familiar specialties beside their home trunks before filling shared neighborhoods.
 for(const t of SKILL_TERRITORIES)for(const [j,f] of TERRITORY_SPECIALTIES[t.id].entries()){
   const depth=[3,5,7,9,11,14,17,20][j],anchor=roadPoint(t,depth),side=j%2?1:-1;
   const p=takeSlot({x:anchor.x-Math.sin(t.angle)*side*260,y:anchor.y+Math.cos(t.angle)*side*260});
   neighborhood(`${t.id}:${j}`,f,t,p);
 }
 for(const t of SKILL_TERRITORIES)for(const [j,f] of (OUTER_SPECIALTIES[t.id]??[]).entries())neighborhood(`outer:${t.id}:${j}`,f,t,takeSlot(roadPoint(t,23+j*3)));
 for(const garden of BORDER_GARDENS){
   const t=SKILL_TERRITORIES.find(t=>t.id===garden.from)!,other=SKILL_TERRITORIES.find(t=>t.id===garden.to)!;
   for(const [j,f] of garden.specialties.entries()){
     const a=roadPoint(t,5+j*4),b=roadPoint(other,5+j*4);
     neighborhood(`garden:${garden.from}:${garden.to}:${j}`,f,j%2?other:t,takeSlot({x:(a.x+b.x)/2,y:(a.y+b.y)/2}));
   }
 }
 // Repeated opportunities are intentional: common build needs remain accessible in every region.
 const addedSubjects:Subject[]=[
   {name:'Spellcraft',small:{spellDamagePercent:7},reward:{spellDamagePercent:20,castSpeedPercent:4},description:'Spell damage and casting tempo for any magic weapon.'},
   {name:'Critical Focus',small:{critChance:.8,critDamage:6},reward:{critChance:3,critDamage:18},description:'Critical chance and damage improve both attacks and spell hits.'},
   {name:'Fleet Passage',small:{moveSpeedPercent:2},reward:{moveSpeedPercent:6,cooldownPercent:3},description:'Move faster and recover movement skills sooner.'},
   {name:'Battlecraft',small:{damagePercent:7},reward:{damagePercent:20,attackSpeedPercent:4},description:'Weapon damage and attack tempo across your equipped attacks.'},
   {name:'Living Reserve',small:{maxHp:12},reward:{maxHp:35,allResistance:4},description:'A larger life reserve with broad elemental protection.'},
   {name:'Flowing Power',small:{manaRegen:.8,spellDamagePercent:3},reward:{manaRegen:3,manaCostPercent:4},description:'Sustain casting while developing spell damage.'},
 ];
 const occurrences=new Map<string,number>();
 for(const p of [...slots].sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y)||a.x-b.x)){
   const t=[...SKILL_TERRITORIES].sort((a,b)=>Math.abs(Math.atan2(Math.sin(Math.atan2(p.y,p.x)-a.angle),Math.cos(Math.atan2(p.y,p.x)-a.angle)))-Math.abs(Math.atan2(Math.sin(Math.atan2(p.y,p.x)-b.angle),Math.cos(Math.atan2(p.y,p.x)-b.angle))))[0];
   const index=(occurrences.get(t.id)??0);occurrences.set(t.id,index+1);const f=addedSubjects[(index+SKILL_TERRITORIES.indexOf(t))%addedSubjects.length];
   const names=['Inner','Crossing','Outer','Far'];
   neighborhood(`neighborhood:${t.id}:${index}`,f,t,p,`${t.name} ${names[Math.floor(index/6)%names.length]} ${f.name}`);
 }
 // Build a planar neighborhood network. Connections stop at actual junctions; they
 // never sail across a road or another group. Longer local gaps get useful nodes.
 const parent=hubs.map((_,i)=>i),find=(i:number):number=>parent[i]===i?i:parent[i]=find(parent[i]);
 const firstRoad=hubs.findIndex(h=>h.road);hubs.forEach((h,i)=>{if(h.road)parent[i]=firstRoad;});
 const candidates:Array<{a:number;b:number;distance:number}>=[];
 for(let i=0;i<hubs.length;i++)for(let j=0;j<i;j++){
   if(hubs[i].road&&hubs[j].road)continue;
   const d=distance(hubs[i],hubs[j]);if(d<680)candidates.push({a:i,b:j,distance:d});
 }
 candidates.sort((a,b)=>a.distance-b.distance||a.a-b.a||a.b-b.b);
 const linked=new Set<string>();
 const roadAttachments=new Map<Hub,Set<string>>();
 function connect(ai:number,bi:number,repair=false){
   const a=hubs[ai],b=hubs[bi],key=`${ai}:${bi}`;
   if(linked.has(key))return false;
   const cluster=a.road?b:a,road=a.road?a:b;
   if(road.road&&!repair&&roadAttachments.get(cluster)?.has(road.territory.id))return false;
   const pairs=a.members.flatMap(x=>b.members.map(y=>({x,y,d:distance(x,y)}))).sort((a,b)=>a.d-b.d);
   for(const {x,y,d} of pairs){
     if(x.neighbors.length>=4||y.neighbors.length>=4||!a.road&&x.neighbors.some(id=>byId.get(id)!.cluster!==x.cluster)||!b.road&&y.neighbors.some(id=>byId.get(id)!.cluster!==y.cluster)||!clearLine(x,y))continue;
     const steps=Math.max(1,Math.ceil(d/155),Math.abs(potential.get(x.id)!-potential.get(y.id)!));
     if(d/steps<46||steps>7)continue;
     const mids=Array.from({length:steps-1},(_,i)=>({x:x.x+(y.x-x.x)*(i+1)/steps,y:x.y+(y.y-x.y)*(i+1)/steps}));
     if(mids.some(p=>nodes.some(n=>distance(p,n)<Math.max(42,lens(n)+29))))continue;
     let prev=x.id;
     for(const [i,p] of mids.entries()){
       const id=`junction:${a.id}:${b.id}:${i}`,t=i<steps/2?a.territory:b.territory;
       add({id,name:`${t.name} crossing`,description:'A short connection between neighboring passive routes.',...p,kind:'minor',role:'travel',domain:t.domain,territory:t.id,bonuses:routeBonus(t,i+ai+bi)},Math.round(potential.get(x.id)!+(potential.get(y.id)!-potential.get(x.id)!)*(i+1)/steps));link(prev,id);prev=id;
     }
     link(prev,y.id);if(road.road){const set=roadAttachments.get(cluster)??new Set<string>();set.add(road.territory.id);roadAttachments.set(cluster,set);}
     a.external++;b.external++;parent[find(ai)]=find(bi);linked.add(key);return true;
   }return false;
 }
 for(const c of candidates)if(find(c.a)!==find(c.b))connect(c.a,c.b);
 for(const c of candidates){const a=hubs[c.a],b=hubs[c.b];if(a.external>=(a.road?2:4)||b.external>=(b.road?2:4))continue;connect(c.a,c.b);}
 for(const c of candidates){const a=hubs[c.a],b=hubs[c.b];if((!a.road&&a.external<2||!b.road&&b.external<2)&&a.external<5&&b.external<5)connect(c.a,c.b,true);}
 const isolated=hubs.filter((_,i)=>find(i)!==find(firstRoad));if(isolated.length)throw Error(`Disconnected neighborhoods: ${isolated.map(h=>h.id).join(', ')}`);
 // Trim road tails beyond the last active skill when they lead to no neighborhood.
 for(const t of SKILL_TERRITORIES){const last=Math.max(...ACTIVE_ROUTES[t.id].map(v=>v[1]));
   for(let i=32;i>last;i--){const n=byId.get(`road:${t.id}:${i}`);if(!n||n.neighbors.length!==1)break;
     const neighbor=byId.get(n.neighbors[0])!;neighbor.neighbors.splice(neighbor.neighbors.indexOf(n.id),1);
     edges.splice(edges.findIndex(e=>e.from===n.id||e.to===n.id),1);nodes.splice(nodes.indexOf(n),1);byId.delete(n.id);
   }
 }
 // Keep every displayed connection straight and local; authored silhouettes supply the rhythm.
 for(const n of nodes){Object.freeze(n.neighbors);Object.freeze(n);}for(const e of edges)Object.freeze(e);
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
