import { getSwingAngle, PLAYER_ART_SCALE } from './art.ts';
import { drawGlow } from './lighting.ts';
import type { PointLight } from './lighting.ts';
import type { CombatEvent, Player } from './model.ts';
import type { Simulation } from './simulation.ts';
import { text } from './font.ts';

interface Spark {
  x: number; y: number; vx: number; vy: number;
  z: number; vz: number; curl: number;
  life: number; max: number; size: number; color: string;
}
interface Flash { x: number; y: number; life: number; max: number; radius: number; color: string; ring: boolean; }
interface Popup { x: number; y: number; life: number; value: string; color: string; size: number; }
const GOLD = '#ffad48', FIRE = '#ff643b', MINT = '#54e8b8', BLUE = '#64baff';

/** Effects never drive gameplay. All collections and continuous emitters are bounded. */
export class CombatEffects {
  private sparks: Spark[] = [];
  private flashes: Flash[] = [];
  private popups: Popup[] = [];
  private emitterTime = 0;

  reset() { this.sparks = []; this.flashes = []; this.popups = []; this.emitterTime = 0; }

  private spark(x: number, y: number, angle: number, color: string, strength = 1, airborne = true) {
    const speed = (35 + Math.random() * 150) * strength;
    const life = .25 + Math.random() * .5;
    this.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      z: airborne ? 9 : 0, vz: airborne ? 25 + Math.random() * 100 : 0,
      curl: (Math.random() - .5) * 5, life, max: life, size: .7 + Math.random() * 1.6, color });
  }

  handleEvents(events: CombatEvent[]) {
    for (const event of events) {
      const enemyCast = event.type === 'cast' && event.enemyKind;
      const color = event.type === 'hurt' ? FIRE : event.type === 'heal' || enemyCast ? MINT
        : event.type === 'dodge' ? BLUE : event.type === 'cast' ? FIRE : GOLD;
      const count = event.type === 'hit' ? (event.heavy ? 32 : 20) : event.type === 'kill' ? 44
        : event.type === 'hurt' ? 24 : event.type === 'cast' ? 18 : event.type === 'heal' ? 30
        : event.type === 'pickup' ? 10 : event.type === 'dodge' ? 14 : event.type === 'swing' ? 5 : 0;
      for (let i = 0; i < count; i++) {
        const radial = ['kill', 'heal', 'pickup'].includes(event.type);
        const angle = radial ? Math.random() * Math.PI * 2 : (event.angle ?? 0) + (Math.random() - .5) * 3.4;
        this.spark(event.x, event.y, angle, i % 4 === 0 ? '#fff0b4' : color, event.heavy ? 1.3 : 1);
      }
      if (count > 5) {
        const max = event.type === 'heal' ? .55 : event.type === 'kill' ? .32 : .17;
        this.flashes.push({ x: event.x, y: event.y - 10, life: max, max,
          radius: event.heavy || event.type === 'kill' ? 135 : 90, color,
          ring: event.type === 'kill' || event.type === 'heal' || !!event.heavy });
      }
      if (event.type === 'hit' && event.value) this.popups.push({ x: event.x + (Math.random() - .5) * 12,
        y: event.y - 36, life: .7, value: String(Math.round(event.value)),
        color: event.heavy ? '#fff0aa' : '#f1e6cc', size: event.heavy ? 2 : 1.5 });
      if (event.type === 'hurt' || event.type === 'heal') this.popups.push({ x: event.x, y: event.y - 58,
        life: .8, value: (event.type === 'hurt' ? '-' : '+') + Math.round(event.value ?? 0),
        color: event.type === 'hurt' ? '#ff8d72' : '#83ffbb', size: 2 });
    }
    this.trim();
  }

  private trim() {
    if (this.sparks.length > 650) this.sparks.splice(0, this.sparks.length - 650);
    if (this.flashes.length > 22) this.flashes.splice(0, this.flashes.length - 22);
    if (this.popups.length > 35) this.popups.splice(0, this.popups.length - 35);
  }

  update(sim: Simulation, dt: number) {
    if (dt <= 0) return;
    for (const spark of this.sparks) {
      spark.life -= dt;
      const angle = spark.curl * dt, cos = Math.cos(angle), sin = Math.sin(angle);
      const vx = spark.vx * cos - spark.vy * sin;
      spark.vy = (spark.vx * sin + spark.vy * cos) * Math.exp(-dt * 1.7);
      spark.vx = vx * Math.exp(-dt * 1.7);
      spark.x += spark.vx * dt; spark.y += spark.vy * dt;
      spark.z = Math.max(0, spark.z + spark.vz * dt); spark.vz -= dt * 170;
    }
    for (const flash of this.flashes) flash.life -= dt;
    for (const popup of this.popups) { popup.life -= dt; popup.y -= dt * 26; }
    this.sparks = this.sparks.filter(s => s.life > 0);
    this.flashes = this.flashes.filter(f => f.life > 0);
    this.popups = this.popups.filter(p => p.life > 0);
    this.emitterTime += dt;
    while (this.emitterTime >= .016) {
      this.emitterTime -= .016;
      const p = sim.player, attack = p.attack;
      if (attack && attack.elapsed >= attack.activeStart && attack.elapsed <= attack.activeEnd + .025) {
        const angle = getSwingAngle(attack.angle, attack.elapsed / attack.duration,
          attack.activeStart / attack.duration, attack.activeEnd / attack.duration, attack.arc);
        const reach = (15 + p.equipment.mainHand.visual.length) * PLAYER_ART_SCALE;
        const x = p.x + Math.cos(angle) * reach, y = p.y - 20 * PLAYER_ART_SCALE + Math.sin(angle) * reach * .86;
        for (let i = 0; i < 2; i++) this.spark(x, y, angle + 1.3,
          i === 0 ? '#fff0d4' : (p.equipment.mainHand.visual.glow ?? '#bad8ef'), .55, false);
      }
      for (const shot of sim.projectiles.slice(0, 32)) {
        this.spark(shot.x, shot.y, shot.angle + Math.PI + (Math.random() - .5),
          shot.owner === 'player' ? (Math.random() > .5 ? FIRE : GOLD) : MINT, .3, false);
      }
      if (p.castTime > .145) {
        const angle = sim.time * 22;
        this.spark(p.x + Math.cos(p.castAngle) * 17 + Math.cos(angle) * 8,
          p.y - 22 + Math.sin(p.castAngle) * 12 + Math.sin(angle) * 8, angle + Math.PI / 2, GOLD, .25, false);
      }
    }
    this.trim();
  }

  getLights(): PointLight[] {
    return this.flashes.slice(-7).map(f => ({ x: f.x, y: f.y, radius: f.radius,
      power: f.life / f.max * .85, color: f.color }));
  }

  draw(c: CanvasRenderingContext2D) {
    c.save();
    for (const flash of this.flashes) {
      c.globalAlpha = 1;
      const t = flash.life / flash.max;
      drawGlow(c, flash.x, flash.y, flash.radius * .5, flash.color, t * .4);
      if (flash.ring) {
        c.globalAlpha = t * .7;
        c.strokeStyle = flash.color; c.lineWidth = 1 + t * 2;
        c.beginPath(); c.ellipse(flash.x, flash.y + 10, 8 + (1 - t) * 47, 4 + (1 - t) * 24, 0, 0, Math.PI * 2); c.stroke();
      }
    }
    c.globalCompositeOperation = 'lighter';
    for (const spark of this.sparks) {
      const t = Math.min(1, spark.life / spark.max * 1.8), y = spark.y - spark.z;
      c.globalAlpha = t;
      // Bright cores and fading tangential ribbons make motion readable between frames.
      c.strokeStyle = spark.color; c.lineWidth = spark.size * .65;
      c.beginPath(); c.moveTo(spark.x - spark.vx * .032, y - (spark.vy - spark.vz) * .026);
      c.lineTo(spark.x, y); c.stroke();
      c.fillStyle = spark.life > spark.max * .65 ? '#fff0c9' : spark.color;
      c.fillRect(spark.x - spark.size / 2, y - spark.size / 2, spark.size, spark.size);
      if (spark.size > 1.7) drawGlow(c, spark.x, y, 8, spark.color, t * .35);
    }
    c.restore();
  }

  drawNumbers(c: CanvasRenderingContext2D) {
    c.save();
    for (const popup of this.popups) {
      c.globalAlpha = Math.min(1, popup.life / .18);
      text(c, popup.value, popup.x + 1, popup.y + 1, popup.size, '#071016', 'center');
      text(c, popup.value, popup.x, popup.y, popup.size, popup.color, 'center');
    }
    c.restore();
  }
}

/** A short moving glint follows the sword tip; there is no filled damage arc. */
export function drawSwordTrail(c: CanvasRenderingContext2D, p: Player, x: number, y: number) {
  const a = p.attack;
  if (!a || a.elapsed < a.activeStart || a.elapsed > a.activeEnd + .065) return;
  const fade = Math.max(0, 1 - Math.max(0, a.elapsed - a.activeEnd) / .065);
  const end = Math.min(a.activeEnd, a.elapsed);
  const start = Math.max(a.activeStart, end - (a.activeEnd - a.activeStart) * .2);
  const angleAt = (time: number) => getSwingAngle(a.angle, time / a.duration,
    a.activeStart / a.duration, a.activeEnd / a.duration, a.arc);
  const radius = (15 + p.equipment.mainHand.visual.length) * PLAYER_ART_SCALE;
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (let band = 0; band < 2; band++) {
    c.strokeStyle = band === 0 ? (p.equipment.mainHand.visual.glow ?? '#bad8ef') : '#f1fcff';
    c.lineWidth = band === 0 ? 3.5 : .8;
    c.globalAlpha = fade * (band === 0 ? .16 : .64);
    c.beginPath();
    for (let i = 0; i <= 10; i++) {
      const angle = angleAt(start + (end - start) * i / 10);
      const sx = x + Math.cos(angle) * radius;
      const sy = y - 20 * PLAYER_ART_SCALE + Math.sin(angle) * radius * .86;
      if (i === 0) c.moveTo(sx, sy); else c.lineTo(sx, sy);
    }
    c.stroke();
  }
  const tip = angleAt(end);
  drawGlow(c, x + Math.cos(tip) * radius,
    y - 20 * PLAYER_ART_SCALE + Math.sin(tip) * radius * .86, 14,
    (p.equipment.mainHand.visual.glow ?? '#bad8ef'), fade * .22);
  c.restore();
}
