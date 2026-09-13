import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILL_TREE, SKILL_NODES } from '../src/skill-tree.ts';
import { STAT_LABELS } from '../src/items.ts';
import type { StatKey } from '../src/character-types.ts';
import { searchSkillAtlas, groupAtlasSearchMatches } from '../src/skill-tree-search.ts';
import { atlasSearchMarkers } from '../src/skill-tree-search-art.ts';
import { buildAtlasLightPlan } from '../src/skill-tree-light.ts';
import type { SkillAtlasView } from '../src/skill-tree-art.ts';

const ids = (query: string) => new Set(searchSkillAtlas(query).map(match => match.node.id));

test('every actual tree modifier is discoverable by its shared item label and stat key', () => {
  const keys = new Set(SKILL_TREE.nodes.flatMap(node => Object.keys(node.bonuses))) as Set<StatKey>;
  for (const key of keys) for (const query of [key, STAT_LABELS[key]]) {
    const found = ids(query);
    for (const node of SKILL_TREE.nodes.filter(node => node.bonuses[key]))
      assert.ok(found.has(node.id), `${query} missed ${node.id}`);
  }
});

test('pierce searches find the real bonuses and mechanics without inheriting cluster prose', () => {
  const expected = new Set([
    ...SKILL_TREE.nodes.filter(node => node.bonuses.projectilePierce).map(node => node.id),
    'skill:piercingShot', 'skill:frostLance', 'specialization:volley-pierce', 'specialization:ricochet-pierce',
    'specialization:piercing-depth', 'specialization:siphon-pierce',
  ]);
  assert.equal(expected.size, 9);
  for (const query of ['projectile pierce', 'pierce', 'piercing', 'projectilePierce', '  PIERCE  PROJECTILES!! ', 'arrow pierc'])
    assert.deepEqual(ids(query), expected, query);
  assert.match(SKILL_NODES.get('hunt:1:0')!.description, /pass through/i);
  assert.ok(!ids('pierce').has('hunt:1:0'));
  assert.ok(!ids('pierce').has('skill:ghostHunt'));
  assert.ok(!ids('pierce').has('specialization:lance-fan'));
  for (const match of searchSkillAtlas('projectile pierce')) assert.ok(match.reason.length > 0);
});

test('common affix aliases agree, word order is flexible and neighboring stat meanings stay separate', () => {
  for (const [canonical, aliases] of [
    ['Critical damage', ['crit dmg', 'critDamage', 'critical multiplier', 'damage critical', 'spell critical damage']],
    ['Mana / 5 sec', ['mana regen', 'mana regeneration', 'mp5', 'mana per 5 seconds']],
    ['Movement speed', ['move speed', 'run speed', 'walk speed']],
    ['Armor', ['armour']],
  ] as const) for (const alias of aliases) assert.deepEqual(ids(alias), ids(canonical), alias);
  assert.ok(ids('move speed').has('keystone:open-hand'));
  const spell = ids('spell damage');
  for (const node of SKILL_TREE.nodes.filter(n => n.bonuses.critDamage && !n.bonuses.spellDamagePercent)) assert.ok(!spell.has(node.id));
  for (const node of SKILL_TREE.nodes.filter(n => n.bonuses.allResistance)) assert.ok(ids('fire resistance').has(node.id));
  assert.ok([...ids('hunt mana regen')].every(id => SKILL_NODES.get(id)!.territory === 'hunt'));
});

test('skill names include their Techniques; unsupported item-only bonuses and empty queries are honest', () => {
  assert.deepEqual(ids('fireball'), new Set(['skill:fireball', 'specialization:fireball-fork', 'specialization:fireball-ember', 'specialization:fireball-impact']));
  for (const query of ['gold find', 'experience gain', 'added fire damage', 'Fireball ranks', 'no-such-bonus']) assert.equal(ids(query).size, 0, query);
  assert.equal(ids('  ').size, SKILL_TREE.nodes.length);
});

test('overview highlights include every match beyond the result-list limit and allocated nonmatches stay unlit', () => {
  const found = ids('crit damage');
  const view: SkillAtlasView = { width: 1200, height: 900, zoom: .1, centerX: 0, centerY: 0,
    allocated: new Set(SKILL_TREE.nodes.map(node => node.id)), reachable: new Set(), selected: 'origin', hovered: null,
    route: [], filterActive: true, matches: node => found.has(node.id) };
  const markers = atlasSearchMarkers(view);
  assert.ok(found.size > 12);
  assert.deepEqual(new Set(markers.map(marker => marker.id)), found);
  assert.ok(markers.every(marker => marker.radius >= 4.5));
  assert.equal(atlasSearchMarkers({ ...view, centerX: 100000 }).length, 0);
  assert.equal(atlasSearchMarkers({ ...view, filterActive: false }).length, 0);
  const none = { ...view, matches: () => false };
  assert.equal(buildAtlasLightPlan(none).threads.length, 0);
  assert.equal(atlasSearchMarkers(none).length, 0);
});

test('affix aliases collapse all nodes into one concept regardless of value or node role', () => {
  for (const query of ['projectile pierce', 'projectile pierc', 'projective pierce', 'piercing']) {
    const groups = groupAtlasSearchMatches(query, searchSkillAtlas(query));
    assert.equal(groups.length, 1, query);
    assert.equal(groups[0].label, 'Projectile pierce');
    assert.deepEqual(groups[0].nodeIds, ids('pierce'));
  }
  const fire = groupAtlasSearchMatches('fire resistance', searchSkillAtlas('fire resistance'));
  assert.equal(fire.length, 1);
  assert.equal(fire[0].label, 'Fire resistance');
  for (const node of SKILL_TREE.nodes.filter(n => n.bonuses.allResistance)) assert.ok(fire[0].nodeIds.has(node.id));
});

test('broad bonus groups deduplicate shared nodes and retain the original query boundaries', () => {
  const matches = searchSkillAtlas('critical'), groups = groupAtlasSearchMatches('critical', matches);
  assert.deepEqual(new Set(groups.map(group => group.id)), new Set(['critChance', 'critDamage']));
  const all = new Set(groups.flatMap(group => [...group.nodeIds]));
  assert.equal(all.size, matches.length);
  assert.ok(groups.reduce((count, group) => count + group.nodeIds.size, 0) > all.size);
  assert.deepEqual(groups.find(group => group.id === 'critDamage')!.nodeIds, ids('crit damage'));
  const local = groupAtlasSearchMatches('hunt mana regen', searchSkillAtlas('hunt mana regen'));
  assert.equal(local.length, 1);
  assert.ok([...local[0].nodeIds].every(id => SKILL_NODES.get(id)!.territory === 'hunt'));
  const skill = groupAtlasSearchMatches('Fireball', searchSkillAtlas('Fireball'));
  assert.equal(skill.length, 1); assert.equal(skill[0].nodeIds.size, 4);
  assert.deepEqual(groupAtlasSearchMatches('', searchSkillAtlas('')), []);
  assert.deepEqual(groupAtlasSearchMatches('gold find', searchSkillAtlas('gold find')), []);
});
