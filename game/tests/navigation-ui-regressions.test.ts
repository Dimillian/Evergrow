import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { freshExpeditions } from '../src/dungeon-state.ts';
import { portalDestinations, type PortalActionView } from '../src/portal-destination.ts';

const assets = registerHooks({ load(url, context, next) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  if (url.endsWith('/music-content.ts')) return { format: 'module', source: 'export const MUSIC_FILES = {};', shortCircuit: true };
  if (url.endsWith('?raw')) return { format: 'module', source: `export default ${JSON.stringify(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true };
  return next(url, context);
} });
const { Game } = await import('../src/game.ts');
const { GameShell } = await import('../src/game-shell.ts');
assets.deregister();

test('Home restores canvas focus before starting or cancelling a portal action', t => {
  const originals = new Map(['document', 'window', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  // Only DOM ownership and event delivery; no browser, render loop or playable save.
  class Element extends EventTarget {
    hidden = false; innerHTML = ''; textContent = ''; className = '';
    sections = new Map<string, Element>();
    classList = { add() {}, remove() {}, toggle() {} };
    append() {} remove() {} setAttribute() {} removeAttribute() {}
    focus() { doc.activeElement = this; }
    querySelector(selector: string): Element {
      if (!this.sections.has(selector)) this.sections.set(selector, new Element());
      return this.sections.get(selector)!;
    }
  }
  const doc = Object.assign(new EventTarget(), { activeElement: null as Element | null, createElement: () => new Element() });
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: new EventTarget(), configurable: true });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { value() {}, configurable: true });
  t.after(() => { shell.dispose(); for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  } });
  let calls = 0;
  const root = new Element();
  const shell = new GameShell(root as unknown as HTMLElement, {
    play() {}, openMap() {}, openCharacter() {}, openSkills() {}, returnToTitle() {},
    homePortal() { assert.equal(doc.activeElement, shell.canvas, 'focus returns before invoking the action'); calls++; },
  });
  const home = root.querySelector('#hud-controls').querySelector('[data-hud="home"]');
  shell.setHomePortalVisible(true);
  for (let i = 0; i < 2; i++) {
    home.focus(); home.dispatchEvent(new Event('click'));
    assert.equal(doc.activeElement, shell.canvas);
    assert.equal(home.hidden, false, 'focus is restored even when Home stays visible during a cast');
  }
  assert.equal(calls, 2);
  shell.setNavigationVisible(false); home.dispatchEvent(new Event('click'));
  shell.setNavigationVisible(true); shell.setHomePortalVisible(false); home.dispatchEvent(new Event('click'));
  assert.equal(calls, 2, 'hidden navigation and unavailable portals still reject activation');
});

test('portal presentation refreshes desktop/controller destinations and clears stale touch-era links', () => {
  const home = { band: 4, name: 'Home settlement', x: 4200, y: -800 };
  const travel = { homeTown: 4, returnTo: { x: 8800, y: 1200, town: 4 } as { x: number; y: number; town: number; dungeon?: string } | null };
  const expeditions = freshExpeditions(), touchViews: PortalActionView[] = [];
  const game = Object.assign(Object.create(Game.prototype), {
    overworld: { seed: 7319, getPortalAnchor: () => home }, renderer: {},
    sim: { travel, expeditions, player: { x: 0, y: 0 }, portal: { active: false, progress: 0 } },
    touch: { active: false, setPortal: (view: PortalActionView) => touchViews.push(view) },
    world: { isSanctuary: () => true }, returnPortalInReach: () => false,
  });
  game.updatePortalPresentation();
  const expected = () => portalDestinations({ seed: 7319, home, travel, expeditions });
  assert.deepEqual(game.renderer.portalDestinations, expected());
  assert.ok(game.renderer.portalDestinations.returnTo?.biome);
  assert.equal(touchViews.length, 0);
  game.touch.active = true; game.updatePortalPresentation();
  assert.equal(touchViews.at(-1)?.mode, 'locate');
  assert.deepEqual(touchViews.at(-1)?.destination, game.renderer.portalDestinations.returnTo);
  game.touch.active = false; game.usingGamepad = true;
  expeditions.runs.push({ entrance: { id: 'crypt', name: 'Vault of Embers', seed: 99, biome: 'emberfall', level: 27, x: 1, y: 2 },
    layoutVersion: 1, states: {}, explored: [], chestMasks: [], contents: { actors: [], groundItems: [], groundGold: [], pickups: [], clearedCamps: [], defeatedCampMembers: {} }, x: 0, y: 0 });
  travel.returnTo = { x: 3, y: 7, town: 4, dungeon: 'crypt' }; game.updatePortalPresentation();
  assert.deepEqual(game.renderer.portalDestinations, expected());
  assert.equal(game.renderer.portalDestinations.returnTo.kind, 'dungeon');
  assert.equal(game.renderer.portalDestinations.returnTo.name, 'Vault of Embers');
  assert.equal(game.renderer.portalDestinations.returnTo.biome, 'emberfall');
  travel.returnTo = null; game.updatePortalPresentation();
  assert.equal(game.renderer.portalDestinations.returnTo, null, 'desktop/controller presentation drops a removed return link');
  assert.equal(touchViews.length, 1, 'inactive touch UI is not updated');
});
