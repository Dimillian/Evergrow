/** Shared display scale: base running pace is about 5.2 metres per second. */
export const WORLD_UNITS_PER_METRE = 32;

export function formatWorldDistance(worldUnits: number): string {
  const metres = Math.max(0, worldUnits) / WORLD_UNITS_PER_METRE;
  return metres >= 1000
    ? `${(metres / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} km`
    : `${Math.round(metres).toLocaleString('en-US')} m`;
}
