import { hash, polygon } from './art-primitives.ts';
import { ForestLife, type ForestBird } from './forest-life.ts';
import { forestWind } from './forest-wind.ts';
import type { Prop } from './world.ts';

export class ForestLifeArt {
  private lightStamp: HTMLCanvasElement | undefined;
  drawGround(c: CanvasRenderingContext2D, life: ForestLife, props: readonly Prop[], time: number,
    reducedMotion: boolean, view: { left: number; top: number; width: number; height: number }) {
    c.save(); let count = 0;
    for (const prop of props) {
      if (prop.biome !== 'verdant' || !['tree', 'canopy', 'fern', 'flowers', 'stump'].includes(prop.kind)
        || prop.x < view.left - 60 || prop.x > view.left + view.width + 60
        || prop.y < view.top - 60 || prop.y > view.top + view.height + 60 || count++ >= 100) continue;
      const wind = forestWind(prop.x, prop.y, time, reducedMotion);
      for (let i = 0; i < 5; i++) {
        const seed = hash(prop.seed + i * 7919), a = seed / 0x100000000 * Math.PI * 2;
        const x = prop.x + Math.cos(a) * (23 + seed % 29), y = prop.y + Math.sin(a) * (10 + seed % 18);
        const bend = reducedMotion ? 0 : life.bend(x, y);
        c.strokeStyle = i % 3 ? '#577849' : '#769354'; c.lineWidth = .9;
        c.globalAlpha = .58;
        for (let blade = 0; blade < 3; blade++) {
          const height = 5 + (seed + blade * 3) % 8;
          c.beginPath(); c.moveTo(x + blade * 2, y);
          c.quadraticCurveTo(x + blade * 2 + wind.x * 1.5 + bend * 5, y - height * .6,
            x + blade * 2 + wind.x * 3 + bend * 12 + blade - 1, y - height * (1 - Math.abs(bend) * .45)); c.stroke();
        }
      }
      if (prop.kind !== 'tree' && prop.kind !== 'canopy') continue;
      for (let i = 0; i < 3; i++) {
        const a = hash(prop.seed + i * 91) / 0x100000000 * Math.PI * 2;
        const x = prop.x + Math.cos(a) * 38 + wind.x * 6, y = prop.y - 16 + Math.sin(a) * 16;
        c.globalAlpha = .10 + wind.gust * .06;
        c.drawImage(this.stamp(), x - 20, y - 9, 40, 18);
      }
    }
    for (const foot of life.footsteps) {
      c.save(); c.translate(foot.x, foot.y); c.rotate(foot.angle + Math.PI / 2);
      c.globalAlpha = Math.max(0, 1 - foot.age / 3.5) * .23;
      c.fillStyle = '#0b1b14'; c.fillRect(-1.8, -3, 3.6, 6);
      c.restore();
    }
    c.restore();
  }
  drawBird(c: CanvasRenderingContext2D, bird: ForestBird, time: number, reducedMotion: boolean) {
    const flying = bird.state !== 'perched', t = reducedMotion ? 0 : time;
    c.save(); c.globalAlpha *= Math.min(1, bird.age * 1.5);
    c.fillStyle = '#06130b'; c.globalAlpha *= .28;
    c.beginPath(); c.ellipse(bird.x, bird.y, Math.max(2, 6 - bird.z * .035), 2, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = Math.min(1, bird.age * 1.5); c.translate(bird.x, bird.y - bird.z);
    const facing = flying ? (bird.dx < 0 ? -1 : 1) : (Math.sin(t * .7 + bird.phase) > -.25 ? 1 : -1);
    c.scale(facing, 1);
    polygon(c, [[-6, 1], [-3, -3], [2, -4], [5, -2], [4, 2], [-2, 3]], '#182329');
    polygon(c, [[-3, 0], [-9, 3], [-5, 4], [0, 2]], '#101b22');
    polygon(c, [[1, -4], [2, -7], [5, -7], [7, -4], [4, -2]], '#24313a');
    polygon(c, [[5, -5], [10, -3], [6, -2]], '#879296');
    c.fillStyle = '#bfcbba'; c.fillRect(4.5, -5.6, .9, .9);
    if (flying) {
      const flap = Math.sin(t * 23 + bird.phase), tip = -5 - flap * 10;
      polygon(c, [[-3, -1], [-11, tip], [-16, tip + 2], [-7, 2], [2, 1]], '#33434a');
      polygon(c, [[0, 0], [5, tip * .8], [10, tip * .8 + 1], [4, 2]], '#17242c');
    } else {
      c.strokeStyle = '#938976'; c.lineWidth = .7;
      c.beginPath(); c.moveTo(-1, 2); c.lineTo(-2, 5); c.lineTo(-4, 5); c.moveTo(2, 2); c.lineTo(3, 5); c.lineTo(5, 5); c.stroke();
      polygon(c, [[-4, -1], [2, -2], [1, 1], [-3, 2]], '#34424a');
    }
    c.restore();
  }
  drawAir(c: CanvasRenderingContext2D, life: ForestLife, time: number, reducedMotion: boolean) {
    const t = reducedMotion ? 0 : time;
    c.save();
    for (const leaf of life.leaves) {
      c.save(); c.globalAlpha = Math.min(1, leaf.age * 4, (leaf.life - leaf.age) * 1.4) * .8;
      c.translate(leaf.x + Math.sin(t * 2 + leaf.phase) * (leaf.z > 0 ? 4 : 0), leaf.y - leaf.z);
      c.rotate(Math.sin(t * 2.7 + leaf.phase) * 1.5);
      const width = .5 + Math.abs(Math.cos(t * 5 + leaf.phase)) * 2.7;
      polygon(c, [[-width, 0], [-.8, -1.4], [width, -.4], [.5, 1.5]], leaf.color); c.restore();
    }
    for (const b of life.butterflies) {
      const rest = Math.sin(t * .38 + b.phase) > .65 && b.alarm < .1;
      const lift = rest ? 0 : 5 + Math.sin(t * 3 + b.phase) * 3 + b.alarm * 14;
      c.save(); c.globalAlpha = Math.min(1, b.age) * .85; c.translate(b.x, b.y - lift);
      const wing = rest ? 1.4 : .5 + Math.abs(Math.sin(t * 17 + b.phase)) * 3.6;
      c.fillStyle = '#d6c586';
      c.beginPath(); c.ellipse(-wing * .6, 0, wing, 2.6, -.45, 0, Math.PI * 2);
      c.ellipse(wing * .6, 0, wing, 2.6, .45, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#544e3b'; c.fillRect(-.5, -2, 1, 4); c.restore();
    }
    c.restore();
  }
  drawLight(c: CanvasRenderingContext2D, props: readonly Prop[], time: number, reducedMotion: boolean,
    playerX: number, playerY: number) {
    c.save(); let count = 0;
    for (const prop of props) {
      if (prop.biome !== 'verdant' || prop.kind !== 'canopy' || hash(prop.seed) % 3 !== 0 || count++ >= 5) continue;
      const wind = forestWind(prop.x, prop.y, time, reducedMotion), x = prop.x + 30 + wind.x * 7, y = prop.y - 80;
      const clearance = Math.min(1, Math.hypot(x + 25 - playerX, y + 60 - playerY) / 100);
      const gradient = c.createLinearGradient(x, y - 90, x + 70, y + 100);
      gradient.addColorStop(0, '#d9e6a200'); gradient.addColorStop(.3, '#d9e6a21c'); gradient.addColorStop(1, '#d9e6a200');
      c.globalAlpha = (.28 + wind.gust * .24) * clearance; c.fillStyle = gradient;
      c.beginPath(); c.moveTo(x - 15, y - 90); c.lineTo(x + 8, y - 90); c.lineTo(x + 90, y + 110); c.lineTo(x + 28, y + 110); c.fill();
    }
    c.restore();
  }
  private stamp() {
    if (this.lightStamp) return this.lightStamp;
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 32;
    const c = canvas.getContext('2d')!;
    c.scale(1, .5); const g = c.createRadialGradient(32, 32, 1, 32, 32, 30);
    g.addColorStop(0, '#dece87'); g.addColorStop(.45, '#c3c87780'); g.addColorStop(1, '#c3c87700');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64); this.lightStamp = canvas; return canvas;
  }
}
