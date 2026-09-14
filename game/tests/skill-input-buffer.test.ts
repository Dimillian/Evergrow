import test from 'node:test';
import assert from 'node:assert/strict';
import { GameInput } from '../src/game-input.ts';
import { Simulation } from '../src/simulation.ts';
import { generateUnique } from '../src/items.ts';
import { WEAPON_PROFILES } from '../src/weapon-content.ts';
import type { Input, WorldQuery } from '../src/model.ts';

const world: WorldQuery = { blocked: () => false, move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }) };
const idle: Input = { moveX: 0, moveY: 0, aimX: 100, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
const dt = 1 / 120;
function fixture() {
  const sim = new Simulation(world, { spawn: false, startX: 0, startY: 0 });
  const p = sim.player;
  p.equipment = { mainHand: WEAPON_PROFILES.find(w => w.family === 'staff')!, offHand: null };
  p.character.allocatedNodes = ['origin', 'skill:fireball', 'skill:meteor', 'skill:cataclysm'];
  p.character.skillSlots = ['fireball', 'meteor', 'cataclysm', null, null];
  p.mana = p.maxMana = 10000;
  const events: ReturnType<Simulation['drainEvents']> = [];
  const tick = (input: Partial<Input> = {}) => { sim.update(dt, { ...idle, ...input }); events.push(...sim.drainEvents()); };
  const advance = (seconds: number, input: Partial<Input> = {}) => { for (let i = 0; i < Math.ceil(seconds / dt); i++) tick(input); };
  const casts = (skill: string) => events.filter(e => e.type === 'cast' && e.skill === skill).length;
  return { sim, p, tick, advance, casts };
}

for (const [slot, skill] of [[1, 'meteor'], [2, 'cataclysm']] as const) {
  test(`${skill} queues once through spell recovery while moving and holding right-click`, () => {
    const f = fixture(), input = new GameInput();
    const tick = () => f.tick(input.consume({ x: 100, y: 0 }, false));
    input.keyDown('KeyD'); input.pointerDown(2); tick();
    assert.ok(f.p.castTime > .11);
    const recovery = f.p.castTime;
    input.keyDown(slot === 1 ? 'Digit1' : 'Digit2'); tick();
    input.keyUp(slot === 1 ? 'Digit1' : 'Digit2');
    for (let i = 0; i < Math.ceil((recovery + .05) / dt); i++) tick();
    assert.equal(f.casts(skill), 1);
    assert.ok(f.p.x > 0, 'movement continues during casting');
    input.pointerUp(2); f.advance(1);
    assert.equal(f.casts(skill), 1, 'one press commits once');
  });
}

test('a pressed skill takes priority over held basics after their existing recovery', () => {
  const f = fixture(); f.tick({ attack: true });
  const attack = f.p.attack!;
  assert.ok(attack.duration - attack.elapsed > .11);
  f.tick({ attack: true, skillSlot: 1 });
  f.advance(.12, { attack: true });
  assert.equal(f.casts('meteor'), 0, 'does not interrupt the current action');
  f.advance(attack.duration, { attack: true });
  assert.equal(f.casts('meteor'), 1);
});

test('a more recent explicit press replaces the one pending skill', () => {
  const f = fixture(); f.tick({ skillSlot: 0 });
  const recovery = f.p.castTime;
  f.tick({ skillSlot: 1 }); f.tick({ skillSlot: 2 }); f.advance(recovery + .1);
  assert.equal(f.casts('meteor'), 0); assert.equal(f.casts('cataclysm'), 1);
});

test('ordinary movement does not postpone a ready cast', () => {
  const f = fixture(); f.advance(.2, { moveX: 1 });
  f.tick({ moveX: 1, skillSlot: 1 }); assert.equal(f.casts('meteor'), 1);
});

test('a queued skill cannot linger until a long cooldown or missing mana recovers', () => {
  for (const reason of ['cooldown', 'mana']) {
    const f = fixture(); f.tick({ skillSlot: 0 }); const recovery = f.p.castTime;
    if (reason === 'cooldown') f.p.skillCooldowns.meteor = 4;
    else f.p.mana = 0;
    f.tick({ skillSlot: 1 }); f.advance(recovery + .2);
    f.p.mana = f.p.maxMana; f.p.skillCooldowns.meteor = 0; f.advance(.2);
    assert.equal(f.casts('meteor'), 0, reason);
  }
});

for (const clear of ['clearInput', 'clearCombatInput'] as const) {
  test(`${clear} cancels the pending cast across pause or UI changes`, () => {
    const f = fixture(); f.tick({ skillSlot: 0 }); const recovery = f.p.castTime;
    f.tick({ skillSlot: 1 }); f.sim[clear](); f.advance(recovery + .2);
    assert.equal(f.casts('meteor'), 0);
  });
}


test('a skill press survives a dodge already in progress', () => {
  const f = fixture(); f.tick({ dodge: true, moveX: 1 });
  assert.ok(f.p.dodgeTime > .11);
  f.tick({ skillSlot: 1 }); f.advance(.35);
  assert.equal(f.casts('meteor'), 1);
});

test('held right-click cannot keep an unaffordable queued press alive', () => {
  const f = fixture(); f.tick({ skillSlot: 0 }); const recovery = f.p.castTime;
  f.p.mana = 0; f.tick({ skillSlot: 1 });
  f.advance(recovery + .2, { skillSlot: 0, skillPressed: false });
  f.p.mana = f.p.maxMana; f.advance(.2);
  assert.equal(f.casts('meteor'), 0);
});

test('Dervish Grasp channel repeats yield to a newly pressed skill', () => {
  const f = fixture();
  f.p.equipment = { mainHand: WEAPON_PROFILES.find(w => w.family === 'sword')!, offHand: null };
  f.p.character.equipped.gloves = generateUnique(42, 25, 'dervish-grasp');
  f.p.character.allocatedNodes = ['origin', 'skill:whirlwind', 'skill:cleave'];
  f.p.character.skillSlots = ['whirlwind', 'cleave', null, null, null];
  f.tick({ skillSlot: 0, heldSkillSlots: [0] });
  const recovery = f.p.attack!.duration;
  f.tick({ skillSlot: 1, heldSkillSlots: [0, 1] });
  f.advance(recovery + .05, { heldSkillSlots: [0] });
  assert.equal(f.p.attack?.skill, 'cleave');
});
