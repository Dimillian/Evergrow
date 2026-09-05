import type { Player } from './model.ts';
import { xpForNextLevel } from './progression.ts';
import { HUD_ART } from './hud-layout.ts';
import { UI_THEME } from './ui-theme.ts';
import { text, textWidth } from './font.ts';

type Progress = Pick<Player, 'level' | 'xp'>;
export interface ExperienceDisplay { fill: number; pulse: number; }

/** Presentation only: smooth gains within a level, restart the fill on a new one. */
export class ExperienceFeedback {
  private level = 0;
  private xp = 0;
  private fill = 0;
  private pulse = 0;

  reset(): void { this.level = this.xp = this.fill = this.pulse = 0; }

  update(player: Progress, dt: number, reducedMotion: boolean): ExperienceDisplay {
    const target = player.xp / xpForNextLevel(player.level);
    const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
    this.pulse = Math.max(0, this.pulse - step * 1.5);
    if (!this.level || player.level < this.level || (player.level === this.level && player.xp < this.xp)) {
      this.fill = target; this.pulse = 0;
    } else if (player.level > this.level) {
      this.fill = 0; this.pulse = 1;
    } else if (player.xp > this.xp) {
      this.pulse = Math.max(this.pulse, .45);
    }
    this.level = player.level; this.xp = player.xp;
    if (reducedMotion) { this.fill = target; this.pulse = 0; }
    else this.fill += (target - this.fill) * (1 - Math.exp(-step * 10));
    if (Math.abs(this.fill - target) < .0001) this.fill = target;
    return { fill: this.fill, pulse: this.pulse };
  }
}

/** A violet enamel rail and engraved readout tuck beneath the six skill leaves. */
export function drawHUDExperience(c: CanvasRenderingContext2D, player: Progress, time: number,
  display?: ExperienceDisplay): void {
  const { x, y, width: w, height: h, railHeight: rh } = HUD_ART.experience;
  const needed = xpForNextLevel(player.level);
  const fill = Math.max(0, Math.min(1, display?.fill ?? player.xp / needed));
  const pulse = Math.max(0, Math.min(1, display?.pulse ?? 0));
  const ui = UI_THEME.palette;
  c.save();
  // A thin, tapered metal lip makes this part of the instrument, not a new window.
  c.beginPath(); c.moveTo(x + 4, y - 1); c.lineTo(x + w - 4, y - 1);
  c.lineTo(x + w, y + 3); c.lineTo(x + w - 3, y + rh + 3);
  c.lineTo(x + 3, y + rh + 3); c.lineTo(x, y + 3); c.closePath();
  const metal = c.createLinearGradient(0, y, 0, y + rh + 3);
  metal.addColorStop(0, '#516575'); metal.addColorStop(.22, '#182531'); metal.addColorStop(1, '#0b141f');
  c.fillStyle = metal; c.fill(); c.strokeStyle = '#647b8b'; c.lineWidth = .65; c.stroke();
  const bx = x + 4, by = y + 1, bw = w - 8, bh = rh - 1;
  c.fillStyle = '#060c15'; c.fillRect(bx, by, bw, bh);
  if (fill > 0) {
    const enamel = c.createLinearGradient(0, by, 0, by + bh);
    enamel.addColorStop(0, '#d3c5f4'); enamel.addColorStop(.2, '#a798d6');
    enamel.addColorStop(.6, '#7767a7'); enamel.addColorStop(1, '#3c355c');
    c.fillStyle = enamel; c.fillRect(bx, by, bw * fill, bh);
    c.save(); c.beginPath(); c.rect(bx, by, bw * fill, bh); c.clip();
    const gleamX = bx + bw * fill - 2;
    const gleam = c.createRadialGradient(gleamX, by + 2, 0, gleamX, by + 2, 8);
    gleam.addColorStop(0, '#efe3ff' + Math.round(90 + pulse * 120).toString(16).padStart(2, '0'));
    gleam.addColorStop(1, '#d2bfff00'); c.fillStyle = gleam;
    c.fillRect(gleamX - 8, by, 16, bh);
    c.fillStyle = '#eee4ff'; c.globalAlpha = .25 + Math.sin(time * 1.5) * .08;
    c.fillRect(bx, by, bw * fill, .6); c.restore();
  }
  // Quiet quarter marks give the long gauge a calibrated, astronomical scale.
  for (let i = 1; i < 4; i++) {
    c.fillStyle = '#070c1880'; c.fillRect(bx + bw * i / 4, by, .7, bh);
    c.fillStyle = '#8294a8'; c.fillRect(bx + bw * i / 4, y + rh + 1.5, .65, 1);
  }
  if (pulse > 0) {
    c.globalAlpha = pulse * .7; c.strokeStyle = '#dcd0ff'; c.lineWidth = .8;
    c.strokeRect(bx, by, bw, bh); c.globalAlpha = 1;
  }
  // An engraved diamond leads the level; the exact current/required XP stays visible.
  const cy = y + h - 10;
  c.beginPath(); c.moveTo(x + 5, cy - 3); c.lineTo(x + 8, cy); c.lineTo(x + 5, cy + 3); c.lineTo(x + 2, cy); c.closePath();
  c.fillStyle = '#13202c'; c.fill(); c.strokeStyle = '#9c9ebc'; c.lineWidth = .65; c.stroke();
  const level = `LV ${player.level}`, amount = `${player.xp} / ${needed} XP`;
  const size = Math.min(1.04, (w - 24) / Math.max(1, textWidth(level) + textWidth(amount)));
  text(c, level, x + 13, cy - 3.85 * size, size, pulse > .6 ? '#e9ddff' : ui.silver);
  text(c, amount, x + w - 2, cy - 3.85 * size, size, '#b5accb', 'right');
  c.restore();
}
