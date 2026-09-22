import test from 'node:test';
import assert from 'node:assert/strict';
import { MenuBackdrop } from '../src/menu-backdrop.ts';
import type { GamePhase } from '../src/game-phase.ts';

test('inventory and vendor menus retain one world presentation across 600 UI frames', () => {
  for (const phase of ['character', 'service'] as const) {
    const backdrop = new MenuBackdrop(); let world = 0, postfx = 0, ui = 0;
    for (let frame = 0; frame < 600; frame++) {
      backdrop.render(phase, () => { world++; postfx++; return false; });
      ui++;
    }
    assert.deepEqual({ world, postfx, ui }, { world: 1, postfx: 1, ui: 600 });
  }
});

test('playing, held maps and all other phases keep their ordinary render cadence', () => {
  const phases: GamePhase[] = ['playing', 'map', 'ready', 'paused', 'dead', 'skills', 'event', 'journeys', 'chronicle'];
  for (const phase of phases) {
    const backdrop = new MenuBackdrop(); let draws = 0;
    backdrop.render('character', () => false);
    for (let frame = 0; frame < 120; frame++) backdrop.render(phase, () => { draws++; return false; });
    assert.equal(draws, 120, phase);
  }
});

test('equipment, resize and restoration invalidations each refresh the retained scene once', () => {
  const backdrop = new MenuBackdrop(); let draws = 0;
  const draw = () => { draws++; return false; };
  backdrop.render('character', draw);
  for (let change = 1; change <= 3; change++) {
    backdrop.invalidate();
    backdrop.render('character', draw);
    backdrop.render('character', draw);
    assert.equal(draws, change + 1);
  }
});

test('switching and reopening menus cannot reuse the preceding scene', () => {
  const backdrop = new MenuBackdrop(); let draws = 0;
  const draw = () => { draws++; return false; };
  for (const phase of ['character', 'service', 'playing', 'character'] as const) backdrop.render(phase, draw);
  assert.equal(draws, 4);
});

test('streamed terrain keeps drawing until the final full-quality frame', () => {
  const backdrop = new MenuBackdrop(); let draws = 0;
  for (let frame = 0; frame < 100; frame++) {
    backdrop.render('character', () => { draws++; return frame < 12; });
  }
  assert.equal(draws, 13, 'the settled frame must be presented before retaining it');
});

test('a failed refreshed draw remains eligible for retry', () => {
  const backdrop = new MenuBackdrop();
  backdrop.render('character', () => false);
  backdrop.invalidate();
  assert.throws(() => backdrop.render('character', () => { throw new Error('draw failed'); }));
  let draws = 0;
  backdrop.render('character', () => { draws++; return false; });
  assert.equal(draws, 1);
});
