import assert from 'node:assert/strict';
import test from 'node:test';
import { World, TILE_SIZE, mainPathX, pathDistance, type Prop } from '../src/world.ts';

test('world queries are reproducible, order-independent, and safe without a DOM', () => {
  const first = new World();
  const second = new World(7319);
  const expected = first.getProps(-800, -1200, 1600, 2000);
  assert.ok(expected.length > 60);
  first.getProps(4800, -6000, 1000, 1000);
  assert.deepEqual(first.getProps(-800, -1200, 1600, 2000), expected);
  assert.deepEqual(second.getProps(-800, -1200, 1600, 2000), expected);
  assert.notDeepEqual(new World(999).getProps(-800, -1200, 1600, 2000), expected);
  assert.equal(new Set(expected.map(prop => prop.id)).size, expected.length);
  for (let i = 1; i < expected.length; i++) assert.ok(expected[i].y >= expected[i - 1].y);
});

test('partitioned queries have exactly the same identities and values at negative coordinates', () => {
  const world = new World();
  const whole = world.getProps(-512, -512, 1024, 1024);
  const quadrants = [
    world.getProps(-512, -512, 512, 512), world.getProps(0, -512, 512, 512),
    world.getProps(-512, 0, 512, 512), world.getProps(0, 0, 512, 512),
  ].flat().sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  assert.deepEqual(quadrants, whole);
  const negativeTree = whole.find(prop => prop.x < -180 && prop.y < -140 && prop.kind !== 'rock');
  assert.ok(negativeTree);
  assert.equal(world.blocked(negativeTree.x, negativeTree.y, 1), true);
  assert.equal(world.blocked(0, 0, 12), false);
  assert.equal(world.blocked(-85, -95, 12), true);
  assert.equal(whole.filter(prop => prop.id === 'shrine:origin').length, 1);
});

test('the starting ellipse has no props except its shrine', () => {
  const props = new World().getProps(-180, -140, 360, 280);
  for (const prop of props) {
    if ((prop.x / 180) ** 2 + (prop.y / 140) ** 2 < 1) assert.equal(prop.id, 'shrine:origin');
  }
});

test('main road and connecting branches remain walkable across many positive and negative regions', () => {
  for (const seed of [7319, 9, -127]) {
    const world = new World(seed);
    for (let y = -12000; y <= 12000; y += 19) {
      assert.equal(pathDistance(mainPathX(y), y), 0);
      assert.equal(world.blocked(mainPathX(y), y, 14), false, `main road blocked at ${y}, seed ${seed}`);
    }
    for (let band = -3; band <= 3; band++) {
      for (let x = -2500; x <= 2500; x += 23) {
        const y = band * 1600 - 620 + Math.sin(x / 430) * 90 + Math.sin(x / 180) * 25;
        // Roadside shrines can touch a crossroad shoulder but never seal the route.
        if (world.blocked(x, y, 14)) {
          assert.ok(!world.blocked(x, y - 36, 14) || !world.blocked(x, y + 36, 14));
        }
      }
    }
  }
});

class SingleTreeWorld extends World {
  tree: Prop = { id: 'prop:-4:-7', x: -300, y: -500, radius: 12, kind: 'deadTree', seed: 1, scale: 1 };

  override getProps(x: number, y: number, width: number, height: number): Prop[] {
    const prop = this.tree;
    return prop.x >= x && prop.x < x + width && prop.y >= y && prop.y < y + height ? [prop] : [];
  }
}

test('a large movement cannot tunnel through a trunk, even with clear endpoints', () => {
  const world = new SingleTreeWorld();
  const radius = 11;
  const from = { x: world.tree.x - 160, y: world.tree.y };
  const result = world.move(from.x, from.y, 400, 0, radius);
  assert.ok(result.x > from.x + 100, 'the player should approach the trunk');
  assert.ok(result.x <= world.tree.x - radius - world.tree.radius + 0.001);
  assert.equal(result.y, from.y);
  assert.equal(world.blocked(result.x, result.y, radius), false);
});

test('diagonal movement slides along a trunk and preserves progress on its free axis', () => {
  const world = new SingleTreeWorld();
  const from = { x: world.tree.x - 60, y: world.tree.y - 10 };
  const result = world.move(from.x, from.y, 120, 55, 11);
  assert.ok(result.y > from.y + 45, 'movement should continue along the free vertical axis');
  assert.ok(result.x > world.tree.x, 'the player should pass around the trunk');
  assert.equal(world.blocked(result.x, result.y, 11), false);
});

test('unobstructed movement preserves requested displacement and rejects invalid query rectangles', () => {
  const world = new World();
  assert.deepEqual(world.move(0, 0, 12, 16, 12), { x: 12, y: 16 });
  assert.deepEqual(world.getProps(0, 0, -10, 20), []);
  assert.deepEqual(world.getProps(Infinity, 0, 10, 20), []);
});

test('ground tiles use an injected canvas and a bounded LRU cache', () => {
  let created = 0;
  const context = {
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, stroke() {},
  };
  const factory = () => {
    created++;
    return { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
  };
  const world = new World();
  const first = world.getGroundTile(-1, -1, factory);
  assert.equal(first.width, TILE_SIZE);
  assert.equal(first.height, TILE_SIZE);
  assert.equal(world.getGroundTile(-1, -1, factory), first);
  assert.equal(created, 1);
  const second = world.getGroundTile(0, -1, factory);
  for (let x = 1; x < 47; x++) world.getGroundTile(x, -1, factory);
  assert.equal(created, 48);
  assert.equal(world.getGroundTile(-1, -1, factory), first); // Make this entry most recently used.
  world.getGroundTile(47, -1, factory);
  assert.equal(world.getGroundTile(-1, -1, factory), first);
  assert.notEqual(world.getGroundTile(0, -1, factory), second);
  assert.equal(created, 50);
});
