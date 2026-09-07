import type { EnemyKind } from './model.ts';

/** Speech clears authored heads/crowns, rather than the larger aiming envelope.
 * Brute helmet reaches -39; hexer antlers -44; chief banner -54. */
export const ENEMY_SPEECH_TOP = Object.freeze({
  briarMatriarch: -127, ashColossus: -112, graveMarshal: -120,
  goblin: -30, goblinChief: -56, stalker: -37, brute: -40, caster: -44, archer: -48, warden: -110,
});

export const ENEMY_BODY_BOUNDS: Record<EnemyKind, { radiusX: number; top: number; bottom: number; headTop?: number }> = {
  thornReaver: { radiusX: 46, top: -76, bottom: 20 },
  mireSpitter: { radiusX: 34, top: -47, bottom: 16 },
  frostRevenant: { radiusX: 44, top: -98, bottom: 6, headTop: -60 },
  emberAcolyte: { radiusX: 35, top: -70, bottom: 6 },
  duneScuttler: { radiusX: 44, top: -58, bottom: 20 },
  stormSentinel: { radiusX: 34, top: -69, bottom: 8 },
  briarMatriarch: { radiusX: 82, top: -127, bottom: 10 },
  ashColossus: { radiusX: 82, top: -127, bottom: 10 },
  graveMarshal: { radiusX: 130, top: -127, bottom: 10 },
  warden: { radiusX: 45, top: -110, bottom: 8 },
  goblin: { radiusX: 16, top: -30, bottom: 3 },
  goblinChief: { radiusX: 23, top: -56, bottom: 4 },
  stalker: { radiusX: 14, top: -43, bottom: 3 },
  brute: { radiusX: 22, top: -54, bottom: 4 },
  caster: { radiusX: 15, top: -46, bottom: 3 },
  hound: { radiusX: 25, top: -38, bottom: 5 },
  archer: { radiusX: 22, top: -48, bottom: 3 },
  wisp: { radiusX: 18, top: -49, bottom: -4 },
};
