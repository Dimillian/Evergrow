import test from 'node:test';
import assert from 'node:assert/strict';
import { atlasLightStrength, buildAtlasLightPlan } from '../src/skill-tree-light.ts';
import { SKILL_TREE } from '../src/skill-tree.ts';
import { buildSkillRoutes, previewSkillRoute } from '../src/skill-tree-routes.ts';
import type { SkillAtlasView } from '../src/skill-tree-art.ts';

const view = (overrides: Partial<SkillAtlasView> = {}): SkillAtlasView => ({
  width: 1000, height: 800, centerX: 0, centerY: 0, zoom: .2,
  allocated: new Set(['origin']), reachable: new Set(), selected: 'origin', hovered: null,
  route: [], matches: () => true, ...overrides,
});

test('light crests travel continuously, wrap smoothly and stay bounded', () => {
  for (let time = 0; time < 10; time += .05) {
    assert.equal(atlasLightStrength(time * 42, time), 1);
    const value = atlasLightStrength(90, time);
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  }
  assert.ok(Math.abs(atlasLightStrength(150 - .001, 0) - atlasLightStrength(150 + .001, 0)) < .0001);
  assert.equal(atlasLightStrength(32, 0), atlasLightStrength(182, 0));
});

test('only owned or previewed connections receive light; offscreen and excess work are bounded', () => {
  assert.equal(buildAtlasLightPlan(view()).threads.length, 0);
  const route = previewSkillRoute(buildSkillRoutes(new Set(['origin'])), 'skill:fireball');
  const preview = buildAtlasLightPlan(view({ route }));
  assert.equal(preview.threads.length, route.length - 1);
  assert.ok(preview.threads.every(thread => !thread.owned));
  const owned = buildAtlasLightPlan(view({ allocated: new Set(route) }));
  assert.equal(owned.threads.length, route.length - 1);
  assert.ok(owned.threads.every(thread => thread.owned && thread.lengths.length === 25));
  assert.equal(buildAtlasLightPlan(view({ route, centerX: 100000 })).threads.length, 0);
  const all = buildAtlasLightPlan(view({ allocated: new Set(SKILL_TREE.nodes.map(node => node.id)), zoom: .05 }));
  assert.ok(all.threads.length > 0 && all.threads.length <= 160);
});

test('a preview stays lit even when owned paths exhaust the visible animation budget', () => {
  const target = SKILL_TREE.nodes[SKILL_TREE.nodes.length - 1];
  const allocated = new Set(SKILL_TREE.nodes.filter(node => node.id !== target.id).map(node => node.id));
  const route = previewSkillRoute(buildSkillRoutes(allocated), target.id);
  const plan = buildAtlasLightPlan(view({ allocated, route, zoom: .05 }));
  assert.equal(plan.threads.length, 160);
  assert.ok(plan.threads.some(thread => !thread.owned));
});
