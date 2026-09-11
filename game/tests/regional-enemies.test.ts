import { enemyWindupDuration } from '../src/enemy-threat.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ENEMY_DEFINITIONS, ENEMY_SIGNATURE_ATTACKS, REGIONAL_ENEMY_KINDS, enemyAttackVariant, enemyAttackDefinition, isRegionalEnemy } from '../src/combat-content.ts';
import { ENCOUNTER_WEIGHTS, chooseEncounterEnemy } from '../src/encounter-director.ts';
import { ROAMING_GROUPS } from '../src/roaming-encounters.ts';
import { Simulation } from '../src/simulation.ts';
import { updateEnemyAI, type EnemyAIContext } from '../src/enemy-ai.ts';
import { enemyWarnings } from '../src/enemy-warning-art.ts';
import { drawRegionalEnemy } from '../src/regional-enemy-art.ts';
import { ENEMY_BODY_BOUNDS } from '../src/enemy-body.ts';
import type { EnemyKind, WorldQuery, CombatEvent } from '../src/model.ts';
import type { BiomeId } from '../src/biomes.ts';

const world: WorldQuery = { blocked: () => false, move: (x,y,dx,dy) => ({x:x+dx,y:y+dy}) };
function fixture(kind: EnemyKind, elite=false) {
  const sim=new Simulation(world,{spawn:false}),enemy=sim.spawnEnemy(kind,-20,0,elite?'elite':'normal')!;
  const damage:number[]=[],events:CombatEvent[]=[];
  const context:EnemyAIContext={player:sim.player,enemies:sim.enemies,world,time:0,trial:null,visible:()=>true,
    move:(e,vx,vy,dt)=>{e.x+=vx*dt;e.y+=vy*dt;},hurt:(amount)=>damage.push(amount),
    shoot:(_e,_a,d)=>damage.push(d.damage),emit:e=>events.push(e)};
  return {sim,enemy,context,damage,events};
}
function begin(f:ReturnType<typeof fixture>,turn:number) {
  const e=f.enemy;e.attackTurns=turn;e.state='chase';e.stateTime=0;e.senseTime=1;e.awareness=1;e.seesPlayer=true;e.lostSightTime=0;
  e.x=e.homeX=ENEMY_DEFINITIONS[e.kind].attack==='melee'?-20:-200;
  updateEnemyAI(e,1/120,f.context);assert.equal(e.state,'windup');
}

test('regional enemies commit two basics then a signature, with immutable timing and source-scaled damage',()=>{
  for(const kind of REGIONAL_ENEMY_KINDS) {
    const f=fixture(kind,true);
    for(let turn=0;turn<4;turn++) {
      begin(f,turn%3);
      const d=enemyAttackDefinition(f.enemy);
      assert.equal(f.enemy.attackVariant,enemyAttackVariant({...f.enemy,attackTurns:turn%3}));
      assert.equal(f.enemy.stateDuration,enemyWindupDuration(f.enemy,d.windup));
      assert.ok(Object.isFrozen(d));
      assert.ok(d.aimLock<d.windup);
      assert.equal(f.enemy.attackTurns,(turn+1)%3);
      const expected=f.enemy.damage*d.damage/ENEMY_DEFINITIONS[kind].damage;
      assert.ok(Math.abs(f.enemy.attackDamage!-expected)<1e-8);
      f.sim.player.level=100; // Turning or levelling during commitment cannot re-roll damage.
      f.enemy.stateTime=f.enemy.stateDuration;
      updateEnemyAI(f.enemy,1/120,f.context);
      if(d.attack==='melee')updateEnemyAI(f.enemy,1/120,f.context);
      assert.ok(Math.abs(f.damage.at(-1)!-expected)<1e-8,kind);
      assert.equal(enemyAttackDefinition(f.enemy),d,'release retains the committed action');
      if(d.attack==='ground')assert.equal(f.events.at(-1)?.style,d.blastStyle);
    }
  }
});

test('signature ground strikes lock their warning and can be escaped; walls suppress damage',()=>{
  for(const kind of REGIONAL_ENEMY_KINDS.filter(k=>ENEMY_SIGNATURE_ATTACKS[k]?.attack==='ground')) {
    const f=fixture(kind);begin(f,2);const d=enemyAttackDefinition(f.enemy);
    assert.equal(d.attack,'ground');if(d.attack!=='ground')continue;
    assert.ok(d.windup-d.aimLock>=.8);
    const initial=enemyWarnings(f.enemy)[0];assert.equal(initial.shape.kind,'circle');
    f.enemy.stateTime=d.aimLock+.01;f.sim.player.x=150;
    updateEnemyAI(f.enemy,1/120,f.context);
    assert.equal(f.enemy.attackTargetX,0);assert.equal(enemyWarnings(f.enemy)[0].x,initial.x);
    f.enemy.stateTime=f.enemy.stateDuration;updateEnemyAI(f.enemy,1/120,f.context);
    assert.equal(f.damage.length,0,`${kind}: walking out avoids the burst`);
    f.sim.player.x=0;begin(f,2);f.enemy.stateTime=f.enemy.stateDuration;f.context.visible=()=>false;
    updateEnemyAI(f.enemy,1/120,f.context);assert.equal(f.damage.length,0,'cannot hit through a wall');
  }
});

test('ground signature contacts happen once; sanctuary cancels them',()=>{
  for(const kind of ['mireSpitter','frostRevenant','emberAcolyte'] as const) {
    const f=fixture(kind);begin(f,2);f.enemy.stateTime=f.enemy.stateDuration;
    updateEnemyAI(f.enemy,1/120,f.context);
    for(let i=0;i<20;i++)updateEnemyAI(f.enemy,1/120,f.context);
    assert.equal(f.damage.length,1);
    begin(f,2);f.context.world={...world,isSanctuary:()=>true};f.enemy.stateTime=f.enemy.stateDuration;
    updateEnemyAI(f.enemy,1/120,f.context);assert.ok(['return','idle'].includes(f.enemy.state));assert.equal(f.damage.length,1);
  }
});

test('ordinary regional bolts have no floor warnings and lunges retain the red committed lane',()=>{
  for(const kind of ['mireSpitter','emberAcolyte','stormSentinel'] as const) {
    const f=fixture(kind);begin(f,0);assert.deepEqual(enemyWarnings(f.enemy),[]);
    begin(f,2);assert.equal(enemyWarnings(f.enemy)[0].color,kind==='stormSentinel'?'#f34e60':'#e83d59');
    if(kind==='stormSentinel')assert.equal(enemyWarnings(f.enemy).length,5);
  }
  const f=fixture('duneScuttler');begin(f,2);
  assert.equal(enemyWarnings(f.enemy)[0].shape.kind,'lane');assert.equal(enemyWarnings(f.enemy)[0].color,'#f34e60');
});

test('regional encounters are common in their habitats and excluded from unrelated climates',()=>{
  const habitats:Partial<Record<BiomeId,EnemyKind>>={verdant:'thornReaver',swamp:'mireSpitter',frostpine:'frostRevenant',emberfall:'emberAcolyte',sunscar:'duneScuttler',highlands:'stormSentinel'};
  for(const biome of Object.keys(ENCOUNTER_WEIGHTS) as BiomeId[]) {
    const weights=ENCOUNTER_WEIGHTS[biome];assert.equal(Object.values(weights).reduce((a,b)=>a+b,0),100);
    const selected=Array.from({length:100},(_,i)=>chooseEncounterEnemy(biome,()=> (i+.5)/100));
    assert.ok(selected.filter(isRegionalEnemy).length>=35,biome);
    for(const kind of selected)assert.ok(weights[kind]>0);
    const native=habitats[biome];if(native)assert.ok(selected.filter(k=>k===native).length>=40);
    for(const leader of selected)for(const preferred of ROAMING_GROUPS[leader]??[])
      assert.ok(weights[chooseEncounterEnemy(biome,()=>.5,preferred)]>0,'packs respect biome exclusions');
  }
  assert.equal(ENCOUNTER_WEIGHTS.sunscar.frostRevenant,0);
  assert.equal(ENCOUNTER_WEIGHTS.frostpine.emberAcolyte,0);
});

class FigureContext {
  fillStyle='';strokeStyle='';lineWidth=1;lineJoin='';lineCap='';points=0;
  minX=Infinity;maxX=-Infinity;minY=Infinity;maxY=-Infinity;
  beginPath(){} closePath(){} fill(){} stroke(){}
  moveTo(x:number,y:number){assert.ok(Number.isFinite(x)&&Number.isFinite(y));this.points++;this.minX=Math.min(this.minX,x);this.maxX=Math.max(this.maxX,x);this.minY=Math.min(this.minY,y);this.maxY=Math.max(this.maxY,y);}
  lineTo(x:number,y:number){this.moveTo(x,y);}
}
test('regional anatomy stays inside its aiming and visibility bounds across facings and actions',()=>{
  for(const kind of REGIONAL_ENEMY_KINDS)for(let i=0;i<16;i++)for(const attack of [0,-.5,-1,.2,.6,1]) {
    const c=new FigureContext(),bounds=ENEMY_BODY_BOUNDS[kind],angle=i*Math.PI/8;
    drawRegionalEnemy(c as unknown as CanvasRenderingContext2D,{kind,angle,attack,attackAngle:angle,time:2.7,moving:1,hitFlash:0,dodging:false},v=>v);
    assert.ok(c.points>100,kind);
    assert.ok(c.minX>=-bounds.radiusX&&c.maxX<=bounds.radiusX,`${kind} width: ${c.minX}..${c.maxX}`);
    assert.ok(c.minY>=bounds.top&&c.maxY<=bounds.bottom,`${kind} height: ${c.minY}..${c.maxY}`);
  }
});
