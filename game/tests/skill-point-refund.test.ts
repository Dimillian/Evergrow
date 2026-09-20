import test from 'node:test';
import assert from 'node:assert/strict';
import { planSkillChainRefund } from '../src/skill-respec.ts';
import { Simulation } from '../src/simulation.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { executeSkillRespec } from '../src/skill-respec-command.ts';
import { learnedSkillRank, specializationNode } from '../src/skill-progression.ts';
import { SKILL_TREE, SKILL_NODES } from '../src/skill-tree.ts';
import { buildSkillRoutes, previewSkillRoute } from '../src/skill-tree-routes.ts';
import { decodeCharacterSave, CHARACTER_SAVE_VERSION } from '../src/character-save.ts';

function setup() {
  const sim = new Simulation({ blocked: () => false, move: (x: number, y: number) => ({ x, y }) }, { spawn: false });
  const p = sim.player; p.level = 1000; p.character.skillPoints = 999; p.character.statPoints = 4995; p.character.gold = 100000;
  const command = (c: Parameters<typeof executeCharacterCommand>[1]) => executeCharacterCommand(p, c);
  const unlock = (id: string) => assert.ok(command({ type: 'allocateNode', id }).ok, id);
  const refund = (id: string) => command({ type: 'refundNode', id });
  return { sim, p, command, unlock, refund };
}

test('right-click refunds ranks one at a time, retains downcasting and removes only the final unlock/bindings/cooldown', () => {
  const { p, command, unlock, refund } = setup(); unlock('skill:fireball'); unlock('skill:cleave');
  for (let i = 0; i < 2; i++) assert.ok(command({ type: 'upgradeSkill', skill: 'fireball' }).ok);
  assert.ok(command({ type: 'configureSkill', skill: 'fireball', rank: 1, specialization: null }).ok);
  assert.ok(command({ type: 'assignSkill', skill: 'fireball', slot: 0 }).ok);
  p.skillCooldowns.fireball = 3; p.skillCooldowns.cleave = 4; p.hp = 20; p.mana = 5;
  const before = structuredClone(p);
  for (const rank of [2, 1]) {
    assert.ok(refund('skill:fireball').ok);
    assert.equal(learnedSkillRank(p.character, 'fireball'), rank);
    assert.equal(p.character.activeSkillRanks.fireball, 1); assert.equal(p.character.skillSlots[0], 'fireball');
    assert.equal(p.skillCooldowns.fireball, 3);
  }
  assert.equal(p.character.skillRanks.fireball, undefined, 'rank one uses the canonical absent purchase record');
  assert.ok(refund('skill:fireball').ok);
  assert.equal(p.character.skillSlots[0], null); assert.equal(p.skillCooldowns.fireball, undefined);
  assert.equal(p.skillCooldowns.cleave, 4); assert.equal(p.character.activeSkillRanks.fireball, undefined);
  assert.equal(p.character.skillPoints, before.character.skillPoints + 3); assert.equal(p.character.gold, before.character.gold! - 75);
  assert.equal(p.hp, 20); assert.equal(p.mana, 5); assert.deepEqual(p.character.equipped, before.character.equipped);
});

test('Origin, unowned nodes, insufficient gold and required connections fail without any mutation', () => {
  const { p, unlock, refund } = setup(); unlock('skill:fireball');
  const route = previewSkillRoute(buildSkillRoutes(new Set(['origin'])), 'skill:fireball');
  for (const id of ['origin', 'no-such-node', 'skill:cleave', route[1]]) {
    const before = structuredClone(p); assert.equal(refund(id).ok, false, id); assert.deepEqual(p, before);
  }
  p.character.gold = 24; const before = structuredClone(p);
  assert.equal(refund('skill:fireball').ok, false); assert.deepEqual(p, before);
});

test('a connected passive loop permits removing a node with multiple invested neighbors', () => {
  const { p, refund } = setup();
  p.character.allocatedNodes = SKILL_TREE.nodes.filter(n => !n.doctrine && !n.specialization && !n.keystone).map(n => n.id);
  const all = new Set(p.character.allocatedNodes);
  const canRemove = (id: string) => {
    const remaining = new Set(all); remaining.delete(id); const reached = new Set(['origin']), queue = ['origin'];
    for (let i = 0; i < queue.length; i++) for (const n of SKILL_NODES.get(queue[i])!.neighbors)
      if (remaining.has(n) && !reached.has(n)) { reached.add(n); queue.push(n); }
    return reached.size === remaining.size;
  };
  const node = SKILL_TREE.nodes.find(n => n.kind !== 'origin' && !n.skill && all.has(n.id) && n.neighbors.filter(id => all.has(id)).length > 1 && canRemove(n.id));
  assert.ok(node); assert.ok(refund(node.id).ok); assert.ok(!p.character.allocatedNodes.includes(node.id));
});

test('removing a skill with Technique leaves requires confirmation; individual Technique refunds return to Original', () => {
  const { p, unlock, refund } = setup(); unlock(specializationNode('fireball-fork'));
  const before = structuredClone(p); assert.equal(refund('skill:fireball').ok, false); assert.deepEqual(p, before);
  assert.ok(refund(specializationNode('fireball-fork')).ok); assert.equal(p.character.skillSpecializations.fireball, undefined);
  assert.ok(p.character.allocatedNodes.includes('skill:fireball')); assert.ok(refund('skill:fireball').ok);
});

test('aura rank refunds cannot overreserve mana', () => {
  const { p, command, unlock, refund } = setup();
  for (const [skill, rank] of [['ironroot', 20], ['hawkeye', 20], ['thornbound', 4]] as const) {
    unlock(`skill:${skill}`);
    for (let i = 1; i < rank; i++) assert.ok(command({ type: 'upgradeSkill', skill }).ok);
  }
  for (const [slot, skill] of (['ironroot', 'hawkeye', 'thornbound'] as const).entries()) assert.ok(command({ type: 'assignSkill', slot, skill }).ok);
  const before = structuredClone(p); assert.equal(refund('skill:thornbound').ok, false); assert.deepEqual(p, before);
});

test('single-point refunds persist a valid candidate before commitment; failure preserves live gold and build', async () => {
  const { sim, p, unlock } = setup(); unlock('skill:fireball'); unlock('skill:cleave');
  p.skillCooldowns.fireball = 3; p.skillCooldowns.cleave = 4;
  const before = structuredClone(p), command = { type: 'refundNode', id: 'skill:fireball' } as const;
  const result = await executeSkillRespec(p, command, async (character, hp, mana, skillCooldowns) => {
    assert.deepEqual(p, before); assert.equal(character.gold, before.character.gold! - 25);
    const save = { version: CHARACTER_SAVE_VERSION, id: 'refund-test', name: 'Refund test', createdAt: 1, updatedAt: 1, worldSeed: 7319, worldVersion: 10,
      checkpoint: { ...sim.captureCheckpoint(), character, hp, mana, skillCooldowns } };
    assert.ok(decodeCharacterSave(JSON.stringify(save)), 'candidate satisfies connectivity, point ledger and cooldown validation');
    return { ok: false, message: 'Disk full' };
  });
  assert.equal(result.ok, false); assert.deepEqual(p, before);
  await assert.rejects(executeSkillRespec(p, command, async () => { throw new Error('Offline'); })); assert.deepEqual(p, before);
  assert.ok((await executeSkillRespec(p, command, async () => ({ ok: true }))).ok);
  assert.equal(p.skillCooldowns.fireball, undefined); assert.equal(p.skillCooldowns.cleave, 4);
});

test('confirmed chain refunds every disconnected node and purchased rank while preserving other branches', () => {
  const { p, command, unlock, refund } = setup();
  unlock(specializationNode('fireball-fork')); unlock('skill:cleave');
  for (let i = 0; i < 3; i++) command({ type: 'upgradeSkill', skill: 'fireball' });
  command({ type: 'assignSkill', slot: 0, skill: 'fireball' }); command({ type: 'assignSkill', slot: 1, skill: 'cleave' });
  p.skillCooldowns.fireball = 3; p.skillCooldowns.cleave = 4;
  const route = previewSkillRoute(buildSkillRoutes(new Set(['origin'])), 'skill:fireball'), id = route[1];
  const before = structuredClone(p), chain = planSkillChainRefund(p.character, id)!;
  assert.ok(chain.nodeIds.includes('skill:fireball')); assert.ok(chain.nodeIds.includes(specializationNode('fireball-fork')));
  assert.ok(!chain.nodeIds.includes('skill:cleave')); assert.equal(chain.points, chain.nodeIds.length + 3);
  assert.equal(refund(id).ok, false); assert.deepEqual(p, before, 'no mutation before confirmation');
  assert.ok(command({ type: 'refundNode', id, chain }).ok);
  assert.deepEqual(p.character.allocatedNodes, before.character.allocatedNodes.filter(n => !chain.nodeIds.includes(n)));
  assert.equal(p.character.skillPoints, before.character.skillPoints + chain.points);
  assert.equal(p.character.gold, before.character.gold! - chain.points * 25);
  assert.equal(p.character.skillRanks.fireball, undefined); assert.equal(p.character.skillSpecializations.fireball, undefined);
  assert.deepEqual(p.character.skillSlots.slice(0, 2), [null, 'cleave']); assert.deepEqual(p.skillCooldowns, { cleave: 4 });
});

test('chain confirmation rejects changed nodes/ranks and unaffordable totals without partial payment or removal', () => {
  for (const changed of ['nodes', 'ranks', 'gold'] as const) {
    const { p, command, unlock } = setup(); unlock('skill:fireball');
    const id = previewSkillRoute(buildSkillRoutes(new Set(['origin'])), 'skill:fireball')[1];
    const chain = planSkillChainRefund(p.character, id)!;
    if (changed === 'nodes') unlock(specializationNode('fireball-fork'));
    if (changed === 'ranks') command({ type: 'upgradeSkill', skill: 'fireball' });
    if (changed === 'gold') p.character.gold = chain.points * 25 - 1;
    const before = structuredClone(p);
    assert.equal(command({ type: 'refundNode', id, chain }).ok, false); assert.deepEqual(p, before);
  }
});

test('confirmed chains use the durable save boundary and persist a valid refund before commitment', async () => {
  const { sim, p, command, unlock } = setup(); unlock(specializationNode('fireball-fork')); unlock('skill:cleave');
  command({ type: 'upgradeSkill', skill: 'fireball' }); p.skillCooldowns.fireball = 2; p.skillCooldowns.cleave = 3;
  const id = previewSkillRoute(buildSkillRoutes(new Set(['origin'])), 'skill:fireball')[1], chain = planSkillChainRefund(p.character, id)!;
  const before = structuredClone(p);
  const result = await executeSkillRespec(p, { type: 'refundNode', id, chain }, async (character, hp, mana, skillCooldowns) => {
    assert.deepEqual(p, before);
    assert.equal(character.gold, before.character.gold! - chain.points * 25);
    assert.ok(decodeCharacterSave(JSON.stringify({ version: CHARACTER_SAVE_VERSION, id: 'chain-test', name: 'Chain test', createdAt: 1, updatedAt: 1,
      worldSeed: 7319, worldVersion: 10, checkpoint: { ...sim.captureCheckpoint(), character, hp, mana, skillCooldowns } })));
    return { ok: false, message: 'Disk full' };
  });
  assert.equal(result.ok, false); assert.deepEqual(p, before);
});
