import assert from 'node:assert/strict';
import test from 'node:test';
import { World, pathDistance } from '../src/world.ts';
import { WILDERNESS_RULES, startingEnemyCamp, siteHash } from '../src/wilderness-sites.ts';
import { Exploration } from '../src/exploration.ts';
import { validExplorationPOI } from '../src/exploration-save.ts';

const sort = <T extends { id: string }>(items: T[]) => items.sort((a, b) => a.id.localeCompare(b.id));

test('wilderness blueprints are seeded, immutable, bounded and independent of query order', () => {
  const world = new World(), same = new World(), other = new World(42);
  const sites = world.getWildernessSites(-8000, -8000, 16000, 16000);
  assert.ok(sites.length > 35 && sites.length < 110);
  assert.equal(new Set(sites.map(s => s.id)).size, sites.length);
  assert.deepEqual(sites, same.getWildernessSites(-8000, -8000, 16000, 16000));
  assert.notDeepEqual(sites, other.getWildernessSites(-8000, -8000, 16000, 16000));
  world.getWildernessSites(120000, 50000, 10000, 10000);
  assert.deepEqual(sites, world.getWildernessSites(-8000, -8000, 16000, 16000));
  assert.ok(world.cacheStats.wildernessSites <= WILDERNESS_RULES.cacheLimit);
  assert.ok(new Set(sites.map(s => s.kind)).size === 5);
  for (const site of sites) {
    assert.ok(Object.isFrozen(site) && Object.isFrozen(site.decor) && Object.isFrozen(site.members));
    assert.ok(site.decor.every(Object.isFrozen) && site.members.every(Object.isFrozen));
    assert.ok(site.radius <= WILDERNESS_RULES.maxRadius && site.decor.length <= 30 && site.members.length <= 6);
    assert.equal(site.biome, world.sampleBiome(site.x, site.y).id);
  }
  world.dispose(); assert.equal(world.cacheStats.wildernessSites, 0);
});

test('wilderness overlap and POI center queries agree across positive and negative partitions', () => {
  const world = new World(), bounds = [-6400, -6400, 12800, 12800] as const;
  const whole = world.getWildernessSites(...bounds);
  const pieces = [[-6400, -6400], [0, -6400], [-6400, 0], [0, 0]].flatMap(([x, y]) => world.getWildernessSites(x, y, 6400, 6400));
  assert.deepEqual(sort([...new Map(pieces.map(s => [s.id, s])).values()]), sort(whole));
  const known = world.getPOIs(...bounds).filter(p => p.id.startsWith('site:'));
  const partitioned = [[-6400, -6400], [0, -6400], [-6400, 0], [0, 0]].flatMap(([x, y]) => world.getPOIs(x, y, 6400, 6400)).filter(p => p.id.startsWith('site:'));
  assert.deepEqual(sort(partitioned), sort(known));
  assert.equal(new Set(partitioned.map(p => p.id)).size, partitioned.length);
  assert.ok(known.every(validExplorationPOI));
  assert.notEqual(siteHash(1, 2, 7319), siteHash(1 + 0x100000000, 2, 7319));
});

test('site placement protects settlements, roads, the starting clearing and other sites', () => {
  for (const seed of [7319, 42, -73]) {
    const world = new World(seed), sites = world.getWildernessSites(-10000, -10000, 20000, 20000);
    for (const site of sites) {
      assert.ok(Math.hypot(site.x, site.y) > 500 + site.radius);
      assert.ok(pathDistance(site.x, site.y) > site.radius + 80);
      assert.ok(!world.getSettlements(site.x - site.radius, site.y - site.radius, site.radius * 2, site.radius * 2)
        .some(town => Math.hypot(town.x - site.x, town.y - site.y) < town.radius + site.radius));
      assert.ok(sites.every(other => other.id === site.id || Math.hypot(other.x - site.x, other.y - site.y) > other.radius + site.radius));
    }
  }
});

test('the accessible first camp and distant camps have clear authored member slots and entrances', () => {
  for (const seed of [7319, 9, -127]) {
    const world = new World(seed), first = startingEnemyCamp(seed);
    assert.ok(Math.hypot(first.x, first.y) >= 600 && Math.hypot(first.x, first.y) <= 1000);
    const camps = world.getEnemyCamps(-8000, -8000, 16000, 16000);
    assert.ok(camps.some(c => c.id === first.id));
    for (const camp of camps) {
      assert.ok(camp.members.length >= 4 && camp.members.length <= 6);
      assert.equal(new Set(camp.members.map(m => m.id)).size, camp.members.length);
      for (const member of camp.members) {
        assert.equal(world.blocked(camp.x + member.dx, camp.y + member.dy, 17), false, `${camp.id} ${member.id} slot is blocked`);
        assert.equal(world.isSanctuary(camp.x + member.dx, camp.y + member.dy), false);
        if (Math.hypot(camp.x + member.dx, camp.y + member.dy) < 6400) assert.notEqual(member.rank, 'elite');
      }
      // The south gate leads into the court with a full player-radius corridor.
      for (let dy = 30; dy <= camp.radius; dy += 10) assert.equal(world.blocked(camp.x, camp.y + dy, 12), false, `${camp.id} entrance blocked at ${dy}`);
    }
  }
});

test('every authored place has an unobstructed south approach into its central walking space', () => {
  const world = new World();
  for (const site of world.getWildernessSites(-8000, -8000, 16000, 16000)) {
    for (let dy = 35; dy <= site.radius; dy += 5) assert.equal(world.blocked(site.x, site.y + dy, 12), false,
      `${site.kind} ${site.id} south approach blocked at ${dy}`);
  }
});

test('decor collision is shared by point checks and swept movement while clearings suppress ambient trunks', () => {
  const world = new World(), first = startingEnemyCamp(world.seed);
  const tent = first.decor.find(d => d.kind === 'tent')!;
  assert.equal(world.blocked(tent.x, tent.y, 12), true);
  const fromX = tent.x + tent.radius + 30;
  const moved = world.move(fromX, tent.y, -100, 0, 12);
  assert.ok(moved.x > tent.x + tent.radius + 11);
  assert.equal(world.blocked(moved.x, moved.y, 12), false);
  const ambient = world.getProps(first.x - first.radius, first.y - first.radius, first.radius * 2, first.radius * 2);
  assert.ok(ambient.every(p => Math.hypot(p.x - first.x, p.y - first.y) >= first.radius));
});

test('foreground tree crowns leave the nearest caravan and watchtower activity spaces visible', () => {
  const world = new World(), sites = world.getWildernessSites(-6000, -6000, 12000, 12000);
  for (const kind of ['caravan', 'watchtower'] as const) {
    const site = sites.filter(site => site.kind === kind).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0];
    assert.ok(site && site.biome === 'verdant');
    const props = world.getProps(site.x - 500, site.y - 500, 1000, 1000);
    const canopies = props.filter(prop => prop.kind === 'tree' || prop.kind === 'willow');
    assert.ok(canopies.length >= 12, 'the surrounding forest remains dense');
    for (const tree of canopies) {
      const crownY = tree.y - 90 * tree.scale;
      assert.ok(Math.hypot(tree.x - site.x, crownY - site.y) >= site.radius + 30,
        `${kind}: foreground crown ${tree.id} hides the authored activity clearing`);
      for (const supply of site.decor.filter(decor => ['fire', 'crate', 'barrel', 'bedroll'].includes(decor.kind))) {
        if (tree.y <= supply.y) continue;
        assert.ok(Math.hypot((tree.x - supply.x) / (70 * tree.scale), (crownY - supply.y) / (60 * tree.scale)) >= 1,
          `${kind}: foreground canopy ${tree.id} obscures ${supply.kind}`);
      }
    }
  }
});

test('unvisited sites stay hidden and new site discovery round-trips without changing chart identity', t => {
  const world = new World(), chart = new Exploration(world, { storage: null });
  const camp = startingEnemyCamp(world.seed);
  t.after(() => chart.dispose());
  chart.reveal(0, 0, 260);
  assert.equal(chart.isDiscovered(camp.id), false);
  chart.reveal(camp.x, camp.y, 260);
  assert.equal(chart.isDiscovered(camp.id), true);
  const saved = chart.serialize(), restored = new Exploration(world, { storage: null });
  t.after(() => restored.dispose());
  assert.equal(restored.restore(saved), true);
  assert.deepEqual(restored.getDiscoveredPOIs(), chart.getDiscoveredPOIs());
  assert.equal(saved.includes('cleared'), false, 'camp run state is not stored in chart discovery');
});

test('invalid or over-budget wilderness requests terminate without enumerating unbounded cells', () => {
  const world = new World();
  for (const rect of [[Infinity, 0, 10, 10], [0, 0, -1, 1], [0, 0, 1, NaN], [0, 0, 262144, 262144], [Number.MAX_VALUE, 0, 1, 1]]) {
    const [x, y, w, h] = rect;
    assert.deepEqual(world.getWildernessSites(x, y, w, h), []);
    assert.deepEqual(world.getEnemyCamps(x, y, w, h), []);
  }
  assert.equal(world.cacheStats.wildernessSites, 0);
});
