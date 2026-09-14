import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { CharacterRepository, type SaveSlot } from '../src/character-storage.ts';
import { CharacterSession } from '../src/character-session.ts';
import { Simulation } from '../src/simulation.ts';
import { executeSavedAppearanceChange } from '../src/appearance-command.ts';

const assets = registerHooks({ load(url, context, next) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  if (url.endsWith('?raw')) return { format: 'module', source: `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true };
  return next(url, context);
} });
const { TitleScreen } = await import('../src/title-screen.ts');
assets.deregister();

// Exercise production selection/navigation on a small DOM boundary, without a browser or playable saves.
const doc = { activeElement: null as Control | null };
class Control {
  tabIndex = 0; disabled = false; hidden = false; inert = false; visibility = 'visible';
  dataset: Record<string, string> = {};
  left = 0; top = 0;
  matches(selector: string) { return selector === ':disabled' && this.disabled; }
  closest() { return this.inert ? this : null; }
  getClientRects() { return this.hidden ? [] : [this.getBoundingClientRect()]; }
  getBoundingClientRect() { return this.hidden ? { left: 0, top: 0, width: 0, height: 0 } : { left: this.left, top: this.top, width: 32, height: 32 }; }
  focus() { if (!this.hidden && !this.disabled && !this.inert && this.visibility !== 'hidden') doc.activeElement = this; }
}
const globals = { document: doc, getComputedStyle: (element: Control) => ({ visibility: element.visibility }) };
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, globals);
after(() => { for (const [key, descriptor] of previous) {
  if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
} });

interface HallBoundary {
  slots: SaveSlot[];
  selected: number;
  choose(index: number, focus?: boolean): void;
  navigateDetails(target: Control, key: string): void;
}
function hall(slots: SaveSlot[], read: (index: number) => Promise<SaveSlot>): HallBoundary {
  return Object.assign(Object.create(TitleScreen.prototype), {
    slots, selected: 0, inspection: 0, source: { mode: 'local' }, actions: { read },
    element: { hidden: false }, render() {}, renderSelection() {}, closeItem() {},
  });
}

test('reselecting a stale local character refreshes its revision and allows a cosmetic save without losing newer progress', async () => {
  const data = new Map<string, string>();
  const repo = new CharacterRepository({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } });
  const world = { seed: 7319, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
  const sim = new Simulation(world, { spawn: false });
  const writer = new CharacterSession(repo, 10);
  assert.ok(await writer.create(0, 'Rowan', world.seed, sim.captureCheckpoint(), 'hall-reselect', 1));
  const old = repo.read(0), look = structuredClone(old.record!.checkpoint.character.look);
  const checkpoint = structuredClone(old.record!.checkpoint);
  checkpoint.character.gold = 123;
  assert.ok(await writer.save(checkpoint, 2));
  look.showHelmet = true;
  assert.equal((await executeSavedAppearanceChange(repo, old, look, 3)).ok, false);
  const title = hall([old], async index => repo.read(index));
  title.choose(0, false);
  await Promise.resolve();
  assert.equal(title.slots[0].token, repo.read(0).token);
  assert.ok((await executeSavedAppearanceChange(repo, title.slots[0], look, 4)).ok);
  const expected = structuredClone(checkpoint); expected.character.look = look;
  assert.deepEqual(repo.read(0).record!.checkpoint, expected);
});

test('a delayed local selection read cannot replace the subsequently selected slot', async () => {
  const slots: SaveSlot[] = [0, 1].map(index => ({ index, state: 'empty', token: null, record: null }));
  const finish: Array<(slot: SaveSlot) => void> = [];
  const title = hall(slots, index => new Promise(resolve => { finish[index] = resolve; }));
  title.choose(0, false); title.choose(1, false);
  finish[1]({ ...slots[1], token: 'new-selection' }); await Promise.resolve();
  finish[0]({ ...slots[0], token: 'late-result' }); await Promise.resolve();
  assert.equal(title.selected, 1);
  assert.equal(title.slots[1].token, 'new-selection');
  assert.equal(title.slots[0].token, null);
});

test('detail navigation skips hidden, disabled and inert items while retaining visible gear and roster/Continue exits', () => {
  const palette = Object.assign(new Control(), { left: 740, top: 120 });
  const trash = Object.assign(new Control(), { left: 776, top: 120 });
  const item = Object.assign(new Control(), { left: 740, top: 220 });
  const roster = new Control(), enter = new Control();
  const title: HallBoundary = Object.assign(Object.create(TitleScreen.prototype), {
    selected: 0, element: { querySelectorAll: () => [palette, trash, item],
      querySelector: (selector: string) => selector === '[data-action="continue"]' ? enter : roster },
  });
  for (const unavailable of [{ hidden: true }, { disabled: true }, { inert: true }, { visibility: 'hidden' }, { tabIndex: -1 }]) {
    Object.assign(item, { hidden: false, disabled: false, inert: false, visibility: 'visible', tabIndex: 0 }, unavailable);
    palette.focus(); title.navigateDetails(palette, 'ArrowLeft'); assert.equal(doc.activeElement, roster);
    palette.focus(); title.navigateDetails(palette, 'ArrowDown'); assert.equal(doc.activeElement, enter);
  }
  Object.assign(item, { hidden: false, disabled: false, inert: false, visibility: 'visible', tabIndex: 0 });
  palette.focus(); title.navigateDetails(palette, 'ArrowRight'); assert.equal(doc.activeElement, trash);
  title.navigateDetails(trash, 'ArrowLeft'); assert.equal(doc.activeElement, palette);
  title.navigateDetails(palette, 'ArrowDown'); assert.equal(doc.activeElement, item);
  title.navigateDetails(item, 'ArrowUp'); assert.equal(doc.activeElement, palette);
  title.navigateDetails(item, 'ArrowDown'); assert.equal(doc.activeElement, enter);
});
