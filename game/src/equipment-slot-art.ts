import type { EquipmentSlot } from './character-types.ts';

export function emptySlotIcon(slot: EquipmentSlot, size = 42): string {
  const glyphs: Record<EquipmentSlot, string> = {
    weapon: '<path d="m10 30 20-20 3-1-1 4-20 19m-4-8 9 9m-9-4-4 4 3 3 4-4"/>',
    offhand: '<path d="M21 7 34 12v11c0 8-7 13-13 16C15 36 8 31 8 23V12ZM21 13v19M14 21h14"/>',
    head: '<path d="M12 28V16l5-7h8l5 7v12l-6 3v-9h-6v9Zm1-8h16m-8-10v9"/>',
    chest: '<path d="m14 10 7 3 7-3 7 9-7 4v11H14V23l-7-4Zm0 13 7 4 7-4"/>',
    gloves: '<path d="m13 31-4-12 2-2 5 6V10h3v10-12h3v12-10h3v11-8h3v16l-5 5h-7Z"/>',
    legs: '<path d="M12 9h19l-2 25h-8l-1-16-1 16h-9Zm0 5h18"/>',
    boots: '<path d="M14 9h13v15l6 6v4H12V23Zm1 15h11M15 14h10"/>',
    cloak: '<path d="m17 9 4 3 4-3 8 26-12-4-12 4Zm4 3v19"/>',
    amulet: '<path d="M12 9v9a9 9 0 0 0 18 0V9m-9 17-5 6 5 6 5-6Z"/>',
    ring1: '<circle cx="21" cy="25" r="9"/><path d="m16 13 5-5 5 5-5 5Z"/>',
    ring2: '<circle cx="21" cy="25" r="9"/><path d="m16 13 5-5 5 5-5 5Z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 42 42" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true" focusable="false">${glyphs[slot]}</svg>`;
}
