import assert from 'node:assert/strict';
import test from 'node:test';
import { getHUDLayout, isHUDPoint } from '../src/hud.ts';
import { HUD_ART, HUD_SKILL_SLOTS } from '../src/hud-layout.ts';

const viewports = [[240, 180], [390, 844], [540, 450], [960, 600], [1440, 900]] as const;

test('native menu shortcut bounds remain inside the HUD and block world input at every size', () => {
  for (const [width, height] of viewports) {
    const hud = getHUDLayout(width, height);
    assert.ok(hud.scale > 0 && hud.x >= 0 && hud.y >= 0);
    assert.ok(hud.x + hud.width <= width && hud.y + hud.height <= height);
    for (const shortcut of hud.shortcuts) {
      assert.ok(shortcut.width > 0 && shortcut.height > 0);
      assert.ok(shortcut.x >= hud.x && shortcut.y >= hud.y);
      assert.ok(shortcut.x + shortcut.width <= hud.x + hud.width);
      assert.ok(shortcut.y + shortcut.height <= hud.y + hud.height);
      for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1], [.5, .5]]) {
        assert.equal(isHUDPoint(shortcut.x + shortcut.width * u, shortcut.y + shortcut.height * v, width, height),
          true, `${shortcut.label} hit target at ${u},${v} must not attack through the menu (${width}×${height})`);
      }
    }
  }
});

test('resource orbs, action tray and resource readouts block world input after responsive scaling', () => {
  // Broad interior samples describe functional areas, not individual ornamental edges.
  const occupied = [
    ['left orb', 61, 79], ['right orb', 459, 79],
    ['basic attack', 153, 94], ['empty skill', 211, 94], ['empty skill', 297, 94], ['empty skill', 365, 94],
    ['health readout', 61, 131], ['mana readout', 459, 131],
    ['XP rail', 260, 145], ['level', 160, 159], ['current XP', 358, 159],
  ] as const;
  for (const [width, height] of viewports) {
    const hud = getHUDLayout(width, height);
    for (const [label, x, y] of occupied) {
      assert.equal(isHUDPoint(hud.x + x * hud.scale, hud.y + y * hud.scale, width, height), true,
        `${label} must not attack through visible controls (${width}×${height})`);
    }
  }
});

test('five unassigned skills and separate potion/dodge shortcuts all block world input', () => {
  assert.equal(HUD_SKILL_SLOTS.length, 6);
  assert.equal(HUD_SKILL_SLOTS.filter(slot => slot.action === null).length, 5);
  assert.deepEqual(HUD_SKILL_SLOTS.filter(slot => slot.action !== null).map(slot => slot.action), ['attack']);
  const skill = HUD_ART.skill, utility = HUD_ART.utility;
  const fields = [
    ...HUD_SKILL_SLOTS.map((slot, i) => ({ label: slot.key, x: skill.x + i * skill.step, y: skill.y,
      width: skill.width, height: skill.height })),
    { label: 'potion', x: utility.left, y: utility.y, width: utility.width, height: utility.height },
    { label: 'dodge', x: utility.right, y: utility.y, width: utility.width, height: utility.height },
  ];
  for (const [width, height] of viewports) {
    const hud = getHUDLayout(width, height);
    for (const field of fields) for (const [u, v] of [[.1, .1], [.9, .1], [.1, .9], [.9, .9], [.5, .5]]) {
      assert.equal(isHUDPoint(hud.x + (field.x + field.width * u) * hud.scale,
        hud.y + (field.y + field.height * v) * hud.scale, width, height), true,
      `${field.label} cannot attack through its visible well (${width}×${height})`);
    }
  }
});

test('open space beside the menu rail and around the HUD silhouette remains playable', () => {
  const gaps = [
    ['left of menu', .23, .15], ['right of menu', .77, .15],
    ['top left corner', .01, .01], ['top right corner', .99, .01],
    ['bottom left corner', .01, .99], ['bottom right corner', .99, .99],
    ['below action tray', .50, .99],
  ] as const;
  for (const [width, height] of viewports) {
    const hud = getHUDLayout(width, height);
    for (const [label, u, v] of gaps) {
      assert.equal(isHUDPoint(hud.x + hud.width * u, hud.y + hud.height * v, width, height), false,
        `${label} must remain available to the world (${width}×${height})`);
    }
    assert.equal(isHUDPoint(hud.x - 1, hud.y + hud.height / 2, width, height), false);
    assert.equal(isHUDPoint(hud.x + hud.width + 1, hud.y + hud.height / 2, width, height), false);
  }
});

test('curved metal supports block input while their upper and lower apertures remain open', () => {
  const samples = [
    ['tray-side metal', 394, 91, true],
    ['middle of support', 399, 89, true],
    ['orb-side metal', 405, 91, true],
    ['shoulder under orb collar', 416, 91, true],
    ['above support near tray', 393, 78, false],
    ['above curved edge', 399, 81, false],
    ['below curved edge', 399, 107, false],
    ['below support near orb', 405, 117, false],
  ] as const;
  for (const [width, height] of viewports) {
    const hud = getHUDLayout(width, height);
    for (const side of [-1, 1]) for (const [label, x, y, occupied] of samples) {
      const logicalX = side === 1 ? x : 520 - x;
      assert.equal(isHUDPoint(hud.x + logicalX * hud.scale, hud.y + y * hud.scale, width, height), occupied,
        `${label}, ${side === 1 ? 'right' : 'left'} support (${width}×${height})`);
    }
  }
});
