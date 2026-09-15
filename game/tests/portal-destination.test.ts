import test from 'node:test';
import assert from 'node:assert/strict';
import { freshExpeditions } from '../src/dungeon-state.ts';
import { fitPortalWorldLabel, portalActionMode, portalDestinationLabel, portalDestinations } from '../src/portal-destination.ts';
import { getZoneAt } from '../src/zone-progression.ts';

const home = { band: 4, name: 'Long Procedural Settlement Name', x: 4200, y: -800 };

test('portal destination projects the actual home town and explicit overworld surface facts', () => {
  const seed = 7319, travel = { homeTown: 4, returnTo: { x: 8800, y: 1200, town: 4 } };
  const view = portalDestinations({ seed, home, travel, expeditions: freshExpeditions() });
  const zone = getZoneAt(8800, 1200, seed);
  assert.equal(view.home.name, home.name); assert.equal(view.home.detail, 'Home town');
  assert.equal(view.returnTo?.name, zone.name);
  assert.equal(view.returnTo?.detail, `Region level ${zone.level}–${zone.maxLevel}`);
  assert.equal(view.returnTo?.kind, zone.hazardous ? 'hazardous' : 'surface');
});

test('dungeon identity comes from the retained entrance, never dungeon-local geography', () => {
  const expeditions = freshExpeditions();
  expeditions.runs.push({ entrance: { id: 'dungeon:different-seed', name: 'Vault of Embers', seed: 99, biome: 'emberfall', level: 27, x: 1, y: 2 },
    layoutVersion: 1, states: {}, explored: [], chestMasks: [], contents: { actors: [], groundItems: [], groundGold: [], pickups: [], clearedCamps: [], defeatedCampMembers: {} }, x: 0, y: 0 });
  const travel = { homeTown: 4, returnTo: { x: 3, y: 7, town: 4, dungeon: 'dungeon:different-seed' } };
  const view = portalDestinations({ seed: 7319, home, travel, expeditions });
  assert.deepEqual({ name: view.returnTo?.name, detail: view.returnTo?.detail, biome: view.returnTo?.biome },
    { name: 'Vault of Embers', detail: 'Dungeon · Level 27', biome: 'emberfall' });
});

test('missing dungeon and absent return link fail closed to bounded presentation', () => {
  const empty = freshExpeditions();
  assert.equal(portalDestinations({ seed: 7319, home, travel: { homeTown: 4, returnTo: null }, expeditions: empty }).returnTo, null);
  const stale = portalDestinations({ seed: 7319, home,
    travel: { homeTown: 4, returnTo: { x: 0, y: 0, town: 4, dungeon: 'dungeon:missing' } }, expeditions: empty });
  assert.equal(stale.returnTo?.name, 'Preserved expedition'); assert.equal(stale.returnTo?.detail, 'Dungeon');
});

test('shared portal action distinguishes casting, locating and immediate return',()=>{
  assert.equal(portalActionMode(true,true,true,true),'cancel');
  assert.equal(portalActionMode(false,true,true,false),'locate');
  assert.equal(portalActionMode(false,true,true,true),'return');
  assert.equal(portalActionMode(false,false,true,true),'cast');
  assert.equal(portalActionMode(false,true,false,false),'unavailable');
});

test('destination summary retains contextual details outside the compact world label',()=>{
  const destination={kind:'surface' as const,name:'Thorn Vale · Emberfall',detail:'Region level 1–12',biome:'emberfall' as const};
  assert.equal(portalDestinationLabel(destination),'Thorn Vale · Emberfall · Region level 1–12');
});

test('world label keeps its shortcut while fitting long names to measured width',()=>{
  const measure=(value:string)=>value.length*5;
  assert.equal(fitPortalWorldLabel('Vale  [E]',60,measure),'Vale  [E]');
  const fitted=fitPortalWorldLabel('An Extremely Long Destination  [E]',70,measure);
  assert.ok(measure(fitted)<=70); assert.match(fitted,/…  \[E\]$/);
  const bracketBinding=fitPortalWorldLabel('An Extremely Long Destination  []]',70,measure);
  assert.ok(measure(bracketBinding)<=70); assert.ok(bracketBinding.endsWith('…  []]'));
});
