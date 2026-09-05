import type { Player } from './model.ts';
import { text, textWidth } from './font.ts';
import { drawHUDSkillIcon, drawHUDMenuIcon } from './hud-icons.ts';
import { drawHUDOrb } from './hud-orb.ts';

export const HUD_MENU_SHORTCUTS = [
  { id: 'character', label: 'Character', key: 'C' },
  { id: 'inventory', label: 'Inventory', key: 'I' },
  { id: 'skilltree', label: 'Skill tree', key: 'T' },
  { id: 'journal', label: 'Journal', key: 'J' },
] as const;

export interface HUDRect { x: number; y: number; width: number; height: number; }
export interface HUDShortcut extends HUDRect { id: string; label: string; key: string; }
export interface HUDLayout extends HUDRect {
  scale: number;
  shortcuts: HUDShortcut[];
}
export interface HUDOptions { reducedMotion?: boolean; healthTrail?: number; hitPulse?: number; }

const BASE_WIDTH = 388;
const BASE_HEIGHT = 90;
const MENU_X = 124, MENU_STEP = 37, MENU_Y = 3, MENU_WIDTH = 29, MENU_HEIGHT = 18;
const SKILL_X = 96, SKILL_STEP = 51, SKILL_Y = 31, SKILL_WIDTH = 43, SKILL_HEIGHT = 45;
const TAU = Math.PI * 2;
const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Canvas art, pointer blocking and native menu controls share this geometry. */
export function getHUDLayout(width: number, height: number): HUDLayout {
  const scale = Math.max(0, Math.min(1, (width - 20) / BASE_WIDTH, (height - 28) / BASE_HEIGHT));
  const hudWidth = BASE_WIDTH * scale, hudHeight = BASE_HEIGHT * scale;
  const x = (width - hudWidth) / 2, y = height - hudHeight - 14;
  return {
    x, y, width: hudWidth, height: hudHeight, scale,
    shortcuts: HUD_MENU_SHORTCUTS.map((shortcut, i) => ({ ...shortcut,
      x: x + (MENU_X + i * MENU_STEP) * scale, y: y + MENU_Y * scale,
      width: MENU_WIDTH * scale, height: MENU_HEIGHT * scale,
    })),
  };
}

/** Open space around the compact silhouette still belongs to the world. */
export function isHUDPoint(x: number, y: number, width: number, height: number): boolean {
  const h = getHUDLayout(width, height);
  if (h.scale <= 0 || x < h.x || x > h.x + h.width || y < h.y || y > h.y + h.height) return false;
  const lx = (x - h.x) / h.scale, ly = (y - h.y) / h.scale;
  if (lx >= 118 && lx <= 270 && ly <= 25) return true;
  if (lx >= 76 && lx <= 312 && ly >= 27 && ly <= 82) return true;
  if (lx >= 68 && lx <= 320 && ly >= 43 && ly <= 62) return true;
  return [40, 348].some(cx => Math.hypot(lx - cx, ly - 43) <= 32
    || (Math.abs(lx - cx) <= 30 && ly >= 74 && ly <= 89));
}

function polygon(c: CanvasRenderingContext2D, points: readonly number[]) {
  c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
}

function chamfer(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cut = 3) {
  polygon(c, [x + cut, y, x + w - cut, y, x + w, y + cut, x + w, y + h - cut,
    x + w - cut, y + h, x + cut, y + h, x, y + h - cut, x, y + cut]);
}

function chassis(c: CanvasRenderingContext2D) {
  c.save();
  // Short joints make the glass sockets and action tray one piece of metalwork.
  for (const [left, right] of [[65, 92], [296, 323]]) {
    const joint = c.createLinearGradient(0, 43, 0, 62);
    joint.addColorStop(0, '#574d3b'); joint.addColorStop(.15, '#24292a');
    joint.addColorStop(.7, '#12181b'); joint.addColorStop(1, '#070b0e');
    c.fillStyle = joint; c.fillRect(left, 43, right - left, 19);
    c.strokeStyle = '#716047'; c.lineWidth = .7;
    c.beginPath(); c.moveTo(left, 44); c.lineTo(right, 44); c.stroke();
    c.strokeStyle = '#302f29'; c.beginPath(); c.moveTo(left, 60); c.lineTo(right, 60); c.stroke();
  }
  c.shadowColor = '#010408b3'; c.shadowBlur = 9; c.shadowOffsetY = 4;
  chamfer(c, 76, 27, 236, 55, 10);
  const metal = c.createLinearGradient(0, 27, 0, 82);
  metal.addColorStop(0, '#45463d'); metal.addColorStop(.06, '#232a2b');
  metal.addColorStop(.55, '#12191d'); metal.addColorStop(1, '#0b1013');
  c.fillStyle = metal; c.fill();
  c.shadowBlur = 0; c.shadowOffsetY = 0;
  c.strokeStyle = '#65573f'; c.lineWidth = 1; c.stroke();
  c.strokeStyle = '#b09a6c99'; c.lineWidth = .7;
  c.beginPath(); c.moveTo(88, 28.5); c.lineTo(300, 28.5); c.stroke();
  c.strokeStyle = '#383e38';
  c.beginPath(); c.moveTo(87, 79.5); c.lineTo(301, 79.5); c.stroke();
  // Recessed pins and short engravings replace the broad ornamental wings.
  for (const x of [83, 305]) {
    c.fillStyle = '#080d10'; c.beginPath(); c.arc(x, 54, 1.8, 0, TAU); c.fill();
    c.fillStyle = '#85765b'; c.fillRect(x - .6, 53, 1.2, 1.2);
    c.strokeStyle = '#49493b'; c.lineWidth = .6;
    for (const y of [39, 42, 66, 69]) {
      c.beginPath(); c.moveTo(x - 1, y); c.lineTo(x + 1, y - 1); c.stroke();
    }
  }
  // All four secondary shortcuts live on a single quiet, narrow rail.
  chamfer(c, 118, 0, 152, 25, 5);
  const ridge = c.createLinearGradient(0, 0, 0, 25);
  ridge.addColorStop(0, '#252d2d'); ridge.addColorStop(.14, '#151e22'); ridge.addColorStop(1, '#0b1115');
  c.fillStyle = ridge; c.fill(); c.strokeStyle = '#41463d'; c.lineWidth = .8; c.stroke();
  c.strokeStyle = '#91826488'; c.beginPath(); c.moveTo(124, 1); c.lineTo(264, 1); c.stroke();
  c.fillStyle = '#84704c'; c.fillRect(189, 24, 10, 2);
  c.fillStyle = '#c2ad78'; c.fillRect(192, 24, 4, .8);
  c.restore();
}

function skills(c: CanvasRenderingContext2D, p: Player, time: number) {
  const definitions = [
    { key: 'LMB', cooldown: 0, duration: 1, enabled: !p.dead, active: !!p.attack, color: '#c4ad7a', charges: -1 },
    { key: 'RMB', cooldown: p.castCooldown, duration: .45, enabled: p.mana >= 20 && !p.dead, active: p.castTime > 0, color: '#df925e', charges: -1 },
    { key: 'SPACE', cooldown: p.dodgeCharges > 0 ? 0 : Math.max(0, 1.8 - p.dodgeRecharge), duration: 1.8, enabled: p.dodgeCharges > 0 && !p.dead, active: p.dodgeTime > 0, color: '#89b5b2', charges: p.dodgeCharges },
    { key: 'Q', cooldown: p.healCooldown, duration: .8, enabled: p.flasks > 0 && p.hp < p.maxHp && !p.dead, active: p.healFlash > 0, color: '#9fb47b', charges: p.flasks },
  ];
  definitions.forEach((slot, i) => {
    const x = SKILL_X + i * SKILL_STEP, y = SKILL_Y, w = SKILL_WIDTH, h = SKILL_HEIGHT;
    c.save();
    chamfer(c, x, y, w, h, 2);
    const well = c.createLinearGradient(x, y, x, y + h);
    well.addColorStop(0, '#1c272d'); well.addColorStop(.18, '#111c23'); well.addColorStop(1, '#080e13');
    c.fillStyle = well; c.fill();
    c.strokeStyle = slot.active ? slot.color : '#474b41'; c.lineWidth = .8; c.stroke();
    c.strokeStyle = slot.active ? '#ebd3a4' : '#8a806366';
    c.beginPath(); c.moveTo(x + 3, y + 1); c.lineTo(x + w - 3, y + 1); c.stroke();
    if (slot.active) {
      const glow = c.createRadialGradient(x + w / 2, y + 17, 1, x + w / 2, y + 17, 19);
      glow.addColorStop(0, slot.color + '35'); glow.addColorStop(1, slot.color + '00');
      c.fillStyle = glow; c.fillRect(x + 2, y + 2, w - 4, 31);
    }
    c.globalAlpha = slot.enabled ? 1 : .48;
    drawHUDSkillIcon(c, i, x + w / 2, y + 16, time, slot.active);
    c.globalAlpha = 1;
    if (slot.cooldown > 0) {
      c.save(); c.beginPath(); c.rect(x + 1, y + 1, w - 2, 31); c.clip();
      c.fillStyle = '#030a10b8';
      c.beginPath(); c.moveTo(x + w / 2, y + 17);
      c.arc(x + w / 2, y + 17, 30, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(slot.cooldown / slot.duration));
      c.closePath(); c.fill(); c.restore();
      text(c, (Math.ceil(slot.cooldown * 10) / 10).toFixed(1), x + w / 2, y + 15, .95, '#e5dac1', 'center');
    }
    // Equal-size recessed keycaps keep the binding subordinate to its icon.
    c.fillStyle = '#080d12'; c.fillRect(x + 4, y + 33, w - 8, 10);
    c.strokeStyle = '#2d373688'; c.lineWidth = .6;
    c.beginPath(); c.moveTo(x + 6, y + 32.5); c.lineTo(x + w - 6, y + 32.5); c.stroke();
    text(c, slot.key, x + w / 2, y + 35, .82, slot.enabled ? '#bfc3b4' : '#717a76', 'center');
    if (slot.charges >= 0) {
      for (let charge = 0; charge < 2; charge++) {
        c.beginPath(); c.arc(x + w - 11 + charge * 5, y + 6, 1.2, 0, TAU);
        c.fillStyle = charge < slot.charges ? slot.color : '#080e13'; c.fill();
        c.strokeStyle = charge < slot.charges ? '#ddd4ad88' : '#535c50'; c.lineWidth = .5; c.stroke();
      }
      if (i === 2 && p.dodgeCharges < 2) {
        c.fillStyle = '#111c21'; c.fillRect(x + 4, y + h - 1.5, w - 8, 1);
        c.fillStyle = '#83aaa5'; c.fillRect(x + 4, y + h - 1.5, (w - 8) * clamp(p.dodgeRecharge / 1.8), 1);
      }
    }
    if (slot.active) {
      c.fillStyle = slot.color; c.fillRect(x + 10, y + h - 1, w - 20, .8);
    }
    c.restore();
  });
}

function shortcuts(c: CanvasRenderingContext2D) {
  for (let i = 0; i < HUD_MENU_SHORTCUTS.length; i++) {
    const x = MENU_X + i * MENU_STEP;
    drawHUDMenuIcon(c, i, x + 7, MENU_Y + 8.5);
    text(c, HUD_MENU_SHORTCUTS[i].key, x + 23, MENU_Y + 5.5, .84, '#8e978b', 'center');
    if (i < HUD_MENU_SHORTCUTS.length - 1) {
      c.strokeStyle = '#43493a88'; c.lineWidth = .6;
      c.beginPath(); c.moveTo(x + 33, 7); c.lineTo(x + 33, 17); c.stroke();
    }
  }
}

function readout(c: CanvasRenderingContext2D, x: number, current: number, max: number, mana: boolean) {
  polygon(c, [x - 29, 75, x + 29, 75, x + 26, 88, x - 26, 88]);
  c.fillStyle = '#0b1217f2'; c.fill(); c.strokeStyle = '#484638'; c.lineWidth = .7; c.stroke();
  c.strokeStyle = '#92805a80'; c.beginPath(); c.moveTo(x - 20, 75.5); c.lineTo(x + 20, 75.5); c.stroke();
  const value = String(current), capacity = ` / ${max}`;
  const left = x - (textWidth(value, 1.02) + textWidth(capacity, .8)) / 2;
  text(c, value, left, 78, 1.02, mana ? '#b7d3e3' : '#e3b8ae');
  text(c, capacity, left + textWidth(value, 1.02), 79.5, .8, '#85918d');
}

/** Drawn at native display density above the world shader. */
export function drawFloatingHUD(c: CanvasRenderingContext2D, p: Player, width: number, height: number, time: number, options: HUDOptions = {}) {
  const layout = getHUDLayout(width, height);
  if (!layout.scale) return;
  const t = options.reducedMotion ? 0 : time;
  c.save(); c.translate(layout.x, layout.y); c.scale(layout.scale, layout.scale);
  chassis(c);
  drawHUDOrb(c, 40, 43, p.hp / Math.max(1, p.maxHp), t, false, options.healthTrail,
    (options.hitPulse ?? 0) * (options.reducedMotion ? .4 : 1));
  drawHUDOrb(c, 348, 43, p.mana / Math.max(1, p.maxMana), t + (options.reducedMotion ? 0 : 7), true);
  skills(c, p, t);
  shortcuts(c);
  readout(c, 40, Math.ceil(Math.max(0, p.hp)), p.maxHp, false);
  readout(c, 348, Math.floor(Math.max(0, p.mana)), p.maxMana, true);
  c.restore();
}
