export function angleDifference(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

export function segmentDistanceSquared(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
  return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
}

/** Exact circle/sector overlap including both radial edges and the outer arc. */
export function circleIntersectsSector(x: number, y: number, radius: number, originX: number, originY: number,
  angle: number, range: number, arc: number): boolean {
  const dx = x - originX, dy = y - originY;
  const distance = Math.hypot(dx, dy);
  if (distance <= radius) return true;
  if (distance > range + radius) return false;
  if (Math.abs(angleDifference(Math.atan2(dy, dx), angle)) <= arc / 2) return true;
  for (const edge of [angle - arc / 2, angle + arc / 2]) {
    if (segmentDistanceSquared(x, y, originX, originY, originX + Math.cos(edge) * range,
      originY + Math.sin(edge) * range) <= radius * radius) return true;
  }
  return false;
}
