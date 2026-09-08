export const DEFAULT_AUDIO = Object.freeze({ sfx: .75, music: .35 });
export type AudioChannel = keyof typeof DEFAULT_AUDIO;
export function audioVolume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}
