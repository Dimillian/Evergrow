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
  focusIndex = 0;
  private readonly changed: () => void;
  isToggleActive?: () => boolean;

  constructor(target: EventTarget, changed: () => void, signal: AbortSignal, isToggleActive?: () => boolean) {
    this.changed = changed;
    this.isToggleActive = isToggleActive;
    const set = (value: boolean) => { if (value !== this.alternate) { this.alternate = value; changed(); } };
    target.addEventListener('keydown', raw => {
      const event = raw as KeyboardEvent;
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') set(true);
      if (event.key === 'Alt' || event.code === 'AltLeft' || event.code === 'AltRight') {
        if (!this.isToggleActive || this.isToggleActive()) {
          event.preventDefault();
          this.toggleFocus();
        }
      }
    }, { signal, capture: true });
    target.addEventListener('keyup', raw => {
      const event = raw as KeyboardEvent;
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') set(event.shiftKey);
    }, { signal, capture: true });
    target.addEventListener('pointerover', raw => set((raw as PointerEvent).shiftKey), { signal, capture: true });
    target.addEventListener('blur', () => { set(false); this.resetFocus(); }, { signal });
  }

  toggleFocus(max = 2): void {
    this.focusIndex = (this.focusIndex + 1) % max;
    this.changed();
  }

  resetFocus(): void {
    if (this.focusIndex !== 0) {
      this.focusIndex = 0;
      this.changed();
    }
  }
}
