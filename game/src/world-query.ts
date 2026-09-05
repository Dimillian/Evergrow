/** Limits apply to a single request, not to generated travel distance or world age. */
export const WORLD_QUERY_LIMITS = Object.freeze({
  span: 262_144, propCells: 65_536, movement: 4096, collisionRadius: 1024,
});

export function isWorldCoordinate(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
}

/** Validate before enumerating cells: finite-but-imprecise indices can make i++ stall. */
export function validWorldRectangle(x: number, y: number, width: number, height: number): boolean {
  return [x, y, x + width, y + height].every(isWorldCoordinate)
    && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    && width <= WORLD_QUERY_LIMITS.span && height <= WORLD_QUERY_LIMITS.span;
}
