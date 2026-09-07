import type { Enemy } from './model.ts';

export type EnemyDebuffState = Pick<Enemy, 'hp'> & Partial<Pick<Enemy,
  'state' | 'burnTime' | 'burnDps' | 'slowTime' | 'slowFactor' | 'stagger'>>;
export interface EnemyDebuff {
  id: 'burn' | 'chill' | 'stagger'; label: string; color: string; remaining: number;
}
const active = (n: number | undefined): n is number => Number.isFinite(n) && n! > 0;
/** Read actual combat timers, without retaining an expired effect or inferring one from hit art. */
export function enemyDebuffs(enemy: EnemyDebuffState): EnemyDebuff[] {
  if (enemy.hp <= 0 || enemy.state === 'dead') return [];
  const result: EnemyDebuff[] = [];
  if (active(enemy.burnTime) && active(enemy.burnDps)) result.push({ id: 'burn', label: 'Burn', color: '#f5ab75', remaining: enemy.burnTime });
  if (active(enemy.slowTime) && Number.isFinite(enemy.slowFactor) && enemy.slowFactor! < 1)
    result.push({ id: 'chill', label: 'Chill', color: '#9bdbea', remaining: enemy.slowTime });
  // Stagger is the shared control timer for melee reactions, stuns and lightning interrupts.
  if (active(enemy.stagger)) result.push({ id: 'stagger', label: 'Stagger', color: '#c5b6ef', remaining: enemy.stagger });
  return result;
}
export function debuffDuration(remaining: number): string {
  if (!active(remaining)) return '0s';
  return `${remaining < 10 ? (Math.ceil(remaining * 10) / 10).toFixed(1) : Math.ceil(remaining)}s`;
}
