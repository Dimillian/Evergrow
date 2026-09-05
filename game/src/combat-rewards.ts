import type { CombatEvent, Enemy, Pickup, Player } from './model.ts';
import type { GroundItem } from './character-types.ts';
import { LOOT_RULES, PLAYER_ABILITIES } from './combat-content.ts';
import { awardCharacterExperience } from './character.ts';
import { xpLevelFactor } from './progression.ts';
import { rollEnemyLoot } from './loot.ts';

export interface KillRewardContext {
  player: Player; groundItems: GroundItem[]; pickups: Pickup[];
  nextId(): number; emit(event: CombatEvent): void;
}

/** Called once after the damage resolver commits an enemy's death. */
export function awardKillRewards(enemy: Enemy, kills: number, recharge: number, context: KillRewardContext): { kills: number; recharge: number } {
  const { player } = context;
  kills++;
  const reward = Math.max(1, Math.round(enemy.xpReward * xpLevelFactor(player.level, enemy.level)));
  const levels = awardCharacterExperience(player, reward);
  if (levels) context.emit({ type: 'level', x: player.x, y: player.y,
    text: `Level ${player.level} · +${levels} skill point${levels > 1 ? 's' : ''} · +${levels * 5} attribute points`, color: '#c0acf0' });
  for (const item of rollEnemyLoot({ seed: enemy.lootSeed, level: enemy.level, rank: enemy.rank,
    biome: enemy.biome, kind: enemy.kind, firstKill: kills === 1 })) {
    if (context.groundItems.length >= LOOT_RULES.maxGroundItems) break;
    context.groundItems.push({ id: context.nextId(), x: enemy.x, y: enemy.y, item });
  }
  recharge++;
  if (recharge >= PLAYER_ABILITIES.heal.killsPerCharge) {
    recharge -= PLAYER_ABILITIES.heal.killsPerCharge;
    player.flasks = Math.min(PLAYER_ABILITIES.heal.charges, player.flasks + 1);
  }
  const health = kills % LOOT_RULES.healthEveryKills === 0;
  if (context.pickups.length < LOOT_RULES.maxPickups) context.pickups.push({ id: context.nextId(), x: enemy.x, y: enemy.y,
    kind: health ? 'health' : 'mana', restoreFraction: health ? LOOT_RULES.healthFraction : LOOT_RULES.manaFraction,
    life: LOOT_RULES.life, radius: LOOT_RULES.radius });
  return { kills, recharge };
}
