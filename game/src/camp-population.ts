import { cloneData } from './data-clone.ts';
import { captureEncounterScale, encounterMemberLevel, isBossKind, type EncounterScale, type EncounterScales } from './encounter-scaling.ts';
import { storedActor, type StoredActor } from './dungeon-state.ts';
import { getZoneAt, scaledEnemyStats } from './zone-progression.ts';
import type { Enemy, Player, WorldQuery } from './model.ts';
import type { CampMember, EnemyCamp } from './wilderness-sites.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { transitionEnemy } from './enemy-state.ts';
import { isEnemyInactive, isSpawnHidden, type SpawnExclusion } from './spawn-visibility.ts';

export const CAMP_POPULATION_RULES = Object.freeze({ actorCacheCapacity: 32, updateInterval: .4,
  activationDistance: 1000, maximumActivationDistance: 2000, sleepMargin: 260 });
export type CampState = 'dormant' | 'active' | 'cleared';
interface CampRecord { members: readonly Enemy[] }
export interface CampSpawnSource { readonly campId: string; readonly memberId: string; readonly lootSeed: number; readonly level?: number }
export type SpawnCampMember = (member: CampMember, x: number, y: number, source: CampSpawnSource) => Enemy | null;

/** Bounded actor cache, with exact durable deaths and wounds outside the cache. */
export class CampPopulation {
  private scales: EncounterScales = {};
  captureScales(): EncounterScales { return cloneData(this.scales); }
  scaleFor(id: string): EncounterScale | undefined { return this.scales[id]; }
  restoreScales(scales: EncounterScales = {}): void { this.scales = cloneData(scales); }
  private cleared = new Set<string>();
  private wounds = new Map<string,StoredActor>();
  private records = new Map<string, CampRecord>();
  private defeated = new Map<string, Set<string>>();
  defeatedMembers(): Record<string, string[]> {
    const result = new Map([...this.defeated].map(([id, members]) => [id, new Set(members)]));
    for (const [id, record] of this.records) for (const enemy of record.members) if (enemy.state === 'dead' && enemy.campMemberId) {
      if (!result.has(id)) result.set(id, new Set());
      result.get(id)!.add(enemy.campMemberId);
    }
    return Object.fromEntries([...result].filter(([id]) => this.getState(id) !== 'cleared').map(([id, members]) => [id, [...members]]));
  }
  restoreDefeated(members: Record<string, string[]>): void { this.defeated = new Map(Object.entries(members).map(([id, ids]) => [id, new Set(ids)])); }
  clearedIds(): string[] { return [...new Set([...this.cleared, ...[...this.records.keys()].filter(id => this.getState(id) === 'cleared')])]; }
  restoreCleared(ids: readonly string[]): void { this.records.clear(); this.cleared = new Set(ids); }
  get recordedCount(): number { return new Set([...this.cleared, ...this.records.keys(), ...this.defeated.keys()]).size; }
  get cachedActorCount(): number { return this.records.size; }
  adopt(enemies: readonly Enemy[]): void {
      const groups = new Map<string, Enemy[]>();
      for (const e of enemies)
          if (e.campId && !e.campId.startsWith('event:') && !e.campId.startsWith('dungeon:')) {
              const group = groups.get(e.campId) ?? [];
              group.push(e);
              groups.set(e.campId, group);
          }
      for (const [id, members] of groups) {
          this.records.set(id, { members });
          const level = members[0].level;
          this.scales[id] ??= { base: level, min: level, max: level, fixed: true };
      }
  }
  captureWounds(active: readonly Enemy[]): StoredActor[] {
      const wounds = new Map(this.wounds);
      for (const record of this.records.values())
          for (const e of record.members)
              if (e.campMemberId) {
                  if (e.hp <= 0 || active.includes(e) || e.hp >= e.maxHp)
                      wounds.delete(e.campMemberId);
                  else
                      wounds.set(e.campMemberId, storedActor(e));
              }
      return [...wounds.values()];
  }
  restoreWounds(wounds: readonly StoredActor[]): void { this.wounds = new Map(wounds.map(w => [w.memberId!, w])); }
  reset(): void { this.scales = {}; this.records.clear(); this.defeated.clear(); this.wounds.clear(); this.cleared.clear(); }
  getState(id: string): CampState {
    if (this.cleared.has(id)) return 'cleared';
    const record = this.records.get(id);
    return !record ? this.defeated.has(id) ? 'active' : 'dormant' : record.members.every(enemy => enemy.state === 'dead') ? 'cleared' : 'active';
  }

  update(camps: readonly EnemyCamp[], player: Pick<Player, 'x' | 'y'> & Partial<Pick<Player, 'level'>>, enemies: Enemy[], world: WorldQuery,
    spawn: SpawnCampMember, activationDistance: number, exclusion: SpawnExclusion | null = null): void {
    if (![player.x, player.y, activationDistance].every(Number.isFinite)) return;
    activationDistance = Math.min(CAMP_POPULATION_RULES.maximumActivationDistance,
      Math.max(CAMP_POPULATION_RULES.activationDistance, activationDistance));
    const sleepDistance = activationDistance + CAMP_POPULATION_RULES.sleepMargin;
    const canLeave = (enemy: Enemy) => (enemy.state === 'dead' || isEnemyInactive(enemy))
      && isSpawnHidden(enemy.x, enemy.y, exclusion, enemy.radius);
    // Sleeping is presentation/population management, never a kill or a source of rewards.
    const activeCampIds = new Set(enemies.flatMap(enemy => enemy.campId ? [enemy.campId] : []));
    for (const id of activeCampIds) {
      const record = this.records.get(id); if (!record) continue;
      const present = record.members.filter(enemy => enemies.includes(enemy));
      if (present.length && present.every(enemy => canLeave(enemy)
        && Math.hypot(enemy.homeX - player.x, enemy.homeY - player.y) > sleepDistance)) {
        for (const enemy of record.members) if (enemies.includes(enemy)) sleepActor(enemy, enemies);
      }
    }
    this.compact(enemies);
    const ordered = [...camps].sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y)
      - Math.hypot(b.x - player.x, b.y - player.y) || a.id.localeCompare(b.id));
    for (const camp of ordered) {
      if (![camp.x, camp.y, camp.radius].every(Number.isFinite) || camp.radius < 0) continue;
      if (!camp.members.length || Math.hypot(camp.x - player.x, camp.y - player.y) > activationDistance + camp.radius) continue;
      const previous = this.records.get(camp.id);
      const missing = previous ? previous.members.filter(enemy => enemy.state !== 'dead' && !enemies.includes(enemy)) : null;
      if (previous && !missing!.length) continue;
      if (this.cleared.has(camp.id)) continue;
      const livingMembers = camp.members.filter(member => !this.defeated.get(camp.id)?.has(member.id));
      // Never materialize even one visible member, including a returning wounded
      // garrison. Validate before eviction so a deferred camp has no side effects.
      const placements = missing ? missing.map(enemy => ({ x: enemy.x, y: enemy.y, radius: enemy.radius }))
        : livingMembers.map(member => ({ x: camp.x + member.dx, y: camp.y + member.dy, radius: ENEMY_DEFINITIONS[member.kind].radius }));
      if (placements.some(point => !isSpawnHidden(point.x, point.y, exclusion, point.radius)
        || world.blocked(point.x, point.y, point.radius) || world.isSanctuary?.(point.x, point.y))) continue;
      if (missing) {
        for (const enemy of missing) { enemy.prevX = enemy.x; enemy.prevY = enemy.y; enemies.push(enemy); }
        continue;
      }
      const zone = getZoneAt(camp.x, camp.y, world.seed);
      // Old saves have exact deaths/wounds but no baseline. Keep those encounters at their former difficulty.
      const old = this.defeated.has(camp.id) || livingMembers.some(m => this.wounds.has(m.id));
      const scale = this.scales[camp.id] ?? (old
        ? { base: zone.originalLevel, min: zone.originalLevel, max: zone.originalLevel, fixed: true as const }
        : captureEncounterScale(zone, player.level ?? 1));
      const created: Enemy[] = [];
      for (const member of livingMembers) {
        const enemy = spawn(member, camp.x + member.dx, camp.y + member.dy,
          { campId: camp.id, memberId: member.id, lootSeed: campMemberSeed(member.id), level: encounterMemberLevel(scale, member.rank, campMemberSeed(member.id), isBossKind(member.kind)) });
        if (enemy) {
          const wound=this.wounds.get(member.id);
          if(wound)Object.assign(enemy,scaledEnemyStats(wound.kind,wound.level,wound.rank),{hp:wound.hp,level:wound.level,biome:wound.biome,lootSeed:wound.seed});
          created.push(enemy);
        }
      }
      if (created.length === livingMembers.length) {this.scales[camp.id] = scale; this.records.set(camp.id, { members: created });for(const m of livingMembers)this.wounds.delete(m.id);}
      else {
        // A caller may reject a placement for an additional rule. Roll the garrison back atomically.
        for (const enemy of created) { const index = enemies.indexOf(enemy); if (index >= 0) enemies.splice(index, 1); }
      }
    }
    this.compact(enemies);
  }

  /** Retire only detached actors; never remove visible or combat-active enemies. */
  private compact(active: readonly Enemy[]): void {
    for (const [id, record] of this.records) {
      if (record.members.some(e => active.includes(e))) continue;
      if (record.members.every(e => e.state === 'dead')) {
        this.cleared.add(id);
        this.defeated.delete(id);
        for (const e of record.members) if (e.campMemberId) this.wounds.delete(e.campMemberId);
        this.records.delete(id);
      } else if (this.records.size > CAMP_POPULATION_RULES.actorCacheCapacity) {
        const dead = this.defeated.get(id) ?? new Set<string>();
        for (const e of record.members) if (e.campMemberId) {
          if (e.state === 'dead') { dead.add(e.campMemberId); this.wounds.delete(e.campMemberId); }
          else if (e.hp < e.maxHp) this.wounds.set(e.campMemberId, storedActor(e));
        }
        if (dead.size) this.defeated.set(id, dead);
        this.records.delete(id);
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
