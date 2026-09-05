import type { Player } from './model.ts';
import type { CharacterSave } from './character-save.ts';
import { initialPlayer } from './simulation.ts';
import { refreshCharacter } from './character.ts';
import { deriveAttackStats } from './equipment.ts';

export function previewCharacter(record: CharacterSave | null): Player {
  const player = initialPlayer(0, 0);
  if (record) {
    player.character = JSON.parse(JSON.stringify(record.checkpoint.character));
    player.level = record.checkpoint.level; player.xp = record.checkpoint.xp;
  }
  refreshCharacter(player); player.hp = player.maxHp; player.mana = player.maxMana;
  return player;
}

/** Comparative equipment/build estimate, not a combat rule or a promise about skill DPS. */
export function characterPower(player: Player): { power: number; dps: number; effectiveLife: number } {
  const attack = deriveAttackStats(player.stats, player.equipment.mainHand);
  const offhand = player.equipment.offHand?.kind === 'weapon' ? deriveAttackStats(player.stats, player.equipment.offHand.weapon) : null;
  const baseDps = offhand ? (attack.damage + offhand.damage) / (1 / attack.attacksPerSecond + 1 / offhand.attacksPerSecond) : attack.damage * attack.attacksPerSecond;
  const dps = baseDps * (1 + player.derived.critChance * (player.derived.critMultiplier - 1));
  const effectiveLife = player.maxHp / Math.max(.05, (1 - player.derived.damageReduction)
    * (1 - player.derived.blockChance * player.derived.blockReduction));
  return { power: Math.round(Math.sqrt(dps * effectiveLife)), dps, effectiveLife };
}
