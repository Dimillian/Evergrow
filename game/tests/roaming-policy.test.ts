import test from 'node:test';
import assert from 'node:assert/strict';
import { RoamingEncounters, roamingSpawnAnchor, shouldRetireRoamer } from '../src/roaming-encounters.ts';
import { isSpawnHidden } from '../src/spawn-visibility.ts';
import { Simulation } from '../src/simulation.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import type { WorldQuery } from '../src/model.ts';

test('exploration and elapsed time are both required, and blocked placement preserves earned travel', () => {
  const planner = new RoamingEncounters(); planner.reset(0, 0);
  planner.resolved(3, () => 0); planner.advance({ x: 0, y: 0 }, 1);
  planner.resolved(3, () => 0); planner.advance({ x: 0, y: 0 }, 1);
  planner.resolved(1, () => 0); planner.advance({ x: 0, y: 0 }, 1);
  assert.equal(planner.groupSize(8, .99), 2, 'initial group finishes the bounded warmup');
  planner.resolved(2, () => 0);
  for (let x = 32; x <= 256; x += 32) planner.advance({ x, y: 0 }, .05);
  assert.equal(planner.ready, false, 'fast travel cannot skip the encounter cooldown');
  planner.advance({ x: 256, y: 0 }, 4);
  assert.equal(planner.ready, true);
  planner.resolved(0, () => { throw new Error('Failed placement must not reroll the encounter cadence'); });
  assert.equal(planner.ready, false);
  planner.advance({ x: 256, y: 0 }, 1);
  assert.equal(planner.ready, true, 'retry retains travel credit');
  planner.resolved(1, () => 0);
  planner.advance({ x: 256, y: 0 }, 60);
  assert.equal(planner.ready, false, 'time alone cannot replenish a cleared encounter');
  planner.advance({ x: 10000, y: 0 }, 1);
  assert.equal(planner.ready, false, 'a position discontinuity cannot bank an encounter wave');
  planner.reset(10000, 0);
  assert.equal(planner.ready, true, 'a fresh run has its own initial population');
});

test('spawn anchors protect the entire loose group for portrait, ultrawide and displaced cameras', () => {
  const subject = { x: -430.5, y: 217.75 };
  const bodyRadius = Math.max(...Object.values(ENEMY_DEFINITIONS).map(enemy => enemy.radius));
  for (const [width, height] of [[400, 2000], [4000, 700], [2600, 1650]]) {
    for (const offset of [-.2, 0, .2]) {
      const view = { x: subject.x - width * (.5 + offset), y: subject.y - height * (.5 - offset), width, height };
      for (let direction = 0; direction < 32; direction++) {
        const angle = direction / 32 * Math.PI * 2;
        // Full-circle fallback deliberately exercises every edge, not just forward spawns.
        const anchor = roamingSpawnAnchor(subject, view, { x: 1, y: 0 }, () => direction / 32, 24);
        assert.ok(Number.isFinite(anchor.x) && Number.isFinite(anchor.y));
        for (let member = 0; member < 16; member++) {
          const spread = member / 16 * Math.PI * 2;
          assert.equal(isSpawnHidden(anchor.x + Math.cos(spread) * 100,
            anchor.y + Math.sin(spread) * 100, view, bodyRadius), true,
          `${width}×${height}, offset ${offset}, direction ${angle}, member ${member}`);
        }
      }
    }
  }
});

test('retirement only releases hidden inactive roamers and never interrupts pursuit or an attack', () => {
  const world: WorldQuery = { blocked: () => false, move: (x, y) => ({ x, y }) };
  const sim = new Simulation(world, { spawn: false });
  const enemy = sim.spawnEnemy('stalker', -800, 0)!;
  const player = { x: 0, y: 0, vx: 160, vy: 0 }, heading = { x: 1, y: 0 };
  const view = { x: -500, y: -350, width: 1000, height: 700 };
  enemy.state = 'patrol'; enemy.awareness = 0;
  assert.equal(shouldRetireRoamer(enemy, player, view, heading), true);
  assert.equal(shouldRetireRoamer(enemy, { ...player, vx: 0 }, view, heading), false);
  assert.equal(shouldRetireRoamer(enemy, player, { ...view, x: -900, width: 1800 }, heading), false);
  enemy.awareness = .8;
  assert.equal(shouldRetireRoamer(enemy, player, view, heading), false);
  enemy.awareness = 0;
  for (const state of ['chase', 'windup', 'attack', 'recover', 'dead'] as const) {
    enemy.state = state;
    assert.equal(shouldRetireRoamer(enemy, player, view, heading), false, state);
  }
  enemy.state = 'idle'; enemy.campId = 'retained-garrison';
  assert.equal(shouldRetireRoamer(enemy, player, view, heading), false, 'camp ledger owns its members');
});
