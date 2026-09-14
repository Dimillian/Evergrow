import { drawMapSymbol } from './map-symbol-art.ts';
import type { DungeonEventKind } from './dungeon-content.ts';
/** Screen-space dungeon markers, independent of floor generation and discovery. */
export type DungeonMapIcon = DungeonEventKind | 'chest' | 'entry' | 'boss' | 'player';
export function drawDungeonMapIcon(c: CanvasRenderingContext2D, kind: DungeonMapIcon, x: number, y: number,
  completed = false, accent = '#91d9a5', angle = 0): void {
  c.save(); c.translate(x, y); c.lineWidth = 2;
  if (kind === 'player') {
    c.rotate(angle); c.fillStyle = '#fff0bf'; c.beginPath(); c.moveTo(8, 0);
    c.lineTo(-5, -4); c.lineTo(-3, 0); c.lineTo(-5, 4); c.closePath(); c.fill();
  } else {
    const color = kind === 'entry' ? '#a9decc' : completed ? '#688879' : kind === 'chest' ? '#e7c485' : kind === 'boss' ? '#e48c73' : accent;
    c.fillStyle = '#0a131a'; c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill();
    drawMapSymbol(c, kind === 'entry' ? 'exit' : kind === 'boss' ? 'bossLair' : kind, 7, color, '#0a131a');
  }
  c.restore();
}
