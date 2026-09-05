import type { SkillId } from './character-types.ts';

export interface SkillDefinition {
  readonly id: SkillId;
  readonly name: string;
  readonly description: string;
  readonly manaCost: number;
  readonly cooldown: number;
  readonly damageMultiplier: number;
  readonly color: string;
}

/** All active skill costs and potency live here; HUD, tree, and combat share them. */
export const SKILL_DEFINITIONS: Readonly<Record<SkillId, Readonly<SkillDefinition>>> = Object.freeze({
  cleave: Object.freeze({ id: 'cleave', name: 'Crescent Cleave', description: 'Unleash a broad, empowered weapon sweep through nearby enemies.', manaCost: 12, cooldown: 2.5, damageMultiplier: 1.8, color: '#e6bd7b' }),
  lunge: Object.freeze({ id: 'lunge', name: 'Rift Lunge', description: 'Surge toward your aim and strike enemies along your path.', manaCost: 10, cooldown: 4, damageMultiplier: 1.5, color: '#add9ca' }),
  ember: Object.freeze({ id: 'ember', name: 'Ember Lance', description: 'Hurl a concentrated lance of fire at your aim.', manaCost: 9, cooldown: .65, damageMultiplier: 1.45, color: '#f4a271' }),
  nova: Object.freeze({ id: 'nova', name: 'Astral Nova', description: 'Release a ring of astral energy that strikes surrounding enemies.', manaCost: 22, cooldown: 5, damageMultiplier: 2.1, color: '#c0acf0' }),
  volley: Object.freeze({ id: 'volley', name: 'Thorn Volley', description: 'Send three spectral thorns outward in a spreading fan.', manaCost: 16, cooldown: 3, damageMultiplier: .8, color: '#a6ce9d' }),
  siphon: Object.freeze({ id: 'siphon', name: 'Soul Siphon', description: 'Cast a hungry spirit bolt that restores life when it strikes.', manaCost: 18, cooldown: 4.5, damageMultiplier: 1.65, color: '#dba3c3' }),
});

const SKILL_PATHS: Readonly<Record<SkillId, string>> = Object.freeze({
  cleave: '<path d="M8 27 25 6l3 2-16 23-5 2Z"/><path d="m6 23 12 9M17 6C32 4 39 16 31 27M23 4c13 3 17 14 10 22"/>',
  lunge: '<path d="m7 30 20-21 5-2-2 6-20 20ZM5 25l8 8M3 15l10-3M3 21l7-2M18 4l-3 5"/>',
  ember: '<path d="M21 3c-5 8 2 10-3 14-1-4-4-5-4-7-4 6-8 12-6 18 2 7 14 10 20 4 7-8-2-18-7-29Z"/><path d="m18 20-4 9 6 5 5-6Z"/>',
  nova: '<circle cx="20" cy="20" r="10"/><path d="m20 3 3 11 14 6-14 4-3 13-4-13L3 20l13-5ZM5 5l5 5m20 20 5 5M5 35l5-5M30 10l5-5"/>',
  volley: '<path d="m20 4 4 12-4-2-4 2ZM7 11l11 6-4 2-1 4ZM33 11l-6 12-1-4-4-2ZM20 16v19M14 24l-7 9M26 24l7 9"/>',
  siphon: '<path d="M28 6C15 2 4 12 8 25c3 10 17 11 24 2-7 4-16 1-16-7 0-6 6-9 12-7l-5 4 12-3-4-11Z"/><path d="M19 25c-5-4 0-10 3-5 3-5 8 0 3 4l-3 3Z"/>',
});

/** Inline, scalable code-defined art; no external asset or browser dependency. */
export function skillIconSVG(id: SkillId, size = 36): string {
  const dimension = Number.isFinite(size) ? Math.max(8, Math.min(256, size)) : 36;
  return `<svg aria-hidden="true" width="${dimension}" height="${dimension}" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${SKILL_PATHS[id]}</svg>`;
}
