import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { damageEnemy } from '../src/combat-damage.ts';
import { applyStun, advanceEnemyStatuses } from '../src/combat-status.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import { enemyRecoveryDuration } from '../src/enemy-threat.ts';
import { scaledEnemyStats } from '../src/zone-progression.ts';
import { lightningControlProbe } from '../scripts/power-audit.ts';
import { ENCOUNTER_WEIGHTS, chooseEncounterEnemy } from '../src/encounter-director.ts';
import { roamingEscortRole, ROAMING_RULES } from '../src/roaming-encounters.ts';
import type { EnemyKind } from '../src/model.ts';
import type { EnemyRank } from '../src/progression-content.ts';
import type { BiomeId } from '../src/biomes.ts';

function fixture(rank:EnemyRank='normal',kind:EnemyKind='stalker') {
  const sim=new Simulation({blocked:()=>false,move:(x,y)=>({x,y})},{spawn:false});
  const enemy=sim.spawnEnemy(kind,20,0,rank,undefined,{base:32,min:32,max:32,fixed:true})!;
  return {sim,enemy};
}
test('dangerous ranks recover from repeated control and still land attacks across pulse phases',()=>{
  for(const kind of ['stalker','brute'] as const)for(const rank of ['veteran','elite'] as const)
    for(const rate of [1,1.5,2,3])for(const phase of [0,.17,.41])
      assert.ok(lightningControlProbe(kind,rate,phase,30,rank).hits>0,`${rank} ${kind}: ${rate}, ${phase}`);
  for(const kind of ['warden','briarMatriarch','ashColossus','graveMarshal'] as const)
    for(const phase of [0,.17,.41])assert.ok(lightningControlProbe(kind,2,phase).hits>0,kind);
  assert.equal(lightningControlProbe('brute',2).hits,0,'ordinary targets remain controllable');
});
test('weak interruptions never accelerate ordinary attack cadence',()=>{
  for(const kind of ['stalker','brute'] as const) {
    const baseline=lightningControlProbe(kind,0).attacks;
    for(const rate of [.5,1,1.25])for(const phase of [0,.17,.41])
      assert.ok(lightningControlProbe(kind,rate,phase).attacks<=baseline);
  }
});
test('melee and freeze share elite immunity without blocking damage or spending it on rejected control',()=>{
  const {sim,enemy}=fixture('elite');enemy.state='windup';enemy.stateDuration=.42;
  applyStun(enemy,2,'freeze');assert.equal(enemy.stagger,.6);
  advanceEnemyStatuses(enemy,.6,()=>{});
  const immunity=enemy.controlImmunity!,duration=enemy.stateDuration,hp=enemy.hp;
  applyStun(enemy,4);assert.equal(enemy.stagger,0);assert.equal(enemy.controlImmunity,immunity);
  damageEnemy(enemy,1,0,true,{player:sim.player,enemies:sim.enemies,random:()=>1,visible:()=>true,emit:()=>{},killed:()=>assert.fail()});
  assert.equal(enemy.hp,hp-1);assert.equal(enemy.stagger,0);
  assert.equal(enemy.stateDuration,duration);assert.equal(enemy.controlImmunity,immunity);
  advanceEnemyStatuses(enemy,immunity,()=>{});applyStun(enemy,1);
  assert.ok(enemy.stagger>0,'control becomes available again');
  const frozenTime=enemy.stateTime;advanceEnemyStatuses(enemy,.01,()=>{});
  assert.ok(enemy.stateTime<=frozenTime,'recovery cannot advance during a stun');
});
test('rank tuning preserves normal life, rewards, windups and immutable source stats',()=>{
  const ordinary=scaledEnemyStats('stalker',32,'normal'),elite=scaledEnemyStats('stalker',32,'elite');
  assert.deepEqual(ordinary,{maxHp:653,damage:42,xpReward:132});
  assert.equal(elite.maxHp,2612);assert.equal(elite.damage,79);assert.equal(elite.xpReward,658);
  const {sim,enemy}=fixture('elite'),before={damage:enemy.damage,hp:enemy.maxHp,lootSeed:enemy.lootSeed,level:enemy.level};
  sim.player.level=99;assert.deepEqual({damage:enemy.damage,hp:enemy.maxHp,lootSeed:enemy.lootSeed,level:enemy.level},before);
  assert.equal(ENEMY_DEFINITIONS.stalker.windup,.42);
  assert.equal(enemyRecoveryDuration(enemy,1),.65);
  assert.equal(enemyRecoveryDuration({kind:'warden',rank:'normal'},1),.65);
});
test('elite escorts complement their leader within each biome without increasing pack size',()=>{
  for(const biome of Object.keys(ENCOUNTER_WEIGHTS) as BiomeId[])for(const leaderKind of ['stalker','caster'] as const) {
    const leader={kind:leaderKind,rank:'elite' as const};
    for(const index of [1,2]){
      const role=roamingEscortRole(leader,index)!;
      for(const roll of [0,.25,.5,.99]){
        const chosen=chooseEncounterEnemy(biome,()=>roll,undefined,role);
        assert.ok(ENCOUNTER_WEIGHTS[biome][chosen]>0);
        assert.equal(ENEMY_DEFINITIONS[chosen].role,role);
      }
    }
  }
  assert.equal(roamingEscortRole({kind:'stalker',rank:'normal'},1),undefined);
  assert.equal(roamingEscortRole({kind:'stalker',rank:'elite'},3),undefined);
  assert.equal(ROAMING_RULES.maxGroupSize,20);
});

test('reloading a pre-tuning actor preserves wounds, identity and level while deriving current damage',()=>{
  const {sim,enemy}=fixture('elite');enemy.hp-=20;Object.assign(enemy,{damage:63});
  const before={hp:enemy.hp,level:enemy.level,rank:enemy.rank,lootSeed:enemy.lootSeed};
  const saved=sim.captureCheckpoint();sim.restoreCheckpoint(saved);
  const restored=sim.enemies.find(e=>e.lootSeed===before.lootSeed)!;
  assert.ok(restored);assert.deepEqual({hp:restored.hp,level:restored.level,rank:restored.rank,lootSeed:restored.lootSeed},before);
  assert.equal(restored.damage,79);
});
