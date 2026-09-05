import assert from 'node:assert/strict';
import test from 'node:test';
import { BIOME_IDS, BIOMES, sampleBiome, type BiomeId, type BiomeWeights } from '../src/biomes.ts';
import { BIOME_PROP_TABLES, PROP_DEFINITIONS, PROP_KINDS, chooseBiomeProp, propDefinition } from '../src/biome-props.ts';
import { World, pathDistance } from '../src/world.ts';

const oneBiome = (id: BiomeId): BiomeWeights => Object.fromEntries(BIOME_IDS.map(key => [key, key === id ? 1 : 0])) as BiomeWeights;

test('every climate has immutable weighted species and one authoritative bounded prop profile', () => {
  for (const biome of BIOME_IDS) {
    const table = BIOME_PROP_TABLES[biome];
    assert.ok(Object.isFrozen(table));
    assert.ok(table.length >= 5, 'a climate contains a mix of distinct flora and ground forms');
    assert.equal(new Set(table.map(entry => entry.kind)).size, table.length);
    for (const entry of table) {
      assert.ok(entry.weight > 0 && Object.isFrozen(entry));
      assert.ok(PROP_DEFINITIONS[entry.kind]);
    }
  }
  for (const kind of PROP_KINDS) {
    const definition = propDefinition(kind);
    assert.ok(Object.isFrozen(definition) && Object.isFrozen(definition.radius) && Object.isFrozen(definition.scale));
    assert.ok(definition.radius[0] >= 0 && definition.radius[0] <= definition.radius[1] && definition.radius[1] <= 15,
      `${kind} fits the existing collision broad-phase bound`);
    assert.ok(definition.scale[0] > 0 && definition.scale[1] <= 1.2);
    if (definition.canopy) assert.ok(Object.isFrozen(definition.canopy) && definition.canopy.height > 0 && definition.canopy.radius > 0);
    if (definition.emissive) assert.ok(Object.isFrozen(definition.emissive) && definition.emissive.power > 0);
  }
});

test('sampling a pure climate can select every authored species without borrowing another climate', () => {
  for (const biome of BIOME_IDS) {
    const selected = new Set<string>();
    for (let roll = 0; roll < 1000; roll++) {
      const result = chooseBiomeProp(oneBiome(biome), (roll + .5) / 1000, (roll + .5) / 1000);
      assert.equal(result.biome, biome); selected.add(result.kind);
      assert.deepEqual(result, chooseBiomeProp(oneBiome(biome), (roll + .5) / 1000, (roll + .5) / 1000));
    }
    assert.deepEqual([...selected].sort(), BIOME_PROP_TABLES[biome].map(entry => entry.kind).sort());
  }
});

test('all generated prop families retain deterministic partitioning and decorative passability', () => {
  class ClimateWorld extends World {
    readonly climate: BiomeId;
    constructor(climate: BiomeId) { super(7319); this.climate = climate; }
    override sampleBiome() { return { id: this.climate, name: BIOMES[this.climate].name, weights: oneBiome(this.climate) }; }
  }
  for (const biome of BIOME_IDS) {
    const world = new ClimateWorld(biome), x = 2200, y = -3200, size = 2560;
    const props = world.getProps(x, y, size, size), ids = props.map(prop => prop.id).sort();
    const parts = [[x, y], [x + size / 2, y], [x, y + size / 2], [x + size / 2, y + size / 2]]
      .flatMap(([px, py]) => world.getProps(px, py, size / 2, size / 2));
    assert.deepEqual(parts.map(prop => prop.id).sort(), ids, 'partitioning preserves the same half-open field');
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(props, world.getProps(x, y, size, size));
    const natural = props.filter(prop => prop.kind !== 'shrine');
    for (const entry of BIOME_PROP_TABLES[biome]) assert.ok(natural.some(prop => prop.kind === entry.kind), `${biome} generated ${entry.kind}`);
    for (const prop of natural) {
      assert.equal(prop.biome, biome); assert.ok(pathDistance(prop.x, prop.y) >= 76);
      assert.equal(world.isSanctuary(prop.x, prop.y), false);
      if (prop.radius === 0) assert.equal(world.blocked(prop.x, prop.y, 1), false, `${prop.kind} is traversable ground cover`);
    }
    world.dispose();
  }
});

test('real geographic ecotones mix neighboring species at their own prop coordinates', () => {
  const world = new World(7319);
  let transition: { x: number; y: number } | undefined;
  for (let y = -6000; y <= 6000 && !transition; y += 300) for (let x = -6000; x <= 6000; x += 300) {
    const active = Object.values(sampleBiome(x, y, world.seed).weights).filter(weight => weight > .24);
    if (active.length >= 2 && Math.abs(x) > 900) { transition = { x, y }; break; }
  }
  assert.ok(transition, 'the climate field contains a broad mixed ecotone');
  const props = world.getProps(transition.x - 400, transition.y - 400, 800, 800).filter(prop => prop.kind !== 'shrine');
  assert.ok(new Set(props.map(prop => prop.biome)).size >= 2, 'a real transition mixes species instead of switching on its dominant ID');
  for (const prop of props) {
    const weights = world.sampleBiome(prop.x, prop.y).weights;
    assert.ok(weights[prop.biome!] > 0, 'the selected flora belongs to an actual local biome influence');
    assert.ok(BIOME_PROP_TABLES[prop.biome!].some(entry => entry.kind === prop.kind));
  }
  world.dispose();
});

test('all projected crown shapes remain clear of protected wilderness site centers', () => {
  const world = new World(7319);
  for (const [x, y] of [[-7000, -3000], [-1500, -1000], [3500, 6000], [9000, 1000]]) {
    for (const prop of world.getProps(x, y, 2400, 2400)) {
      const crown = propDefinition(prop.kind).canopy;
      if (!crown) continue;
      const cx = prop.x + crown.offsetX * prop.scale, cy = prop.y - crown.height * prop.scale, r = crown.radius * prop.scale;
      for (const site of world.getWildernessSites(cx - r, cy - r, r * 2, r * 2)) {
        assert.ok(Math.hypot(cx - site.x, cy - site.y) >= site.radius + r, `${prop.kind} crown cannot hide ${site.kind}`);
      }
    }
  }
  world.dispose();
});
