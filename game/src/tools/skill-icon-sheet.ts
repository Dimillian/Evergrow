import type { SkillId } from '../character-types.ts';
import { SKILL_DEFINITIONS } from '../skill-content.ts';
import { paintSkillIcon } from '../skill-icon-canvas.ts';
import { GAME_FONT_STACK } from '../font.ts';

export const ICON_STUDY_SKILLS: readonly SkillId[] = ['fireball', 'shieldBash', 'bulwark', 'iceNova', 'absoluteZero', 'sidestep'];
export const ICON_CARD_HEIGHT = 252;
/** Static composition of runtime art. No Game, simulation, saves or animation loop. */
export function drawSkillIconSheet(c: CanvasRenderingContext2D, skills: readonly SkillId[], width: number, columns: number): void {
  const cell = width / columns;
  c.fillStyle = '#0b141c'; c.fillRect(0, 0, width, Math.ceil(skills.length / columns) * ICON_CARD_HEIGHT);
  skills.forEach((id, i) => {
    const x = i % columns * cell, y = Math.floor(i / columns) * ICON_CARD_HEIGHT, s = SKILL_DEFINITIONS[id];
    c.save(); c.translate(x, y);
    const surface = c.createLinearGradient(0, 0, cell, ICON_CARD_HEIGHT);
    surface.addColorStop(0, '#192a36'); surface.addColorStop(1, '#0e1922');
    c.fillStyle = surface; c.fillRect(5, 5, cell - 10, ICON_CARD_HEIGHT - 10);
    c.strokeStyle = '#354752'; c.lineWidth = 1; c.strokeRect(5.5, 5.5, cell - 11, ICON_CARD_HEIGHT - 11);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#dfe9e5'; c.font = `20px ${GAME_FONT_STACK}`;
    c.fillText(s.name, cell / 2, 27);
    c.fillStyle = '#a0b4bd'; c.font = `12px ${GAME_FONT_STACK}`; c.fillText(`${s.domain} · ${s.tier}`, cell / 2, 49);
    paintSkillIcon(c, id, cell / 2, 113, 106);
    for (const [j, label] of ['Hotbar · 32', 'Tree · 24', 'Dimmed · 24'].entries()) {
      const cx = cell / 2 + (j - 1) * Math.min(88, cell / 3.3), cy = 196;
      const lens = c.createLinearGradient(cx - 20, cy - 20, cx + 20, cy + 20);
      lens.addColorStop(0, '#3c505e'); lens.addColorStop(.35, '#182d3d'); lens.addColorStop(1, '#091621');
      c.beginPath();
      if (j === 0) c.rect(cx - 22, cy - 22, 44, 44); else c.arc(cx, cy, 19, 0, Math.PI * 2);
      c.fillStyle = lens; c.fill(); c.strokeStyle = j === 2 ? '#536678' : '#a2b3bf'; c.stroke();
      c.save(); if (j === 2) c.globalAlpha = .42;
      paintSkillIcon(c, id, cx, cy, j === 0 ? 32 : 24); c.restore();
      c.font = `12px ${GAME_FONT_STACK}`; c.fillStyle = '#9fb0bc'; c.fillText(label, cx, 232);
    }
    c.restore();
  });
}
