import type { Enemy } from './model.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { ENEMY_RANKS } from './progression-content.ts';
import { UI_THEME } from './ui-theme.ts';
import { text, textWidth } from './font.ts';
import { getHUDLayout } from './hud.ts';
import { getMinimapRect } from './map-view.ts';
import { drawRankCrest, RANK_METALS } from './enemy-rank-art.ts';

export interface EnemyPlateOptions {
  touch?: boolean;
  /** Safe-area top inset in the same logical coordinates as the UI canvas. */
  topInset?: number;
  opacity?: number;
  /** Delayed resource value in hit points, not a normalized ratio. */
  healthTrail?: number;
  hitPulse?: number;
  time?: number;
  reducedMotion?: boolean;
}

const UI = UI_THEME.palette;
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const compact = (value: number) => value >= 10_000 ? compactNumber.format(value) : `${Math.ceil(value)}`;

/** A centered target readout that shares the existing navigation and map space. */
export function getEnemyPlateLayout(width: number, height: number, touch = false, topInset = 0): { x: number; y: number; width: number; height: number } {
  width = Math.max(0, Number.isFinite(width) ? width : 0);
  height = Math.max(0, Number.isFinite(height) ? height : 0);
  if (touch) {
    const plateWidth = Math.max(0, Math.min(240, width - 24));
    const y = Math.max(8, (Number.isFinite(topInset) ? topInset : 0) + 6);
    return {x: (width - plateWidth) / 2, y, width: plateWidth, height: plateWidth >= 160 && y + 70 <= height ? 70 : 0};
  }
  const map = getMinimapRect(width, height);
  const besideMap = 2 * (map.x - 12 - width / 2);
  const belowMap = besideMap < 180;
  const plateWidth = Math.max(0, Math.min(270, width - 32, belowMap ? Infinity : besideMap));
  const y = belowMap ? map.y + map.height + 8 : width < 720 ? 60 : 16;
  const bottom = Math.min(height - 8, getHUDLayout(width, height).y - 8);
  // The actual game uses at least 450 logical pixels of height. If embedded in a
  // smaller surface, omit the plate when neither the map nor the HUD can move.
  const fits = plateWidth >= 180 && y + 70 <= bottom;
  return { x: (width - plateWidth) / 2, y: Math.min(y, height), width: plateWidth, height: fits ? 70 : 0 };
}

function chamfer(c: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, cut: number) {
  c.beginPath(); c.moveTo(x + cut, y); c.lineTo(x + width - cut, y);
  c.lineTo(x + width, y + cut); c.lineTo(x + width, y + height - cut);
  c.lineTo(x + width - cut, y + height); c.lineTo(x + cut, y + height);
  c.lineTo(x, y + height - cut); c.lineTo(x, y + cut); c.closePath();
}

/** Blood under glass: all movement stays inside the exact remaining health width. */
function bloodMotion(c: CanvasRenderingContext2D, x: number, y: number, width: number, height: number,
  ratio: number, time: number) {
  c.save(); c.beginPath(); c.rect(x, y, width * ratio, height); c.clip();
  const opacity = c.globalAlpha;
  for (let i = 0; i < 3; i++) {
    const phase = time * .65 + i * 2.1;
    const cy = y + 2 + i * 2;
    c.beginPath(); c.moveTo(x - 4, cy);
    c.bezierCurveTo(x + width * .3, cy + Math.sin(phase) * 3,
      x + width * .65, cy + Math.cos(phase * .8) * 3, x + width + 4, cy - 1);
    c.strokeStyle = i === 1 ? '#ff8e96' : '#400923';
    c.globalAlpha = opacity * (i === 1 ? .18 : .3); c.lineWidth = i === 1 ? .8 : 1.5; c.stroke();
  }
  for (let i = 0; i < 18; i++) {
    const phase = (time * (.15 + i % 4 * .023) + i * .381966) % 1;
    const bx = x + (i + .5) / 18 * width + Math.sin(time * .8 + i * 2) * 1.3;
    const by = y + height + 1 - phase * (height + 3), radius = .6 + i % 3 * .23;
    const fade = Math.sin(phase * Math.PI);
    c.globalAlpha = opacity * fade * .5;
    c.beginPath(); c.arc(bx, by, radius, 0, Math.PI * 2);
    c.fillStyle = '#f66a8140'; c.fill(); c.strokeStyle = '#ffa4b0'; c.lineWidth = .4; c.stroke();
    c.globalAlpha = opacity * fade * .8;
    c.beginPath(); c.arc(bx, by, radius * .75, 3.5, 4.8);
    c.strokeStyle = '#ffddd1'; c.stroke();
  }
  // A wet meniscus marks the real health boundary, ahead of the damage trail.
  if (ratio < 1) {
    c.globalAlpha = opacity * .65; c.fillStyle = '#f9a2ac';
    c.fillRect(x + width * ratio - .65, y + .5, .65, height - 1);
  }
  c.restore();
}

/** Native text and restrained metalwork, drawn after world post-processing. */
export function drawEnemyPlate(c: CanvasRenderingContext2D, enemy: Pick<Enemy, 'kind' | 'hp' | 'maxHp' | 'level' | 'rank'>,
  width: number, height: number, options: EnemyPlateOptions = {}): void {
  const layout = getEnemyPlateLayout(width, height, options.touch, options.topInset);
  const opacity = clamp(options.opacity ?? 1);
  if (!layout.height || opacity <= 0) return;
  const w = layout.width;
  const maxHp = Math.max(0, Number.isFinite(enemy.maxHp) ? enemy.maxHp : 0);
  const hp = Math.max(0, Math.min(maxHp, Number.isFinite(enemy.hp) ? enemy.hp : 0));
  const ratio = hp / Math.max(1, maxHp);
  const trail = Math.max(ratio, clamp((options.healthTrail ?? hp) / Math.max(1, maxHp)));
  const hit = clamp(options.hitPulse ?? 0);
  const rank = ENEMY_RANKS[enemy.rank];
  const trim = RANK_METALS[enemy.rank];
  c.save(); c.translate(layout.x, layout.y); c.globalAlpha *= opacity;

  // An elliptical shadow provides legibility without another rectangular panel.
  c.save(); c.translate(w / 2, 36); c.scale(w / 2, 36);
  const shadow = c.createRadialGradient(0, 0, .05, 0, 0, 1);
  shadow.addColorStop(0, '#02050ab8'); shadow.addColorStop(.55, '#02050a78'); shadow.addColorStop(1, '#02050a00');
  c.fillStyle = shadow; c.fillRect(-1, -1, 2, 2); c.restore();

  c.save(); c.shadowColor = '#010409'; c.shadowBlur = 3; c.shadowOffsetY = 1;
  const name = ENEMY_DEFINITIONS[enemy.kind].name;
  text(c, name, w / 2, 28, Math.min(1.13, (w - 30) / Math.max(1, textWidth(name))), UI.ivory, 'center'); c.restore();
  drawRankCrest(c, enemy.rank, w / 2, 14, .88);
  // Engraved suspension arms lead the eye into the rank seal, without a window background.
  for (const side of [-1, 1]) {
    c.save(); c.translate(w / 2, 14); c.scale(side, 1);
    c.strokeStyle = trim.edge; c.lineWidth = .65;
    c.beginPath(); c.moveTo(24, 1); c.lineTo(39, 1); c.lineTo(44, -3); c.lineTo(w / 2 - 29, -3); c.stroke();
    c.strokeStyle = `${trim.light}60`; c.beginPath(); c.moveTo(43, 4); c.lineTo(w / 2 - 42, 4); c.stroke();
    c.fillStyle = trim.light; c.beginPath(); c.moveTo(w / 2 - 22, -5); c.lineTo(w / 2 - 20, -3);
    c.lineTo(w / 2 - 22, -1); c.lineTo(w / 2 - 24, -3); c.closePath(); c.fill(); c.restore();
  }
  const metal = c.createLinearGradient(0, 43, 0, 57);
  metal.addColorStop(0, trim.edge); metal.addColorStop(.15, trim.shade);
  metal.addColorStop(.48, UI.panel); metal.addColorStop(1, UI.ink);
  chamfer(c, 9, 43, w - 18, 14, 4);
  c.fillStyle = metal; c.fill(); c.strokeStyle = trim.edge; c.lineWidth = .8; c.stroke();
  c.beginPath(); c.moveTo(15, 43.7); c.lineTo(w - 15, 43.7);
  c.strokeStyle = `${trim.light}90`; c.lineWidth = .65; c.stroke();

  const barX = 15, barY = 46, barWidth = w - 30, barHeight = 8;
  c.fillStyle = '#070c12'; c.fillRect(barX, barY, barWidth, barHeight);
  if (trail > ratio) {
    c.fillStyle = '#bb866a9c'; c.fillRect(barX, barY, barWidth * trail, barHeight);
  }
  if (ratio > 0) {
    const blood = c.createLinearGradient(0, barY, 0, barY + barHeight);
    blood.addColorStop(0, '#d66270'); blood.addColorStop(.27, '#b53048');
    blood.addColorStop(.7, '#861832'); blood.addColorStop(1, '#4b0e24');
    c.fillStyle = blood; c.fillRect(barX, barY, barWidth * ratio, barHeight);
    const time = options.reducedMotion || !Number.isFinite(options.time) ? 0 : options.time!;
    bloodMotion(c, barX, barY, barWidth, barHeight, ratio, time);
    c.fillStyle = '#eea0a047'; c.fillRect(barX, barY, barWidth * ratio, .6);
    if (hit > 0) {
      c.save(); c.globalAlpha *= hit * .58;
      c.fillStyle = '#fbd2bb'; c.fillRect(barX, barY, barWidth * ratio, barHeight);
      c.restore();
    }
  }
  // Narrow steel collars seat the garnet channel into the dark brass rail.
  for (const x of [11.5, w - 14]) {
    c.fillStyle = trim.shade; c.fillRect(x, 46, 2.5, 8);
    c.fillStyle = trim.edge; c.fillRect(x, 46, .65, 7);
    c.fillStyle = trim.light; c.fillRect(x, 45.5, 2.5, .6);
  }
  for (const side of [-1, 1]) {
    c.save(); c.translate(side < 0 ? 7 : w - 7, 49); c.scale(side, 1);
    c.strokeStyle = trim.edge; c.lineWidth = .8;
    c.beginPath(); c.moveTo(-3, -3); c.lineTo(2, -8); c.lineTo(6, -8); c.moveTo(-3, 3); c.lineTo(2, 8); c.lineTo(6, 8); c.stroke();
    c.fillStyle = trim.gem; c.fillRect(-1, -1, 2, 2); c.restore();
  }
  c.save(); c.shadowColor = '#010409'; c.shadowBlur = 2;
  const healthLabel = `${compact(hp)} / ${compact(maxHp)}`;
  text(c, `Lv ${compact(enemy.level)}`, 11, 61, .78, UI.muted);
  text(c, healthLabel, w / 2, 61, Math.min(.8, (w - 114) / Math.max(1, textWidth(healthLabel))), UI.text, 'center');
  text(c, enemy.kind==='warden'?'BOSS':rank.name, w - 11, 61, .78, rank.color, 'right');
  c.restore(); c.restore();
}
