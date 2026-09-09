import { isClothMaterial } from './item-materials.ts';
import type { ItemKind, SkillId, StatKey } from './character-types.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';

export interface AffixDefinition { name: string; stat: StatKey; base: number; growth: number; weight?: number }
export type SkillStat = `skill:${SkillId}`;
export const SKILL_STATS = Object.freeze(Object.fromEntries(Object.values(SKILL_DEFINITIONS).map(s => [`skill:${s.id}`, `${s.name} ranks`])) as Record<SkillStat, string>);
export const isSkillStat = (stat: string): stat is SkillStat => Object.hasOwn(SKILL_STATS, stat);
export const SKILL_AFFIXES: readonly AffixDefinition[] = Object.freeze(Object.values(SKILL_DEFINITIONS).map(s => Object.freeze({ name: s.name, stat: `skill:${s.id}` as SkillStat, base: 1, growth: 0 })));
export const SPECIAL_AFFIXES: readonly AffixDefinition[] = Object.freeze([
  { name: 'Wellsip', stat: 'manaOnKill', base: 2, growth: .12, weight: 1 },
  { name: 'Expanse', stat: 'areaPercent', base: 10, growth: .3, weight: .55 },
  { name: 'Deep Draught', stat: 'potionPercent', base: 12, growth: .35, weight: 1 },
  { name: 'Piercing', stat: 'projectilePierce', base: 1, growth: 0, weight: .12 },
  { name: 'Spellweave', stat: 'spellweavePercent', base: 16, growth: .4, weight: .18 },
  { name: 'Afterguard', stat: 'afterguardPercent', base: 20, growth: .5, weight: .55 },
].map(a => Object.freeze(a)) as AffixDefinition[]);
export const SPECIAL_AFFIX_LABELS = Object.freeze({ manaOnKill: 'Mana on kill', areaPercent: 'Area of effect', potionPercent: 'Potion restoration',
  projectilePierce: 'Projectile pierce', spellweavePercent: 'Spellweave damage', afterguardPercent: 'Armor after blocking' });
export const AFFIX_COMBAT_RULES = Object.freeze({ weaveDuration: 4, guardDuration: 3, maxBonusRanks: 10, maxPierce: 4, maxAreaPercent: 100 });
/** Quantiles use the saved affix roll. Enhancement never multiplies discrete ranks or pierce. */
export const SKILL_RANK_ROLLS = Object.freeze([
  { rank: 1, minimumLevel: 1, cumulative: .88 }, { rank: 2, minimumLevel: 12, cumulative: .98 },
  { rank: 3, minimumLevel: 30, cumulative: .997 }, { rank: 4, minimumLevel: 55, cumulative: .9997 },
  { rank: 5, minimumLevel: 80, cumulative: 1 },
].map(r => Object.freeze(r)));
export function skillAffixRank(roll: number, level: number): number {
  const rolled = SKILL_RANK_ROLLS.find(r => roll < r.cumulative)?.rank ?? 5;
  return Math.min(rolled, SKILL_RANK_ROLLS.filter(r => level >= r.minimumLevel).at(-1)?.rank ?? 1);
}
export function discreteAffixValue(stat: StatKey, roll: number, level: number): number | undefined {
  return isSkillStat(stat) ? skillAffixRank(roll, level) : stat === 'projectilePierce' ? 1 : undefined;
}
/** A single modest family weight is divided among relevant skills, not multiplied by skill count. */
export function skillAffixPool(item: { kind: ItemKind; weapon?: { family: string; damageType?: string }; focus?: { visual: { motif: string } }; recipe?:{materialId?:string} }): readonly (AffixDefinition & { weight: number })[] {
  const armor=['head','chest','gloves','legs','boots'].includes(item.kind), leather=armor&&item.recipe?.materialId==='leather';
  const family = item.weapon?.family, magic = armor&&isClothMaterial(item.recipe?.materialId) || family === 'wand' || family === 'staff' || item.kind === 'grimoire' || item.kind === 'orb';
  const budget = item.kind === 'weapon' ? .5 : item.kind === 'grimoire' || item.kind === 'orb' ? .45 : item.kind === 'shield' ? .35 : item.kind === 'head' ? .25 : item.kind === 'amulet' ? .4 : item.kind === 'ring' ? .18 : 0;
  if (!budget) return [];
  const element = item.weapon?.damageType ?? ({ ember: 'fire', rime: 'frost', astral: 'lightning' }[item.focus?.visual.motif ?? '']);
  const fire: SkillId[] = ['fireball', 'meteor', 'cataclysm'], frost: SkillId[] = ['iceNova', 'frostLance', 'absoluteZero'], lightning: SkillId[] = ['arcLightning', 'tempest'];
  const candidates = SKILL_AFFIXES.flatMap(a => {
    const id = a.stat.slice(6) as SkillId, s = SKILL_DEFINITIONS[id];
    const eligible = magic ? s.requirement === 'magic' : leather ? s.requirement==='bow'||s.requirement==='dagger'||s.requirement==='blade' : item.kind === 'shield' ? s.requirement === 'shield'
      : item.kind !== 'weapon' ? true : family === 'bow' ? s.requirement === 'bow'
      : s.requirement === 'melee' || s.requirement === 'blade' && ['sword', 'axe', 'dagger'].includes(family ?? '')
        || s.requirement === 'heavy' && ['axe', 'mace'].includes(family ?? '') || s.requirement === 'dagger' && family === 'dagger';
    if (!eligible) return [];
    const aligned = element === 'fire' ? fire.includes(id) : element === 'frost' ? frost.includes(id) : element === 'lightning' ? lightning.includes(id) : false;
    return [{ ...a, weight: (aligned ? 3 : 1) * (s.tier === 'ultimate' ? .25 : 1) }];
  });
  const total = candidates.reduce((n, a) => n + a.weight, 0);
  return candidates.map(a => ({ ...a, weight: a.weight / total * budget }));
}
