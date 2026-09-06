import type { SaveSlot } from './character-storage.ts';

/** Preview reads may still be pending: loading a slot reads its durable record anew. */
export function titleSlotAction(slot: SaveSlot | undefined, canUse: boolean, busy: boolean, confirming: boolean): 'continue' | 'create' | 'none' {
  if (!slot || !canUse || busy || confirming) return 'none';
  if ((slot.state === 'saved' || slot.state === 'recovered') && (slot.record || slot.summary)) return 'continue';
  return slot.state === 'empty' ? 'create' : 'none';
}
