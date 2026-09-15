import { riftMechanic, RIFT_TACTICS as RT } from './rift-encounters.ts';
import { riftWardActive } from './rift-tactics.ts';
import { enemyModifiers } from './enemy-modifiers.ts';
import type { Enemy, Player } from './model.ts';
import type { ActiveBuff } from './active-buffs.ts';
import { UNIQUE_RULES } from './unique-content.ts';
import { AURA_RULES } from './aura-content.ts';

export type EnemyDebuffState = Pick<Enemy, 'hp'> & Partial<Pick<Enemy,
  'id' | 'state' | 'burnTime' | 'burnDps' | 'slowTime' | 'slowFactor' | 'stagger' | 'freezeTime' | 'stunTime' | 'fractureTime' | 'chillTime' | 'statusDurations' | 'auraExposure'>>;
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
  if (active(enemy.burnTime) && active(enemy.burnDps)) add('burn', 'Burn', 'fireball', '#f5ab75', enemy.burnTime, enemy.statusDurations?.burn, `${Number(enemy.burnDps.toFixed(1))} fire damage / second. Vulnerable to Overload.`, 'burn');
  if (active(enemy.chillTime))
    add('chill', 'Chilled', 'frostLance', '#9bdbea', enemy.chillTime, enemy.statusDurations?.chill, 'Chilled by frost. Vulnerable to Melt and Superconduct.', 'chill');
  else if (active(enemy.slowTime) && Number.isFinite(enemy.slowFactor) && enemy.slowFactor! < 1)
    add('slow', 'Slowed', 'smokeVeil', '#9bdbea', enemy.slowTime, enemy.statusDurations?.slow, `${Math.round((1 - enemy.slowFactor!) * 100)}% slower movement.`, 'slow');
  if (active(enemy.freezeTime)) add('freeze', 'Frozen', 'absoluteZero', '#c0f5ff', enemy.freezeTime, enemy.statusDurations?.freeze, 'Cannot move or attack. Vulnerable to Melt.', 'freeze');
  else if (active(enemy.stunTime)) add('stun', 'Stunned', 'shieldBash', '#ffe1a1', enemy.stunTime, enemy.statusDurations?.stun, 'Cannot move or attack.', 'stun');
  else if (active(enemy.stagger)) add('stagger', 'Stagger', 'arcLightning', '#c5b6ef', enemy.stagger, enemy.statusDurations?.stagger, 'Movement and attacks interrupted.', 'stagger');
  if (active(enemy.fractureTime)) add('fracture', 'Fracture', 'earthshatter', '#76b9ee', enemy.fractureTime, enemy.statusDurations?.fracture, 'Armor shattered by Superconduct. Takes increased damage.', 'fracture');
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
export function enemyTraitBuffs(enemy:Pick<Enemy,'kind'|'rank'|'lootSeed'|'hp'> & Partial<Enemy>):EnemyDebuff[]{
 if(enemy.hp<=0)return [];
 const icons={swift:'lunge',relentless:'whirlwind',savage:'cleave',resolute:'bulwark'} as const;
 const buffs:EnemyDebuff[]=enemyModifiers(enemy).map(trait=>({id:`trait:${trait.id}`,name:trait.name,label:trait.name,icon:icons[trait.id],color:trait.color,remaining:1,duration:1,persistent:true,summary:trait.description}));
 const role=riftMechanic(enemy),ward=!!enemy.riftWardSource&&riftWardActive(enemy as Enemy);
 if(role||ward)buffs.push({id:'rift-special',name:role==='ritual'?'Ritual Ward':role==='storm'?'Stormbound':role==='fire'?'Cinder Sweep':'Ritual Protection',label:role==='ritual'?'Ritual Ward':role==='storm'?'Stormbound':role==='fire'?'Cinder Sweep':'Ritual Protection',icon:role==='fire'?'cleave':role==='storm'?'arcLightning':'bulwark',color:role==='fire'?'#ff935f':role==='storm'?'#cca3ff':'#9ae0c7',remaining:1,duration:1,persistent:true,summary:role==='ritual'?`Nearby allies take ${RT.wardReduction*100}% less damage. Kill or interrupt this cantor to break the ward.`:role==='storm'?'Calls a delayed lightning strike at your position. Move outside the warning.':role==='fire'?'Releases a delayed fire sweep. Move behind it or interrupt.':'Takes 30% less damage while the nearby Rift Cantor channels.'});
 return buffs;
}
