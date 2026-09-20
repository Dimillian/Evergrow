import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { SKILL_DEFINITIONS } from '../src/skill-content.ts';
import { SKILL_SPECIALIZATIONS, resolveSkill } from '../src/skill-progression.ts';
import { previewSkillVariant } from '../src/skill-variant-preview.ts';
import { skillEffectValues, skillHeadlineValues, skillValuesMarkup, skillValueChangesMarkup } from '../src/skill-effect-values.ts';

const stats = { manaCostMultiplier: 1, cooldownMultiplier: 1 };
const sheet = new Simulation({ blocked: () => false, move: (x: number, y: number) => ({ x, y }) }, { spawn: false }).player.character;

test('every skill and Technique presents finite, uniquely identified effect values at low and high ranks', () => {
  for (const definition of Object.values(SKILL_DEFINITIONS)) {
    for (const rank of [1, 20]) {
      const variants = [null, ...SKILL_SPECIALIZATIONS.filter(v => v.skill === definition.id)];
      for (const variant of variants) {
        const ranked = { ...sheet, skillRanks: { [definition.id]: rank }, allocatedNodes: ['origin', `skill:${definition.id}`] };
        const resolved = variant ? previewSkillVariant(variant.id, stats, ranked)!.after : resolveSkill(definition.id, stats, ranked, rank);
        const rows = [...skillHeadlineValues(definition.id, resolved), ...skillEffectValues(definition.id, resolved)];
        assert.equal(new Set(rows.map(r => r.key)).size, rows.length, variant?.id ?? definition.id);
        assert.ok(rows.every(r => r.label && r.value));
        assert.doesNotMatch(skillValuesMarkup(definition.id, resolved), /NaN|Infinity|undefined/);
      }
    }
  }
});

test('Fireball separates radius, burn rate/duration and Technique ground fire instead of concatenating prose', () => {
  const base = resolveSkill('fireball', stats);
  assert.deepEqual(skillEffectValues('fireball', base).find(r => r.key === 'burn'), {
    key: 'burn', label: 'Burn', value: '12% hit damage / s', note: 'For 3s',
  });
  assert.equal(skillEffectValues('fireball', base).find(r => r.key === 'radius')?.value, '85 units');
  const ground = SKILL_SPECIALIZATIONS.filter(v => v.skill === 'fireball').map(v => previewSkillVariant(v.id, stats, sheet)!.after)
    .find(r => skillEffectValues('fireball', r).some(v => v.key === 'ground-fire'))!;
  assert.ok(ground);
  const row = skillEffectValues('fireball', ground).find(r => r.key === 'ground-fire')!;
  assert.match(row.value, /% hit damage \/ s/); assert.match(row.note!, /For \ds/);
  assert.equal(skillHeadlineValues('fireball', base).find(r => r.key === 'cooldown')?.value, 'None');
});

test('utility skills and auras expose their actual potency and reservation, without fake damage', () => {
  const ward = resolveSkill('runicWard', stats), aura = resolveSkill('ironroot', stats);
  assert.ok(skillEffectValues('runicWard', ward).some(r => r.key === 'barrier' && r.value.includes('max life') && r.note?.includes('s')));
  assert.ok(!skillHeadlineValues('runicWard', ward).some(r => r.key === 'damage'));
  assert.equal(skillHeadlineValues('ironroot', aura).find(r => r.key === 'mana')?.value, '35%');
  assert.equal(skillEffectValues('ironroot', aura).find(r => r.key === 'armor')?.value, '+40%');
  assert.match(skillValueChangesMarkup('runicWard', ward, resolveSkill('runicWard', stats, undefined, 2)), /Barrier/);
});

test('Technique comparison includes additions and removals, while omitting unchanged fields', () => {
  const base = resolveSkill('fireball', stats);
  const noBurn = structuredClone(base);
  assert.equal(noBurn.recipe.kind, 'projectile');
  if (noBurn.recipe.kind !== 'projectile') return;
  noBurn.recipe = { ...noBurn.recipe, effects: { ...noBurn.recipe.effects, burnDuration: 0 } };
  const removed = skillValueChangesMarkup('fireball', base, noBurn);
  assert.match(removed, /Burn/); assert.match(removed, /<b>—<\/b>/);
  assert.doesNotMatch(removed, /Explosion radius|Cooldown/);
  assert.match(skillValueChangesMarkup('fireball', noBurn, base), /<span>—<\/span>/);
});
