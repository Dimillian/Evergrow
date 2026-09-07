import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseChangelog, changelogDate } from '../src/changelog.ts';
const sample = '## 2026-09-07 — New paths\n### New\n- Three choices.\n> Save notice.\n\n## 2026-09-06 — The world\n### Fixes\n- Better movement.';
test('repository release notes are valid, dated and include historical recaps', () => {
  const entries=parseChangelog(readFileSync(new URL('../../CHANGELOG.md',import.meta.url),'utf8'));
  assert.ok(entries.length>=3);
  assert.ok(entries.every(e=>e.sections.every(s=>s.items.length)));
  assert.ok(entries.slice(1).some(e=>e.notices.includes('Development recap.')));
});
test('release boundaries, sections and notices stay separate', () => {
  const entries=parseChangelog(sample.replaceAll('\n','\r\n'));
  assert.equal(entries.length,2);
  assert.deepEqual(entries[0].notices,['Save notice.']);
  assert.deepEqual(entries[1].sections,[{title:'Fixes',items:['Better movement.']}]);
  assert.equal(changelogDate('2026-09-07'),'7 Sept 2026');
});
test('invalid dates, stale ordering, empty and unsupported formats fail release validation', () => {
  for(const input of ['', sample.replace('2026-09-07','2026-02-30'),sample.replace('2026-09-06','2026-09-08'),
    sample+'\n### Tweaks',sample.replace('### New','### Internal'), sample.replace('- Three choices.','<script>alert(1)</script>'),
    '## Yesterday\n### New\n- Something',sample+'\n## 2026-09-07 — New paths\n### New\n- Duplicate'])
    assert.throws(()=>parseChangelog(input));
});
