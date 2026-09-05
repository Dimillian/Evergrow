import type { Enemy, Player } from './model.ts';
import { COMBAT_TIMING } from './combat-content.ts';

/** Shared state transitions keep damage, statuses, streaming and AI independent. */
export function transitionEnemy(enemy: Enemy, state: Enemy['state'], duration = 0): void {
  enemy.state = state; enemy.stateTime = 0; enemy.stateDuration = duration;
  enemy.vx = enemy.vy = 0;
  if (state === 'windup') { enemy.attackHit = false; enemy.interrupted = false; }
}

/** Direct hits are always noticed, even outside the normal view radius. */
export function alertEnemy(enemy: Enemy, player: Pick<Player, 'x' | 'y'>): void {
  if (enemy.state === 'dead') return;
  enemy.awareness = 1; enemy.lastSeenX = player.x; enemy.lastSeenY = player.y; enemy.lostSightTime = 0;
  if (enemy.state === 'idle' || enemy.state === 'patrol' || enemy.state === 'return') transitionEnemy(enemy, 'chase');
}

/** Shared interruption entrypoint for status skills without forcing every actor type into a kind branch. */
export function interruptStaggeredEnemy(enemy: Enemy): void {
  if (enemy.interrupted && (enemy.state === 'windup' || enemy.state === 'attack'))
    transitionEnemy(enemy, 'recover', COMBAT_TIMING.interruptedRecovery);
}
