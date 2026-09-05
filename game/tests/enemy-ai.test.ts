import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import { ENEMY_AI_RULES, ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import type { Enemy, Input, WorldQuery } from '../src/model.ts';

const open: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const idle: Input = { moveX: 0, moveY: 0, aimX: 300, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
function advance(sim: Simulation, seconds: number): void {
  for (let tick = 0; tick < Math.round(seconds / FIXED_STEP); tick++) sim.update(FIXED_STEP, idle);
}
function engaged(sim: Simulation, kind: Enemy['kind'], x: number, y = 0): Enemy {
  const enemy = sim.spawnEnemy(kind, x, y)!;
  enemy.state = 'chase'; enemy.awareness = 1;
  advance(sim, FIXED_STEP); assert.equal(enemy.state, 'windup'); return enemy;
}

test('unaware enemies patrol their home instead of knowing the player through distance or walls', () => {
  const distant = new Simulation(open, { spawn: false }), sentinel = distant.spawnEnemy('archer', 650, 0)!;
  advance(distant, 5);
  assert.equal(sentinel.state, 'patrol'); assert.equal(sentinel.awareness, 0);
  assert.ok(Math.hypot(sentinel.x - sentinel.homeX, sentinel.y - sentinel.homeY) <= ENEMY_AI_RULES.patrolRadius + 1);
  assert.equal(distant.projectiles.length, 0);
  let closed = true;
  const world = { ...open, blocked: (x: number) => closed && x > 45 && x < 55 };
  const hidden = new Simulation(world, { spawn: false }), foe = hidden.spawnEnemy('stalker', 100, 0)!;
  advance(hidden, 2); assert.equal(foe.awareness, 0); assert.equal(foe.state, 'patrol');
  closed = false; advance(hidden, .5);
  assert.equal(foe.awareness, 1); assert.ok(['chase', 'windup'].includes(foe.state));
});

test('lost sight and the home tether cancel pursuit, return safely, and do not reset health or grant rewards', () => {
  let wall = false;
  const world: WorldQuery = {
    blocked: (x, y) => wall && x >= -35 && x <= -25 && Math.abs(y) < 45,
    move: (x, y, dx, dy, radius) => wall && x + dx + radius >= -35 && x - radius <= -25 && Math.abs(y + dy) < 45
      ? { x, y: y + dy } : { x: x + dx, y: y + dy },
  };
  const sim = new Simulation(world, { spawn: false }), foe = sim.spawnEnemy('stalker', -100, 0)!;
  foe.hp = 19; foe.x = foe.prevX = -55; foe.state = 'chase'; foe.awareness = 1;
  foe.lastSeenX = 0; foe.lastSeenY = 0; wall = true;
  advance(sim, 5);
  assert.ok(['return', 'idle', 'patrol'].includes(foe.state));
  assert.ok(foe.x <= -45, 'a returning enemy cannot cross the wall');
  assert.equal(foe.hp, 19); assert.equal(sim.kills, 0); assert.equal(sim.player.xp, 0);
  wall = false;
  foe.x = foe.prevX = foe.homeX + ENEMY_AI_RULES.tetherDistance + 20;
  sim.player.x = foe.x + 70; foe.state = 'chase'; foe.awareness = 1; foe.lostSightTime = 0;
  advance(sim, FIXED_STEP); assert.equal(foe.state, 'return');
  const before = foe.x; advance(sim, .2); assert.ok(foe.x < before, 'return commits toward home even while the player remains nearby');
});

test('a ranged hit alerts its victim and visible camp allies without waking unrelated groups', () => {
  const sim = new Simulation(open, { spawn: false });
  const victim = sim.spawnEnemy('brute', 450, 0)!, ally = sim.spawnEnemy('stalker', 500, 60)!, stranger = sim.spawnEnemy('stalker', 520, -50)!;
  victim.campId = ally.campId = 'one'; stranger.campId = 'two';
  sim.projectiles.push({ id: 999, sourceLevel: 1, x: 430, y: 0, prevX: 430, prevY: 0, vx: 1000, vy: 0,
    angle: 0, radius: 5, damage: 2, life: 1, maxLife: 1, owner: 'player', hitIds: new Set() });
  advance(sim, FIXED_STEP);
  assert.equal(victim.awareness, 1); assert.equal(ally.awareness, 1); assert.equal(stranger.awareness, 0);
  assert.equal(victim.state, 'chase'); assert.equal(ally.state, 'chase');
});

test('an archer locks its shot during anticipation then sidesteps during recovery', () => {
  const sim = new Simulation(open, { spawn: false }), archer = engaged(sim, 'archer', -200);
  advance(sim, ENEMY_DEFINITIONS.archer.aimLock + .05);
  const angle = archer.attackAngle; sim.player.y = sim.player.prevY = 130;
  advance(sim, .7);
  const arrow = sim.projectiles.find(projectile => projectile.sourceKind === 'archer');
  assert.ok(arrow); assert.equal(arrow.effects?.style, 'arrow'); assert.equal(arrow.angle, angle);
  assert.equal(archer.attackTargetY, 0, 'aim is not rewritten after its visible lock');
  const x = archer.x, y = archer.y;
  advance(sim, .2); assert.ok(Math.hypot(archer.x - x, archer.y - y) > 1);
  assert.equal(sim.player.hp, sim.player.maxHp, 'moving off the committed lane avoids its arrow');
});

test('a wisp ground mark stays fixed long enough to escape and lands only one damage event', () => {
  for (const escape of [false, true]) {
    const sim = new Simulation(open, { spawn: false }), wisp = engaged(sim, 'wisp', -200);
    advance(sim, .35); assert.equal(wisp.attackTargetX, 0); assert.equal(wisp.attackTargetY, 0);
    if (escape) sim.player.y = sim.player.prevY = 110;
    advance(sim, 1.2);
    assert.equal(wisp.attackTargetY, 0);
    assert.equal(sim.player.hp, sim.player.maxHp - (escape ? 0 : wisp.damage));
    const events = sim.drainEvents();
    assert.equal(events.filter(event => event.type === 'blast' && event.enemyKind === 'wisp').length, 1);
    assert.equal(events.filter(event => event.type === 'hurt').length, escape ? 0 : 1);
  }
});

test('a wisp cannot detonate through a new obstacle or a sanctuary after its aim locks', () => {
  let sheltered = false, wall = false;
  const world: WorldQuery = { ...open, isSanctuary: x => sheltered && x > -20,
    blocked: x => wall && x >= -110 && x <= -100 };
  for (const mode of ['wall', 'sanctuary']) {
    sheltered = wall = false;
    const sim = new Simulation(world, { spawn: false }); engaged(sim, 'wisp', -200);
    advance(sim, .4); if (mode === 'wall') wall = true; else sheltered = true;
    advance(sim, 1); assert.equal(sim.player.hp, sim.player.maxHp);
  }
});

test('hound pounces commit to their advertised lane, move continuously, and respect solid collision', () => {
  const sim = new Simulation(open, { spawn: false }), hound = engaged(sim, 'hound', -100);
  advance(sim, .3); sim.player.y = sim.player.prevY = 85;
  const locked = hound.attackAngle;
  advance(sim, .4); assert.equal(hound.state, 'attack');
  const x = hound.x; advance(sim, .1);
  assert.ok(hound.x - x > 25 && hound.x - x < 33, 'pounce covers its lane over ticks, not a teleport');
  assert.equal(hound.attackAngle, locked); assert.equal(sim.player.hp, sim.player.maxHp);
  const wall: WorldQuery = { blocked: x => x >= -40 && x <= -30,
    move: (x, y, dx, dy, radius) => ({ x: x < -40 ? Math.min(-40 - radius, x + dx) : x + dx, y: y + dy }) };
  const blocked = new Simulation(wall, { spawn: false }), leaper = blocked.spawnEnemy('hound', -100, 0)!;
  leaper.state = 'attack'; leaper.attackAngle = 0; leaper.stateDuration = .28;
  advance(blocked, .28); assert.ok(leaper.x + leaper.radius <= -40);
  assert.equal(blocked.player.hp, blocked.player.maxHp);
});

test('pack support positions spread attackers and preserve two pack plus one special attack slots', () => {
  const sim = new Simulation(open, { spawn: false }); sim.player.hp = sim.player.maxHp = 10000;
  for (const [index, kind] of (['stalker', 'hound', 'stalker', 'hound', 'brute', 'archer', 'wisp', 'caster'] as const).entries()) {
    const angle = index * Math.PI / 4, radius = kind === 'hound' ? 100 : kind === 'stalker' ? 30 : kind === 'brute' ? 55 : 190;
    sim.spawnEnemy(kind, Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  for (let tick = 0; tick < 1200; tick++) {
    sim.update(FIXED_STEP, idle);
    const active = sim.enemies.filter(enemy => enemy.state === 'windup' || enemy.state === 'attack');
    assert.ok(active.filter(enemy => ENEMY_DEFINITIONS[enemy.kind].attackGroup === 'pack').length <= 2);
    assert.ok(active.filter(enemy => ENEMY_DEFINITIONS[enemy.kind].attackGroup === 'special').length <= 1);
  }
  assert.ok(sim.enemies.every(enemy => Number.isFinite(enemy.x) && Number.isFinite(enemy.y)));
});

test('ranged roles retreat before starting a new shot when pressured inside their standoff distance', () => {
  for (const kind of ['archer', 'caster', 'wisp'] as const) {
    const sim = new Simulation(open, { spawn: false }), enemy = sim.spawnEnemy(kind, -80, 0)!;
    enemy.awareness = 1; enemy.state = 'chase';
    advance(sim, .2);
    assert.equal(enemy.state, 'chase', kind);
    assert.ok(Math.hypot(enemy.x, enemy.y) > 85, `${kind} makes space before another telegraph`);
    assert.equal(sim.projectiles.length, 0); assert.equal(sim.player.hp, sim.player.maxHp);
  }
});
