import type { StatKey } from './character-types.ts';
import { STAT_LABELS, formatStatValue, createCharacterSheet } from './items.ts';
import { SKILL_TREE, type SkillNode } from './skill-tree.ts';
import { skillNodeOwner, skillNodeRole } from './skill-node-presentation.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { SKILL_EXECUTION, type SkillExecution } from './skill-execution-content.ts';
import { OVERLOAD_NODE, SKILL_SPECIALIZATIONS, resolveSkill, specializationNode } from './skill-progression.ts';

const ALIASES: Partial<Record<StatKey, string>> = {
  strength: 'str', dexterity: 'dex', intelligence: 'int', vitality: 'vit',
  maxHp: 'max health|hp|life pool', maxMana: 'max mana|mana pool', armor: 'armour|physical defense',
  damagePercent: 'weapon damage', spellDamagePercent: 'magic damage|caster damage',
  attackSpeedPercent: 'weapon speed', castSpeedPercent: 'casting speed|spell speed',
  critChance: 'critical strike chance|spell critical chance',
  critDamage: 'critical strike damage|critical multiplier|crit multi|spell critical damage',
  moveSpeedPercent: 'move speed|run speed|walk speed',
  manaRegen: 'mana regeneration|mana recovery|mp5|mana per 5 seconds',
  lifeRegen: 'life regeneration|health recovery|life per second',
  manaCostPercent: 'reduced mana costs|mana efficiency', cooldownPercent: 'cdr|recharge|skill recovery|dodge recharge',
  lifeOnHit: 'hit healing|loh', manaOnKill: 'kill mana',
  blockChance: 'shield block chance', blockReduction: 'shield absorption|block damage reduction',
  areaPercent: 'area of effect|aoe|radius', potionPercent: 'potion recovery|flask restoration|potion healing',
  projectilePierce: 'projectile pierce|piercing|arrow pierce|pierce count',
  spellweavePercent: 'spellweave|alternating attacks|melee spell combo',
  afterguardPercent: 'afterguard|armor after blocking|on block armor',
  fireResistance: 'fire resist|fire res', frostResistance: 'cold resistance|ice resistance|frost resist|cold res',
  lightningResistance: 'lightning resist|shock resistance|lightning res', arcaneResistance: 'arcane resist|spirit resistance|arcane res',
  allResistance: 'elemental resistance|all resist|all res',
  goldFindPercent: 'gold find', xpGainPercent: 'xp|exp|experience gain',
  fireDamage: 'flat fire damage', frostDamage: 'flat frost damage|added cold damage|added ice damage',
  lightningDamage: 'flat lightning damage',
};
const WORDS: Readonly<Record<string, string>> = {
  crit: 'critical', crits: 'critical', dmg: 'damage', regen: 'regeneration', regenerating: 'regeneration',
  pierces: 'pierce', piercing: 'pierce', pierced: 'pierce', projectiles: 'projectile', projective: 'projectile', arrows: 'projectile', arrow: 'projectile',
  health: 'life', hp: 'life', max: 'maximum', armour: 'armor', resist: 'resistance', resistances: 'resistance',
  costs: 'cost', seconds: 'sec', second: 'sec', ranks: 'rank', bonuses: 'bonus', percent: '', percentage: '',
};
export function normalizeAtlasSearch(value: string): string {
  return value.replace(/([a-z\d])([A-Z])/g, '$1 $2').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).map(word => WORDS[word] ?? word).filter(Boolean).join(' ');
}
const statAliases = new Map((Object.keys(STAT_LABELS) as StatKey[]).map(key => [key,
  [STAT_LABELS[key], key, ...(ALIASES[key]?.split('|') ?? [])].map(normalizeAtlasSearch)]));
const wordsMatch = (words: readonly string[], text: string): boolean => {
  const haystack = text.split(' ');
  return words.every(word => haystack.some(candidate => candidate === word || word.length >= 3 && candidate.startsWith(word)));
};
interface SearchEffect { stat: StatKey; reason: string; bonus: boolean; }
export interface AtlasSearchMatch { node: SkillNode; reason: string; stats: readonly StatKey[]; }
export interface AtlasSearchGroup { id: string; label: string; nodeIds: ReadonlySet<string>; }
const pierce = (recipe: SkillExecution) => recipe.kind === 'projectile' && !recipe.effects.blastRadius
  ? recipe.effects.pierce ?? 0 : recipe.kind === 'step' && recipe.shot ? recipe.pierce ?? 0 : 0;

function nodeEffects(node: SkillNode): SearchEffect[] {
  const effects: SearchEffect[] = (Object.entries(node.bonuses) as [StatKey, number][])
    .filter(([, value]) => value !== 0).map(([stat, value]) => ({ stat, bonus: true,
      reason: `${STAT_LABELS[stat]} ${formatStatValue(stat, value)}` }));
  const related = (stat: StatKey, reason: string) => effects.push({ stat, reason, bonus: false });
  if (node.skill && pierce(SKILL_EXECUTION[node.skill]) > 0)
    related('projectilePierce', 'Active skill · projectile pierces enemies');
  const variant = SKILL_SPECIALIZATIONS.find(v => v.id === node.specialization);
  if (variant) {
    // Resolve shared recipes in disposable memory; some variants have authored execution rules.
    const sheet = createCharacterSheet();
    sheet.allocatedNodes = ['origin', `skill:${variant.skill}`, specializationNode(variant.id)];
    sheet.skillSpecializations[variant.skill] = variant.id;
    const recipe = resolveSkill(variant.skill, { manaCostMultiplier: 1, cooldownMultiplier: 1 }, sheet, 1).recipe;
    const base = SKILL_DEFINITIONS[variant.skill];
    if (pierce(recipe) > pierce(SKILL_EXECUTION[variant.skill])) related('projectilePierce', `Technique · ${variant.description}`);
    if (variant.mana < 1) related('manaCostPercent', `Technique · ${variant.description}`);
    if (variant.cooldown < 1 && base.cooldown > 0) related('cooldownPercent', `Technique · ${variant.description}`);
    if (variant.damage > 1 && base.damageMultiplier > 0)
      related(base.domain === 'Arcana' ? 'spellDamagePercent' : 'damagePercent', `Technique · ${variant.description}`);
  }
  if (node.id === 'keystone:open-hand') for (const stat of ['damagePercent', 'moveSpeedPercent'] as const)
    related(stat, `Conditional keystone · ${node.description}`);
  if (node.id === OVERLOAD_NODE) related('spellDamagePercent', `Keystone · ${node.description}`);
  if (node.id === 'keystone:borrowed-flame') related('spellweavePercent', `Keystone · ${node.description}`);
  if (node.id === 'keystone:measured-force') related('critChance', `Critical tradeoff · ${node.description}`);
  return effects;
}

/** Build once from actual rewards. Cluster prose belongs to the whole group, not each minor. */
const index = SKILL_TREE.nodes.map(node => {
  const effects = nodeEffects(node);
  const identity = normalizeAtlasSearch(`${node.name} ${skillNodeRole(node)} ${skillNodeOwner(node)?.name ?? ''} ${node.domain} ${node.territory ?? ''} ${node.doctrine ?? ''}`);
  const effectText = effects.flatMap(effect => statAliases.get(effect.stat) ?? []).join(' ');
  const prose = node.role === 'cluster' || node.role === 'travel' ? '' : node.description;
  return { node, effects, identity, name: normalizeAtlasSearch(node.name), text: normalizeAtlasSearch(`${identity} ${effectText} ${prose}`) };
});

/** Multi-word queries are order-independent; known affixes require real bonus/mechanic evidence. */
export function searchSkillAtlas(query: string): AtlasSearchMatch[] {
  const normalized = normalizeAtlasSearch(query), words = normalized.split(' ').filter(Boolean);
  if (!words.length) return index.map(({ node }) => ({ node, reason: skillNodeRole(node), stats: [] }));
  const candidates = [...statAliases].filter(([key]) => !key.startsWith('skill:') || words.includes('rank') || normalized.startsWith('skill ')).map(([key, aliases]) => ({ key,
    score: Math.max(0, ...aliases.filter(alias => wordsMatch(words, alias)).map(alias => alias.split(' ').length === words.length ? 2 : 1)) }));
  const best = words.length > 1 ? Math.max(...candidates.map(candidate => candidate.score)) : 1;
  const stats = new Set(candidates.filter(candidate => candidate.score > 0 && candidate.score >= best).map(candidate => candidate.key));
  const specificResistance = stats.size === 1 && [...stats][0] !== 'allResistance' && [...stats][0].endsWith('Resistance') ? [...stats][0] : undefined;
  if (['fireResistance', 'frostResistance', 'lightningResistance', 'arcaneResistance'].some(key => stats.has(key as StatKey))) stats.add('allResistance');
  const matches: AtlasSearchMatch[] = [];
  for (const entry of index) {
    const effects = entry.effects.filter(effect => stats.has(effect.stat));
    const exactName = entry.name === normalized;
    if (!exactName && (stats.size ? !effects.length : !wordsMatch(words, entry.text))) continue;
    matches.push({ node: entry.node, stats: [...new Set(effects.map(effect => effect.stat === 'allResistance' && specificResistance ? specificResistance : effect.stat))],
      reason: effects.length ? effects.map(effect => effect.reason).join(' · ') : skillNodeRole(entry.node) });
  }
  return matches;
}

/** One selectable concept contains every matching node, irrespective of bonus value or node role. */
export function groupAtlasSearchMatches(query: string, matches: readonly AtlasSearchMatch[]): AtlasSearchGroup[] {
  if (!normalizeAtlasSearch(query) || !matches.length) return [];
  const groups = new Map<string, { id: string; label: string; nodeIds: Set<string> }>();
  for (const match of matches) for (const id of match.stats.length ? match.stats : ['query']) {
    const label = id === 'query' ? query.trim() : id === 'manaRegen' ? 'Mana regeneration' : id === 'lifeRegen' ? 'Life regeneration' : STAT_LABELS[id as StatKey];
    const group = groups.get(id) ?? { id, label, nodeIds: new Set<string>() };
    group.nodeIds.add(match.node.id); groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}
