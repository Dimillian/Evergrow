import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWorldSeed } from '../src/world-seed.ts';
import { World } from '../src/world.ts';

test('world seed input accepts the complete unsigned range without wrapping or truncating', () => {
  for (const [text, seed] of [['0', 0], ['0007319', 7319], [' 18427 ', 18427], ['4294967295', 4294967295]] as const)
    assert.equal(parseWorldSeed(text), seed);
  for (const text of ['', ' ', '-1', '+1', '1.5', '1e3', '0xff', '4,000', '4294967296', '12345678901', 'NaN'])
    assert.equal(parseWorldSeed(text), null, text);
});

test('reopening a selected seed reconstructs its geography instead of the default world', () => {
  const sample = (seed: number) => {
    const world = new World(seed);
    const result = { seed: world.seed, props: world.getProps(6000, 7000, 500, 500), biome: world.sampleBiome(6500, 7500) };
    world.dispose(); return result;
  };
  const first = sample(18427), other = sample(4294967295), again = sample(18427);
  assert.deepEqual(first, again);
  assert.equal(other.seed, 4294967295);
  assert.notDeepEqual(first.biome, other.biome);
});
