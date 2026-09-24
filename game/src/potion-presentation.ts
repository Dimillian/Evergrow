import { PLAYER_ABILITIES } from './combat-content.ts';
import type { Player } from './model.ts';
import { escapeUI } from './ui-components.ts';

/** Read-only projection; percentages and cadence use the same rules as drinking. */
export interface PotionPresentation {
  charges: number; lifePercent: number; manaPercent: number; cooldown: number; bonusPercent: number;
}
export function potionPresentation(player: Pick<Player, 'flasks' | 'derived'>): PotionPresentation {
  const rules = PLAYER_ABILITIES.potion, stats = player.derived;
  return { charges: player.flasks, lifePercent: rules.lifeFraction * stats.potionMultiplier * 100,
    manaPercent: rules.manaFraction * stats.potionMultiplier * 100,
    cooldown: rules.cooldown * stats.cooldownMultiplier, bonusPercent: (stats.potionMultiplier - 1) * 100 };
}
const number = (value: number) => String(Number(value.toFixed(2)));
export function potionTooltipMarkup(view: PotionPresentation, binding: string): string {
  const rules = PLAYER_ABILITIES.potion;
  return `<div class="potion-tip-heading"><strong>Dual potion</strong><kbd>${escapeUI(binding)}</kbd></div>
    <div class="potion-tip-charges">${view.charges} / ${rules.charges} charges · ${number(view.cooldown)}s cooldown</div>
    <div class="potion-tip-recovery"><span><b>${number(view.lifePercent)}%</b> maximum life</span><span><b>${number(view.manaPercent)}%</b> maximum mana</span></div>
    <p>Instant recovery.<br><strong>+1 charge every ${rules.killsPerCharge} kills.</strong></p>
    ${view.bonusPercent > 0 ? `<p class="potion-tip-upgrade">Includes +${number(view.bonusPercent)}% restoration.</p>` : ''}`;
}
