import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { activeBuffs } from '../src/active-buffs.ts';
import { primeSpellweave, consumeSpellweave, advanceAffixBuffs } from '../src/affix-combat.ts';
import { SKILL_TREE } from '../src/skill-tree.ts';
import { skillTooltipMarkup } from '../src/skill-tree-tooltip.ts';
import { generateItem } from '../src/items.ts';
import { refreshCharacter } from '../src/character.ts';
const world = { blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const make = () => new Simulation(world, { spawn: false }).player;

test('buff projection follows priming, whole-action consumption and expiry without changing the player', () => {
  const p = make();
  primeSpellweave(p, true); assert.deepEqual(activeBuffs(p), []);
  p.derived.spellweavePercent = 20;
  primeSpellweave(p, true); primeSpellweave(p, false, 'fire');
  const before = JSON.stringify(p.affixBuffs);
  assert.deepEqual(activeBuffs(p).map(b => [b.id,b.remaining,b.duration]), [['weave-spell',4,4],['weave-melee',4,4]]);
  assert.equal(JSON.stringify(p.affixBuffs), before);
  assert.equal(consumeSpellweave(p, 'spell'), 1.2);
  assert.equal(p.affixBuffs?.spent?.kind, 'spell');
  const spent = p.affixBuffs!.spent;
  assert.equal(consumeSpellweave(p, 'spell'), 1); assert.equal(p.affixBuffs!.spent, spent);
  assert.deepEqual(activeBuffs(p).map(b => b.id), ['weave-melee']);
  advanceAffixBuffs(p, 4.1); assert.deepEqual(activeBuffs(p), []);
  assert.equal(p.affixBuffs!.spent!.remaining, 0);
});

test('Borrowed Flame alone displays its real bonus and dead/ineligible players have no stale weave icons', () => {
  const p = make(); p.character.allocatedNodes.push('keystone:borrowed-flame');
  primeSpellweave(p, true); assert.match(activeBuffs(p)[0].summary, /\+40%/);
  p.character.allocatedNodes = ['origin']; assert.deepEqual(activeBuffs(p), []);
  p.derived.spellweavePercent = 20; p.dead = true; assert.deepEqual(activeBuffs(p), []);
});

test('ward capacity, independent stances and depleted charges project only useful effects', () => {
  const p = make(); p.character.equipped.weapon = generateItem(40, 1, 'weapon', 'cinder-wand', 'common');
  p.character.equipped.offhand = null; refreshCharacter(p);
  p.skillEffects = { echoes: [], ward: { remaining: 2, capacity: 17 }, brace: { remaining: 1, reduction: .2, charges: 0, bonus: 0 }, shelters: { smokeVeil: { remaining: .5, reduction: .3 } } };
  const buffs = activeBuffs(p);
  assert.equal(buffs.find(b=>b.id==='runicWard')?.summary, 'Absorbs 17 damage.');
  assert.equal(buffs.find(b=>b.id==='brace')?.summary, '20% less hit damage.');
  assert.equal(buffs.find(b=>b.id==='smokeVeil')?.remaining, .5);
  p.skillEffects.ward!.capacity = 0; assert.ok(!activeBuffs(p).some(b=>b.id==='runicWard'));
  p.character.equipped.weapon = generateItem(40, 1, 'weapon', 'longsword', 'common'); refreshCharacter(p);
  assert.ok(!activeBuffs(p).some(b=>b.id==='runicWard'));
});

test('every Spellweave bonus explains activation in hover markup; mana-only steps do not claim to enable it', () => {
  for (const node of SKILL_TREE.nodes.filter(n => n.bonuses.spellweavePercent)) {
    const markup = skillTooltipMarkup(node, { allocated: new Set(), reachable: new Set(), routes: new Map() });
    assert.match(markup, /Enables/); assert.match(markup, /data-ui-term="spellweave"/);
  }
  for (const node of SKILL_TREE.nodes.filter(n => n.name.startsWith('Spellweave ·'))) {
    assert.equal(node.bonuses.spellweavePercent, undefined);
    assert.match(node.description, /endpoint enables/);
  }
});
