import { skillEffects, consumeRally, snapshotSkillOffense, queueSkillEcho } from './player-skill-effects.ts';
import { chainLifeOnHitMultiplier } from './skill-execution-content.ts';
import { metric } from './chronicle.ts';
import { consumeSpellweave } from './affix-combat.ts';
import { weaponImpactStyle } from './elemental-weapon.ts';
import type { ProjectileStyle, HitSnapshot, Projectile, WeaponLaunch } from './model.ts';
import { containerVisible, strikeContainers, type ContainerAttackContext } from './breakable-containers.ts';
import { skillTargetPoint } from './skill-target-point.ts';
import { resolveSkill } from './skill-progression.ts';
import type { CombatEvent, Enemy, GroundEffect, Player, ProjectileEffects, WorldQuery } from './model.ts';
import type { SkillId } from './character-types.ts';
import { skillWeapon, SKILL_DEFINITIONS } from './skill-content.ts';
import { unlockedSkills } from './skill-tree.ts';
import { deriveAttackStats } from './equipment.ts';
import { BASIC_ATTACK_PHASES, type ProjectileDefinition } from './combat-content.ts';
import { SKILL_TARGETING, type SkillExecution } from './skill-execution-content.ts';
import { applySlow, applyStun } from './combat-status.ts';
import { circleIntersectsSector } from './combat-geometry.ts';

export interface SkillContext {
  containers?: ContainerAttackContext;
  availableGroundEffects: number;
  availableProjectiles: number;
  player: Player; world: WorldQuery; enemies: Enemy[]; aimX: number; aimY: number;
  damage(enemy: Enemy, amount: number, angle: number, melee: boolean, style?: ProjectileStyle, elementalDamage?: number, offense?: HitSnapshot): void;
  onScreen(enemy: Enemy): boolean;
  visible(ax: number, ay: number, bx: number, by: number): boolean;
  projectile(x: number, y: number, angle: number, definition: ProjectileDefinition, skill: SkillId, effects?: ProjectileEffects): Projectile | void;
  schedule(effect: Omit<GroundEffect, 'id' | 'tick'>): void;
  emit(event: CombatEvent): void;
}

const angularDistance = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** Rules and effects for every active skill; simulation owns collision, damage and effect timing. */
export function activateSkill(context: SkillContext, slot: number): boolean {
  const { player: p, enemies } = context;
  if (!Number.isInteger(slot) || slot < 0 || slot >= 5 || p.dead || p.attack || p.dash || p.dodgeTime > 0 || p.castTime > 0) return false;
  const id = p.character.skillSlots[slot];
  if (!id || !unlockedSkills(p.character.allocatedNodes).includes(id)) return false;
  const weapon = skillWeapon(id, p.equipment);
  if (!weapon) return false;
  const definition = SKILL_DEFINITIONS[id];
  const costs = resolveSkill(id, p.derived, p.character);
  const recipe: SkillExecution = costs.recipe;
  const projectileSlots = recipe.kind === 'projectile' ? recipe.offsets.length : recipe.kind === 'step' && recipe.shot ? 1 : 0;
  const groundSlots = recipe.kind === 'ground' ? recipe.scatter ?? 1 : recipe.kind === 'radial' && recipe.echo ? 1
    : recipe.kind === 'projectile' && recipe.effects.groundDuration ? projectileSlots : 0;
  if (projectileSlots > context.availableProjectiles) return false;
  if (groundSlots > context.availableGroundEffects) return false;
  if ((p.skillCooldowns[id] ?? 0) > 0 || p.mana < costs.mana) return false;

  const attack = deriveAttackStats(p.stats, weapon);
  // Staff weapon derivation already applies spell bonuses; applying them here again would square scaling.
  const weave = !definition.damageMultiplier ? 1 : consumeSpellweave(p, definition.requirement === 'magic' ? 'spell' : weapon.attackKind === 'melee' ? 'melee' : 'other');
  const rally = definition.damageMultiplier ? consumeRally(p, weapon.attackKind === 'melee') : 1;
  const damage = attack.damage * costs.damageMultiplier * weave * rally;
  const offense: HitSnapshot = snapshotSkillOffense(p,id);
  let launch: WeaponLaunch | undefined;
  const color = definition.color;
  const hitStyle = 'style' in recipe ? recipe.style : weaponImpactStyle(weapon);
  const damageTarget = (enemy: Enemy, amount: number, angle: number, melee: boolean, contactOffense = offense) => context.damage(enemy, amount, angle, melee, hitStyle, weapon.attackKind === 'melee' ? attack.elementalDamage * (damage > 0 ? amount / attack.damage : 0) : undefined, contactOffense);
  const living = () => enemies.filter(enemy => enemy.state !== 'dead');
  const visible = (enemy: Enemy) => context.visible(p.x, p.y, enemy.x, enemy.y);
  const radial = (radius: number, hit: (enemy: Enemy, angle: number) => void) => {
    for (const enemy of living()) if (Math.hypot(enemy.x - p.x, enemy.y - p.y) <= radius + enemy.radius && visible(enemy)) {
      hit(enemy, Math.atan2(enemy.y - p.y, enemy.x - p.x));
    }
  };
  const blast = (radius: number, style?: ProjectileEffects['style']) => context.emit({ type: 'blast', x: p.x, y: p.y,
    skill: id, color, radius, duration: SKILL_TARGETING.blastDuration, ...(style ? { style } : {}) });
  const aimedPoint = () => skillTargetPoint(context.world,p,{x:context.aimX,y:context.aimY},attack.range);

  p.mana -= costs.mana; metric(p.chronicle,'manaSpent',costs.mana); metric(p.chronicle,'casts'); metric(p.chronicle,'skillUses:'+id);
  p.skillCooldowns[id] = costs.cooldown;
  p.activeSkill = id;
  if (recipe.kind === 'sweep') {
    const duration = 1 / attack.attacksPerSecond;
    p.attack = { kind: 'melee', offense, skill: id, specialization: costs.variant?.id, weapon, hand: weapon === p.equipment.mainHand ? 'main' : 'off', elapsed: 0, duration,
      activeStart: duration * BASIC_ATTACK_PHASES.activeStart, activeEnd: duration * BASIC_ATTACK_PHASES.activeEnd,
      angle: p.angle, range: attack.range * recipe.reachMultiplier,
      arc: recipe.arc, damage, elementalDamage: attack.elementalDamage * costs.damageMultiplier * weave * rally, hitIds: new Set() };
    context.emit({ type: 'swing', x: p.x, y: p.y, angle: p.angle, skill: id, color });
    return true;
  }

  p.castTime = 1 / attack.attacksPerSecond; p.castAngle = p.angle;
  switch (recipe.kind) {
    case 'step': {
      const angle=p.angle;
      p.dash={angle:angle+(recipe.retreat?Math.PI:0),remaining:recipe.duration,speed:recipe.speed,damage:0,radius:0,skill:id,hitIds:new Set()};
      p.castTime=recipe.duration;
      if(recipe.shot){
        const shotDef:ProjectileDefinition={owner:'player',speed:560,life:Math.max(.1,attack.range/560),radius:3,damage};
        const effects:ProjectileEffects={style:'arrow',offense,pierce:recipe.pierce};
        const shot=context.projectile(p.x,p.y,angle,shotDef,id,effects);if(shot)launch=shot.launch;
        queueSkillEcho(p,p.x,p.y,angle,shotDef,effects);
      }
      break;
    }
    case 'ward': p.castTime=.18; skillEffects(p).ward={remaining:recipe.duration,capacity:p.maxHp*recipe.fraction}; break;
    case 'stance': {
      p.castTime=.18;
      const key=id==='ghostHunt'?'ghostHunt':id==='rallyOfIron'?'rallyOfIron':'brace';
      skillEffects(p)[key]={remaining:recipe.duration,reduction:recipe.reduction,charges:recipe.charges,bonus:recipe.bonus};
      break;
    }
    case 'dash':
      p.dash = { angle: p.angle, remaining: recipe.duration, speed: recipe.speed, damage, offense, elementalDamage: attack.elementalDamage * costs.damageMultiplier * weave * rally, radius: recipe.radius, skill: id, style: hitStyle, hitIds: new Set() };
      p.castTime = Math.max(p.castTime, recipe.duration);
      break;
    case 'radial':
      if(recipe.shelter)(skillEffects(p).shelters??={})[id]={remaining:recipe.shelter.duration,reduction:recipe.shelter.reduction};
      if(!damage)p.castTime=.18;
      if(damage)strikeContainers(context.containers, p.x, p.y, recipe.radius);
      radial(recipe.radius, (enemy, angle) => {
        if(damage)damageTarget(enemy, damage, angle, recipe.melee);
        if (recipe.stun) applyStun(enemy, recipe.stun, recipe.style === 'frost' ? 'freeze' : 'stun');
        if (recipe.slow) applySlow(enemy, recipe.slow);
      });
      if (recipe.echo) context.schedule({ kind: 'frost', x: p.x, y: p.y, radius: recipe.radius * 1.2, delay: .6, duration: 0, interval: 1,
        damage: damage * .6, offense, skill: id, style: 'frost', slow: recipe.slow });
      blast(recipe.radius, recipe.style);
      break;
    case 'cone':
      context.emit({ type: 'skill-strike', x: p.x, y: p.y, skill: id, color, angle: p.angle, range: recipe.radius, arc: recipe.arc, rear: false });
      strikeContainers(context.containers, p.x, p.y, recipe.radius, p.angle, recipe.arc);
      for (const enemy of living()) if (circleIntersectsSector(enemy.x, enemy.y, enemy.radius, p.x, p.y, p.angle, recipe.radius, recipe.arc) && visible(enemy)) {
        damageTarget(enemy, damage, p.angle, true); applyStun(enemy, recipe.stun);
      }
      break;
    case 'guard': p.guardTime = Math.max(p.guardTime, recipe.duration); p.guardReduction = recipe.reduction; break;
    case 'backstab': {
      const targets = living().filter(enemy => circleIntersectsSector(enemy.x, enemy.y, enemy.radius, p.x, p.y, p.angle, Math.max(recipe.minRange, attack.range * recipe.reachMultiplier), recipe.arc) && visible(enemy))
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0,recipe.targets??1);
      for (const target of targets) {
        const behind = angularDistance(Math.atan2(p.y - target.y, p.x - target.x), target.angle) > recipe.rearAngle;
        const contactAngle=Math.atan2(target.y-p.y,target.x-p.x);
        damageTarget(target, damage * (behind ? recipe.rearMultiplier : 1), contactAngle, true);
        context.emit({ type: 'skill-strike', x: p.x, y: p.y, skill: id, color, angle: contactAngle, range: Math.hypot(target.x - p.x, target.y - p.y), arc: recipe.arc, rear: behind });
      }
      if (!targets.length) {
        const range = Math.max(recipe.minRange, attack.range * recipe.reachMultiplier);
        strikeContainers(context.containers, p.x, p.y, range, p.angle, recipe.arc);
        context.emit({ type: 'skill-strike', x: p.x, y: p.y, skill: id, color, angle: p.angle, range, arc: recipe.arc, rear: false });
      }
      break;
    }
    case 'projectile': {
      const { burnDamageMultiplier, groundDamageMultiplier, ...payload } = recipe.effects;
      const effects: ProjectileEffects = { ...payload, offense,
        ...(groundDamageMultiplier !== undefined ? { groundDps: damage * groundDamageMultiplier } : {}),
        ...(burnDamageMultiplier !== undefined ? { burnDps: damage * burnDamageMultiplier } : {}) };
      for (const [index,offset] of recipe.offsets.entries()) {
        const shot = context.projectile(p.x, p.y, p.angle + offset,
        { owner: 'player', speed: recipe.speed, life: Math.max(SKILL_TARGETING.minimumProjectileLife, attack.range / recipe.speed),
          radius: recipe.radius, damage }, id, effects);
        if (shot) launch ??= shot.launch;
        if(index===0)queueSkillEcho(p,p.x,p.y,p.angle+offset,{owner:'player',speed:recipe.speed,life:Math.max(SKILL_TARGETING.minimumProjectileLife,attack.range/recipe.speed),radius:recipe.radius,damage},effects);
      }
      break;
    }
    case 'ground': {
      const point = recipe.follow || recipe.effect === 'frost' ? { x: p.x, y: p.y } : aimedPoint();
      const count = recipe.scatter ?? 1;
      for (let i = 0; i < count; i++) {
        const angle = i * Math.PI * 2 / count, radius = i ? recipe.radius * (recipe.scatterRadiusMultiplier ?? .7) : 0;
        const candidate = { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius };
        const target = context.world.blocked(candidate.x, candidate.y, 1) || !context.visible(point.x, point.y, candidate.x, candidate.y) ? point : candidate;
        context.schedule({ kind: recipe.effect, ...target, radius: recipe.radius, delay: recipe.delay + i * .18,
          duration: recipe.duration, interval: recipe.interval, damage, offense, skill: id, style: recipe.style,
          follow: recipe.follow, upkeep: costs.upkeep, slow: recipe.slow, stun: recipe.stun,
          ...(recipe.scorch ? { scorch: { duration: recipe.scorch.duration, interval: recipe.scorch.interval, dps: damage * recipe.scorch.damageMultiplier } } : {}),
          ...(recipe.burn ? { burn: { duration: recipe.burn.duration, dps: damage * recipe.burn.damageMultiplier } } : {}) });
      }
      break;
    }
    case 'chain': {
      const point = aimedPoint(), hit = new Set<number>();
      let from = { x: p.x, y: p.y }, amount = damage;
      let next = living().filter(enemy => context.onScreen(enemy) && Math.hypot(enemy.x - p.x, enemy.y - p.y) <= attack.range + enemy.radius && visible(enemy))
        .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0];
      // In a quiet area, an aimed bolt can discharge into a nearby container.
      // Enemy chains retain their own target budget and never jump through scenery.
      if (!next && context.containers) {
        const target = [...context.world.getContainers?.(p.x, p.y, attack.range) ?? []]
          .filter(t => Math.hypot(t.x - point.x, t.y - point.y) <= t.radius + 40 && containerVisible(context.world, p.x, p.y, t))
          .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0];
        if (target) {
          context.emit({ type: 'chain', x: p.x, y: p.y, toX: target.x, toY: target.y, skill: id, color, style: recipe.style, duration: recipe.duration });
          context.containers.break(target, Math.atan2(target.y - p.y, target.x - p.x));
        }
      }
      for (let jump = 0; next && jump < recipe.jumps; jump++) {
        const target = next;
        context.emit({ type: 'chain', x: from.x, y: from.y, toX: target.x, toY: target.y, skill: id, color, style: recipe.style, duration: recipe.duration });
        damageTarget(target, amount, Math.atan2(target.y - from.y, target.x - from.x), false,
          { ...offense, lifeOnHit: offense.lifeOnHit * chainLifeOnHitMultiplier(jump, hit.has(target.id)) });
        hit.add(target.id); from = { x: target.x, y: target.y }; amount *= recipe.falloff;
        next = living().filter(enemy => context.onScreen(enemy) && enemy.id !== target.id && (recipe.revisit || !hit.has(enemy.id)) && Math.hypot(enemy.x - from.x, enemy.y - from.y) <= recipe.range + enemy.radius
          && context.visible(from.x, from.y, enemy.x, enemy.y))
          .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
      }
      break;
    }
    default: {
      // A new skill must implement behavior before its content can compile.
      const unimplemented: never = recipe;
      throw new Error(`Missing skill execution handler: ${unimplemented}`);
    }
  }
  p.castDuration = p.castTime;
  context.emit({ type: 'cast', x: p.x, y: p.y, angle: p.angle, skill: id, color, ...(launch ? { launch } : {}) });
  return true;
}
