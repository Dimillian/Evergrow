import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { advanceGroundEffects, scheduleGroundEffect, type ActiveGroundEffect, type GroundEffectRequest } from '../src/ground-effects.ts';
import { SKILL_EXECUTION, GROUND_EFFECT_RULES } from '../src/skill-execution-content.ts';
import { advanceEnemyStatuses } from '../src/combat-status.ts';
import { meteorPose, groundSpellLights } from '../src/ground-spell-art.ts';
import { enemyWarnings } from '../src/enemy-warning-art.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import { WARDEN_RULES } from '../src/dungeon-boss.ts';
import { MaterialResponses } from '../src/material-response.ts';
import type { CombatEvent } from '../src/model.ts';

const world = { blocked: () => false, move: (x: number, y: number) => ({ x, y }) };
function meteor(): GroundEffectRequest & { scorch: { duration: number; interval: number; dps: number } } {
  const r = SKILL_EXECUTION.meteor;
  return { kind: r.effect, skill: 'meteor' as const, x: 0, y: 0, radius: r.radius, delay: r.delay,
    duration: r.duration, interval: r.interval, style: r.style, damage: 100,
    scorch: { duration: r.scorch.duration, interval: r.scorch.interval, dps: 100 * r.scorch.damageMultiplier } };
}
test('Meteor lands once, then ignites later entrants without extra hits, blasts, or damage through walls', () => {
  const sim = new Simulation(world, { spawn: false });
  const target = sim.spawnEnemy('brute', 0, 0)!, late = sim.spawnEnemy('brute', 500, 0)!, hidden = sim.spawnEnemy('brute', 10, 0)!;
  let effects: ActiveGroundEffect[] = []; const events: CombatEvent[] = []; let direct = 0, burn = 0;
  scheduleGroundEffect(effects, meteor(), { nextId: () => 1, emit: e => events.push(e) });
  const context = { player: sim.player, enemies: sim.enemies, visible: (_x: number, _y: number, x: number) => x !== hidden.x,
    damage: () => { direct++; }, emit: (e: CombatEvent) => events.push(e) };
  for (let i = 0; i < 101; i++) effects = advanceGroundEffects(effects, FIXED_STEP, context);
  assert.equal(direct, 0);
  effects = advanceGroundEffects(effects, FIXED_STEP, context);
  assert.equal(direct, 1); assert.equal(effects[0].kind, 'embers');
  const id = effects[0].id; late.x = 30;
  for (let i = 0; i < 481; i++) {
    for (const e of sim.enemies) advanceEnemyStatuses(e, FIXED_STEP, (enemy, amount) => { if (enemy === late) burn += amount; });
    effects = advanceGroundEffects(effects, FIXED_STEP, context);
    if (effects.length) assert.equal(effects[0].id, id);
  }
  assert.equal(effects.length, 0); assert.equal(direct, 1);
  assert.equal(events.filter(e => e.type === 'blast').length, 1);
  assert.ok(burn > 30 && burn < 50, `late entrant sustained burn: ${burn}`);
  assert.equal(hidden.burnTime, 0); assert.ok(target.burnTime >= 0);
});
test('afterglow snapshots its recipe and retains its reserved slot at the ground-effect cap', () => {
  const sim = new Simulation(world, { spawn: false }); const effects: ActiveGroundEffect[] = [];
  const request = meteor(); request.delay = 0; request.scorch.duration = 2; request.scorch.dps = 9;
  for (let i = 0; i < GROUND_EFFECT_RULES.maximum; i++) scheduleGroundEffect(effects, request, { nextId: () => i + 1, emit: () => {} });
  request.scorch.duration = 99; request.scorch.dps = 999;
  const result = advanceGroundEffects(effects, FIXED_STEP, { player: sim.player, enemies: [], visible: () => true, damage: () => {}, emit: () => {} });
  assert.equal(result.length, GROUND_EFFECT_RULES.maximum);
  for (const effect of result) { assert.equal(effect.kind, 'embers'); assert.equal(effect.duration, 2); assert.equal(effect.burn?.dps, 9); }
});
test('meteor visual descent ends at its exact target and keeps light positions finite', () => {
  const effect: ActiveGroundEffect = { ...meteor(), id: 1, tick: 0, pulsesLeft: 1, initialDelay: .85 };
  let y = -Infinity;
  for (const remaining of [.85, .6, .3, .01, 0]) {
    effect.delay = remaining; const pose = meteorPose(effect);
    assert.ok(pose.y >= y); y = pose.y;
    assert.ok([pose.x, pose.y, pose.size, pose.opacity].every(Number.isFinite));
    assert.ok(groundSpellLights(effect).length <= 2);
  }
  assert.equal(meteorPose(effect).x, effect.x); assert.equal(meteorPose(effect).y, effect.y);
});
test('enemy warning boundaries consume actual melee, ground and boss contact geometry', () => {
  const sim = new Simulation(world, { spawn: false });
  for (const kind of ['brute', 'wisp', 'warden'] as const) {
    const e = sim.spawnEnemy(kind, 0, 0)!; e.state = 'windup'; e.stateDuration = 1; e.stateTime = .5;
    if (kind === 'warden') e.bossMove = 'fracture';
    const w = enemyWarnings(e);
    if (kind === 'brute') { const d = ENEMY_DEFINITIONS.brute; assert.equal(d.attack, 'melee'); if (d.attack === 'melee') assert.deepEqual(w[0].shape, { kind: 'sector', radius: d.range, arc: d.arc }); }
    if (kind === 'wisp') { const d = ENEMY_DEFINITIONS.wisp; assert.equal(d.attack, 'ground'); if (d.attack === 'ground') assert.deepEqual(w[0].shape, { kind: 'circle', radius: d.blastRadius }); }
    if (kind === 'warden') { assert.equal(w.length, 3); assert.deepEqual(w[0].shape, { kind: 'lane', length: WARDEN_RULES.fractureLength, width: WARDEN_RULES.fractureWidth }); }
    e.state = 'dead'; assert.equal(enemyWarnings(e).length, 0);
  }
});
test('Meteor impact throws stone and embers through the existing shared fragment budget', () => {
  const materials = new MaterialResponses();
  materials.handle({ type: 'blast', groundKind: 'meteor', skill: 'meteor', style: 'fire', x: 0, y: 0, radius: 125 });
  assert.deepEqual(materials.bursts.map(b => b.material), ['stone', 'ember']);
  assert.ok(materials.fragmentCount <= 384);
});
