import type { GamePhase } from './game-phase.ts';

/** Reuse the displayed world canvas beneath menus that already pause the simulation. */
export class MenuBackdrop {
  private phase: GamePhase | null = null;
  private dirty = true;

  invalidate() { this.dirty = true; }

  /** draw returns true while streamed terrain still needs another presentation frame. */
  render(phase: GamePhase, draw: () => boolean): void {
    const retained = phase === 'character' || phase === 'service';
    if (phase !== this.phase) this.dirty = true;
    this.phase = phase;
    if (retained && !this.dirty) return;
    // A failed draw must remain eligible for retry.
    this.dirty = true;
    const pending = draw();
    this.dirty = !retained || pending;
  }
}
