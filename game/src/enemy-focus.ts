import { screenToWorld, type CameraView } from './camera.ts';
import type { CombatEvent, Enemy, EnemyKind } from './model.ts';

const HOVER_GRACE = .25;
const HIT_RETENTION = 1.5;
export const ENEMY_BODY_BOUNDS: Record<EnemyKind, { radiusX: number; top: number; bottom: number }> = {
  stalker: { radiusX: 14, top: -43, bottom: 3 },
  brute: { radiusX: 22, top: -54, bottom: 4 },
  caster: { radiusX: 15, top: -46, bottom: 3 },
  hound: { radiusX: 25, top: -38, bottom: 5 },
  archer: { radiusX: 22, top: -48, bottom: 3 },
  wisp: { radiusX: 18, top: -49, bottom: -4 },
};

interface VisibleEnemy { enemy: Enemy; x: number; y: number; centerY: number; radiusX: number; radiusY: number; }

/** Hover and combat memory for a health plate; never selects a gameplay attack target. */
export class EnemyFocus {
  hoveredId: number | null = null;
  targetId: number | null = null;
  private retainedHoverId: number | null = null;
  private recentHitId: number | null = null;
  private hoverRemaining = 0;
  private hitRemaining = 0;
  private pendingHits = new Set<number>();
  private killedIds = new Set<number>();

  reset(): void {
    this.hoveredId = this.targetId = this.retainedHoverId = this.recentHitId = null;
    this.hoverRemaining = this.hitRemaining = 0;
    this.pendingHits.clear(); this.killedIds.clear();
  }

  /** Resolve a batch against visible, living enemies on the next rendered frame. */
  noteHits(events: readonly CombatEvent[]): void {
    for (const event of events) {
      if (event.type !== 'hit' && event.type !== 'kill') continue;
      const id = event.targetId;
      if (!Number.isFinite(id)) continue;
      if (event.type === 'kill' || (event.type === 'hit' && event.remainingHp <= 0)) {
        this.killedIds.add(id); this.pendingHits.delete(id);
        if (this.hoveredId === id) this.hoveredId = null;
        if (this.targetId === id) this.targetId = null;
        if (this.retainedHoverId === id) { this.retainedHoverId = null; this.hoverRemaining = 0; }
        if (this.recentHitId === id) { this.recentHitId = null; this.hitRemaining = 0; }
      } else if (event.type === 'hit' && event.value > 0 && !this.killedIds.has(id)) {
        this.pendingHits.add(id);
      }
    }
  }

  update(enemies: readonly Enemy[], view: CameraView, pointer: { x: number; y: number } | null,
    alpha: number, dt: number, enabled = true): Enemy | null {
    if (!enabled) { this.reset(); return null; }
    const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    const interpolation = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
    this.hoverRemaining = Math.max(0, this.hoverRemaining - elapsed);
    this.hitRemaining = Math.max(0, this.hitRemaining - elapsed);

    // Kill records only need to survive while the matching corpse is still present.
    for (const id of this.killedIds) if (!enemies.some(enemy => enemy.id === id)) this.killedIds.delete(id);
    const visible = new Map<number, VisibleEnemy>();
    for (const enemy of enemies) {
      if (enemy.state === 'dead' || enemy.hp <= 0 || this.killedIds.has(enemy.id)) continue;
      const body = ENEMY_BODY_BOUNDS[enemy.kind];
      const x = enemy.prevX + (enemy.x - enemy.prevX) * interpolation;
      const y = enemy.prevY + (enemy.y - enemy.prevY) * interpolation;
      const centerY = y + (body.top + body.bottom) / 2;
      const radiusY = (body.bottom - body.top) / 2;
      // Test the actual body ellipse against the viewport, including heads above its edge.
      const closestX = Math.max(view.left, Math.min(view.left + view.width, x));
      const closestY = Math.max(view.top, Math.min(view.top + view.height, centerY));
      if (((closestX - x) / body.radiusX) ** 2 + ((closestY - centerY) / radiusY) ** 2 > 1) continue;
      visible.set(enemy.id, { enemy, x, y, centerY, radiusX: body.radiusX, radiusY });
    }

    const insideCanvas = pointer && pointer.x >= 0 && pointer.y >= 0
      && pointer.x <= view.width * view.zoom && pointer.y <= view.height * view.zoom;
    const worldPointer = insideCanvas ? screenToWorld(view, pointer.x, pointer.y) : null;
    let hovered: VisibleEnemy | null = null;
    if (worldPointer) for (const candidate of visible.values()) {
      const dx = (worldPointer.x - candidate.x) / candidate.radiusX;
      const dy = (worldPointer.y - candidate.centerY) / candidate.radiusY;
      if (dx * dx + dy * dy > 1) continue;
      if (!hovered || candidate.y > hovered.y || (candidate.y === hovered.y && candidate.enemy.id > hovered.enemy.id)) {
        hovered = candidate;
      }
    }
    this.hoveredId = hovered?.enemy.id ?? null;
    if (hovered) { this.retainedHoverId = hovered.enemy.id; this.hoverRemaining = HOVER_GRACE; }
    if (this.hoverRemaining <= 0 || this.retainedHoverId === null || !visible.has(this.retainedHoverId)) {
      this.retainedHoverId = null; this.hoverRemaining = 0;
    }
    if (this.hitRemaining <= 0 || this.recentHitId === null || !visible.has(this.recentHitId)) {
      this.recentHitId = null; this.hitRemaining = 0;
    }

    const hits = [...this.pendingHits].filter(id => visible.has(id));
    this.pendingHits.clear();
    if (hits.length) {
      const preferred = [this.hoveredId, this.targetId, this.recentHitId].find(id => id !== null && hits.includes(id));
      this.recentHitId = preferred ?? Math.min(...hits);
      this.hitRemaining = HIT_RETENTION;
    }

    this.targetId = this.retainedHoverId ?? this.recentHitId;
    return this.targetId === null ? null : visible.get(this.targetId)?.enemy ?? null;
  }
}
