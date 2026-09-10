import assert from 'node:assert/strict';
import test from 'node:test';
import { SettlementArt } from '../src/settlement-art.ts';
import { generateSettlement } from '../src/settlements.ts';
import { settlementPlace } from '../src/world-geography.ts';
import { skyAtHour } from '../src/world-time.ts';

const towns = Array.from({ length: 12 }, (_, i) => generateSettlement(7319, settlementPlace(7319, i, 0)));
const buildings = towns.flatMap(t => t.buildings);

test('night lights follow actual stall lamps and brighten without changing radius; tents have no phantom windows', () => {
  const art = new SettlementArt();
  const stall = buildings.find(b => b.form === 'stall')!;
  const day = art.getLights([stall], 3, skyAtHour(12));
  const night = art.getLights([stall], 3, skyAtHour(22));
  assert.equal(day.length, 1);
  assert.equal(night[0].x, stall.x + 7.5);
  assert.equal(night[0].y, stall.y + stall.height * .45 + 6);
  assert.ok(night[0].power > day[0].power + .4);
  assert.equal(night[0].radius, day[0].radius);
  assert.equal(art.getLights(buildings.filter(b => b.form === 'tent'), 0, skyAtHour(22)).length, 0);
  assert.ok(art.getLights(buildings, 0, skyAtHour(22)).length <= 12);
});

test('entering a house fades its facade window light and enables its interior light', () => {
  const art = new SettlementArt(), house = buildings.find(b => b.form === 'house' && b.kind === 'house')!;
  assert.ok(house);
  const night = skyAtHour(22);
  assert.ok(art.getLights([house], 0, night).some(l => l.radius === 89));
  for (let i = 0; i < 90; i++) art.update([house], house.door.x, house.y + house.height / 2, 1 / 30, true);
  const opened = art.getLights([house], 0, night);
  assert.equal(opened.some(l => l.radius === 89), false);
  assert.ok(opened.some(l => l.color === '#e1cda0'));
});

test('fortification art is cached across time changes, preserves depth and clears on renderer reset', () => {
  let allocations = 0;
  const context = new Proxy({}, { get: () => () => {} }) as CanvasRenderingContext2D;
  const art = new SettlementArt((width, height) => {
    allocations++;
    assert.ok(width > 0 && height > 0 && width * height < 6_000_000);
    return { width, height, getContext: () => context } as unknown as HTMLCanvasElement;
  });
  const materials = new Set<string>();
  const walls = buildings.filter(b => b.wallSegment);
  const samples = ['barricade', 'palisade', 'stone'].flatMap(material => walls.filter(b => b.fortification === material).slice(0, 8));
  for (const wall of samples) {
    materials.add(wall.fortification!);
    const layers = art.getStructureLayers(wall, 0);
    assert.equal(layers[0].y, wall.y + wall.height);
    layers[0].draw(context);
    const count = allocations;
    art.getStructureLayers(wall, 10)[0].draw(context);
    assert.equal(allocations, count, 'day/night and animation time reuse the same masonry');
  }
  assert.ok(materials.has('palisade') && materials.has('stone'));
  const wall = buildings.find(b => b.wallSegment)!;
  const count = allocations;
  art.reset(); art.getStructureLayers(wall, 20)[0].draw(context);
  assert.equal(allocations, count + 1);
});
