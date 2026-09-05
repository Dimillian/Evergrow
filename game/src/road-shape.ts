const BRANCH_INTERVAL = 1600;
const BRANCH_OFFSET = -620;
const smoothstep = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Existing routes remain anchored to the same world coordinates. */
export function mainPathX(y: number): number {
  return Math.sin(y / 580) * 78 + Math.sin(y / 210) * 22;
}

export function branchY(x: number, band: number): number {
  return band * BRANCH_INTERVAL + BRANCH_OFFSET
    + Math.sin(x / 430) * 90 + Math.sin(x / 180) * 25;
}

/** Collision and settlement reservations use the unchanged route centerlines. */
export function pathDistance(x: number, y: number): number {
  const mainSlope = Math.cos(y / 580) * 78 / 580 + Math.cos(y / 210) * 22 / 210;
  let distance = Math.abs(x - mainPathX(y)) / Math.hypot(1, mainSlope);
  const nearestBand = Math.round((y - BRANCH_OFFSET) / BRANCH_INTERVAL);
  const branchSlope = Math.cos(x / 430) * 90 / 430 + Math.cos(x / 180) * 25 / 180;
  for (let band = nearestBand - 1; band <= nearestBand + 1; band++) {
    distance = Math.min(distance, Math.abs(y - branchY(x, band)) / Math.hypot(1, branchSlope));
  }
  return distance;
}

function smoothUnion(a: number, b: number, radius: number): number {
  const h = Math.max(0, radius - Math.abs(a - b)) / radius;
  return Math.min(a, b) - h * h * radius * .25;
}

/** A worn contour, with gently changing widths and rounded crossroad shoulders. */
export function roadSurface(x: number, y: number, seed: number): { weight: number; distance: number; tracks: number } {
  const phase = (seed % 997) / 997 * Math.PI * 2;
  const mainSlope = Math.cos(y / 580) * 78 / 580 + Math.cos(y / 210) * 22 / 210;
  const mainDistance = Math.abs(x - mainPathX(y)) / Math.hypot(1, mainSlope);
  const mainWidth = 29 + Math.sin(y / 211 + phase) * 3.5 + Math.sin(y / 73 - phase) * 1.5;
  let distance = mainDistance;
  let contour = mainDistance - mainWidth;
  let branchDistance = Infinity;
  const nearestBand = Math.round((y - BRANCH_OFFSET) / BRANCH_INTERVAL);
  const branchSlope = Math.cos(x / 430) * 90 / 430 + Math.cos(x / 180) * 25 / 180;
  const normal = Math.hypot(1, branchSlope);
  for (let band = nearestBand - 1; band <= nearestBand + 1; band++) {
    const d = Math.abs(y - branchY(x, band)) / normal;
    const halfWidth = 24 + Math.sin(x / 257 + band + phase) * 3 + Math.sin(x / 89 + phase) * 1.5;
    contour = smoothUnion(contour, d - halfWidth, 22);
    branchDistance = Math.min(branchDistance, d);
    distance = Math.min(distance, d);
  }
  // Low-amplitude erosion breaks the silhouette without moving the walkable route.
  const erosion = Math.sin(x / 43 + Math.sin(y / 61) + phase) * 1.8
    + Math.sin(y / 19 - x / 37 + phase * 2) * .8;
  const weight = 1 - smoothstep(-5, 19, contour + erosion);
  const junctionFade = smoothstep(5, 30, Math.abs(mainDistance - branchDistance));
  const wear = .5 + .25 * Math.sin((mainDistance < branchDistance ? y : x) / 83 + phase);
  const tracks = (1 - smoothstep(1, 4.5, Math.abs(distance - 10.5))) * junctionFade * wear;
  return { weight, distance, tracks };
}
