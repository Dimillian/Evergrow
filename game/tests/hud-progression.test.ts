import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { getMinimapRect, getProgressionShortcutRects } from '../src/map-view.ts';
import { isGameUIPoint } from '../src/ui-hit-test.ts';

const css = registerHooks({ load(url, context, next) {
  if (url.endsWith('?raw')) return { format: 'module', source: `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true };
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { GameShell } = await import('../src/game-shell.ts');
css.deregister();

test('progression shortcuts fit beside the minimap and block combat only while navigation is visible', () => {
  for (const [width, height] of [[240, 400], [390, 844], [540, 450], [960, 600], [1440, 900]]) {
    const map = getMinimapRect(width, height);
    const shortcuts = getProgressionShortcutRects(width, height);
    assert.deepEqual(shortcuts.map(s => s.id), ['character', 'skills']);
    for (const rect of shortcuts) {
      assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width < map.x && rect.y + rect.height <= height);
      for (const [u, v] of [[0, 0], [1, 1], [.5, .5]]) {
        const x = rect.x + rect.width * u, y = rect.y + rect.height * v;
        assert.equal(isGameUIPoint(x, y, width, height), true);
        assert.equal(isGameUIPoint(x, y, width, height, null, false), false);
      }
    }
    const [first, second] = shortcuts;
    assert.ok(first.x + first.width < second.x || first.y + first.height < second.y);
  }
});

test('point cues update independently and disappear as soon as the last points are spent', () => {
  const button = () => {
    const classes = new Set<string>(), attrs = new Map<string, string>();
    const badge = { hidden: true, textContent: '' };
    return { classes, attrs, badge, dataset: {} as Record<string, string>,
      classList: { toggle(name: string, on: boolean) { if (on) classes.add(name); else classes.delete(name); } },
      setAttribute(name: string, value: string) { attrs.set(name, value); }, querySelector: () => badge };
  };
  const character = button(), skills = button();
  let drawerPoints: number[] = [];
  const shell = Object.assign(Object.create(GameShell.prototype), {
    progressionPoints: [0, 0], gamepadActive: false,
    controls: { querySelector: (selector: string) => selector.includes('character') ? character : skills },
    shortcutMenu: { setPoints: (...points: number[]) => { drawerPoints = points; } },
  }) as InstanceType<typeof GameShell>;
  shell.setProgressionPoints(5, 2);
  assert.ok(character.classes.has('has-points') && skills.classes.has('has-points'));
  assert.equal(character.badge.textContent, '5'); assert.equal(skills.badge.textContent, '2');
  assert.equal(character.attrs.get('aria-label'), 'Character · 5 attribute points available');
  shell.setProgressionPoints(0, 125);
  assert.equal(character.classes.has('has-points'), false); assert.equal(character.badge.hidden, true);
  assert.equal(skills.badge.textContent, '99+');
  assert.equal(skills.attrs.get('aria-label'), 'Skill atlas · 125 skill points available');
  assert.deepEqual(drawerPoints, [0, 125]);
  shell.setProgressionPoints(0, 0);
  assert.equal(skills.classes.has('has-points'), false); assert.equal(skills.badge.hidden, true);
  assert.equal(skills.attrs.get('aria-label'), 'Skill atlas');
});
