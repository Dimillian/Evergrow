export interface GroundLootLabel { id: number; x: number; y: number; width: number; height: number; anchorX: number; anchorY: number; }
export function hoveredGroundLoot(labels: readonly GroundLootLabel[], x: number, y: number): GroundLootLabel | undefined {
  // Labels win over neighboring item silhouettes in a crowded pile.
  return labels.find(b => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height)
    ?? labels.find(b => Math.abs(x - b.anchorX) <= 15 && y >= b.anchorY - 20 && y <= b.anchorY + 6);
}
