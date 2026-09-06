import type { GroundGold } from './gold.ts';
import { REWARD_FLIGHT_SECONDS, type RewardFeedback, type LevelCelebration } from './reward-feedback.ts';
import { HUD_ART, getHUDLayout } from './hud-layout.ts';
import { text } from './font.ts';
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
      const spread = Math.sqrt(i) * 5 * Math.min(1, pile.age * 4);
      const bounce = reducedMotion ? 0 : Math.abs(Math.sin(pile.age * 11)) * (23 + i * 2) * Math.max(0, 1 - pile.age / .8);
      const x = pile.x + Math.cos(phase) * spread, y = pile.y + Math.sin(phase) * spread * .5;
      c.save(); c.translate(x, y - bounce - i * .4);
      c.rotate(reducedMotion ? 0 : Math.sin(pile.age * 9 + phase) * Math.max(0, 1 - pile.age / .8) * 1.4);
      coin(c, 0, 0, 1.35); c.restore();
    }
    const glint = reducedMotion ? .15 : Math.pow(Math.max(0, Math.sin(time * 2.3 + pile.id)), 18);
    c.globalAlpha = glint * .85; c.strokeStyle = '#fff0b7'; c.lineWidth = .7;
    c.beginPath(); c.moveTo(pile.x - 4, pile.y - 3); c.lineTo(pile.x + 4, pile.y - 3);
    c.moveTo(pile.x, pile.y - 7); c.lineTo(pile.x, pile.y + 1); c.stroke(); c.globalAlpha = 1;
  }
  c.restore();
}
/** Screen-space flights leave their source once and remain stable as the camera moves. */
export function drawRewardFlights(c: CanvasRenderingContext2D, feedback: RewardFeedback,
  project: (x: number, y: number) => { x: number; y: number }, width: number, height: number): void {
  const hud = getHUDLayout(width, height), rail = HUD_ART.experience;
  c.save();
  for (const mote of feedback.motes) {
    if (!mote.screen) {
      const point = project(mote.x, mote.y);
      mote.screen = { x: Math.max(8, Math.min(width - 8, point.x)) / width, y: Math.max(8, Math.min(height - 8, point.y)) / height };
    }
    if (mote.age < 0) continue;
    const t = Math.min(1, mote.age / REWARD_FLIGHT_SECONDS), gold = mote.kind === 'gold';
    const sx = mote.screen.x * width, sy = mote.screen.y * height;
    const ex = gold ? 27 : hud.x + (rail.x + 5) * hud.scale, ey = gold ? 62 : hud.y + (rail.y + 3) * hud.scale;
    const bend = Math.sin(mote.phase) * 32;
    const position = (v: number) => {
      const q = v * v * (2 - v), u = 1 - q;
      return { x: u * u * sx + 2 * u * q * (sx + (ex - sx) * .22 + bend) + q * q * ex,
        y: u * u * sy + 2 * u * q * (Math.min(sy, ey) - 45 - Math.abs(bend)) + q * q * ey };
    };
    const point = position(t);
    c.globalAlpha = Math.min(1, t * 10) * Math.min(1, (1.12 - t) * 7);
    c.strokeStyle = gold ? '#e8bb59' : '#bba0f3'; c.lineWidth = gold ? 1.3 : 1.7;
    c.beginPath(); const tail = position(Math.max(0, t - .065)); c.moveTo(tail.x, tail.y);
    for (let i = 1; i <= 6; i++) { const p = position(Math.max(0, t - .065) + Math.min(t, .065) * i / 6); c.lineTo(p.x, p.y); }
    c.stroke(); c.shadowColor = c.strokeStyle; c.shadowBlur = 8;
    if (gold) { c.save(); c.translate(point.x, point.y); c.rotate(t * 5 + mote.phase); coin(c, 0, 0, .8); c.restore(); }
    else {
      c.fillStyle = '#f5ecff'; c.beginPath(); c.ellipse(point.x, point.y, 2.4, 1.5, t * 3, 0, Math.PI * 2); c.fill();
    }
    c.shadowBlur = 0;
  }
  c.restore();
}

/** Native-resolution counter with stable columns; pending gold drains into the total. */
export function drawGoldBalance(c: CanvasRenderingContext2D, feedback: RewardFeedback): void {
  const pulse = feedback.gold.pulse, pending = Math.max(0, Math.round(feedback.gold.target) - Math.round(feedback.balance));
  c.save(); c.font = '500 14px "Evergrow Numerals", system-ui, sans-serif'; c.textBaseline = 'middle';
  c.shadowColor = '#02070d'; c.shadowBlur = 4;
  const total = formatGold(Math.round(feedback.balance));
  const pendingX = 48 + Math.max(54, c.measureText(formatGold(feedback.gold.target)).width);
  const glow = c.createRadialGradient(27, 62, 0, 27, 62, 19);
  glow.addColorStop(0, `rgba(255,212,111,${pulse * .45})`); glow.addColorStop(1, '#efb64000');
  c.fillStyle = glow; c.fillRect(8, 43, 38, 38);
  coin(c, 27, 62, 1.4 + pulse * .12);
  c.fillStyle = pulse > .5 ? '#fff1be' : '#e3c880'; c.fillText(total, 41, 62);
  if (pending) {
    c.fillStyle = '#f5d890'; c.fillText(`+${formatGold(pending)}`, pendingX, 62);
    c.strokeStyle = '#c5a75e70'; c.lineWidth = 1; c.beginPath();
    c.moveTo(pendingX, 73); c.lineTo(pendingX + Math.min(62, 12 + Math.log2(pending + 1) * 4), 73); c.stroke();
  }
  c.restore();
}

/** Warm foot-ring, rising filaments and a short pillar; never covers the whole scene. */
export function drawLevelCelebration(c: CanvasRenderingContext2D, level: LevelCelebration | null,
  x: number, y: number, reducedMotion: boolean): void {
  if (!level) return;
  const t = reducedMotion ? .65 : level.age, fade = Math.min(1, level.age * 7) * Math.min(1, (2.4 - level.age) * 1.5);
  c.save(); c.translate(x, y); c.globalCompositeOperation = 'lighter';
  const beam = c.createLinearGradient(0, 4, 0, -135);
  beam.addColorStop(0, '#e9bd592f'); beam.addColorStop(.38, '#ffe9ae12'); beam.addColorStop(1, '#fff4d200');
  c.globalAlpha = fade * Math.max(.1, 1 - t / 1.8); c.fillStyle = beam;
  c.beginPath(); c.moveTo(-27, 3); c.lineTo(-46, -140); c.lineTo(46, -140); c.lineTo(27, 3); c.closePath(); c.fill();
  const radius = 17 + (1 - Math.exp(-t * 4)) * 49;
  c.globalAlpha = fade * Math.max(.1, 1 - t / 2.2); c.strokeStyle = '#ffde8b'; c.lineWidth = 1.7;
  for (const scale of [1, .87]) { c.beginPath(); c.ellipse(0, 1, radius * scale, radius * .32 * scale, 0, 0, Math.PI * 2); c.stroke(); }
  for (let i = 0; i < 20; i++) {
    const phase = i * 2.399, rise = (t * 54 + i * 5) % 110;
    const px = Math.cos(phase + t * .55) * (20 + i % 3 * 8), py = -rise;
    c.globalAlpha = fade * Math.sin(rise / 110 * Math.PI) * .7;
    c.strokeStyle = i % 3 ? '#f2c777' : '#fff3cf'; c.lineWidth = i % 4 ? .8 : 1.4;
    c.beginPath(); c.moveTo(px, py + 9); c.quadraticCurveTo(px - 4, py + 3, px, py); c.stroke();
    c.fillStyle = '#fff0c0'; c.fillRect(px - .8, py - 1, 1.6, 2);
  }
  c.restore();
}

export function drawLevelAnnouncement(c: CanvasRenderingContext2D, level: LevelCelebration | null,
  point: { x: number; y: number }, width: number, height: number, reducedMotion: boolean): void {
  if (!level) return;
  const fade = Math.min(1, level.age * 6) * Math.min(1, (2.4 - level.age) * 2);
  const x = Math.max(125, Math.min(width - 125, point.x)), y = Math.max(106, Math.min(height - 180, point.y - 122));
  c.save(); c.globalAlpha = fade;
  c.translate(x, y + (reducedMotion ? 0 : 8 * Math.exp(-level.age * 7)));
  const halo = c.createRadialGradient(0, 0, 1, 0, 0, 105);
  halo.addColorStop(0, '#0a111bbb'); halo.addColorStop(1, '#0a111b00'); c.fillStyle = halo; c.fillRect(-105, -36, 210, 85);
  c.strokeStyle = '#d2b77a'; c.lineWidth = .7; c.beginPath(); c.moveTo(-109, 5); c.lineTo(-77, 5); c.moveTo(77, 5); c.lineTo(109, 5); c.stroke();
  text(c, 'LEVEL UP', 0, -15, 1.65, '#ffedb7', 'center');
  text(c, `${level.level}`, 0, 4, 2.7, '#fff2cc', 'center');
  text(c, `+${level.statPoints} attributes · +${level.skillPoints} skill`, 0, 33, .9, '#d9d8c3', 'center');
  c.restore();
}
