import assert from 'node:assert/strict';
import test from 'node:test';
import { skillTooltipMarkup } from '../src/skill-tree-tooltip.ts';
import { skillNodeOwner, skillNodeRole } from '../src/skill-node-presentation.ts';
import { SKILL_TREE } from '../src/skill-tree.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { buildSkillRoutes } from '../src/skill-tree-routes.ts';
const view={allocated:new Set(['origin']),reachable:new Set<string>(),routes:buildSkillRoutes(new Set(['origin']))};
test('every development hover identifies its exact owner and whether it unlocks a choice or improves the skill',()=>{
  for(const node of SKILL_TREE.nodes.filter(n=>n.developmentSkill)) {
    const name=SKILL_DEFINITIONS[node.developmentSkill!].name;
    assert.equal(skillNodeOwner(node)?.name,name);
    const html=skillTooltipMarkup(node,view);
    assert.ok(html.includes(name),node.id);
    assert.ok(html.includes(node.specialization?'Unlocks a selectable variant':'Applies to all variants'),node.id);
    assert.equal(skillNodeRole(node),node.specialization?'Specialization':'Skill improvement');
    assert.ok(!html.includes('undefined'));
  }
});
test('unrelated notable passives are never presented as selectable specializations',()=>{
  const node=SKILL_TREE.nodes.find(n=>n.kind==='notable' && !n.specialization && !n.mastery && !n.keystone)!;
  assert.equal(skillNodeRole(node),'Notable passive');
  assert.equal(skillNodeOwner(node),undefined);
});
