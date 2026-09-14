export const DEFAULT_AUDIO = Object.freeze({ master: .8, music: .35, sfx: .75 });
export type AudioChannel = keyof typeof DEFAULT_AUDIO;
export function audioVolume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}
