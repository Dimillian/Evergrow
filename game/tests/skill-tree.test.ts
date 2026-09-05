import assert from 'node:assert/strict';
import test from 'node:test';
import { SKILL_TREE, SKILL_NODES, SKILL_TREE_ORIGIN, allocateNode, getTreeBonuses, unlockedSkills } from '../src/skill-tree.ts';
import { SKILL_DEFINITIONS, skillIconSVG } from '../src/skill-content.ts';
import type { CharacterSheet, SkillId } from '../src/character-types.ts';

function sheet(points = 10): CharacterSheet {
  return { attributes: { strength: 0, dexterity: 0, intelligence: 0, vitality: 0 }, statPoints: 0,
    skillPoints: points, allocatedNodes: [SKILL_TREE_ORIGIN], inventory: [],
    equipped: { weapon: null, head: null, chest: null, gloves: null, legs: null, boots: null, cloak: null, amulet: null, ring1: null, ring2: null },
    skillSlots: [null, null, null, null, null] };
}
function pathsFromOrigin(): Map<string, string[]> {
  const paths = new Map<string, string[]>([[SKILL_TREE_ORIGIN, []]]), queue = [SKILL_TREE_ORIGIN];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const next of SKILL_NODES.get(id)!.neighbors) if (!paths.has(next)) {
      paths.set(next, [...paths.get(id)!, next]); queue.push(next);
    }
  }
  return paths;
}

test('all 2,779 stable stars belong to a single reachable, undirected tree graph', () => {
  assert.equal(SKILL_TREE.nodes.length, 2779);
  assert.equal(SKILL_NODES.size, SKILL_TREE.nodes.length);
  assert.equal(pathsFromOrigin().size, SKILL_TREE.nodes.length);
  const positions = new Set<string>();
  for (const node of SKILL_TREE.nodes) {
    assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y));
    const key = `${node.x.toFixed(3)}:${node.y.toFixed(3)}`;
    assert.ok(!positions.has(key), `overlapping star ${node.id}`); positions.add(key);
    assert.equal(new Set(node.neighbors).size, node.neighbors.length);
    assert.ok(Object.isFrozen(node)); assert.ok(Object.isFrozen(node.bonuses)); assert.ok(Object.isFrozen(node.neighbors));
    for (const neighbor of node.neighbors) assert.ok(SKILL_NODES.get(neighbor)?.neighbors.includes(node.id));
  }
  const edges = new Set<string>();
  for (const edge of SKILL_TREE.edges) {
    const key = [edge.from, edge.to].sort().join('~'); assert.ok(!edges.has(key)); edges.add(key);
    assert.ok(SKILL_NODES.get(edge.from)?.neighbors.includes(edge.to));
  }
});

test('all six active skills have approachable three-point paths from the free origin', () => {
  const paths = pathsFromOrigin(), majors = SKILL_TREE.nodes.filter(node => node.kind === 'major');
  assert.equal(majors.length, 6);
  assert.deepEqual(new Set(majors.map(node => node.skill)), new Set(Object.keys(SKILL_DEFINITIONS)));
  for (const major of majors) {
    const path = paths.get(major.id)!; assert.equal(path.length, 3);
    const character = sheet(3);
    for (const id of path) assert.equal(allocateNode(character, id).ok, true);
    assert.equal(character.skillPoints, 0);
    assert.deepEqual(unlockedSkills(character.allocatedNodes), [major.skill]);
    assert.ok(Object.keys(getTreeBonuses(character.allocatedNodes)).length > 0, 'path minors improve character stats');
  }
});

test('allocation rejects disconnected, duplicate, invalid and unaffordable nodes without mutating points', () => {
  const character = sheet(2), before = JSON.stringify(character);
  assert.equal(allocateNode(character, 'star:11:0:heart').ok, false);
  assert.equal(allocateNode(character, SKILL_TREE_ORIGIN).ok, false);
  assert.equal(allocateNode(character, 'missing').ok, false);
  assert.equal(JSON.stringify(character), before);
  const node = SKILL_NODES.get(SKILL_TREE_ORIGIN)!.neighbors[0];
  assert.equal(allocateNode(character, node).ok, true);
  assert.equal(character.skillPoints, 1);
  assert.equal(allocateNode(character, node).ok, false);
  assert.equal(character.skillPoints, 1);
  character.skillPoints = 0;
  const sibling = SKILL_NODES.get(SKILL_TREE_ORIGIN)!.neighbors[1];
  assert.equal(allocateNode(character, sibling).ok, false);
  character.skillPoints = NaN;
  assert.equal(allocateNode(character, sibling).ok, false);
  character.skillPoints = 1.5;
  const fractionalBefore = JSON.stringify(character);
  assert.equal(allocateNode(character, sibling).ok, false);
  assert.equal(JSON.stringify(character), fractionalBefore);
});

test('repeated and unknown allocations cannot stack bonuses or unlock duplicate skills', () => {
  const node = SKILL_NODES.get('star:0:0:0')!;
  assert.deepEqual(getTreeBonuses([node.id, node.id, 'unknown']), node.bonuses);
  const major = SKILL_TREE.nodes.find(node => node.skill === 'cleave')!;
  assert.deepEqual(unlockedSkills([major.id, major.id, 'unknown']), ['cleave']);
  assert.deepEqual(getTreeBonuses([SKILL_TREE_ORIGIN]), {});
});

test('domain minor and notable bonuses have finite supported values and active skills share meaningful definitions', () => {
  for (const node of SKILL_TREE.nodes) {
    if (node.kind === 'minor' || node.kind === 'notable') assert.ok(Object.keys(node.bonuses).length);
    for (const value of Object.values(node.bonuses)) assert.ok(Number.isFinite(value) && value > 0);
  }
  for (const [id, skill] of Object.entries(SKILL_DEFINITIONS)) {
    assert.equal(skill.id, id);
    assert.ok(skill.cooldown > 0 && skill.manaCost > 0 && skill.damageMultiplier > 0);
    assert.ok(skill.description.length > 30);
    const svg = skillIconSVG(id as SkillId); assert.ok(svg.startsWith('<svg')); assert.ok(svg.includes('<path'));
    assert.ok(!svg.includes('https:'));
  }
});
