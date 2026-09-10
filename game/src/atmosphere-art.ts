import type { SkyState } from './world-time.ts';
import type { Prop } from './world.ts';
import { hash, randomFromSeed } from './art-primitives.ts';
import type { World } from './world.ts';
import type { CameraView } from './camera.ts';
import { sceneClimate } from './scene-light-style.ts';

/** Anchored water and air, with fixed draw budgets and no simulation or particle state. */
export class AtmosphereArt {
  private mist = new Map<string, HTMLCanvasElement>();
  reset() { this.mist.clear(); }
  private mistStamp(color: string) {
    const cached = this.mist.get(color); if (cached) return cached;
    const image = document.createElement('canvas'); image.width = 256; image.height = 96;
    const c = image.getContext('2d')!, random = randomFromSeed(17319);
    for (let i = 0; i < 10; i++) {
      const x = 48 + random() * 160, y = 32 + random() * 32, radius = 20 + random() * 24;
      const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, color + '75'); gradient.addColorStop(.45, color + '35'); gradient.addColorStop(1, color + '00');
      c.fillStyle = gradient; c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    if (this.mist.size >= 32) this.mist.delete(this.mist.keys().next().value!);
    this.mist.set(color, image); return image;
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
  /** Separate ground and foreground banks: anchored in world space, never a screen veil. */
  drawLayer(c: CanvasRenderingContext2D, world: World, view: CameraView, time: number, reducedMotion: boolean,
    playerX: number, playerY: number, foreground: boolean, enclosed: boolean, indoorBlend: number, sky?: SkyState) {
    if (!enclosed && indoorBlend > .98) return;
    const t = reducedMotion ? 0 : time, cell = enclosed ? 180 : 360, margin = enclosed ? 120 : 420;
    c.save(); c.globalCompositeOperation = 'screen'; let count = 0;
    for (let cy = Math.floor((view.top - margin) / cell); cy <= Math.floor((view.top + view.height + margin) / cell); cy++) {
      for (let cx = Math.floor((view.left - margin) / cell); cx <= Math.floor((view.left + view.width + margin) / cell); cx++) {
        if (count++ >= 96) break;
        const seed = hash(Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ (foreground ? 4717 : 9811));
        const phase = seed / 0x100000000 * Math.PI * 2;
        const anchorX = (cx + .5) * cell, anchorY = (cy + .5) * cell;
        const weights=world.sampleBiome(anchorX,anchorY).weights;
        const style = sceneClimate(weights, enclosed ? 1 : 0);
        const x = anchorX + Math.sin(t * (foreground ? .035 : .06) + phase) * (enclosed ? 14 : 75),
          y = anchorY + Math.cos(t * .045 + phase) * 24;
        if (world.getBuildingAt(x, y)) continue;
        // Keep enclosed mist inside floor space, away from walls and doorways.
        if (enclosed && (foreground || world.blocked(x, y, 65))) continue;
        const distance = Math.hypot(x - playerX, y - playerY);
        const clearance = foreground ? .18 + .82 * Math.min(1, distance / 260) : 1;
        c.globalAlpha = style.fog * (enclosed ? 1 : 1-weights.swamp*.4) * (foreground ? .52 : .85) * clearance * (enclosed ? 1 : (1 - indoorBlend) * (.42 + .58 * (sky?.daylight ?? 1)));
        // Quantize only the cookie tint; biome opacity remains continuously blended.
        const color = style.color.replace(/[0-9a-f]{2}/gi, pair => Math.min(255, Math.round(parseInt(pair, 16) / 16) * 16).toString(16).padStart(2, '0'));
        const width = enclosed ? 150 : foreground ? 690 : 510, height = enclosed ? 65 : foreground ? 170 : 110;
        c.drawImage(this.mistStamp(color), x - width / 2, y - height / 2, width, height);
      }
    }
    c.restore();
  }
}
