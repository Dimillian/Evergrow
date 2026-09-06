import type { Enemy, Player, WorldQuery } from './model.ts';
import { alertEnemy } from './enemy-state.ts';
import { hasLineOfSight } from './combat-geometry.ts';

export const WARBAND_RULES = Object.freeze({ commandPeriod: 6, warning: .8, range: 360, rushSpeed: 1.2, rushDamage: 1.2, routDuration: 2.2 });
export function goblinSpeed(enemy: Enemy): number {
  return enemy.kind === 'goblin' && enemy.warband?.order === 'rush' && !enemy.warband.warning ? WARBAND_RULES.rushSpeed : 1;
}
export function goblinDamage(enemy: Enemy): number {
  return enemy.kind === 'goblin' && enemy.warband?.order === 'rush' && !enemy.warband.warning ? WARBAND_RULES.rushDamage : 1;
}
/** Orders apply only to the chief's own, nearby, visible followers. They never spawn actors or rewrite source stats. */
export function updateWarbands(enemies: readonly Enemy[], player: Player, world: WorldQuery, dt: number): void {
  for (const goblin of enemies) {
    if (goblin.kind !== 'goblin' || goblin.state === 'dead') continue;
    if (goblin.warband) {
      goblin.warband.remaining -= dt;
      if (goblin.warband.remaining <= 0) delete goblin.warband;
    }
    if (goblin.commanderId && !enemies.some(e => e.id === goblin.commanderId && e.state !== 'dead')) {
      goblin.commanderId = 0;
      goblin.warband = { order: 'rout', remaining: WARBAND_RULES.routDuration, warning: false };
    }
  }
  for (const chief of enemies) {
    if (chief.kind !== 'goblinChief' || chief.state === 'dead' || !chief.campId) continue;
    const members = enemies.filter(e => e.kind === 'goblin' && e.state !== 'dead' && e.campId === chief.campId
      && Math.hypot(e.x - chief.x, e.y - chief.y) <= WARBAND_RULES.range
      && hasLineOfSight(world, chief.x, chief.y, e.x, e.y));
    if (chief.state !== 'return' && !world.isSanctuary?.(player.x, player.y) && chief.awareness < 1 && members.some(e => e.awareness >= 1 && e.seesPlayer)) alertEnemy(chief, player);
    for (const member of members) member.commanderId = chief.id;
    if (player.dead || world.isSanctuary?.(player.x, player.y) || chief.awareness < 1 || chief.state === 'return' || chief.stagger > 0) {
      delete chief.warband;
      continue;
    }
    chief.commandClock = ((chief.commandClock ?? 0) + dt) % (WARBAND_RULES.commandPeriod * 2);
    const phase = chief.commandClock % WARBAND_RULES.commandPeriod;
    const order = Math.floor(chief.commandClock / WARBAND_RULES.commandPeriod) % 2 ? 'surround' : 'rush';
    chief.warband = { order, remaining: WARBAND_RULES.commandPeriod - phase, warning: phase < WARBAND_RULES.warning };
    for (const member of members) {
      if (member.state === 'return') continue;
      if (chief.seesPlayer) alertEnemy(member, player);
      // Short leases expire when an ally leaves the command radius or loses sight of its chief.
      member.warband = { order, remaining: .15, warning: chief.warband.warning };
    }
  }
}
