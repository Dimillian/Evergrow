export const MAX_WORLD_SEED = 0xffffffff;

export function isWorldSeed(seed: number): boolean {
  return Number.isInteger(seed) && seed >= 0 && seed <= MAX_WORLD_SEED;
}

/** Decimal input only: never silently truncate, wrap or substitute a different world. */
export function parseWorldSeed(value: string): number | null {
  const text = value.trim();
  if (!/^\d{1,10}$/.test(text)) return null;
  const seed = Number(text);
  return isWorldSeed(seed) ? seed : null;
}
