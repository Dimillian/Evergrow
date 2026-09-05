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

/** Awards affect progression only; level-up stat changes belong to future systems. */
export function awardExperience(progress: ExperienceProgress, amount: number): void {
  progress.xp += amount;
  while (progress.xp >= xpForNextLevel(progress.level)) {
    progress.xp -= xpForNextLevel(progress.level);
    progress.level++;
  }
}
