import test from 'node:test';
import assert from 'node:assert/strict';
import { World, mainPathX, pathDistance } from '../src/world.ts';
import { FIRST_TOWN_Y, MAX_TOWN_RADIUS, settlementPavingWeight, TOWN_INTERVAL } from '../src/settlements.ts';

function townAt(world: World, band: number) {
  const y = FIRST_TOWN_Y + band * TOWN_INTERVAL;
  return world.getSettlements(-900, y - MAX_TOWN_RADIUS, 1800, MAX_TOWN_RADIUS * 2)[0];
}

test('Briarwatch and recurring cities have reproducible varied blocks and all essential services', () => {
  for (const seed of [7319, 9, -127]) {
    const world = new World(seed);
    for (let band = -4; band <= 4; band++) {
      const town = townAt(world, band);
      assert.deepEqual(town, townAt(new World(seed), band));
      assert.ok(town.buildings.length >= (town.kind === 'city' ? 12 : 5));
      assert.ok(town.buildings.length <= (town.kind === 'city' ? 16 : 8));
      for (const kind of ['blacksmith', 'merchant', 'inn', 'chapel']) assert.ok(town.buildings.some(building => building.kind === kind));
      assert.equal(new Set(town.buildings.map(building => building.id)).size, town.buildings.length);
      assert.ok(town.radius <= MAX_TOWN_RADIUS);
      for (const building of town.buildings) {
        assert.ok(building.width >= 144 && building.height >= 116, 'interiors have room for the full-size character');
        assert.ok(building.door.width >= 40, 'doors are wide enough for movement through the threshold');
        assert.ok(building.furniture.length >= 3, 'larger interiors retain useful furnishing groups');
      }
      for (const footprint of [...town.buildings, ...town.streets, town.plaza]) {
        for (const [x, y] of [[footprint.x, footprint.y], [footprint.x + footprint.width, footprint.y],
          [footprint.x, footprint.y + footprint.height], [footprint.x + footprint.width, footprint.y + footprint.height]]) {
          assert.ok(Math.hypot(x - town.x, y - town.y) < town.radius, 'every building and entrance street fits the query and sanctuary bounds');
        }
      }
      if (town.kind === 'city') {
        const columns = new Set(town.buildings.map(b => Math.round((b.door.x - mainPathX(b.door.y)) / 100)));
        assert.ok(columns.size >= 4, 'city streets serve both inner and outer building blocks');
      }
    }
  }
  const first = townAt(new World(), 0);
  assert.equal(first.name, 'Briarwatch');
  assert.equal(first.y, -1150);
  assert.equal(first.buildings.length, 8);
  assert.ok(first.y + first.radius <= -350, 'the original starting arena remains outside town');
  assert.equal(townAt(new World(), -1).kind, 'city');
});

test('every south door connects the street to an interior with solid walls and furniture', () => {
  const world = new World();
  for (const band of [0, -1, 2]) {
    const town = townAt(world, band);
    for (const building of town.buildings) {
      const door = building.door;
      assert.equal(world.blocked(door.x, door.y, 9), false);
      for (let y = building.y + 56; y <= door.y + 24; y += 4) {
        assert.equal(world.blocked(door.x, y, 16), false, 'a 32px-wide center aisle stays clear through the door');
      }
      const inside = world.move(door.x, door.y + 35, 0, -70, 9);
      assert.ok(Math.abs(inside.y - (door.y - 35)) < 1e-8, `${building.id} has a continuous entrance`);
      assert.equal(world.getBuildingAt(inside.x, inside.y)?.id, building.id);
      const outside = world.move(inside.x, inside.y, 0, 70, 9);
      assert.ok(Math.abs(outside.y - (door.y + 35)) < 1e-8);
      assert.equal(world.getBuildingAt(outside.x, outside.y), null);
      assert.equal(world.blocked(building.x + building.width / 2, building.y + 3, 1), true);
      const wall = world.move(building.x - 30, building.y + building.height / 2, building.width + 60, 0, 9);
      assert.ok(wall.x <= building.x - 9, 'a large movement cannot tunnel through a wall');
      for (const item of building.furniture) assert.equal(world.blocked(item.x + item.width / 2, item.y + item.height / 2, 1), true);
      const streetY = door.y + 24, roadX = mainPathX(streetY);
      const street = world.move(door.x, streetY, roadX - door.x, 0, 9);
      assert.ok(Math.abs(street.x - roadX) < 1e-8, 'each threshold has an unobstructed route to the main road');
    }
  }
});

test('paving continuously joins the main road, side streets and rounded plaza, then fades to dirt', () => {
  const world = new World(), town = townAt(world, 0);
  for (const building of town.buildings) {
    const y = building.door.y + 24, roadX = mainPathX(y);
    for (let t = 0; t <= 1; t += .025) {
      const x = roadX + (building.door.x - roadX) * t;
      assert.ok(settlementPavingWeight(town, x, y, pathDistance(x, y) < 25 ? 1 : 0) > .99,
        'stone has no gap from the main road to each entry street');
      assert.equal(world.mapColor(x, y), 'rgb(80,80,70)', 'terrain and map use one continuous stone material');
    }
  }
  const isolated = { ...town, x: 0, y: 0, radius: 600, plaza: { x: -80, y: -60, width: 160, height: 120 }, streets: [] };
  assert.equal(settlementPavingWeight(isolated, 0, 0, 1), 1);
  assert.equal(settlementPavingWeight(isolated, 0, 600, 1), 0);
  let previous = 1, blended = 0;
  for (let y = 400; y <= 620; y++) {
    const weight = settlementPavingWeight(isolated, 0, y, 1);
    assert.ok(weight <= previous && previous - weight < .012, 'town cobbles dissolve smoothly along the outgoing dirt road');
    if (weight > 0 && weight < 1) blended++;
    previous = weight;
  }
  assert.ok(blended > 140);
  assert.ok(settlementPavingWeight(isolated, 80, 60, 0) < settlementPavingWeight(isolated, 0, 60, 0), 'plaza corners curve instead of ending as hard rectangles');
  let last = settlementPavingWeight(isolated, 0, 40, 0);
  for (let y = 40.25; y < 80; y += .25) {
    const next = settlementPavingWeight(isolated, 0, y, 0);
    assert.ok(Math.abs(next - last) < .028, 'paving shoulders have continuous material coverage');
    last = next;
  }
});

test('sanctuary and point-of-interest queries agree with the generated settlement geometry', () => {
  const world = new World();
  assert.equal(world.isSanctuary(0, 0), false);
  const town = townAt(world, 0);
  assert.equal(world.isSanctuary(town.x, town.y), true);
  const pois = world.getPOIs(town.x - town.radius, town.y - town.radius, town.radius * 2, town.radius * 2);
  assert.ok(pois.some(poi => poi.kind === 'town' && poi.id === town.id));
  for (const building of town.buildings.filter(b => b.kind !== 'house')) {
    assert.ok(pois.some(poi => poi.kind === building.kind && poi.x === building.door.x && poi.y === building.door.y));
    assert.equal(world.isSanctuary(building.door.x, building.door.y), true);
  }
  assert.equal(world.getProps(town.x - town.radius, town.y - town.radius, town.radius * 2, town.radius * 2)
    .some(prop => world.isSanctuary(prop.x, prop.y)), false, 'terrain props cannot obstruct settlement routes');
  assert.equal(world.getPOIs(-100, -110, 40, 40).filter(poi => poi.id === 'shrine:origin').length, 1);
});

test('settlement caching is bounded and eviction does not change regenerated layouts', () => {
  const world = new World();
  const first = townAt(world, 0);
  assert.equal(townAt(world, 0), first);
  for (let band = 1; band <= 64; band++) townAt(world, band);
  const regenerated = townAt(world, 0);
  assert.notEqual(regenerated, first);
  assert.deepEqual(regenerated, first);
  assert.deepEqual(world.getSettlements(Infinity, 0, 10, 10), []);
  assert.deepEqual(world.getBuildings(0, 0, -10, 10), []);
});
