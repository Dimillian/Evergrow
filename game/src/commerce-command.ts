import type { Player } from './model.ts';
import type { CharacterSheet } from './character-types.ts';
import { refreshCharacter } from './character.ts';
import { planService, type ServiceQuote } from './commerce.ts';
import { canInteractNPC, type TownNPC } from './npcs.ts';
import type { WorldQuery } from './model.ts';
/** Persist staged state before committing the live player. Failure leaves resources and projections intact. */
export async function executeService(player: Player, npc: TownNPC, world: WorldQuery, quote: ServiceQuote,
  persist: (character: CharacterSheet, hp: number, mana: number) => { ok: boolean; message?: string } | Promise<{ ok: boolean; message?: string }>): Promise<{ ok: boolean; message: string }> {
  if (!canInteractNPC(npc, player, world)) return { ok: false, message: 'This service is no longer in reach.' };
  const plan = planService(player.character, npc, player.level, quote);
  if (!plan.ok) return plan;
  const candidate = { ...player, character: plan.character }; refreshCharacter(candidate);
  const result = await persist(plan.character, candidate.hp, candidate.mana);
  if (!result.ok) return { ok: false, message: result.message ?? 'Could not save. No gold or items changed.' };
  player.character = plan.character; refreshCharacter(player);
  return { ok: true, message: plan.message };
}
