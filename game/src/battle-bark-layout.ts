export interface BarkRect { x: number; y: number; width: number; height: number; }
export interface BarkBox extends BarkRect { lines: readonly string[]; tailX: number; tailY: number; bodyHeight: number; }
export const BARK_LAYOUT = Object.freeze({ fontSize: 16, lineHeight: 19, paddingX: 12, paddingY: 9, maxWidth: 220, tail: 8, headGap: 10, margin: 8 });
export function barkOverlap(a: BarkRect, b: BarkRect): boolean {
  return a.x < b.x + b.width + 4 && a.x + a.width + 4 > b.x
    && a.y < b.y + b.height + 4 && a.y + a.height + 4 > b.y;
}

/** Natural measured glyph widths, at most two lines, and six local placements.
 * Never shrink text, clip at screen edges, stack vertically or move the speaker. */
export function placeBattleBark(value: string, head: { x: number; y: number }, viewport: { width: number; height: number },
  measure: (text: string) => number, blocked: readonly BarkRect[]): BarkBox | null {
  const r = BARK_LAYOUT, available = Math.min(r.maxWidth, viewport.width - 2 * r.margin) - 2 * r.paddingX;
  let lines = [value];
  if (measure(value) > available) {
    const words = value.split(' ');
    let best = Infinity;
    for (let split = 1; split < words.length; split++) {
      const pair = [words.slice(0, split).join(' '), words.slice(split).join(' ')];
      const widths = pair.map(measure), widest = Math.max(...widths);
      if (widest <= available && Math.abs(widths[0] - widths[1]) < best) {
        best = Math.abs(widths[0] - widths[1]); lines = pair;
      }
    }
    if (lines.length === 1) return null;
  }
  const width = Math.max(...lines.map(measure)) + r.paddingX * 2;
  const bodyHeight = lines.length * r.lineHeight + r.paddingY * 2;
  for (const up of [0, 12]) for (const side of [0, -24, 24]) {
    const height = bodyHeight + r.tail + up;
    const box: BarkBox = { x: head.x - width / 2 + side, y: head.y - r.headGap - height,
      width, height, bodyHeight, lines, tailX: head.x, tailY: head.y - r.headGap };
    if (box.x < r.margin || box.y < r.margin || box.x + width > viewport.width - r.margin
      || box.y + height > viewport.height - r.margin || Math.abs(side) > width / 2 - 14) continue;
    if (!blocked.some(rect => barkOverlap(box, rect))) return box;
  }
  return null;
}
