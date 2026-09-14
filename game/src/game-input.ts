import type { Input } from './model.ts';

import { ControlBindings, SKILL_ACTIONS, isMovementAction, type ControlAction } from './control-bindings.ts';

type Point = { x: number; y: number };
type PointerBounds = { left: number; top: number; width: number; height: number };

/** Browser events accumulate here; the frame consumes action edges exactly once. */
export class GameInput {
  readonly pointer = { x: 0, y: 0, present: false };
  private keys = new Set<string>();
  private buttons = new Set<number>();
  private pointerUIBlocked = false;
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

  held(action: ControlAction): boolean {
    return this.bindings.get(action).some(code => code !== null
      && (code.startsWith('Mouse') ? this.buttons.has(Number(code.slice(5))) : this.keys.has(code)));
  }

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

  /** Coordinate-based entry also catches canvas-captured drags and panels opening under a held pointer. */
  setPointerUIBlocked(blocked: boolean): boolean {
    const entered = blocked && !this.pointerUIBlocked;
    this.pointerUIBlocked = blocked;
    if (entered) this.clear();
    return entered;
  }

  consume(aim: Point, combatBlocked: boolean): Input {
    const input: Input = {
      moveX: Number(this.held('right')) - Number(this.held('left')),
      moveY: Number(this.held('down')) - Number(this.held('up')),
      aimX: aim.x, aimY: aim.y,
      attack: !combatBlocked && (this.held('attack') || this.pending.attack),
      dodge: this.pending.dodge, heal: this.pending.heal,
      ...(this.pendingSkill===null&&this.held('skill0')?{skillPressed:false}:{}),
      heldSkillSlots: combatBlocked?[]:[...(this.held('skill0')?[0]:[]),...[1,2,3,4].filter(n=>this.held(SKILL_ACTIONS[n]))],
      skillSlot: combatBlocked ? null : this.pendingSkill ?? (this.held('skill0') ? 0 : null),
    };
    this.pending.attack = this.pending.dodge = this.pending.heal = false;
    this.pendingSkill = null;
    return input;
  }

  /** Tab transitions retain movement, loot reveal and mouse holds; pause/blur discard everything. */
  clear(preserveMovement = false): void {
    if (preserveMovement) {
      for (const key of this.keys) {
        const action = this.bindings.action(key);
        if (!isMovementAction(action) && action !== 'revealLoot') this.keys.delete(key);
      }
    } else this.keys.clear();
    if (!preserveMovement) this.buttons.clear();
    this.pending.attack = this.pending.dodge = this.pending.heal = false;
    this.pendingSkill = null;
  }
}
