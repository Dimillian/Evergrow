export const MIN_CAMERA_ZOOM = .65;
export const MAX_CAMERA_ZOOM = 1.8;

const WHEEL_LINE_HEIGHT = 16;
const MAX_WHEEL_PIXELS = 300;
const WHEEL_SENSITIVITY = Math.log(1.12) / 100;
const ZOOM_RESPONSE = 12;

export const CAMERA_FOLLOW = Object.freeze({ response: 11, lookAheadX: .07, lookAheadY: .05, height: 15 });
const SPAWN_LOOKAHEAD = .1;
// Game advances at most 50 ms before drawing. Include a changed movement/dodge
// direction and the full bounded impact kick; enemy body margins belong elsewhere.
const SPAWN_REACTION_TIME = .05;
const MAX_CAMERA_KICK_PIXELS = 8;

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

export interface CameraBounds { x: number; y: number; width: number; height: number; }
interface CameraSubject { x: number; y: number; vx: number; vy: number; }

export function cameraFollowTarget(subject: CameraSubject): { x: number; y: number } {
  return { x: subject.x + subject.vx * CAMERA_FOLLOW.lookAheadX,
    y: subject.y + subject.vy * CAMERA_FOLLOW.lookAheadY - CAMERA_FOLLOW.height };
}

/** Predict visible geometry without advancing the camera or changing the aim transform. */
export function cameraSpawnExclusion(width: number, height: number,
  cameraX: number, cameraY: number, zoom: number, targetZoom: number,
  lastDisplayed: CameraView, subject: CameraSubject, movementSpeed: number): CameraBounds {
  // Zoom-out may become visible immediately under reduced motion; zoom-in must
  // continue protecting the wider view while its animation catches up.
  const widestZoom = Math.min(zoom, targetZoom);
  const halfWidth = width / widestZoom / 2, halfHeight = height / widestZoom / 2;
  const follow = cameraFollowTarget(subject);
  const neutralY = subject.y - CAMERA_FOLLOW.height;
  const futureX = follow.x + subject.vx * SPAWN_LOOKAHEAD;
  const futureY = follow.y + subject.vy * SPAWN_LOOKAHEAD;
  const speed = Math.max(movementSpeed, Math.hypot(subject.vx, subject.vy));
  const kick = MAX_CAMERA_KICK_PIXELS / widestZoom;
  const marginX = speed * (SPAWN_REACTION_TIME + CAMERA_FOLLOW.lookAheadX) + kick;
  const marginY = speed * (SPAWN_REACTION_TIME + CAMERA_FOLLOW.lookAheadY) + kick;
  // Both ends contain every interpolated camera position. A resize cannot erase
  // the last displayed rectangle until a frame has actually replaced it.
  const left = Math.min(lastDisplayed.left,
    Math.min(cameraX, subject.x, follow.x, futureX) - halfWidth - marginX);
  const top = Math.min(lastDisplayed.top,
    Math.min(cameraY, neutralY, follow.y, futureY) - halfHeight - marginY);
  const right = Math.max(lastDisplayed.left + lastDisplayed.width,
    Math.max(cameraX, subject.x, follow.x, futureX) + halfWidth + marginX);
  const bottom = Math.max(lastDisplayed.top + lastDisplayed.height,
    Math.max(cameraY, neutralY, follow.y, futureY) + halfHeight + marginY);
  return { x: left, y: top, width: right - left, height: bottom - top };
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
