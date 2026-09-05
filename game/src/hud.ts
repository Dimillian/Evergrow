import type { Player } from './model.ts';
import { PLAYER_ABILITIES } from './combat-content.ts';
import { UI_THEME } from './ui-theme.ts';
import { text, textWidth } from './font.ts';
import { drawHUDSkillIcon, drawHUDMenuIcon } from './hud-icons.ts';
import { drawHUDOrb } from './hud-orb.ts';
import { drawHUDFrame } from './hud-frame.ts';
import { HUD_ART, HUD_MENU_SHORTCUTS, getHUDLayout } from './hud-layout.ts';

// Preserve the public entrypoint for the shell and existing UI consumers.
export { HUD_MENU_SHORTCUTS, getHUDLayout, isHUDPoint } from './hud-layout.ts';
export type { HUDRect, HUDShortcut, HUDLayout } from './hud-layout.ts';

export interface HUDOptions { reducedMotion?: boolean; healthTrail?: number; hitPulse?: number; }

const UI = UI_THEME.palette;
const TAU = Math.PI * 2;
const clamp = (n: number) => Math.max(0, Math.min(1, n));

function polygon(c: CanvasRenderingContext2D, points: readonly number[]) {
  c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
}

function chamfer(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cut = 3) {
  polygon(c, [x + cut, y, x + w - cut, y, x + w, y + cut, x + w, y + h - cut,
    x + w - cut, y + h, x + cut, y + h, x, y + h - cut, x, y + cut]);
}

function skills(c: CanvasRenderingContext2D, p: Player, time: number) {
  const definitions = [
    { key: 'LMB', cooldown: 0, duration: 1, enabled: !p.dead, active: !!p.attack, color: '#c4ad7a', charges: -1 },
    { key: 'RMB', cooldown: p.castCooldown, duration: PLAYER_ABILITIES.ember.cooldown, enabled: p.mana >= PLAYER_ABILITIES.ember.manaCost && !p.dead, active: p.castTime > 0, color: '#df925e', charges: -1 },
    { key: 'SPACE', cooldown: p.dodgeCharges > 0 ? 0 : Math.max(0, PLAYER_ABILITIES.dodge.recharge - p.dodgeRecharge), duration: PLAYER_ABILITIES.dodge.recharge, enabled: p.dodgeCharges > 0 && !p.dead, active: p.dodgeTime > 0, color: '#89b5b2', charges: p.dodgeCharges },
    { key: 'Q', cooldown: p.healCooldown, duration: PLAYER_ABILITIES.heal.cooldown, enabled: p.flasks > 0 && p.hp < p.maxHp && !p.dead, active: p.healFlash > 0, color: '#9fb47b', charges: p.flasks },
  ];
  definitions.forEach((slot, i) => {
    const field = HUD_ART.skill;
    const x = field.x + i * field.step, y = field.y, w = field.width, h = field.height;
    c.save();
    chamfer(c, x, y, w, h, 4);
    const well = c.createLinearGradient(x, y, x, y + h);
    well.addColorStop(0, UI.steel); well.addColorStop(1, UI.steelDeep);
    c.fillStyle = well; c.fill();
    c.strokeStyle = slot.active ? slot.color : UI.silverDim; c.lineWidth = .8; c.stroke();
    c.strokeStyle = slot.active ? UI.silver : UI.silver + '60';
    c.beginPath(); c.moveTo(x + 5, y + 1.5); c.lineTo(x + w - 5, y + 1.5); c.stroke();
    {
      const glow = c.createRadialGradient(x + w / 2, y + 23, 0, x + w / 2, y + 23, 25);
      glow.addColorStop(0, slot.color + (slot.active ? '35' : '15')); glow.addColorStop(1, slot.color + '00');
      c.fillStyle = glow; c.fillRect(x + 2, y + 2, w - 4, 38);
    }
    c.globalAlpha = slot.enabled ? 1 : .48;
    c.save(); c.translate(x + w / 2, y + 22); c.scale(1.24, 1.24);
    drawHUDSkillIcon(c, i, 0, 0, time, slot.active); c.restore();
    c.globalAlpha = 1;
    if (slot.cooldown > 0) {
      c.save(); c.beginPath(); c.rect(x + 1, y + 1, w - 2, 39); c.clip();
      c.fillStyle = '#030a10b8';
      c.beginPath(); c.moveTo(x + w / 2, y + 22);
      c.arc(x + w / 2, y + 22, 43, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(slot.cooldown / slot.duration));
      c.closePath(); c.fill(); c.restore();
      text(c, (Math.ceil(slot.cooldown * 10) / 10).toFixed(1), x + w / 2, y + 18, 1.2, UI.ivory, 'center');
    }
    // Bindings stay beneath the enamel, clear of recovery wedges and charges.
    c.strokeStyle = '#b6baa226'; c.lineWidth = .6;
    c.beginPath(); c.moveTo(x + 9, y + 40); c.lineTo(x + w - 9, y + 40); c.stroke();
    text(c, slot.key, x + w / 2, y + 44, 1.04, slot.enabled ? UI.text : UI.faint, 'center');
    if (slot.charges >= 0) {
      for (let charge = 0; charge < (i === 2 ? PLAYER_ABILITIES.dodge.charges : PLAYER_ABILITIES.heal.charges); charge++) {
        c.beginPath(); c.arc(x + w - 14 + charge * 6, y + 6, 1.4, 0, TAU);
        c.fillStyle = charge < slot.charges ? slot.color : '#080e13'; c.fill();
        c.strokeStyle = charge < slot.charges ? '#ddd4ad88' : '#535c50'; c.lineWidth = .5; c.stroke();
      }
      if (i === 2 && p.dodgeCharges < PLAYER_ABILITIES.dodge.charges) {
        c.fillStyle = '#111c21'; c.fillRect(x + 4, y + h - 1.5, w - 8, 1);
        c.fillStyle = '#83aaa5'; c.fillRect(x + 4, y + h - 1.5, (w - 8) * clamp(p.dodgeRecharge / PLAYER_ABILITIES.dodge.recharge), 1);
      }
    }
    if (slot.active) {
      c.fillStyle = slot.color; c.fillRect(x + 10, y + h - 1, w - 20, .8);
    }
    c.restore();
  });
}

function shortcuts(c: CanvasRenderingContext2D) {
  const menu = HUD_ART.menu;
  for (let i = 0; i < HUD_MENU_SHORTCUTS.length; i++) {
    const x = menu.x + i * menu.step;
    c.fillStyle = '#080e11d9'; c.fillRect(x, menu.y, menu.width, menu.height);
    c.strokeStyle = UI.silverDim + '70'; c.lineWidth = .65;
    c.beginPath(); c.moveTo(x + 4, menu.y + 21.5); c.lineTo(x + 30, menu.y + 21.5); c.stroke();
    drawHUDMenuIcon(c, i, x + 11, menu.y + 10);
    text(c, HUD_MENU_SHORTCUTS[i].key, x + 26, menu.y + 6.5, 1, UI.muted, 'center');
  }
}

function readout(c: CanvasRenderingContext2D, x: number, current: number, max: number, mana: boolean) {
  polygon(c, [x - 34, 120, x + 34, 120, x + 29, 142, x - 29, 142]);
  c.fillStyle = '#070d11ed'; c.fill(); c.strokeStyle = UI.silverDim; c.lineWidth = .7; c.stroke();
  const value = `${current} / ${max}`;
  // Reserve the same clear opening when future gear raises resource capacities.
  const size = Math.min(1.13, 58 / Math.max(1, textWidth(value)));
  text(c, value, x, 131 - size * 3.85, size, mana ? '#b9cee0' : '#dfb9af', 'center');
}

/** Drawn at native display density above the world shader. */
export function drawFloatingHUD(c: CanvasRenderingContext2D, p: Player, width: number, height: number, time: number, options: HUDOptions = {}) {
  const layout = getHUDLayout(width, height);
  if (!layout.scale) return;
  const t = options.reducedMotion ? 0 : time;
  c.save(); c.translate(layout.x, layout.y); c.scale(layout.scale, layout.scale);
  drawHUDFrame(c, t);
  const orb = HUD_ART.orb;
  for (const mana of [false, true]) {
    c.save(); c.translate(mana ? orb.right : orb.left, orb.y); c.scale(orb.scale, orb.scale);
    drawHUDOrb(c, 0, 0, mana ? p.mana / Math.max(1, p.maxMana) : p.hp / Math.max(1, p.maxHp),
      t + (mana && !options.reducedMotion ? 7 : 0), mana, mana ? undefined : options.healthTrail,
      mana ? 0 : (options.hitPulse ?? 0) * (options.reducedMotion ? .4 : 1));
    c.restore();
  }
  skills(c, p, t);
  shortcuts(c);
  readout(c, orb.left, Math.ceil(Math.max(0, p.hp)), p.maxHp, false);
  readout(c, orb.right, Math.floor(Math.max(0, p.mana)), p.maxMana, true);
  c.restore();
}
