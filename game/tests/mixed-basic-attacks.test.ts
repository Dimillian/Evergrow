import test from 'node:test';
import type { Attack } from '../src/model.ts';
import assert from 'node:assert/strict';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { generateItem } from '../src/items.ts';
import { refreshCharacter } from '../src/character.ts';
import { basicAttackWeapon, basicAttackManaCost, deriveAttackStats } from '../src/equipment.ts';
import { basicBoltTip } from '../src/projectile-launch.ts';
import { playerPose } from '../src/character-pose.ts';
import { getPlayerSwordTip, playerMotion } from '../src/character-motion.ts';
const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const idle = { moveX: 0, moveY: 0, aimX: 300, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
function hybrid(reverse = false) {
  const sim = new Simulation(world, { spawn: false }), p = sim.player;
  p.character.equipped.weapon = generateItem(11, 1, 'weapon', reverse ? 'cinder-wand' : 'longsword', 'common');
  p.character.equipped.offhand = generateItem(12, 1, 'weapon', reverse ? 'longsword' : 'cinder-wand', 'common');
  refreshCharacter(p); p.derived.manaRegeneration = 0;
  return sim;
}
for (const reverse of [false, true]) test(`mixed basics alternate one action per click in ${reverse ? 'wand/sword' : 'sword/wand'} order`, () => {
  const sim = hybrid(reverse), p = sim.player;
  for (let click = 0; click < 4; click++) {
    const weapon = basicAttackWeapon(p), mana = p.mana;
    const expected = deriveAttackStats(p.stats, weapon);
    const rangedAim = { x: 0, y: 300 };
    sim.update(FIXED_STEP, { ...idle, rangedAim, attack: true });
    const attack = p.attack!; assert.ok(attack); assert.equal(attack.hand, click % 2 ? 'off' : 'main');
    assert.equal(attack.weapon.id, weapon.id); assert.equal(attack.damage, expected.damage);
    assert.equal(attack.duration, 1 / expected.attacksPerSecond);
    assert.equal(p.mana, mana - basicAttackManaCost(weapon, p.derived));
    if (weapon.attackKind === 'bolt') assert.ok(Math.abs(attack.angle - Math.PI / 2) < 1e-6);
    const pose = playerPose(p, sim.time, attack, attack.activeStart);
    if (attack.hand === 'off' && weapon.attackKind === 'bolt') {
      assert.notDeepEqual(playerMotion(pose).offArm.hand, playerMotion({ ...pose, attack: 0 }).offArm.hand);
      assert.deepEqual(playerMotion(pose).weaponArm.hand, playerMotion({ ...pose, attack: 0 }).weaponArm.hand);
    }
    for (let i = 0; i < Math.ceil(attack.duration / FIXED_STEP) + 20; i++) sim.update(FIXED_STEP, idle);
    assert.equal(p.attack, null, 'releasing one click never starts the second hand');
    const events = sim.drainEvents();
    assert.equal(events.filter(e => e.type === 'swing').length, weapon.attackKind === 'melee' ? 1 : 0);
    assert.equal(events.filter(e => e.type === 'cast').length, weapon.attackKind === 'bolt' ? 1 : 0);
    const launch = events.find(e => e.type === 'cast');
    if (launch?.type === 'cast' && launch.launch) {
      const snapshotPose = playerPose(p, launch.launch.time, attack, attack.activeStart);
      assert.deepEqual(basicBoltTip(launch.launch), getPlayerSwordTip(snapshotPose));
      assert.equal(launch.launch.hand, attack.hand);
    }
  }
});
test('holding attack repeats sequentially; an unaffordable wand turn does not fire or skip to a free swing', () => {
  const sim = hybrid(), p = sim.player; let previous = p.attack; const hands: string[] = [];
  for (let tick = 0; tick < 250; tick++) {
    sim.update(FIXED_STEP, { ...idle, attack: true });
    if (p.attack && p.attack !== previous) hands.push(p.attack.hand);
    previous = p.attack;
  }
  assert.ok(hands.length >= 3); assert.ok(hands.every((hand, i) => hand === (i % 2 ? 'off' : 'main')));
  const dry = hybrid(); dry.player.mana = 0;
  for (let tick = 0; tick < 180; tick++) dry.update(FIXED_STEP, { ...idle, attack: true });
  assert.equal(dry.player.attack, null); assert.equal(dry.player.nextAttackHand, 'off');
  assert.equal(dry.drainEvents().filter(e => e.type === 'swing').length, 1);
  dry.player.mana = 2; dry.update(FIXED_STEP, { ...idle, attack: true });
  assert.equal((dry.player.attack as Attack | null)?.hand, 'off'); assert.equal(dry.player.mana, 0);
});
