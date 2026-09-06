import type { Input } from './model.ts';

export type TouchAction = 'move' | 'attack' | 'heal' | 'dodge' | `skill-${number}`;
export type TouchTargeting = 'direction' | 'ground' | 'self';
type Contact = { action: TouchAction; x: number; y: number; targeting: TouchTargeting; canceled: boolean };
export type TouchPoint = { x: number; y: number };

/** Device-independent contact ownership. A cleared contact can never re-arm on move/up. */
export class TouchInput {
  private contacts = new Map<number, Contact>();
  readonly move = { x: 0, y: 0 };
  readonly attackStick = { x: 0, y: 0 };
  aim = { x: 0, y: 1 };
  distance = .6;
  private attackEdge = false;
  private heal = false;
  private dodge = false;
  private skill: number | null = null;
  get preview(): { slot: number; targeting: TouchTargeting; canceled: boolean } | null {
    for (const c of this.contacts.values()) if (c.action.startsWith('skill-'))
      return { slot: Number(c.action.slice(6)), targeting: c.targeting, canceled: c.canceled };
    return null;
  }
  get aimingSlot() { return this.preview?.slot ?? this.skill; }
  get attacking() { return [...this.contacts.values()].some(c => c.action === 'attack'); }
  down(id: number, action: TouchAction, point: TouchPoint, targeting: TouchTargeting = 'direction'): boolean {
    if (!Number.isFinite(id) || !Number.isFinite(point.x + point.y) || this.contacts.has(id) || this.contacts.size >= 4) return false;
    if ([...this.contacts.values()].some(c => c.action === action)) return false;
    if (action.startsWith('skill-') && (!/^skill-[0-4]$/.test(action) || this.preview || this.skill !== null)) return false;
    this.contacts.set(id, { action, ...point, targeting, canceled: false });
    if (action === 'attack') this.attackEdge = true;
    if (action.startsWith('skill-')) this.attackEdge = false;
    return true;
  }
  update(id: number, point: TouchPoint, canceled = false) {
    const c = this.contacts.get(id);
    if (!c || !Number.isFinite(point.x + point.y)) return;
    const dx = point.x - c.x, dy = point.y - c.y, length = Math.hypot(dx, dy);
    c.canceled = canceled;
    if (c.action === 'attack') {
      const strength = Math.min(1, Math.max(0, (length - 8) / 24));
      this.attackStick.x = length ? dx / length * strength : 0;
      this.attackStick.y = length ? dy / length * strength : 0;
    }
    if (c.action === 'move') {
      const strength = Math.min(1, Math.max(0, (length - 7) / 43));
      this.move.x = length ? dx / length * strength : 0;
      this.move.y = length ? dy / length * strength : 0;
    } else if (((c.action === 'attack' && !this.preview) || c.action.startsWith('skill-')) && c.targeting !== 'self' && length > 8) {
      this.aim = { x: dx / length, y: dy / length };
      this.distance = Math.min(1, length / 110);
    }
  }
  up(id: number, cancel = false) {
    const c = this.contacts.get(id);
    if (!c) return;
    this.contacts.delete(id);
    if (c.action === 'move') this.move.x = this.move.y = 0;
    if (c.action === 'attack') this.attackStick.x = this.attackStick.y = 0;
    if (c.action === 'attack' && cancel) this.attackEdge = false;
    if (cancel || c.canceled) return;
    if (c.action === 'heal') this.heal = true;
    if (c.action === 'dodge') this.dodge = true;
    if (c.action.startsWith('skill-')) this.skill = Number(c.action.slice(6));
  }
  consume(aim: TouchPoint): Input {
    const input: Input = { moveX: this.move.x, moveY: this.move.y, aimX: aim.x, aimY: aim.y,
      attack: !this.preview && this.skill === null && (this.attacking || this.attackEdge),
      dodge: this.dodge, heal: this.heal, skillSlot: this.skill };
    this.attackEdge = this.heal = this.dodge = false; this.skill = null;
    return input;
  }
  clear() {
    this.contacts.clear(); this.move.x = this.move.y = 0;
    this.attackStick.x = this.attackStick.y = 0;
    this.attackEdge = this.heal = this.dodge = false; this.skill = null;
  }
}
