import type { EquipmentSlot } from './character-types.ts';

/** Shared paper-doll order, including service windows without the portrait. */
export const SLOT_NAMES: Record<EquipmentSlot, string> = {
  weapon: 'Main hand', offhand: 'Off hand', head: 'Head', chest: 'Chest', gloves: 'Gloves', legs: 'Legs', boots: 'Boots',
  cloak: 'Cloak', amulet: 'Amulet', ring1: 'Ring I', ring2: 'Ring II',
};
export const LEFT_SLOTS: readonly EquipmentSlot[] = ['chest', 'gloves', 'legs', 'boots', 'cloak'];
export const RIGHT_SLOTS: readonly EquipmentSlot[] = ['weapon', 'offhand', 'amulet', 'ring1', 'ring2'];
