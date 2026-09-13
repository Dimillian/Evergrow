import { SKILL_SPECIALIZATIONS } from './skill-progression.ts';
import { UNIQUES } from './unique-content.ts';
import { escapeUI } from './ui-components.ts';
import { AFFIX_COMBAT_RULES } from './equipment-affix-content.ts';
import type { Equipment } from './model.ts';
export function effectTerm(id: string, label: string): string {
  return `<button type="button" class="ui-term" aria-expanded="false" data-ui-term="${escapeUI(id)}">${escapeUI(label)}</button>`;
}
const seconds = AFFIX_COMBAT_RULES.weaveDuration;
export function effectExplanation(id: string): string | undefined {
  if (id.startsWith('technique:')) { const spec = SKILL_SPECIALIZATIONS.find(s => `technique:${s.id}` === id); return spec ? `<h3>${escapeUI(spec.name)}</h3><small>Base rules · before rank and equipment bonuses</small><p>${effectText(spec.description)}</p>` : undefined; }
  if (id.startsWith('unique:')) { const unique = UNIQUES.find(u => `unique:${u.id}` === id); return unique ? `<h3>${escapeUI(unique.name)}</h3><p>${effectText(unique.details)}</p>` : undefined; }
  const terms: Record<string, [string, string]> = {
    reservation: ['Mana reservation', 'An assigned aura reserves part of maximum mana. Recovery cannot fill that part. Removing the aura frees capacity without restoring mana. Ranks improve power and reservation efficiency.'],
    spellweave: ['Spellweave', `<small>Passive · No skill slot</small><p>Melee hits empower your next damaging spell or magic bolt. Spell hits empower your next melee action.</p><p>${seconds}s · Refreshes, never stacks.</p><p>${effectTerm('empowered', 'Empowered actions')} · ${effectTerm('hybrid', 'Equipment')}</p>`],
    empowered: ['Empowered actions', 'Bonus damage applies to the whole action. Starting it spends the bonus, even if it misses. Failed activation keeps it.'],
    hybrid: ['Melee + magic', 'Sword + wand supports both. Its basic attacks alternate automatically when held. Bows and damage-over-time ticks do not prime Spellweave.'],
    afterguard: ['Afterguard', 'Blocking temporarily increases armor. Further blocks refresh the timer. Requires a shield.'],
    mitigation: ['Damage reduction', 'Stance reductions use the strongest active value. Armor and resistance still apply; wards absorb damage afterward.'],
    ward: ['Ward', `Absorbs incoming damage after ${effectTerm('mitigation', 'defenses')}. Ends when its time or absorption runs out.`],
    echo: ['Echo', `A delayed copy of an arrow action’s first arrow. Keeps its aim, critical chance, ${effectTerm('pierce', 'piercing')} and ${effectTerm('rebound', 'rebounds')}. Cannot restore life, apply statuses or create more echoes.`],
    pierce: ['Pierce', 'Continues through extra targets. Explosive projectiles still detonate on contact. Pierce does not add range or rebounds.'],
    rebound: ['Rebound', `Redirects a projectile to another nearby target. Additional targets restore reduced ${effectTerm('lifeOnHit', 'life on hit')}; repeat targets restore none.`],
    direct: ['Direct hit', 'Damage from an action’s contact, including projectiles and area hits. Periodic damage such as Burn is excluded.'],
    burn: ['Burn', `Periodic fire damage, ticking every 0.5s. Cannot crit or restore life. Reapplication keeps the strongest damage and longest remaining time; it does not stack.`],
    slow: ['Slowed', 'Reduces movement speed without preventing attacks. Reapplication keeps the strongest slow and longest remaining time. Bosses resist slows.'],
    freeze: ['Frozen', `Prevents movement and attacks while active. ${effectTerm('control', 'Control resistance')} can shorten it.`],
    stun: ['Stunned', `Prevents movement and attacks while active. ${effectTerm('control', 'Control resistance')} can shorten it.`],
    stagger: ['Stagger', `A brief interruption of movement and attacks. ${effectTerm('control', 'Control resistance')} can shorten or prevent it.`],
    control: ['Control resistance', 'Veterans, elites and bosses can shorten hard control and gain a brief rest from further interruptions. The icon shows the actual applied time.'],
    exposure: ['Exposure', 'Increases damage taken from the matching element. Elemental Resonance refreshes it on direct elemental contacts; periodic damage cannot apply it. Each element has its own timer.'],
    elemental: ['Weapon enchantment', `Added damage belongs to this weapon only. Fire applies ${effectTerm('burn','Burn')}, frost applies ${effectTerm('slow','Slow')}, and lightning can ${effectTerm('stagger','Interrupt')}. Scales with spell damage and the action’s potency.`],
    area: ['Area', 'Enlarges sweeps, novas and explosions. Radius grows by the square root of the area bonus: +20% area is about +9.5% radius. Does not extend projectile travel.'],
    ranks: ['Bonus ranks', 'Improve potency once the skill is learned. Equipment ranks do not raise casting costs or spend skill points. Purchased ranks and the selected casting rank remain separate.'],
    lifeOnHit: ['Life on hit', `Restores life per ${effectTerm('direct', 'direct hit')}. Chains restore 25% on additional targets and none on repeat targets. Periodic damage and Ghost Hunt echoes restore none.`],
    armor: ['Armor', `Reduces physical damage relative to the attacker’s level. Elemental damage uses ${effectTerm('resistance','resistance')} instead. ${effectTerm('block','Block')} applies afterward.`],
    resistance: ['Resistance', `Reduces matching elemental damage, up to 75%. Does not shorten statuses. ${effectTerm('block','Block')} applies afterward.`],
    block: ['Block', `Requires a usable shield. Active guard guarantees a block; otherwise block chance applies. Reduces damage after armor or resistance, before ${effectTerm('ward','wards')}.`],
    attackSpeed: ['Attack speed', 'Speeds up melee and bow actions. Paired basics alternate weapons. Magic bolts and magic skills use cast speed.'],
    castSpeed: ['Cast speed', 'Speeds up spells and basic staff/wand bolts. Does not shorten cooldowns.'],
    potion: ['Potion recovery', 'Increases both life and mana restored by the shared potion, up to missing resources. Charges and cooldown stay on Q.'],
    manaOnKill: ['Mana on kill', 'Restores mana immediately when an enemy dies, up to unreserved capacity.'],
    doctrine: ['Doctrine', 'Choose one option per family. Buying another replaces the current choice. Once paid, switching within that family is free and clears temporary skill buffs.'],
    measuredForce: ['Measured Force', `Cannot crit. Each percentage point of critical chance gives 1% more ${effectTerm('direct','direct damage')}, capped at 30%. Periodic damage is unaffected.`],
    openHand: ['Open Hand', 'Requires exactly one one-handed melee weapon with an empty offhand. Grants 20% more weapon damage and 8% movement; every other loadout has 10% less weapon damage.'],
    more: ['Borrowed Flame', `${effectTerm('spellweave','Spellweave')} actions gain a separate ×1.4 multiplier, beyond the ordinary 100% bonus cap. Also enables Spellweave by itself. All weapon and spell damage is ×0.85; together, an empowered action is ×1.19 before other Spellweave bonuses.`],
    overload: ['Arcane Overload', 'While enabled, Arcana skills deal 30% more damage and cost 60% more mana, including Tempest upkeep. Utility skills pay the extra cost without a damage benefit. Disable it in the skill atlas.'],
    tempest: ['Tempest', 'The storm spends mana each second while active. Its duration and upkeep are separate from the skill’s cooldown.'],
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

const STAT_TERMS: Record<string, string> = {
  spellweavePercent:'spellweave', spellweave:'spellweave', afterguardPercent:'afterguard', afterguard:'afterguard',
  fireDamage:'elemental', frostDamage:'elemental', lightningDamage:'elemental', areaPercent:'area', area:'area',
  projectilePierce:'pierce', pierce:'pierce', lifeOnHit:'lifeOnHit', armor:'armor', armorReduction:'armor',
  blockChance:'block', blockReduction:'block', activeGuard:'block', attackSpeedPercent:'attackSpeed', attackSpeedMultiplier:'attackSpeed', attackSpeed:'attackSpeed',
  castSpeedPercent:'castSpeed', castSpeedMultiplier:'castSpeed', castSpeed:'castSpeed', potionPercent:'potion', potion:'potion', manaOnKill:'manaOnKill', measuredForce:'measuredForce',
};
export function statTerm(id: string, label: string): string {
  const key = id.startsWith('skill:') ? 'ranks' : /Resistance$/.test(id) ? 'resistance' : STAT_TERMS[id];
  return key ? effectTerm(key, label) : '';
}
const WORD_TERMS: Record<string, string> = { 'Spellweave':'spellweave', 'Afterguard':'afterguard', 'Ward':'ward',
  'echoes':'echo', 'echo':'echo', 'piercing':'pierce', 'pierce':'pierce', 'rebounds':'rebound', 'rebound':'rebound',
  'direct hit':'direct', 'direct damage':'direct', 'Burn':'burn', 'slow':'slow', 'Freezes':'freeze', 'Frozen':'freeze', 'stunned':'stun', 'stun':'stun',
  'Interrupt':'stagger', 'area':'area', 'armor':'armor', 'resistance':'resistance', 'block':'block', 'life on hit':'lifeOnHit', 'damage reduction':'mitigation', 'pierces':'pierce', 'slows':'slow', 'slowing':'slow', 'freezing':'freeze', 'cast speed':'castSpeed', 'attack speed':'attackSpeed', 'Doctrine':'doctrine' };
/** Escapes authored text first; only complete glossary phrases become interactive markup. */
export function effectText(text: string): string {
  const words = Object.keys(WORD_TERMS).sort((a,b) => b.length-a.length).join('|');
  const seen = new Set<string>();
  return escapeUI(text).replace(new RegExp(`\\b(${words})\\b`, 'gi'), label => {
    const word = Object.keys(WORD_TERMS).find(key => key.toLowerCase() === label.toLowerCase())!;
    const term = WORD_TERMS[word]; if (seen.has(term) || seen.size >= 4) return label;
    seen.add(term); return effectTerm(term, label);
  });
}
