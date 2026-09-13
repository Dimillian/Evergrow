import { lungeReturn } from './unique-combat.ts';
import { skillSustain } from './skill-sustain.ts';
import { basicAttackWeapon } from './equipment.ts';
import { basicAttackManaCost } from './equipment.ts';
import { resolveSkill } from './skill-progression.ts';
import { PAD_SKILL_LABELS } from './gamepad-input.ts';
import { drawSkillIcon } from './skill-icon-canvas.ts';
import { SKILL_DEFINITIONS, canUseSkill } from './skill-content.ts';
import { drawHUDWeapon } from './hud-weapon-icon.ts';
import { drawHUDUtility } from './hud-utility-art.ts';
import type { GroundEffect, Player } from './model.ts';
import { PLAYER_ABILITIES } from './combat-content.ts';
import { UI_THEME } from './ui-theme.ts';
import { text, textWidth } from './font.ts';
import { drawHUDSkillIcon } from './hud-icons.ts';
import { drawHUDOrb } from './hud-orb.ts';
import { drawHUDFrame, drawHUDOrbFrame } from './hud-frame.ts';
import { drawHUDExperience, type ExperienceDisplay } from './hud-experience.ts';
import { HUD_ART, HUD_SKILL_SLOTS, getHUDLayout } from './hud-layout.ts';

// Preserve the public entrypoint for the shell and existing UI consumers.
export { HUD_MENU_SHORTCUTS, getHUDLayout, isHUDPoint } from './hud-layout.ts';
export type { HUDRect, HUDShortcut, HUDLayout } from './hud-layout.ts';

export interface HUDOptions { inventory?: boolean; groundEffects?: readonly GroundEffect[]; layout?: {x:number;y:number;scale:number}; touch?: boolean; gamepad?: boolean; reducedMotion?: boolean; healthTrail?: number; hitPulse?: number; experience?: ExperienceDisplay; }

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

function skills(c: CanvasRenderingContext2D, p: Player, time: number, gamepad = false, groundEffects: readonly GroundEffect[] = [], inventory = false) {
  const field = HUD_ART.skill;
  for (const [i, slot] of HUD_SKILL_SLOTS.entries()) {
    const x = field.x + i * field.step, y = inventory ? HUD_ART.inventory.skillY : field.y, w = field.width, h = field.height;
    const skill = i > 0 ? p.character.skillSlots[i - 1] : null;
    const definition = skill ? SKILL_DEFINITIONS[skill] : null;
    const returning=skill==='lunge'?lungeReturn(p):undefined;
    const cooldown = skill && !returning ? p.skillCooldowns[skill] ?? 0 : 0;
    const sustain = skillSustain(skill, p, groundEffects);
    const occupied = i === 0 || !!skill, active = i === 0 ? !!p.attack : !!skill && (p.activeSkill === skill || !!sustain);
    const compatible = !skill || canUseSkill(skill, p.equipment);
    const resolved = skill ? resolveSkill(skill, p.derived, p.character) : null;
    const manaCost = returning ? 0 : resolved?.mana ?? (i === 0 ? basicAttackManaCost(basicAttackWeapon(p), p.derived) : 0);
    const usable = !p.dead && compatible && cooldown <= 0 && p.mana >= manaCost;
    c.save();
    chamfer(c, x, y, w, h, 1);
    const well = c.createLinearGradient(x, y, x, y + h);
    well.addColorStop(0, occupied ? UI.steel : '#101a23'); well.addColorStop(1, UI.steelDeep);
    c.fillStyle = well; c.fill();
    c.strokeStyle = active ? '#c4ad7a' : occupied ? UI.silverDim : '#415763'; c.lineWidth = .8; c.stroke();
    c.strokeStyle = occupied ? UI.silver + '60' : '#52697670';
    c.beginPath(); c.moveTo(x + 4, y + 1.5); c.lineTo(x + w - 4, y + 1.5); c.stroke();
    if (occupied) {
      const glow = c.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, 20);
      glow.addColorStop(0, active ? '#d3ba8035' : '#d3ba8015'); glow.addColorStop(1, '#d3ba8000');
      c.fillStyle = glow; c.fillRect(x + 1, y + 2, w - 2, h - 4);
      c.globalAlpha = usable ? 1 : .42;
      c.save(); c.beginPath(); c.rect(x + 2, y + 2, w - 4, h - 4); c.clip(); c.translate(x + w / 2, y + h / 2);
      if (skill) drawSkillIcon(c, skill, 0, 0, w - 2);
      else if (basicAttackWeapon(p).family === 'unarmed') drawHUDSkillIcon(c, 0, 0, 0, time, active);
      else drawHUDWeapon(c, basicAttackWeapon(p).visual, w - 7);
      c.restore(); c.globalAlpha = 1;
      if (!compatible) {
        c.fillStyle = '#dc9a87'; c.beginPath(); c.moveTo(x + 3, y + 3); c.lineTo(x + 9, y + 3); c.lineTo(x + 3, y + 9); c.closePath(); c.fill();
      } else if(returning){
        text(c,'RETURN',x+w/2,y+h/2-9,.65,'#d2bee6','center');
        text(c,`${returning.remaining.toFixed(1)}s`,x+w/2,y+h/2+1,.7,'#d2bee6','center');
      } else if (definition && cooldown > 0) {
        c.fillStyle = '#030a10a8'; c.fillRect(x + 2, y + 2, w - 4, (h - 4) * clamp(cooldown / Math.max(.001, resolved!.cooldown)));
        text(c, cooldown.toFixed(1), x + w / 2, y + h / 2 - 4, 1.3, UI.ivory, 'center');
      } else if (manaCost > 0) text(c, String(manaCost), x + w - 5, y + 3, .8, '#91bddd', 'right');
    }
    if (sustain) {
      if (sustain.upkeep) text(c, `${sustain.upkeep}/s`, x + w - 4, y + 3, .65, '#91bddd', 'right');
      text(c, `${sustain.remaining.toFixed(1)}s`, x + w / 2, y + h / 2 - 3, .76, '#adead2', 'center');
    }
    // Small corner badges leave the square artwork intact; there is no separate label row.
    const binding = gamepad ? PAD_SKILL_LABELS[i] : slot.key, keyScale = .82;
    const badgeWidth = textWidth(binding) * keyScale + 5;
    c.fillStyle = '#07111de8'; c.fillRect(x + w - badgeWidth - 1, y + h - 10, badgeWidth, 9);
    text(c, binding, x + w - 3, y + h - 9, keyScale,
      occupied && !p.dead ? UI.text : '#718490', 'right');
    if (active) {
      c.fillStyle = '#c4ad7a'; c.fillRect(x + 8, y + h - 1, w - 16, .8);
    }
    c.restore();
  }
}

function medallion(c: CanvasRenderingContext2D, x: number, y: number, size: number, active = false) {
  c.beginPath(); c.arc(x + size / 2, y + size / 2, size / 2, 0, TAU);
  c.fillStyle = '#0a141cf5'; c.fill(); c.strokeStyle = active ? '#ceb986' : '#546873'; c.lineWidth = .85; c.stroke();
  c.beginPath(); c.arc(x + size / 2, y + size / 2, size / 2 - 2, 0, TAU);
  c.strokeStyle = '#8f9b8155'; c.lineWidth = .45; c.stroke();
}
function utilities(c: CanvasRenderingContext2D, p: Player, gamepad = false) {
  const field = HUD_ART.utility, dodge = PLAYER_ABILITIES.dodge, potion = PLAYER_ABILITIES.potion;
  const slots = [
    { x: field.left, key: gamepad ? 'LB' : 'Q', icon: 'potion' as const, charges: p.flasks, capacity: potion.charges,
      cooldown: p.healCooldown, duration: potion.cooldown, active: p.healFlash > 0, color: '#d5a4bf' },
    { x: field.right, key: gamepad ? 'B' : 'SPACE', icon: 'dodge' as const, charges: p.dodgeCharges, capacity: dodge.charges,
      cooldown: p.dodgeCharges > 0 ? 0 : Math.max(0, dodge.recharge - p.dodgeRecharge), duration: dodge.recharge,
      active: p.dodgeTime > 0, color: '#8ac9b4' },
  ];
  for (const slot of slots) {
    const { x } = slot, y = field.y, w = field.width, cx = x + w / 2, cy = y + w / 2;
    c.save(); medallion(c, x, y, w, slot.active);
    c.globalAlpha = slot.charges > 0 && !p.dead ? 1 : .45;
    drawHUDUtility(c, slot.icon, cx, cy, w - 3); c.globalAlpha = 1;
    if (slot.cooldown > 0) {
      c.strokeStyle = slot.color; c.lineWidth = 1.4; c.beginPath();
      c.arc(cx, cy, w / 2 - 1, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - clamp(slot.cooldown / slot.duration))); c.stroke();
      text(c, slot.cooldown.toFixed(1), cx, cy - 3, .9, UI.ivory, 'center');
    }
    const left = slot.icon === 'potion', bx = left ? x + w + 2 : x - 2;
    const keyWidth = slot.key === 'SPACE' ? 25 : 13;
    c.fillStyle = '#b7b9a4'; c.fillRect(left ? bx : bx - keyWidth, y + 4, keyWidth, 12);
    text(c, slot.key, left ? bx + keyWidth / 2 : bx - keyWidth / 2, y + 6, slot.key === 'SPACE' ? .6 : .8, '#162129', 'center', 'interface');
    for (let charge = 0; charge < slot.capacity; charge++) {
      c.beginPath(); c.arc(cx - (slot.capacity - 1) * 2.5 + charge * 5, y + w + 3, 1.2, 0, TAU);
      c.fillStyle = charge < slot.charges ? slot.color : '#1a242c'; c.fill();
    }
    c.restore();
  }
}
function shortcuts(c: CanvasRenderingContext2D, p: Player) {
  const { x, y, width: w } = HUD_ART.menu;
  c.strokeStyle = '#596974'; c.lineWidth = .7;
  c.beginPath(); c.moveTo(x + w / 2, y + w); c.lineTo(x + w / 2, HUD_ART.skill.y - 3); c.stroke();
  medallion(c, x, y, w);
  drawHUDUtility(c, 'menu', x + w / 2, y + w / 2, w - 4);
  if (p.character.statPoints + p.character.skillPoints > 0) {
    c.beginPath(); c.arc(x + w - 2, y + 2, 3, 0, TAU); c.fillStyle = '#e1bd79'; c.fill();
    c.strokeStyle = '#101c24'; c.lineWidth = 1; c.stroke();
  }
}

function readout(c: CanvasRenderingContext2D, x: number, current: number, max: number, mana: boolean) {
  const value = `${current} / ${max}`;
  // Reserve the same clear opening when future gear raises resource capacities.
  const size = Math.min(1.13, 58 / Math.max(1, textWidth(value)));
  text(c, value, x, HUD_ART.orb.readoutY - size * 3.85, size, mana ? '#b9cee0' : '#dfb9af', 'center');
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
  skills(c, p, t, options.gamepad, options.groundEffects, options.inventory);
  if (!options.inventory) { utilities(c, p, options.gamepad); shortcuts(c, p); }
  readout(c, orb.left, Math.ceil(Math.max(0, p.hp)), p.maxHp, false);
  readout(c, orb.right, Math.floor(Math.max(0, p.mana)), p.maxMana, true);
  drawHUDExperience(c, p, t, options.experience, options.inventory ? HUD_ART.inventory.experienceY : HUD_ART.experience.y);
}

/** Compact Astral instruments flank the unchanged XP rail and reward landing point. */
function drawTouchResources(c: CanvasRenderingContext2D, p: Player, time: number, options: HUDOptions) {
  const t = options.reducedMotion ? 0 : time;
  for (const mana of [false, true]) {
    const x = mana ? 436 : 84;
    c.save(); c.translate(x, 96); c.scale(.72, .72);
    c.lineCap = 'round'; c.lineJoin = 'round';
    drawHUDOrbFrame(c, 0, 0, mana ? 1 : -1, t);
    c.scale(HUD_ART.orb.scale, HUD_ART.orb.scale);
    drawHUDOrb(c, 0, 0, mana ? p.mana / Math.max(1, p.maxMana) : p.hp / Math.max(1, p.maxHp),
      t + (mana && !options.reducedMotion ? 7 : 0), mana, mana ? undefined : options.healthTrail,
      mana ? 0 : (options.hitPulse ?? 0) * (options.reducedMotion ? .4 : 1));
    c.restore();
    // Keep the numeric plate larger than the scaled instrument for phone readability.
    chamfer(c, x - 44, 129, 88, 18, 4);
    const metal = c.createLinearGradient(0, 129, 0, 147);
    metal.addColorStop(0, '#263943'); metal.addColorStop(1, '#0a141c');
    c.fillStyle = metal; c.fill(); c.strokeStyle = '#77929c'; c.lineWidth = .8; c.stroke();
    const current = mana ? Math.floor(Math.max(0, p.mana)) : Math.ceil(Math.max(0, p.hp));
    const value = `${current} / ${mana ? p.maxMana : p.maxHp}`;
    const size = Math.min(1.6, 78 / Math.max(1, textWidth(value)));
    text(c, value, x, 138 - size * 3.85, size, mana ? '#b9cee0' : '#dfb9af', 'center');
  }
}

/** Drawn at native display density above the world shader. */
export function drawFloatingHUD(c: CanvasRenderingContext2D, p: Player, width: number, height: number, time: number, options: HUDOptions = {}) {
  const layout = options.layout ?? getHUDLayout(width, height);
  if (!layout.scale) return;
  c.save(); c.translate(layout.x, layout.y); c.scale(layout.scale, layout.scale);
  if(options.touch) {
    drawTouchResources(c, p, time, options);
    drawHUDExperience(c, p, options.reducedMotion ? 0 : time, options.experience);
  }
  else { drawHUDFrame(c, options.reducedMotion ? 0 : time, options.inventory); drawHUDContents(c, p, time, options); }
  c.restore();
}
