import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayerMovement, PLAYER_EDGE_SLIDE } from '../src/player-movement.ts';
import { WorldLandscape, type Prop } from '../src/world-landscape.ts';
import type { Building, Rect } from '../src/settlements.ts';
import type { Input, WorldQuery } from '../src/model.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { DungeonGeometry, type DungeonFloor, type Room } from '../src/dungeon.ts';
import { padStick } from '../src/gamepad-input.ts';
import { playerPose } from '../src/character-pose.ts';

class Obstacles extends WorldLandscape {
  props: Prop[] = [];
  walls: Rect[] = [];
  override getProps() { return this.props; }
  override getWildernessSites(): [] { return []; }
  override getBuildings(): Building[] {
    return [{ id: 'test', seed: 1, name: 'test', kind: 'house', x: -500, y: -500,
      width: 1000, height: 1000, door: { x: 0, y: 0, width: 30 }, walls: this.walls, furniture: [] }];
  }
}
function tree() {
  const world = new Obstacles();
  world.props = [{ id: 'tree', x: 0, y: 0, radius: 12, kind: 'deadTree', seed: 1, scale: 1 }];
  return world;
}
function walk(world: Pick<WorldQuery, 'move' | 'blocked'>, x: number, y: number,
  dx = 165 / 120, dy = 0, ticks = 120) {
  let p = { x, y };
  const movement = new PlayerMovement();
  for (let i = 0; i < ticks; i++) {
    const next = movement.move(world, p.x, p.y, dx, dy, 9, i / 120);
    assert.ok(Math.hypot(next.x - p.x, next.y - p.y) <= Math.hypot(dx, dy) + 1e-7, 'no extra speed');
    for (let sample = 1; sample <= 8; sample++) {
      assert.equal(world.blocked(p.x + (next.x - p.x) * sample / 8, p.y + (next.y - p.y) * sample / 8, 9),
        false, 'the correction path stays outside obstacles');
    }
    p = next;
  }
  return p;
}

test('cardinal walking glides past both sides of a trunk in all four directions', () => {
  for (const side of [-1, 1]) for (const offset of [10, 18, 20]) for (let direction = 0; direction < 4; direction++) {
    const angle = direction * Math.PI / 2, ux = Math.cos(angle), uy = Math.sin(angle);
    const p = walk(tree(), -60 * ux - side * offset * uy, -60 * uy + side * offset * ux,
      ux * 165 / 120, uy * 165 / 120);
    assert.ok(p.x * ux + p.y * uy > 50, `passes trunk: side ${side}, offset ${offset}, direction ${direction}`);
    assert.ok((-p.x * uy + p.y * ux) * side >= 21, 'drifts toward the nearer edge');
  }
});

test('a nearby wall end and an off-center doorway guide forward walking through', () => {
  const end = new Obstacles();
  end.walls = [{ x: 0, y: -100, width: 20, height: 100 }];
  const around = walk(end, -40, -2);
  assert.ok(around.x > 60 && around.y >= 9 - 1e-7);
  const door = new Obstacles();
  door.walls = [{ x: 0, y: -100, width: 12, height: 100 }, { x: 0, y: 30, width: 12, height: 100 }];
  const through = walk(door, -40, 4);
  assert.ok(through.x > 60 && through.y >= 9 - 1e-7 && through.y <= 21 + 1e-7);
});

test('broad walls, closed corners and gaps smaller than the player stay blocking', () => {
  for (const walls of [
    [{ x: 0, y: -100, width: 20, height: 200 }],
    [{ x: 0, y: -100, width: 20, height: 200 }, { x: -100, y: 9, width: 100, height: 20 }],
    [{ x: 0, y: -100, width: 20, height: 100 }, { x: 0, y: 16, width: 20, height: 100 }],
  ]) {
    const world = new Obstacles(); world.walls = walls;
    const p = walk(world, -40, 0);
    assert.ok(p.x <= -9);
    assert.equal(p.y, 0, 'no sideways drift with no nearby clear route');
  }
});

test('an obstacle beside the nearby edge prevents correction through it', () => {
  const world = tree();
  world.props.push({ ...world.props[0], id: 'second', x: -20, y: 35, radius: 12 });
  const p = walk(world, -60, 10);
  assert.ok(p.x < 0, 'does not force the too-small gap');
});

test('open movement, analog speed and a wall slide retain their requested motion', () => {
  const world = new Obstacles();
  assert.deepEqual(new PlayerMovement().move(world, 0, 0, 12, 16, 9, 0), { x: 12, y: 16 });
  assert.deepEqual(new PlayerMovement().move(world, 0, 0, .12, .16, 9, 0), { x: .12, y: .16 });
  world.walls = [{ x: 0, y: -100, width: 20, height: 200 }];
  const start = { x: -9, y: -50 };
  assert.deepEqual(new PlayerMovement().move(world, start.x, start.y, 1, 1, 9, 0), world.move(start.x, start.y, 1, 1, 9));
});

test('large movements cannot tunnel and invalid/zero requests never probe', () => {
  const world = tree();
  const p = new PlayerMovement().move(world, -160, 0, 400, 0, 9, 0);
  assert.ok(!world.blocked(p.x, p.y, 9));
  assert.deepEqual(p, walk(world, -160, 0, 4, 0, 100), 'long moves use the same safe short steps');
  const noQueries = { move: () => { throw Error('unexpected move'); }, blocked: () => { throw Error('unexpected query'); } };
  for (const [dx, dy, radius] of [[0, 0, 9], [Infinity, 0, 9], [5000, 0, 9], [1, 0, -1], [1, 0, NaN]])
    assert.deepEqual(new PlayerMovement().move(noQueries, 0, 0, dx, dy, radius, 0), { x: 0, y: 0 });
});

test('dungeon room/corridor collision supports the same doorway assistance', () => {
  const room = (id: number, x: number, y: number, width: number, height: number): Room => ({
    id, x, y, width, height, kind: 'combat',
    outline: [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }],
  });
  const floor: DungeonFloor = { seed: 1, rooms: [room(0, -200, -100, 200, 200), room(1, 30, -100, 200, 200)],
    corridors: [room(2, 0, 0, 30, 30)], edges: [], members: [], entry: { x: -100, y: 0 },
    exit: { x: 100, y: 0 }, chests: [] };
  const p = walk(new DungeonGeometry(floor), -40, 4);
  assert.ok(p.x > 60 && p.y >= 9 - 1e-7 && p.y <= 21 + 1e-7);
});

const input: Input = { moveX: 1, moveY: 0, aimX: 200, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };

function countedWall() {
  const geometry = new Obstacles();
  const wall = { x: 0, y: -100, width: 20, height: 200 };
  geometry.walls = [wall];
  const calls = { move: 0, blocked: 0 };
  const world: WorldQuery = {
    move: (...args) => { calls.move++; return geometry.move(...args); },
    blocked: (...args) => { calls.blocked++; return geometry.blocked(...args); },
  };
  return { world, calls, wall };
}

test('a held wall reuses failed searches but still checks ordinary collision every tick', () => {
  const { world, calls } = countedWall(), movement = new PlayerMovement();
  movement.move(world, -9, 0, 1, 0, 9, 0);
  assert.ok(calls.move > 10, 'first contact actually searches for an edge');
  calls.move = calls.blocked = 0;
  for (let i = 1; i < 15; i++) {
    assert.deepEqual(movement.move(world, -9, 0, 1 + i / 50, 0, 9, i / 120), { x: -9, y: 0 });
  }
  assert.equal(calls.move, 14, 'acceleration does not restart the same geometric search');
  assert.equal(calls.blocked, 0, 'no extra assistance probes during the cached interval');
  calls.move = 0;
  movement.move(world, -9, 0, 1, 0, 9, PLAYER_EDGE_SLIDE.failedSearchRetry);
  assert.ok(calls.move > 10, 'periodically retries instead of retaining a failure forever');
});

test('position, direction, radius, world and clock changes invalidate failed searches', () => {
  for (const change of ['position', 'direction', 'radius', 'world', 'clock', 'clear', 'zero'] as const) {
    const original = countedWall(), replacement = countedWall(), movement = new PlayerMovement();
    movement.move(original.world, -10, 0, 2, 0, 9, 1);
    original.calls.move = replacement.calls.move = 0;
    if (change === 'clear') movement.clear();
    if (change === 'zero') movement.move(original.world, -10, 0, 0, 0, 9, 1.01);
    movement.move(change === 'world' ? replacement.world : original.world, -10, change === 'position' ? .5 : 0,
      2, change === 'direction' ? .1 : 0, change === 'radius' ? 9.5 : 9, change === 'clock' ? .9 : 1.01);
    assert.ok(original.calls.move + replacement.calls.move > 1, `${change} must search again`);
  }
});

test('small controller variations reuse failures while retaining ordinary collision checks', () => {
  for (const jitter of [.001, .01]) {
    const { world, calls } = countedWall();
    const sim = new Simulation(world, { spawn: false, startX: -9, startY: 0 });
    for (let tick = 0; tick < 240; tick++) {
      const stick = padStick(.8, tick % 2 ? jitter : -jitter);
      sim.update(FIXED_STEP, { ...input, moveX: stick.x, moveY: stick.y });
      assert.ok(!world.blocked(sim.player.x, sim.player.y, sim.player.radius));
    }
    assert.ok(calls.move >= 240 && calls.move < 1000, `bounded searches with controller variation ${jitter}: ${calls.move}`);
    assert.equal(sim.player.x, -9);
  }
});

test('cache tolerances stay anchored to the original failure during gradual movement or turning', () => {
  for (const change of ['position', 'heading']) {
    const { world, calls } = countedWall(), movement = new PlayerMovement();
    movement.move(world, -9, 0, 1, 0, 9, 0);
    calls.move = 0;
    for (let i = 1; i <= 2; i++) {
      movement.move(world, -9, change === 'position' ? .1 * i : 0,
        1, change === 'heading' ? Math.tan(i * .8 * Math.PI / 180) : 0, 9, .01 * i);
    }
    assert.equal(calls.move, 2, 'small cumulative changes still reuse the initial failure');
    calls.move = 0;
    movement.move(world, -9, change === 'position' ? .3 : 0,
      1, change === 'heading' ? Math.tan(2.4 * Math.PI / 180) : 0, 9, .03);
    assert.ok(calls.move > 1, `${change} leaves the original tolerance region`);
  }
});

test('ordinary movement sees newly cleared ground immediately, even with a cached failure', () => {
  const { world, wall } = countedWall(), movement = new PlayerMovement();
  movement.move(world, -9, 0, 1, 0, 9, 0);
  wall.x = 100;
  assert.deepEqual(movement.move(world, -9, 0, 1, 0, 9, .01), { x: -8, y: 0 });
});

test('clearing or expiring a failure discovers a newly opened side route', () => {
  for (const clear of [true, false]) {
    const { world, wall } = countedWall(), movement = new PlayerMovement();
    movement.move(world, -9, 0, 1, 0, 9, 0);
    wall.height = 100;
    assert.equal(movement.move(world, -9, 0, 1, 0, 9, .01).y, 0);
    if (clear) movement.clear();
    const p = movement.move(world, -9, 0, 1, 0, 9, clear ? .02 : PLAYER_EDGE_SLIDE.failedSearchRetry);
    assert.ok(p.y > 0, 'new side route is immediately usable after invalidation');
  }
});

test('simulation release, relocation and reset discard a failed search', () => {
  for (const action of ['release', 'relocate', 'reset']) {
    const { world, wall } = countedWall();
    const sim = new Simulation(world, { spawn: false, startX: -9, startY: 0 });
    sim.update(FIXED_STEP, input);
    assert.equal(sim.player.y, 0);
    wall.height = 100;
    if (action === 'release') sim.update(FIXED_STEP, { ...input, moveX: 0 });
    else if (action === 'relocate') sim.relocate(-9, 0);
    else sim.reset();
    sim.update(FIXED_STEP, input);
    assert.ok(sim.player.y > 0, action);
  }
});

test('a container break invalidates a held-wall failure before the retry timer expires', () => {
  const { world, wall } = countedWall();
  const target = { id: 'edge-crate', kind: 'crate' as const, x: 0, y: 20, radius: 12, seed: 1 };
  let broken = false;
  world.getContainers = () => broken ? [] : [target];
  world.setBrokenContainers = ids => { broken = ids.has(target.id); wall.height = broken ? 100 : 200; };
  const sim = new Simulation(world, { spawn: false, startX: -9, startY: 0 });
  sim.update(FIXED_STEP, input);
  sim.projectiles.push({ id: 999, x: -5, y: 20, prevX: -5, prevY: 20, vx: 600, vy: 0,
    angle: 0, radius: 3, damage: 20, life: 1, maxLife: 1, owner: 'player', sourceLevel: 1,
    hitIds: new Set(), effects: { style: 'arrow' } });
  sim.update(FIXED_STEP, input);
  assert.ok(sim.brokenContainers.has(target.id));
  sim.update(FIXED_STEP, input);
  assert.ok(sim.player.y > 0, 'held movement immediately discovers the opened side route');
  assert.ok(sim.time < PLAYER_EDGE_SLIDE.failedSearchRetry);
});

test('simulation assists walking, leaves dodge on its original path, and stops assisting on release', () => {
  const walking = new Simulation(tree(), { spawn: false, seed: 42 });
  walking.player.x = -60; walking.player.y = 18;
  for (let i = 0; i < 120; i++) walking.update(FIXED_STEP, input);
  assert.ok(walking.player.x > 50 && walking.player.y >= 21);
  const dodge = new Simulation(tree(), { spawn: false, seed: 42 });
  dodge.player.x = -25; dodge.player.y = 18;
  dodge.player.dodgeAngle = 0; dodge.player.dodgeTime = .2;
  for (let i = 0; i < 12; i++) dodge.update(FIXED_STEP, input);
  assert.equal(dodge.player.y, 18);
  const released = new Simulation(tree(), { spawn: false, seed: 42 });
  released.player.x = -12; released.player.y = 18; released.player.vx = 165;
  for (let i = 0; i < 30; i++) released.update(FIXED_STEP, { ...input, moveX: 0 });
  assert.equal(released.player.y, 18);
  assert.equal(released.player.vx, 0);
});

test('slide poses follow actual displacement while input velocity keeps its original heading', () => {
  const { world, wall } = countedWall(); wall.height = 100;
  const sim = new Simulation(world, { spawn: false, startX: -9, startY: -2 });
  for (let tick = 0; tick < 60; tick++) {
    const before = { x: sim.player.x, y: sim.player.y };
    sim.update(FIXED_STEP, input);
    const dx = sim.player.x - before.x, dy = sim.player.y - before.y, pose = playerPose(sim.player, sim.time);
    assert.ok(Math.abs(pose.moveAngle! - Math.atan2(dy, dx)) < 1e-9);
    assert.ok(Math.abs(pose.moving - Math.min(1, Math.hypot(dx, dy) / FIXED_STEP / 130)) < 1e-9);
    assert.equal(sim.player.vy, 0, 'presentation cannot feed correction back into input smoothing');
    if (tick === 0) {
      assert.equal(dx, 0); assert.ok(dy > 0);
      assert.equal(pose.moveAngle, Math.PI / 2, 'perpendicular correction animates in the actual direction');
    }
  }
});

test('blocked, stopped, reset and restored players have no stale locomotion pose', () => {
  const { world, wall } = countedWall();
  const sim = new Simulation(world, { spawn: false, startX: -9, startY: 0 });
  sim.update(FIXED_STEP, input);
  assert.ok(sim.player.vx > 0);
  assert.equal(playerPose(sim.player, sim.time).moving, 0, 'pressing against a wall does not animate walking');
  wall.x = 100;
  sim.update(FIXED_STEP, input);
  assert.ok(playerPose(sim.player, sim.time).moving > 0);
  const saved = sim.captureCheckpoint();
  assert.ok(!('locomotionVX' in saved) && !('locomotionVY' in saved), 'locomotion is transient');
  sim.clearInput();
  assert.equal(playerPose(sim.player, sim.time).moving, 0);
  sim.restoreCheckpoint(saved);
  assert.equal(playerPose(sim.player, sim.time).moving, 0);
  sim.update(FIXED_STEP, input);
  sim.relocate(-50, 0);
  assert.equal(playerPose(sim.player, sim.time).moving, 0);
  sim.update(FIXED_STEP, input);
  sim.reset();
  assert.equal(playerPose(sim.player, sim.time).moving, 0);
});

test('dash and dodge poses follow their resolved travel without changing their control velocities', () => {
  for (const action of ['dash', 'dodge']) {
    const geometry = new Obstacles(), sim = new Simulation(geometry, { spawn: false });
    if (action === 'dash') sim.player.dash = { angle: Math.PI / 2, speed: 300, remaining: .1,
      damage: 0, radius: 9, skill: 'lunge', hitIds: new Set() };
    else { sim.player.dodgeAngle = Math.PI / 2; sim.player.dodgeTime = .1; }
    sim.update(FIXED_STEP, { ...input, moveX: 0 });
    const pose = playerPose(sim.player, sim.time);
    assert.ok(Math.abs(pose.moveAngle! - Math.PI / 2) < 1e-9);
    assert.equal(pose.moving, 1);
    if (action === 'dash') assert.equal(sim.player.vy, 0, 'dashes keep their separate movement owner');
    else assert.ok(sim.player.vy > 0);
  }
});
