import test from 'node:test';
import assert from 'node:assert/strict';
import { canAfford, creditGold, goldBalance, spendGold } from '../src/wallet.ts';
import { advanceGold, dropGold, GOLD_RULES, rollEnemyGold, type GroundGold } from '../src/gold.ts';
import { initialPlayer, Simulation, FIXED_STEP } from '../src/simulation.ts';
import { RewardFeedback } from '../src/reward-feedback.ts';
import type { CombatEvent, Input, WorldQuery } from '../src/model.ts';
const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const pile = (amount = 10, x = 0): GroundGold => ({ id: 900, x, y: 0, amount, age: 0 });
const idle: Input = { moveX: 0, moveY: 0, aimX: 45, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };

test('wallet supports exact atomic credits and purchases and rejects invalid/overdrawn/overflowing amounts', () => {
  const wallet = {}; assert.equal(goldBalance(wallet), 0); assert.ok(creditGold(wallet, 42));
  assert.ok(canAfford(wallet, 42)); assert.ok(spendGold(wallet, 12)); assert.equal(goldBalance(wallet), 30);
  for (const n of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(creditGold(wallet, n), false); assert.equal(spendGold(wallet, n), false);
  }
  assert.equal(spendGold(wallet, 31), false); assert.equal(goldBalance(wallet), 30);
  assert.equal(creditGold(wallet, Number.MAX_SAFE_INTEGER), false); assert.equal(goldBalance(wallet), 30);
  assert.ok(spendGold(wallet, 30)); assert.equal(goldBalance(wallet), 0);
});

test('gold rolls are repeatable, partial for normal enemies, richer by rank and scale with source level', () => {
  let dropped = 0, normal = 0, elite = 0;
  for (let seed = 0; seed < 10_000; seed++) {
    const amount = rollEnemyGold(seed, 1, 'normal'); dropped += Number(amount > 0); normal += amount;
    assert.equal(amount, rollEnemyGold(seed, 1, 'normal'));
    assert.equal(rollEnemyGold(seed, 11, 'normal'), amount * 2);
    const precious = rollEnemyGold(seed, 1, 'elite'); assert.ok(precious >= 35 && precious <= 65); elite += precious;
  }
  assert.ok(dropped > 5200 && dropped < 5800); assert.ok(elite > normal * 8);
});

test('coins settle, magnetize and credit once, regardless of a full inventory', () => {
  const player = initialPlayer(0, 0), events: CombatEvent[] = [];
  player.character.inventory.fill(player.character.equipped.weapon!);
  let piles = [pile(17, 75)];
  piles = advanceGold(piles, player, world, .2, e => events.push(e));
  assert.equal(piles[0].x, 75); assert.equal(goldBalance(player.character), 0);
  for (let i = 0; i < 120; i++) piles = advanceGold(piles, player, world, 1 / 120, e => events.push(e));
  assert.equal(piles.length, 0); assert.equal(goldBalance(player.character), 17);
  assert.equal(events.length, 1); assert.deepEqual(events[0], { type: 'gold', x: events[0].x, y: 0, amount: 17, balance: 17 });
});

test('walls, distance and death prevent pickup; uncollected coins do not expire', () => {
  const player = initialPlayer(0, 0), events: CombatEvent[] = [];
  const wall: WorldQuery = { ...world, blocked: () => true };
  for (const state of ['wall', 'far', 'dead']) {
    player.dead = state === 'dead'; const initial = pile(10, state === 'far' ? 120 : 10);
    const piles = advanceGold([initial], player, state === 'wall' ? wall : world, 600, e => events.push(e));
    assert.equal(piles.length, 1); assert.equal(piles[0].x, initial.x);
  }
  assert.equal(goldBalance(player.character), 0); assert.equal(events.length, 0);
});

test('ground budget merges value without growing indefinitely or destroying earlier piles', () => {
  const piles = Array.from({ length: GOLD_RULES.maxPiles }, (_, id) => ({ ...pile(), id: id + 1, x: id * 10 }));
  dropGold(piles, { ...pile(25, 12), id: 400 });
  assert.equal(piles.length, GOLD_RULES.maxPiles); assert.equal(piles[1].amount, 35);
  assert.equal(piles.reduce((sum, p) => sum + p.amount, 0), GOLD_RULES.maxPiles * 10 + 25);
});

test('kill awards XP immediately, drops uncredited gold, then collecting awards exactly once', () => {
  const sim = new Simulation(world, { spawn: false });
  const enemy = sim.spawnEnemy('stalker', 45, 0, 'elite')!;
  enemy.hp = 1; enemy.state = 'idle'; enemy.stateDuration = 999;
  for (let i = 0; i < 30; i++) sim.update(FIXED_STEP, { ...idle, attack: true });
  const events = sim.drainEvents();
  assert.equal(sim.kills, 1); assert.equal(events.filter(e => e.type === 'experience').length, 1);
  assert.equal(goldBalance(sim.player.character), 0); assert.equal(sim.groundGold.length, 1);
  const amount = sim.groundGold[0].amount;
  for (let i = 0; i < 180; i++) sim.update(FIXED_STEP, idle);
  assert.equal(goldBalance(sim.player.character), amount); assert.equal(sim.groundGold.length, 0);
  assert.equal(sim.drainEvents().filter(e => e.type === 'gold').length, 1);
  sim.reset(); assert.equal(goldBalance(sim.player.character), 0);
});

test('reward feedback aggregates bursts, catches up at any frame rate, expires, and stays bounded', () => {
  const events: CombatEvent[] = Array.from({ length: 1000 }, (_, i) => ({ type: 'gold', amount: 10, balance: (i + 1) * 10, x: 1, y: 2 }));
  const a = new RewardFeedback(), b = new RewardFeedback();
  for (const f of [a, b]) { f.update(0, 0, false); f.handleEvents(events, false); assert.equal(f.gold.amount, 10000); assert.equal(f.motes.length, 96); }
  for (let i = 0; i < 60; i++) a.update(10000, 1 / 60, false);
  for (let i = 0; i < 120; i++) b.update(10000, 1 / 120, false);
  assert.ok(Math.abs(a.balance - b.balance) < 1e-6);
  a.update(10000, 5, false); assert.equal(a.balance, 10000); assert.equal(a.gold.remaining, 0); assert.equal(a.motes.length, 0);
  a.handleEvents([{ type: 'experience', amount: 20, x: 0, y: 0 }], true);
  assert.equal(a.experience.amount, 20); assert.equal(a.motes.length, 0);
  a.update(500, 0, true); assert.equal(a.balance, 500);
  a.reset(); assert.equal(a.experience.remaining, 0); assert.equal(a.gold.amount, 0);
});
