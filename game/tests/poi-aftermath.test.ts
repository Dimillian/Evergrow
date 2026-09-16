import test from 'node:test';
import assert from 'node:assert/strict';
import { compactEvents, freshEvents, type EventRecord } from '../src/poi-content.ts';
import { projectSiteAftermath, siteAftermath } from '../src/poi-aftermath.ts';
import type { WildernessSite } from '../src/wilderness-sites.ts';

const site = (kind: WildernessSite['kind'], id = `site:${kind}`) => ({ id, kind });
const record = (id: string, phase: EventRecord['phase']): EventRecord => ({ id, kind: 'corruptedGrove', name: 'Grove', x: 0, y: 0, seed: 1, biome: 'verdant', level: 1, phase, choice: null, delivered: 0, wavesCleared: 0, bonusGranted: false });

test('aftermath follows authoritative completion state for supported sites', () => {
  const events = freshEvents();
  assert.equal(siteAftermath(site('camp'), events, () => 'cleared'), 'abandoned');
  assert.equal(siteAftermath(site('camp'), events, () => 'active'), 'none');
  assert.equal(siteAftermath(site('camp'), events, () => 'dormant'), 'none');
  for (const phase of ['active', 'paused'] as const) {
    events.sites['site:corruptedGrove'] = record('site:corruptedGrove', phase);
    assert.equal(siteAftermath(site('corruptedGrove'), events, () => 'dormant'), 'none');
  }
  for (const phase of ['completed', 'claimed'] as const) {
    events.sites['site:corruptedGrove'] = record('site:corruptedGrove', phase);
    assert.equal(siteAftermath(site('corruptedGrove'), events, () => 'dormant'), 'cleansed');
  }
  for (const [kind, aftermath] of [
    ['ruinedChapel', 'sanctified'], ['beastDen', 'emptied'], ['graveyard', 'quieted'],
    ['cursedChest', 'unbound'], ['quarry', 'depleted'], ['hamlet', 'liberated'], ['crossing', 'opened'],
    ['caravan', 'recovered'], ['watchtower', 'secured'], ['standingStones', 'blessed'],
  ] as const) {
    events.sites[`site:${kind}`] = record(`site:${kind}`, 'completed');
    assert.equal(siteAftermath(site(kind), events, () => 'dormant'), aftermath);
    events.sites[`site:${kind}`].phase = 'claimed';
    assert.equal(siteAftermath(site(kind), events, () => 'dormant'), aftermath);
  }
  assert.equal(siteAftermath(site('bossLair'), events, () => 'cleared'), 'none');
});

test('compacted grove receipts retain aftermath without matching unrelated IDs', () => {
  const events = freshEvents();
  for (let i = 0; i < 40; i++) events.sites[`grove:${i}`] = record(`grove:${i}`, 'claimed');
  compactEvents(events);
  assert.equal(events.sites['grove:0'], undefined);
  assert.equal(siteAftermath(site('corruptedGrove', 'grove:0'), events, () => 'dormant'), 'cleansed');
  assert.equal(siteAftermath(site('corruptedGrove', 'grove:missing'), events, () => 'dormant'), 'none');
  const projection = projectSiteAftermath([site('corruptedGrove', 'grove:0'), site('camp', 'camp:closed')], events, id => id === 'camp:closed' ? 'cleared' : 'dormant');
  assert.deepEqual([...projection], [['grove:0', 'cleansed'], ['camp:closed', 'abandoned']]);
});

test('aftermath projection is read-only', () => {
  const events = freshEvents();
  events.sites['site:corruptedGrove'] = record('site:corruptedGrove', 'completed');
  const before = structuredClone(events);
  const grove = site('corruptedGrove');
  const camp = site('camp');
  projectSiteAftermath([grove, camp], events, id => id === camp.id ? 'cleared' : 'dormant');
  assert.deepEqual(events, before);
});
