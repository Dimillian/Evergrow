import { escapeUI } from './ui-components.ts';
import { AFFIX_COMBAT_RULES } from './equipment-affix-content.ts';
import type { Equipment } from './model.ts';
export function effectTerm(id: string, label: string): string {
  return `<button type="button" class="ui-term" aria-expanded="false" data-ui-term="${escapeUI(id)}">${escapeUI(label)}</button>`;
}
const seconds = AFFIX_COMBAT_RULES.weaveDuration;
export function effectExplanation(id: string): string | undefined {
  const terms: Record<string, [string, string]> = {
    reservation: ['Mana reservation', 'An assigned aura reserves part of maximum mana. Recovery cannot fill that part. Removing the aura frees capacity without restoring mana. Ranks improve power and reservation efficiency.'],
    spellweave: ['Spellweave', `<small>Passive · No skill slot</small><p>Melee hits empower your next damaging spell or magic bolt. Spell hits empower your next melee action.</p><p>${seconds}s · Refreshes, never stacks.</p><p>${effectTerm('empowered', 'Empowered actions')} · ${effectTerm('hybrid', 'Equipment')}</p>`],
    empowered: ['Empowered actions', 'Bonus damage applies to the whole action. Starting it spends the bonus, even if it misses. Failed activation keeps it.'],
    hybrid: ['Melee + magic', 'Sword + wand supports both. Its basic attacks alternate automatically when held. Bows and damage-over-time ticks do not prime Spellweave.'],
    afterguard: ['Afterguard', 'Blocking temporarily increases armor. Further blocks refresh the timer. Requires a shield.'],
    mitigation: ['Damage reduction', 'Stance reductions use the strongest active value. Armor and resistance still apply; wards absorb damage afterward.'],
    ward: ['Ward', 'Absorbs incoming damage after defenses. Ends when its time or absorption runs out.'],
  };
  const term = terms[id]; return term ? `<h3>${term[0]}</h3><div>${term[1]}</div>` : undefined;
}
export function spellweaveFit(equipment: Equipment): string {
  const weapons = [equipment.mainHand, ...(equipment.offHand?.kind === 'weapon' ? [equipment.offHand.weapon] : [])];
  const melee = weapons.some(w => w.attackKind === 'melee'), magic = weapons.some(w => w.attackKind === 'bolt');
  if (weapons.some(w => w.hands === 2)) return 'Use one-handed melee + wand.';
  return melee && magic ? 'Melee + magic equipped.' : !melee && !magic ? 'Needs melee + magic.' : !melee ? 'Needs a melee weapon too.' : 'Needs a wand too.';
}
export function spellweaveNodeMarkup(bonus: number, enabled: boolean): string {
  if (!bonus && !enabled) return '';
  return `<p>${enabled ? 'Automatic passive' : 'Enables'} ${effectTerm('spellweave', 'Spellweave')}. Melee ↔ magic · ${seconds}s.</p>`;
}
