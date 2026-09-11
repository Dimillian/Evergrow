/** Read-only balance calculations. Observed cloud history is never treated as a current build. */
import { COMBAT_TIMING, ENEMY_DEFINITIONS } from './combat-content.ts';
import { itemPowerScale, monsterHealthScale, monsterDamageScale, type EnemyRank } from './progression-content.ts';
import { encounterRankChances } from './encounter-director.ts';
import { scaledEnemyStats } from './zone-progression.ts';
import { decodeCharacterSave, type CharacterSave } from './character-save.ts';
import { previewCharacter } from './character-summary.ts';
import { deriveAttackStats, alternatesBasicAttacks } from './equipment.ts';
import { resolveSkill } from './skill-progression.ts';
import { skillWeapon } from './skill-content.ts';
import { unlockedSkills } from './skill-tree.ts';
import { enemyRecoveryDuration } from './enemy-threat.ts';
import { chainLifeOnHitMultiplier } from './skill-execution-content.ts';
import { roamingPackBand, ROAMING_RULES } from './roaming-encounters.ts';
import type { EnemyKind } from './model.ts';

export interface CloudObservation {
  kind: 'cloud-observation'; name: string; level: number; updatedAt: number;
  gearPower?: number; summaryPower?: number; revision?: number;
  metrics: Record<string, number>; hasFullCheckpoint: false;
}
export interface AuditSample { observation?: CloudObservation; record?: CharacterSave }
export function readAuditSample(raw: string): AuditSample {
  if (raw.length > 24 * 1024 * 1024) throw new Error('Snapshot is too large.');
  const parsed = JSON.parse(raw);
  if (parsed?.kind === 'cloud-observation') {
    if (typeof parsed.name !== 'string' || parsed.name.length > 100 || !Number.isInteger(parsed.level)
      || parsed.level < 1 || parsed.level > 1e6 || !Number.isFinite(parsed.updatedAt)
      || !parsed.metrics || typeof parsed.metrics !== 'object' || Array.isArray(parsed.metrics)
      || Object.values(parsed.metrics).some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0)) throw new Error('Invalid cloud observation.');
    return { observation: { kind: 'cloud-observation', name: parsed.name, level: parsed.level,
      updatedAt: parsed.updatedAt, metrics: parsed.metrics, hasFullCheckpoint: false,
      ...Object.fromEntries(['gearPower','summaryPower','revision'].filter(key =>
        typeof parsed[key] === 'number' && Number.isFinite(parsed[key]) && parsed[key] >= 0).map(key => [key, parsed[key]])) } };
  }
  const candidate = parsed?.bundle?.character ?? parsed?.character ?? parsed;
  const record = decodeCharacterSave(JSON.stringify(candidate));
  if (!record) throw new Error('Choose a valid character save, save bundle, or cloud observation.');
  return { record };
}

export function powerGrowth(maxLevel = 100) {
  return Array.from({ length: Math.min(1000, Math.max(1, Math.floor(maxLevel))) }, (_, i) => {
    const level = i + 1, ranks = encounterRankChances(level);
    const band=roamingPackBand(level);
    return { level, packMin:band.min, packMax:band.max, weapon: itemPowerScale(level), monsterHp: monsterHealthScale(level),
      monsterHit: monsterDamageScale(level) / monsterDamageScale(1),
      // Isolates one attribute budget; not a reconstruction of any character.
      casterHit: itemPowerScale(level) * (1 + .03 * 3 * (level - 1)),
      enemyCadence: 1, veteranPercent: ranks.veteran * 100, elitePercent: ranks.elite * 100 };
  });
}
export function enemyAudit(level: number, kind: EnemyKind = 'stalker', rank: EnemyRank = 'normal') {
  const base = ENEMY_DEFINITIONS[kind], stats = scaledEnemyStats(kind, level, rank);
  const recovery = enemyRecoveryDuration({kind,rank},base.recovery);
  const cycle = base.windup + base.active + recovery;
  return { level, kind, rank, ...stats, windup: base.windup, recovery,
    idealAttacksPerSecond: 1 / cycle, rawIdealDps: stats.damage / cycle };
}
export function packPressure(level: number, kind: EnemyKind = 'stalker') {
  const enemy = enemyAudit(level, kind);
  return Array.from({ length: ROAMING_RULES.maxGroupSize }, (_, i) => {
    const count = i + 1, rate = count * enemy.idealAttacksPerSecond;
    return { count, rawDps: rate * enemy.damage,
      // Poisson arrivals with a non-extending damage-immunity window. This is an
      // analytical sensitivity estimate, not measured positioning or hit chance.
      guardedDps: rate / (1 + rate * COMBAT_TIMING.hurtGuard) * enemy.damage };
  });
}
export function exactBuildAudit(record: CharacterSave) {
  const p = previewCharacter(record), first = deriveAttackStats(p.stats, p.equipment.mainHand);
  const second = alternatesBasicAttacks(p.equipment) && p.equipment.offHand?.kind === 'weapon'
    ? deriveAttackStats(p.stats, p.equipment.offHand.weapon) : null;
  const crit = 1 + p.derived.critChance * (p.derived.critMultiplier - 1);
  const dps = (second ? (first.damage + second.damage) / (1 / first.attacksPerSecond + 1 / second.attacksPerSecond)
    : first.damage * first.attacksPerSecond) * crit;
  const weapon = skillWeapon('arcLightning', p.equipment);
  const learned = unlockedSkills(p.character.allocatedNodes).includes('arcLightning');
  const arc = resolveSkill('arcLightning', p.derived, p.character);
  const attack = weapon ? deriveAttackStats(p.stats, weapon) : null;
  const chain = attack && learned && arc.recipe.kind === 'chain' ? {
    rank: arc.rank, bonusRanks: arc.bonusRanks, specialization: arc.variant?.name ?? 'Original',
    damagePerFirstHit: attack.damage * arc.damageMultiplier * crit,
    maxContacts: arc.recipe.jumps, falloff: arc.recipe.falloff,
    castsPerSecond: Math.min(attack.attacksPerSecond, arc.cooldown > 0 ? 1 / arc.cooldown : Infinity),
    manaPerCast: arc.mana, lifeOnHit: p.derived.lifeOnHit,
    maximumLifeOnHitPerCast: p.derived.lifeOnHit * Array.from({length:arc.recipe.jumps},(_,i)=>chainLifeOnHitMultiplier(i,false)).reduce((a,b)=>a+b,0),
    revisits: !!arc.recipe.revisit,
  } : null;
  return { name: record.name, level: p.level, hp: p.maxHp, mana: p.maxMana, derived: p.derived,
    basicDps: dps, arc: chain,
    foes: (['normal', 'veteran', 'elite'] as const).map(rank => {
      const enemy = enemyAudit(p.level + (rank === 'elite' ? 2 : rank === 'veteran' ? 1 : 0), 'stalker', rank);
      return { ...enemy, basicDamageBudgetSeconds: enemy.maxHp / dps };
    }) };
}
export function buildPowerAudit(sample: AuditSample = {}) {
  const level = sample.record?.checkpoint.level ?? sample.observation?.level ?? 32;
  const metrics = sample.observation?.metrics;
  return { version: 1, sample: sample.observation ?? null,
    exactBuild: sample.record ? exactBuildAudit(sample.record) : null,
    observed: metrics ? {
      arcDamageShare: metrics.damage && metrics['skillDamage:arcLightning'] !== undefined ? metrics['skillDamage:arcLightning'] / metrics.damage : null,
      arcCastShare: metrics.casts && metrics['skillUses:arcLightning'] !== undefined ? metrics['skillUses:arcLightning'] / metrics.casts : null,
      damageTakenPerKill: metrics.kills && metrics.damageTaken !== undefined ? metrics.damageTaken / metrics.kills : null,
      minutesPlayed: metrics.time !== undefined ? metrics.time / 60 : null,
    } : null,
    growth: powerGrowth(), pressure: packPressure(level),
    enemies: [1, 12, 20, level, level + 3, 50, 100].filter((n, i, a) => a.indexOf(n) === i).sort((a,b) => a-b)
      .flatMap(n => (['stalker', 'brute', 'caster'] as const).map(kind => enemyAudit(n, kind))),
    assumptions: [
      'Cloud observations are cumulative history across levels and sessions, not current DPS, encounter exposure or a full equipment snapshot.',
      'Growth normalizes each quantity to level 1. Caster-hit curve isolates a same-quality same-level weapon and three Intelligence per level; no affixes, charms or tree.',
      'Ideal enemy cadence excludes pathing, idle time, missed attacks and control effects. Boss special patterns need their own encounter study.',
      'Pack pressure assumes identical normal Stalkers, every attack hitting, and independently timed arrivals. Before armor, resistance, block, recovery or dodging.',
      'Exact-build damage budgets, when a full save is supplied, exclude movement, overkill, mana downtime, temporary Spellweave and active combat buffs.',
    ] };
}
