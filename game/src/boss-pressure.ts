import type { Enemy, ProjectileStyle } from './model.ts';
import type { EnemyAIContext } from './enemy-ai.ts';
import { circleIntersectsSector } from './combat-geometry.ts';
import { transitionEnemy } from './enemy-state.ts';
import { enemyRecoveryDuration } from './enemy-threat.ts';

/** Light contacts between major moves. Warning geometry and combat share these values. */
export const BOSS_PRESSURE = Object.freeze({
  jab: Object.freeze({windup:.5,aimLock:.28,active:.18,recovery:.55,range:100,arc:Math.PI*.7,damage:.55}),
  bolt: Object.freeze({windup:.65,aimLock:.30,active:.14,recovery:.65,speed:240,life:2,radius:4,damage:.45}),
});
export function bossQuickMove(distance: number, playerRadius: number): 'jab'|'bolt' {
  return distance <= BOSS_PRESSURE.jab.range + playerRadius - 3 ? 'jab' : 'bolt';
}
export function bossBoltStyle(enemy: Pick<Enemy,'kind'|'dungeonTheme'>): ProjectileStyle {
  return enemy.kind==='ashColossus' ? 'fire' : enemy.dungeonTheme==='rime' ? 'frost'
    : enemy.dungeonTheme==='astral' ? 'arcane' : 'spirit';
}

/** Returns true only while it owns an active quick action. Boss owners keep leashes,
 * move selection and recovery; projectiles retain ordinary source-level collision. */
export function updateBossPressure(e: Enemy, c: EnemyAIContext): boolean {
  if ((e.bossMove!=='jab'&&e.bossMove!=='bolt') || (e.state!=='windup'&&e.state!=='attack')) return false;
  const move=e.bossMove, rule=BOSS_PRESSURE[move], p=c.player;
  if(e.state==='windup') {
    if(e.stateTime<rule.aimLock) {
      e.attackAngle=Math.atan2(p.y-e.y,p.x-e.x);e.angle=e.attackAngle;
      e.attackTargetX=p.x;e.attackTargetY=p.y;
    }
    if(e.stateTime<e.stateDuration)return true;
    transitionEnemy(e,'attack',rule.active);
    if(move==='bolt') {
      const bolt=BOSS_PRESSURE.bolt,style=bossBoltStyle(e);
      // Cover appearing during commitment blocks release; a shot already in flight
      // still uses the normal swept terrain collision and source identity.
      if(c.visible(e.x,e.y,e.attackTargetX,e.attackTargetY)) {
        c.shoot(e,e.attackAngle,{owner:'enemy',speed:bolt.speed,life:bolt.life,radius:bolt.radius,
          damage:e.attackDamage??e.damage*bolt.damage},{style});
        c.emit({type:'cast',x:e.x,y:e.y,angle:e.attackAngle,enemyKind:e.kind,style});
      }
      e.attackHit=true;
    }
  }
  const jab=BOSS_PRESSURE.jab;
  if(move==='jab'&&!e.attackHit&&circleIntersectsSector(p.x,p.y,p.radius,e.x,e.y,e.attackAngle,jab.range,jab.arc)
    &&c.visible(e.x,e.y,p.x,p.y)) {
    e.attackHit=true;c.hurt(e.attackDamage??e.damage*jab.damage,e.attackAngle,e,'physical');
  }
  if(e.stateTime>=e.stateDuration)transitionEnemy(e,'recover',enemyRecoveryDuration(e,rule.recovery));
  return true;
}
