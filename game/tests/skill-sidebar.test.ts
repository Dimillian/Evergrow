import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { Simulation } from '../src/simulation.ts';
const css = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context);
} });
const { SkillTreePanel } = await import('../src/skill-tree-panel.ts');
css.deregister();

// A small DOM boundary exercises selection/refresh lifetime without a browser session.
function inspector() {
  const player = new Simulation({ blocked: () => false, move: (x: number, y: number) => ({ x, y }) }, { spawn: false }).player;
  let writes = 0, disposed = 0;
  const disclosure = { dataset: {} as Record<string, string>, open: false, parentElement: null as unknown,
    remove() { this.parentElement = null; } };
  const slot = { append(el: typeof disclosure) { el.parentElement = this; } };
  const detail = { dataset: {} as Record<string, string>, markup: '', classList: { toggle() {}, remove() {} },
    get innerHTML() { return this.markup; }, set innerHTML(value: string) { this.markup = value; writes++; },
    querySelectorAll: () => [], querySelector: () => slot };
  const panel = Object.assign(Object.create(SkillTreePanel.prototype), {
    player, selected: 'skill:fireball', hovered: 'skill:cleave', allocated: new Set(['origin']), reachable: new Set(), routes: new Map([['skill:fireball', { cost: 3 }]]),
    detail, detailMarkup: '', previewDisclosure: disclosure, previewHost: { replaceChildren() {} }, previewRequest: 0,
  });
  return { panel, detail, disclosure, writes: () => writes, disposed: () => disposed,
    playing() { disclosure.open = true; panel.preview = { dispose: () => disposed++ }; } };
}

test('sidebar follows selection and retains the same preview across unchanged and changed projection refreshes', () => {
  const h = inspector(); h.panel.updateDetail();
  assert.match(h.detail.innerHTML, /<h3>Fireball<\/h3>/);
  assert.doesNotMatch(h.detail.innerHTML, /<h3>Cleave<\/h3>/);
  assert.match(h.detail.innerHTML, /data-preview-slot/);
  assert.equal(h.disclosure.open, false);
  h.playing(); const original = h.panel.preview;
  h.panel.updateDetail();
  assert.equal(h.writes(), 1); assert.equal(h.panel.preview, original); assert.equal(h.disclosure.open, true);
  h.panel.player.character.skillPoints = 10; h.panel.updateDetail();
  assert.equal(h.writes(), 2); assert.equal(h.panel.preview, original); assert.equal(h.disposed(), 0);
});

test('changing selected skill or configured rank disposes and collapses its old preview', () => {
  const h = inspector(); h.panel.updateDetail(); h.playing();
  h.panel.selected = 'skill:cleave'; h.panel.updateDetail();
  assert.equal(h.disclosure.open, false); assert.equal(h.disposed(), 1);
  h.playing(); h.panel.player.character.allocatedNodes.push('skill:cleave');
  h.panel.player.character.skillRanks.cleave = 2; h.panel.updateDetail();
  assert.equal(h.disclosure.open, false); assert.equal(h.disposed(), 2);
});

test('collapsing preview invalidates pending loading and disposes playback', () => {
  const h = inspector(); h.panel.updateDetail(); h.playing();
  const request = h.panel.previewRequest;
  h.panel.closePreview(); h.panel.closePreview();
  assert.equal(h.disclosure.open, false); assert.equal(h.panel.preview, undefined);
  assert.equal(h.disposed(), 1); assert.ok(h.panel.previewRequest > request);
});

test('right-click targets the node under the pointer, cancels pending fitting and never recenters the map', () => {
  const commands: unknown[] = [], inspected: unknown[] = [];
  let prevented = 0, canceled = 0;
  const node = { id: 'skill:fireball', kind: 'major' };
  const panel = Object.assign(Object.create(SkillTreePanel.prototype), {
    pick: (x: number, y: number) => x === 120 && y === 80 ? node : undefined,
    selected: 'skill:cleave', allocated: new Set([node.id]), fitMode: 'search',
    centerX: 500, centerY: 300, zoom: .7, lastClickedNode: node.id, doubleClickedNode: node.id,
    cancelSearchFit: () => canceled++, inspectNode: (...args: unknown[]) => inspected.push(args),
    actions: { develop: (command: unknown) => commands.push(command) },
  });
  const event = { clientX: 120, clientY: 80, preventDefault: () => prevented++ };
  panel.refundAt(event);
  assert.equal(prevented, 1); assert.equal(canceled, 1); assert.equal(panel.fitMode, null);
  assert.deepEqual(commands, [{ type: 'refundNode', id: node.id }]); assert.deepEqual(inspected, [[node.id, false]]);
  assert.deepEqual([panel.centerX, panel.centerY, panel.zoom], [500, 300, .7]);
  assert.equal(panel.lastClickedNode, null); assert.equal(panel.doubleClickedNode, null);
  panel.refundAt({ ...event, clientX: 0 });
  panel.allocated.clear(); panel.refundAt(event);
  assert.equal(commands.length, 1, 'empty space and unallocated nodes are inert');
});

test('committed refunds clear the removed node selection and hover without moving the camera', () => {
  let closed = 0;
  const panel = Object.assign(Object.create(SkillTreePanel.prototype), {
    selected: 'road:veil:1', hovered: 'road:veil:1' as string | null, centerX: 50, centerY: 80, zoom: .7,
    closePreview: () => closed++, setHovered(id: string | null) { this.hovered = id; },
  });
  panel.pointRefunded('road:veil:1');
  assert.equal(panel.selected, 'origin'); assert.equal(panel.hovered, null);
  assert.equal(panel.refundedHover, 'road:veil:1'); assert.equal(closed, 1);
  assert.deepEqual([panel.centerX, panel.centerY, panel.zoom], [50, 80, .7]);
  panel.selected = 'skill:fireball'; panel.hovered = 'skill:cleave';
  panel.pointRefunded('road:veil:1');
  assert.equal(panel.selected, 'skill:fireball'); assert.equal(panel.hovered, 'skill:cleave');
});

test('right-click on a connecting node opens chain confirmation without dispatching a refund', async () => {
  const { executeCharacterCommand } = await import('../src/character-commands.ts');
  const { SKILL_NODES } = await import('../src/skill-tree.ts');
  const player = new Simulation({ blocked: () => false, move: (x: number, y: number) => ({ x, y }) }, { spawn: false }).player;
  player.character.skillPoints = 100;
  assert.ok(executeCharacterCommand(player, { type: 'allocateNode', id: 'skill:fireball' }).ok);
  const node = SKILL_NODES.get(SKILL_NODES.get('skill:fireball')!.neighbors.find(id => id.startsWith('road:'))!)!;
  const commands: unknown[] = [], confirmations: { nodeIds: string[]; points: number }[] = [];
  const panel = Object.assign(Object.create(SkillTreePanel.prototype), {
    player, pick: () => node, allocated: new Set(player.character.allocatedNodes), cancelSearchFit() {}, inspectNode() {},
    openRespec: (chain: typeof confirmations[number]) => confirmations.push(chain), actions: { develop: (cmd: unknown) => commands.push(cmd) },
  });
  const before = structuredClone(player);
  panel.refundAt({ clientX: 1, clientY: 1, preventDefault() {} });
  assert.equal(commands.length, 0); assert.equal(confirmations.length, 1);
  assert.ok(confirmations[0].nodeIds.includes('skill:fireball')); assert.ok(confirmations[0].points > 1);
  assert.deepEqual(player, before);
});

test('empty-space deselection clears inspection and preview without moving the map or leaving assignment mode active', () => {
  const h = inspector(), help = { textContent: '' }, assignments = { innerHTML: '' };
  Object.assign(h.panel, {
    hovered: 'skill:fireball' as string | null, centerX: 120, centerY: -80, zoom: .6, root: { querySelector: () => help }, assignments,
    cancelSearchFit() {}, setHovered(id: string | null) { this.hovered = id; }, invalidate() {},
  });
  h.panel.updateDetail(); h.playing();
  h.panel.clearSelection();
  assert.equal(h.panel.selected, null); assert.equal(h.panel.hovered, null);
  assert.equal(h.disclosure.open, false); assert.equal(h.disposed(), 1);
  assert.match(h.detail.innerHTML, /Select a node/); assert.equal(h.detail.dataset.node, '');
  assert.equal(help.textContent, ''); assert.doesNotMatch(assignments.innerHTML, /Assign Fireball/);
  assert.deepEqual([h.panel.centerX, h.panel.centerY, h.panel.zoom], [120, -80, .6]);
  h.panel.updateDetail(); assert.match(h.detail.innerHTML, /Select a node/);
  h.panel.selected = 'skill:fireball'; h.panel.updateDetail(); assert.match(h.detail.innerHTML, /<h3>Fireball<\/h3>/);
});
