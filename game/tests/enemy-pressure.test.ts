import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.ts';
import { updateEnemyAI, type EnemyAIContext } from '../src/enemy-ai.ts';
import { updateWarden } from '../src/dungeon-boss.ts';
import { updateWildernessBoss } from '../src/wilderness-boss.ts';
import { ENEMY_DEFINITIONS, ELITE_QUICK_ATTACKS, enemyAttackDefinition } from '../src/combat-content.ts';
import { BOSS_PRESSURE } from '../src/boss-pressure.ts';
import { enemyWarnings } from '../src/enemy-warning-art.ts';
import { enemyPressureProbe } from '../scripts/power-audit.ts';
import type { EnemyKind } from '../src/model.ts';

function fixture(kind: EnemyKind, distance=45, seed=7319) {
  const world={blocked:()=>false,move:(x:number,y:number,dx:number,dy:number)=>({x:x+dx,y:y+dy})};
  const sim=new Simulation(world,{spawn:false,seed});
  const enemy=sim.spawnEnemy(kind,-distance,0,'elite',undefined,{base:32,min:32,max:32,fixed:true})!;
  const hits:number[]=[],shots:{angle:number;damage:number}[]=[];
  const context:EnemyAIContext={world,player:sim.player,enemies:sim.enemies,time:0,trial:null,visible:()=>true,
    move:()=>{},hurt:damage=>hits.push(damage),shoot:(_e,angle,d)=>shots.push({angle,damage:d.damage}),emit:()=>{}};
  const update=()=>kind==='warden'?updateWarden(enemy,1/120,context)
    :['briarMatriarch','ashColossus','graveMarshal'].includes(kind)?updateWildernessBoss(enemy,1/120,context)
      :updateEnemyAI(enemy,1/120,context);
  function begin(turn=0) {
    enemy.state='chase';enemy.stateTime=0;enemy.awareness=1;enemy.seesPlayer=true;enemy.senseTime=1;
    enemy.attackTurns=turn;enemy.bossTurns=turn;update();assert.equal(enemy.state,'windup');
  }
  function release(){enemy.stateTime=enemy.stateDuration;update();update();}
  return {sim,enemy,context,hits,shots,begin,release,update};
}

test('elite quick basics are weaker and alternate with the full attack while source stats stay fixed',()=>{
  for(const kind of ['brute','archer','thornReaver','caster'] as const) {
    const f=fixture(kind,kind==='archer'||kind==='caster'?210:45), original=f.enemy.damage;
    for(let turn=0;turn<3;turn++) {
      f.begin(turn);const d=enemyAttackDefinition(f.enemy);
      assert.equal(f.enemy.attackVariant,turn<2?2:kind==='thornReaver'?1:0);
      if(turn<2) {
        assert.ok(d.windup<=(d.attack==='melee'?.5:.6));
        assert.equal(f.enemy.attackDamage,original*.75);
        if(d.attack==='projectile')assert.equal(d.shotOffsets.length,1);
      }
      f.release();assert.ok(f.hits.length+f.shots.length>turn);
      assert.equal(f.enemy.damage,original);
    }
  }
  assert.equal(ELITE_QUICK_ATTACKS.wisp,undefined,'ground blasts retain their escape window');
  assert.equal(ELITE_QUICK_ATTACKS.hound,undefined,'pounces retain their lane warning');
});

test('melee follows during preparation and locks both its warning and strike before release',()=>{
  const f=fixture('brute');f.begin();
  const d=enemyAttackDefinition(f.enemy), before=f.enemy.attackAngle;
  f.enemy.stateTime=d.aimLock-.02;f.sim.player.y=20;f.update();
  assert.notEqual(f.enemy.attackAngle,before);assert.equal(enemyWarnings(f.enemy)[0].locked,false);
  const locked=f.enemy.attackAngle;
  f.enemy.stateTime=d.aimLock+.01;f.sim.player.y=-20;f.update();
  assert.equal(f.enemy.attackAngle,locked);assert.equal(enemyWarnings(f.enemy)[0].locked,true);
  f.sim.player.x=-150;f.release();assert.equal(f.hits.length,0,'leaving the committed sector avoids contact');
});

test('every boss selects a ranged major instead of waiting for an unreachable sweep',()=>{
  for(const kind of ['warden','briarMatriarch','ashColossus','graveMarshal'] as const) {
    const f=fixture(kind,280);f.begin();
    assert.notEqual(f.enemy.bossMove,'sweep');assert.ok(f.enemy.stateDuration>=.85);
    f.begin(1);assert.equal(f.enemy.bossMove,'bolt');
    const warning=enemyWarnings(f.enemy)[0];assert.equal(warning.shape.kind,'lane');
    f.release();assert.equal(f.shots.length,1);assert.equal(f.shots[0].damage,f.enemy.damage*BOSS_PRESSURE.bolt.damage);
    for(let i=0;i<20;i++)f.update();assert.equal(f.shots.length,1,'one projectile per quick action');
  }
});

test('boss jabs use the same compact committed sector as their warning and hit only once',()=>{
  for(const kind of ['warden','briarMatriarch','ashColossus','graveMarshal'] as const) {
    const f=fixture(kind,60);f.begin(1);assert.equal(f.enemy.bossMove,'jab');
    assert.deepEqual(enemyWarnings(f.enemy)[0].shape,{kind:'sector',radius:BOSS_PRESSURE.jab.range,arc:BOSS_PRESSURE.jab.arc});
    f.enemy.stateTime=.2;f.sim.player.y=10;f.update();const angle=f.enemy.attackAngle;
    f.enemy.stateTime=.35;f.sim.player.y=0;f.update();assert.equal(f.enemy.attackAngle,angle);
    f.release();assert.deepEqual(f.hits,[f.enemy.damage*.55]);
    for(let i=0;i<20;i++)f.update();assert.equal(f.hits.length,1);
    f.begin(1);f.context.visible=()=>false;f.release();assert.equal(f.hits.length,1,'new cover blocks contact');
  }
});

test('quick boss shots respect new cover, sanctuary and their aim lock',()=>{
  for(const kind of ['warden','ashColossus'] as const) {
    const f=fixture(kind,280);f.begin(1);
    f.enemy.stateTime=.4;const aim=f.enemy.attackAngle;f.sim.player.y=50;f.update();
    assert.equal(f.enemy.attackAngle,aim);
    f.context.visible=()=>false;f.release();assert.equal(f.shots.length,0);
    f.context.visible=()=>true;f.begin(1);f.context.world={...f.context.world,isSanctuary:()=>true};
    f.release();assert.equal(f.shots.length,0);
  }
});

test('pack rhythms differ while every actor may start preparing concurrently',()=>{
  const durations:number[]=[];
  for(let seed=0;seed<16;seed++) {
    const f=fixture('stalker',30,seed);f.begin();durations.push(f.enemy.stateDuration);
    assert.ok(f.enemy.stateDuration>=ENEMY_DEFINITIONS.stalker.windup);
    assert.ok(f.enemy.stateDuration<ENEMY_DEFINITIONS.stalker.windup+.12);
  }
  assert.ok(new Set(durations).size>12);
  assert.ok(Math.max(...durations)-Math.min(...durations)>.08);
});

test('measured elite pressure rises without increasing individual or half-second burst damage',()=>{
  for(const [kind,distance,previousHits,previousPeak] of [['brute',45,15,218],['archer',210,17,109]] as const) {
    const p=enemyPressureProbe(kind,'elite',distance);
    assert.ok(p.hits>previousHits,`${kind}: ${p.hits}`);
    assert.ok(p.largestHit<=previousPeak);assert.ok(p.peakHalfSecond<=previousPeak);
  }
  for(const kind of ['warden','ashColossus'] as const) {
    const p=enemyPressureProbe(kind,'elite',280);
    assert.ok(p.firstHit!==null&&p.firstHit<2,'a boss responds promptly at range');
    assert.ok(p.hits>=12);
  }
  const pack=enemyPressureProbe('stalker','normal',30,12);
  assert.ok(pack.peakHalfSecond<=pack.largestHit*2,'hurt guard still bounds stacked contacts');
});
