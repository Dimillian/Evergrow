export interface LootLabelAnchor { id: number; x: number; y: number; width: number; }
export interface LootLabelBox extends LootLabelAnchor { left: number; top: number; height: number; }

/** Stable packing in display coordinates. Every candidate checks every placed label. */
export function layoutLootLabels(anchors: readonly LootLabelAnchor[], width: number, height: number): LootLabelBox[] {
  const result: LootLabelBox[] = [], row = 32, margin = 8;
  for (const a of [...anchors].sort((a, b) => b.y - a.y || a.id - b.id)) {
    if (a.x < 0 || a.x > width || a.y < 0 || a.y > height || width < 40 || height < row) continue;
    const w = Math.min(a.width, width - margin * 2);
    const left = Math.max(margin, Math.min(width - margin - w, a.x - w / 2));
    const base = Math.max(margin, Math.min(height - row, a.y - 38));
    for (let attempt = 0; attempt < Math.ceil(height / row) * 2; attempt++) {
      const offset = Math.ceil(attempt / 2) * row * (attempt % 2 ? -1 : 1), top = base + offset;
      if (top < margin || top + 28 > height - margin) continue;
      if (result.some(b => left < b.left + b.width + 4 && left + w + 4 > b.left
        && top < b.top + b.height + 4 && top + 32 > b.top)) continue;
      result.push({ ...a, width: w, left, top, height: 28 }); break;
    }
  }
  return result;
}
