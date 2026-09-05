import type { Input } from './model.ts';

const MOVEMENT = {
  right: ['KeyD', 'ArrowRight'], left: ['KeyA', 'ArrowLeft'],
  down: ['KeyS', 'ArrowDown'], up: ['KeyW', 'ArrowUp'],
} as const;
const GAME_KEYS = new Set<string>([...Object.values(MOVEMENT).flat(), 'Space', 'KeyQ']);
type Point = { x: number; y: number };
type PointerBounds = { left: number; top: number; width: number; height: number };

/** Browser events accumulate here; the frame consumes action edges exactly once. */
export class GameInput {
  readonly pointer = { x: 0, y: 0, present: false };
  private keys = new Set<string>();
  private buttons = new Set<number>();
  private pending = { attack: false, dodge: false, heal: false };

  keyDown(code: string): void {
    if (!GAME_KEYS.has(code) || this.keys.has(code)) return;
    this.keys.add(code);
    if (code === 'Space') this.pending.dodge = true;
    if (code === 'KeyQ') this.pending.heal = true;
  }

  keyUp(code: string): void { this.keys.delete(code); }

  pointerDown(button: number): void {
    if (button !== 0 || this.buttons.has(button)) return;
    this.buttons.add(button);
    this.pending.attack = true;
  }

  pointerUp(button: number): void { this.buttons.delete(button); }

  /** Ignore invalid/hidden surface bounds instead of injecting NaN into aiming. */
  movePointer(clientX: number, clientY: number, bounds: PointerBounds, width: number, height: number): void {
    if (![clientX, clientY, bounds.left, bounds.top, bounds.width, bounds.height, width, height].every(Number.isFinite)
      || bounds.width <= 0 || bounds.height <= 0 || width <= 0 || height <= 0) {
      this.pointer.present = false;
      return;
    }
    const x = clientX - bounds.left, y = clientY - bounds.top;
    this.pointer.present = x >= 0 && x <= bounds.width && y >= 0 && y <= bounds.height;
    this.pointer.x = x / bounds.width * width;
    this.pointer.y = y / bounds.height * height;
  }

  consume(aim: Point, combatBlocked: boolean): Input {
    const held = (codes: readonly string[]) => codes.some(code => this.keys.has(code));
    const input: Input = {
      moveX: Number(held(MOVEMENT.right)) - Number(held(MOVEMENT.left)),
      moveY: Number(held(MOVEMENT.down)) - Number(held(MOVEMENT.up)),
      aimX: aim.x, aimY: aim.y,
      attack: !combatBlocked && (this.buttons.has(0) || this.pending.attack),
      dodge: this.pending.dodge, heal: this.pending.heal,
    };
    this.pending.attack = this.pending.dodge = this.pending.heal = false;
    return input;
  }

  /** Blur, pause, map entry, cancellation, and restart discard all held/queued input. */
  clear(): void {
    this.keys.clear(); this.buttons.clear();
    this.pending.attack = this.pending.dodge = this.pending.heal = false;
  }
}
