import type { CharacterSheet, EquipmentSlot, Item } from './character-types.ts';
import { defaultEquipmentSlot, itemFitsSlot } from './inventory.ts';

/** Match actual equipping unless the player explicitly requests the alternate slot. */
export function comparisonSlot(sheet: CharacterSheet, item: Item, alternate = false): EquipmentSlot | undefined {
  if (item.kind === 'charm') return undefined;
  const slot = defaultEquipmentSlot(sheet, item);
  if (!alternate) return slot;
  if (item.kind === 'ring') return slot === 'ring1' ? 'ring2' : 'ring1';
  return item.kind === 'weapon' && itemFitsSlot(item, 'offhand') ? 'offhand' : slot;
}

/** Shared by ground, inventory and vendor inspection; never consumes gameplay keys. */
export class ItemComparisonInput {
  alternate = false;
  constructor(target: EventTarget, changed: () => void, signal: AbortSignal) {
    const set = (value: boolean) => { if (value !== this.alternate) { this.alternate = value; changed(); } };
    target.addEventListener('keydown', raw => {
      const event = raw as KeyboardEvent;
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') set(true);
    }, { signal, capture: true });
    target.addEventListener('keyup', raw => {
      const event = raw as KeyboardEvent;
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') set(event.shiftKey);
    }, { signal, capture: true });
    target.addEventListener('pointerover', raw => set((raw as PointerEvent).shiftKey), { signal, capture: true });
    target.addEventListener('blur', () => set(false), { signal });
  }
}
