import assert from 'node:assert/strict';
import test from 'node:test';
import { eventChoiceMarkup, eventChoicePresentation, dungeonChoicePresentation } from '../src/event-choice-presentation.ts';
import { EVENT_RECIPES } from '../src/event-recipes.ts';
import { eventProblem } from '../src/poi-command.ts';
import { eventRewards } from '../src/poi-rewards.ts';
import type { EventKind, EventSite } from '../src/poi-content.ts';
import { Simulation } from '../src/simulation.ts';
import { uiIcon } from '../src/ui-icons.ts';

const world = { seed: 7319, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
const site = (kind: EventKind, seed = 0): EventSite => ({ id: `choice:${kind}`, kind, name: 'The Bound Coffer', seed, level: 12, biome: 'deadwood', x: 0, y: 30 });

test('every trial and cargo row retains an action accepted by the event command', () => {
  const sim = new Simulation(world, { spawn: false });
  for (const [kind, recipes] of [...Object.entries(EVENT_RECIPES), ['caravan', [null]]] as const) {
    for (let index = 0; index < recipes.length; index++) {
      const s = site(kind as EventKind, index << 8), presentation = eventChoicePresentation(s);
      assert.equal(presentation.choices.length, ['caravan', 'standingStones'].includes(kind) ? 2 : 1);
      for (const choice of presentation.choices) {
        assert.equal(eventProblem(sim, s, choice.id), null, `${kind}/${index}/${choice.id}`);
        assert.ok(eventChoiceMarkup(presentation).includes(`data-choice="${choice.id ?? ''}"`));
      }
    }
  }
});

test('cursed chest descriptions agree with actual reward thresholds and timing', () => {
  const s = site('cursedChest'), presentation = eventChoicePresentation(s);
  assert.match(presentation.objective, /90-second timer/);
  assert.match(presentation.choices[0].detail, /2, 4, 6/);
  for (const [waves, items] of [[0, 0], [1, 1], [2, 2], [3, 2], [4, 3], [18, 10], [20, 10]]) {
    const reward = eventRewards({ ...s, phase: 'completed', choice: null, wavesCleared: waves, delivered: 0, bonusGranted: false });
    assert.equal(reward.items.length, items);
    assert.equal(reward.gold > 0, waves > 0);
  }
});

test('shared markup escapes place names, reuses the close glyph and separates dungeon entry', () => {
  const s = { ...site('caravan'), name: '<img src=x onerror=alert(1)>' };
  const markup = eventChoiceMarkup(eventChoicePresentation(s));
  assert.ok(markup.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(markup.includes(uiIcon('close')));
  assert.ok(markup.includes('aria-modal="true"'));
  assert.ok(!eventChoiceMarkup(eventChoicePresentation(s), false, false).includes('aria-modal'));
  const entrance = dungeonChoicePresentation(s);
  const dungeon = eventChoiceMarkup(entrance, true);
  assert.ok(dungeon.includes('data-enter'));
  assert.ok(!dungeon.includes('data-choice='));
  assert.match(entrance.choices[0].detail, /Lv 12/);
});
