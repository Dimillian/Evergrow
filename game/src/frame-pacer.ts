/** Presentation-only ceiling. Skipped display callbacks retain elapsed time for the next simulation update. */
export class FramePacer {
  private next: number | null = null;
  private readonly interval: number;
  constructor(fps = 60) { this.interval = 1000 / fps; }
  ready(now: number): boolean {
    if (!Number.isFinite(now)) return false;
    if (this.next === null || now - this.next > this.interval * 2) {
      this.next = now + this.interval;
      return true;
    }
    // Display timestamps can fall slightly ahead of the nominal 60 Hz deadline.
    if (now + .25 < this.next) return false;
    this.next += this.interval;
    return true;
  }
}
