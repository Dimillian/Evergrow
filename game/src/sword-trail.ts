import { getSwingAngle, getPlayerSwordTip } from './art.ts';
import { playerPose } from './character-pose.ts';
import type { Attack, Player } from './model.ts';
import { drawGlow } from './lighting.ts';

interface RibbonPoint {
  x: number; y: number; nx: number; ny: number;
  width: number; born: number; stroke: number; color: string;
}
const LIFETIME = .19;
const SAMPLE_STEP = 1 / 120;

/** A world-space ribbon records the moving blade, then tapers and disperses behind it. */
export class SwordTrail {
  private points: RibbonPoint[] = [];
  private time = 0;
  private attack: Attack | null = null;
  private elapsed = 0;
  private lastX = 0;
  private lastY = 0;
  private stroke = 0;

  reset() {
    this.points = []; this.attack = null; this.time = 0; this.elapsed = 0; this.stroke = 0;
  }

  update(player: Player, dt: number, simulationTime: number, interpolationAlpha = 1) {
    if (dt <= 0) return;
    this.time += dt;
    const attack = player.attack;
    const x = player.prevX + (player.x - player.prevX) * interpolationAlpha;
    const y = player.prevY + (player.y - player.prevY) * interpolationAlpha;
    if (this.attack && attack !== this.attack) {
      // Finish any contact samples between the last render and recovery/cancellation.
      this.sample(player, this.attack, this.elapsed, this.attack.elapsed, dt, simulationTime, x, y);
    }
    if (attack !== this.attack) {
      this.attack = attack; this.elapsed = 0; this.stroke++;
    }
    if (attack) {
      this.sample(player, attack, this.elapsed, attack.elapsed, dt, simulationTime, x, y);
      this.elapsed = attack.elapsed;
    }
    this.lastX = x; this.lastY = y;
    this.points = this.points.filter(p => this.time - p.born < LIFETIME);
    if (this.points.length > 96) this.points.splice(0, this.points.length - 96);
  }

  private sample(player: Player, attack: Attack, previous: number, current: number, dt: number, simulationTime: number, x: number, y: number) {
    const from = Math.max(attack.activeStart, previous);
    const to = Math.min(attack.activeEnd, current);
    if (to <= from) return;
    const count = Math.max(1, Math.ceil((to - from) / SAMPLE_STEP));
    const angleAt = (elapsed: number) => getSwingAngle(attack.angle, elapsed / attack.duration,
      attack.activeStart / attack.duration, attack.activeEnd / attack.duration, attack.arc);
    const color = player.equipment.mainHand.visual.glow ?? '#f4bd67';
    for (let i = 0; i <= count; i++) {
      const elapsed = from + (to - from) * i / count;
      const behind = Math.max(0, current - elapsed);
      const position = Math.max(0, Math.min(1, 1 - behind / Math.max(dt, .001)));
      const cx = this.lastX + (x - this.lastX) * position;
      const cy = this.lastY + (y - this.lastY) * position;
      const angle = angleAt(elapsed);
      const speed = Math.abs(angleAt(Math.min(attack.activeEnd, elapsed + .003))
        - angleAt(Math.max(attack.activeStart, elapsed - .003))) / .006;
      const nx = Math.cos(angle), ny = Math.sin(angle);
      const pose = playerPose(player, simulationTime - behind, attack, elapsed);
      pose.gaitPhase = (pose.gaitPhase ?? 0) - Math.hypot(player.vx, player.vy) * behind / 22;
      const tip = getPlayerSwordTip(pose);
      this.points.push({ x: cx + tip.x, y: cy + tip.y,
        nx, ny, width: 3 + Math.min(7, speed * .26), born: this.time - behind,
        stroke: this.stroke, color });
    }
  }

  draw(c: CanvasRenderingContext2D) {
    if (this.points.length < 2) return;
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
    const shaped = this.points.map((p, i) => {
      const age = Math.max(0, (this.time - p.born) / LIFETIME);
      const life = Math.max(0, 1 - age);
      const flutter = Math.sin(age * 7 + i * .62) * age * 1.3;
      return { ...p, life, x: p.x + p.nx * age * 3 - p.ny * flutter,
        y: p.y + p.ny * age * 3 + p.nx * flutter,
        width: p.width * Math.pow(life, .55) };
    });
    for (let i = 1; i < shaped.length; i++) {
      const a = shaped[i - 1], b = shaped[i];
      if (a.stroke !== b.stroke || a.life <= 0 || Math.hypot(a.x - b.x, a.y - b.y) < .04) continue;
      const alpha = Math.pow(Math.min(a.life, b.life), .8);
      c.globalAlpha = alpha * .48; c.fillStyle = b.color;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
      c.lineTo(b.x - b.nx * b.width, b.y - b.ny * b.width);
      c.lineTo(a.x - a.nx * a.width, a.y - a.ny * a.width); c.closePath(); c.fill();
      // A bright metal edge and a softer second filament separate the ribbon's layers.
      c.strokeStyle = '#fff1bf'; c.lineWidth = 1.35; c.globalAlpha = alpha * .88;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      c.strokeStyle = '#d99548'; c.lineWidth = 1; c.globalAlpha = alpha * .48;
      c.beginPath(); c.moveTo(a.x - a.nx * a.width * .68, a.y - a.ny * a.width * .68);
      c.lineTo(b.x - b.nx * b.width * .68, b.y - b.ny * b.width * .68); c.stroke();
      if (i % 5 === 0) {
        c.globalAlpha = 1;
        drawGlow(c, b.x, b.y, 15, b.color, alpha * .2);
      }
    }
    const head = shaped[shaped.length - 1];
    c.globalAlpha = 1;
    drawGlow(c, head.x, head.y, 25, head.color, head.life * .5);
    c.restore();
  }
}
