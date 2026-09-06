import type { Player } from './model.ts';
import { xpForNextLevel } from './progression.ts';
import { HUD_ART } from './hud-layout.ts';
import { UI_THEME } from './ui-theme.ts';
import { text, textWidth } from './font.ts';

import type { CombatEvent } from './model.ts';
import { RewardCounter } from './reward-counter.ts';

type Progress = Pick<Player, 'level' | 'xp'>;
export interface ExperienceDisplay { fill: number; pulse: number; pendingFill: number; pending: number; level: number; xp: number; }

/** Reward amounts advance a visual ledger; the actual character has already gained its levels. */
export class ExperienceFeedback {
  private counter = new RewardCounter(.6);
  private level = 0;
  private observed: Progress = { level: 0, xp: 0 };
  private received = 0;
  private fullTime = 0;
  reset(): void { this.counter.reset(); this.level = this.received = this.fullTime = 0; this.observed = { level: 0, xp: 0 }; }
  handleEvents(events: readonly CombatEvent[]): void {
    for (const event of events) if (event.type === 'experience') this.received += event.amount;
  }
  update(player: Progress, dt: number, reducedMotion: boolean): ExperienceDisplay {
    if (!this.level || player.level < this.observed.level || (player.level === this.observed.level && player.xp < this.observed.xp) || reducedMotion) {
      this.level = player.level; this.counter.reset(player.xp); this.fullTime = 0;
    } else {
      const amount = this.received || (player.level === this.observed.level ? Math.max(0, player.xp - this.observed.xp) : 0);
      if (amount) this.counter.add(amount);
      else if (player.level !== this.observed.level) { this.level = player.level; this.counter.reset(player.xp); }
      const needed = xpForNextLevel(this.level);
      if (this.counter.value >= needed && this.level < player.level) {
        this.fullTime += Math.max(0, dt);
        if (this.fullTime >= .12) {
          this.counter.shift(needed); this.level++; this.fullTime = 0;
          // Huge prototype rewards compress intermediate levels rather than queuing minutes of animation.
          if (player.level - this.level > 4) { this.level = player.level; this.counter.reset(0); this.counter.add(player.xp, 0); }
        }
      }
      this.counter.update(dt, reducedMotion, xpForNextLevel(this.level));
    }
    this.received = 0; this.observed = { level: player.level, xp: player.xp };
    const needed = xpForNextLevel(this.level);
    return { fill: Math.min(1, this.counter.value / needed), pendingFill: Math.min(1, this.counter.target / needed),
      pending: Math.ceil(this.counter.pending), pulse: this.counter.pulse, level: this.level,
      xp: Math.min(needed, Math.round(this.counter.value)) };
  }
}

/** Shared chamfer keeps every metal lip, glass edge and pulse on the same contour. */
function railPath(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cut: number): void {
  c.beginPath(); c.moveTo(x + cut, y); c.lineTo(x + w - cut, y);
  c.lineTo(x + w, y + cut); c.lineTo(x + w, y + h - cut);
  c.lineTo(x + w - cut, y + h); c.lineTo(x + cut, y + h);
  c.lineTo(x, y + h - cut); c.lineTo(x, y + cut); c.closePath();
}

/** A violet enamel rail and engraved readout tuck beneath the six skill leaves. */
export function drawHUDExperience(c: CanvasRenderingContext2D, player: Progress, time: number,
  display?: ExperienceDisplay): void {
  const { x, y, width: w, height: h, railHeight: rh } = HUD_ART.experience;
  const needed = xpForNextLevel(display?.level ?? player.level);
  const fill = Math.max(0, Math.min(1, display?.fill ?? player.xp / needed));
  const pulse = Math.max(0, Math.min(1, display?.pulse ?? 0));
  const ui = UI_THEME.palette;
  c.save();
  const top = y - .5, height = rh + 2, corner = 2.6, inset = 1.35;
  const bx = x + inset, by = top + inset, bw = w - inset * 2, bh = height - inset * 2;
  // Parallel chamfers and equal top/bottom insets give the glass a continuous fine bezel.
  const innerCorner = corner - inset * (2 - Math.SQRT2);
  c.lineJoin = 'round';
  railPath(c, x, top + 1, w, height, corner);
  c.fillStyle = '#03081090'; c.fill();
  railPath(c, x, top, w, height, corner);
  const metal = c.createLinearGradient(0, top, 0, top + height);
  metal.addColorStop(0, '#637985'); metal.addColorStop(.25, '#344954'); metal.addColorStop(1, '#1a2a35');
  c.fillStyle = metal; c.fill(); c.strokeStyle = '#748894'; c.lineWidth = .5; c.stroke();
  railPath(c, bx, by, bw, bh, innerCorner);
  c.fillStyle = '#060c15'; c.fill();
  c.save(); c.clip();
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
  const pendingFill = Math.max(fill, Math.min(1, display?.pendingFill ?? fill));
  if (pendingFill > fill) {
    const pending = c.createLinearGradient(bx, by, bx, by + bh);
    pending.addColorStop(0, '#ead8ffbf'); pending.addColorStop(.5, '#ba93ef80'); pending.addColorStop(1, '#8063b944');
    c.fillStyle = pending; c.fillRect(bx + bw * fill, by, bw * (pendingFill - fill), bh);
    c.fillStyle = '#f5e7ff'; c.globalAlpha = .65;
    c.fillRect(bx + bw * pendingFill - .7, by, .7, bh); c.globalAlpha = 1;
  }
  // Short internal ticks preserve the uninterrupted glass and its clean outer edge.
  for (let i = 1; i < 4; i++) {
    c.fillStyle = '#b3bdce50'; c.fillRect(bx + bw * i / 4, by + bh - 1.2, .5, 1.2);
  }
  c.restore();
  railPath(c, bx, by, bw, bh, innerCorner);
  c.strokeStyle = '#020710b8'; c.lineWidth = .55; c.stroke();
  c.beginPath(); c.moveTo(x + corner + 1, top + .4); c.lineTo(x + w - corner - 1, top + .4);
  c.strokeStyle = '#c4d2d747'; c.lineWidth = .4; c.stroke();
  if (pulse > 0) {
    c.globalAlpha = pulse * .55;
    railPath(c, bx, by, bw, bh, innerCorner);
    c.strokeStyle = '#dcd0ff'; c.lineWidth = .65; c.stroke(); c.globalAlpha = 1;
  }
  // An engraved diamond leads the level; the exact current/required XP stays visible.
  const cy = y + h - 10;
  c.beginPath(); c.moveTo(x + 5, cy - 3); c.lineTo(x + 8, cy); c.lineTo(x + 5, cy + 3); c.lineTo(x + 2, cy); c.closePath();
  c.fillStyle = '#13202c'; c.fill(); c.strokeStyle = '#9c9ebc'; c.lineWidth = .65; c.stroke();
  const level = `LV ${display?.level ?? player.level}`, amount = `${display?.xp ?? player.xp} / ${needed} XP`;
  const size = Math.min(1.04, (w - 24) / Math.max(1, textWidth(level) + textWidth(amount)));
  text(c, level, x + 13, cy - 3.85 * size, size, pulse > .6 ? '#e9ddff' : ui.silver);
  text(c, amount, x + w - 2, cy - 3.85 * size, size, '#b5accb', 'right');
  if (display && display.pending > 0) text(c, `+${display.pending} XP`, x + w / 2, y - 8, .8, '#e2caff', 'center');
  c.restore();
}
