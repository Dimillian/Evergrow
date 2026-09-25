import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { initialPlayer } from '../src/simulation.ts';
import { characterStatDetails, type StatDetail } from '../src/character-stat-details.ts';
import { executeCharacterCommand } from '../src/character-commands.ts';
const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { CharacterPanel } = await import('../src/character-panel.ts');
css.deregister();

// Render real derived stats at the DOM boundary without driving the game or a browser.
function setup() {
  const player = initialPlayer(0, 0);
  const page = { innerHTML: '', labelledBy: '', setAttribute(_: string, value: string) { this.labelledBy = value; } };
  let hidden = 0;
  const panel = Object.assign(Object.create(CharacterPanel.prototype), {
    player, category: 'Offense', details: new Map<string, StatDetail>(),
    element: { querySelector: () => page }, tooltip: { hide: () => { hidden++; } },
  }) as { renderStats(): void; category: string; details: Map<string, StatDetail> };
  return { player, page, panel, hidden: () => hidden };
}

test('the three character tabs retain every effective stat, including resistances, utility and bonus skill ranks', () => {
  const { player, panel, page } = setup();
  player.derived.skillBonuses = { cleave: 2 };
  const rendered: string[] = [];
  for (const category of ['Offense', 'Defense', 'Resources']) {
    panel.category = category; panel.renderStats();
    rendered.push(...[...page.innerHTML.matchAll(/data-stat-detail="([^"]+)"/g)].map(match => match[1]));
    assert.equal(page.labelledBy, `character-stat-tab-${category}`);
  }
  const expected = characterStatDetails(player).filter(group => group.tone !== 'attributes').flatMap(group => group.rows.map(row => row.id));
  assert.deepEqual(rendered.sort(), expected.sort());
  assert.equal(new Set(rendered).size, rendered.length);
  assert.ok(rendered.includes('skill:cleave'));
  assert.ok(panel.details.has('strength'), 'attribute explanations remain available outside the tabs');
});

test('allocation refreshes stat values and explanation sources without changing resources', () => {
  const { player, panel, page, hidden } = setup();
  player.character.statPoints = 1;
  panel.renderStats(); const before = page.innerHTML, strength = panel.details.get('strength')!.value;
  const hp = player.hp, mana = player.mana;
  assert.equal(executeCharacterCommand(player, { type: 'allocateAttribute', attribute: 'strength' }).ok, true);
  panel.renderStats();
  assert.notEqual(page.innerHTML, before); assert.notEqual(panel.details.get('strength')!.value, strength);
  assert.equal(player.hp, hp); assert.equal(player.mana, mana);
  const count = hidden(); panel.renderStats(); assert.equal(hidden(), count, 'an unchanged refresh retains focusable stat rows and their tooltips');
});
