import { BOSS_PRESSURE, bossQuickMove, updateBossPressure } from './boss-pressure.ts';
import { enemyRecoveryDuration, enemyWindupDuration } from './enemy-threat.ts';
import type { EnemyAIContext } from './enemy-ai.ts';
import type { Enemy } from './model.ts';
import { circleIntersectsSector } from './combat-geometry.ts';
import { transitionEnemy } from './enemy-state.ts';
export const WARDEN_RULES = Object.freeze({ sweepWarning: .9, fractureWarning: 1, reach: 125, fractureLength: 480, fractureWidth: 22 });
export function wardenProfile(theme?: Enemy['dungeonTheme']) {
    const astral=theme==='astral',rime=theme==='rime';
    return {offsets:astral?[-.8,-.4,0,.4,.8]:rime?[-.65,0,.65]:[-.5,0,.5],length:astral?580:rime?540:480,width:rime?28:22,
      element:astral?'arcane' as const:rime?'frost' as const:'physical' as const,color:astral?'#c9a8ff':rime?'#b1e6ff':'#b6c8ad',warning:astral?1.3:rime?1.15:1};
}
export function updateWarden(e: Enemy, dt: number, c: EnemyAIContext): void {
    const profile=wardenProfile(e.dungeonTheme);
    const p = c.player, dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (e.interrupted) {
        e.interrupted = false;
    }
    if (p.dead || c.world.isSanctuary?.(p.x, p.y) || Math.hypot(p.x - e.homeX, p.y - e.homeY) > 1100) {
        e.awareness = 0;
        e.bossMove = undefined;
        transitionEnemy(e, 'idle', 1);
        return;
    }
    if (e.state === 'idle' || e.state === 'patrol' || e.state === 'return') {
        if (d < 700 && c.visible(e.x, e.y, p.x, p.y)) {
            e.awareness = 1;
            transitionEnemy(e, 'chase', 0);
        }
        else
            return;
    }
    if (e.state === 'recover') {
        if (e.stateTime >= e.stateDuration)
            transitionEnemy(e, 'chase', 0);
        return;
    }
    if (updateBossPressure(e,c)) return;
    if (e.state === 'chase') {
        e.angle = a;
        e.seesPlayer = c.visible(e.x, e.y, p.x, p.y);
        if (!e.seesPlayer || d > 390) {
            c.move(e, Math.cos(a) * 66, Math.sin(a) * 66, dt);
            return;
        }
        const phase = e.hp / e.maxHp < .3 ? 2 : e.hp / e.maxHp < .65 ? 1 : 0, mask = e.bossPhases ?? 0, bit = phase >= 1 && !(mask & 1) ? 1 : phase >= 2 && !(mask & 2) ? 2 : 0;
        if (bit) {
            e.bossPhases = (e.bossPhases ?? 0) | bit;
            e.bossMove = 'summon';
        }
        else
            e.bossMove = (e.bossTurns ?? 0)%2 ? bossQuickMove(d,p.radius)
              : Math.floor((e.bossTurns ?? 0)/2) % (e.dungeonTheme==='astral'?3:2) ? 'fracture' : 'sweep';
        e.bossTurns = (e.bossTurns ?? 0) + 1;
        if (e.bossMove === 'sweep' && d > WARDEN_RULES.reach + 15) {
            e.bossMove = 'fracture';
        }
        e.attackAngle = a;
        e.attackTargetX = p.x;
        e.attackTargetY = p.y;
        e.bossHits = 0;
        const quick=e.bossMove==='jab'||e.bossMove==='bolt'?BOSS_PRESSURE[e.bossMove]:null;
        e.attackDamage=e.damage*(quick?.damage??(e.bossMove==='fracture'?1.15:1));
        transitionEnemy(e, 'windup', enemyWindupDuration(e,quick?.windup??(e.bossMove === 'sweep' ? WARDEN_RULES.sweepWarning : profile.warning)));
        return;
    }
    if (e.state === 'windup') {
        if (e.stateTime >= e.stateDuration) {
            transitionEnemy(e, 'attack', e.bossMove === 'fracture' ? profile.offsets.length*.16+.12 : .22);
            c.emit({ type: 'blast', x: e.x, y: e.y, radius: 120, duration: .4, color: profile.color });
        }
        return;
    }
    if (e.state === 'attack') {
        if (e.bossMove === 'sweep' && !e.attackHit && circleIntersectsSector(p.x, p.y, p.radius, e.x, e.y, e.attackAngle, WARDEN_RULES.reach, Math.PI * 1.3) && c.visible(e.x, e.y, p.x, p.y)) {
            e.attackHit = true;
            c.hurt(e.damage, e.attackAngle, e, 'physical');
        }
        if (e.bossMove === 'fracture' && !e.attackHit) {
            for (let i = 0; i < profile.offsets.length; i++) {
                if (e.stateTime < i * .16 || ((e.bossHits ?? 0) & 1 << i))
                    continue;
                e.bossHits = (e.bossHits ?? 0) | 1 << i;
                const angle = e.attackAngle + profile.offsets[i], vx = p.x - e.x, vy = p.y - e.y, along = vx * Math.cos(angle) + vy * Math.sin(angle), across = Math.abs(-vx * Math.sin(angle) + vy * Math.cos(angle));
                if (along > 0 && along < profile.length && across < profile.width + p.radius && c.visible(e.x, e.y, p.x, p.y)) {
                    e.attackHit = true;
                    c.hurt(e.damage * 1.15, angle, e, profile.element);
                    break;
                }
            }
        }
        if (e.stateTime >= e.stateDuration)
            transitionEnemy(e, 'recover', enemyRecoveryDuration(e, e.bossMove === 'summon' ? 1.8 : e.hp / e.maxHp < .3 ? .65 : 1));
    }
}
