import assert from 'node:assert/strict';
import test from 'node:test';
import { CursorPreference, CURSOR_STYLES, CURSOR_STORAGE_KEY, CURSOR_SIZE_STORAGE_KEY, DEFAULT_CURSOR } from '../src/cursor-content.ts';

test('cursor preference survives reloads without writing other device settings', () => {
  const data = new Map<string, string>([['evergrow-controls-v1', 'existing bindings']]);
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  for (const style of CURSOR_STYLES) {
    const preference = new CursorPreference(storage);
    assert.equal(preference.select(style.id), 'saved');
    assert.equal(new CursorPreference(storage).style, style.id);
  }
  assert.equal(data.get('evergrow-controls-v1'), 'existing bindings');
  data.set(CURSOR_STORAGE_KEY, 'removed-style');
  const preference = new CursorPreference(storage);
  assert.equal(preference.style, DEFAULT_CURSOR);
  assert.equal(preference.select('unknown'), 'invalid');
  assert.equal(preference.style, DEFAULT_CURSOR);
  assert.equal(data.get(CURSOR_STORAGE_KEY), 'removed-style');
});

test('blocked storage keeps cursor selection usable for this session', () => {
  const preference = new CursorPreference({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } });
  assert.equal(preference.style, DEFAULT_CURSOR);
  assert.equal(preference.select('diamond'), 'session');
  assert.equal(preference.style, 'diamond');
  assert.equal(preference.setSize(250), 'session');
  assert.equal(preference.size, 250);
  assert.equal(new CursorPreference().select('halo'), 'session');
});

test('size persists independently of shape, rejects invalid values, and resets durably', () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const preference = new CursorPreference(storage);
  assert.equal(preference.size, 100);
  assert.equal(preference.setSize(50), 'saved');
  assert.equal(new CursorPreference(storage).size, 50);
  assert.equal(preference.setSize(250), 'saved');
  preference.select('diamond');
  assert.equal(new CursorPreference(storage).size, 250);
  for (const value of [null, '150', NaN, Infinity, 40, 260, 155]) {
    assert.equal(preference.setSize(value), 'invalid');
    assert.equal(preference.size, 250);
  }
  for (const value of [null, NaN, Infinity, 40, 260, 155]) {
    data.set(CURSOR_SIZE_STORAGE_KEY, String(value));
    assert.equal(new CursorPreference(storage).size, 100);
  }
  assert.equal(preference.reset(), 'saved');
  const restored = new CursorPreference(storage);
  assert.equal(restored.style, DEFAULT_CURSOR);
  assert.equal(restored.size, 100);
});
