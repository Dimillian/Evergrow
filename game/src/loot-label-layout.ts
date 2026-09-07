import type { Item } from './character-types.ts';

export const LOOT_LABEL_STYLE = Object.freeze({ height: 19, gap: 4, maxWidth: 210, nameSize: .9, levelSize: .7 });

/** Short ground-only names; the owned item and its full tooltip name stay intact. */
export function groundLootName(item: Item): string {
  const name = item.tier === 'common' || item.tier === 'magic' ? item.baseName : item.name;
  return `${name}${item.recipe.enhancement ? ` +${item.recipe.enhancement}` : ''}`;
}

export function fitLootName(value: string, width: number, measure: (text: string) => number): string {
  if (width <= 0) return '';
  if (measure(value) <= width) return value;
  if (measure('…') > width) return '';
  let end = value.length;
  while (end > 0 && measure(value.slice(0, end).trimEnd() + '…') > width) end--;
  return value.slice(0, end).trimEnd() + '…';
}

export interface LootLabelAnchor { id: number; x: number; y: number; width: number; }
export interface LootLabelBox extends LootLabelAnchor { left: number; top: number; height: number; }

/** Stable packing in display coordinates. Every candidate checks every placed label. */
export function layoutLootLabels(anchors: readonly LootLabelAnchor[], width: number, height: number): LootLabelBox[] {
  const result: LootLabelBox[] = [], labelHeight = LOOT_LABEL_STYLE.height, row = labelHeight + LOOT_LABEL_STYLE.gap, margin = 8;
  for (const a of [...anchors].sort((a, b) => b.y - a.y || a.id - b.id)) {
    if (a.x < 0 || a.x > width || a.y < 0 || a.y > height || width < 40 || height < row) continue;
    const w = Math.min(a.width, width - margin * 2);
    const left = Math.max(margin, Math.min(width - margin - w, a.x - w / 2));
    const base = Math.max(margin, Math.min(height - row, a.y - labelHeight - 10));
    for (let attempt = 0; attempt < Math.ceil(height / row) * 2; attempt++) {
      const offset = Math.ceil(attempt / 2) * row * (attempt % 2 ? -1 : 1), top = base + offset;
      if (top < margin || top + labelHeight > height - margin) continue;
      if (result.some(b => left < b.left + b.width + 4 && left + w + 4 > b.left
        && top < b.top + b.height + 4 && top + row > b.top)) continue;
      result.push({ ...a, width: w, left, top, height: labelHeight }); break;
    }
  }
  return result;
}
