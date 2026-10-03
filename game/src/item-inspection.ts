import type { Player } from './model.ts';
import { executeCharacterCommand } from './character-commands.ts';

/** Inspection may arrive while a durable command owns a copy of the sheet.
 * Retain IDs, not item/sheet references, and acknowledge the committed sheet. */
export class PendingItemInspections {
  private player: Player | null = null;
  private characterId: string | null = null;
  private readonly ids = new Set<string>();

  request(player: Player, characterId: string, id: string): void {
    if (this.player !== player || this.characterId !== characterId) this.clear();
    const item = [...player.character.inventory, ...Object.values(player.character.equipped)].find(item => item?.id === id);
    if (!item?.newPickup) return;
    this.player = player; this.characterId = characterId; this.ids.add(id);
  }

  flush(player: Player, characterId: string | null): boolean {
    const ids = this.player === player && this.characterId === characterId ? [...this.ids] : [];
    this.clear();
    let changed = false;
    for (const id of ids) {
      const item = [...player.character.inventory, ...Object.values(player.character.equipped)].find(item => item?.id === id);
      if (item?.newPickup && executeCharacterCommand(player, { type: 'inspectItem', id }).ok) changed = true;
    }
    return changed;
  }

  clear(): void { this.player = null; this.characterId = null; this.ids.clear(); }
}
