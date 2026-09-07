import type { Building } from './settlements.ts';
import type { CombatEvent, WorldQuery } from './model.ts';
import { circleIntersectsSector, hasLineOfSight, segmentDistanceSquared } from './combat-geometry.ts';
import { dropGold, type GroundGold } from './gold.ts';
import { siteHash } from './wilderness-sites.ts';

export interface BreakableContainer {
  readonly id: string; readonly kind: 'crate' | 'barrel'; readonly x: number; readonly y: number;
  readonly radius: number; readonly seed: number;
}
export const furnitureContainerId = (building: Pick<Building, 'id'>, index: number) => `${building.id}:furniture:${index}`;
export function furnitureContainer(building: Building, index: number): BreakableContainer | null {
  const item = building.furniture[index];
  if (item.kind !== 'barrel') return null;
  return { id: furnitureContainerId(building, index), kind: 'barrel', x: item.x + item.width / 2,
    y: item.y + item.height / 2, radius: Math.hypot(item.width, item.height) / 2, seed: siteHash(building.seed, index, 6751) };
}
export interface ContainerAttackContext {
  world: WorldQuery;
  break(target: BreakableContainer, angle: number): void;
}
export const CONTAINER_RULES = Object.freeze({ goldChance: .35, minGold: 2, maxGold: 7 });
/** Currency has its own stable stream; attacks and save reloads cannot reroll a container. */
export function containerGold(seed: number, level: number): number {
  if (siteHash(seed, 0, 0x714c) / 0x100000000 >= CONTAINER_RULES.goldChance) return 0;
  return Math.round((CONTAINER_RULES.minGold + siteHash(seed, 1, 0x714c) % (CONTAINER_RULES.maxGold - CONTAINER_RULES.minGold + 1))
    * (1 + .1 * (Math.max(1, Math.min(1_000_000, level)) - 1)));
}
export function breakContainer(target: BreakableContainer, angle: number, level: number,
  broken: Set<string>, piles: GroundGold[], nextId: () => number, emit: (event: CombatEvent) => void): boolean {
  if (broken.has(target.id)) return false;
  broken.add(target.id);
  const amount = containerGold(target.seed, level);
  if (amount) dropGold(piles, { id: nextId(), x: target.x, y: target.y, amount, age: 0 });
  emit({ type: 'container-break', x: target.x, y: target.y, angle, containerId: target.id, kind: target.kind, seed: target.seed });
  return true;
}
/** Test sight to the near surface: the intact container must not block its own hit. */
export function containerVisible(world: WorldQuery, x: number, y: number, target: BreakableContainer): boolean {
  const dx = target.x - x, dy = target.y - y, distance = Math.hypot(dx, dy);
  const t = distance > 0 ? Math.max(0, distance - target.radius - 2) / distance : 0;
  return hasLineOfSight(world, x, y, x + dx * t, y + dy * t);
}
export function strikeContainers(context: ContainerAttackContext | undefined, x: number, y: number, radius: number,
  angle = 0, arc = Math.PI * 2): number {
  if (!context || radius <= 0) return 0;
  let count = 0;
  for (const target of context.world.getContainers?.(x, y, radius + 24) ?? []) {
    if (!circleIntersectsSector(target.x, target.y, target.radius, x, y, angle, radius, arc)
      || !containerVisible(context.world, x, y, target)) continue;
    context.break(target, Math.atan2(target.y - y, target.x - x)); count++;
  }
  return count;
}
export function strikeContainerSegment(context: ContainerAttackContext | undefined, ax: number, ay: number,
  bx: number, by: number, radius: number): boolean {
  if (!context) return false;
  const targets = [...context.world.getContainers?.(ax, ay, Math.hypot(bx - ax, by - ay) + radius + 24) ?? []]
    .filter(t => segmentDistanceSquared(t.x, t.y, ax, ay, bx, by) <= (radius + t.radius) ** 2 && containerVisible(context.world, ax, ay, t))
    .sort((a, b) => Math.hypot(a.x - ax, a.y - ay) - Math.hypot(b.x - ax, b.y - ay));
  const target = targets[0];
  if (!target) return false;
  context.break(target, Math.atan2(by - ay, bx - ax)); return true;
}
