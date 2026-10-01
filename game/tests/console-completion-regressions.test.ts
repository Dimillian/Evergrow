import test from 'node:test';
import assert from 'node:assert/strict';
import { consoleSuggestions, parseConsoleCommand } from '../src/console-content.ts';

test('weapon material completion requires an explicitly selected profile', () => {
  assert.deepEqual(consoleSuggestions('drop weapon --material '), []);
  assert.throws(() => parseConsoleCommand('drop weapon --material iron'));
});

test('value completion rejects flags that do not belong to the command', () => {
  for (const raw of ['spawn brute --rarity ', 'drop helmet --rank ', 'drop helmet --placement ']) {
    assert.deepEqual(consoleSuggestions(raw), [], raw);
  }
});

test('completion stays silent when the subject or preceding arguments are invalid', () => {
  for (const raw of [
    'spawn warden --rank ', 'drop nope --rarity ',
    'drop weapon --profile nope --material ', 'spawn brute --rarity rare --r',
  ]) assert.deepEqual(consoleSuggestions(raw), [], raw);
});

test('valid profile/material completion still produces accepted commands', () => {
  const suggestions = consoleSuggestions('drop weapon --profile longsword --material ');
  assert.ok(suggestions.some(s => s.label === 'iron'));
  for (const suggestion of suggestions) {
    assert.equal(parseConsoleCommand(suggestion.value).type, 'drop');
  }
});

test('valid spawn rank and placement completion remain available', () => {
  for (const raw of ['spawn brute --rank ', 'spawn brute --placement ']) {
    const suggestions = consoleSuggestions(raw);
    assert.ok(suggestions.length > 0, raw);
    for (const suggestion of suggestions) {
      assert.equal(parseConsoleCommand(suggestion.value).type, 'spawn');
    }
  }
});

test('every offered value completes to a command accepted by the parser', () => {
  for (const raw of [
    'drop helmet --rarity ', 'drop weapon --profile longsword --material ',
    'spawn brute --rank ', 'spawn brute --placement ',
  ]) for (const suggestion of consoleSuggestions(raw)) {
    assert.doesNotThrow(() => parseConsoleCommand(suggestion.value), `${raw} -> ${suggestion.value}`);
  }
});
