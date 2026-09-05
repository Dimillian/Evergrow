import type { Enemy } from './model.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { ENEMY_RANKS } from './progression-content.ts';
import { UI_THEME } from './ui-theme.ts';
import { text, textWidth } from './font.ts';
import { getHUDLayout } from './hud.ts';
import { getMinimapRect } from './map-view.ts';

export interface EnemyPlateOptions {
  opacity?: number;
  /** Delayed resource value in hit points, not a normalized ratio. */
  healthTrail?: number;
  hitPulse?: number;
}

const UI = UI_THEME.palette;
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const compact = (value: number) => value >= 10_000 ? compactNumber.format(value) : `${Math.ceil(value)}`;

/** A centered target readout that shares the existing navigation and map space. */
export function getEnemyPlateLayout(width: number, height: number): { x: number; y: number; width: number; height: number } {
  width = Math.max(0, Number.isFinite(width) ? width : 0);
  height = Math.max(0, Number.isFinite(height) ? height : 0);
  const map = getMinimapRect(width, height);
  const besideMap = 2 * (map.x - 12 - width / 2);
  const belowMap = besideMap < 180;
  const plateWidth = Math.max(0, Math.min(270, width - 32, belowMap ? Infinity : besideMap));
  const y = belowMap ? map.y + map.height + 8 : width < 720 ? 60 : 16;
  const bottom = Math.min(height - 8, getHUDLayout(width, height).y - 8);
  // The actual game uses at least 450 logical pixels of height. If embedded in a
  // smaller surface, omit the plate when neither the map nor the HUD can move.
  const fits = plateWidth >= 180 && y + 46 <= bottom;
  return { x: (width - plateWidth) / 2, y: Math.min(y, height), width: plateWidth, height: fits ? 46 : 0 };
}

function chamfer(c: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, cut: number) {
  c.beginPath(); c.moveTo(x + cut, y); c.lineTo(x + width - cut, y);
  c.lineTo(x + width, y + cut); c.lineTo(x + width, y + height - cut);
  c.lineTo(x + width - cut, y + height); c.lineTo(x + cut, y + height);
  c.lineTo(x, y + height - cut); c.lineTo(x, y + cut); c.closePath();
}

/** Native text and restrained metalwork, drawn after world post-processing. */
export function drawEnemyPlate(c: CanvasRenderingContext2D, enemy: Pick<Enemy, 'kind' | 'hp' | 'maxHp' | 'level' | 'rank'>,
  width: number, height: number, options: EnemyPlateOptions = {}): void {
  const layout = getEnemyPlateLayout(width, height);
  const opacity = clamp(options.opacity ?? 1);
  if (!layout.height || opacity <= 0) return;
  const w = layout.width;
  const maxHp = Math.max(0, Number.isFinite(enemy.maxHp) ? enemy.maxHp : 0);
  const hp = Math.max(0, Math.min(maxHp, Number.isFinite(enemy.hp) ? enemy.hp : 0));
  const ratio = hp / Math.max(1, maxHp);
  const trail = Math.max(ratio, clamp((options.healthTrail ?? hp) / Math.max(1, maxHp)));
  const hit = clamp(options.hitPulse ?? 0);
  const rank = ENEMY_RANKS[enemy.rank];
  c.save(); c.translate(layout.x, layout.y); c.globalAlpha *= opacity;

  // An elliptical shadow provides legibility without another rectangular panel.
  c.save(); c.translate(w / 2, 21); c.scale(w / 2, 21);
  const shadow = c.createRadialGradient(0, 0, .05, 0, 0, 1);
  shadow.addColorStop(0, '#02050ab8'); shadow.addColorStop(.55, '#02050a78'); shadow.addColorStop(1, '#02050a00');
  c.fillStyle = shadow; c.fillRect(-1, -1, 2, 2); c.restore();

  c.save(); c.shadowColor = '#010409'; c.shadowBlur = 3; c.shadowOffsetY = 1;
  text(c, ENEMY_DEFINITIONS[enemy.kind].name, w / 2, 2, 1.13, enemy.rank === 'normal' ? UI.ivory : rank.color, 'center'); c.restore();
  const metal = c.createLinearGradient(0, 20, 0, 31);
  metal.addColorStop(0, '#746d59'); metal.addColorStop(.15, '#353a38');
  metal.addColorStop(.48, UI.panel); metal.addColorStop(1, UI.ink);
  chamfer(c, 10, 20, w - 20, 11, 3);
  c.fillStyle = metal; c.fill(); c.strokeStyle = UI.brassDim; c.lineWidth = .7; c.stroke();
  c.beginPath(); c.moveTo(15, 20.7); c.lineTo(w - 15, 20.7);
  c.strokeStyle = '#b39b6c70'; c.lineWidth = .65; c.stroke();

  const barX = 15, barY = 23, barWidth = w - 30, barHeight = 5;
  c.fillStyle = '#070c12'; c.fillRect(barX, barY, barWidth, barHeight);
  if (trail > ratio) {
    c.fillStyle = '#bb866a9c'; c.fillRect(barX, barY, barWidth * trail, barHeight);
  }
  if (ratio > 0) {
    const blood = c.createLinearGradient(0, barY, 0, barY + barHeight);
    blood.addColorStop(0, '#d66270'); blood.addColorStop(.27, '#b53048');
    blood.addColorStop(.7, '#861832'); blood.addColorStop(1, '#4b0e24');
    c.fillStyle = blood; c.fillRect(barX, barY, barWidth * ratio, barHeight);
    c.fillStyle = '#eea0a047'; c.fillRect(barX, barY, barWidth * ratio, .6);
    if (hit > 0) {
      c.save(); c.globalAlpha *= hit * .58;
      c.fillStyle = '#fbd2bb'; c.fillRect(barX, barY, barWidth * ratio, barHeight);
      c.restore();
    }
  }
  // Narrow steel collars seat the garnet channel into the dark brass rail.
  for (const x of [11.5, w - 14]) {
    c.fillStyle = '#141c22'; c.fillRect(x, 23, 2.5, 5);
    c.fillStyle = '#968265'; c.fillRect(x, 23, .65, 4);
    c.fillStyle = '#d0b88a70'; c.fillRect(x, 22.5, 2.5, .6);
  }
  c.save(); c.shadowColor = '#010409'; c.shadowBlur = 2;
  const healthLabel = `${compact(hp)} / ${compact(maxHp)}`;
  text(c, `Lv ${compact(enemy.level)}`, 11, 36, .78, UI.muted);
  text(c, healthLabel, w / 2, 36, Math.min(.8, (w - 114) / Math.max(1, textWidth(healthLabel))), UI.text, 'center');
  text(c, rank.name, w - 11, 36, .78, rank.color, 'right');
  c.restore(); c.restore();
}
