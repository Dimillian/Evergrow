import assert from 'node:assert/strict';
import test from 'node:test';
import { getHUDLayout, isHUDPoint } from '../src/hud.ts';
import { HUD_ART, HUD_SKILL_SLOTS } from '../src/hud-layout.ts';
import { weaponIconFit } from '../src/hud-weapon-icon.ts';
import { WEAPON_PROFILES } from '../src/weapon-content.ts';
import { weaponShapes } from '../src/weapon-shapes.ts';

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
    ['left orb', HUD_ART.orb.left, HUD_ART.orb.y], ['right orb', HUD_ART.orb.right, HUD_ART.orb.y],
    ['basic attack', 153, 94], ['empty skill', 211, 94], ['empty skill', 297, 94], ['empty skill', 365, 94],
    ['health readout', HUD_ART.orb.left, HUD_ART.orb.readoutY], ['mana readout', HUD_ART.orb.right, HUD_ART.orb.readoutY],
    ['menu', 260, 47], ['potion key', 149, 37], ['dodge key', 365, 37],
    ['XP rail', 260, HUD_ART.experience.y + 4], ['level', 160, HUD_ART.experience.y + 18], ['current XP', 358, HUD_ART.experience.y + 18],
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

test('energy wisps leave open space playable while the closer orb collars block input', () => {
  const samples = [
    ['gap beside skill tray', 390, 94, false],
    ['current beneath collar', 397, 127, false],
    ['gap below square skill plate', 368, 114, false],
    ['orb collar', 410, 97, true],
    ['readout shelf', 446, 131, true],
  ] as const;
  for (const [width, height] of viewports) {
    const hud = getHUDLayout(width, height);
    for (const side of [-1, 1]) for (const [label, x, y, occupied] of samples) {
      const logicalX = side === 1 ? x : 520 - x;
      assert.equal(isHUDPoint(hud.x + logicalX * hud.scale, hud.y + y * hud.scale, width, height), occupied,
        `${label}, ${side === 1 ? 'right' : 'left'} side (${width}×${height})`);
    }
  }
});


test('square skill wells reduce the shared HUD height without a separate binding row', () => {
  assert.equal(HUD_ART.skill.width, HUD_ART.skill.height);
  assert.ok(HUD_ART.height <= 150);
  assert.ok(HUD_ART.skill.y + HUD_ART.skill.height < HUD_ART.experience.y);
});


test('all equipped silhouettes fill the basic lens without clipping, including short wands', () => {
  for (const weapon of WEAPON_PROFILES) {
    const fit = weaponIconFit(weapon.visual), size = HUD_ART.skill.width - 7;
    const points = weaponShapes(weapon.visual).flatMap(shape => shape.points.map(([x, y]) => [
      ((x + y) / Math.SQRT2 - fit.x) * size / fit.span,
      ((y - x) / Math.SQRT2 - fit.y) * size / fit.span,
    ]));
    const extent = Math.max(...points.flat().map(Math.abs));
    assert.ok(Math.abs(extent - size / 2) < .001, `${weapon.id} should fill and remain inside the lens`);
    assert.ok(points.flat().every(Number.isFinite));
    if (weapon.family === 'wand') assert.ok(size / fit.span > .66, 'short wands must grow beyond the old world scale');
  }
});
