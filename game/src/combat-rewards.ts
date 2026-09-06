import { ENEMY_LOOT_YIELD } from './loot-content.ts';
import { dropGold, rollEnemyGold, type GroundGold } from './gold.ts';
import type { CombatEvent, Enemy, Pickup, Player } from './model.ts';
import type { GroundItem } from './character-types.ts';
import { LOOT_RULES, PLAYER_ABILITIES } from './combat-content.ts';
import { awardCharacterExperience } from './character.ts';
import { xpLevelFactor } from './progression.ts';
import { rollEnemyLoot } from './loot.ts';

export interface KillRewardContext {
  player: Player; groundGold: GroundGold[]; groundItems: GroundItem[]; pickups: Pickup[];
  nextId(): number; emit(event: CombatEvent): void;
}

/** Called once after the damage resolver commits an enemy's death. */
export function awardKillRewards(enemy: Enemy, kills: number, recharge: number, context: KillRewardContext): { kills: number; recharge: number } {
  const { player } = context;
  kills++;
  const reward = Math.max(1, Math.round(enemy.xpReward * xpLevelFactor(player.level, enemy.level)));
  const levels = awardCharacterExperience(player, reward);
  context.emit({ type: 'experience', x: enemy.x, y: enemy.y, amount: reward });
  const gold = enemy.kind === 'warden' ? 0 : Math.round(rollEnemyGold(enemy.lootSeed, enemy.level, enemy.rank) * (ENEMY_LOOT_YIELD[enemy.kind] ?? 1));
  if (gold) dropGold(context.groundGold, { id: context.nextId(), x: enemy.x, y: enemy.y, amount: gold, age: 0 });
  if (levels) context.emit({ type: 'level', x: player.x, y: player.y,
    level: player.level, skillPoints: levels, statPoints: levels * 5, color: '#c0acf0' });
  for (const item of enemy.kind === 'warden' ? [] : rollEnemyLoot({ seed: enemy.lootSeed, level: enemy.level, rank: enemy.rank,
    biome: enemy.biome, kind: enemy.kind, firstKill: kills === 1 })) {
    if (context.groundItems.length >= LOOT_RULES.maxGroundItems) break;
    context.groundItems.push({ id: context.nextId(), x: enemy.x, y: enemy.y, item });
  }
  recharge++;
  if (recharge >= PLAYER_ABILITIES.potion.killsPerCharge) {
    recharge -= PLAYER_ABILITIES.potion.killsPerCharge;
    player.flasks = Math.min(PLAYER_ABILITIES.potion.charges, player.flasks + 1);
  }
  const health = kills % LOOT_RULES.healthEveryKills === 0;
  if (context.pickups.length < LOOT_RULES.maxPickups) context.pickups.push({ id: context.nextId(), x: enemy.x, y: enemy.y,
    kind: health ? 'health' : 'mana', restoreFraction: health ? LOOT_RULES.healthFraction : LOOT_RULES.manaFraction,
    life: LOOT_RULES.life, radius: LOOT_RULES.radius });
  return { kills, recharge };
}
