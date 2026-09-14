import { riftCanChannel } from './rift-tactics.ts';
import { riftMechanic, RIFT_TACTICS as RT } from './rift-encounters.ts';
import { BOSS_PRESSURE } from './boss-pressure.ts';
import { drawWildernessBossImpact } from './wilderness-boss-effect-art.ts';
import { isWildernessBoss, LAIR_RULES as R } from './wilderness-boss-content.ts';
import type { Enemy } from './model.ts';
import { enemyAttackDefinition } from './combat-content.ts';
import { WARDEN_RULES, wardenProfile } from './dungeon-boss.ts';
import { drawAttackWarning, type WarningShape } from './attack-warning-art.ts';
import { drawGlow, type PointLight } from './lighting.ts';

interface Warning { x: number; y: number; angle: number; shape: WarningShape; color: string; progress: number; locked: boolean }
export function enemyWarnings(e: Enemy, alpha = 1): Warning[] {
  if(e.hp>0&&e.riftWarning){const w=e.riftWarning;return [{x:w.x,y:w.y,angle:w.angle,progress:1-w.remaining/RT.warning,locked:true,color:w.kind==='storm'?'#cca3ff':'#ff935f',shape:w.kind==='storm'?{kind:'circle',radius:RT.stormRadius}:{kind:'sector',radius:RT.fireRadius,arc:RT.fireArc}}];}
  if (e.hp <= 0 || (e.state !== 'windup' && e.state !== 'attack')) return [];
  const d = enemyAttackDefinition(e), x = e.prevX + (e.x - e.prevX) * alpha, y = e.prevY + (e.y - e.prevY) * alpha;
  const progress = e.state === 'attack' ? 1 : Math.min(1, e.stateTime / Math.max(.01, e.stateDuration));
  const base = { x, y, angle: e.attackAngle, progress, locked: e.state === 'attack' || e.stateTime >= d.aimLock, color: '#f34e60' };
  if((isWildernessBoss(e.kind)||e.kind==='warden')&&(e.bossMove==='jab'||e.bossMove==='bolt')) {
    const rule=BOSS_PRESSURE[e.bossMove], locked=e.state==='attack'||e.stateTime>=rule.aimLock;
    return [{...base,locked,shape:e.bossMove==='jab'
      ? {kind:'sector',radius:BOSS_PRESSURE.jab.range,arc:BOSS_PRESSURE.jab.arc}
      : {kind:'lane',length:BOSS_PRESSURE.bolt.speed*BOSS_PRESSURE.bolt.life,width:BOSS_PRESSURE.bolt.radius}}];
  }
  if(isWildernessBoss(e.kind)) {
    const origin={...base,x:e.bossOriginX??x,y:e.bossOriginY??y,locked:true};
    if(e.bossMove==='rush')return [{...origin,shape:{kind:'lane',length:R.rushLength,width:R.rushWidth}}];
    if(e.bossMove==='fracture')return [-.55,0,.55].map(offset=>({...origin,angle:e.attackAngle+offset,shape:{kind:'lane',length:R.fractureLength,width:R.fractureWidth}}));
    if(e.bossMove==='eruption')return [{...base,x:e.attackTargetX,y:e.attackTargetY,locked:true,shape:{kind:'circle',radius:R.eruptionRadius}}];
    if(e.bossMove==='sweep')return [{...base,locked:true,shape:{kind:'sector',radius:R.sweepReach,arc:R.sweepArc}}];
    return [];
  }
  if (e.kind === 'warden') {
    const profile=wardenProfile(e.dungeonTheme);
    if (e.bossMove === 'fracture') return profile.offsets.map(offset => ({ ...base, locked:true, angle: e.attackAngle + offset,
      shape: { kind: 'lane', length: profile.length, width: profile.width } }));
    if (e.bossMove === 'sweep') return [{ ...base, locked:true, shape: { kind: 'sector', radius: WARDEN_RULES.reach, arc: Math.PI * 1.3 } }];
    return []; // Summoning has no damage footprint; show an aura rather than a false hit boundary.
  }
  if (d.attack === 'ground') return [{ ...base, x: e.attackTargetX, y: e.attackTargetY, color: '#e83d59', shape: { kind: 'circle', radius: d.blastRadius } }];
  // Basic arrows and the Hexer's three bolts are readable from their projectiles.
  // Suppress both the floor footprint and its warning light; preserve the cast pose/aim lock.
  if (d.attack === 'projectile') return d.warning ? d.shotOffsets.map(offset => ({ ...base, locked:true, angle: e.attackAngle + offset,
    shape: { kind: 'lane', width: d.projectile.radius, length: d.projectile.speed * d.projectile.life } })) : [];
  if (d.engageDistance) return [{ ...base, shape: { kind: 'lane', width: 11,
    length: d.lungeSpeed * Math.max(0, d.active - (e.state === 'attack' ? e.stateTime : 0)) + d.range } }];
  return [{ ...base, shape: { kind: 'sector', radius: d.range, arc: d.arc } }];
}
export function drawEnemyWarning(c: CanvasRenderingContext2D, e: Enemy, alpha: number, time: number, reduced: boolean): void {
  drawWildernessBossImpact(c,e,time,reduced);
  if(riftMechanic(e)==='ritual'&&riftCanChannel(e)&&e.awareness>=1){
    c.save();c.strokeStyle='#9ae0c7';c.globalAlpha=.2;c.lineWidth=1.5;
    c.beginPath();c.arc(e.x,e.y,RT.wardRadius,0,Math.PI*2);c.stroke();c.restore();
    drawGlow(c,e.x,e.y-30,48,'#9ae0c7',.2);
  }
  if(e.bossMove==='command'&&(e.state==='windup'||e.state==='attack'))drawGlow(c,e.x,e.y-35,100,'#b4a3eb',.3);
  if((e.rallyTime??0)>0)drawGlow(c,e.x,e.y-15,34,'#b4a3eb',.24);
  if (e.kind === 'warden' && e.bossMove === 'summon' && (e.state === 'windup' || e.state === 'attack'))
    drawGlow(c, e.x, e.y - 25, 70, '#e83d59', .25 + Math.min(1, e.stateTime / Math.max(.01, e.stateDuration)) * .3);
  for (const w of enemyWarnings(e, alpha)) {
    c.save(); c.translate(w.x, w.y); c.rotate(w.angle);
    drawAttackWarning(c, w.shape, w.progress, w.color, time + e.id * .137, reduced, w.locked, '#ffd1da'); c.restore();
  }
}
export function enemyWarningLight(e: Enemy): PointLight | null {
  const w = enemyWarnings(e)[0];
  if (!w) return null;
  return { x: w.x, y: w.y, radius: w.shape.kind === 'circle' ? w.shape.radius * 1.3 : 65,
    color: w.color, power: .12 + w.progress * .3 };
}
