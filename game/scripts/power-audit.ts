/** node --experimental-strip-types game/scripts/power-audit.ts [snapshot.json] [report.json] */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildPowerAudit, readAuditSample } from '../src/power-audit.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { applyElementalContact } from '../src/combat-status.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import type { EnemyRank } from '../src/progression-content.ts';
import type { Enemy, EnemyKind, Input } from '../src/model.ts';

const idle: Input = { moveX: 0, moveY: 0, aimX: 30, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
/** Isolated status/AI experiment; deliberately removes damage and knockback. */
export function lightningControlProbe(kind: EnemyKind, rate: number, phase = 0, duration = 30, rank: EnemyRank = 'normal') {
  const sim = new Simulation({ blocked: () => false, move: (x,y) => ({x,y}) }, {spawn:false,seed:7319});
  sim.player.hp = sim.player.maxHp = 1e9;
  const enemy = sim.spawnEnemy(kind, 20, 0, rank, undefined, {base:32,min:32,max:32,fixed:true})!;
  enemy.angle = enemy.attackAngle = Math.PI;
  enemy.state = 'windup'; enemy.stateTime = 0; enemy.stateDuration = ENEMY_DEFINITIONS[kind].windup;
  sim.drainEvents();
  let next = phase, attacks = 0, hits = 0;
  const state = (): Enemy['state'] => enemy.state;
  for (let tick = 0; tick < duration / FIXED_STEP; tick++) {
    if (rate > 0 && tick * FIXED_STEP >= next) { applyElementalContact(enemy, 'lightning', 1); next += 1 / rate; }
    const before = state();
    sim.update(FIXED_STEP, idle);
    if (state() === 'attack' && before !== 'attack') attacks++;
    hits += sim.drainEvents().filter(event => event.type === 'hurt').length;
  }
  return { attacks, hits };
}
export function controlSweep() {
  return (['normal','veteran','elite'] as const).flatMap(rank => (['stalker','brute'] as const).flatMap(kind => [0,.5,1,1.25,1.5,2,2.5,3].map(rate => {
    const samples = [0,.17,.41].map(phase => lightningControlProbe(kind,rate,phase,30,rank));
    return {kind,rank,rate,attacks: samples.reduce((a,b)=>a+b.attacks,0)/samples.length,
      hits: samples.reduce((a,b)=>a+b.hits,0)/samples.length,
      min:Math.min(...samples.map(s=>s.hits)),max:Math.max(...samples.map(s=>s.hits)),duration:30};
  })));
}

/** Stationary, non-attacking level-32 target; real damage guards and AI, no playable save. */
export function enemyPressureProbe(kind: EnemyKind, rank: EnemyRank, distance: number, count = 1, duration = 30) {
  const sim = new Simulation({blocked:()=>false,move:(x,y,dx,dy)=>({x:x+dx,y:y+dy})},{spawn:false,seed:7319});
  sim.player.hp=sim.player.maxHp=1e9;
  for(let i=0;i<count;i++) {
    const angle=i*Math.PI*2/count;
    const enemy=sim.spawnEnemy(kind,Math.cos(angle)*distance,Math.sin(angle)*distance,rank,undefined,{base:32,min:32,max:32,fixed:true})!;
    enemy.state='chase';enemy.awareness=1;
  }
  sim.drainEvents();
  const hits:{time:number;damage:number}[]=[];let attacks=0;
  for(let tick=0;tick<duration/FIXED_STEP;tick++) {
    const states=sim.enemies.map(e=>e.state);
    sim.update(FIXED_STEP,idle);
    for(let i=0;i<sim.enemies.length;i++)if(sim.enemies[i].state==='attack'&&states[i]!=='attack')attacks++;
    for(const e of sim.drainEvents())if(e.type==='hurt')hits.push({time:tick*FIXED_STEP,damage:e.actualValue??e.value});
  }
  return {kind,rank,distance,count,duration,attacks,hits:hits.length,firstHit:hits[0]?.time??null,
    damagePerSecond:hits.reduce((s,h)=>s+h.damage,0)/duration,
    largestHit:Math.max(0,...hits.map(h=>h.damage)),
    peakHalfSecond:Math.max(0,...hits.map(h=>hits.filter(other=>other.time>=h.time&&other.time<h.time+.5).reduce((s,v)=>s+v.damage,0)))};
}
if (process.argv[1]?.endsWith('/power-audit.ts')) {
  const report = { ...buildPowerAudit(process.argv[2] ? readAuditSample(readFileSync(process.argv[2],'utf8')) : {}),
    pressureProbe: [enemyPressureProbe('brute','elite',45),enemyPressureProbe('archer','elite',210),
      enemyPressureProbe('warden','normal',280),enemyPressureProbe('ashColossus','normal',280),enemyPressureProbe('stalker','normal',30,12)],
    pressureAssumptions: 'Thirty-second stationary non-attacking target in open terrain; level-32 enemies, starter defenses with huge life to prevent death. Real AI, projectiles and hurt guard. Peak damage sums landed hits within 0.5s; not a geared-player or moving-player survival forecast.',
    control: controlSweep(), controlAssumptions: 'Actual 120 Hz status/AI loop, 30 seconds, level-32 stationary isolated melee foe at 20 units, three pulse phases and all ordinary ranks; lightning status only, no damage or knockback. Attacks count attack entries; hits count landed hurt events.' };
  const json = JSON.stringify(report,null,2);
  if (process.argv[3]) writeFileSync(process.argv[3],json); else console.log(json);
}
