import { HUD_ART } from '../src/hud-layout.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Simulation } from '../src/simulation.ts';
import { INVENTORY_SKILL_BINDINGS, inventorySkillPickerMarkup, inventoryHUDLayout } from '../src/inventory-skills.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
import { resolveSkill } from '../src/skill-progression.ts';

const make = () => new Simulation({ blocked: () => false, move: (x, y) => ({ x, y }) }, { spawn: false }).player;

test('fresh inventory offers five bindings and an empty-state route to unlock skills', () => {
  const player = make(), before = structuredClone(player);
  assert.deepEqual(INVENTORY_SKILL_BINDINGS.map(slot => slot.key), ['RMB', '1', '2', '3', '4']);
  for (let slot = 0; slot < 5; slot++) {
    const markup = inventorySkillPickerMarkup(player, slot);
    assert.match(markup, /No unlocked skills yet/);
    assert.match(markup, /data-skill-details/);
    assert.match(markup, /data-assign-skill="" disabled/);
    assert.doesNotMatch(markup, /data-assign-skill="[a-z]/);

  }
  assert.deepEqual(player, before, 'rendering never changes character state');
});

test('picker includes incompatible unlocked skills with shared costs and excludes locked skills', () => {
  const player = make();
  player.character.allocatedNodes.push('skill:fireball', 'skill:cleave');
  player.character.skillRanks.fireball = 5;
  player.derived.manaCostMultiplier = .8;
  const markup = inventorySkillPickerMarkup(player, 0);
  const cost = resolveSkill('fireball', player.derived, player.character);
  assert.ok(markup.indexOf('data-assign-skill="cleave"') < markup.indexOf('data-assign-skill="fireball"'));
  assert.match(markup, /data-assign-skill="fireball" aria-pressed="false"/);
  assert.match(markup, /Requires Staff or wand/i);
  assert.ok(markup.includes(`${cost.mana} mana`));
  assert.doesNotMatch(markup, /data-assign-skill="meteor"/);
});

test('picker reflects reassignment and clearing without resetting cooldowns or resources', () => {
  const player = make(); player.character.allocatedNodes.push('skill:fireball');
  player.skillCooldowns.fireball = .6; player.hp = 30; player.mana = 20;
  executeCharacterCommand(player, { type: 'assignSkill', slot: 0, skill: 'fireball' });
  assert.match(inventorySkillPickerMarkup(player, 4), /← RMB/);
  assert.ok(executeCharacterCommand(player, { type: 'assignSkill', slot: 4, skill: 'fireball' }).ok);
  assert.match(inventorySkillPickerMarkup(player, 4), /data-assign-skill="fireball" aria-pressed="true"/);

  assert.equal(player.character.skillSlots[0], null);
  assert.equal(player.character.skillSlots[4], 'fireball');
  assert.ok(executeCharacterCommand(player, { type: 'assignSkill', slot: 4, skill: null }).ok);
  assert.match(inventorySkillPickerMarkup(player, 4), /data-assign-skill="" disabled/);
  assert.equal(player.skillCooldowns.fireball, .6); assert.equal(player.hp, 30); assert.equal(player.mana, 20);
});


test('docked HUD stays inside its compact footer and its hit targets match the square artwork', () => {
  for (const [width, height] of [[1200, 116], [1038, 106], [342, 106], [700, 108]]) {
    const { hud, slots } = inventoryHUDLayout(width, height);
    assert.equal(slots.length, 5);
    assert.ok(hud.scale > 0 && hud.scale <= HUD_ART.maxScale);
    assert.ok(hud.x >= 0 && hud.x + HUD_ART.width * hud.scale <= width);
    assert.ok(hud.y + 12 * hud.scale >= 0, 'orb crest remains visible');
    assert.ok(hud.y + HUD_ART.inventory.height * hud.scale <= height, 'readouts remain in footer');
    for (const [slot, rect] of slots.entries()) {
      assert.equal(rect.width, rect.height, 'square interaction target');
      assert.equal(rect.x, hud.x + (HUD_ART.skill.x + (slot + 1) * HUD_ART.skill.step) * hud.scale);
      assert.equal(rect.y, hud.y + HUD_ART.inventory.skillY * hud.scale);
      assert.ok(rect.y > 0 && rect.y + rect.height < height);
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width);
    }
  }
});
