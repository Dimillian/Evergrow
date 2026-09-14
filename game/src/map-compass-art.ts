import { text } from './font.ts';
import { UI_THEME } from './ui-theme.ts';

/** Fixed north-up chart ornament, drawn at native HUD resolution. */
export function drawMapCompass(c: CanvasRenderingContext2D, x: number, y: number) {
  const p = UI_THEME.palette;
  c.save(); c.translate(x, y);
  const circle = (radius: number) => { c.beginPath(); c.arc(0, 0, radius, 0, Math.PI * 2); };

  const point = (angle: number, length: number, width: number, light: string, shade: string) => {
    c.save(); c.rotate(angle);
    c.beginPath(); c.moveTo(0, -length); c.lineTo(-width, 0); c.lineTo(0, 0); c.closePath();
    c.fillStyle = light; c.fill();
    c.beginPath(); c.moveTo(0, -length); c.lineTo(width, 0); c.lineTo(0, 0); c.closePath();
    c.fillStyle = shade; c.fill(); c.restore();
  };
  point(Math.PI / 2, 18, 4, p.silverDim, p.steel);
  point(-Math.PI / 2, 18, 4, p.silverDim, p.steel);
  point(Math.PI, 20, 4.5, p.silver, p.silverDim);
  point(0, 23, 5, '#e3cf91', p.brassDim);
  circle(3); c.fillStyle = p.ink; c.fill(); c.strokeStyle = p.brass; c.lineWidth = 1; c.stroke();
  circle(1); c.fillStyle = p.ivory; c.fill();

  text(c, 'N', 0, -37, 1.15, '#e3cf91', 'center');
  text(c, 'S', 0, 30, .9, p.muted, 'center');
  text(c, 'W', -33.5, -3.5, .9, p.muted, 'center');
  text(c, 'E', 33.5, -3.5, .9, p.muted, 'center');
  c.restore();
}
