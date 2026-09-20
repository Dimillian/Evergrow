import { AURA_RULES, resolveAura } from './aura-content.ts';
import { groundEffectPulseCount, skillDamageSuffix } from './skill-execution-content.ts';
import type { SkillId } from './character-types.ts';
import type { resolveSkill } from './skill-progression.ts';
import { escapeUI } from './ui-components.ts';
import { effectText } from './effect-terms.ts';

export type ResolvedSkill = ReturnType<typeof resolveSkill>;
export interface SkillEffectValue { key: string; label: string; value: string; note?: string; }
const n = (v: number) => String(Number(v.toFixed(2)));
const seconds = (v: number) => `${n(v)}s`;
const percent = (v: number) => `${n(v * 100)}%`;

/** Presentation of the selected recipe; values never depend on parsed prose or unrelated equipment. */
export function skillEffectValues(id: SkillId, resolved: ResolvedSkill): SkillEffectValue[] {
  const r = resolved.recipe, rows: SkillEffectValue[] = [];
  const add = (key: string, label: string, value: string, note?: string) => rows.push({ key, label, value, ...(note ? { note } : {}) });
  const slow = (factor: number, duration: number) => add('slow', 'Slow', percent(1 - factor), `For ${seconds(duration)}`);
  const protection = (value: number, duration: number) => add('protection', 'Hit damage taken', `−${percent(value)}`, `For ${seconds(duration)}`);
  if ('stun' in r && r.stun) add('stun', id === 'iceNova' || id === 'absoluteZero' ? 'Freeze' : 'Stun', seconds(r.stun));
  if ('slow' in r && r.slow) slow(r.slow.factor, r.slow.duration);
  switch (r.kind) {
    case 'projectile': {
      const e = r.effects;
      if (r.offsets.length > 1) add('projectiles', e.style === 'arrow' ? 'Arrows' : 'Projectiles', String(r.offsets.length), 'Per cast');
      if (e.blastRadius) add('radius', 'Explosion radius', `${n(e.blastRadius)} units`);
      if (e.pierce) add('pierce', 'Pierce', `${e.pierce} extra ${e.pierce === 1 ? 'target' : 'targets'}`);
      if (e.chain) add('chain', 'Rebounds', String(e.chain));
      if (e.slowDuration && e.slowFactor !== undefined) slow(e.slowFactor, e.slowDuration);
      if (e.burnDuration && e.burnDamageMultiplier) add('burn', 'Burn', `${percent(e.burnDamageMultiplier)} hit damage / s`, `For ${seconds(e.burnDuration)}`);
      if (e.groundDuration) add('ground-fire', 'Burning ground', e.groundDamageMultiplier ? `${percent(e.groundDamageMultiplier)} hit damage / s` : seconds(e.groundDuration), e.groundDamageMultiplier ? `For ${seconds(e.groundDuration)}` : undefined);
      if (e.lifeSteal) add('healing', 'Life restored', percent(e.lifeSteal), 'Of actual damage dealt');
      break;
    }
    case 'ground':
      add('radius', r.scatter ? 'Impact radius' : 'Area radius', `${n(r.radius)} units`);
      add('pulses', r.scatter ? 'Impacts' : 'Waves', String(r.scatter ?? groundEffectPulseCount(r)), r.duration ? `Every ${seconds(r.interval)} · ${seconds(r.duration)} duration` : undefined);
      if (r.delay) add('delay', 'Impact delay', seconds(r.delay));
      if (r.burn) add('burn', 'Burn', `${percent(r.burn.damageMultiplier)} hit damage / s`, `For ${seconds(r.burn.duration)}`);
      if (r.scorch) add('ground-fire', 'Burning ground', `${percent(r.scorch.damageMultiplier)} impact damage / s`, `For ${seconds(r.scorch.duration)}`);
      break;
    case 'sweep':
      add('reach', 'Reach', `${n(r.reachMultiplier)}× weapon reach`);
      add('arc', 'Sweep', `${Math.round(r.arc * 180 / Math.PI)}°`); break;
    case 'dash':
      add('travel', 'Travel', `${n(r.speed * r.duration)} units`, `Over ${seconds(r.duration)}`);
      add('radius', 'Contact radius', `${n(r.radius)} units`); break;
    case 'step':
      add('travel', r.retreat ? 'Retreat' : 'Travel', `${n(r.speed * r.duration)} units`, `Over ${seconds(r.duration)} · No invulnerability`);
      if (r.pierce) add('pierce', 'Pierce', `${r.pierce} extra targets`); break;
    case 'ward': add('barrier', 'Barrier', `${percent(r.fraction)} max life`, `Lasts ${seconds(r.duration)}`); break;
    case 'guard': add('block', 'Damage blocked', percent(r.reduction), `For ${seconds(r.duration)}`); break;
    case 'stance':
      if (r.reduction) protection(r.reduction, r.duration);
      if (r.charges) add('empowerment', r.echo ? 'Arrow echoes' : 'Empowered actions', String(r.charges), `${r.echo ? '' : '+'}${percent(r.bonus)} damage · Within ${seconds(r.duration)}`);
      break;
    case 'radial':
      add('radius', 'Area radius', `${n(r.radius)} units`);
      if (r.echo) add('echo', 'Nova', 'Repeats once');
      if (r.shelter) protection(r.shelter.reduction, r.shelter.duration); break;
    case 'cone':
      add('radius', 'Reach', `${n(r.radius)} units`);
      add('arc', 'Arc', `${Math.round(r.arc * 180 / Math.PI)}°`); break;
    case 'backstab':
      add('rear-damage', 'Rear damage', `${n(r.rearMultiplier)}×`);
      add('targets', 'Targets', String(r.targets ?? 1));
      add('reach', 'Reach', `${n(r.reachMultiplier)}× weapon reach`, `At least ${n(r.minRange)} units`); break;
    case 'chain':
      add('targets', 'Targets', String(r.jumps));
      add('chain-damage', 'Damage per jump', percent(r.falloff), 'Of the previous hit');
      add('reach', 'Jump range', `${n(r.range)} units`); break;
    case 'aura': {
      const { power } = resolveAura(r.aura, r.rank), pct = (value: number) => `${n(value)}%`;
      switch (r.aura) {
        case 'ironroot':
          add('armor', 'Armor', `+${pct(power)}`);
          add('protection', 'Physical hit damage taken', `−${pct(power / 8)}`); break;
        case 'bloodOath':
          add('empowerment', 'Melee damage', `+${pct(power)} per stack`, `Up to ${AURA_RULES.bloodStacks} stacks on one target`);
          add('duration', 'Stack duration', seconds(AURA_RULES.bloodDuration)); break;
        case 'hawkeye':
          add('arrows', 'Arrow speed & reach', `+${pct(power)}`);
          add('crit', 'Critical chance', `+${pct(power / 2)}`, `Beyond ${AURA_RULES.distantRange} units`); break;
        case 'thornbound':
          add('slow', 'Slow', pct(power), 'Half effect on bosses');
          add('radius', 'Area radius', `${AURA_RULES.thornRadius} units`); break;
        case 'elementalResonance':
          add('exposure', 'Exposure', `+${pct(power)} damage taken`, `Matching element · ${seconds(AURA_RULES.exposureDuration)}`); break;
        case 'stillwater':
          add('cost', 'Mana cost', `Up to −${pct(power)}`, `After ${seconds(AURA_RULES.stillDuration)} standing still`); break;
        case 'elementalSpikes':
          add('spikes', 'Spike damage', `${pct(power)} melee damage`, `Every ${seconds(AURA_RULES.pulseInterval)}`);
          add('radius', 'Area radius', `${AURA_RULES.spikeRadius} units`);
          add('elements', 'Elements', 'Fire → Frost → Lightning'); break;
      }
      break;
    }
    default: { const exhaustive: never = r; return exhaustive; }
  }
  if (resolved.upkeep) add('upkeep', 'Mana upkeep', `${n(resolved.upkeep)} / s`);
  return rows;
}

export function skillHeadlineValues(id: SkillId, resolved: ResolvedSkill): SkillEffectValue[] {
  const damage = resolved.damageMultiplier ? [{ key: 'damage', label: `Damage${skillDamageSuffix(id, resolved.recipe)}`, value: `${Math.round(resolved.damageMultiplier * 100)}%`, note: 'Of the compatible weapon hit, before target defenses' }] : [];
  return [...damage,
    { key: 'mana', label: resolved.reservation ? 'Mana reserved' : 'Mana', value: resolved.reservation ? `${n(resolved.reservation)}%` : n(resolved.mana) },
    { key: 'cooldown', label: resolved.reservation ? 'Activation' : 'Cooldown', value: resolved.reservation ? 'On skill bar' : resolved.cooldown ? seconds(resolved.cooldown) : 'None' },
  ];
}

export function skillValuesMarkup(id: SkillId, resolved: ResolvedSkill): string {
  const main = skillHeadlineValues(id, resolved);
  return `<div class="skill-value-headlines" style="--value-columns:${main.length}">${main.map(row => `<div${row.note ? ` title="${escapeUI(row.note)}"` : ''}><strong>${escapeUI(row.value)}</strong><span>${escapeUI(row.label)}</span></div>`).join('')}</div>${effectRowsMarkup(skillEffectValues(id, resolved))}`;
}
export function effectRowsMarkup(rows: readonly SkillEffectValue[]): string {
  return rows.length ? `<dl class="skill-effect-rows" aria-label="Skill effects">${rows.map(row => `<div><dt>${effectText(row.label)}</dt><dd><b>${escapeUI(row.value)}</b>${row.note ? `<small>${effectText(row.note)}</small>` : ''}</dd></div>`).join('')}</dl>` : '';
}
/** The same value model makes rank and Technique differences unambiguous. */
export function skillValueChangesMarkup(id: SkillId, before: ResolvedSkill, after: ResolvedSkill): string {
  const values = (r: ResolvedSkill) => [...skillHeadlineValues(id, r), ...skillEffectValues(id, r)];
  const previous = new Map(values(before).map(row => [row.key, row]));
  const following = new Map(values(after).map(row => [row.key, row]));
  const changed = [...new Set([...previous.keys(), ...following.keys()])].filter(key => {
    const a = previous.get(key), b = following.get(key);
    return a?.value !== b?.value || a?.note !== b?.note;
  });
  const value = (row: SkillEffectValue | undefined) => row ? `${escapeUI(row.value)}${row.note && row.key !== 'damage' ? `<small>${effectText(row.note)}</small>` : ''}` : '—';
  return changed.length ? `<dl class="skill-value-changes" aria-label="Value changes">${changed.map(key => `<div><dt>${effectText((following.get(key) ?? previous.get(key))!.label)}</dt><dd><span>${value(previous.get(key))}</span><i aria-label="to">→</i><b>${value(following.get(key))}</b></dd></div>`).join('')}</dl>` : '<p class="ui-muted">No numeric changes.</p>';
}
