import test from 'node:test';
import assert from 'node:assert/strict';
import { BIOME_IDS, type BiomeWeights } from '../src/biomes.ts';
import { sceneClimate, shadowProjection, SKY_DIRECTION } from '../src/scene-light-style.ts';
import { sampleGearLight } from '../src/gear-scene-light.ts';
import { gearLightResponse, gearSurface } from '../src/gear-material.ts';

const weights = (id: typeof BIOME_IDS[number]) => Object.fromEntries(BIOME_IDS.map(b => [b, b === id ? 1 : 0])) as BiomeWeights;
test('climate lighting blends continuously and interiors fade away from daylight', () => {
  for (const id of BIOME_IDS) {
    const outside = sceneClimate(weights(id)), inside = sceneClimate(weights(id), 1), halfway = sceneClimate(weights(id), .5);
    assert.ok(outside.fog > 0 && outside.fog < .25);
    assert.ok(/^#[0-9a-f]{6}$/.test(outside.color));
    assert.ok(Math.abs(halfway.key.power - (outside.key.power + inside.key.power) / 2) < 1e-10);
    assert.ok(inside.key.power < outside.key.power);
  }
  const blend = weights('swamp'); blend.swamp = .5; blend.sunscar = .5;
  assert.ok(Math.abs(sceneClimate(blend).fog - (sceneClimate(weights('swamp')).fog + sceneClimate(weights('sunscar')).fog) / 2) < 1e-10);
});
test('cast shadows point away from illumination and stay bounded at grazing angles', () => {
  for (const direction of [SKY_DIRECTION, [1, 0, .01], [-1, -.3, .6], [0, 0, 1]] as const) {
    const p = shadowProjection(direction);
    assert.ok(p.x * direction[0] <= 0 && p.y * direction[1] <= 0);
    assert.ok(Math.abs(p.x) <= .78 && Math.abs(p.y) <= .456);
    assert.ok(Number.isFinite(p.x + p.y));
  }
});
test('nearby colored light turns material faces and their shadows together', () => {
  const key = sceneClimate(weights('deadwood')).key;
  const light = { x: 35, y: 0, radius: 160, color: '#ff8844', power: 1.5 };
  const lit = sampleGearLight(0, 0, [light], key);
  assert.ok(lit.direction[0] > 0);
  assert.ok(shadowProjection(lit.direction).x < 0);
  assert.strictEqual(sampleGearLight(500, 0, [light], key), key);
  const facing = gearSurface('steel', 1, [.8, 0, .6]);
  assert.ok(gearLightResponse(facing, lit).diffuse > gearLightResponse(facing, key).diffuse);
  assert.ok(gearLightResponse(gearSurface('steel', 1, [0,0,1]), { direction:[0,0,1], color:'#ffffff', power:1 }).specular
    > gearLightResponse(gearSurface('cloth', 1, [0,0,1]), { direction:[0,0,1], color:'#ffffff', power:1 }).specular * 10);
});
