import assert from 'node:assert/strict';
import test from 'node:test';
import { MATERIALS, type MaterialId } from '../src/material-content.ts';
import { MaterialResponses, createMaterialBurst, fragmentPose, eventMaterial, MATERIAL_LIMITS } from '../src/material-response.ts';
import { EnemyDeaths } from '../src/death-presentation.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { World } from '../src/world.ts';

const request = { x: 10, y: 20, seed: 37, angle: .5, material: 'wood' as const, count: 14, strength: 1, hoops: 2 };
const kill = { type: 'kill' as const, x: 10, y: 20, targetId: 1, angle: .5, facing: 1, remainingHp: 0 as const, enemyKind: 'hound' as const };
test('materials own distinct immutable recipes and deterministic geometry without runtime RNG', () => {
  assert.equal(Object.keys(MATERIALS).length, 7);
  const old = Math.random; Math.random = () => { throw new Error('presentation must not need global RNG'); };
  try {
    for (const material of Object.keys(MATERIALS) as MaterialId[]) {
      const recipe = MATERIALS[material]; assert.ok(Object.isFrozen(recipe) && Object.isFrozen(recipe.colors) && Object.isFrozen(recipe.sound));
      assert.deepEqual(createMaterialBurst({ ...request, material }), createMaterialBurst({ ...request, material }));
    }
    assert.notDeepEqual(createMaterialBurst(request).fragments, createMaterialBurst({ ...request, seed: 38 }).fragments);
  } finally { Math.random = old; }
});

test('all fragment trajectories remain finite, settle or rise, and reduced motion is stationary', () => {
  for (const material of Object.keys(MATERIALS) as MaterialId[]) {
    const burst = createMaterialBurst({ ...request, material });
    for (const age of [0, .1, .5, 1, 3, 7]) {
      burst.age = age;
      for (const f of burst.fragments) {
        const pose = fragmentPose(burst, f, false);
        assert.ok(Object.values(pose).every(Number.isFinite)); assert.ok(pose.height >= -1e-8);
        assert.ok(pose.opacity >= 0 && pose.opacity <= 1);
        assert.equal(fragmentPose(burst, f, true).height, 0);
      }
    }
    const f = burst.fragments[0]; burst.age = .1; const a = fragmentPose(burst, f, true); burst.age = .6; const b = fragmentPose(burst, f, true);
    assert.deepEqual({ ...a, opacity: 1 }, { ...b, opacity: 1 });
    if (material !== 'ember') { burst.age = 2; assert.equal(fragmentPose(burst, f, false).height, 0); }
  }
});

test('a lethal contact emits one material response; containers retain hoops and elemental rules share mapping', () => {
  const effects = new MaterialResponses();
  effects.handle({ type: 'hit', x: 10, y: 20, targetId: 1, angle: 0, value: 20, remainingHp: 0, enemyKind: 'hound', heavy: false, style: 'frost' });
  effects.handle({ ...kill, style: 'frost' }); assert.equal(effects.bursts.length, 1); assert.equal(effects.bursts[0].material, 'ice');
  assert.equal(eventMaterial({ ...kill, style: 'fire' }), 'ember'); assert.equal(eventMaterial({ ...kill, style: 'lightning' }), 'metal');
  assert.equal(eventMaterial(kill), 'bone');
  effects.handle({ type: 'container-break', containerId: 'barrel', x: 0, y: 0, seed: 7, angle: 0, kind: 'barrel' });
  assert.equal(effects.bursts[1].fragments.filter(f => f.hoop).length, 2);
});

test('impact storms share hard fragment, burst and light budgets; reset/expiry release everything', () => {
  const effects = new MaterialResponses();
  for (let i = 0; i < 1000; i++) {
    effects.handle({ ...kill, targetId: i, style: i % 2 ? 'fire' : 'frost' });
    assert.ok(effects.fragmentCount <= MATERIAL_LIMITS.fragments); assert.ok(effects.bursts.length <= MATERIAL_LIMITS.bursts);
  }
  assert.ok(effects.lights(false).length <= 6); assert.deepEqual(effects.lights(true), []);
  for (const dt of [0, -1, NaN, Infinity]) effects.update(dt);
  assert.equal(effects.bursts[0].age, 0); effects.update(7); assert.equal(effects.fragmentCount, 0);
  effects.add(request); effects.reset(); assert.equal(effects.bursts.length, 0);
});

test('released projectiles preserve their element after weapon changes; death effects never alter rewards or saves', () => {
  const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
  const sim = new Simulation(world, { spawn: false });
  const enemy = sim.spawnEnemy('hound', 50, 0)!; enemy.hp = 1; enemy.state = 'recover'; enemy.stateDuration = 999;
  sim.player.equipment.mainHand = { ...sim.player.equipment.mainHand, damageType: 'fire' };
  sim.projectiles.push({ id: 900, sourceLevel: 1, x: 0, y: 0, prevX: 0, prevY: 0, vx: 500, vy: 0, angle: 0,
    damage: 100, radius: 3, owner: 'player', life: 1, maxLife: 1, hitIds: new Set(), effects: { style: 'frost' } });
  for (let i = 0; i < 15; i++) sim.update(FIXED_STEP, { moveX: 0, moveY: 0, aimX: 100, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null });
  const events = sim.drainEvents(), death = events.find(e => e.type === 'kill'); assert.ok(death); assert.equal(death.style, 'frost');
  const checkpoint = sim.captureCheckpoint(), effects = new MaterialResponses(), corpses = new EnemyDeaths();
  for (const e of events) { effects.handle(e); corpses.handle(e); }
  effects.update(2); corpses.update(.6); assert.equal(corpses.remains.length, 0);
  assert.deepEqual(sim.captureCheckpoint(), checkpoint); assert.equal(sim.kills, 1);
});

test('surface classification follows actual scenery while leaving it solid', () => {
  const world = new World(4), props = world.getProps(-1600, -1600, 3200, 3200); // Deadwood home: wood and stone fixtures.
  for (const [kind, material] of [['deadTree','wood'], ['rock','stone']] as const) {
    const prop = props.find(p => p.kind === kind)!; assert.ok(prop);
    assert.equal(world.impactMaterial(prop.x, prop.y, 1), material); assert.ok(world.blocked(prop.x, prop.y, 1));
  }
  world.dispose();
});
