import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleBarks } from '../src/battle-barks.ts';
import { BARK_RULES, BATTLE_BARKS, canBark } from '../src/battle-bark-content.ts';
import { placeBattleBark, barkOverlap } from '../src/battle-bark-layout.ts';
import { EnemyEngagements } from '../src/enemy-engagement.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { alertEnemy } from '../src/enemy-state.ts';
import { BattleBarkScene } from '../src/battle-bark-scene.ts';
import { cameraView } from '../src/camera.ts';
import type { World } from '../src/world.ts';
import type { CombatEvent, EnemyKind, Input, WorldQuery } from '../src/model.ts';
import { GAME_FEATURES } from '../src/game-features.ts';
import { drawBattleBark } from '../src/battle-bark-art.ts';
import type { BarkBox } from '../src/battle-bark-layout.ts';

const edge = (id: number, time = 0, engaged = true, kind: EnemyKind = 'goblin'): CombatEvent => ({
  type: 'engagement', targetId: id, time, engaged, enemyKind: kind, x: 0, y: 0,
});
const visible = () => true;
const ids = (...values: number[]) => new Set(values);
const update = (barks: BattleBarks, time: number, living = ids(1), show = true, place = visible) =>
  barks.update(time, living, show, visible, place);
const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const idle: Input = { moveX: 0, moveY: 0, aimX: 200, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };

test('global off switch clears active and pending barks, skips RNG/placement, and never replays discarded speech', () => {
  const original = GAME_FEATURES.battleBarks;
  try {
    GAME_FEATURES.battleBarks = true;
    let rolls = 0;
    const barks = new BattleBarks(() => { rolls++; return 0; });
    barks.noteEvents([edge(1)]); update(barks, 0);
    barks.noteEvents([edge(2, 1)]);
    const before = rolls;
    GAME_FEATURES.battleBarks = false;
    barks.update(.2, ids(1, 2), true, () => { throw new Error('visibility ran while disabled'); }, () => { throw new Error('placement ran while disabled'); });
    assert.equal(barks.active.length, 0); assert.equal(barks.trackedCount, 0);
    barks.noteEvents([edge(3, .3)]); assert.equal(rolls, before);
    GAME_FEATURES.battleBarks = true;
    update(barks, .5, ids(1, 2, 3)); assert.equal(barks.active.length, 0);
    barks.noteEvents([edge(4, 1)]); update(barks, 1, ids(1, 2, 3, 4));
    assert.equal(barks.active.length, 1); assert.equal(barks.active[0].id, 4);
  } finally { GAME_FEATURES.battleBarks = original; }
});

test('global off switch bypasses runtime scene work and the shared static-review drawing', () => {
  const original = GAME_FEATURES.battleBarks;
  try {
    GAME_FEATURES.battleBarks = true;
    const { sim, c, w, scene, drawn } = sceneFixture(), view = cameraView(960, 600, 0, 0, 1);
    scene.draw(c, sim, w, view, true, [], []); drawn.length = 0;
    GAME_FEATURES.battleBarks = false;
    w.getBuildingAt = () => { throw new Error('occlusion ran while disabled'); };
    scene.draw(c, sim, w, view, true, [], []);
    drawBattleBark({} as CanvasRenderingContext2D, {} as BarkBox, 1);
    assert.equal(drawn.length, 0);
    GAME_FEATURES.battleBarks = true;
    w.getBuildingAt = () => null;
    scene.draw(c, sim, w, view, true, [], []); assert.equal(drawn.length, 0);
  } finally { GAME_FEATURES.battleBarks = original; }
});

test('seven humanoid voices each have 20 unique short lines; hounds and wisps stay silent', () => {
  assert.equal(Object.keys(BATTLE_BARKS).length, 7);
  for (const [kind, lines] of Object.entries(BATTLE_BARKS)) {
    assert.ok(canBark(kind as EnemyKind)); assert.equal(lines.length, 20); assert.equal(new Set(lines).size, 20);
    assert.ok(lines.every(line => line.trim() === line && line.length > 0 && line.length <= 30));
    assert.ok(Object.isFrozen(lines));
  }
  assert.equal(canBark('hound'), false); assert.equal(canBark('wisp'), false);
  let rolls = 0; const barks = new BattleBarks(() => { rolls++; return 0; });
  barks.noteEvents([edge(1, 0, true, 'hound'), edge(2, 0, true, 'wisp')]);
  update(barks, 0, ids(1, 2)); assert.equal(rolls, 0); assert.equal(barks.active.length, 0);
});

test('25% threshold rolls once per encounter; repeated alerts and failed rolls do not retry', () => {
  for (const [random, count] of [[.249, 1], [.25, 0], [.99, 0]]) {
    const barks = new BattleBarks(() => random);
    barks.noteEvents([edge(1)]); update(barks, 0); assert.equal(barks.active.length, count);
    for (let t = 1; t < 20; t++) { barks.noteEvents([edge(1, t)]); update(barks, t); }
    assert.equal(barks.active.length, 0, 'neither success nor failure retries during sustained combat');
  }
});

test('all populations share spacing and the hard cap, including fading speech', () => {
  const barks = new BattleBarks(() => 0), living = new Set<number>();
  for (const [id, time, kind] of [[1, 0, 'goblin'], [2, .8, 'goblinChief'], [3, 1.6, 'warden']] as const) {
    living.add(id); barks.noteEvents([edge(id, time, true, kind)]); update(barks, time, living);
  }
  assert.equal(barks.active.length, 3);
  living.add(4); barks.noteEvents([edge(4, 1.85, true, 'caster')]); update(barks, 1.85, living);
  assert.equal(barks.active.length, 3, 'fade-out still occupies a slot');
  update(barks, 2.9, living);
  assert.equal(barks.active.some(b => b.id === 4), true, 'a successful greeting can use the next free slot');
  for (let id = 5; id <= 48; id++) {
    const time = 2.5 + id * .1; living.add(id); barks.noteEvents([edge(id, time)]); update(barks, time, living);
    assert.ok(barks.active.length <= BARK_RULES.maxVisible);
    const starts = barks.active.map(b => b.started).sort((a, b) => a - b);
    assert.ok(starts.every((at, i) => i === 0 || at - starts[i - 1] >= .8 - 1e-9));
  }
});

test('simultaneous successful greetings share the opening window without roster bias', () => {
  const barks = new BattleBarks(() => 0);
  barks.noteEvents([edge(1), edge(2), edge(3)]); update(barks, 0, ids(1, 2, 3));
  assert.equal(barks.active.length, 1); assert.notEqual(barks.active[0].id, 1);
  update(barks, .8, ids(1, 2, 3)); assert.equal(barks.active.length, 2);
  update(barks, 1.6, ids(1, 2, 3)); assert.equal(barks.active.length, 3);
  update(barks, 4.5, ids(1, 2, 3)); assert.equal(barks.active.length, 0);
});

test('successful greetings survive brief obstruction but cannot appear after the admission deadline', () => {
  for (const hiddenAtStart of [true, false]) {
    const barks = new BattleBarks(() => 0); barks.noteEvents([edge(1)]);
    barks.update(0, ids(1), true, () => !hiddenAtStart, () => hiddenAtStart);
    assert.equal(barks.active.length, 0);
    update(barks, 1); assert.equal(barks.active.length, 1);
  }
  const expired = new BattleBarks(() => 0); expired.noteEvents([edge(1)]);
  expired.update(0, ids(1), true, () => false, visible);
  update(expired, BARK_RULES.admissionWindow); assert.equal(expired.active.length, 0);
});

test('temporary overlap hides active speech without restarting its lifetime or releasing its slot', () => {
  const barks = new BattleBarks(() => 0); barks.noteEvents([edge(1)]); update(barks, 0);
  update(barks, .5, ids(1), true, () => false); assert.equal(barks.active.length, 1);
  let placed = 0;
  update(barks, 1, ids(1), true, () => { placed++; return true; });
  assert.equal(placed, 1); assert.equal(barks.active[0].started, 0);
  update(barks, BARK_RULES.duration); assert.equal(barks.active.length, 0);
});

test('blocked placement retains its selected line without rolling every frame', () => {
  let rolls = 0;
  const barks = new BattleBarks(() => { rolls++; return 0; }); barks.noteEvents([edge(1)]);
  for (let frame = 0; frame < 120; frame++) update(barks, frame / 60, ids(1), true, () => false);
  assert.equal(rolls, 2, 'one encounter roll and one line choice');
  update(barks, 2); assert.equal(barks.active.length, 1);
});

test('both continuous disengagement and the per-actor attempt cooldown must elapse', () => {
  const barks = new BattleBarks(() => 0);
  barks.noteEvents([edge(1)]); update(barks, 0);
  barks.noteEvents([edge(1, 1, false), edge(1, 32)]); update(barks, 32);
  assert.equal(barks.active.length, 0, '30 seconds disengaged alone is insufficient');
  barks.noteEvents([edge(1, 33, false), edge(1, 46)]); update(barks, 46);
  assert.equal(barks.active.length, 0, '45 seconds since attempt alone is insufficient');
  barks.noteEvents([edge(1, 47, false), edge(1, 77)]); update(barks, 77);
  assert.equal(barks.active.length, 1);
});

test('last three emitted lines are avoided per archetype', () => {
  const barks = new BattleBarks(() => 0), spoken: string[] = [];
  for (let id = 1; id <= 7; id++) {
    barks.noteEvents([edge(id, id * 3)]); update(barks, id * 3, ids(id));
    const line = barks.active[0].text; assert.ok(!spoken.slice(-3).includes(line)); spoken.push(line);
  }
});

test('simulation-clock pauses freeze life; menus discard pending speech; death, return and reset clear', () => {
  const barks = new BattleBarks(() => 0); barks.noteEvents([edge(1)]); update(barks, 0);
  for (let i = 0; i < 100; i++) update(barks, .5, ids(1), false);
  update(barks, .5); assert.equal(barks.active.length, 1); assert.equal(barks.active[0].started, 0);
  barks.noteEvents([edge(2, .5)]); update(barks, .5, ids(1, 2), false);
  update(barks, 1, ids(1, 2)); assert.equal(barks.active.some(b => b.id === 2), false);
  barks.noteEvents([edge(1, 1.1, false)]); assert.equal(barks.active.length, 0);
  barks.noteEvents([edge(3, 1.2)]); update(barks, 1.2, ids(3)); assert.equal(barks.active.length, 1);
  update(barks, 1.3, ids()); assert.equal(barks.active.length, 0); assert.equal(barks.trackedCount, 0);
  barks.noteEvents([edge(4, 2)]); update(barks, 2, ids(4)); barks.reset();
  assert.equal(barks.active.length, 0); assert.equal(barks.trackedCount, 0);
  update(barks, 0, ids(4)); assert.equal(barks.active.length, 0, 'a reset never replays old events');
});

test('presentation tracks bounded current actors and never grows with a long journey', () => {
  const barks = new BattleBarks(() => .9);
  for (let i = 0; i < 1000; i++) barks.noteEvents([edge(i, i)]);
  assert.equal(barks.trackedCount, BARK_RULES.maxTracked);
  update(barks, 1000, ids()); assert.equal(barks.trackedCount, 0);
});

test('layout wraps measured text, keeps head tails attached and yields to blocked or narrow space', () => {
  const measure = (line: string) => line.length * 8, viewport = { width: 960, height: 600 }, head = { x: 480, y: 300 };
  const box = placeBattleBark('Hold still. Heavy hammer.', head, viewport, measure, [])!;
  assert.ok(box); assert.ok(box.width <= 220); assert.equal(box.tailX, head.x); assert.equal(box.tailY, head.y - 10);
  const wrapped = placeBattleBark('Let me borrow your warmth.', head, viewport, () => 210, []);
  assert.equal(wrapped, null, 'an unbreakable overwide word does not shrink');
  const twoLines = placeBattleBark('Let me borrow your warmth.', head, viewport, measure, [])!;
  assert.equal(twoLines.lines.length, 2);
  const obstacle = { x: box.x, y: box.y + box.bodyHeight - 1, width: 5, height: 2 };
  const moved = placeBattleBark('Hold still. Heavy hammer.', head, viewport, measure, [obstacle]);
  assert.ok(!moved || !barkOverlap(moved, obstacle));
  assert.equal(placeBattleBark('Die!', head, viewport, measure, [{ x: 0, y: 0, ...viewport }]), null);
  assert.equal(placeBattleBark('Die!', { x: 2, y: 5 }, viewport, measure, []), null);
  assert.equal(placeBattleBark('Heavy hammer.', head, { width: 20, height: 20 }, measure, []), null);
});

test('fixed-tick observer emits only engagement edges across attack cycles and direct alerts', () => {
  const sim = new Simulation(world, { spawn: false }), tracker = new EnemyEngagements(), events: CombatEvent[] = [];
  const enemy = sim.spawnEnemy('goblin', 200, 0)!;
  const tick = (time: number) => tracker.update(sim.enemies, time, e => events.push(e));
  tick(0); assert.equal(events.length, 0);
  alertEnemy(enemy, sim.player); tick(1); tick(2);
  enemy.state = 'windup'; tick(3); enemy.state = 'attack'; tick(4); enemy.state = 'recover'; tick(5);
  assert.equal(events.length, 1);
  enemy.state = 'return'; tick(6); enemy.state = 'idle'; tick(7);
  assert.equal(events.length, 2);
  alertEnemy(enemy, sim.player); tick(8); enemy.hp = 0; tick(9);
  assert.deepEqual(events.map(e => e.type === 'engagement' && e.engaged), [true, false, true, false]);
  tracker.reset(); enemy.hp = 1; enemy.state = 'idle'; tick(10); assert.equal(events.length, 4);
});

test('real simulation emits goblin and boss engagement without bark RNG affecting checkpoints', () => {
  const a = new Simulation(world, { spawn: false, seed: 7319 }), b = new Simulation(world, { spawn: false, seed: 7319 });
  for (const sim of [a, b]) { sim.spawnEnemy('goblin', 180, 0); sim.spawnEnemy('warden', 0, 250); sim.drainEvents(); }
  const barkA = new BattleBarks(() => 0), barkB = new BattleBarks(() => .99), kinds = new Set<EnemyKind>();
  for (let i = 0; i < 100; i++) {
    a.update(FIXED_STEP, idle); b.update(FIXED_STEP, idle);
    const ae = a.drainEvents(), be = b.drainEvents(); assert.deepEqual(ae, be);
    for (const e of ae) if (e.type === 'engagement' && e.engaged) kinds.add(e.enemyKind);
    barkA.noteEvents(ae); barkB.noteEvents(be);
    update(barkA, a.time, new Set(a.enemies.map(e => e.id))); update(barkB, b.time, new Set(b.enemies.map(e => e.id)));
  }
  assert.ok(kinds.has('goblin')); assert.ok(kinds.has('warden'));
  assert.deepEqual(a.captureCheckpoint(), b.captureCheckpoint());
});

function sceneFixture(kind: EnemyKind = 'brute') {
  const sim = new Simulation(world, { spawn: false }), enemy = sim.spawnEnemy(kind, 180, 0)!;
  alertEnemy(enemy, sim.player);
  const drawn: { value: string; font: string }[] = [];
  const context = {
    font: '', globalAlpha: 1, save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {},
    quadraticCurveTo() {}, closePath() {}, fill() {}, stroke() {}, measureText: (s: string) => ({ width: s.length * 7 }),
    fillText(value: string) { drawn.push({ value, font: this.font }); },
  };
  const c = context as unknown as CanvasRenderingContext2D;
  const w = { ...world, getBuildingAt: () => null } as unknown as World;
  const scene = new BattleBarkScene(() => 0); scene.noteEvents([edge(enemy.id, 0, true, kind)]);
  return { sim, enemy, drawn, c, w, scene };
}

test('runtime overlay admits all seven humanoids above their own bodies at different zooms with fixed text size', () => {
  for (const kind of Object.keys(BATTLE_BARKS) as (keyof typeof BATTLE_BARKS)[]) for (const zoom of [.65, 1, 1.8]) {
    const { sim, drawn, c, w, scene } = sceneFixture(kind), view = cameraView(960, 600, 0, 0, zoom);
    scene.draw(c, sim, w, view, true, [], []);
    sim.time = .2; scene.draw(c, sim, w, view, true, [], []);
    assert.ok(drawn.length > 0, `${kind} at ${zoom} must not collide with its own clearance`);
    assert.ok(drawn.every(line => line.font.startsWith('16px ')), 'camera zoom cannot scale the font');
  }
});

test('runtime overlay yields to world walls, roofs, foreground foliage and reserved HUD space', () => {
  for (const obstruction of ['wall', 'roof', 'foliage', 'HUD'] as const) {
    const { sim, drawn, c, w, scene } = sceneFixture(), view = cameraView(960, 600, 0, 0, 1);
    if (obstruction === 'wall') w.blocked = () => true;
    if (obstruction === 'roof') w.getBuildingAt = () => ({} as NonNullable<ReturnType<World['getBuildingAt']>>);
    const props = obstruction === 'foliage' ? [{ id: 'test-tree', kind: 'tree' as const, x: 180, y: 30, scale: 1, radius: 10, seed: 1 }] : [];
    const reserved = obstruction === 'HUD' ? [{ x: 0, y: 0, width: 960, height: 600 }] : [];
    scene.draw(c, sim, w, view, true, props, reserved);
    sim.time = .2; scene.draw(c, sim, w, view, true, props, reserved);
    assert.equal(drawn.length, 0, obstruction);
  }
});

test('visible speakers can bark through bare branches and foliage already faded by the renderer', () => {
  for (const kind of ['deadTree', 'charredTree', 'tree'] as const) {
    const { sim, drawn, c, w, scene } = sceneFixture(), view = cameraView(960, 600, 0, 0, 1);
    const props = [{ id: 'test-tree', kind, x: 180, y: 30, scale: 1, radius: 10, seed: 1 }];
    const opacity = kind === 'tree' ? new Map([['test-tree', .24]]) : undefined;
    scene.draw(c, sim, w, view, true, props, [], opacity);
    sim.time = .2; scene.draw(c, sim, w, view, true, props, [], opacity);
    assert.ok(drawn.length > 0, kind);
  }
});

test('runtime overlay admits recent offscreen engagement on arrival, but never leaks through menus and resets', () => {
  const { sim, drawn, c, w, scene } = sceneFixture(), view = cameraView(960, 600, 0, 0, 1);
  scene.draw(c, sim, w, cameraView(960, 600, -1500, 0, 1), true, [], []);
  sim.time = .2; scene.draw(c, sim, w, view, true, [], []);
  sim.time = .4; scene.draw(c, sim, w, view, true, [], []); assert.ok(drawn.length > 0);
  drawn.length = 0;
  scene.reset(); scene.noteEvents([edge(1, .2, true, 'brute')]);
  scene.draw(c, sim, w, view, false, [], []); sim.time = .4;
  scene.draw(c, sim, w, view, true, [], []); assert.equal(drawn.length, 0);
  scene.reset(); scene.draw(c, sim, w, view, true, [], []); assert.equal(drawn.length, 0);
});
