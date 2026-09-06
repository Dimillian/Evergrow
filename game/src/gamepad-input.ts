import type { Input } from './model.ts';

/** Standard Gamepad mapping. Kept headless so polling and safety can be tested. */
export interface PadSnapshot {
  index: number; id: string; connected: boolean; mapping: string;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}
export const PAD = Object.freeze({ interact: 0, dodge: 1, skill3: 2, skill4: 3,
  potion: 4, skill2: 5, skill1: 6, attack: 7, map: 8, pause: 9,
  skill5: 11, up: 12, down: 13, left: 14, right: 15 });
export const PAD_SKILL_BUTTONS = [PAD.skill1, PAD.skill2, PAD.skill3, PAD.skill4, PAD.skill5] as const;
export const PAD_SKILL_LABELS = ['RT', 'LT', 'RB', 'X', 'Y', 'RS'] as const;

export function padStick(x = 0, y = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
  x = Math.max(-1, Math.min(1, x)); y = Math.max(-1, Math.min(1, y));
  const length = Math.hypot(x, y), strength = Math.max(0, Math.min(1, (length - .2) / .8));
  return length > 0 ? { x: x / length * strength, y: y / length * strength } : { x: 0, y: 0 };
}

export class GamepadInput {
  private identity = '';
  private armed = false;
  private previous = new Set<number>();
  readonly held = new Set<number>();
  readonly pressed = new Set<number>();
  move = { x: 0, y: 0 };
  aim = { x: 0, y: 0 };
  disconnected = false;
  get active() { return this.held.size > 0 || !!(this.move.x || this.move.y || this.aim.x || this.aim.y); }

  gameplay(aim: { x: number; y: number }): Input {
    const slot = PAD_SKILL_BUTTONS.findIndex(button => this.pressed.has(button));
    return { moveX: this.move.x, moveY: this.move.y, aimX: aim.x, aimY: aim.y,
      attack: this.held.has(PAD.attack), dodge: this.pressed.has(PAD.dodge), heal: this.pressed.has(PAD.potion),
      skillSlot: slot >= 0 ? slot : this.held.has(PAD.skill1) ? 0 : null };
  }

  /** Every context change requires neutral controls before accepting new input. */
  clear() {
    this.armed = false; this.previous.clear(); this.held.clear(); this.pressed.clear();
    this.move = { x: 0, y: 0 }; this.aim = { x: 0, y: 0 };
  }

  poll(pads: readonly (PadSnapshot | null)[], focused: boolean) {
    const valid = pads.filter((pad): pad is PadSnapshot => !!pad?.connected && pad.mapping === 'standard');
    const key = (pad: PadSnapshot) => `${pad.index}:${pad.id}`;
    const pad = valid.find(pad => key(pad) === this.identity) ?? valid[0];
    const identity = pad ? key(pad) : '';
    this.disconnected = !!this.identity && identity !== this.identity;
    if (identity !== this.identity) { this.clear(); this.identity = identity; }
    this.held.clear(); this.pressed.clear();
    this.move = { x: 0, y: 0 }; this.aim = { x: 0, y: 0 };
    if (!pad || !focused) { this.clear(); return; }
    const buttons = new Set<number>();
    pad.buttons.slice(0, 16).forEach((button, index) => {
      if (button.pressed || (Number.isFinite(button.value) && button.value > .55)) buttons.add(index);
    });
    const move = padStick(pad.axes[0], pad.axes[1]), aim = padStick(pad.axes[2], pad.axes[3]);
    if (!this.armed) {
      this.armed = buttons.size === 0 && !(move.x || move.y || aim.x || aim.y);
      this.previous = buttons; return;
    }
    this.move = move; this.aim = aim;
    for (const button of buttons) {
      this.held.add(button);
      if (!this.previous.has(button)) this.pressed.add(button);
    }
    this.previous = buttons;
  }
}
