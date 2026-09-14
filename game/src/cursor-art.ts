import { CURSOR_SIZE, CURSOR_STYLES, type CursorStyle } from './cursor-content.ts';

const paths = new Map<CursorStyle, Path2D>();
const OUTLINE = '#071019';

export function cursorPreview(style: typeof CURSOR_STYLES[number], size: number = CURSOR_SIZE.default): string {
  const pixels = 48 * size / 100;
  const arrow = style.id === 'arrow';
  return `<svg viewBox="-24 -24 48 48" width="${pixels}" height="${pixels}" aria-hidden="true"><g transform="${arrow ? 'translate(-12 -15)' : ''}" fill="${arrow ? style.color : 'none'}" stroke-linecap="round" stroke-linejoin="round"><path d="${style.path}" stroke="${OUTLINE}" stroke-width="6"/><path d="${style.path}" stroke="${style.color}" stroke-width="2.5"/>${arrow ? '' : `<circle r="2" fill="#fff" stroke="${OUTLINE}" stroke-width="2"/>`}</g></svg>`;
}

/** Constant screen size, opaque contrast, and no animation or post-processing. */
export function drawMouseCursor(c: CanvasRenderingContext2D, id: CursorStyle, x: number, y: number, size: number = CURSOR_SIZE.default): void {
  const style = CURSOR_STYLES.find(style => style.id === id)!;
  let path = paths.get(id);
  if (!path) { path = new Path2D(style.path); paths.set(id, path); }
  c.save(); c.translate(x, y);
  c.scale(size / 100, size / 100);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = OUTLINE; c.lineWidth = 6; c.stroke(path);
  if (id === 'arrow') { c.fillStyle = style.color; c.fill(path); }
  c.strokeStyle = style.color; c.lineWidth = 2.5; c.stroke(path);
  if (id !== 'arrow') {
    c.beginPath(); c.arc(0, 0, 2, 0, Math.PI * 2);
    c.fillStyle = '#fff'; c.fill(); c.strokeStyle = OUTLINE; c.lineWidth = 2; c.stroke();
  }
  c.restore();
}
