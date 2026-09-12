/** Read-only graph/formula audit. Does not construct a Simulation or read character saves.
 * From the repository root: node --experimental-strip-types game/scripts/skill-tree-audit.ts
 */
import { SKILL_TREE } from '../src/skill-tree.ts';
import { buildSkillRoutes, previewSkillRoute } from '../src/skill-tree-routes.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { resolveSkill, SKILL_SPECIALIZATIONS } from '../src/skill-progression.ts';

const nodes = SKILL_TREE.nodes;
const routes = buildSkillRoutes(new Set(['origin']));
const count = <T>(values: readonly T[], key: (value: T) => string) => {
  const totals: Record<string, number> = {};
  for (const value of values) { const k = key(value); totals[k] = (totals[k] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(totals).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
};
const signature = (bonuses: object) => JSON.stringify(Object.entries(bonuses).sort(([a], [b]) => a.localeCompare(b)));
const clusters = SKILL_TREE.clusters.filter(c => !c.id.startsWith('development:'));
const ordinary = nodes.filter(n => n.role === 'cluster');
const statNodes = nodes.filter(n => Object.keys(n.bonuses).length);
const statKeys = [...new Set(statNodes.flatMap(n => Object.keys(n.bonuses)))].sort();
const stats = Object.fromEntries(statKeys.map(stat => [stat, {
  nodes: statNodes.filter(n => stat in n.bonuses).length,
  earliestPointCost: Math.min(...statNodes.filter(n => stat in n.bonuses).map(n => routes.get(n.id)!.cost)),
}]));
const skills = nodes.filter(n => n.skill).map(n => {
  const s = SKILL_DEFINITIONS[n.skill!];
  return { id: s.id, name: s.name, domain: s.domain, tier: s.tier, requirement: s.requirement,
    shortestPointCost: routes.get(n.id)!.cost, earliestLevel: routes.get(n.id)!.cost + 1,
    mana: s.manaCost, cooldown: s.cooldown,
    shortestRoute: previewSkillRoute(routes, n.id),
  };
});
const regular = skills.filter(s => s.tier !== 'ultimate');
const maxDistance = Math.max(...[...routes.values()].map(r => r.cost));
const distanceBands = [[0,4],[5,9],[10,19],[20,29],[30,maxDistance]].map(([min,max]) => {
  const eligible = nodes.filter(n => routes.get(n.id)!.cost >= min && routes.get(n.id)!.cost <= max);
  return { min, max, nodes: eligible.length, skills: eligible.flatMap(n => n.skill ? [n.skill] : []),
    keystones: eligible.filter(n => n.keystone).length,
    doctrines: eligible.filter(n => n.doctrine).length };
});
const statSignatures = count(statNodes, n => signature(n.bonuses));
const familySignatures = count(clusters, c => {
  const members = ordinary.filter(n => n.cluster === c.id);
  return signature(members.find(n => n.kind === 'minor')!.bonuses) + ' / ' + signature(members.find(n => n.kind === 'notable')!.bonuses);
});
const unionOfRegularRoutes = new Set(regular.flatMap(s => s.shortestRoute).filter(id => id !== 'origin'));
const rankFormula = [1, 5, 10, 15, 20].map(rank => {
  const fire = resolveSkill('fireball',{manaCostMultiplier:1,cooldownMultiplier:1},undefined,rank);
  const meteor = resolveSkill('meteor',{manaCostMultiplier:1,cooldownMultiplier:1},undefined,rank);
  const damage = fire.damageMultiplier / SKILL_DEFINITIONS.fireball.damageMultiplier;
  return {rank,damageFactor:damage,fireballMana:fire.mana,damagePerManaRelativeToRank1:damage/(fire.mana/12),
    meteorCooldown:meteor.cooldown,cooldownLimitedDamageRateRelativeToRank1:damage/(meteor.cooldown/7)};
});
const exceptional = nodes.filter(n => n.skill || n.specialization || n.doctrine || n.keystone || false);
console.log(JSON.stringify({
  methodology: 'Runtime graph, BFS from free origin, one point per node. Path costs exclude ranks and optional detours. Formula probes have no gear, leaf, variant or global bonuses. No simulation or saves.',
  nodes:nodes.length,edges:SKILL_TREE.edges.length,connectedNodes:routes.size,cycleRank:SKILL_TREE.edges.length-nodes.length+1,
  groups:SKILL_TREE.clusters.length,ordinaryClusters:clusters.length,ordinaryClusterNodes:ordinary.length,
  ordinaryMinorNodes:ordinary.filter(n=>n.kind==='minor').length,kindCounts:count(nodes,n=>n.kind),roleCounts:count(nodes,n=>n.role??'other'),
  clusterSizeCounts:count(clusters,c=>String(ordinary.filter(n=>n.cluster===c.id).length)),
  familyCounts:count(clusters,c=>c.name),uniqueFamilyNames:new Set(clusters.map(c=>c.name)).size,
  uniqueFamilyBonusPairs:Object.keys(familySignatures).length,familyBonusPairs:familySignatures,
  statBearingNodes:statNodes.length,uniqueStatBonusPackages:Object.keys(statSignatures).length,statBonusPackages:statSignatures,stats,
  specializations:SKILL_SPECIALIZATIONS.length,
  doctrines:nodes.filter(n=>n.doctrine).map(n=>({id:n.id,cost:routes.get(n.id)!.cost})),
  keystones:nodes.filter(n=>n.keystone).map(n=>({id:n.id,cost:routes.get(n.id)!.cost})),
  exceptionalNodes:exceptional.length,maxShortestPointCost:maxDistance,distanceBands,skills,
  connectedUnionOfRegularShortestRoutes:{points:unionOfRegularRoutes.size,skills:regular.length,note:'A feasible union, not a minimum Steiner-tree solution; equipment compatibility still applies.'},
  rankFormula,
  graph:nodes.map(n=>({id:n.id,x:n.x,y:n.y,kind:n.kind,domain:n.domain,role:n.role,skill:n.skill,keystone:n.keystone,doctrine:n.doctrine,distance:routes.get(n.id)!.cost})),
  graphEdges:SKILL_TREE.edges,
},null,2));
