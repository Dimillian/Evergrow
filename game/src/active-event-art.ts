import { text, textWidth } from './font.ts';
import type { eventProgress } from './event-progress.ts';

/** Native-resolution active-trial panel. The bar is time left or completed waves. */
export function drawEventProgress(c: CanvasRenderingContext2D, progress: NonNullable<ReturnType<typeof eventProgress>>) {
  const label = progress.started ? progress.label : 'Awaiting guardians';
  // Reserve the widest countdown so the card does not resize at digit boundaries.
  const timerWidth = progress.timer ? textWidth('000s', 1.2) + 20 : 0;
  const width = Math.max(260, textWidth(progress.site.name, 1.2) + timerWidth + 30, textWidth(label, 1) + 30);
  c.save(); c.translate(16, 80);
  c.fillStyle = '#10121aee'; c.fillRect(0, 0, width, 71);
  c.strokeStyle = '#63526f'; c.lineWidth = 1; c.strokeRect(.5, .5, width - 1, 70);
  c.fillStyle = '#c79bde'; c.fillRect(0, 0, 3, 71);
  text(c, progress.site.name, 14, 10, 1.2, '#eddbf5');
  if (progress.timer) text(c, progress.timer, width - 14, 10, 1.2, '#eddbf5', 'right');
  text(c, label, 14, 31, 1, '#d9d9d1');
  c.fillStyle = '#372d40'; c.fillRect(14, 54, width - 28, 5);
  c.fillStyle = '#c79bde'; c.fillRect(14, 54, (width - 28) * progress.fraction, 5);
  c.restore();
}
