/** XP is local to the current level; reaching the threshold carries the remainder. */
export interface ExperienceProgress {
  level: number;
  xp: number;
}

const FIRST_LEVEL_XP = 100;
const XP_INCREASE_PER_LEVEL = 50;

/** Authored prototype curve, shared by simulation rewards and HUD readouts. */
export function xpForNextLevel(level: number): number {
  return FIRST_LEVEL_XP + (level - 1) * XP_INCREASE_PER_LEVEL;
}

/** Threshold arithmetic; character.ts grants points for the resulting level changes. */
export function awardExperience(progress: ExperienceProgress, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  progress.xp += amount;
  while (progress.xp >= xpForNextLevel(progress.level)) {
    progress.xp -= xpForNextLevel(progress.level);
    progress.level++;
  }
}
