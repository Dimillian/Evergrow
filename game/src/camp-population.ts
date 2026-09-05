import type { Enemy, Player, WorldQuery } from './model.ts';
import type { CampMember, EnemyCamp } from './wilderness-sites.ts';
import { ENCOUNTER_RULES, livingEnemyCount } from './encounter-director.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { transitionEnemy } from './enemy-ai.ts';

export const CAMP_POPULATION_RULES = Object.freeze({ ledgerCapacity: 1024, updateInterval: .4,
  activationDistance: 1000, maximumActivationDistance: 2000, sleepMargin: 260 });
export interface SpawnExclusion { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export type CampState = 'dormant' | 'active' | 'cleared';
interface CampRecord { members: readonly Enemy[] }
export interface CampSpawnSource { readonly campId: string; readonly memberId: string; readonly lootSeed: number }
export type SpawnCampMember = (member: CampMember, x: number, y: number, source: CampSpawnSource) => Enemy | null;

/** Exact, bounded run-local memory: sleeping enemies retain their original stats and life.
 * At the ledger ceiling later camps remain dormant; no existing camp is evicted or refilled. */
export class CampPopulation {
  private records = new Map<string, CampRecord>();
  get recordedCount(): number { return this.records.size; }
  reset(): void { this.records.clear(); }
  getState(id: string): CampState {
    const record = this.records.get(id);
    return !record ? 'dormant' : record.members.every(enemy => enemy.state === 'dead') ? 'cleared' : 'active';
  }

  update(camps: readonly EnemyCamp[], player: Pick<Player, 'x' | 'y'>, enemies: Enemy[], world: WorldQuery,
    spawn: SpawnCampMember, activationDistance: number, exclusion: SpawnExclusion | null = null): void {
    activationDistance = Math.min(CAMP_POPULATION_RULES.maximumActivationDistance,
      Math.max(CAMP_POPULATION_RULES.activationDistance, activationDistance));
    const sleepDistance = activationDistance + CAMP_POPULATION_RULES.sleepMargin;
    const away = (enemy: Enemy) => exclusion
      ? enemy.x < exclusion.x - 80 || enemy.x > exclusion.x + exclusion.width + 80
        || enemy.y < exclusion.y - 100 || enemy.y > exclusion.y + exclusion.height + 100
      : Math.hypot(enemy.x - player.x, enemy.y - player.y) > 600;
    // Sleeping is presentation/population management, never a kill or a source of rewards.
    const activeCampIds = new Set(enemies.flatMap(enemy => enemy.campId ? [enemy.campId] : []));
    for (const id of activeCampIds) {
      const record = this.records.get(id); if (!record) continue;
      const present = record.members.filter(enemy => enemies.includes(enemy));
      if (present.length && present.every(enemy => away(enemy)
        && Math.hypot(enemy.homeX - player.x, enemy.homeY - player.y) > sleepDistance)) {
        for (const enemy of record.members) if (enemies.includes(enemy)) sleepActor(enemy, enemies);
      }
    }
    const ordered = [...camps].sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y)
      - Math.hypot(b.x - player.x, b.y - player.y) || a.id.localeCompare(b.id));
    for (const camp of ordered) {
      if (!camp.members.length || Math.hypot(camp.x - player.x, camp.y - player.y) > activationDistance + camp.radius) continue;
      const previous = this.records.get(camp.id);
      const missing = previous ? previous.members.filter(enemy => enemy.state !== 'dead' && !enemies.includes(enemy)) : null;
      if (previous && !missing!.length) continue;
      if (!previous && this.records.size >= CAMP_POPULATION_RULES.ledgerCapacity) continue;
      const additions = missing ?? camp.members;
      const rankCount = (rank: Enemy['rank']) => enemies.filter(enemy => enemy.state !== 'dead' && enemy.rank === rank).length
        + additions.filter(member => member.rank === rank).length;
      const hasRoom = () => livingEnemyCount(enemies) + additions.length <= ENCOUNTER_RULES.hardPopulationCap
        && rankCount('veteran') <= ENCOUNTER_RULES.veteranCap && rankCount('elite') <= ENCOUNTER_RULES.eliteCap;
      if (!hasRoom()) {
        // Approaching camps take priority over distant offscreen populations. Whole
        // garrisons sleep together; actors on screen or nearer the player stay put.
        const distance = Math.hypot(camp.x - player.x, camp.y - player.y);
        const candidates = [...this.records.entries()].filter(([id, record]) => id !== camp.id
          && record.members.some(enemy => enemies.includes(enemy) && enemy.state !== 'dead')
          && record.members.filter(enemy => enemy.state !== 'dead').every(enemy => away(enemy)
            && Math.hypot(enemy.homeX - player.x, enemy.homeY - player.y) > distance + 140))
          .sort(([, a], [, b]) => Math.hypot(b.members[0].homeX - player.x, b.members[0].homeY - player.y)
            - Math.hypot(a.members[0].homeX - player.x, a.members[0].homeY - player.y));
        for (const [, record] of candidates) {
          for (const enemy of record.members) if (enemies.includes(enemy)) sleepActor(enemy, enemies);
          if (hasRoom()) break;
        }
        if (!hasRoom()) for (const enemy of [...enemies]) {
          if (!enemy.campId && away(enemy) && Math.hypot(enemy.x - player.x, enemy.y - player.y) > distance + 140) {
            enemies.splice(enemies.indexOf(enemy), 1);
            if (hasRoom()) break;
          }
        }
      }
      if (!hasRoom()) continue;
      if (missing) {
        for (const enemy of missing) { enemy.prevX = enemy.x; enemy.prevY = enemy.y; enemies.push(enemy); }
        continue;
      }
      // Validate the whole authored garrison first; a blocked slot cannot leave a half-recorded camp.
      if (camp.members.some(member => world.blocked(camp.x + member.dx, camp.y + member.dy,
        ENEMY_DEFINITIONS[member.kind].radius) || world.isSanctuary?.(camp.x + member.dx, camp.y + member.dy))) continue;
      const created: Enemy[] = [];
      for (const member of camp.members) {
        const enemy = spawn(member, camp.x + member.dx, camp.y + member.dy,
          { campId: camp.id, memberId: member.id, lootSeed: campMemberSeed(member.id) });
        if (enemy) created.push(enemy);
      }
      if (created.length === camp.members.length) this.records.set(camp.id, { members: created });
      else {
        // A caller may reject a placement for an additional rule. Roll the garrison back atomically.
        for (const enemy of created) { const index = enemies.indexOf(enemy); if (index >= 0) enemies.splice(index, 1); }
      }
    }
  }
}

/** Stable member IDs isolate camp rewards from ambient spawning, camera size, and traversal order. */
function campMemberSeed(id: string): number {
  let value = 2166136261;
  for (let index = 0; index < id.length; index++) value = Math.imul(value ^ id.charCodeAt(index), 16777619);
  value = Math.imul(value ^ value >>> 16, 0x7feb352d);
  value = Math.imul(value ^ value >>> 15, 0x846ca68b);
  return (value ^ value >>> 16) >>> 0;
}

function sleepActor(enemy: Enemy, enemies: Enemy[]): void {
  const index = enemies.indexOf(enemy); if (index >= 0) enemies.splice(index, 1);
  if (enemy.state === 'dead') return;
  enemy.x = enemy.prevX = enemy.homeX; enemy.y = enemy.prevY = enemy.homeY;
  enemy.knockbackX = enemy.knockbackY = 0; enemy.awareness = 0; enemy.seesPlayer = false;
  enemy.lostSightTime = 0; enemy.lastSeenX = enemy.homeX; enemy.lastSeenY = enemy.homeY;
  transitionEnemy(enemy, 'idle', .6);
}
