export type GroundLootNameplates = 'always' | 'ctrl';
export interface GroundLootLabel { id: number; x: number; y: number; width: number; height: number; anchorX: number; anchorY: number; visible?: boolean; }
export interface GroundLootVisibility {
  showAll: boolean;
  pointer?: { x: number; y: number } | null;
  retainedId?: number;
  selectedId?: number | null;
}
/** Hidden plates have no hit area; their physical item can still be hovered. */
export function groundLootVisibility(labels: readonly GroundLootLabel[], options: GroundLootVisibility): GroundLootLabel[] {
  const candidates = labels.map(label => ({ ...label, visible: options.showAll || label.id === options.retainedId || label.id === options.selectedId }));
  const hovered = options.pointer && hoveredGroundLoot(candidates, options.pointer.x, options.pointer.y);
  return candidates.map(label => ({ ...label, visible: options.showAll || label.id === hovered?.id || label.id === options.selectedId }));
}
export function hoveredGroundLoot(labels: readonly GroundLootLabel[], x: number, y: number): GroundLootLabel | undefined {
  // Labels win over neighboring item silhouettes in a crowded pile.
  return labels.find(b => b.visible !== false && x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height)
    ?? labels.find(b => Math.abs(x - b.anchorX) <= 15 && y >= b.anchorY - 20 && y <= b.anchorY + 6);
}
