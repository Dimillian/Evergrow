import assert from 'node:assert/strict';
import test from 'node:test';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { SKILL_ICON_RECIPES } from '../src/skill-icon-content.ts';
import { skillIconDrawing, skillIconSVG } from '../src/skill-icon.ts';

test('every active skill has bounded immutable glass geometry and distinct small-size art', () => {
  assert.deepEqual(Object.keys(SKILL_ICON_RECIPES).sort(), Object.keys(SKILL_DEFINITIONS).sort());
  const small = new Set<string>();
  for (const { id } of Object.values(SKILL_DEFINITIONS)) {
    const compact = skillIconDrawing(id, false), detailed = skillIconDrawing(id, true);
    assert.ok(Object.isFrozen(compact)); assert.ok(compact.length > 2 && detailed.length <= 240, id);
    assert.ok(detailed.length > compact.length);
    assert.equal(compact.filter(op => op.halo).length, 1);
    assert.ok(compact.some(op => op.clip), id); assert.ok(compact.some(op => op.surface), id);
    for (const op of detailed) {
      assert.ok(Object.isFrozen(op) && Object.isFrozen(op.transform));
      assert.ok(op.transform.every(Number.isFinite)); assert.ok(op.opacity > 0 && op.opacity <= 1);
      assert.doesNotMatch(op.path, /NaN|undefined|Infinity/);
    }
    small.add(JSON.stringify(compact));
  }
  assert.equal(small.size, Object.keys(SKILL_DEFINITIONS).length);
});

test('repeated inline icons keep their paints local and clamp dimensions', () => {
  const first = skillIconSVG('fireball', 32), second = skillIconSVG('fireball', 32);
  const ids = (svg: string) => [...svg.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
  assert.ok(ids(first).length > 0);
  assert.ok(ids(first).every(id => !ids(second).includes(id)));
  for (const svg of [first, second]) for (const [, id] of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids(svg).includes(id));
  assert.match(skillIconSVG('bulwark', NaN), /width="36"/);
  assert.match(skillIconSVG('bulwark', -1), /width="8"/);
  assert.match(skillIconSVG('bulwark', 1024), /width="256"/);
  assert.doesNotMatch(first, /<image|<filter|<script|href=|currentColor/);
});
