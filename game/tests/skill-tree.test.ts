import assert from 'node:assert/strict';
import test from 'node:test';
import { SKILL_TREE, SKILL_NODES, SKILL_TREE_ORIGIN, allocateNode, getTreeBonuses, unlockedSkills } from '../src/skill-tree.ts';
import { SKILL_DEFINITIONS, skillIconSVG } from '../src/skill-content.ts';
import type { CharacterSheet, SkillId } from '../src/character-types.ts';

function sheet(points = 10): CharacterSheet {
  return { commerce: { epoch: 0, revision: 0, operations: 0, sold: {}, buyback: [] }, attributes: { strength: 0, dexterity: 0, intelligence: 0, vitality: 0 }, statPoints: 0,
    skillPoints: points, allocatedNodes: [SKILL_TREE_ORIGIN], inventory: [],
    equipped: { weapon: null, offhand: null, head: null, chest: null, gloves: null, legs: null, boots: null, cloak: null, amulet: null, ring1: null, ring2: null },
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

test('thousands of immutable stars belong to a single reachable, undirected atlas', () => {
  assert.ok(SKILL_TREE.nodes.length >= 2000 && SKILL_TREE.nodes.length <= 3000);
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

test('all active skills have approachable connected paths through their weapon schools', () => {
  const paths = pathsFromOrigin(), majors = SKILL_TREE.nodes.filter(node => node.kind === 'major');
  assert.equal(majors.length, Object.keys(SKILL_DEFINITIONS).length);
  assert.deepEqual(new Set(majors.map(node => node.skill)), new Set(Object.keys(SKILL_DEFINITIONS)));
  for (const major of majors) {
    const path = paths.get(major.id)!; assert.equal(path.length, SKILL_DEFINITIONS[major.skill!].tier === 'basic' ? 3 : 4);
    assert.ok(path.some(id => id.startsWith('school:')), 'every skill follows a named weapon school');
    assert.equal(major.domain, SKILL_DEFINITIONS[major.skill!].domain);
    const character = sheet(path.length);
    for (const id of path) assert.equal(allocateNode(character, id).ok, true);
    assert.equal(character.skillPoints, 0);
    assert.deepEqual(unlockedSkills(character.allocatedNodes), path.map(id => SKILL_NODES.get(id)!.skill).filter(Boolean));
    assert.ok(unlockedSkills(character.allocatedNodes).includes(major.skill!));
    assert.ok(Object.keys(getTreeBonuses(character.allocatedNodes)).length > 0, 'path minors improve character stats');
  }
});

test('allocation rejects disconnected, duplicate, invalid and unaffordable nodes without mutating points', () => {
  const character = sheet(2), before = JSON.stringify(character);
  const distant = [...pathsFromOrigin()].find(([, path]) => path.length > 20)![0];
  assert.equal(allocateNode(character, distant).ok, false);
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
  const node = SKILL_NODES.get(SKILL_NODES.get(SKILL_TREE_ORIGIN)!.neighbors[0])!;
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
    assert.ok(skill.cooldown >= 0 && skill.manaCost > 0 && skill.damageMultiplier >= 0);
    assert.equal(skill.damageMultiplier === 0, skill.id === 'bulwark', 'only the dedicated guard has no damage payload');
    assert.ok(skill.description.length > 30);
    const svg = skillIconSVG(id as SkillId); assert.ok(svg.startsWith('<svg')); assert.ok(svg.includes('<path'));
    assert.ok(!svg.includes('https:'));
  }
});


test('constellations have coherent specialties, varied spacing, and bounds enclosing their actual members', () => {
  assert.equal(SKILL_TREE.clusters.length, 150);
  assert.ok(Object.isFrozen(SKILL_TREE.clusters)); assert.ok(Object.isFrozen(SKILL_TREE.bounds));
  const memberCounts = new Set<number>();
  for (const cluster of SKILL_TREE.clusters) {
    const members = SKILL_TREE.nodes.filter(node => node.cluster === cluster.id);
    const minors = members.filter(node => node.kind === 'minor');
    assert.ok(members.length >= 8 && members.length <= 14);
    assert.equal(members.filter(node => node.kind === 'notable').length, 1);
    memberCounts.add(members.length);
    assert.ok(Object.isFrozen(cluster));
    for (const member of members) {
      assert.equal(member.domain, cluster.domain);
      assert.equal(member.role, 'cluster');
      assert.ok(Math.hypot(member.x - cluster.x, member.y - cluster.y) < cluster.radius);
    }
    for (const minor of minors) assert.deepEqual(minor.bonuses, minors[0].bonuses, 'one stat family develops consistently through each specialty');
    const notable = members.find(node => node.kind === 'notable')!;
    for (const key of Object.keys(minors[0].bonuses)) assert.ok((notable.bonuses[key as keyof typeof notable.bonuses] ?? 0) > minors[0].bonuses[key as keyof typeof notable.bonuses]!);
  }
  assert.ok(memberCounts.size >= 5, 'specialties have different lengths and silhouettes');
  for (const domain of ['Might', 'Cunning', 'Arcana']) assert.equal(SKILL_TREE.clusters.filter(cluster => cluster.domain === domain).length, 50);
  for (const node of SKILL_TREE.nodes) {
    assert.ok(node.x > SKILL_TREE.bounds.minX && node.x < SKILL_TREE.bounds.maxX);
    assert.ok(node.y > SKILL_TREE.bounds.minY && node.y < SKILL_TREE.bounds.maxY);
  }
});

test('organic routes leave readable node clearance and provide interconnected hybrid paths', () => {
  for (let i = 0; i < SKILL_TREE.nodes.length; i++) for (let j = 0; j < i; j++) {
    const a = SKILL_TREE.nodes[i], b = SKILL_TREE.nodes[j];
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 22, `crowded nodes ${a.id}, ${b.id}`);
  }
  const cycles = SKILL_TREE.edges.length - SKILL_TREE.nodes.length + 1;
  assert.ok(cycles > 65, 'closed specialties and crosslinks offer alternate routes');
  const crossRegion = SKILL_TREE.edges.filter(edge => SKILL_NODES.get(edge.from)!.domain !== SKILL_NODES.get(edge.to)!.domain);
  assert.ok(crossRegion.length >= 8, 'neighboring regions connect beyond the common origin');
  assert.equal(SKILL_NODES.get(SKILL_TREE_ORIGIN)!.neighbors.length, 3, 'three clear starting arteries');
  let curved = 0;
  for (const edge of SKILL_TREE.edges) {
    assert.ok(edge.control && Object.isFrozen(edge.control));
    assert.ok(Number.isFinite(edge.control.x) && Number.isFinite(edge.control.y));
    const a = SKILL_NODES.get(edge.from)!, b = SKILL_NODES.get(edge.to)!;
    const deviation = Math.abs((b.x - a.x) * (edge.control.y - a.y) - (b.y - a.y) * (edge.control.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y);
    if (deviation > .2) curved++;
  }
  assert.ok(curved > SKILL_TREE.edges.length * .6, 'routes carry actual curved geometry, rather than straight visual placeholders');
});

test('Arcana offers mana, cast speed and efficiency within two points, before any skill purchase', () => {
  const paths = pathsFromOrigin();
  for (const stat of ['maxMana', 'castSpeedPercent', 'manaCostPercent'] as const) {
    const choices = SKILL_TREE.nodes.filter(node => node.domain === 'Arcana' && (node.bonuses[stat] ?? 0) > 0);
    const nearest = choices.sort((a, b) => paths.get(a.id)!.length - paths.get(b.id)!.length)[0];
    assert.ok(nearest && paths.get(nearest.id)!.length <= 2, stat);
    assert.ok(paths.get(nearest.id)!.every(id => !SKILL_NODES.get(id)!.skill));
  }
  const early = SKILL_TREE.nodes.filter(node => node.domain === 'Arcana' && node.role === 'choice' && paths.get(node.id)!.length <= 4);
  assert.ok(early.length >= 12, 'three entrances and nine branching choices');
  for (const cluster of SKILL_TREE.clusters.filter(cluster => cluster.id.startsWith('arcana:terrace:1:'))) {
    const cost = Math.min(...SKILL_TREE.nodes.filter(node => node.cluster === cluster.id).map(node => paths.get(node.id)!.length));
    assert.ok(cost <= 12, `${cluster.name} requires ${cost} points`);
  }
});

test('every discipline can reach its first three specialties without buying an active skill', () => {
  const seen = new Set(['origin']), queue = ['origin'];
  for (let i = 0; i < queue.length; i++) for (const id of SKILL_NODES.get(queue[i])!.neighbors) {
    if (!seen.has(id) && !SKILL_NODES.get(id)!.skill) { seen.add(id); queue.push(id); }
  }
  for (const cluster of SKILL_TREE.clusters.filter(cluster => cluster.id.includes(':terrace:0:'))) {
    assert.ok(SKILL_TREE.nodes.some(node => node.cluster === cluster.id && seen.has(node.id)), cluster.id);
  }
});

test('every terrace connects each pair of disciplines directly across their outer borders', () => {
  const domains = ['Might', 'Cunning', 'Arcana'];
  for (let terrace = 0; terrace < 5; terrace++) for (let region = 0; region < domains.length; region++) {
    const home = domains[region], away = domains[(region + 1) % domains.length];
    const starts = SKILL_TREE.nodes.filter(node => node.domain === home && node.cluster?.includes(`:terrace:${terrace}:`));
    const seen = new Set(starts.map(node => node.id));
    const queue = starts.map(node => ({ node, cost: 0 }));
    let connected = false;
    for (let i = 0; i < queue.length; i++) {
      const { node, cost } = queue[i];
      if (cost >= 3) continue;
      for (const id of node.neighbors) {
        const next = SKILL_NODES.get(id)!;
        if (next.domain === away && next.cluster?.includes(`:terrace:${terrace}:`)) connected = true;
        if (!seen.has(id) && next.role === 'travel') { seen.add(id); queue.push({ node: next, cost: cost + 1 }); }
      }
    }
    assert.ok(connected, `${home} → ${away}, terrace ${terrace}`);
  }
});
