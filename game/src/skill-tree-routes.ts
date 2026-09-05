import type { ActionResult, CharacterSheet } from './character-types.ts';
import { SKILL_NODES } from './skill-tree.ts';

export interface SkillRouteStep {
  readonly cost: number;
  readonly previous: string | null;
}

/** Fewest additional points from any owned node. This is a preview, never an allocation. */
export function buildSkillRoutes(allocated: ReadonlySet<string>): Map<string, SkillRouteStep> {
  const routes = new Map<string, SkillRouteStep>();
  // Sort both roots and branches so equivalent builds always preview the same tied route.
  const queue = [...allocated].filter(id => SKILL_NODES.has(id)).sort();
  for (const id of queue) routes.set(id, { cost: 0, previous: null });

  for (let index = 0; index < queue.length; index++) {
    const id = queue[index], cost = routes.get(id)!.cost;
    for (const neighbor of [...SKILL_NODES.get(id)!.neighbors].sort()) {
      if (routes.has(neighbor)) continue;
      routes.set(neighbor, { cost: cost + 1, previous: id });
      queue.push(neighbor);
    }
  }
  return routes;
}

/** Ordered owned anchor → destination, including both; missing routes have no preview. */
export function previewSkillRoute(routes: ReadonlyMap<string, SkillRouteStep>, nodeId: string): string[] {
  const path: string[] = [], visited = new Set<string>();
  let current: string | null = nodeId;
  while (current !== null) {
    if (visited.has(current)) return [];
    const step: SkillRouteStep | undefined = routes.get(current);
    if (!step) return [];
    visited.add(current); path.push(current);
    current = step.previous;
  }
  return path.reverse();
}

/** Allocate the same shortest route shown in the atlas, all or nothing. */
export function allocateSkillRoute(sheet: CharacterSheet, nodeId: string): ActionResult {
  if (!SKILL_NODES.has(nodeId)) return { ok: false, message: 'Unknown node.' };
  const owned = new Set(sheet.allocatedNodes);
  if (owned.has(nodeId)) return { ok: false, message: 'Already allocated.' };
  const path = previewSkillRoute(buildSkillRoutes(owned), nodeId).filter(id => !owned.has(id));
  if (!path.length) return { ok: false, message: 'No connected path.' };
  if (!Number.isSafeInteger(sheet.skillPoints) || sheet.skillPoints < path.length)
    return { ok: false, message: `Requires ${path.length} skill ${path.length === 1 ? 'point' : 'points'}.` };
  sheet.allocatedNodes.push(...path);
  sheet.skillPoints -= path.length;
  return { ok: true };
}
