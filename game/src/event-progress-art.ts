import { text } from './font.ts';
import type { cursedChestProgress } from './event-progress.ts';

/** Screen-space seal, drawn after world post-processing with native-resolution text. */
export function drawCursedChestProgress(c: CanvasRenderingContext2D, x: number, y: number, progress: NonNullable<ReturnType<typeof cursedChestProgress>>) {
  const radius = 25, start = -Math.PI / 2, end = start + Math.PI * 2 * progress.fraction;
  c.save(); c.translate(x, y);
  c.fillStyle = '#120e1eed'; c.strokeStyle = '#62516f'; c.lineWidth = 1;
  c.beginPath(); c.arc(0, 0, radius + 5, 0, Math.PI * 2); c.fill(); c.stroke();
  c.strokeStyle = '#45354f'; c.lineWidth = 3;
  c.beginPath(); c.arc(0, 0, radius, 0, Math.PI * 2); c.stroke();
  if (progress.fraction > 0) {
    c.strokeStyle = '#d59be9'; c.shadowColor = '#ae62d4'; c.shadowBlur = 8;
    c.beginPath(); c.arc(0, 0, radius, start, end); c.stroke();
    c.shadowBlur = 0; c.fillStyle = '#fff0ff';
    c.beginPath(); c.arc(Math.cos(end) * radius, Math.sin(end) * radius, 2.5, 0, Math.PI * 2); c.fill();
  }
  text(c, `${Math.ceil(progress.remaining)}`, 0, -10, 1.65, '#f2e4f6', 'center');
  text(c, 'sec', 0, 8, .75, '#c4aacd', 'center');
  const label = progress.started ? 'Unsealing' : 'Awaiting foes';
  c.fillStyle = '#120e1eed'; c.fillRect(-49, 35, 98, 18);
  text(c, label, 0, 39, .9, '#d8b7e6', 'center');
  c.restore();
}
