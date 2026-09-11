import test from 'node:test';
import assert from 'node:assert/strict';
import { resourceBenchmark } from '../src/resource-benchmark.ts';
import { resourceEncounter } from '../scripts/resource-benchmark.ts';

test('resource fixtures are deterministic and distinguish focused sustain investment',()=>{
  const a=resourceBenchmark();assert.deepEqual(a,resourceBenchmark());assert.equal(a.length,28);
  for(const level of [10,20,35,50]) {
    const strong=a.find(x=>x.level===level&&x.style==='caster'&&x.gear==='strong')!;
    const sustain=a.find(x=>x.level===level&&x.style==='caster'&&x.gear==='sustain')!;
    assert.ok(sustain.regen>strong.regen);assert.equal(sustain.expectedFirstHit,strong.expectedFirstHit);
  }
});
test('headless benchmark casts at visible foes and reconciles real recovery sources',()=>{
  const result=resourceEncounter(35,'caster','strong','boss');
  assert.ok(result.damage>0);assert.ok(result.manaSpent>0);assert.ok(result.enemyAttacks>0);
  assert.ok(Math.abs(Object.values(result.manaSources).reduce((a,b)=>a+b,0)-result.manaRestored)<1e-6);
  assert.deepEqual(result,resourceEncounter(35,'caster','strong','boss'));
});
