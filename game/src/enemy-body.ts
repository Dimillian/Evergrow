import type { EnemyKind } from './model.ts';

export const ENEMY_BODY_BOUNDS: Record<EnemyKind, { radiusX: number; top: number; bottom: number }> = {
  goblin: { radiusX: 16, top: -30, bottom: 3 },
  goblinChief: { radiusX: 23, top: -56, bottom: 4 },
  stalker: { radiusX: 14, top: -43, bottom: 3 },
  brute: { radiusX: 22, top: -54, bottom: 4 },
  caster: { radiusX: 15, top: -46, bottom: 3 },
  hound: { radiusX: 25, top: -38, bottom: 5 },
  archer: { radiusX: 22, top: -48, bottom: 3 },
  wisp: { radiusX: 18, top: -49, bottom: -4 },
};
