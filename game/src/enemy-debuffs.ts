import { enemyModifiers } from './enemy-modifiers.ts';
import type { Enemy, Player } from './model.ts';
import type { ActiveBuff } from './active-buffs.ts';
import { UNIQUE_RULES } from './unique-content.ts';
import { AURA_RULES } from './aura-content.ts';

export type EnemyDebuffState = Pick<Enemy, 'hp'> & Partial<Pick<Enemy,
  'id' | 'state' | 'burnTime' | 'burnDps' | 'slowTime' | 'slowFactor' | 'stagger' | 'freezeTime' | 'stunTime' | 'statusDurations' | 'auraExposure'>>;
export interface EnemyDebuff extends ActiveBuff { label: string }
const active = (n: number | undefined): n is number => Number.isFinite(n) && n! > 0;
/** Target-owned presentation. Original durations come from application, never inferred from elapsed time. */
export function enemyDebuffs(enemy: EnemyDebuffState, player?: Pick<Player, 'skillEffects'>): EnemyDebuff[] {
  if (enemy.hp <= 0 || enemy.state === 'dead') return [];
  const result: EnemyDebuff[] = [];
  const add = (id: string, name: string, icon: ActiveBuff['icon'], color: string, remaining: number, duration: number | undefined, summary: string, term = id) => {
    result.push({ id, name, label: name, icon, color, remaining, duration: duration ?? 0,
      // Staged states without application metadata can show time, but must not invent a draining fill.
      progress: duration ? undefined : 1, summary, term });
  };
  if (active(enemy.burnTime) && active(enemy.burnDps)) add('burn', 'Burn', 'fireball', '#f5ab75', enemy.burnTime, enemy.statusDurations?.burn, `${Number(enemy.burnDps.toFixed(1))} fire damage / second.`);
  if (active(enemy.slowTime) && Number.isFinite(enemy.slowFactor) && enemy.slowFactor! < 1)
    add('slow', 'Slowed', 'smokeVeil', '#9bdbea', enemy.slowTime, enemy.statusDurations?.slow, `${Math.round((1 - enemy.slowFactor!) * 100)}% slower movement.`);
  if (active(enemy.freezeTime)) add('freeze', 'Frozen', 'absoluteZero', '#c0f5ff', enemy.freezeTime, enemy.statusDurations?.freeze, 'Cannot move or attack.');
  else if (active(enemy.stunTime)) add('stun', 'Stunned', 'shieldBash', '#ffe1a1', enemy.stunTime, enemy.statusDurations?.stun, 'Cannot move or attack.');
  else if (active(enemy.stagger)) add('stagger', 'Stagger', 'arcLightning', '#c5b6ef', enemy.stagger, enemy.statusDurations?.stagger, 'Movement and attacks interrupted.');
  const mark = player?.skillEffects?.harvest?.find(m => m.target === enemy.id && m.remaining > 0);
  if (mark) add('red-harvest', 'Red Harvest', 'backstab', '#ef82ad', mark.remaining, UNIQUE_RULES.harvestWindow, 'Your next Backstab counts as a rear strike.', 'unique:red-harvest');
  const colors = { fire: '#f5ab75', frost: '#9bdbea', lightning: '#e5cf8b', arcane: '#c7a0ef' };
  for (const element of ['fire', 'frost', 'lightning', 'arcane'] as const) {
    const e = enemy.auraExposure?.[element];
    if (e && active(e.remaining) && active(e.power)) add(`exposure:${element}`, `${element[0].toUpperCase()+element.slice(1)} Exposure`, 'elementalResonance', colors[element], e.remaining, AURA_RULES.exposureDuration,
      `Takes ${Number(e.power.toFixed(1))}% more ${element} damage.`, 'exposure');
  }
  return result;
}
export function debuffDuration(remaining: number): string {
  if (!active(remaining)) return '0s';
  return `${remaining < 10 ? (Math.ceil(remaining * 10) / 10).toFixed(1) : Math.ceil(remaining)}s`;
}

/** Permanent rank traits share the target effect strip and its hover descriptions. */
export function enemyTraitBuffs(enemy:Pick<Enemy,'kind'|'rank'|'lootSeed'|'hp'>):EnemyDebuff[]{
 if(enemy.hp<=0)return [];
 const icons={swift:'lunge',relentless:'whirlwind',savage:'cleave',resolute:'bulwark'} as const;
 return enemyModifiers(enemy).map(trait=>({id:`trait:${trait.id}`,name:trait.name,label:trait.name,icon:icons[trait.id],color:trait.color,remaining:1,duration:1,persistent:true,summary:trait.description}));
}
