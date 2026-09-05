import { ENEMY_RANKS, MAX_CONTENT_LEVEL, monsterExperienceScale, normalizeLevel } from './progression-content.ts';
import type { EnemyRank } from './progression-content.ts';

/** XP is local to the current level; reaching the threshold carries the remainder. */
export interface ExperienceProgress {
  level: number;
  xp: number;
}

/** Equal-level normal-stalker equivalents gradually grow from five to about fifty at level fifty. */
export function xpForNextLevel(level: number): number {
  const current = normalizeLevel(level), n = current - 1;
  const stalkerReward = Math.round(20 * monsterExperienceScale(current));
  return Math.round(stalkerReward * (5 + 2 * n ** .8) / 5) * 5;
}

/** Geography supplies threat. This reward factor discourages trivial farming without scaling enemies to the player. */
export function xpLevelFactor(playerLevel: number, monsterLevel: number): number {
  const player = normalizeLevel(playerLevel), monster = normalizeLevel(monsterLevel);
  if (monster >= player) return Math.min(1.25, 1 + (monster - player) * .05);
  const grace = 3 + Math.floor(player / 10);
  return Math.max(.01, .8 ** Math.max(0, player - monster - grace));
}

/** Source reward is rounded at spawn, then the player's pre-award level supplies the kill-time factor. */
export function enemyXPReward(baseXP: number, playerLevel: number, monsterLevel: number, rank: EnemyRank): number {
  if (!Number.isFinite(baseXP) || baseXP <= 0) return 0;
  const sourceReward = Math.min(Number.MAX_SAFE_INTEGER,
    Math.round(baseXP * monsterExperienceScale(monsterLevel) * ENEMY_RANKS[rank].xpMultiplier));
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(1, Math.round(sourceReward * xpLevelFactor(playerLevel, monsterLevel))));
}

/** Exact threshold arithmetic, bounded by the numeric content ceiling; normal kills cross at most a few levels. */
export function awardExperience(progress: ExperienceProgress, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const reward = Math.min(Number.MAX_SAFE_INTEGER, Math.floor(amount));
  if (reward < 1) return;
  progress.level = normalizeLevel(progress.level);
  const currentXP = Number.isFinite(progress.xp) ? Math.max(0, Math.floor(progress.xp)) : 0;
  progress.xp = Math.min(Number.MAX_SAFE_INTEGER, currentXP + reward);
  while (progress.level < MAX_CONTENT_LEVEL) {
    const threshold = xpForNextLevel(progress.level);
    if (progress.xp < threshold) break;
    progress.xp -= threshold;
    progress.level++;
  }
  if (progress.level === MAX_CONTENT_LEVEL) progress.xp = 0;
}
