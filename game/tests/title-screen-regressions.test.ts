import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { CharacterRepository, type SaveSlot } from '../src/character-storage.ts';
import { CharacterSession } from '../src/character-session.ts';
import { Simulation } from '../src/simulation.ts';
import { executeSavedAppearanceChange } from '../src/appearance-command.ts';
import type { CharacterSave } from '../src/character-save.ts';
import type { Item } from '../src/character-types.ts';
import type { ItemPresentation } from '../src/item-ui.ts';
import { CloudClient } from '../src/cloud-client.ts';

const assets = registerHooks({ load(url, context, next) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  if (url.endsWith('/music-content.ts')) return { format: 'module', source: 'export const MUSIC_FILES = {};', shortCircuit: true };
  if (url.endsWith('?raw')) return { format: 'module', source: `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true };
  return next(url, context);
} });
const { TitleScreen } = await import('../src/title-screen.ts');
const { Game } = await import('../src/game.ts');
assets.deregister();

// Exercise production selection/navigation on a small DOM boundary, without a browser or playable saves.
const doc = { activeElement: null as Control | null };
class Control extends EventTarget {
  tabIndex = 0; disabled = false; hidden = false; inert = false; visibility = 'visible';
  dataset: Record<string, string> = {};
  left = 0; top = 0;
  matches(selector: string) { return selector === ':disabled' && this.disabled; }
  closest(selector: string) {
    if (selector === '[data-title-item]') return this.dataset.titleItem ? this : null;
    if (selector === '.ui-tooltip') return null;
    return this.inert ? this : null;
  }
  contains(node: unknown) { return node === this; }
  getClientRects() { return this.hidden ? [] : [this.getBoundingClientRect()]; }
  getBoundingClientRect() { return this.hidden ? { left: 0, top: 0, width: 0, height: 0 } : { left: this.left, top: this.top, width: 32, height: 32 }; }
  focus() { if (!this.hidden && !this.disabled && !this.inert && this.visibility !== 'hidden') doc.activeElement = this; }
}
const globals = { document: doc, Element: Control, Node: Control, getComputedStyle: (element: Control) => ({ visibility: element.visibility }) };
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, globals);
after(() => { for (const [key, descriptor] of previous) {
  if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
} });

interface HallBoundary {
  slots: SaveSlot[];
  selected: number;
  choose(index: number, focus?: boolean): void;
  refreshSelected(): void;
  navigateDetails(target: Control, key: string): void;
}
function hall(slots: SaveSlot[], read: (index: number) => Promise<SaveSlot>): HallBoundary {
  return Object.assign(Object.create(TitleScreen.prototype), {
    slots, selected: 0, inspection: 0, source: { mode: 'local' }, actions: { read },
    element: { hidden: false }, itemTooltip: { hide() {} }, render() {}, renderSelection() {}, message() {},
  });
}

test('stale cloud resolution offers a read-only retry and requires confirmation with the refreshed token', async () => {
  let reads = 0, resolutions = 0, rosterLoads = 0;
  const stale: SaveSlot = { index: 0, state: 'saved', token: 'old-token', conflict: true, record: null };
  const fresh = { ...stale, token: 'new-token' };
  const title = Object.assign(hall([stale], async () => { reads++; return fresh; }), {
    confirming: 'cloud' as string | null, notice: '', retry: false,
    setBusy() {},
    message(text: string, retry = false) { this.notice = text; this.retry = retry; },
  });
  const cloud = Object.assign(Object.create(CloudClient.prototype), {
    flush: async () => {}, api: async () => ({ revision: 2, bundle: null }), onStatus() {},
    cache: async (command: { kind: string }) => {
      if (command.kind === 'resolve') resolutions++;
      return { conflict: true, token: fresh.token };
    },
  });
  const game = Object.assign(Object.create(Game.prototype), {
    panels: { phase: 'ready' }, hallBusy: false, titleScreen: title, saveClient: cloud,
    loadRoster: async (index: number) => { assert.equal(index, 0); rosterLoads++; },
  });
  await game.resolveCloudSave(0, stale.token);
  assert.match(title.notice, /Recovery changed\. Retry/);
  assert.equal(title.retry, true); assert.equal(game.hallBusy, false);
  title.choose(0, false); assert.equal(reads, 0, 'ordinary reselection still does nothing');
  title.refreshSelected(); await Promise.resolve();
  assert.equal(title.slots[0].token, fresh.token); assert.equal(title.confirming, null);
  assert.equal(title.retry, false); assert.equal(reads, 1);
  assert.equal(resolutions, 0, 'Retry only reviews the latest version; it cannot discard recovery');
  await game.resolveCloudSave(0, title.slots[0].token);
  assert.equal(resolutions, 1); assert.equal(rosterLoads, 1);
});

for (const saved of [true, false]) test(`returning to the hall ${saved ? 'clears old gameplay warnings' : 'retains warnings if the local checkpoint fails'}`, async () => {
  let warning = 'Offline', opened = false, flushed = false;
  const world = {};
  const game = Object.assign(Object.create(Game.prototype), {
    durable: async (operation: () => Promise<void>) => operation(),
    saveCharacter: async () => saved,
    session: { active: { index: 0 }, repository: { list: async () => [] } },
    saveClient: { flush: async () => { flushed = true; } },
    shell: { notifications: { clear() {} }, setSaveStatus: (message = '') => { warning = message; } },
    world, overworld: world, sim: { reset() {}, world }, renderer: { reset() {} },
    panels: { transition() {} },
    titleScreen: { open: () => { assert.equal(warning, ''); opened = true; } },
  });
  await game.returnToTitle();
  assert.equal(opened, saved); assert.equal(flushed, saved);
  assert.equal(warning, saved ? '' : 'Offline');
  assert.equal(game.session.active === null, saved);
});

test('explicitly refreshing a stale local character allows a cosmetic save without losing newer progress', async () => {
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
  title.refreshSelected();
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
  title.refreshSelected(); title.choose(1, false);
  finish[1]({ ...slots[1], token: 'new-selection' }); await Promise.resolve();
  finish[0]({ ...slots[0], token: 'late-result' }); await Promise.resolve();
  assert.equal(title.selected, 1);
  assert.equal(title.slots[1].token, 'new-selection');
  assert.equal(title.slots[0].token, null);
});

test('clicking the selected character preserves the view and does not restart pending or completed reads', async () => {
  const slots: SaveSlot[] = [0, 1].map(index => ({ index, state: 'empty', token: null, record: null }));
  let reads = 0, renders = 0;
  let finish!: (slot: SaveSlot) => void;
  const title = Object.assign(hall(slots, () => { reads++; return new Promise(resolve => { finish = resolve; }); }), {
    render() { renders++; },
  });
  title.choose(0, false);
  assert.equal(reads, 0); assert.equal(renders, 0);
  title.choose(1, false);
  title.choose(1, false); title.choose(1, false);
  assert.equal(reads, 1); assert.equal(renders, 1);
  finish({ ...slots[1], token: 'loaded' }); await Promise.resolve();
  assert.equal(title.slots[1].token, 'loaded', 'repeat clicks do not invalidate the pending read');
  title.choose(1, false);
  assert.equal(reads, 1); assert.equal(renders, 2);
});

test('source selection only loads a different source and waits for the current roster to arrive', () => {
  const calls: string[] = [];
  const title = Object.assign(Object.create(TitleScreen.prototype), {
    source: { mode: 'cloud', status: 'Sign in' }, rosterLoading: false,
    actions: { source: (mode: string) => calls.push(mode) },
  });
  title.selectSource('cloud'); assert.deepEqual(calls, []);
  title.selectSource('local'); assert.deepEqual(calls, ['local']);
  title.source = { mode: 'local', status: 'Local' };
  title.selectSource('local'); assert.deepEqual(calls, ['local']);
  title.rosterLoading = true;
  title.selectSource('cloud'); assert.deepEqual(calls, ['local']);
  title.rosterLoading = false;
  title.selectSource('cloud'); assert.deepEqual(calls, ['local', 'cloud']);
});

test('initial hall focus follows the selected save source when no character is available', () => {
  const cloud = new Control(), local = new Control(), slot = new Control();
  const controls = new Map<string, Control>([['[data-source="cloud"]', cloud], ['[data-source="local"]', local]]);
  const title = Object.assign(Object.create(TitleScreen.prototype), {
    selected: 2, source: { mode: 'cloud' }, element: { querySelector: (selector: string) => controls.get(selector) ?? null },
  });
  assert.equal(title.initialSelectionFocus(), cloud);
  title.source.mode = 'local'; assert.equal(title.initialSelectionFocus(), local);
  controls.set('[data-slot="2"]', slot); assert.equal(title.initialSelectionFocus(), slot);
});

test('clicking the current home page never reopens its library or reloads its data', () => {
  for (const page of ['characters', 'chronicle', 'leaderboard', 'changelog']) {
    const title = Object.assign(Object.create(TitleScreen.prototype), { page, element: { dataset: { homePage: page } } });
    // No panel/action dependencies: reopening any library would fail this boundary.
    title.selectPage(page);
  }
});

function selectionBoundary(record: CharacterSave | null) {
  const parts = new Map<string, ReturnType<typeof part>>();
  function part() {
    const classes = new Set<string>();
    return { innerHTML: '', textContent: '', inert: false, disabled: false, dataset: {} as Record<string, string>, classes,
      attributes: new Map<string, string>(),
      classList: { toggle(name: string, enabled: boolean) { if (enabled) classes.add(name); else classes.delete(name); } },
      setAttribute(name: string, value: string) { this.attributes.set(name, value); },
    };
  }
  const get = (selector: string) => { if (!parts.has(selector)) parts.set(selector, part()); return parts.get(selector)!; };
  const title = Object.assign(Object.create(TitleScreen.prototype), {
    slots: [{ index: 0, state: 'saved', record, token: 'loaded' }], selected: 0,
    source: { mode: 'local', status: 'Local', signedIn: false }, loading: true, rosterLoading: false,
    detailTab: 'gear', confirming: null, actions: { download() {}, import() {}, editAppearance() {} },
    itemTooltip: { hide() {} }, element: { querySelector: get },
  });
  return { title, get };
}

test('a cached character keeps the identical detail layout while refreshing, with actions held until it finishes', () => {
  const sim = new Simulation({ seed: 7319, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) }, { spawn: false });
  const record: CharacterSave = { id: 'loading-layout', name: 'Rowan', version: 4, worldVersion: 10,
    worldSeed: 7319, createdAt: 1, updatedAt: 1, checkpoint: sim.captureCheckpoint() };
  const { title, get } = selectionBoundary(record);
  title.renderSelection();
  const selection = get('.title-selection'), markup = selection.innerHTML;
  assert.ok(markup.includes('Rowan'));
  assert.equal(selection.inert, true);
  assert.equal(selection.attributes.get('aria-busy'), 'true');
  assert.equal(selection.classes.has('has-character'), true);
  assert.equal(get('.title-hero').classes.has('is-loading'), false);
  assert.equal(get('[data-action="download"]').disabled, true);
  title.loading = false; title.renderSelection();
  // Item SVGs allocate unique gradient IDs on each render; compare their surrounding layout.
  const layout = (html: string) => html.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/g, '<svg/>');
  assert.equal(layout(selection.innerHTML), layout(markup), 'the existing layout survives the refresh');
  assert.equal(selection.inert, false);
  assert.equal(selection.attributes.get('aria-busy'), 'false');
  assert.equal(get('[data-action="download"]').disabled, false);
  assert.equal(get('.title-storage-status').textContent, 'On this device');

  title.rosterLoading = true; title.renderSelection();
  assert.ok(!selection.innerHTML.includes('Rowan'), 'a new source never shows the old roster’s character');
  assert.equal(get('.title-hero').classes.has('is-loading'), true);
});

test('an uncached character reserves responsive detail sections without exposing made-up stats or a starter portrait', () => {
  const { title, get } = selectionBoundary(null);
  title.renderSelection();
  const selection = get('.title-selection');
  for (const section of ['title-selection-heading', 'title-location', 'title-summary-band', 'title-detail-tabs', 'title-detail-body', 'title-save-meta', 'title-enter']) {
    assert.ok(selection.innerHTML.includes(section), section);
  }
  assert.equal((selection.innerHTML.match(/title-gear-cell/g) ?? []).length, 11);
  assert.ok(!selection.innerHTML.includes('data-action='));
  assert.equal(selection.inert, true);
  assert.equal(get('.title-hero').attributes.get('aria-hidden'), 'true');
  assert.equal(get('.title-storage-status').textContent, 'Loading character…');
  title.detailTab = 'attributes'; title.renderSelection();
  assert.ok(selection.innerHTML.includes('data-detail="attributes"'), 'handheld detail choice is retained');
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

test('hall gear reveals shared tooltips on hover/focus and clears them when changing detail tabs', () => {
  const world = { seed: 7319, blocked: () => false, move: (x: number, y: number, dx: number, dy: number) => ({ x: x + dx, y: y + dy }) };
  const sim = new Simulation(world, { spawn: false });
  const record: CharacterSave = { id: 'tooltip-test', name: 'Rowan', version: 4, worldVersion: 10,
    worldSeed: world.seed, createdAt: 1, updatedAt: 1, checkpoint: sim.captureCheckpoint() };
  const before = structuredClone(record);
  const anchor = new Control(); anchor.dataset.titleItem = 'weapon';
  const handlers = new Map<string, (event: unknown) => void>();
  const shown: Array<{ item: Item; view: ItemPresentation; anchor: Control }> = [];
  let hidden = 0, deferred = 0;
  const body = { dataset: { detail: 'gear' } };
  const element = { hidden: false, inert: false,
    addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler),
    querySelector: () => body, querySelectorAll: () => [],
  };
  const title = Object.assign(Object.create(TitleScreen.prototype), {
    element, selected: 0, page: 'characters', slots: [{ record }], abort: new AbortController(),
    itemTooltip: { hide: () => { hidden++; }, defer: () => { deferred++; },
      show: (item: Item, view: ItemPresentation, target: Control) => shown.push({ item, view, anchor: target }) },
  }) as { bindItemTooltips(): void; switchDetail(tab: string): void; loading: boolean };
  title.bindItemTooltips();
  handlers.get('pointerover')!({ target: anchor, pointerType: 'mouse' });
  handlers.get('focusin')!({ target: anchor });
  assert.equal(shown.length, 2, 'neither mouse hover nor keyboard/controller focus requires a click');
  assert.equal(shown[0].item, record.checkpoint.character.equipped.weapon);
  assert.equal(shown[0].anchor, anchor);
  assert.equal(shown[0].view.equipped, true); assert.equal(shown[0].view.compare, false);
  assert.equal(element.inert, false, 'a tooltip does not disable hall navigation');
  handlers.get('pointerout')!({ target: anchor, relatedTarget: null });
  handlers.get('focusout')!({ target: anchor, relatedTarget: null });
  assert.equal(deferred, 2, 'leaving the anchor uses shared tooltip retention');
  title.switchDetail('attributes');
  assert.equal(hidden, 1); assert.equal(body.dataset.detail, 'attributes');
  title.loading = true; handlers.get('focusin')!({ target: anchor });
  assert.equal(shown.length, 2, 'loading cannot reveal a stale item');
  assert.deepEqual(record, before, 'tooltip presentation never changes the character');
});
