import { PAD_SKILL_LABELS } from './gamepad-input.ts';
import { drawActiveSkillIcon } from './hud-active-skills.ts';
import { SKILL_DEFINITIONS, canUseSkill, skillCosts } from './skill-content.ts';
import { heldWeapon as drawEquippedWeapon } from './equipment-art.ts';
import type { Player } from './model.ts';
import { PLAYER_ABILITIES } from './combat-content.ts';
import { UI_THEME } from './ui-theme.ts';
import { text, textWidth } from './font.ts';
import { drawHUDSkillIcon, drawHUDMenuIcon } from './hud-icons.ts';
import { drawHUDOrb } from './hud-orb.ts';
import { drawHUDFrame } from './hud-frame.ts';
import { drawHUDExperience, type ExperienceDisplay } from './hud-experience.ts';
import { HUD_ART, HUD_MENU_SHORTCUTS, HUD_SKILL_SLOTS, getHUDLayout } from './hud-layout.ts';

// Preserve the public entrypoint for the shell and existing UI consumers.
export { HUD_MENU_SHORTCUTS, getHUDLayout, isHUDPoint } from './hud-layout.ts';
export type { HUDRect, HUDShortcut, HUDLayout } from './hud-layout.ts';

export interface HUDOptions { gamepad?: boolean; reducedMotion?: boolean; healthTrail?: number; hitPulse?: number; experience?: ExperienceDisplay; }

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

function skills(c: CanvasRenderingContext2D, p: Player, time: number, gamepad = false) {
  const field = HUD_ART.skill;
  for (const [i, slot] of HUD_SKILL_SLOTS.entries()) {
    const x = field.x + i * field.step, y = field.y, w = field.width, h = field.height;
    const skill = i > 0 ? p.character.skillSlots[i - 1] : null;
    const definition = skill ? SKILL_DEFINITIONS[skill] : null;
    const cooldown = skill ? p.skillCooldowns[skill] ?? 0 : 0;
    const occupied = i === 0 || !!skill, active = i === 0 ? !!p.attack : !!skill && p.activeSkill === skill;
    const compatible = !skill || canUseSkill(skill, p.equipment);
    const usable = !p.dead && compatible && cooldown <= 0 && (!definition || p.mana >= skillCosts(definition.id, p.derived).mana);
    c.save();
    chamfer(c, x, y, w, h, 3);
    const well = c.createLinearGradient(x, y, x, y + h);
    well.addColorStop(0, occupied ? UI.steel : '#101a23'); well.addColorStop(1, UI.steelDeep);
    c.fillStyle = well; c.fill();
    c.strokeStyle = active ? '#c4ad7a' : occupied ? UI.silverDim : '#415763'; c.lineWidth = .8; c.stroke();
    c.strokeStyle = occupied ? UI.silver + '60' : '#52697670';
    c.beginPath(); c.moveTo(x + 4, y + 1.5); c.lineTo(x + w - 4, y + 1.5); c.stroke();
    if (occupied) {
      const glow = c.createRadialGradient(x + w / 2, y + 22, 0, x + w / 2, y + 22, 20);
      glow.addColorStop(0, active ? '#d3ba8035' : '#d3ba8015'); glow.addColorStop(1, '#d3ba8000');
      c.fillStyle = glow; c.fillRect(x + 1, y + 2, w - 2, 38);
      c.globalAlpha = usable ? 1 : .42;
      c.save(); c.translate(x + w / 2, y + 22); c.scale(1.08, 1.08);
      if (skill) drawActiveSkillIcon(c, skill);
      else if (p.equipment.mainHand.family === 'unarmed') drawHUDSkillIcon(c, 0, 0, 0, time, active);
      else {
        c.save(); c.scale(.66, .66);
        drawEquippedWeapon(c, [0, 9], -Math.PI / 3, color => color, p.equipment.mainHand.visual);
        c.restore();
      }
      c.restore(); c.globalAlpha = 1;
      if (!compatible) {
        const required = definition!.requirement;
        text(c, required === 'heavy' ? 'HEAVY' : required.toUpperCase(), x + w / 2, y + 32, .7, '#d3a898', 'center');
      } else if (definition && cooldown > 0) {
        c.fillStyle = '#030a10a8'; c.fillRect(x + 2, y + 2, w - 4, 37 * clamp(cooldown / (definition.cooldown * p.derived.cooldownMultiplier)));
        text(c, cooldown.toFixed(1), x + w / 2, y + 18, 1.3, UI.ivory, 'center');
      } else if (definition) text(c, String(skillCosts(definition.id, p.derived).mana), x + w - 5, y + 3, .8, '#91bddd', 'right');
    }
    // An empty well has no icon, lock, cooldown, or resource cost.
    c.strokeStyle = occupied ? '#b6baa226' : '#617b8d25'; c.lineWidth = .6;
    c.beginPath(); c.moveTo(x + 7, y + 40); c.lineTo(x + w - 7, y + 40); c.stroke();
    text(c, gamepad ? PAD_SKILL_LABELS[i] : slot.key, x + w / 2, y + 44, 1.04,
      occupied && !p.dead ? UI.text : '#718490', 'center');
    if (active) {
      c.fillStyle = '#c4ad7a'; c.fillRect(x + 8, y + h - 1, w - 16, .8);
    }
    c.restore();
  }
}

function utilities(c: CanvasRenderingContext2D, p: Player, time: number, gamepad = false) {
  const field = HUD_ART.utility, dodge = PLAYER_ABILITIES.dodge, potion = PLAYER_ABILITIES.potion;
  const slots = [
    { x: field.left, key: 'Q', icon: 3, charges: p.flasks, capacity: potion.charges,
      cooldown: p.healCooldown, duration: potion.cooldown, active: p.healFlash > 0,
      enabled: p.flasks > 0 && (p.hp < p.maxHp || p.mana < p.maxMana) && !p.dead, color: '#b7a6d4' },
    { x: field.right, key: 'SPACE', icon: 2, charges: p.dodgeCharges, capacity: dodge.charges,
      cooldown: p.dodgeCharges > 0 ? 0 : Math.max(0, dodge.recharge - p.dodgeRecharge), duration: dodge.recharge,
      active: p.dodgeTime > 0, enabled: p.dodgeCharges > 0 && !p.dead, color: '#7fb6b1' },
  ];
  for (const slot of slots) {
    const { x } = slot, y = field.y, w = field.width, h = field.height;
    c.save();
    if (slot.active) {
      chamfer(c, x + 1, y + 1, w - 2, h - 2, 2);
      c.fillStyle = slot.color + '18'; c.fill();
      c.strokeStyle = slot.color + '90'; c.lineWidth = .55; c.stroke();
    }
    c.globalAlpha = slot.enabled ? 1 : .48;
    c.save(); c.translate(x + 10, y + 11); c.scale(.7, .7);
    drawHUDSkillIcon(c, slot.icon, 0, 0, time, slot.active); c.restore(); c.globalAlpha = 1;
    if (slot.cooldown > 0) {
      c.save(); c.beginPath(); c.rect(x + 1, y + 1, 19, h - 2); c.clip();
      c.fillStyle = '#030a10c8'; c.beginPath(); c.moveTo(x + 10, y + 11);
      c.arc(x + 10, y + 11, 20, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(slot.cooldown / slot.duration));
      c.closePath(); c.fill(); c.restore();
      text(c, (Math.ceil(slot.cooldown * 10) / 10).toFixed(1), x + 10, y + 8, .8, UI.ivory, 'center');
    }
    c.strokeStyle = '#40566580'; c.lineWidth = .6;
    c.beginPath(); c.moveTo(x + 20, y + 6); c.lineTo(x + 20, y + h - 5); c.stroke();
    text(c, gamepad ? (slot.icon === 2 ? 'B' : 'LB') : slot.key, x + 31, y + 9, slot.key === 'SPACE' ? .73 : .95,
      slot.enabled ? UI.text : UI.faint, 'center', 'interface');
    for (let charge = 0; charge < slot.capacity; charge++) {
      c.beginPath(); c.arc(x + 28.5 + charge * 5, y + 4, .9, 0, TAU);
      c.fillStyle = charge < slot.charges ? slot.color : '#080e13'; c.fill();
      c.strokeStyle = UI.silverDim; c.lineWidth = .5; c.stroke();
    }
    if (slot.icon === 2 && p.dodgeCharges < dodge.charges) {
      c.fillStyle = '#14232c'; c.fillRect(x + 6, y + h - 3, w - 12, 1);
      c.fillStyle = slot.color; c.fillRect(x + 6, y + h - 3, (w - 12) * clamp(p.dodgeRecharge / dodge.recharge), 1);
    }
    c.restore();
  }
}

function shortcuts(c: CanvasRenderingContext2D, p: Player, gamepad = false) {
  const menu = HUD_ART.menu;
  for (let i = 0; i < HUD_MENU_SHORTCUTS.length; i++) {
    const x = menu.x + i * menu.step;
    const enabled = i < 3;
    const points = i === 0 ? p.character.statPoints : i === 2 ? p.character.skillPoints : 0;
    const accent = i === 0 ? '#edbd79' : '#c9a5f3';
    // Navigation is an engraving in the shelf, not a row of competing skill buttons.
    if (points > 0) {
      const tint = c.createLinearGradient(x, menu.y, x, menu.y + menu.height);
      tint.addColorStop(0, accent + '16'); tint.addColorStop(1, accent + '00');
      c.fillStyle = tint; c.fillRect(x, menu.y, menu.width, menu.height);
    }
    if (i > 0) {
      c.strokeStyle = '#758c952b'; c.lineWidth = .5;
      c.beginPath(); c.moveTo(x - 1, menu.y + 5); c.lineTo(x - 1, menu.y + menu.height - 5); c.stroke();
    }
    drawHUDMenuIcon(c, i, x + 10, menu.y + 10);
    text(c, gamepad ? ['←', '→', '↑', ''][i] : HUD_MENU_SHORTCUTS[i].key, x + 26, menu.y + 6, 1.0,
      enabled ? '#a0b2b7' : '#4e626c', 'center', 'interface');
    if (points > 0) {
      // Persistent numbered seals: amber attributes, violet skills. Hide as soon as spent.
      const count = points > 99 ? '99+' : String(points);
      const badgeWidth = Math.max(16, textWidth(count, 1.3, 'interface') + 8);
      const bx = x + menu.width - badgeWidth + 1, by = menu.y - menu.badgeRise;
      c.save(); c.shadowColor = accent; c.shadowBlur = 5;
      c.fillStyle = accent; c.beginPath(); c.roundRect(bx, by, badgeWidth, 15, 3); c.fill();
      c.shadowBlur = 0; c.strokeStyle = '#0a1119'; c.lineWidth = 1; c.stroke();
      text(c, count, bx + badgeWidth / 2, by + 2, 1.3, '#15121d', 'center', 'interface');
      c.restore();
      c.fillStyle = accent; c.fillRect(x + 3, menu.y + menu.height - 2, menu.width - 6, 1);
    }
  }
}

function readout(c: CanvasRenderingContext2D, x: number, current: number, max: number, mana: boolean) {
  const value = `${current} / ${max}`;
  // Reserve the same clear opening when future gear raises resource capacities.
  const size = Math.min(1.13, 58 / Math.max(1, textWidth(value)));
  text(c, value, x, 131 - size * 3.85, size, mana ? '#b9cee0' : '#dfb9af', 'center');
}

/** Shared live contents for the runtime and static art review. Coordinates match HUD_ART. */
export function drawHUDContents(c: CanvasRenderingContext2D, p: Player, time: number, options: HUDOptions = {}) {
  const t = options.reducedMotion ? 0 : time;
  const orb = HUD_ART.orb;
  for (const mana of [false, true]) {
    c.save(); c.translate(mana ? orb.right : orb.left, orb.y); c.scale(orb.scale, orb.scale);
    drawHUDOrb(c, 0, 0, mana ? p.mana / Math.max(1, p.maxMana) : p.hp / Math.max(1, p.maxHp),
      t + (mana && !options.reducedMotion ? 7 : 0), mana, mana ? undefined : options.healthTrail,
      mana ? 0 : (options.hitPulse ?? 0) * (options.reducedMotion ? .4 : 1));
    c.restore();
  }
  skills(c, p, t, options.gamepad);
  utilities(c, p, t, options.gamepad);
  shortcuts(c, p, options.gamepad);
  readout(c, orb.left, Math.ceil(Math.max(0, p.hp)), p.maxHp, false);
  readout(c, orb.right, Math.floor(Math.max(0, p.mana)), p.maxMana, true);
  drawHUDExperience(c, p, t, options.experience);
}

/** Drawn at native display density above the world shader. */
export function drawFloatingHUD(c: CanvasRenderingContext2D, p: Player, width: number, height: number, time: number, options: HUDOptions = {}) {
  const layout = getHUDLayout(width, height);
  if (!layout.scale) return;
  c.save(); c.translate(layout.x, layout.y); c.scale(layout.scale, layout.scale);
  drawHUDFrame(c, options.reducedMotion ? 0 : time);
  drawHUDContents(c, p, time, options);
  c.restore();
}
