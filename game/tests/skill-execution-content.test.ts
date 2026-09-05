import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILL_EXECUTION, groundEffectPulseCount, skillDamageSuffix, skillUtilityLabel } from '../src/skill-execution-content.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { scheduleGroundEffect, advanceGroundEffects, type ActiveGroundEffect, type GroundEffectRequest } from '../src/ground-effects.ts';
import { Simulation } from '../src/simulation.ts';
import type { CombatEvent } from '../src/model.ts';

test('every skill has immutable finite execution content and numeric UI reads its recipe', () => {
  assert.deepEqual(Object.keys(SKILL_EXECUTION).sort(), Object.keys(SKILL_DEFINITIONS).sort());
  const verify = (value: unknown): void => {
    if (typeof value === 'number') assert.ok(Number.isFinite(value));
    if (value && typeof value === 'object') {
      assert.ok(Object.isFrozen(value));
      for (const child of Object.values(value)) verify(child);
    }
  };
  verify(SKILL_EXECUTION);
  assert.equal(skillUtilityLabel('bulwark'), `${SKILL_EXECUTION.bulwark.duration}s guard`);
  assert.equal(skillDamageSuffix('volley'), ' / arrow');
  assert.equal(skillDamageSuffix('rainOfArrows'), ' / wave');
  assert.equal(skillDamageSuffix('meteor'), '');
  assert.ok(SKILL_DEFINITIONS.arcLightning.description.includes(String(SKILL_EXECUTION.arcLightning.jumps)));
  assert.ok(SKILL_DEFINITIONS.rainOfArrows.description.includes(String(groundEffectPulseCount(SKILL_EXECUTION.rainOfArrows))));
});

test('scheduled ground attacks snapshot burn and damage, and cannot hit unseen targets', () => {
  const sim = new Simulation({ blocked: () => false, move: (x, y) => ({ x, y }) }, { spawn: false });
  const near = sim.spawnEnemy('brute', 20, 0)!, hidden = sim.spawnEnemy('brute', 25, 0)!;
  const events: CombatEvent[] = [], effects: ActiveGroundEffect[] = [];
  const burn = { duration: 3, dps: 5 };
  const request: GroundEffectRequest = { kind: 'meteor', skill: 'meteor', x: 0, y: 0, radius: 50,
    delay: .05, duration: 0, interval: 1, damage: 12, style: 'fire', burn };
  scheduleGroundEffect(effects, request, { nextId: () => 1, emit: event => events.push(event) });
  request.damage = 500; burn.duration = 10; burn.dps = 500; request.radius = 1000;
  const result = advanceGroundEffects(effects, .1, {
    enemies: sim.enemies, visible: (_ax, _ay, bx) => bx !== hidden.x,
    damage: (enemy, amount) => { enemy.hp -= amount; }, emit: event => events.push(event),
  });
  assert.equal(near.hp, near.maxHp - 12); assert.equal(hidden.hp, hidden.maxHp);
  assert.equal(near.burnTime, 3); assert.equal(near.burnDps, 5); assert.equal(hidden.burnTime, 0);
  assert.equal(result.length, 0); assert.deepEqual(events.map(event => event.type), ['ground', 'blast']);
  const blast = events.find(event => event.type === 'blast')!; assert.equal(blast.radius, 50);
});
