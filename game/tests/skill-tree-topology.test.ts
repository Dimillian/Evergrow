import assert from 'node:assert/strict';
import test from 'node:test';
import { SKILL_TREE, SKILL_NODES } from '../src/skill-tree.ts';
import { buildSkillRoutes, previewSkillRoute } from '../src/skill-tree-routes.ts';

test('opening passive routes preserves every active skill unlock cost and optional skill branches', () => {
  const routes = buildSkillRoutes(new Set(['origin']));
  const expected = { repulse: 15, ironCitadel: 33, smokeVeil: 14, nightReaping: 33,
    brace: 2, shieldBash: 4, bulwark: 6, cleave: 2, lunge: 5, whirlwind: 9, earthshatter: 13, rallyOfIron: 23,
    volley: 2, ricochet: 8, piercingShot: 10, rainOfArrows: 13, ghostHunt: 23, backstab: 2, sidestep: 3, vaultingShot: 8,
    fireball: 2, arcLightning: 3, meteor: 14, cataclysm: 24, tempest: 26, iceNova: 3, runicWard: 5,
    siphon: 8, frostLance: 11, absoluteZero: 24 };
  assert.equal(Object.keys(expected).length, SKILL_TREE.nodes.filter(node => node.skill).length);
  for (const [skill, cost] of Object.entries(expected)) {
    const id = `skill:${skill}`;
    assert.equal(routes.get(id)!.cost, cost, skill);
    assert.ok(previewSkillRoute(routes, id).slice(0, -1).every(id => {
      const node = SKILL_NODES.get(id)!;
      return !node.skill && !node.specialization && !node.doctrine && !node.keystone;
    }), `${skill} must not require another action or a tradeoff`);
  }
});

test('passive neighborhoods have multiple distinct entrances and remain compact', () => {
  for (const cluster of SKILL_TREE.clusters.filter(cluster => !cluster.id.startsWith('development:'))) {
    const members = SKILL_TREE.nodes.filter(node => node.cluster === cluster.id);
    const entrances = members.filter(node => node.neighbors.some(id => SKILL_NODES.get(id)!.cluster !== cluster.id));
    const exits = new Set(members.flatMap(node => node.neighbors.filter(id => SKILL_NODES.get(id)!.cluster !== cluster.id)));
    assert.ok(entrances.length >= 2, `${cluster.id} needs separate entry and exit nodes`);
    assert.ok(exits.size >= 2, `${cluster.id} must lead somewhere beyond its entrance`);
    for (const a of members) for (const b of members) {
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= 260, `${cluster.id} stretches its passive group`);
    }
  }
});

test('connections have short actual paths, including curved-path length if introduced', () => {
  for (const edge of SKILL_TREE.edges) {
    const a = SKILL_NODES.get(edge.from)!, b = SKILL_NODES.get(edge.to)!;
    const control = edge.control ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    let previous = { x: a.x, y: a.y }, length = 0;
    for (let step = 1; step <= 32; step++) {
      const t = step / 32, u = 1 - t;
      const point = { x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
        y: u * u * a.y + 2 * u * t * control.y + t * t * b.y };
      length += Math.hypot(point.x - previous.x, point.y - previous.y); previous = point;
    }
    const landmark = a.kind === 'origin' || b.kind === 'origin' || a.kind === 'major' || b.kind === 'major';
    assert.ok(length <= (landmark ? 320 : 180) + 1e-6, `${edge.from} → ${edge.to} is an empty ${length.toFixed(1)}-unit connection`);
  }
});

test('unrelated connections never cross without a node at the junction', () => {
  const cross = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const segments = SKILL_TREE.edges.flatMap(edge => {
    const a = SKILL_NODES.get(edge.from)!, b = SKILL_NODES.get(edge.to)!;
    const control = edge.control ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, steps = edge.control ? 32 : 1;
    return Array.from({ length: steps }, (_, i) => {
      const point = (t: number) => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * control.x + t * t * b.x,
        y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * control.y + t * t * b.y });
      return { edge, a: point(i / steps), b: point((i + 1) / steps) };
    });
  });
  for (let i = 0; i < segments.length; i++) for (let j = 0; j < i; j++) {
    const first = segments[i], second = segments[j];
    if (first.edge === second.edge || first.edge.from === second.edge.from || first.edge.from === second.edge.to
      || first.edge.to === second.edge.from || first.edge.to === second.edge.to) continue;
    const { a, b } = first, { a: c, b: d } = second;
    if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x)
      || Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.max(c.y, d.y) < Math.min(a.y, b.y)) continue;
    assert.ok(!(cross(a, b, c) * cross(a, b, d) < -1e-5 && cross(c, d, a) * cross(c, d, b) < -1e-5),
      `${first.edge.from} → ${first.edge.to} crosses ${second.edge.from} → ${second.edge.to}`);
  }
});
