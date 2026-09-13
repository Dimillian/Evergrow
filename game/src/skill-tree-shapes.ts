import type { StatModifiers } from './character-types.ts';

export type PassiveClusterShape = 'ring' | 'crescent' | 'leaf' | 'kite' | 'twin' | 'fork';
interface ClusterShape {
  readonly points: readonly (readonly [number, number])[];
  readonly edges: readonly (readonly [number, number])[];
}

const cycle = (count: number): [number, number][] =>
  Array.from({ length: count }, (_, i) => [i, (i + 1) % count]);
const arc = (count: number, start: number, span: number, radius: number): [number, number][] =>
  Array.from({ length: count }, (_, i) => {
    const angle = start + span * i / (count - 1);
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });

// Authored compact silhouettes. The last point is the notable; junctions stay minor.
// Circular node lenses remain shared with the rest of the atlas.
export const PASSIVE_CLUSTER_SHAPES: Readonly<Record<PassiveClusterShape, ClusterShape>> = {
  ring: {
    points: arc(7, 0, Math.PI * 12 / 7, 98),
    edges: cycle(7),
  },
  crescent: {
    points: arc(7, Math.PI / 3, Math.PI * 4 / 3, 110),
    edges: Array.from({ length: 6 }, (_, i) => [i, i + 1]),
  },
  leaf: {
    points: [[-56, -62], [56, -62], [112, 0], [56, 62], [-56, 62], [-112, 0]],
    edges: cycle(6),
  },
  kite: {
    points: [[58, -38], [74, 32], [38, 70], [0, 108], [-38, 70], [-74, 32], [-58, -38], [0, -112]],
    edges: cycle(8),
  },
  twin: {
    points: [[-108, 0], [-54, -62], [0, 0], [-54, 62], [54, -62], [54, 62], [108, 0]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [4, 6], [6, 5], [5, 2]],
  },
  fork: {
    points: [[0, 0], [-48, -30], [-100, -70], [48, -30], [100, -70], [0, 54], [0, 110]],
    edges: [[0, 1], [1, 2], [0, 3], [3, 4], [0, 5], [5, 6]],
  },
};
for (const shape of Object.values(PASSIVE_CLUSTER_SHAPES)) {
  for (const point of shape.points) Object.freeze(point);
  for (const edge of shape.edges) Object.freeze(edge);
  Object.freeze(shape.points); Object.freeze(shape.edges); Object.freeze(shape);
}
Object.freeze(PASSIVE_CLUSTER_SHAPES);

/** Loose visual associations make repeated build needs recognizable across territories. */
export function passiveClusterShape(small: StatModifiers, reward: StatModifiers): PassiveClusterShape {
  const bonuses = { ...small, ...reward };
  if (bonuses.critChance || bonuses.critDamage || bonuses.spellweavePercent) return 'twin';
  if (bonuses.moveSpeedPercent || bonuses.cooldownPercent) return 'crescent';
  if (bonuses.spellDamagePercent || bonuses.castSpeedPercent) return 'leaf';
  if (bonuses.damagePercent || bonuses.attackSpeedPercent) return 'kite';
  if (bonuses.areaPercent || bonuses.projectilePierce || bonuses.lifeOnHit) return 'fork';
  return 'ring';
}
