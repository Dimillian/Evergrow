import { PROJECTILE_HEIGHT } from './ranged-aim.ts';
import { SKILL_CAST_MOTION } from './combat-content.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { getSwingAngle, getPlayerSwordTip } from './art.ts';
import { playerPose } from './character-pose.ts';
import { drawGlow } from './lighting.ts';
import type { PointLight } from './lighting.ts';
import type { CombatEvent } from './model.ts';
import type { Simulation } from './simulation.ts';
import { text } from './font.ts';
import { SwordTrail } from './sword-trail.ts';
import { projectileStyle, PROJECTILE_COLORS } from './projectile-art.ts';
import { SkillEffects } from './skill-effects.ts';

interface Spark {
  x: number; y: number; vx: number; vy: number;
  z: number; vz: number; curl: number;
  life: number; max: number; size: number; color: string; luminous: boolean;
}
interface Flash { x: number; y: number; life: number; max: number; radius: number; color: string; ring: boolean; }
interface Impact { x: number; y: number; angle: number; life: number; max: number; color: string; hurt: boolean; lethal: boolean; }
interface Popup { x: number; y: number; vx: number; vy: number; life: number; max: number; value: string; color: string; size: number; }
const GOLD = '#ffbd63', FIRE = '#ff643b', MINT = '#54e8b8', BLUE = '#64baff';

/** Effects never drive gameplay. All collections and continuous emitters are bounded. */
export class CombatEffects {
  private sparks: Spark[] = [];
  private flashes: Flash[] = [];
  private impacts: Impact[] = [];
  private popups: Popup[] = [];
  private emitterTime = 0;
  private sword = new SwordTrail();
  private skillEffects = new SkillEffects();

  reset() {
    this.sparks = []; this.flashes = []; this.impacts = []; this.popups = [];
    this.emitterTime = 0; this.sword.reset(); this.skillEffects.reset();
  }

  private spark(x: number, y: number, angle: number, color: string, strength = 1, airborne = true, luminous = true) {
    const speed = (40 + Math.random() * 170) * strength;
    const life = .2 + Math.random() * .48;
    this.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      z: airborne ? 15 : 0, vz: airborne ? 25 + Math.random() * 95 : 0,
      curl: (Math.random() - .5) * (luminous ? 5 : 1.2), life, max: life,
      size: luminous ? .8 + Math.random() * 1.7 : 1.6 + Math.random() * 2, color, luminous });
  }

  handleEvents(events: CombatEvent[]) {
    for (const event of events) {
      this.skillEffects.handle(event);
      const enemyKind = 'enemyKind' in event ? event.enemyKind : undefined;
      const heavy = 'heavy' in event && event.heavy;
      const eventAngle = 'angle' in event ? event.angle : 0;
      const enemyCast = event.type === 'cast' && event.enemyKind;
      const contact = event.type === 'hit' || event.type === 'hurt' || event.type === 'kill';
      const color = event.color ?? (event.style ? PROJECTILE_COLORS[event.style] : undefined) ?? (event.type === 'hurt' ? '#ff5e4e' : event.type === 'heal' || enemyCast ? MINT
        : event.type === 'dodge' ? BLUE : event.type === 'cast' ? FIRE : GOLD);
      const count = event.type === 'blast' ? 46 : event.type === 'block' ? 22 : event.type === 'hit' ? 30 : event.type === 'kill' ? 16
        : event.type === 'hurt' ? 32 : event.type === 'cast' ? 18 : event.type === 'heal' ? 30
        : event.type === 'level' ? 50 : event.type === 'loot' ? 8 : event.type === 'pickup' ? 10 : event.type === 'dodge' ? 14 : 0;
      const bodyColor = event.type === 'hurt' ? '#b64143' : enemyKind === 'wisp' ? '#b1e5d6'
        : enemyKind === 'caster' ? '#809b8b' : enemyKind === 'brute' ? '#b6a184'
          : enemyKind === 'hound' || enemyKind === 'stalker' ? '#cec6a0' : '#788b69';
      for (let i = 0; i < count; i++) {
        const radial = ['kill', 'heal', 'pickup', 'level', 'blast'].includes(event.type) || event.skill === 'iceNova';
        const angle = radial ? Math.random() * Math.PI * 2 : eventAngle + (Math.random() - .5) * 2.8;
        const debris = contact && (event.type === 'kill' || i % 3 === 0) && enemyKind !== 'wisp';
        this.spark(event.x, event.y, angle, debris ? bodyColor : i % 4 === 0 ? '#fff7db' : color,
          contact ? 1.2 : 1, true, !debris);
      }
      const contactY = event.y - (event.type === 'hurt' ? 24 : enemyKind === 'brute' ? 25 : 18);
      if (contact) this.impacts.push({ x: event.x, y: contactY, angle: eventAngle,
        life: event.type === 'kill' ? .3 : .22, max: event.type === 'kill' ? .3 : .22,
        color, hurt: event.type === 'hurt', lethal: event.type === 'kill' });
      if (count > 5) {
        const max = event.type === 'heal' ? .55 : event.type === 'kill' ? .16 : .22;
        this.flashes.push({ x: event.x, y: contact ? contactY : event.y - 10, life: max, max,
          radius: event.type === 'kill' ? 62 : heavy ? 145 : contact ? 118 : event.type === 'loot' || event.type === 'pickup' ? 35 : 90, color,
          ring: event.type === 'heal' || event.type === 'level' || event.skill === 'iceNova' });
      }
      if (event.type === 'hit' && event.value) this.popups.push({ x: event.x + (Math.random() - .5) * 10,
        y: event.y - (enemyKind === 'brute' ? 54 : 44), vx: (Math.random() - .5) * 22, vy: -47,
        life: .85, max: .85, value: String(Math.round(event.value)), color: heavy ? '#ffd177' : '#fff0c8', size: heavy ? 2.5 : 2 });
      if (event.type === 'hurt' || event.type === 'heal') this.popups.push({ x: event.x, y: event.y - 61,
        vx: Math.cos(eventAngle) * 14, vy: -55, life: .95, max: .95,
        value: (event.type === 'hurt' ? '-' : '+') + Math.round(event.value),
        color: event.type === 'hurt' ? '#ff9075' : '#83ffbb', size: event.type === 'hurt' ? 2.5 : 2 });
      if (event.type === 'block') this.popups.push({ x: event.x, y: event.y - 58, vx: 0, vy: -25,
        life: .65, max: .65, value: 'BLOCK', color: '#b4e4ee', size: 1.7 });
      // Large event batches must not allocate their entire particle history
      // before enforcing the cap. Keep the same newest effects after each event.
      this.trim();
    }
  }

  private trim() {
    if (this.sparks.length > 650) this.sparks.splice(0, this.sparks.length - 650);
    if (this.flashes.length > 22) this.flashes.splice(0, this.flashes.length - 22);
    if (this.impacts.length > 24) this.impacts.splice(0, this.impacts.length - 24);
    if (this.popups.length > 35) this.popups.splice(0, this.popups.length - 35);
  }

  update(sim: Simulation, dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.sword.update(sim.player, dt, sim.time, sim.interpolationAlpha);
    this.skillEffects.update(dt);
    for (const spark of this.sparks) {
      spark.life -= dt;
      const angle = spark.curl * dt, cos = Math.cos(angle), sin = Math.sin(angle);
      const vx = spark.vx * cos - spark.vy * sin;
      spark.vy = (spark.vx * sin + spark.vy * cos) * Math.exp(-dt * 1.7);
      spark.vx = vx * Math.exp(-dt * 1.7);
      spark.x += spark.vx * dt; spark.y += spark.vy * dt;
      spark.z = Math.max(0, spark.z + spark.vz * dt); spark.vz -= dt * 190;
    }
    for (const flash of this.flashes) flash.life -= dt;
    for (const impact of this.impacts) impact.life -= dt;
    for (const popup of this.popups) {
      popup.life -= dt; popup.x += popup.vx * dt; popup.y += popup.vy * dt;
      popup.vx *= Math.exp(-dt * 2.5); popup.vy = Math.min(-17, popup.vy + dt * 60);
    }
    this.sparks = this.sparks.filter(s => s.life > 0);
    this.flashes = this.flashes.filter(f => f.life > 0);
    this.impacts = this.impacts.filter(i => i.life > 0);
    this.popups = this.popups.filter(p => p.life > 0);
    // Let the final impact disperse behind the death menu without emitting forever
    // from projectiles whose gameplay state has already stopped.
    if (sim.player.dead) return;
    // Expire existing visuals using real elapsed time, but do not replay a long
    // backlog of continuous emission after a stalled or suspended frame.
    this.emitterTime += Math.min(dt, .05);
    while (this.emitterTime >= .016) {
      this.emitterTime -= .016;
      const p = sim.player, attack = p.attack;
      if (attack?.kind === 'melee' && attack.weapon.visual.kind !== 'unarmed' && attack.elapsed >= attack.activeStart && attack.elapsed <= attack.activeEnd) {
        const angle = getSwingAngle(attack.angle, attack.elapsed / attack.duration,
          attack.activeStart / attack.duration, attack.activeEnd / attack.duration, attack.arc);
        const tip = getPlayerSwordTip(playerPose(p, sim.time));
        const x = p.prevX + (p.x - p.prevX) * sim.interpolationAlpha + tip.x;
        const y = p.prevY + (p.y - p.prevY) * sim.interpolationAlpha + tip.y;
        for (let i = 0; i < 2; i++) this.spark(x, y, angle + 1.3,
          i === 0 ? '#fff0d4' : (attack.weapon.visual.glow ?? GOLD), .5, false);
      }
      for (const shot of sim.projectiles.slice(0, 32)) {
        const style = projectileStyle(shot);
        if (style === 'arrow') continue;
        const color = PROJECTILE_COLORS[style];
        for (let i = 0; i < (style === 'fire' ? 2 : 1); i++) {
          this.spark(shot.x, shot.y - PROJECTILE_HEIGHT, shot.angle + Math.PI + (Math.random() - .5) * .7,
            i ? '#ffd674' : color, style === 'fire' ? .45 : .22, false);
        }
      }
      if (p.equipment.mainHand.family === 'staff' && p.castTime > (p.castDuration * SKILL_CAST_MOTION.releaseRemainingFraction)) {
        const angle = sim.time * 22, tip = getPlayerSwordTip(playerPose(p, sim.time));
        this.spark(p.x + tip.x + Math.cos(angle) * 8,
          p.y + tip.y + Math.sin(angle) * 8, angle + Math.PI / 2, p.activeSkill ? SKILL_DEFINITIONS[p.activeSkill].color : p.equipment.mainHand.visual.glow ?? GOLD, .25, false);
      }
    }
    this.trim();
  }

  getLights(): PointLight[] {
    return [...this.flashes.slice(-7).map(f => ({ x: f.x, y: f.y, radius: f.radius,
      power: Math.pow(f.life / f.max, .75), color: f.color })), ...this.skillEffects.getLights()].slice(-7);
  }

  drawSword(c: CanvasRenderingContext2D) { this.sword.draw(c); }

  draw(c: CanvasRenderingContext2D) {
    c.save();
    for (const flash of this.flashes) {
      c.globalAlpha = 1;
      const t = flash.life / flash.max;
      drawGlow(c, flash.x, flash.y, flash.radius * .5, flash.color, t * .52);
      if (flash.ring) {
        c.globalAlpha = t * .65;
        c.strokeStyle = flash.color; c.lineWidth = 1 + t * 2;
        c.beginPath(); c.ellipse(flash.x, flash.y + 14, 8 + (1 - t) * 47, 4 + (1 - t) * 24, 0, 0, Math.PI * 2); c.stroke();
      }
    }
    this.skillEffects.draw(c);
    for (const impact of this.impacts) this.drawImpact(c, impact);
    for (const spark of this.sparks) {
      const t = Math.min(1, spark.life / spark.max * 1.8), y = spark.y - spark.z;
      c.globalCompositeOperation = spark.luminous ? 'lighter' : 'source-over';
      c.globalAlpha = t;
      c.strokeStyle = spark.color; c.lineWidth = spark.size * .75;
      c.beginPath(); c.moveTo(spark.x - spark.vx * .038, y - (spark.vy - spark.vz) * .026);
      c.lineTo(spark.x, y); c.stroke();
      c.fillStyle = spark.luminous && spark.life > spark.max * .65 ? '#fff0c9' : spark.color;
      if (spark.luminous) c.fillRect(spark.x - spark.size / 2, y - spark.size / 2, spark.size, spark.size);
      else {
        const size = spark.size, turn = Math.sin((spark.max - spark.life) * 15 + spark.curl);
        c.beginPath(); c.moveTo(spark.x - size, y); c.lineTo(spark.x + turn * size, y - size * .6);
        c.lineTo(spark.x + size * .7, y + size * .2); c.lineTo(spark.x - size * .3, y + size * .5); c.closePath(); c.fill();
      }
      if (spark.luminous && spark.size > 1.7) drawGlow(c, spark.x, y, 8, spark.color, t * .4);
    }
    c.restore();
  }

  private drawImpact(c: CanvasRenderingContext2D, impact: Impact) {
    const t = Math.max(0, impact.life / impact.max), elapsed = 1 - t;
    c.save(); c.translate(impact.x, impact.y); c.rotate(impact.angle);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = Math.pow(t, 1.5);
    const length = (impact.lethal ? 30 : 23) * Math.sin(Math.min(1, elapsed * 2 + .25) * Math.PI / 2);
    const waist = 3.7 * t;
    c.fillStyle = elapsed < .3 ? '#fff8da' : impact.color;
    // The contact has a hard, brief center, followed by an expanding broken star.
    c.beginPath(); c.moveTo(-length * .7, 0); c.lineTo(-waist, -waist);
    c.lineTo(0, -length * .65); c.lineTo(waist, -waist);
    c.lineTo(length, 0); c.lineTo(waist, waist);
    c.lineTo(0, length * .65); c.lineTo(-waist, waist); c.closePath(); c.fill();
    c.rotate(impact.hurt ? -.6 : .65);
    c.strokeStyle = impact.color; c.lineWidth = 1.3 * t;
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + elapsed * .35, r = 11 + elapsed * (impact.hurt ? 29 : 20);
      c.beginPath(); c.ellipse(0, 0, r, r * .7, 0, a, a + .6); c.stroke();
    }
    c.restore();
  }

  drawNumbers(c: CanvasRenderingContext2D, project: (x: number, y: number) => { x: number; y: number } = (x, y) => ({ x, y })) {
    c.save();
    for (const popup of this.popups) {
      const elapsed = popup.max - popup.life;
      const pop = 1 + .35 * Math.exp(-elapsed * 22);
      const size = popup.size * pop;
      const { x, y } = project(popup.x, popup.y);
      c.globalAlpha = Math.min(1, popup.life / .2);
      text(c, popup.value, x - 1, y, size, '#04070b', 'center');
      text(c, popup.value, x + 1, y + 1, size, '#04070b', 'center');
      text(c, popup.value, x, y, size, popup.color, 'center');
    }
    c.restore();
  }
}
