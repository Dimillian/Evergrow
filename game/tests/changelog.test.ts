import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseChangelog, changelogDate } from '../src/changelog.ts';
const sample = '## v0.3.0 — 2026-09-07T11:19:00Z\n### New\n- Three choices.\n> Save notice.\n\n## v0.2.0 — 2026-09-06T17:27:00Z\n### Fixes\n- Better movement.';
test('repository notes have unique versions, timestamps and historical recaps', () => {
  const entries = parseChangelog(readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8'));
  assert.ok(entries.length >= 3);
  assert.equal(new Set(entries.map(e => e.version)).size, entries.length);
  for(const [i,e]of entries.entries()){
    const [major,minor,patch]=e.version.split('.').map(Number);assert.equal(major,0);assert.ok(minor<5,'prototype releases stay below 0.5');
    if(i){const previous=entries[i-1].version.split('.').map(Number);assert.ok(previous[1]>minor||previous[1]===minor&&previous[2]>patch,'versions remain newest first');}
  }
  assert.ok(entries.slice(1).some(e => e.notices.includes('Development recap.')));
});
test('release boundaries, sections, notices and Paris timestamps stay explicit', () => {
  const entries = parseChangelog(sample.replaceAll('\n', '\r\n'));
  assert.equal(entries[0].version, '0.3.0');
  assert.deepEqual(entries[0].notices, ['Save notice.']);
  assert.deepEqual(entries[1].sections, [{ title: 'Fixes', items: ['Better movement.'] }]);
  assert.match(changelogDate(entries[0].date), /7 Sept 2026.*13:19/);
  assert.match(changelogDate('2026-01-07T11:19:00Z'), /7 Jan 2026.*12:19/);
});
test('invalid dates, times, ordering, duplicate versions and unsupported formats fail', () => {
  for (const input of ['', sample.replace('2026-09-07', '2026-02-30'), sample.replace('11:19', '25:19'),
    sample.replace('2026-09-06', '2026-09-08'), sample.replace('v0.2.0', 'v0.3.0'), sample + '\n### Tweaks',
    sample.replace('### New', '### Internal'), sample.replace('- Three choices.', '<script>alert(1)</script>'),
    '## 2026-09-07 — Old title\n### New\n- Something']) assert.throws(() => parseChangelog(input));
});
