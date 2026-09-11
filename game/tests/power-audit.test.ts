import test from 'node:test';
import assert from 'node:assert/strict';
import { readAuditSample, buildPowerAudit } from '../src/power-audit.ts';
import { lightningControlProbe } from '../scripts/power-audit.ts';
import { Simulation } from '../src/simulation.ts';
import { CharacterRepository } from '../src/character-storage.ts';
import { CharacterSession } from '../src/character-session.ts';

test('cloud summaries never become inferred builds or missing historical metrics', () => {
  const sample = readAuditSample(JSON.stringify({kind:'cloud-observation',name:'Sample',level:32,
    updatedAt:100,summaryPower:1031,metrics:{kills:10},hasFullCheckpoint:true,owner:'private'}));
  const report = buildPowerAudit(sample);
  assert.equal(report.exactBuild,null);
  assert.equal(report.sample!.hasFullCheckpoint,false);
  assert.equal('owner' in report.sample!,false);
  assert.deepEqual(report.observed,{arcDamageShare:null,arcCastShare:null,damageTakenPerKill:null,minutesPlayed:null});
  assert.throws(()=>readAuditSample('{"kind":"cloud-observation","level":0}'));
});

test('full-save imports derive the build without mutating the character or repository', async () => {
  const data = new Map<string,string>();
  const repo = new CharacterRepository({getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,value);}});
  const session = new CharacterSession(repo,4);
  const sim = new Simulation({blocked:()=>false,move:(x,y)=>({x,y})},{spawn:false,seed:7319});
  assert.ok(await session.create(0,'Audit sample',7319,sim.captureCheckpoint(),'audit-sample',100));
  const record=repo.read(0).record!, before=JSON.stringify(record), stored=[...data];
  for (const input of [record,{character:record},{bundle:{character:record}}]) {
    const report=buildPowerAudit(readAuditSample(JSON.stringify(input)));
    assert.equal(report.sample,null);
    assert.equal(report.exactBuild!.level,1);
    assert.ok(report.exactBuild!.basicDps>0);
    assert.equal(report.exactBuild!.arc,null,'a locked skill must not appear as usable');
  }
  assert.equal(JSON.stringify(record),before);
  assert.deepEqual([...data],stored);
});

test('isolated control audit measures actual landed hits and is deterministic', () => {
  const baseline=lightningControlProbe('brute',0,0,10);
  assert.ok(baseline.hits>0);
  const interrupted=lightningControlProbe('brute',2,0,10);
  assert.ok(interrupted.hits<baseline.hits);
  assert.ok(interrupted.hits<=interrupted.attacks);
  assert.deepEqual(lightningControlProbe('brute',2,0,10),interrupted);
});
