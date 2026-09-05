import assert from 'node:assert/strict';
import test from 'node:test';
import { getHUDLayout, isHUDPoint } from '../src/hud.ts';

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
    ['left orb', .10, .48], ['right orb', .90, .48],
    ['basic attack', .30, .60], ['spell', .43, .60], ['dodge', .57, .60], ['flask', .70, .60],
    ['health readout', .10, .90], ['mana readout', .90, .90],
  ] as const;
  for (const [width, height] of viewports) {
    const hud = getHUDLayout(width, height);
    for (const [label, u, v] of occupied) {
      assert.equal(isHUDPoint(hud.x + hud.width * u, hud.y + hud.height * v, width, height), true,
        `${label} must not attack through visible controls (${width}×${height})`);
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
