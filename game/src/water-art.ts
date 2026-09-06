import type { WaterSimulation } from './water-simulation.ts';
import type { PointLight } from './lighting.ts';
import type { CharacterPose, Sprite } from './art-types.ts';
import { drawHumanoid } from './art.ts';
import { WaterShader } from './water-shader.ts';

/** Shared reflected silhouettes, GPU water optics and a quiet Canvas fallback. */
export class WaterArt {
  private shader = new WaterShader();
  private surface = document.createElement('canvas');
  private mask = document.createElement('canvas');
  private reflections = document.createElement('canvas');
  private stamp = document.createElement('canvas');
  private staticReflections = document.createElement('canvas');
  private propStamps: Array<{ sprite: Sprite; scale: number; image: HTMLCanvasElement; id: number }> = [];
  private propDraws: Array<{ image: HTMLCanvasElement; id: number; x: number; y: number }> = [];
  private staticKey = '';
  private stampSerial = 0;
  private image: ImageData | undefined;
  private maskImage: ImageData | undefined;
  private active = false;
  private view = { left: 0, top: 0, width: 1, height: 1 };
  reset() { this.shader.reset(); this.active = false; this.propStamps.length = 0; this.propDraws.length = 0; this.staticKey = ''; }
  begin(f: WaterSimulation, view: { left: number; top: number; width: number; height: number }) {
    this.view = view; this.propDraws.length = 0;
    this.active = Number.isFinite(f.left) && f.hasWater;
    if (!this.active) return;
    const width = Math.min(1024, f.columns * f.cell), height = Math.round(width * f.rows / f.columns);
    if (this.reflections.width !== width || this.reflections.height !== height) { this.reflections.width = width; this.reflections.height = height; }
    const c = this.reflections.getContext('2d')!; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, width, height);
    const scale = width / (f.columns * f.cell); c.setTransform(scale, 0, 0, scale, -f.left * scale, -f.top * scale);
  }
  private reflect(f: WaterSimulation, x: number, y: number, draw: (c: CanvasRenderingContext2D) => void, length: number) {
    if (!this.active || Math.max(f.wetAt(x, y + 20), f.wetAt(x, y + 70)) < .05) return;
    if (this.stamp.width !== 340) { this.stamp.width = 340; this.stamp.height = 220; }
    const c = this.stamp.getContext('2d')!; c.clearRect(0, 0, 340, 220);
    c.save(); c.translate(170, 0); c.scale(1, -.62); c.globalAlpha = .55; draw(c); c.restore();
    c.save(); c.globalCompositeOperation = 'destination-in';
    const fade = c.createLinearGradient(0, 0, 0, length); fade.addColorStop(0, '#ffffff'); fade.addColorStop(1, '#ffffff00');
    c.fillStyle = fade; c.fillRect(0, 0, 340, 220); c.restore();
    this.reflections.getContext('2d')!.drawImage(this.stamp, x - 170, y);
  }
  drawReflection(_c: CanvasRenderingContext2D, f: WaterSimulation, x: number, y: number, pose: CharacterPose, _reduced: boolean) {
    if (this.active) {
      const key = `${f.left}:${f.top}:${f.cell}:` + this.propDraws.map(p => `${p.id}:${p.x}:${p.y}`).join(';');
      const width = this.reflections.width, height = this.reflections.height, scale = width / (f.columns * f.cell);
      const c = this.staticReflections.getContext('2d')!;
      if (key !== this.staticKey || this.staticReflections.width !== width || this.staticReflections.height !== height) {
        this.staticReflections.width = width; this.staticReflections.height = height;
        c.setTransform(scale, 0, 0, scale, -f.left * scale, -f.top * scale);
        for (const p of this.propDraws) c.drawImage(p.image, p.x - 170, p.y);
        this.staticKey = key;
      }
      const r = this.reflections.getContext('2d')!; r.save(); r.setTransform(1, 0, 0, 1, 0, 0); r.drawImage(this.staticReflections, 0, 0); r.restore();
    }
    this.reflect(f, x, y, r => drawHumanoid(r, pose), 95);
  }
  drawPropReflection(_c: CanvasRenderingContext2D, f: WaterSimulation, x: number, y: number, sprite: Sprite, scale: number, _reduced: boolean) {
    if (!this.active || Math.max(f.wetAt(x, y + 20), f.wetAt(x, y + 70)) < .05) return;
    let cached = this.propStamps.find(p => p.sprite === sprite && p.scale === scale);
    if (!cached) {
      const image = document.createElement('canvas'); image.width = 340; image.height = 220;
      const r = image.getContext('2d')!; r.save(); r.translate(170, 0); r.scale(scale, -.62 * scale); r.globalAlpha = .55;
      r.drawImage(sprite.image, -sprite.anchorX, -sprite.anchorY, sprite.width, sprite.height);
      for (const layer of sprite.foliage ?? []) r.drawImage(layer, -sprite.anchorX, -sprite.anchorY, sprite.width, sprite.height);
      r.restore(); r.globalCompositeOperation = 'destination-in';
      const fade = r.createLinearGradient(0, 0, 0, 150); fade.addColorStop(0, '#ffffff'); fade.addColorStop(1, '#ffffff00');
      r.fillStyle = fade; r.fillRect(0, 0, 340, 220);
      cached = { sprite, scale, image, id: ++this.stampSerial };
      if (this.propStamps.length >= 24) this.propStamps.shift(); this.propStamps.push(cached);
    }
    this.propDraws.push({ ...cached, x, y });
  }

  drawSurface(c: CanvasRenderingContext2D, f: WaterSimulation, lights: readonly PointLight[], reduced: boolean, age = 0) {
    if (!this.active) return;
    if (this.shader.draw(c, f, this.reflections, this.view, lights, reduced, age)) return;
    this.drawFallback(c, f);
  }
  private drawFallback(c: CanvasRenderingContext2D, f: WaterSimulation) {
    const { columns: n, rows, cell, left, top, wet, height: h } = f;
    if (this.surface.width !== n || this.surface.height !== rows) {
      this.surface.width = this.mask.width = n; this.surface.height = this.mask.height = rows;
      this.image = this.surface.getContext('2d')!.createImageData(n, rows); this.maskImage = this.mask.getContext('2d')!.createImageData(n, rows);
    }
    const pixels = this.image!.data, mask = this.maskImage!.data;
    for (let y = 0; y < rows; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x, p = i * 4;
      const nx = h[i + (x < n - 1 ? 1 : 0)] - h[i - (x > 0 ? 1 : 0)];
      const ny = h[i + (y < rows - 1 ? n : 0)] - h[i - (y > 0 ? n : 0)];
      const crest = Math.max(0, nx - ny);
      pixels[p] = 28 + crest * 90; pixels[p + 1] = 66 + crest * 135; pixels[p + 2] = 79 + crest * 145; pixels[p + 3] = wet[i] * 130;
      mask[p] = mask[p + 1] = mask[p + 2] = 255; mask[p + 3] = wet[i] * 255;
    }
    this.surface.getContext('2d')!.putImageData(this.image!, 0, 0); this.mask.getContext('2d')!.putImageData(this.maskImage!, 0, 0);
    c.drawImage(this.surface, left, top, n * cell, rows * cell);
    const r = this.reflections.getContext('2d')!; r.save(); r.globalCompositeOperation = 'destination-in'; r.drawImage(this.mask, left, top, n * cell, rows * cell); r.restore();
    c.drawImage(this.reflections, left, top, n * cell, rows * cell);
  }
  drawFeet(c: CanvasRenderingContext2D, f: WaterSimulation, x: number, y: number, radius: number) {
    const wet = f.wetAt(x, y); if (wet < .5) return;
    c.save(); c.globalAlpha = wet * .72;
    const tint = c.createLinearGradient(0, y - 7, 0, y + 2);
    tint.addColorStop(0, '#37697600'); tint.addColorStop(.65, '#376976bb'); tint.addColorStop(1, '#41747bdd');
    c.fillStyle = tint; c.beginPath(); c.ellipse(x, y - 2, radius, 6, 0, 0, Math.PI * 2); c.fill(); c.restore();
  }
  drawSplashes(c: CanvasRenderingContext2D, f: WaterSimulation) {
    c.save();
    for (const p of f.droplets) {
      c.globalAlpha = Math.max(0, 1 - p.age / .8);
      // Small shaded droplets; elongated velocity strokes were too noisy during travel.
      const size = .9 + Math.min(1.1, Math.abs(p.vz) / 90);
      c.fillStyle = '#547f89'; c.beginPath(); c.ellipse(p.x, p.y - p.z, size, size * 1.35, -.25, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d9eee0'; c.beginPath(); c.ellipse(p.x - size * .25, p.y - p.z - size * .35, size * .38, size * .48, -.25, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
}
