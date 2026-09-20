import assert from 'node:assert/strict';
import test from 'node:test';
import { potionPresentation, potionTooltipMarkup } from '../src/potion-presentation.ts';
import { FIXED_STEP, Simulation } from '../src/simulation.ts';
import type { Input, WorldQuery } from '../src/model.ts';

const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const drink: Input = { moveX: 0, moveY: 0, aimX: 100, aimY: 0, attack: false, dodge: false, heal: true, skillSlot: null };

test('potion tooltip recovery and reuse time agree with actual drinking, including bonuses', () => {
  for (const [potency, cooldown] of [[1, 1], [1.25, .75], [2, .25]]) {
    const sim = new Simulation(world, { spawn: false });
    const p = sim.player;
    p.derived.potionMultiplier = potency; p.derived.cooldownMultiplier = cooldown;
    p.derived.lifeRegeneration = 0; p.derived.manaRegeneration = 0;
    p.hp = 1; p.mana = 0;
    const view = potionPresentation(p);
    sim.update(FIXED_STEP, drink);
    const event = sim.drainEvents().find(e => e.type === 'potion');
    assert.ok(event && event.type === 'potion');
    assert.ok(Math.abs(event.life / p.maxHp * 100 - view.lifePercent) < 1e-8);
    assert.ok(Math.abs(event.mana / p.maxMana * 100 - view.manaPercent) < 1e-8);
    assert.equal(p.healCooldown, view.cooldown);
    assert.equal(potionPresentation(p).charges, view.charges - 1);
  }
});

test('potion explanation uses current bonuses and safely renders a rebound shortcut', () => {
  const p = new Simulation(world, { spawn: false }).player;
  p.derived.potionMultiplier = 1.25;
  const html = potionTooltipMarkup(potionPresentation(p), '<Mouse4>');
  assert.ok(html.includes('52.5%') && html.includes('50%') && html.includes('+25%'));
  assert.ok(html.includes('&lt;Mouse4&gt;') && !html.includes('<Mouse4>'));
});

test('potion ring progress follows actual kill refills and survives checkpoint restoration', () => {
  let sim = new Simulation(world, { spawn: false });
  sim.player.flasks = 0;
  for (let kill = 1; kill <= 8; kill++) {
    const enemy = sim.spawnEnemy('brute', 40, 0)!;
    enemy.hp = 1; enemy.state = 'recover'; enemy.stateDuration = 999;
    sim.projectiles.push({ hitIds: new Set(), id: 9000 + kill, x: 25, y: 0, prevX: 25, prevY: 0,
      vx: 360, vy: 0, angle: 0, radius: 5, damage: 10000, life: 1, sourceLevel: 1, maxLife: 1, owner: 'player' });
    for (let step = 0; sim.kills < kill && step < 20; step++) sim.update(FIXED_STEP, { ...drink, heal: false });
    assert.equal(sim.kills, kill);
    assert.equal(sim.potionRecharge, kill < 8 ? kill / 8 : 0);
    assert.equal(sim.player.flasks, kill < 8 ? 0 : 1);
    if (kill === 5) {
      const checkpoint = sim.captureCheckpoint();
      sim = new Simulation(world, { spawn: false }); sim.restoreCheckpoint(checkpoint);
      assert.equal(sim.potionRecharge, 5 / 8);
    }
  }
});
