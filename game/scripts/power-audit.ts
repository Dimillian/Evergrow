/** node --experimental-strip-types game/scripts/power-audit.ts [snapshot.json] [report.json] */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildPowerAudit, readAuditSample } from '../src/power-audit.ts';
import { Simulation, FIXED_STEP } from '../src/simulation.ts';
import { applyElementalContact } from '../src/combat-status.ts';
import { ENEMY_DEFINITIONS } from '../src/combat-content.ts';
import type { Enemy, EnemyKind, Input } from '../src/model.ts';

const idle: Input = { moveX: 0, moveY: 0, aimX: 30, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null };
/** Isolated status/AI experiment; deliberately removes damage and knockback. */
export function lightningControlProbe(kind: EnemyKind, rate: number, phase = 0, duration = 30) {
  const sim = new Simulation({ blocked: () => false, move: (x,y) => ({x,y}) }, {spawn:false,seed:7319});
  sim.player.hp = sim.player.maxHp = 1e9;
  const enemy = sim.spawnEnemy(kind, 20, 0)!;
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
  return (['stalker','brute'] as const).flatMap(kind => [0,.5,1,1.25,1.5,2,2.5,3].map(rate => {
    const samples = [0,.17,.41].map(phase => lightningControlProbe(kind,rate,phase));
    return {kind,rate,attacks: samples.reduce((a,b)=>a+b.attacks,0)/samples.length,
      hits: samples.reduce((a,b)=>a+b.hits,0)/samples.length,
      min:Math.min(...samples.map(s=>s.hits)),max:Math.max(...samples.map(s=>s.hits)),duration:30};
  }));
}
if (process.argv[1]?.endsWith('/power-audit.ts')) {
  const report = { ...buildPowerAudit(process.argv[2] ? readAuditSample(readFileSync(process.argv[2],'utf8')) : {}),
    control: controlSweep(), controlAssumptions: 'Actual 120 Hz status/AI loop, 30 seconds, stationary isolated melee foe at 20 units, three pulse phases; lightning status only, no damage or knockback. Attack entries count attempts, not successful hits.' };
  const json = JSON.stringify(report,null,2);
  if (process.argv[3]) writeFileSync(process.argv[3],json); else console.log(json);
}
