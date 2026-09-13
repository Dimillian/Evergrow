import assert from 'node:assert/strict';
import test from 'node:test';
import { createCharacterSheet } from '../src/items.ts';
import { SKILL_TREE, SKILL_NODES, SKILL_TERRITORIES, SKILL_DOCTRINES, allocateNode, chooseDoctrine, getTreeBonuses } from '../src/skill-tree.ts';
import { buildSkillRoutes, previewSkillRoute, allocateSkillRoute } from '../src/skill-tree-routes.ts';
import { SKILL_DEFINITIONS, skillIconSVG } from '../src/skill-content.ts';
import { SKILL_SPECIALIZATIONS, specializationNode } from '../src/skill-progression.ts';
const routes=buildSkillRoutes(new Set(['origin']));
test('six territories form a bounded immutable connected undirected atlas',()=>{
 assert.equal(SKILL_TERRITORIES.length,6);assert.ok(SKILL_TREE.nodes.length>=750);assert.equal(routes.size,SKILL_NODES.size);
 const positions=new Set<string>(),edges=new Set<string>();
 for(const n of SKILL_TREE.nodes){assert.ok(Object.isFrozen(n)&&Object.isFrozen(n.bonuses)&&Object.isFrozen(n.neighbors));assert.ok(n.x>SKILL_TREE.bounds.minX&&n.x<SKILL_TREE.bounds.maxX&&n.y>SKILL_TREE.bounds.minY&&n.y<SKILL_TREE.bounds.maxY);const key=`${n.x}:${n.y}`;assert.ok(!positions.has(key));positions.add(key);for(const id of n.neighbors)assert.ok(SKILL_NODES.get(id)?.neighbors.includes(n.id));}
 for(const e of SKILL_TREE.edges){const key=[e.from,e.to].sort().join('|');assert.ok(!edges.has(key));edges.add(key);}
 assert.equal(SKILL_NODES.get('origin')!.neighbors.length,6);
 assert.ok(SKILL_TREE.edges.length-SKILL_TREE.nodes.length+1>=25);
});
test('active unlocks are paced across the journey and never require another skill or tradeoff',()=>{
 const skills=SKILL_TREE.nodes.filter(n=>n.skill);assert.equal(skills.length,30);
 for(const n of skills){const cost=routes.get(n.id)!.cost,path=previewSkillRoute(routes,n.id);assert.ok(path.slice(0,-1).every(id=>!SKILL_NODES.get(id)!.skill&&!SKILL_NODES.get(id)!.keystone&&!SKILL_NODES.get(id)!.doctrine));
  if(SKILL_DEFINITIONS[n.skill!].tier==='ultimate')assert.ok(cost>=22&&cost<=33);assert.ok(skillIconSVG(n.skill!).includes('<path'));
 }
 for(const territory of SKILL_TERRITORIES){const group=skills.filter(n=>n.territory===territory.id);assert.equal(group.length,5);assert.ok(group.some(n=>SKILL_DEFINITIONS[n.skill!].tier==='ultimate'));}
 assert.equal(routes.get('skill:brace')!.cost,2);assert.equal(routes.get('skill:sidestep')!.cost,3);assert.equal(routes.get('skill:runicWard')!.cost,5);assert.equal(routes.get('skill:meteor')!.cost,14);
});
test('passive specialties have distinct identities, connected groups and honest geometry bounds',()=>{
 const clusters=SKILL_TREE.clusters.filter(c=>!c.id.startsWith('development:'));assert.ok(clusters.length>=90);assert.equal(new Set(clusters.map(c=>c.name)).size,clusters.length);
 for(const c of clusters){const members=SKILL_TREE.nodes.filter(n=>n.cluster===c.id),reached=new Set([members[0].id]),queue=[members[0]];for(let i=0;i<queue.length;i++)for(const id of queue[i].neighbors){const next=SKILL_NODES.get(id)!;if(next.cluster===c.id&&!reached.has(id)){reached.add(id);queue.push(next);}}assert.equal(reached.size,members.length,c.id);for(const n of members)assert.ok(Math.hypot(n.x-c.x,n.y-c.y)<c.radius);}
 for(let i=0;i<SKILL_TREE.nodes.length;i++)for(let j=0;j<i;j++){const a=SKILL_TREE.nodes[i],b=SKILL_TREE.nodes[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=40,`${a.id} crowds ${b.id}`);}
});
test('Techniques are direct optional leaves and cannot become route tolls',()=>{
 for(const v of SKILL_SPECIALIZATIONS)assert.deepEqual(SKILL_NODES.get(specializationNode(v.id))!.neighbors,[`skill:${v.skill}`]);
 for(const n of SKILL_TREE.nodes.filter(n=>n.keystone||n.doctrine))assert.equal(n.neighbors.length,1);
});
test('Doctrine families enforce exclusivity for previews, route purchases and single-node allocation',()=>{
 assert.equal(SKILL_DOCTRINES.length,8);
 for(const d of SKILL_DOCTRINES){const s=createCharacterSheet();s.skillPoints=100;const first=`doctrine:${d.id}:0`,other=`doctrine:${d.id}:1`;assert.ok(allocateSkillRoute(s,first).ok);const before=structuredClone(s);assert.equal(allocateSkillRoute(s,other).ok,false);assert.equal(allocateNode(s,other).ok,false);assert.deepEqual(s,before);assert.equal(buildSkillRoutes(new Set(s.allocatedNodes)).has(other),false);assert.deepEqual(getTreeBonuses([first,first,other]),SKILL_NODES.get(first)!.bonuses);assert.ok(chooseDoctrine(s,other).ok);assert.equal(s.skillPoints,before.skillPoints);assert.ok(!s.allocatedNodes.includes(first));assert.ok(s.allocatedNodes.includes(other));}
});
test('invalid, disconnected and unaffordable allocations do not mutate state',()=>{
 const s=createCharacterSheet();s.skillPoints=1;const before=structuredClone(s);for(const id of ['missing','origin','skill:tempest'])assert.equal(allocateNode(s,id).ok,false);assert.equal(allocateSkillRoute(s,'skill:tempest').ok,false);assert.deepEqual(s,before);
 assert.deepEqual(getTreeBonuses(['unknown','origin']),{});
});
