import { ENEMY_BODY_BOUNDS } from './enemy-body.ts';
import type { EnemyKind } from './model.ts';

interface OutlineSurface {
  sprite: HTMLCanvasElement; mask: HTMLCanvasElement; composite: HTMLCanvasElement;
  art: CanvasRenderingContext2D; tint: CanvasRenderingContext2D; halo: CanvasRenderingContext2D;
  x: number; y: number; width: number; height: number; density: number;
}

/** Upward-rounded density retains at least one source pixel per displayed pixel,
 * up to the existing 2x art ceiling. Quantization avoids allocations during zoom. */
export function outlineDensity(scale: number): number {
  return Math.max(1, Math.min(2, Math.ceil(scale * 2) / 2));
}

/** One bounded surface per body/density, shared by every actor of that kind. */
export class EnemyOutlineArt {
  private surfaces = new Map<string, OutlineSurface>();
  reset() { this.surfaces.clear(); }
  private surface(kind: EnemyKind, density: number): OutlineSurface {
    const key = `${kind}:${density}`, cached = this.surfaces.get(key);
    if (cached) return cached;
    // Held weapons, recoil and the glow remain inside the authored padded surface.
    const body = ENEMY_BODY_BOUNDS[kind], x = -Math.ceil(body.radiusX + 52), y = Math.floor(body.top - 36);
    const width = -x * 2, height = Math.ceil(body.bottom + 36 - y);
    const sprite = document.createElement('canvas'), mask = document.createElement('canvas'), composite = document.createElement('canvas');
    for (const canvas of [sprite, mask, composite]) {
      canvas.width = Math.ceil(width * density); canvas.height = Math.ceil(height * density);
    }
    const result = { sprite, mask, composite, art: sprite.getContext('2d')!, tint: mask.getContext('2d')!,
      halo: composite.getContext('2d')!, x, y, width, height, density };
    this.surfaces.set(key, result); return result;
  }
  draw(c: CanvasRenderingContext2D, kind: EnemyKind, color: string, paint: (target: CanvasRenderingContext2D) => void): void {
    const matrix = c.getTransform(), scale = Math.max(.1, Math.hypot(matrix.a, matrix.b));
    const { art: a, tint: m, halo: h, sprite, mask, composite, x, y, width, height, density } = this.surface(kind, outlineDensity(scale));
    a.clearRect(0, 0, sprite.width, sprite.height);
    a.save(); a.scale(density, density); a.translate(-x, -y); paint(a); a.restore();
    m.clearRect(0, 0, mask.width, mask.height); m.drawImage(sprite, 0, 0);
    m.globalCompositeOperation = 'source-in'; m.fillStyle = color; m.fillRect(0, 0, mask.width, mask.height);
    m.globalCompositeOperation = 'source-over';
    // Compose the same tint, four rim samples and soft glow on the small surface.
    // The world canvas receives one image; per-enemy blur stays on this small surface.
    h.clearRect(0, 0, composite.width, composite.height);
    h.save(); h.globalAlpha = .75; h.shadowColor = color; h.shadowBlur = 8 * density / scale;
    h.drawImage(mask, 0, 0); h.shadowBlur = 0; h.globalAlpha *= .65;
    for (const [dx, dy] of [[-.7, 0], [.7, 0], [0, -.7], [0, .7]]) h.drawImage(mask, dx * density, dy * density);
    h.restore(); h.drawImage(sprite, 0, 0);
    c.drawImage(composite, x, y, width, height);
  }
}
