import type { Player } from './model.ts';
import { text } from './font.ts';

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

const BASE_WIDTH = 444;
const BASE_HEIGHT = 84;
const TAU = Math.PI * 2;
const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Shared by Canvas artwork and the transparent, accessible DOM controls. */
export function getHUDLayout(width: number, height: number): HUDLayout {
  const scale = Math.max(0, Math.min(1, (width - 20) / BASE_WIDTH, (height - 28) / BASE_HEIGHT));
  const hudWidth = BASE_WIDTH * scale, hudHeight = BASE_HEIGHT * scale;
  const x = (width - hudWidth) / 2, y = height - hudHeight - 14;
  const rect = (rx: number, ry: number, rw: number, rh: number): HUDRect => ({
    x: x + rx * scale, y: y + ry * scale, width: rw * scale, height: rh * scale,
  });
  return {
    x, y, width: hudWidth, height: hudHeight, scale,
    shortcuts: HUD_MENU_SHORTCUTS.map((shortcut, i) => ({ ...shortcut, ...rect(152 + i * 36, 0, 32, 21) })),
  };
}

/** Keep attacks off the visible hub, including the disabled menu controls. */
export function isHUDPoint(x: number, y: number, width: number, height: number): boolean {
  const h = getHUDLayout(width, height);
  if (h.scale <= 0 || x < h.x || x > h.x + h.width || y < h.y || y > h.y + h.height) return false;
  const localX = (x - h.x) / h.scale, localY = (y - h.y) / h.scale;
  if (localY >= 23) return true;
  // The open space beside the menu ridge no longer contains a settings control.
  return (localX >= 143 && localX <= 300)
    || Math.hypot(localX - 48, localY - 40) <= 35
    || Math.hypot(localX - 396, localY - 40) <= 35
    || (localX >= 108 && localX <= 137 && localY >= 8 && localY <= 18);
}

function polygon(c: CanvasRenderingContext2D, points: readonly number[]) {
  c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
}

function circle(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath(); c.arc(x, y, r, 0, TAU);
}

function gem(c: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  polygon(c, [x, y - radius, x + radius, y, x, y + radius, x - radius, y]);
  c.fillStyle = color; c.fill();
  c.strokeStyle = '#b5a071'; c.lineWidth = .7; c.stroke();
  c.fillStyle = '#fff2c16b'; c.fillRect(x - 1, y - radius + 1, 1, 2);
}

function rivet(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = '#04080c'; c.fillRect(x - 2, y - 1, 4, 4);
  c.fillStyle = '#7e7562'; c.fillRect(x - 1, y - 1, 2, 2);
  c.fillStyle = '#d4ba83'; c.fillRect(x - 1, y - 1, 1, 1);
}

function chassis(c: CanvasRenderingContext2D) {
  // One small floating reliquary: the world remains visible around its silhouette.
  c.save();
  c.shadowColor = '#02050bcc'; c.shadowBlur = 14; c.shadowOffsetY = 5;
  polygon(c, [5, 35, 19, 23, 74, 23, 91, 32, 109, 23, 335, 23, 353, 32, 370, 23, 425, 23, 439, 35, 431, 63, 404, 79, 362, 74, 344, 80, 100, 80, 82, 74, 40, 79, 13, 63]);
  const metal = c.createLinearGradient(0, 21, 0, 81);
  metal.addColorStop(0, '#55564e'); metal.addColorStop(.08, '#252b2d');
  metal.addColorStop(.45, '#131b20'); metal.addColorStop(1, '#070b10');
  c.fillStyle = metal; c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
  c.strokeStyle = '#171711'; c.lineWidth = 3; c.stroke();
  c.strokeStyle = '#927647'; c.lineWidth = 1; c.stroke();
  polygon(c, [83, 47, 112, 29, 332, 29, 361, 47, 341, 75, 103, 75]);
  c.fillStyle = '#080e13'; c.fill(); c.strokeStyle = '#48493d'; c.stroke();
  c.strokeStyle = '#c1a56a';
  c.beginPath(); c.moveTo(108, 25.5); c.lineTo(335, 25.5); c.stroke();
  c.strokeStyle = '#383e36';
  c.beginPath(); c.moveTo(105, 77.5); c.lineTo(339, 77.5); c.stroke();

  // Cut metal ribs cradle each orb; short stepped shapes read at native pixels.
  for (const mirrored of [false, true]) {
    c.save(); if (mirrored) { c.translate(BASE_WIDTH, 0); c.scale(-1, 1); }
    polygon(c, [5, 37, 14, 31, 18, 35, 13, 48, 18, 63, 29, 69, 34, 76, 21, 69, 10, 57]);
    c.fillStyle = '#2f3638'; c.fill(); c.strokeStyle = '#9e8558'; c.stroke();
    polygon(c, [81, 34, 95, 38, 108, 34, 101, 45, 109, 58, 92, 63, 85, 73, 74, 73, 84, 62, 89, 48]);
    c.fillStyle = '#242b2e'; c.fill(); c.strokeStyle = '#6d6148'; c.stroke();
    c.strokeStyle = '#bbb18b'; c.beginPath(); c.moveTo(13, 37); c.lineTo(10, 44); c.lineTo(14, 56); c.stroke();
    rivet(c, 98, 48); rivet(c, 23, 66);
    gem(c, 90, 65, 2, '#554a37');
    c.restore();
  }
  // The menu ridge is part of the same housing, not another full-width strip.
  polygon(c, [143, 24, 146, 4, 152, 0, 291, 0, 299, 8, 299, 24]);
  c.fillStyle = '#0c1218'; c.fill(); c.strokeStyle = '#555644'; c.stroke();
  rivet(c, 143, 26); rivet(c, 300, 26);
  gem(c, 121, 13, 4, '#5c705e');
  c.strokeStyle = '#5a5642'; c.beginPath(); c.moveTo(108, 13); c.lineTo(115, 13); c.moveTo(127, 13); c.lineTo(137, 13); c.stroke();
  c.restore();
}

/** A circle's liquid area, rather than just its height, represents the resource. */
function liquidLevel(ratio: number, radius: number): number {
  if (ratio <= 0) return radius + 2;
  if (ratio >= 1) return -radius - 2;
  let low = -1, high = 1;
  for (let i = 0; i < 14; i++) {
    const t = (low + high) / 2;
    const area = (Math.acos(t) - t * Math.sqrt(1 - t * t)) / Math.PI;
    if (area > ratio) low = t; else high = t;
  }
  return (low + high) * radius / 2;
}

function orb(c: CanvasRenderingContext2D, x: number, y: number, ratio: number, time: number, mana: boolean, trail = ratio, hit = 0) {
  const r = 28;
  ratio = clamp(ratio);
  c.save(); c.translate(x, y);
  // Emission is restrained around the metal so the liquid keeps its contrast.
  const halo = c.createRadialGradient(0, 4, 18, 0, 4, 43);
  const pulse = !mana && ratio < .3 ? .3 + Math.sin(time * 5) * .1 : .19;
  halo.addColorStop(0, mana ? 'rgba(47,113,255,.3)' : `rgba(255,47,58,${pulse})`);
  halo.addColorStop(1, '#00000000'); c.fillStyle = halo; c.fillRect(-43, -39, 86, 86);
  const ring = c.createLinearGradient(-30, -34, 27, 34);
  ring.addColorStop(0, '#c5b180'); ring.addColorStop(.19, '#5f5c4d');
  ring.addColorStop(.45, '#202b2f'); ring.addColorStop(.72, '#8f784f'); ring.addColorStop(1, '#282f2c');
  circle(c, 0, 0, r + 6); c.fillStyle = '#070b10'; c.fill();
  circle(c, 0, 0, r + 4); c.strokeStyle = ring; c.lineWidth = 4; c.stroke();
  circle(c, 0, 0, r + 1); c.strokeStyle = '#04090c'; c.lineWidth = 2; c.stroke();
  c.save(); circle(c, 0, 0, r); c.clip();
  const empty = c.createRadialGradient(-9, -12, 0, 0, 0, r * 1.5);
  empty.addColorStop(0, mana ? '#172a42' : '#351b2c'); empty.addColorStop(1, '#04080e');
  c.fillStyle = empty; c.fillRect(-r, -r, r * 2, r * 2);
  if (!mana && trail > ratio + .002) {
    const lagLevel = liquidLevel(clamp(trail), r);
    c.fillStyle = '#ffc1808c'; c.fillRect(-r, lagLevel, r * 2, r * 2);
  }
  const level = liquidLevel(ratio, r);
  const waveSize = Math.sin(ratio * Math.PI) * 1.8;
  const wave = (px: number) => level + Math.sin(px * .16 + time * 2) * waveSize + Math.sin(px * .29 - time * 1.6) * waveSize * .4;
  if (ratio > 0) {
    c.save();
    c.beginPath(); c.moveTo(-r - 1, r + 1); c.lineTo(-r - 1, wave(-r - 1));
    for (let px = -r; px <= r + 1; px += 2) c.lineTo(px, wave(px));
    c.lineTo(r + 1, r + 1); c.closePath(); c.clip();
    const liquid = c.createLinearGradient(-r, -r, r * .65, r);
    liquid.addColorStop(0, mana ? '#9adfff' : '#ffb181');
    liquid.addColorStop(.24, mana ? '#317fff' : '#fc3c47');
    liquid.addColorStop(.64, mana ? '#1744c8' : '#a61435');
    liquid.addColorStop(1, mana ? '#082750' : '#410b20');
    c.fillStyle = liquid; c.fillRect(-r, -r, r * 2, r * 2);
    // Counter-rotating caustics: a few clipped curves, no textures or particle heap.
    c.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      c.strokeStyle = mana ? '#9eeaff' : '#ff916a'; c.globalAlpha = .09 + i * .02;
      c.lineWidth = 1.5 + i * .7; c.beginPath();
      for (let px = -r; px <= r; px += 2) {
        const py = 10 + Math.sin(px * .065 + time * .6 + i * 1.5) * (9 + i * 2) + Math.cos(time * .7 + i) * 4;
        if (px === -r) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const phase = (time * (.06 + i * .006) + i * .167) % 1;
      const bx = Math.sin(i * 5.7 + time * .5) * (13 + (i % 3) * 4);
      const by = r + 4 - phase * (r * 2 + 8);
      c.globalAlpha = Math.sin(phase * Math.PI) * .4;
      circle(c, bx, by, .7 + i % 2 * .6); c.strokeStyle = mana ? '#b9edff' : '#ffc5a3'; c.lineWidth = .7; c.stroke();
    }
    c.globalAlpha = .3;
    const core = c.createRadialGradient(-8, 12, 0, -8, 12, r);
    core.addColorStop(0, mana ? '#b0f9ff' : '#ffb77e'); core.addColorStop(1, '#00000000');
    c.fillStyle = core; c.fillRect(-r, -r, r * 2, r * 2);
    c.restore();
    if (ratio < .99) {
      c.strokeStyle = mana ? '#b0ecff' : '#ffb7a0'; c.lineWidth = 1; c.globalAlpha = .65;
      c.beginPath(); c.moveTo(-r, wave(-r)); for (let px = -r + 2; px <= r; px += 2) c.lineTo(px, wave(px)); c.stroke(); c.globalAlpha = 1;
    }
  }
  const glass = c.createRadialGradient(-11, -15, 2, 2, 2, r * 1.1);
  glass.addColorStop(0, '#ffffff35'); glass.addColorStop(.36, '#ffffff00'); glass.addColorStop(.79, '#01051200'); glass.addColorStop(1, '#010512a0');
  c.fillStyle = glass; c.fillRect(-r, -r, r * 2, r * 2);
  c.strokeStyle = '#fff4e28c'; c.lineWidth = 1.6; c.beginPath(); c.arc(-1, 0, r - 5, 3.68, 4.33); c.stroke();
  c.strokeStyle = '#ffffff40'; c.lineWidth = .8; c.beginPath(); c.arc(-1, 0, r - 4, .36, .93); c.stroke();
  c.fillStyle = '#fff8dcab'; c.fillRect(-13, -18, 2, 3);
  c.restore();
  // Four small clasps finish the glass seating without covering the readout.
  for (let i = 0; i < 4; i++) {
    c.save(); c.rotate(i * Math.PI / 2 + Math.PI / 4);
    polygon(c, [-2, -35, 2, -35, 3, -29, 0, -27, -3, -29]);
    c.fillStyle = '#746e55'; c.fill(); c.strokeStyle = '#ada17a'; c.lineWidth = .7; c.stroke(); c.restore();
  }
  if (!mana && hit > 0) {
    c.save(); c.globalAlpha = hit * .85; c.globalCompositeOperation = 'screen';
    circle(c, 0, 0, r + 4); c.lineWidth = 2.5;
    c.strokeStyle = '#ffb28b'; c.shadowColor = '#ff313e'; c.shadowBlur = 12; c.stroke();
    c.restore();
  }
  c.restore();
}

function skillIcon(c: CanvasRenderingContext2D, index: number, x: number, y: number, time: number, active: boolean) {
  c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round';
  if (index === 0) {
    c.save(); c.rotate(.64);
    c.strokeStyle = active ? '#ffce81' : '#719cad'; c.lineWidth = 2; c.globalAlpha = .35;
    c.beginPath(); c.arc(0, -3, 14, 3.2, 5.6); c.stroke(); c.globalAlpha = 1;
    polygon(c, [-2, 7, -2, -10, 0, -17, 3, -11, 3, 7]); c.fillStyle = '#a9cbd8'; c.fill();
    c.fillStyle = '#eefbdf'; c.fillRect(0, -10, 1, 17);
    c.fillStyle = '#a68b53'; c.fillRect(-7, 6, 15, 3); c.fillRect(-1, 9, 3, 8);
    c.fillStyle = '#4a3b33'; c.fillRect(0, 10, 1, 5); c.restore();
  } else if (index === 1) {
    const breath = active ? Math.sin(time * 9) * 1.5 : 0;
    polygon(c, [-1, -16 - breath, 6, -8, 9, 0, 6, 9, 0, 12, -7, 8, -10, 0, -5, -9, -5, -2, -1, -6]);
    c.fillStyle = '#d55325'; c.fill();
    polygon(c, [0, -9, 5, 0, 4, 7, 0, 10, -5, 5, -4, 0]); c.fillStyle = '#ffb144'; c.fill();
    polygon(c, [1, -2, 3, 5, 0, 8, -2, 4]); c.fillStyle = '#fff3bf'; c.fill();
    c.fillStyle = '#ffcf73'; c.fillRect(-8, -12, 1, 2); c.fillRect(8, -9, 1, 2);
  } else if (index === 2) {
    c.strokeStyle = '#5d989e'; c.lineWidth = 1;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-16, -5 + i * 6); c.lineTo(-7 + i * 2, -8 + i * 6); c.stroke(); }
    polygon(c, [-3, -11, 4, -12, 6, -4, 11, 0, 13, 7, 8, 10, -4, 10, -9, 5, 0, 1]);
    c.fillStyle = '#9ed9d4'; c.fill();
    c.strokeStyle = '#e0f9d5'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -10); c.lineTo(4, -4); c.lineTo(3, 2); c.lineTo(11, 7); c.stroke();
    c.fillStyle = '#284848'; c.fillRect(-5, 8, 14, 2);
  } else {
    c.fillStyle = '#b3a17c'; c.fillRect(-4, -13, 8, 3);
    polygon(c, [-3, -10, 3, -10, 3, -5, 8, 0, 7, 10, 3, 13, -3, 13, -7, 10, -8, 0, -3, -5]);
    c.fillStyle = '#263b35'; c.fill(); c.strokeStyle = '#a0b099'; c.lineWidth = 1; c.stroke();
    polygon(c, [-6, 1, 6, 1, 5, 9, 2, 11, -3, 11, -5, 8]); c.fillStyle = '#83b671'; c.fill();
    c.fillStyle = '#d8eca7'; c.fillRect(-4, 2, 1, 5); c.fillRect(-2, -7, 1, 3);
    c.strokeStyle = '#b3d298'; c.beginPath(); c.moveTo(-5, -1); c.lineTo(5, -1); c.stroke();
  }
  c.restore();
}

function skills(c: CanvasRenderingContext2D, p: Player, time: number) {
  const definitions = [
    { key: 'LMB', cooldown: 0, duration: 1, enabled: !p.dead, active: !!p.attack, color: '#dbac6d', charges: -1 },
    { key: 'RMB', cooldown: p.castCooldown, duration: .45, enabled: p.mana >= 20 && !p.dead, active: p.castTime > 0, color: '#ed9959', charges: -1 },
    { key: 'SPACE', cooldown: p.dodgeCharges > 0 ? 0 : Math.max(0, 1.8 - p.dodgeRecharge), duration: 1.8, enabled: p.dodgeCharges > 0 && !p.dead, active: p.dodgeTime > 0, color: '#91cec5', charges: p.dodgeCharges },
    { key: 'Q', cooldown: p.healCooldown, duration: .8, enabled: p.flasks > 0 && p.hp < p.maxHp && !p.dead, active: p.healFlash > 0, color: '#b6ca83', charges: p.flasks },
  ];
  definitions.forEach((slot, i) => {
    const x = 111 + i * 56, y = 29, w = 50, h = 46;
    c.save();
    const well = c.createLinearGradient(x, y, x, y + h);
    well.addColorStop(0, '#243039'); well.addColorStop(.14, '#101a23'); well.addColorStop(1, '#060c13');
    c.fillStyle = well; c.fillRect(x, y, w, h);
    c.strokeStyle = slot.active ? slot.color : '#746c53'; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 1);
    c.strokeStyle = '#39453f'; c.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
    c.strokeStyle = slot.active ? '#ffe2a3' : '#afa27a';
    c.beginPath(); c.moveTo(x + 1, y + 7); c.lineTo(x + 1, y + 1); c.lineTo(x + 7, y + 1); c.stroke();
    c.beginPath(); c.moveTo(x + w - 7, y + h - 1); c.lineTo(x + w - 1, y + h - 1); c.lineTo(x + w - 1, y + h - 7); c.stroke();
    if (slot.active) {
      const aura = c.createRadialGradient(x + 25, y + 20, 1, x + 25, y + 20, 28);
      aura.addColorStop(0, slot.color + '59'); aura.addColorStop(1, slot.color + '00'); c.fillStyle = aura; c.fillRect(x + 2, y + 2, w - 4, h - 4);
    }
    c.globalAlpha = slot.enabled ? 1 : .43;
    skillIcon(c, i, x + w / 2, y + 19, time, slot.active); c.globalAlpha = 1;
    if (slot.cooldown > 0) {
      c.fillStyle = '#030913bd'; c.fillRect(x + 3, y + 3, w - 6, 29 * clamp(slot.cooldown / slot.duration));
      const countdown = slot.cooldown >= 1 ? slot.cooldown.toFixed(1) : '.' + Math.ceil(slot.cooldown * 10);
      text(c, countdown, x + 26, y + 16, 1, '#f2e3b9', 'center');
    }
    c.fillStyle = '#060a0fe6'; c.fillRect(x + 4, y + 33, w - 8, 10);
    text(c, slot.key, x + w / 2, y + 35, 1, slot.enabled ? '#d1c7a6' : '#777e78', 'center');
    if (slot.charges >= 0) {
      for (let charge = 0; charge < 2; charge++) {
        gem(c, x + 39 + charge * 6, y + 7, 1.7, charge < slot.charges ? slot.color : '#141c22');
      }
      if (i === 2 && p.dodgeCharges < 2) {
        c.fillStyle = '#0a1218'; c.fillRect(x + 3, y + h - 3, w - 6, 1);
        c.fillStyle = '#83bbb6'; c.fillRect(x + 3, y + h - 3, (w - 6) * clamp(p.dodgeRecharge / 1.8), 1);
      }
    }
    c.restore();
  });
}

/** Menu glyphs share one 14 × 14 drawing field and a consistent metal stroke. */
function menuIcon(c: CanvasRenderingContext2D, index: number, x: number, y: number) {
  c.save(); c.translate(x, y);
  c.strokeStyle = '#98a194';
  c.fillStyle = '#152027';
  c.lineWidth = 1;
  c.lineJoin = 'round'; c.lineCap = 'round';
  if (index === 0) {
    // A head above a fitted collar is legible without a filled portrait blob.
    c.beginPath(); c.arc(0, -3.5, 2.3, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(-5, 6); c.lineTo(-5, 4);
    c.quadraticCurveTo(-4.5, 2, -2, 1);
    c.lineTo(0, 2.5); c.lineTo(2, 1);
    c.quadraticCurveTo(4.5, 2, 5, 4);
    c.lineTo(5, 6); c.closePath(); c.stroke();
  } else if (index === 1) {
    // The handle, flap and clasp all belong to the same bag silhouette.
    c.beginPath(); c.moveTo(-2, -3); c.lineTo(-2, -5);
    c.quadraticCurveTo(-2, -6, 0, -6);
    c.quadraticCurveTo(2, -6, 2, -5); c.lineTo(2, -3); c.stroke();
    c.beginPath(); c.moveTo(-4, -3); c.lineTo(4, -3);
    c.lineTo(5, 4); c.quadraticCurveTo(5, 6, 4, 6);
    c.lineTo(-4, 6); c.quadraticCurveTo(-5, 6, -5, 4); c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(-4, 0); c.lineTo(4, 0);
    c.moveTo(0, -.5); c.lineTo(0, 2.5); c.stroke();
  } else if (index === 2) {
    c.beginPath(); c.moveTo(0, 4.5); c.lineTo(0, -4.5);
    c.moveTo(0, 1); c.lineTo(-4.5, -2.5);
    c.moveTo(0, 1); c.lineTo(4.5, -2.5); c.stroke();
    for (const [nx, ny] of [[0, -5], [-4.5, -2.5], [4.5, -2.5], [0, 5]]) {
      circle(c, nx, ny, 1.2); c.fill(); c.stroke();
    }
  } else if (index === 3) {
    c.beginPath(); c.moveTo(0, -3.5);
    c.quadraticCurveTo(-2.5, -5.5, -5, -4.5);
    c.lineTo(-5, 5); c.quadraticCurveTo(-2.5, 4.5, 0, 6);
    c.quadraticCurveTo(2.5, 4.5, 5, 5); c.lineTo(5, -4.5);
    c.quadraticCurveTo(2.5, -5.5, 0, -3.5); c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(0, -3.5); c.lineTo(0, 5.5); c.stroke();
  }
  c.restore();
}

/** Procedural Canvas HUD. Resource animation never changes simulation state. */
export function drawFloatingHUD(c: CanvasRenderingContext2D, p: Player, width: number, height: number, time: number, options: HUDOptions = {}) {
  const layout = getHUDLayout(width, height);
  if (!layout.scale) return;
  const t = options.reducedMotion ? 0 : time;
  c.save(); c.translate(layout.x, layout.y); c.scale(layout.scale, layout.scale);
  chassis(c);
  orb(c, 48, 40, p.hp / Math.max(1, p.maxHp), t, false, options.healthTrail,
    (options.hitPulse ?? 0) * (options.reducedMotion ? .4 : 1));
  orb(c, 396, 40, p.mana / Math.max(1, p.maxMana), t + (options.reducedMotion ? 0 : 7), true);
  skills(c, p, t);
  for (let i = 0; i < HUD_MENU_SHORTCUTS.length; i++) {
    const x = 152 + i * 36;
    c.fillStyle = '#152027'; c.fillRect(x + 1, 1, 30, 19);
    c.strokeStyle = '#49554e'; c.lineWidth = 1; c.strokeRect(x + 1.5, 1.5, 29, 18);
    c.strokeStyle = '#647064';
    c.beginPath(); c.moveTo(x + 3.5, 2.5); c.lineTo(x + 27.5, 2.5); c.stroke();
    c.strokeStyle = '#2a3939';
    c.beginPath(); c.moveTo(x + 19.5, 5.5); c.lineTo(x + 19.5, 15.5); c.stroke();
    menuIcon(c, i, x + 10.5, 10.5);
    text(c, HUD_MENU_SHORTCUTS[i].key, x + 24, 6, 1, '#a1a796', 'center');
  }
  // Readouts sit in little inset plaques, not in the liquid or in a legend.
  for (const [x, current, max, color] of [
    [48, Math.ceil(Math.max(0, p.hp)), p.maxHp, '#e6aba0'],
    [396, Math.floor(Math.max(0, p.mana)), p.maxMana, '#9cc9ed'],
  ] as const) {
    polygon(c, [x - 31, 74, x - 26, 72, x + 26, 72, x + 31, 74, x + 27, 83, x - 27, 83]);
    c.fillStyle = '#0b1118'; c.fill(); c.strokeStyle = '#665d44'; c.lineWidth = 1; c.stroke();
    text(c, `${current}/${max}`, x, 75, 1, color, 'center');
  }
  c.restore();
}
