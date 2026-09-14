import type { CharacterSheet, EquipmentSlot, Item } from './character-types.ts';
import { defaultEquipmentSlot, itemFitsSlot } from './inventory.ts';
import { previewEquipmentChange, type EquipmentStatChange } from './equipment-preview.ts';

/** Match actual equipping unless the player explicitly requests the alternate slot. */
export function comparisonSlot(sheet: CharacterSheet, item: Item, alternate = false): EquipmentSlot | undefined {
  if (item.kind === 'charm') return undefined;
  const slot = defaultEquipmentSlot(sheet, item);
  if (!alternate) return slot;
  if (item.kind === 'ring') return slot === 'ring1' ? 'ring2' : 'ring1';
  return item.kind === 'weapon' && itemFitsSlot(item, 'offhand') ? 'offhand' : slot;
}

/** Determine which ring slot offers the higher net stat improvement when replaced. */
export function bestRingSlot(sheet: CharacterSheet, item: Item, level = 1): 'ring1' | 'ring2' {
  if (!sheet.equipped.ring1) return 'ring1';
  if (!sheet.equipped.ring2) return 'ring2';
  const p1 = previewEquipmentChange(sheet, item, level, { slot: 'ring1' });
  const p2 = previewEquipmentChange(sheet, item, level, { slot: 'ring2' });
  if (!p1.ok && p2.ok) return 'ring2';
  if (p1.ok && !p2.ok) return 'ring1';
  if (!p1.ok || !p2.ok) return 'ring1';
  const score = (changes: EquipmentStatChange[]) =>
    changes.reduce((sum, c) => sum + (c.after > c.before ? 1 : c.after < c.before ? -1 : 0), 0);
  return score(p2.changes) > score(p1.changes) ? 'ring2' : 'ring1';
}

/** Shared by ground, inventory and vendor inspection; never consumes gameplay keys. */
export class ItemComparisonInput {
  alternate = false;
  focused = false;
  constructor(target: EventTarget, changed: () => void, signal: AbortSignal) {
    const setAlternate = (value: boolean) => { if (value !== this.alternate) { this.alternate = value; changed(); } };
    const setFocused = (value: boolean) => { if (value !== this.focused) { this.focused = value; changed(); } };
    target.addEventListener('keydown', raw => {
      const event = raw as KeyboardEvent;
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        setAlternate(true);
      } else if (event.code === 'AltLeft' || event.code === 'AltRight') {
        event.preventDefault();
        if (!event.repeat) {
          this.focused = !this.focused;
          changed();
        }
      }
    }, { signal, capture: true });
    target.addEventListener('keyup', raw => {
      const event = raw as KeyboardEvent;
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        setAlternate(event.shiftKey);
      }
    }, { signal, capture: true });
    target.addEventListener('pointerover', raw => setAlternate((raw as PointerEvent).shiftKey), { signal, capture: true });
    target.addEventListener('blur', () => { setAlternate(false); setFocused(false); }, { signal });
  }
  reset(): void {
    this.alternate = false;
    this.focused = false;
  }
}
