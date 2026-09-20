import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { SkillTourProgress, SKILL_TOUR_STORAGE_KEY } from '../src/skill-tree-tour-progress.ts';
import { SKILL_TOUR_STEPS } from '../src/skill-tree-tour-content.ts';
import { SKILL_NODES } from '../src/skill-tree.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';

test('guide dismissal persists per device and blocked storage still remembers it for the session', () => {
  const entries = new Map<string, string>();
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
  const first = new SkillTourProgress(storage);
  assert.equal(first.shouldOffer, true); first.dismiss(); assert.equal(first.shouldOffer, false);
  assert.equal(new SkillTourProgress(storage).shouldOffer, false);
  assert.deepEqual([...entries], [[SKILL_TOUR_STORAGE_KEY, 'seen']]);
  for (const store of [undefined, { getItem() { throw Error('Blocked'); }, setItem() { throw Error('Blocked'); } }]) {
    const progress = new SkillTourProgress(store);
    assert.equal(progress.shouldOffer, true); progress.dismiss(); assert.equal(progress.shouldOffer, false);
  }
});

test('guide examples resolve to real nodes and cover skills, auras, passives, Techniques and exclusive/tradeoff choices', () => {
  assert.equal(new Set(SKILL_TOUR_STEPS.map(step => step.id)).size, SKILL_TOUR_STEPS.length);
  const nodes = SKILL_TOUR_STEPS.flatMap(step => [step.node, ...(step.examples ?? []).map(example => example.node)]).map(id => {
    const node = SKILL_NODES.get(id); assert.ok(node, id); return node;
  });
  assert.ok(nodes.some(n => n.kind === 'minor'));
  assert.ok(nodes.some(n => n.kind === 'notable' && !n.doctrine && !n.specialization));
  assert.ok(nodes.some(n => n.skill && SKILL_DEFINITIONS[n.skill].tier !== 'aura'));
  assert.ok(nodes.some(n => n.skill && SKILL_DEFINITIONS[n.skill].tier === 'aura'));
  assert.ok(nodes.some(n => n.specialization)); assert.ok(nodes.some(n => n.doctrine)); assert.ok(nodes.some(n => n.keystone));
});

const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { SkillTreePanel } = await import('../src/skill-tree-panel.ts');
css.deregister();

test('leaving the guide restores camera, filters, selection, sidebar and disclosures without character commands', () => {
  for (const restoreFocus of [true, false]) for (const detailsVisible of [true, false]) {
    let disposed = 0, focused = 0, filterSync = 0, mutations = 0;
    const window = { inert: true, scrollTop: 0 }, preview = { open: true }, inspection = { scrollTop: 0 };
    const disclosures = [{ dataset: { inspectorSection: 'next-rank' }, open: false }, { dataset: { inspectorSection: 'techniques' }, open: true }];
    const state = { selected: null, centerX: 71, centerY: -84, zoom: .47, fitMode: 'search', skillsOnly: true, weaponFilter: 'bow',
      search: 'critical damage', searchGroup: 'critDamage', detailsVisible, scroll: 58, mainScroll: 24, previewOpen: true, disclosures: ['next-rank'], focus: null };
    const panel = Object.assign(Object.create(SkillTreePanel.prototype), {
      tour: { dispose: () => disposed++ }, tourState: state, autoTour: false, selected: 'skill:fireball',
      detailsVisible: false, centerX: 0, centerY: 0, zoom: 1, fitMode: null as string | null,
      controller: { clear() {} }, root: { querySelector: () => window }, search: { value: '' }, previewDisclosure: preview, inspection,
      detail: { querySelectorAll: () => disclosures }, canvas: { focus: () => focused++ },
      closePreview: () => { preview.open = false; }, syncTourFilters: () => filterSync++,
      updateDetail() {}, updateAssignments() {}, invalidate() {},
      setDetailsVisible(value: boolean) { this.detailsVisible = value; },
      setView(x: number, y: number, zoom: number) { this.centerX = x; this.centerY = y; this.zoom = zoom; this.fitMode = null; },
      actions: { develop: () => mutations++, assign: () => mutations++, allocate: () => mutations++ },
    });
    panel.finishTour(restoreFocus);
    assert.deepEqual([panel.selected, panel.centerX, panel.centerY, panel.zoom, panel.fitMode], [null, 71, -84, .47, 'search']);
    assert.deepEqual([panel.skillsOnly, panel.weaponFilter, panel.search.value, panel.activeSearchGroup], [true, 'bow', 'critical damage', 'critDamage']);
    assert.equal(panel.detailsVisible, detailsVisible); assert.equal(inspection.scrollTop, 58);
    assert.equal(preview.open, restoreFocus && detailsVisible); assert.deepEqual(disclosures.map(d => d.open), [true, false]);
    assert.equal(window.inert, false); assert.equal(panel.tourState, undefined); assert.equal(panel.tour, undefined);
    assert.equal(window.scrollTop, 24);
    assert.equal(disposed, 1); assert.equal(filterSync, 1); assert.equal(focused, Number(restoreFocus)); assert.equal(mutations, 0);
    panel.finishTour(); assert.equal(disposed, 1, 'closing twice is harmless');
  }
});

test('each guide scene changes presentation without allocating points or assigning skills', t => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: { innerWidth: 1200 }, configurable: true });
  t.after(() => { if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window'); });
  const commands: unknown[] = [];
  const panel = Object.assign(Object.create(SkillTreePanel.prototype), {
    search: { value: 'old search' }, activeSearchGroup: 'critDamage', width: 800, height: 600,
    selected: '', camera: [] as number[],
    root: { querySelector: () => ({ scrollTop: 0 }) },
    previewDisclosure: { open: false, offsetTop: 180 }, detail: { offsetTop: 20 }, inspection: { scrollTop: 0 },
    closePreview() { this.previewDisclosure.open = false; }, syncTourFilters() {},
    inspectNode(id: string) { this.selected = id; }, setView(x: number, y: number, zoom: number) { this.camera = [x, y, zoom]; },
    actions: { develop: (c: unknown) => commands.push(c), allocate: (c: unknown) => commands.push(c), assign: (c: unknown) => commands.push(c) },
  });
  for (const step of SKILL_TOUR_STEPS) {
    panel.stageTour(step); assert.equal(panel.selected, step.node);
    assert.equal(panel.search.value, ''); assert.equal(panel.activeSearchGroup, null);
    assert.equal(panel.previewDisclosure.open, step.id === 'inspect');
    assert.ok(panel.camera.every(Number.isFinite));
  }
  assert.deepEqual(commands, []);
});
