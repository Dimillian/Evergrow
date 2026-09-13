import { text, textWidth } from './font.ts';
import { UI_THEME } from './ui-theme.ts';
import { drawCachedUIArt } from './ui-art-cache.ts';
import type { eventProgress } from './event-progress.ts';

const UI = UI_THEME.palette;

function drawPanel(c: CanvasRenderingContext2D, width: number) {
  const surface = c.createLinearGradient(0, 0, width * .35, 71);
  surface.addColorStop(0, UI.panelRaised); surface.addColorStop(.5, UI.panel); surface.addColorStop(1, UI.steelDeep);
  c.fillStyle = surface; c.fillRect(0, 0, width, 71);
  c.lineWidth = 1; c.strokeStyle = UI.silverDim;
  c.strokeRect(.5, .5, width - 1, 70);
  c.strokeStyle = UI.ink; c.strokeRect(1.5, 1.5, width - 3, 68);
  c.fillStyle = UI.silver + '0c'; c.fillRect(2, 2, width - 4, 23);
  c.fillStyle = UI.silver + '25'; c.fillRect(14, 25, width - 28, 1);
  // Small square corner fittings echo the shared window metalwork.
  for (const x of [4, width - 4]) for (const y of [4, 67]) {
    const dx = x === 4 ? 1 : -1, dy = y === 4 ? 1 : -1;
    c.strokeStyle = y === 4 ? UI.silver : UI.silverDim;
    c.beginPath(); c.moveTo(x, y + dy * 8); c.lineTo(x, y); c.lineTo(x + dx * 8, y); c.stroke();
    c.fillStyle = UI.brassDim; c.fillRect(x + dx * 3 - .5, y + dy * 3 - .5, 1, 1);
  }
  c.fillStyle = UI.well; c.fillRect(13, 53, width - 26, 7);
  c.strokeStyle = UI.silverDim + '80'; c.strokeRect(13.5, 53.5, width - 27, 6);
}

/** Native-resolution active-trial panel. The bar is time left or completed waves. */
export function drawEventProgress(c: CanvasRenderingContext2D, progress: NonNullable<ReturnType<typeof eventProgress>>) {
  const label = progress.started ? progress.label : 'Awaiting guardians';
  // Reserve the widest countdown so the card does not resize at digit boundaries.
  const timerWidth = progress.timer ? textWidth('000s', 1.2) + 20 : 0;
  const width = Math.max(260, textWidth(progress.site.name, 1.2) + timerWidth + 30, textWidth(label, 1) + 30);
  c.save(); c.translate(16, 80);
  drawCachedUIArt(c, `active-event:${width}`, 0, 0, width, 71, art => drawPanel(art, width));
  text(c, progress.site.name, 14, 10, 1.2, UI.ivory);
  if (progress.timer) text(c, progress.timer, width - 14, 10, 1.2, UI.brass, 'right');
  text(c, label, 14, 33, 1, UI.text);
  if (progress.fraction > 0) {
    const fillWidth = (width - 28) * progress.fraction;
    const enamel = c.createLinearGradient(0, 54, 0, 59);
    enamel.addColorStop(0, UI.jade); enamel.addColorStop(.45, UI.silverDim); enamel.addColorStop(1, UI.jadeDark);
    c.fillStyle = enamel; c.fillRect(14, 54, fillWidth, 5);
    c.fillStyle = UI.silver + '80'; c.fillRect(14, 54, fillWidth, 1);
    c.fillStyle = UI.brass; c.fillRect(14 + Math.max(0, fillWidth - 1), 54, Math.min(1, fillWidth), 5);
  }
  c.restore();
}
