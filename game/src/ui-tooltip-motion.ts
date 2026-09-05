/** Shared tooltip timing for DOM chrome and native Canvas overlays. */
export const TOOLTIP_MOTION = Object.freeze({ enter: 160, exit: 120, lift: 4 });

/** Reversible visibility envelope; retains outgoing content until its fade completes. */
export class TooltipMotion {
  private id: string | null = null;
  private visible = false;
  private from = 0;
  private started = 0;
  private duration = 0;

  set(id: string | null, now: number, reduced = false): void {
    const current = this.sample(now);
    if (id) this.id = id;
    if (Boolean(id) === this.visible && !reduced) return;
    this.from = current.opacity;
    this.visible = Boolean(id);
    this.started = now;
    this.duration = reduced ? 0 : this.visible ? TOOLTIP_MOTION.enter : TOOLTIP_MOTION.exit;
  }

  sample(now: number): { id: string | null; opacity: number; lift: number; active: boolean } {
    const progress = this.duration ? Math.min(1, Math.max(0, (now - this.started) / this.duration)) : 1;
    const eased = 1 - (1 - progress) ** 3;
    const opacity = this.from + ((this.visible ? 1 : 0) - this.from) * eased;
    return { id: opacity > 0 || this.visible ? this.id : null, opacity,
      lift: (1 - opacity) * TOOLTIP_MOTION.lift, active: progress < 1 };
  }

  reset(): void { this.id = null; this.visible = false; this.from = 0; this.duration = 0; }
}
