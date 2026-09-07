import { text, textWidth } from './font.ts';
import { debuffDuration, type EnemyDebuff } from './enemy-debuffs.ts';

function icon(c: CanvasRenderingContext2D, id: EnemyDebuff['id'], x: number, y: number) {
  c.save(); c.translate(x, y); c.lineWidth = 1; c.lineCap = c.lineJoin = 'round'; c.beginPath();
  if (id === 'burn') {
    c.moveTo(0, -5); c.bezierCurveTo(2, -2, 5, 0, 3, 4); c.bezierCurveTo(1, 6, -4, 5, -4, 1);
    c.quadraticCurveTo(-4, -1, -2, -2); c.quadraticCurveTo(-2, 1, 0, 1); c.quadraticCurveTo(2, 0, 0, -5);
  } else if (id === 'chill' || id === 'freeze') {
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3, dx = Math.cos(a), dy = Math.sin(a);
      c.moveTo(-dx * 5, -dy * 5); c.lineTo(dx * 5, dy * 5);
      for (const side of [-1, 1]) {
        const x = side * dx * 3, y = side * dy * 3;
        c.moveTo(x - dy * 1.6 + side * dx, y + dx * 1.6 + side * dy); c.lineTo(x, y);
        c.lineTo(x + dy * 1.6 + side * dx, y - dx * 1.6 + side * dy);
      }
    }
  } else {
    c.moveTo(1, -5); c.lineTo(-3, 1); c.lineTo(0, 1); c.lineTo(-1, 5); c.lineTo(4, -1); c.lineTo(1, -1);
  }
  c.stroke(); c.restore();
}

/** One restrained, centered row. Narrow screens keep the distinct icons and readable timer. */
export function drawEnemyDebuffs(c: CanvasRenderingContext2D, debuffs: readonly EnemyDebuff[], width: number, y: number): void {
  if (!debuffs.length) return;
  const gap = 5, size = .86, available = width - 20;
  const cells = debuffs.map(d => ({ ...d, duration: debuffDuration(d.remaining) }));
  const fullWidths = cells.map(d => 28 + textWidth(d.label, size, 'interface') + textWidth(d.duration, size, 'interface'));
  const labels = fullWidths.reduce((sum, w) => sum + w, 0) + gap * (cells.length - 1) <= available;
  const widths = cells.map((d, i) => labels ? fullWidths[i] : 25 + textWidth(d.duration, size, 'interface'));
  let x = (width - widths.reduce((sum, w) => sum + w, 0) - gap * (cells.length - 1)) / 2;
  c.save();
  for (const [i, d] of cells.entries()) {
    const w = widths[i];
    c.fillStyle = '#091219ee'; c.beginPath(); c.roundRect(x, y, w, 18, 4); c.fill();
    c.strokeStyle = `${d.color}32`; c.lineWidth = .6; c.stroke();
    c.strokeStyle = d.color; icon(c, d.id, x + 9, y + 8.5);
    if (labels) text(c, d.label, x + 18, y + 5, size, d.color, 'left', 'interface');
    text(c, d.duration, x + w - 5, y + 5, size, '#d9e0df', 'right', 'interface');
    x += w + gap;
  }
  c.restore();
}
