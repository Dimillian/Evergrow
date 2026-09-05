import type { GroundGold } from './gold.ts';
import type { RewardFeedback } from './reward-feedback.ts';
import { getHUDLayout, HUD_ART } from './hud-layout.ts';
import { formatGold } from './currency-format.ts';

function coin(c: CanvasRenderingContext2D, x: number, y: number, scale = 1): void {
  c.save(); c.translate(x, y); c.scale(scale, scale);
  c.fillStyle = '#705021'; c.beginPath(); c.ellipse(0, 1.5, 3.6, 2.3, -.25, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#d6ad53'; c.beginPath(); c.ellipse(0, 0, 3.6, 2.3, -.25, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#ffe8a0'; c.lineWidth = .65; c.stroke();
  c.fillStyle = '#85652f'; c.fillRect(-.4, -1.2, .8, 2); c.restore();
}
export function drawGroundGold(c: CanvasRenderingContext2D, piles: readonly GroundGold[], time: number, reducedMotion: boolean): void {
  c.save();
  for (const pile of piles) {
    const count = Math.min(7, 2 + Math.floor(Math.log2(1 + pile.amount) / 2));
    c.fillStyle = '#04090cbc'; c.beginPath(); c.ellipse(pile.x, pile.y + 2, 8, 3, 0, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < count; i++) {
      const phase = i * 2.399 + pile.id;
      const spread = Math.sqrt(i) * 2.3;
      const bounce = reducedMotion ? 0 : Math.abs(Math.sin(pile.age * 14 + i * .5)) * 13 * Math.max(0, 1 - pile.age / .5);
      coin(c, pile.x + Math.cos(phase) * spread, pile.y + Math.sin(phase) * spread * .55 - bounce - i * .5);
    }
    const glint = reducedMotion ? .15 : Math.pow(Math.max(0, Math.sin(time * 2.3 + pile.id)), 18);
    c.globalAlpha = glint * .85; c.strokeStyle = '#fff0b7'; c.lineWidth = .7;
    c.beginPath(); c.moveTo(pile.x - 4, pile.y - 3); c.lineTo(pile.x + 4, pile.y - 3);
    c.moveTo(pile.x, pile.y - 7); c.lineTo(pile.x, pile.y + 1); c.stroke(); c.globalAlpha = 1;
  }
  c.restore();
}
export function drawRewardMotes(c: CanvasRenderingContext2D, feedback: RewardFeedback, px: number, py: number): void {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const mote of feedback.motes) {
    if (mote.age < 0) continue;
    const t = Math.min(1, mote.age / .8), ease = t * t;
    const gold = mote.kind === 'gold';
    const position = (v: number) => ({
      x: mote.x + (px - mote.x) * v * v + Math.sin(v * Math.PI) * Math.cos(mote.phase) * (gold ? 14 : 28),
      y: mote.y + (py - 12 - mote.y) * v * v - Math.sin(v * Math.PI) * (gold ? 14 : 27),
    });
    const point = position(t), tail = position(Math.max(0, t - .13));
    c.globalAlpha = Math.min(1, t * 8) * (1 - ease);
    c.strokeStyle = gold ? '#f2ca69' : '#b8a1f2'; c.lineWidth = gold ? .8 : 1.1;
    c.beginPath(); c.moveTo(tail.x, tail.y); c.lineTo(point.x, point.y); c.stroke();
    c.shadowColor = c.strokeStyle; c.shadowBlur = 6; c.fillStyle = gold ? '#fff0bc' : '#ebe0ff';
    c.beginPath(); c.arc(point.x, point.y, 1.5, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
  }
  c.restore();
}
/** Native-resolution text; camera zoom and CRT never touch reward readouts. */
export function drawRewardHUD(c: CanvasRenderingContext2D, feedback: RewardFeedback, width: number, height: number,
  reducedMotion: boolean): void {
  c.save(); c.font = '600 13px system-ui, sans-serif'; c.textBaseline = 'middle';
  c.shadowColor = '#02070d'; c.shadowBlur = 4;
  coin(c, 27, 62, 1.25);
  c.fillStyle = '#e3c880'; c.fillText(formatGold(feedback.balance), 40, 62);
  if (feedback.gold.remaining > 0) {
    const x = 48 + c.measureText(formatGold(feedback.balance)).width;
    c.globalAlpha = Math.min(1, feedback.gold.remaining / .4);
    c.fillStyle = '#ffe7a0'; c.fillText(`+${formatGold(feedback.gold.amount)}`, x, 62 - (reducedMotion ? 0 : feedback.gold.pulse * 3));
  }
  const xp = feedback.experience;
  if (xp.remaining > 0) {
    const hud = getHUDLayout(width, height), rail = HUD_ART.experience;
    const x = hud.x + (rail.x + rail.width / 2) * hud.scale;
    const y = hud.y + (rail.y + rail.height + 5) * hud.scale;
    c.globalAlpha = Math.min(1, xp.remaining / .5);
    c.textAlign = 'center'; c.fillStyle = '#d4bafa';
    c.fillText(`+${formatGold(xp.amount)} XP`, x, Math.min(height - 9, y) - (reducedMotion ? 0 : xp.pulse * 2));
  }
  c.restore();
}
