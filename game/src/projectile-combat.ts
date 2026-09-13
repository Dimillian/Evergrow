import { AURA_RULES } from './aura-content.ts';
import { UNIQUE_RULES } from './unique-content.ts';
import { turnProjectile, storeBorrowedLife, hurtDecoy } from './unique-combat.ts';
import { projectileDamageType } from './resistance-content.ts';
import type { DamageType } from './model.ts';
import type { ProjectileStyle, HitSnapshot } from './model.ts';
import { strikeContainers, strikeContainerSegment, type ContainerAttackContext } from './breakable-containers.ts';
import type { GroundEffectRequest } from './ground-effects.ts';
import type { CombatEvent, Enemy, EnemyKind, Player, Projectile, WorldQuery } from './model.ts';
import { applySlow, applyBurn, applyStun } from './combat-status.ts';
import { PLAYER_PROJECTILE_FORGIVENESS } from './ranged-aim.ts';
import { segmentDistanceSquared } from './combat-geometry.ts';

export const MAX_PROJECTILES = 128;
export interface ProjectileContext {
  containers?: ContainerAttackContext;
  schedule(effect: GroundEffectRequest): void;
  player: Player; enemies: Enemy[]; world: WorldQuery;
  damage(enemy: Enemy, amount: number, angle: number, melee: boolean, style?: ProjectileStyle, offense?: HitSnapshot, authoredBurn?: boolean, elementalDamage?:number): void;
  hurt(amount: number, angle: number, sourceLevel: number, damageType: DamageType, sourceKind?: EnemyKind): void;
  onScreen(enemy: Enemy): boolean;
  visible(ax: number, ay: number, bx: number, by: number): boolean;
  emit(event: CombatEvent): void;
}

function hit(projectile: Projectile, enemy: Enemy, context: ProjectileContext): void {
  const effects = projectile.effects;
  const repeated=effects?.pursuit&&projectile.hitIds.has(enemy.id);
  projectile.hitIds.add(enemy.id);
  const lifeBefore = enemy.hp;
  let offense = repeated&&effects?.offense?{...effects.offense,lifeOnHit:0}:effects?.offense;
  if(offense&&effects?.hawkeye&&Math.hypot(enemy.x-effects.hawkeye.x,enemy.y-effects.hawkeye.y)>=AURA_RULES.distantRange)offense={...offense,critChance:Math.min(.75,offense.critChance+effects.hawkeye.crit)};
  context.damage(enemy, projectile.damage, projectile.angle, !!(effects?.thrownShield||effects?.fissureWidth), effects?.style,
    offense, effects?.burnDuration !== undefined, effects?.elementalDamage);
  if (enemy.state !== 'dead') {
    if(effects?.stunDuration)applyStun(enemy,effects.stunDuration);
    if (effects?.slowDuration) {
      applySlow(enemy, { duration: effects.slowDuration, factor: effects.slowFactor ?? .6 });
    }
    if (effects?.burnDuration) {
      applyBurn(enemy, { duration: effects.burnDuration, dps: effects.burnDps ?? 0 });
    }
  }
  const p = context.player;
  if (effects?.lifeSteal && !p.dead && !repeated) {
    const restoration=Math.max(0,lifeBefore-enemy.hp)*effects.lifeSteal;
    const healed = Math.min(p.maxHp - p.hp, restoration);
    if(projectile.skill==='siphon'&&effects.borrowedLife)storeBorrowedLife(p,restoration-healed);
    p.hp += healed;
    if (healed > 0) {
      context.emit({ type: 'heal', x: p.x, y: p.y, value: healed });
      context.emit({ type: 'chain', x: enemy.x, y: enemy.y, toX: p.x, toY: p.y, style: 'spirit', skill: projectile.skill, duration: .45 });
    }
  }
}

function shatter(projectile:Projectile,context:ProjectileContext):void {
  const e=projectile.effects,crystal=e?.shatter;if(!crystal)return;
  context.schedule({kind:'frost',crystal:true,x:projectile.x,y:projectile.y,radius:crystal.radius,delay:crystal.delay,
    duration:0,interval:1,damage:projectile.damage,skill:'frostLance',style:'frost',offense:e.offense,
    ...(e.slowDuration?{slow:{duration:e.slowDuration,factor:e.slowFactor??.6}}:{})});
  delete e.shatter;
}
function blast(projectile: Projectile, context: ProjectileContext): void {
  const radius = projectile.effects?.blastRadius ?? 0;
  context.emit({ type: 'blast', x: projectile.x, y: projectile.y, radius: radius || 14,
    style: projectile.effects?.style ?? 'arcane', skill: projectile.skill });
  if (projectile.skill && projectile.effects?.groundDuration) context.schedule({
    kind: 'embers', x: projectile.x, y: projectile.y, radius, delay: 0,
    duration: projectile.effects.groundDuration, interval: .25, damage: 0,
    burn: { duration: .5, dps: projectile.effects.groundDps ?? 0 },
    skill: projectile.skill, style: 'fire',
  });
  if (!radius) return;
  strikeContainers(context.containers, projectile.x, projectile.y, radius);
  for (const enemy of context.enemies) {
    if (enemy.state === 'dead' || projectile.hitIds.has(enemy.id)
      || Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) > radius + enemy.radius
      || !context.visible(projectile.x, projectile.y, enemy.x, enemy.y)) continue;
    hit(projectile, enemy, context);
  }
}

/** Prefer fresh contacts. A loop spends one existing rebound and snapshots its destination. */
function rebound(shot:Projectile,enemy:Enemy,context:ProjectileContext):boolean {
  const e=shot.effects;if(!e||(e.chain??0)<=0)return false;
  const eligible=context.enemies.filter(t=>context.onScreen(t)&&t.state!=='dead'
    &&Math.hypot(t.x-enemy.x,t.y-enemy.y)<=(e.chainRange??180)&&context.visible(shot.x,shot.y,t.x,t.y))
    .sort((a,b)=>Math.hypot(a.x-enemy.x,a.y-enemy.y)-Math.hypot(b.x-enemy.x,b.y-enemy.y)||a.id-b.id);
  const fresh=eligible.find(t=>!shot.hitIds.has(t.id)),next=fresh??(e.pursuit?eligible.find(t=>shot.hitIds.has(t.id)):undefined);
  if(!next)return false;
  e.chain!--;
  if(!fresh){
    e.pursuitLoop={target:next.id,x:shot.x,y:shot.y,toX:next.x,toY:next.y,angle:shot.angle,elapsed:0};
    shot.life=Math.max(shot.life,UNIQUE_RULES.pursuitTime+.05);delete shot.launch;
  } else {
    shot.angle=Math.atan2(next.y-shot.y,next.x-shot.x);
    const speed=Math.hypot(shot.vx,shot.vy);
    shot.vx=Math.cos(shot.angle)*speed;shot.vy=Math.sin(shot.angle)*speed;
    context.emit({type:'chain',x:shot.x,y:shot.y,toX:next.x,toY:next.y,style:e.style,skill:shot.skill});
  }
  return true;
}
/** Sweep the visible loop against scenery. Moving targets can evade the snapshotted endpoint. */
function advancePursuit(shot:Projectile,dt:number,context:ProjectileContext):void {
  const loop=shot.effects!.pursuitLoop!;
  const end=Math.min(UNIQUE_RULES.pursuitTime,loop.elapsed+dt);
  const steps=Math.max(1,Math.ceil((end-loop.elapsed)*(Math.hypot(loop.toX-loop.x,loop.toY-loop.y)+Math.PI*2*UNIQUE_RULES.pursuitRadius)/UNIQUE_RULES.pursuitTime/3));
  const start=loop.elapsed;
  for(let i=1;i<=steps;i++){
    const t=(start+(end-start)*i/steps)/UNIQUE_RULES.pursuitTime,a=t*Math.PI*2;
    const along=(1-Math.cos(a))*UNIQUE_RULES.pursuitRadius,side=Math.sin(a)*UNIQUE_RULES.pursuitRadius;
    const x=loop.x+(loop.toX-loop.x)*t+Math.cos(loop.angle)*along-Math.sin(loop.angle)*side;
    const y=loop.y+(loop.toY-loop.y)*t+Math.sin(loop.angle)*along+Math.cos(loop.angle)*side;
    if(context.world.blocked(x,y,shot.radius)||!context.visible(shot.x,shot.y,x,y)){
      context.emit({type:'surface-hit',x:shot.x,y:shot.y,angle:shot.angle,material:context.world.impactMaterial?.(x,y,shot.radius)??'stone',style:shot.effects?.style});
      shot.life=0;delete shot.effects!.pursuitLoop;return;
    }
    shot.angle=Math.atan2(y-shot.y,x-shot.x);shot.x=x;shot.y=y;
  }
  loop.elapsed=end;
  if(end+1e-9<UNIQUE_RULES.pursuitTime)return;
  delete shot.effects!.pursuitLoop;
  const target=context.enemies.find(t=>t.id===loop.target&&t.state!=='dead'&&context.onScreen(t)
    &&Math.hypot(t.x-shot.x,t.y-shot.y)<=t.radius+shot.radius+PLAYER_PROJECTILE_FORGIVENESS&&context.visible(shot.x,shot.y,t.x,t.y));
  if(!target){shot.life=0;return;}
  hit(shot,target,context);
  if(!rebound(shot,target,context))shot.life=0;
}

/** Bounded swept missiles; revisits require an explicit, finite Unique rebound budget. */
export function advanceProjectiles(projectiles: Projectile[], dt: number, context: ProjectileContext): void {
  const p = context.player;
  for (const projectile of projectiles) {
    projectile.life -= dt;
    if (projectile.life <= 0 && !turnProjectile(projectile)) continue;
    if(projectile.effects?.pursuitLoop){advancePursuit(projectile,dt,context);continue;}
    const steps = Math.max(1, Math.ceil(Math.hypot(projectile.vx, projectile.vy) * dt / 3));
    for (let i = 0; i < steps && projectile.life > 0; i++) {
      const oldX = projectile.x, oldY = projectile.y;
      projectile.x += projectile.vx * dt / steps;
      projectile.y += projectile.vy * dt / steps;
      if (projectile.owner === 'enemy' && context.world.isSanctuary?.(projectile.x, projectile.y)) { projectile.life = 0; break; }
      if (context.world.blocked(projectile.x, projectile.y, projectile.radius)) {
        const broken = projectile.owner === 'player' && strikeContainerSegment(context.containers, oldX, oldY, projectile.x, projectile.y, projectile.radius);
        if (!broken) context.emit({ type: 'surface-hit', x: oldX, y: oldY, angle: projectile.angle,
          material: context.world.impactMaterial?.(projectile.x, projectile.y, projectile.radius) ?? 'stone', style: projectile.effects?.style });
        projectile.x = oldX; projectile.y = oldY;
        if (projectile.owner === 'player') {shatter(projectile,context);blast(projectile, context);}
        if(!turnProjectile(projectile))projectile.life = 0; break;
      }
      if (projectile.owner === 'enemy') {
        const decoy=p.skillEffects?.decoy;
        const playerHit=segmentDistanceSquared(p.x,p.y,oldX,oldY,projectile.x,projectile.y)<=(projectile.radius+p.radius)**2;
        if(decoy&&decoy.hp>0&&segmentDistanceSquared(decoy.x,decoy.y,oldX,oldY,projectile.x,projectile.y)<=(projectile.radius+decoy.radius)**2
          &&(!playerHit||Math.hypot(decoy.x-oldX,decoy.y-oldY)<Math.hypot(p.x-oldX,p.y-oldY))){
          hurtDecoy(p,decoy.id,projectile.damage);context.emit({type:'blast',x:decoy.x,y:decoy.y,radius:12,style:'spirit'});projectile.life=0;continue;
        }
        if (segmentDistanceSquared(p.x, p.y, oldX, oldY, projectile.x, projectile.y) <= (projectile.radius + p.radius) ** 2) {
          context.hurt(projectile.damage, projectile.angle, projectile.sourceLevel, projectileDamageType(projectile.effects?.style ?? 'arcane'), projectile.sourceKind); projectile.life = 0;
        }
        continue;
      }
      const candidates = context.enemies.filter(enemy => enemy.state !== 'dead' && !projectile.hitIds.has(enemy.id)
        && segmentDistanceSquared(enemy.x, enemy.y, oldX, oldY, projectile.x, projectile.y) <= ((projectile.effects?.fissureWidth??projectile.radius) + enemy.radius + PLAYER_PROJECTILE_FORGIVENESS) ** 2
        && context.visible(oldX, oldY, enemy.x, enemy.y));
      if(projectile.effects?.fissureWidth){for(const enemy of candidates)hit(projectile,enemy,context);continue;}
      candidates.sort((a, b) => Math.hypot(a.x - oldX, a.y - oldY) - Math.hypot(b.x - oldX, b.y - oldY) || a.id - b.id);
      const enemy = candidates[0];
      if (!enemy) continue;
      hit(projectile, enemy, context);
      const effects = projectile.effects;
      if (effects?.blastRadius) { blast(projectile, context); projectile.life = 0; break; }
      if (rebound(projectile,enemy,context)) {
        if(effects?.pursuitLoop)break;
        continue;
      }
      if (effects && (effects.pierce ?? 0) > 0) { effects.pierce = (effects.pierce ?? 0) - 1; continue; }
      if(!turnProjectile(projectile)){shatter(projectile,context);blast(projectile, context); projectile.life = 0;}
    }
  }
}
