import type { SkillId } from './character-types.ts';
import { skillIconDrawing, skillIconGradient, skillIconSurface, SKILL_ICON_STOPS } from './skill-icon.ts';

const paths = new Map<string, Path2D>();
const stamps = new Map<string, HTMLCanvasElement>();
/** Synchronous paths: the first frame is complete, with no image decoding or DOM parsing. */
export function paintSkillIcon(c: CanvasRenderingContext2D, id: SkillId, x: number, y: number, size: number, detail = size >= 40): void {
  if (![x, y, size].every(Number.isFinite) || size <= 0) return;
  c.save();
  c.translate(x - size / 2, y - size / 2); c.scale(size / 64, size / 64);
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const op of skillIconDrawing(id, detail)) {
    let path = paths.get(op.path);
    if (!path) { path = new Path2D(op.path); paths.set(op.path, path); }
    c.save(); c.transform(...op.transform); c.globalAlpha *= op.opacity;
    if (op.surface) {
      const gradient = c.createLinearGradient(...skillIconGradient(op.localGradient));
      skillIconSurface(op.surface).forEach((color, i) => gradient.addColorStop(SKILL_ICON_STOPS[i], color));
      c.fillStyle = gradient; c.fill(path);
    } else if (op.fill) { c.fillStyle = op.fill; c.fill(path); }
    if (op.stroke) { c.strokeStyle = op.stroke; c.lineWidth = op.width!; c.stroke(path); }
    c.restore();
  }
  c.restore();
}
/** At most two 144px stamps per skill (~5 MiB for all 30). Large studies stay vector. */
export function drawSkillIcon(c: CanvasRenderingContext2D, id: SkillId, x: number, y: number, size: number): void {
  if (![x, y, size].every(Number.isFinite) || size <= 0) return;
  if (size > 72) { paintSkillIcon(c, id, x, y, size); return; }
  const detail = size >= 40, key = `${id}:${detail}`;
  let stamp = stamps.get(key);
  if (!stamp) {
    stamp = document.createElement('canvas'); stamp.width = stamp.height = 144;
    const context = stamp.getContext('2d');
    if (!context) { paintSkillIcon(c, id, x, y, size); return; }
    paintSkillIcon(context, id, 72, 72, 144, detail); stamps.set(key, stamp);
  }
  c.drawImage(stamp, x - size / 2, y - size / 2, size, size);
}
