import type { eventProgress } from './event-progress.ts';

export type EventProgress = NonNullable<ReturnType<typeof eventProgress>>;
export const EVENT_CARD_MOTION = { expand: .36, fade: .24, duration: .6 } as const;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => value * value * (3 - 2 * value);

/** Renderer-owned reveal clock. Retains the last projection only while closing. */
export class EventProgressPresentation {
  private progress: EventProgress | null = null;
  private elapsed = 0;

  reset() { this.progress = null; this.elapsed = 0; }

  update(progress: EventProgress | null, dt: number, reducedMotion: boolean) {
    if (progress) {
      if (progress.site.id !== this.progress?.site.id) this.elapsed = 0;
      this.progress = { ...progress, site: { ...progress.site } };
    }
    const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    this.elapsed = reducedMotion ? (progress ? EVENT_CARD_MOTION.duration : 0)
      : Math.max(0, Math.min(EVENT_CARD_MOTION.duration, this.elapsed + (progress ? step : -step)));
    if (!progress && this.elapsed === 0) this.progress = null;
  }

  get view() {
    if (!this.progress) return null;
    return {
      progress: this.progress,
      width: ease(clamp(this.elapsed / EVENT_CARD_MOTION.expand)),
      opacity: ease(clamp((this.elapsed - EVENT_CARD_MOTION.expand) / EVENT_CARD_MOTION.fade)),
    };
  }
}

export type EventProgressView = EventProgressPresentation['view'];
