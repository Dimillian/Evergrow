import type { EnemyAIContext } from './enemy-ai.ts';
import type { Enemy } from './model.ts';
import { circleIntersectsSector } from './combat-geometry.ts';
import { transitionEnemy } from './enemy-state.ts';
export const WARDEN_RULES = Object.freeze({ sweepWarning: .9, fractureWarning: 1, reach: 125, fractureLength: 480, fractureWidth: 22, controlFactor: .25, controlImmunity: 2.5 });
export function updateWarden(e: Enemy, dt: number, c: EnemyAIContext): void {
    const p = c.player, dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (e.interrupted) {
        e.interrupted = false;
        transitionEnemy(e, 'recover', .9);
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
            e.bossMove = (e.bossTurns ?? 0) % 2 ? 'fracture' : 'sweep';
        e.bossTurns = (e.bossTurns ?? 0) + 1;
        if (e.bossMove === 'sweep' && d > WARDEN_RULES.reach + 15) {
            c.move(e, Math.cos(a) * 66, Math.sin(a) * 66, dt);
            e.bossTurns!--;
            return;
        }
        e.attackAngle = a;
        e.attackTargetX = p.x;
        e.attackTargetY = p.y;
        e.bossHits = 0;
        transitionEnemy(e, 'windup', e.bossMove === 'sweep' ? WARDEN_RULES.sweepWarning : WARDEN_RULES.fractureWarning);
        return;
    }
    if (e.state === 'windup') {
        if (e.stateTime >= e.stateDuration) {
            transitionEnemy(e, 'attack', e.bossMove === 'fracture' ? .6 : .22);
            c.emit({ type: 'blast', x: e.x, y: e.y, radius: 120, duration: .4, color: '#b6c8ad' });
        }
        return;
    }
    if (e.state === 'attack') {
        if (e.bossMove === 'sweep' && !e.attackHit && circleIntersectsSector(p.x, p.y, p.radius, e.x, e.y, e.attackAngle, WARDEN_RULES.reach, Math.PI * 1.3) && c.visible(e.x, e.y, p.x, p.y)) {
            e.attackHit = true;
            c.hurt(e.damage, e.attackAngle, e);
        }
        if (e.bossMove === 'fracture' && !e.attackHit) {
            for (let i = 0; i < 3; i++) {
                if (e.stateTime < i * .16 || ((e.bossHits ?? 0) & 1 << i))
                    continue;
                e.bossHits = (e.bossHits ?? 0) | 1 << i;
                const angle = e.attackAngle + (i - 1) * .5, vx = p.x - e.x, vy = p.y - e.y, along = vx * Math.cos(angle) + vy * Math.sin(angle), across = Math.abs(-vx * Math.sin(angle) + vy * Math.cos(angle));
                if (along > 0 && along < WARDEN_RULES.fractureLength && across < WARDEN_RULES.fractureWidth + p.radius && c.visible(e.x, e.y, p.x, p.y)) {
                    e.attackHit = true;
                    c.hurt(e.damage * 1.15, angle, e);
                    break;
                }
            }
        }
        if (e.stateTime >= e.stateDuration)
            transitionEnemy(e, 'recover', e.bossMove === 'summon' ? 1.8 : e.hp / e.maxHp < .3 ? .65 : 1);
    }
}
