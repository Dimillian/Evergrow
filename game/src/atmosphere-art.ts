import type { Prop } from './world.ts';
import { hash, randomFromSeed } from './art-primitives.ts';

/** Anchored water and air, with fixed draw budgets and no simulation or particle state. */
export class AtmosphereArt {
  private mist: HTMLCanvasElement | undefined;
  private mistStamp() {
    if (this.mist) return this.mist;
    const image = document.createElement('canvas'); image.width = 240; image.height = 80;
    const c = image.getContext('2d')!, random = randomFromSeed(17319);
    for (let i = 0; i < 12; i++) {
      const x = 30 + random() * 175, y = 27 + random() * 24, radius = 17 + random() * 17;
      const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, '#b3c8bc60'); gradient.addColorStop(.48, '#a6c4bb2b'); gradient.addColorStop(1, '#9bb9b900');
      c.fillStyle = gradient; c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    this.mist = image; return image;
  }
  drawWater(c: CanvasRenderingContext2D, props: readonly Prop[], time: number, reducedMotion: boolean) {
    const t = reducedMotion ? 0 : time;
    c.save(); let count = 0;
    for (const prop of props) {
      if (prop.kind !== 'lilies' || count++ >= 32) continue;
      const phase = hash(prop.seed) / 0x100000000;
      for (let ring = 0; ring < 2; ring++) {
        const life = (t * .18 + phase + ring * .5) % 1;
        c.globalAlpha = Math.sin(life * Math.PI) * .18;
        c.strokeStyle = '#95c1b6'; c.lineWidth = .7;
        c.beginPath(); c.ellipse(prop.x + 3, prop.y - 5, (14 + life * 28) * prop.scale,
          (4 + life * 9) * prop.scale, -.08, Math.PI * .15, Math.PI * 1.65); c.stroke();
      }
    }
    c.restore();
  }
  drawMist(c: CanvasRenderingContext2D, props: readonly Prop[], time: number, reducedMotion: boolean,
    playerX: number, playerY: number) {
    const t = reducedMotion ? 0 : time;
    c.save(); let count = 0;
    for (const prop of props) {
      if (!['willow', 'iceCrystal', 'windTree'].includes(prop.kind) || hash(prop.seed) % 4 !== 0 || count++ >= 12) continue;
      const phase = hash(prop.seed) / 0x100000000 * Math.PI * 2;
      const x = prop.x + Math.sin(t * .13 + phase) * 25, y = prop.y - 12 + Math.cos(t * .16 + phase) * 8;
      // Leave the immediate combat silhouette clear even when a mist bank crosses it.
      const clearance = Math.min(1, Math.hypot(x - playerX, y - playerY) / 110);
      c.globalAlpha = (.13 + Math.sin(t * .27 + phase) * .025) * clearance;
      c.drawImage(this.mistStamp(), x - 125, y - 35, 250, 70);
    }
    c.restore();
  }
}
