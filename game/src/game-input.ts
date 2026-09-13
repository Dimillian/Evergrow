import type { Input } from './model.ts';

import { ControlBindings, SKILL_ACTIONS, type ControlAction } from './control-bindings.ts';

type Point = { x: number; y: number };
type PointerBounds = { left: number; top: number; width: number; height: number };

/** Browser events accumulate here; the frame consumes action edges exactly once. */
export class GameInput {
  readonly pointer = { x: 0, y: 0, present: false };
  private keys = new Set<string>();
  private buttons = new Set<number>();
  private pendingSkill: number | null = null;
  private pending = { attack: false, dodge: false, heal: false };

  private readonly bindings: ControlBindings;
  constructor(bindings = new ControlBindings()) { this.bindings = bindings; }

  private press(action: ControlAction | undefined): void {
    if (action === 'attack' || action === 'dodge' || action === 'heal') this.pending[action] = true;
    const slot = SKILL_ACTIONS.findIndex(id => id === action);
    if (slot >= 0) this.pendingSkill = slot;
  }
  keyDown(code: string): void {
    if (this.keys.has(code)) return;
    this.keys.add(code); this.press(this.bindings.action(code));
  }
  keyUp(code: string): void { this.keys.delete(code); }
  pointerDown(button: number): void {
    if (this.buttons.has(button)) return;
    this.buttons.add(button); this.press(this.bindings.action(`Mouse${button}`));
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
    const held = (action: ControlAction) => this.bindings.get(action).some(code => code !== null && (code.startsWith('Mouse') ? this.buttons.has(Number(code.slice(5))) : this.keys.has(code)));
    const input: Input = {
      moveX: Number(held('right')) - Number(held('left')),
      moveY: Number(held('down')) - Number(held('up')),
      aimX: aim.x, aimY: aim.y,
      attack: !combatBlocked && (held('attack') || this.pending.attack),
      dodge: this.pending.dodge, heal: this.pending.heal,
      ...(this.pendingSkill===null&&held('skill0')?{skillPressed:false}:{}),
      heldSkillSlots: combatBlocked?[]:[...(held('skill0')?[0]:[]),...[1,2,3,4].filter(n=>held(SKILL_ACTIONS[n]))],
      skillSlot: combatBlocked ? null : this.pendingSkill ?? (held('skill0') ? 0 : null),
    };
    this.pending.attack = this.pending.dodge = this.pending.heal = false;
    this.pendingSkill = null;
    return input;
  }

  /** Blur, pause, map entry, cancellation, and restart discard all held/queued input. */
  clear(): void {
    this.keys.clear(); this.buttons.clear();
    this.pending.attack = this.pending.dodge = this.pending.heal = false;
    this.pendingSkill = null;
  }
}
