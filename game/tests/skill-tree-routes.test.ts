import assert from 'node:assert/strict';
import test from 'node:test';
import { SKILL_TREE, SKILL_NODES, SKILL_TREE_ORIGIN } from '../src/skill-tree.ts';
import { buildSkillRoutes, previewSkillRoute, type SkillRouteStep } from '../src/skill-tree-routes.ts';

test('route costs certify the shortest additional investment from every owned anchor', () => {
  const major = SKILL_TREE.nodes.find(node => node.kind === 'major')!;
  const fromOrigin = buildSkillRoutes(new Set([SKILL_TREE_ORIGIN]));
  const owned = new Set(previewSkillRoute(fromOrigin, major.id));
  const routes = buildSkillRoutes(owned);

  assert.equal(routes.size, SKILL_TREE.nodes.length);
  for (const node of SKILL_TREE.nodes) {
    const step = routes.get(node.id)!;
    const path = previewSkillRoute(routes, node.id);
    assert.equal(path.at(-1), node.id);
    assert.ok(owned.has(path[0]));
    assert.equal(path.length, step.cost + 1);
    if (owned.has(node.id)) {
      assert.deepEqual(step, { cost: 0, previous: null });
      assert.deepEqual(path, [node.id]);
    } else {
      assert.ok(step.cost > 0);
      assert.ok(node.neighbors.includes(step.previous!));
      assert.equal(routes.get(step.previous!)!.cost + 1, step.cost);
      assert.ok(path.slice(1).every(id => !owned.has(id)));
    }
  }
  // Along every graph edge the cost changes by at most one. Combined with the
  // reconstructed path above, this rules out a cheaper unreported route.
  for (const edge of SKILL_TREE.edges) {
    assert.ok(Math.abs(routes.get(edge.from)!.cost - routes.get(edge.to)!.cost) <= 1);
  }
});

test('an owned branch shortens its next allocation to one point without spending anything', () => {
  const major = SKILL_TREE.nodes.find(node => node.kind === 'major')!;
  const fromOrigin = buildSkillRoutes(new Set([SKILL_TREE_ORIGIN]));
  const owned = new Set(previewSkillRoute(fromOrigin, major.id));
  const before = [...owned];
  const next = SKILL_NODES.get(major.id)!.neighbors.find(id => !owned.has(id))!;
  assert.ok(next);

  const routes = buildSkillRoutes(owned), path = previewSkillRoute(routes, next);
  assert.equal(routes.get(next)!.cost, 1);
  assert.equal(path.length, 2);
  assert.ok(owned.has(path[0]));
  assert.equal(path[1], next);
  assert.deepEqual([...owned], before);
});

test('equivalent allocations produce identical routes regardless of insertion order', () => {
  const fromOrigin = buildSkillRoutes(new Set([SKILL_TREE_ORIGIN]));
  const major = SKILL_TREE.nodes.find(node => node.kind === 'major')!;
  const path = previewSkillRoute(fromOrigin, major.id);
  const first = buildSkillRoutes(new Set(path));
  const reversed = buildSkillRoutes(new Set([...path].reverse()));
  assert.deepEqual([...first], [...reversed]);
});

test('empty or unknown allocations do not invent a route or an owned origin', () => {
  assert.equal(buildSkillRoutes(new Set()).size, 0);
  assert.equal(buildSkillRoutes(new Set(['unknown-node'])).size, 0);
  assert.deepEqual(previewSkillRoute(new Map(), SKILL_TREE_ORIGIN), []);
  const normal = buildSkillRoutes(new Set([SKILL_TREE_ORIGIN]));
  const mixed = buildSkillRoutes(new Set(['unknown-node', SKILL_TREE_ORIGIN]));
  assert.deepEqual([...mixed], [...normal]);
  assert.deepEqual(previewSkillRoute(normal, 'unknown-node'), []);
});

test('a broken or cyclic predecessor chain cannot hang the route preview', () => {
  const broken = new Map<string, SkillRouteStep>([['target', { cost: 1, previous: 'missing' }]]);
  assert.deepEqual(previewSkillRoute(broken, 'target'), []);
  const cycle = new Map<string, SkillRouteStep>([
    ['a', { cost: 1, previous: 'b' }], ['b', { cost: 2, previous: 'a' }],
  ]);
  assert.deepEqual(previewSkillRoute(cycle, 'a'), []);
});
