import { GAME_FONT_STACK } from './font.ts';
import { BARK_LAYOUT, type BarkBox } from './battle-bark-layout.ts';
import { BARK_RULES } from './battle-bark-content.ts';

export function measureBattleBark(c: CanvasRenderingContext2D, value: string): number {
  c.save(); c.font = `${BARK_LAYOUT.fontSize}px ${GAME_FONT_STACK}`;
  const width = c.measureText(value).width; c.restore(); return width;
}

/** Ashglass: one continuous silver outline around charcoal glass and its tail.
 * Canvas text uses the native UI surface, never the world CRT or camera scale. */
export function drawBattleBark(c: CanvasRenderingContext2D, box: BarkBox, age: number): void {
  const { x, y, width: w, bodyHeight: h, tailX, tailY } = box, radius = 7;
  c.save();
  c.globalAlpha *= Math.max(0, Math.min(1, age / BARK_RULES.fadeIn, (BARK_RULES.duration - age) / BARK_RULES.fadeOut));
  c.beginPath(); c.moveTo(x + radius, y); c.lineTo(x + w - radius, y);
  c.quadraticCurveTo(x + w, y, x + w, y + radius); c.lineTo(x + w, y + h - radius);
  c.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  c.lineTo(tailX + 6, y + h); c.lineTo(tailX, tailY); c.lineTo(tailX - 6, y + h);
  c.lineTo(x + radius, y + h); c.quadraticCurveTo(x, y + h, x, y + h - radius);
  c.lineTo(x, y + radius); c.quadraticCurveTo(x, y, x + radius, y); c.closePath();
  c.fillStyle = '#202a2bee'; c.fill(); c.strokeStyle = '#8e9890'; c.lineWidth = 1; c.stroke();
  c.font = `${BARK_LAYOUT.fontSize}px ${GAME_FONT_STACK}`; c.fontKerning = 'normal';
  c.fillStyle = '#eeeede'; c.textAlign = 'center'; c.textBaseline = 'middle';
  box.lines.forEach((line, i) => c.fillText(line, x + w / 2, y + BARK_LAYOUT.paddingY + BARK_LAYOUT.lineHeight * (i + .5)));
  c.restore();
}
