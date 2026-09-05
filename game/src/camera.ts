export const MIN_CAMERA_ZOOM = .65;
export const MAX_CAMERA_ZOOM = 1.8;

const WHEEL_LINE_HEIGHT = 16;
const MAX_WHEEL_PIXELS = 300;
const WHEEL_SENSITIVITY = Math.log(1.12) / 100;
const ZOOM_RESPONSE = 12;

/** A bounded target keeps repeated wheel input responsive while the view catches up. */
export class CameraZoom {
  value = 1;
  target = 1;

  wheel(deltaY: number, deltaMode: number, viewportHeight: number): void {
    if (!Number.isFinite(deltaY)) return;
    const unit = deltaMode === 1 ? WHEEL_LINE_HEIGHT : deltaMode === 2 ? viewportHeight : 1;
    if (!Number.isFinite(unit) || unit <= 0) return;
    const pixels = Math.max(-MAX_WHEEL_PIXELS, Math.min(MAX_WHEEL_PIXELS, deltaY * unit));
    this.target = Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM,
      this.target * Math.exp(-pixels * WHEEL_SENSITIVITY)));
  }

  update(dt: number, reducedMotion = false): number {
    if (!Number.isFinite(dt) || dt <= 0) return this.value;
    this.value = reducedMotion ? this.target
      : this.target + (this.value - this.target) * Math.exp(-ZOOM_RESPONSE * dt);
    return this.value;
  }
}

export interface CameraView {
  zoom: number;
  offsetX: number;
  offsetY: number;
  left: number;
  top: number;
  /** Visible extent in world units; HUD and render-buffer dimensions stay unchanged. */
  width: number;
  height: number;
}

/** Camera kick remains in screen pixels, independent of the world magnification. */
export function cameraView(width: number, height: number, cameraX: number, cameraY: number,
  zoom: number, kickX = 0, kickY = 0): CameraView {
  const offsetX = width / 2 - cameraX * zoom + kickX;
  const offsetY = height / 2 - cameraY * zoom + kickY;
  return { zoom, offsetX, offsetY, left: -offsetX / zoom, top: -offsetY / zoom,
    width: width / zoom, height: height / zoom };
}

export function screenToWorld(view: CameraView, x: number, y: number): { x: number; y: number } {
  return { x: (x - view.offsetX) / view.zoom, y: (y - view.offsetY) / view.zoom };
}

export function worldToScreen(view: CameraView, x: number, y: number): { x: number; y: number } {
  return { x: x * view.zoom + view.offsetX, y: y * view.zoom + view.offsetY };
}
