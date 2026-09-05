import { SKILL_CAST_MOTION } from './combat-content.ts';
import { drawGroundLoot, drawLootLabels } from './loot-art.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { ArtLibrary, drawHumanoid, getPlayerSwordTip, PLAYER_ART_SCALE } from './art.ts';
import type { CharacterPose } from './art.ts';
import { World } from './world.ts';
import { GroundLayer } from './ground-layer.ts';
import type { Simulation } from './simulation.ts';
import type { CombatEvent, Enemy } from './model.ts';
import { text } from './font.ts';
import { drawFloatingHUD } from './hud.ts';
import { ExperienceFeedback, type ExperienceDisplay } from './hud-experience.ts';
import { Lighting, drawGlow } from './lighting.ts';
import type { PointLight } from './lighting.ts';
import { CombatEffects } from './effects.ts';
import { playerPose } from './character-pose.ts';
import { SettlementArt } from './settlement-art.ts';
import { EnvironmentArt } from './environment-art.ts';
import { SceneVisibility } from './scene-visibility.ts';
import { isGameUIPoint } from './ui-hit-test.ts';
import type { GamePhase } from './game-phase.ts';
import { COMBAT_TIMING, ENEMY_DEFINITIONS } from './combat-content.ts';
import { CameraZoom, cameraView, screenToWorld, worldToScreen } from './camera.ts';
import { EnemyFocus } from './enemy-focus.ts';
import { drawEnemyPlate } from './enemy-plate.ts';

interface Corpse { x: number; y: number; angle: number; kind: Enemy['kind']; life: number; seed: number; }
interface Ghost { x: number; y: number; angle: number; gait: number; life: number; }
export interface RenderSettings {
  reducedMotion: boolean;
  phase: GamePhase; fps: number; debug: boolean;
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const TAU = Math.PI * 2;

export class Renderer {
  canvas = document.createElement('canvas');
  ctx = this.canvas.getContext('2d', { alpha: false })!;
  art = new ArtLibrary();
  width = 960;
  height = 600;
  cameraX = 0;
  cameraY = 0;
  pointerX = 0;
  pointerY = 0;
  pointerActive = true;
  shake = 0;
  hurt = 0;
  private kickX = 0;
  private kickY = 0;
  private cameraZoom = new CameraZoom();
  private view = cameraView(this.width, this.height, 0, 0, 1);
  private hurtAngle = 0;
  private damageTrails = new Map<number, { value: number; hold: number }>();
  private playerHealthTrail = 100;
  private playerHealthHold = 0;
  private experienceFeedback = new ExperienceFeedback();
  private experienceDisplay: ExperienceDisplay | undefined;
  private effects = new CombatEffects();
  private groundLayer = new GroundLayer();
  private settlementArt = new SettlementArt();
  private environmentArt = new EnvironmentArt();
  private visibility = new SceneVisibility();
  private get cachedBuildings() { return this.visibility.buildings; }
  private indoorBlend = 0;
  private lighting = new Lighting();
  private corpses: Corpse[] = [];
  private ghosts: Ghost[] = [];
  private ghostTimer = 0;
  private visualTime = 0;
  private get cachedProps() { return this.visibility.props; }
  private enemyFocus = new EnemyFocus();
  private focusedEnemy: Enemy | null = null;
  private plateEnemy: Enemy | null = null;
  private plateOpacity = 0;

  constructor() { this.resize(960, 600); }

  resize(width: number, height: number) {
    this.width = Math.round(width); this.height = Math.round(height);
    this.canvas.width = this.width; this.canvas.height = this.height;
    this.view = cameraView(this.width, this.height, this.cameraX, this.cameraY, this.cameraZoom.value);
    // Smooth subpixel sprite translation, with the deliberately coarse art preserved by its source.
    this.ctx.imageSmoothingEnabled = true;
    this.visibility.reset();
  }

  get worldHeight() { return this.view.height; }
  zoomByWheel(deltaY: number, deltaMode: number, viewportHeight: number) {
    this.cameraZoom.wheel(deltaY, deltaMode, viewportHeight);
  }
  screenToWorld(x: number, y: number) {
    // Input targets the last displayed frame, including its small impact impulse.
    return screenToWorld(this.view, x, y);
  }

  reset() {
    this.cameraX = 0; this.cameraY = 0; this.effects.reset();
    this.view = cameraView(this.width, this.height, 0, 0, this.cameraZoom.value);
    this.groundLayer.reset();
    this.settlementArt.reset(); this.indoorBlend = 0;
    this.corpses = []; this.ghosts = []; this.ghostTimer = 0;
    this.hurt = 0; this.shake = 0; this.kickX = this.kickY = 0;
    this.damageTrails.clear(); this.playerHealthTrail = 100; this.playerHealthHold = 0;
    this.experienceFeedback.reset(); this.experienceDisplay = undefined;
    this.enemyFocus.reset(); this.focusedEnemy = this.plateEnemy = null; this.plateOpacity = 0;
    this.visibility.reset();
  }

  handleEvents(events: CombatEvent[], reducedMotion: boolean) {
    this.effects.handleEvents(events);
    this.enemyFocus.noteHits(events);
    for (const e of events) {
      if (e.type === 'hit' && e.targetId !== undefined && e.remainingHp !== undefined) {
        const previous = this.damageTrails.get(e.targetId)?.value ?? 0;
        this.damageTrails.set(e.targetId, { value: Math.max(previous, e.remainingHp + (e.value ?? 0)), hold: .18 });
      }
      if (e.type === 'hurt') {
        this.hurt = reducedMotion ? .4 : .95; this.hurtAngle = e.angle ?? 0;
        this.playerHealthHold = .22;
        this.playerHealthTrail = Math.max(this.playerHealthTrail, (e.remainingHp ?? 0) + (e.value ?? 0));
      }
      if (!reducedMotion && (e.type === 'hit' || e.type === 'hurt' || e.type === 'kill')) {
        const strength = e.type === 'hurt' ? 5 : e.type === 'kill' ? 2 : 2.6;
        this.kickX = Math.max(-6, Math.min(6, this.kickX - Math.cos(e.angle ?? 0) * strength));
        this.kickY = Math.max(-5, Math.min(5, this.kickY - Math.sin(e.angle ?? 0) * strength * .7));
        this.shake = Math.max(this.shake, e.type === 'hurt' ? 1.6 : .65);
      }
      if (e.type === 'kill') this.corpses.push({ x: e.x, y: e.y, angle: e.angle ?? 0,
        kind: e.enemyKind ?? 'stalker', life: 18, seed: Math.random() * 100 });
    }
    if (this.corpses.length > 45) this.corpses.splice(0, this.corpses.length - 45);
  }

  render(sim: Simulation, world: World, dt: number, settings: RenderSettings) {
    const c = this.ctx, p = sim.player, active = settings.phase === 'playing';
    const step = active ? dt : 0, alpha = sim.interpolationAlpha;
    const feedbackStep = active || settings.phase === 'dead' ? dt : 0;
    this.experienceDisplay = this.experienceFeedback.update(p, feedbackStep, settings.reducedMotion);
    const px = lerp(p.prevX, p.x, alpha), py = lerp(p.prevY, p.y, alpha);
    this.visualTime += dt;
    this.shake *= Math.exp(-dt * 22); this.hurt *= Math.exp(-dt * 5);
    this.kickX *= Math.exp(-dt * 18); this.kickY *= Math.exp(-dt * 18);
    this.playerHealthHold -= feedbackStep;
    this.playerHealthTrail = Math.max(p.hp, this.playerHealthTrail);
    if (this.playerHealthHold <= 0) this.playerHealthTrail += (p.hp - this.playerHealthTrail) * (1 - Math.exp(-feedbackStep * 7));
    for (const [id, trail] of this.damageTrails) {
      const enemy = sim.enemies.find(e => e.id === id);
      if (!enemy || enemy.hp <= 0) { this.damageTrails.delete(id); continue; }
      trail.hold -= step;
      if (trail.hold <= 0) trail.value += (enemy.hp - trail.value) * (1 - Math.exp(-step * 8));
      if (Math.abs(trail.value - enemy.hp) < .2) this.damageTrails.delete(id);
    }
    if (active) {
      // Velocity-based lookahead does not swing the camera when the player merely aims.
      const follow = 1 - Math.exp(-dt * 11);
      this.cameraX += (px + p.vx * .07 - this.cameraX) * follow;
      this.cameraY += (py + p.vy * .05 - 15 - this.cameraY) * follow;
    }
    this.effects.update(sim, feedbackStep);
    for (const corpse of this.corpses) corpse.life -= step;
    for (const ghost of this.ghosts) ghost.life -= step;
    this.corpses = this.corpses.filter(corpse => corpse.life > 0);
    this.ghosts = this.ghosts.filter(ghost => ghost.life > 0);
    this.ghostTimer -= step;
    if (active && p.dodgeTime > 0 && this.ghostTimer <= 0) {
      this.ghostTimer = .024;
      this.ghosts.push({ x: px, y: py, angle: p.angle, gait: p.walkTime, life: .19 });
    }

    const shake = settings.reducedMotion ? 0 : this.shake;
    const zoom = this.cameraZoom.update(step, settings.reducedMotion);
    this.view = cameraView(this.width, this.height, this.cameraX, this.cameraY, zoom,
      (settings.reducedMotion ? 0 : this.kickX) + Math.sin(this.visualTime * 103) * shake,
      (settings.reducedMotion ? 0 : this.kickY) + Math.cos(this.visualTime * 127) * shake * .7);
    const { offsetX, offsetY, left, top, width: worldWidth, height: worldHeight } = this.view;
    this.focusedEnemy = this.enemyFocus.update(sim.enemies, this.view,
      this.pointerActive && !this.pointerOverHUD() ? { x: this.pointerX, y: this.pointerY } : null,
      alpha, dt, active && !p.dead);
    if (!active || p.dead) {
      this.plateEnemy = null; this.plateOpacity = 0;
    } else {
      if (this.focusedEnemy) this.plateEnemy = this.focusedEnemy;
      const opacity = this.focusedEnemy ? 1 : 0;
      this.plateOpacity = settings.reducedMotion ? opacity
        : opacity + (this.plateOpacity - opacity) * Math.exp(-dt * 20);
      if (this.plateOpacity < .01) this.plateEnemy = null;
    }
    this.visibility.update(world, this.view);
    this.settlementArt.update(this.cachedBuildings, px, py, dt, settings.reducedMotion);
    this.indoorBlend += ((world.getBuildingAt(px, py) ? 1 : 0) - this.indoorBlend) * (1 - Math.exp(-dt * 5));
    const biome = world.sampleBiome(px, py);
    c.fillStyle = '#101c22'; c.fillRect(0, 0, this.width, this.height);
    c.save(); c.translate(offsetX, offsetY); c.scale(zoom, zoom);
    this.groundLayer.draw(c, world, left, top, worldWidth, worldHeight);
    this.settlementArt.drawGround(c, this.cachedBuildings, this.visualTime);
    this.remains();
    this.propShadows();
    this.enemyFocusMark(alpha);
    for (const pickup of sim.pickups) {
      const y = pickup.y - 4 - Math.sin(sim.time * 3 + pickup.id) * 2;
      drawGlow(c, pickup.x, y, 24, pickup.kind === 'health' ? '#ff643b' : '#64baff', .45);
      c.save(); c.translate(pickup.x, y); c.rotate(Math.PI / 4);
      c.fillStyle = pickup.kind === 'health' ? '#ff9378' : '#98dbff'; c.fillRect(-2, -2, 4, 4); c.restore();
    }
    for (const ghost of this.ghosts) {
      c.save(); c.globalAlpha = ghost.life / .19 * .3; c.translate(ghost.x, ghost.y);
      drawHumanoid(c, { kind: 'player', angle: ghost.angle, time: sim.time, gaitPhase: ghost.gait,
        moving: 1, attack: 0, attackAngle: ghost.angle, weapon: p.equipment.mainHand.visual, hitFlash: .04, dodging: true });
      c.restore();
    }
    this.actorsAndProps(sim, px, py, alpha, settings);
    this.settlementArt.drawRoofs(c, this.cachedBuildings, this.visualTime);
    c.restore();

    const lights = this.sceneLights(sim, px, py, settings.reducedMotion);
    const weights = biome.weights, inside = this.indoorBlend;
    const ambient = `rgb(${Math.round((131 * weights.deadwood + 121 * weights.verdant + 114 * weights.swamp) * (1 - inside) + 116 * inside)},${Math.round((156 * weights.deadwood + 172 * weights.verdant + 160 * weights.swamp) * (1 - inside) + 119 * inside)},${Math.round((174 * weights.deadwood + 153 * weights.verdant + 159 * weights.swamp) * (1 - inside) + 141 * inside)})`;
    this.lighting.apply(c, this.width, this.height, left, top, lights, this.cachedProps, ambient, zoom);
    c.save(); c.translate(offsetX, offsetY); c.scale(zoom, zoom);
    // Emission is composed after surface illumination, so a hot core stays luminous.
    this.emitters(sim, px, py, alpha, lights);
    drawGroundLoot(c, sim.groundItems, sim.time);
    this.effects.drawSword(c);
    this.effects.draw(c);
    this.damageDirection(px, py);
    this.motes(left, top, worldWidth, worldHeight, sim.time, settings.reducedMotion);
    this.environmentArt.drawAmbient(c, weights, { x: left, y: top, width: worldWidth, height: worldHeight },
      this.visualTime, settings.reducedMotion);
    for (const enemy of sim.enemies) this.telegraph(enemy, alpha);
    this.healthBars(sim, alpha);
    c.restore();

    const vignette = c.createRadialGradient(this.width / 2, this.height * .46, this.height * .23,
      this.width / 2, this.height * .46, Math.max(this.width, this.height) * .7);
    vignette.addColorStop(0, '#04101900'); vignette.addColorStop(1, '#02081260');
    c.fillStyle = vignette; c.fillRect(0, 0, this.width, this.height);
    this.damageVignette(settings.reducedMotion);
  }

  /** Draw after world post-processing into the native-resolution transparent UI surface. */
  renderUI(c: CanvasRenderingContext2D, sim: Simulation, world: World, settings: RenderSettings) {
    const p = sim.player;
    // Project popup anchors, leaving their glyph size and outline independent of camera zoom.
    this.effects.drawNumbers(c, (x, y) => worldToScreen(this.view, x, y));
    drawLootLabels(c, sim.groundItems, (x, y) => worldToScreen(this.view, x, y), this.width, this.height);
    this.navigation(c, sim, world, settings);
    drawFloatingHUD(c, p, this.width, this.height, this.visualTime, {
      reducedMotion: settings.reducedMotion, healthTrail: this.playerHealthTrail / Math.max(1, p.maxHp),
      hitPulse: p.dead ? Math.min(1, this.hurt) : Math.min(1, p.hitFlash / COMBAT_TIMING.hitFlashDuration),
      experience: this.experienceDisplay,
    });
    if (this.plateEnemy && this.plateOpacity > .01) drawEnemyPlate(c, this.plateEnemy, this.width, this.height, {
      opacity: this.plateOpacity,
      healthTrail: this.damageTrails.get(this.plateEnemy.id)?.value ?? this.plateEnemy.hp,
      hitPulse: settings.reducedMotion ? 0 : Math.min(1, this.plateEnemy.hitFlash / COMBAT_TIMING.hitFlashDuration),
    });
    if (settings.phase === 'playing') this.cursor(c);
  }

  private enemyFocusMark(alpha: number) {
    const enemy = this.focusedEnemy;
    if (!enemy) return;
    const c = this.ctx, x = lerp(enemy.prevX, enemy.x, alpha), y = lerp(enemy.prevY, enemy.y, alpha);
    const radius = enemy.radius + 6;
    c.save(); c.globalAlpha = .65 * this.plateOpacity;
    c.strokeStyle = this.enemyFocus.hoveredId === enemy.id ? '#dfb68a' : '#b58366'; c.lineWidth = 1.1;
    for (let i = 0; i < 4; i++) {
      c.beginPath(); c.ellipse(x, y + 1, radius, radius * .46, 0, i * Math.PI / 2 + .14, i * Math.PI / 2 + 1.1); c.stroke();
    }
    c.restore();
  }

  private remains() {
    const c = this.ctx;
    for (const corpse of this.corpses) {
      c.save(); c.translate(corpse.x, corpse.y); c.rotate(corpse.angle);
      c.globalAlpha = Math.min(.75, corpse.life / 3); c.fillStyle = '#191c20';
      c.beginPath(); c.ellipse(0, 0, 21, 9, 0, 0, TAU); c.fill();
      c.strokeStyle = corpse.kind === 'caster' ? '#567f78' : '#887b67'; c.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        c.beginPath(); c.moveTo(-8 + i * 3, Math.sin(i + corpse.seed) * 5);
        c.lineTo(-4 + i * 3, Math.cos(i + corpse.seed) * 6); c.stroke();
      }
      c.restore();
    }
  }

  private propShadows() {
    const c = this.ctx;
    for (const prop of this.cachedProps) {
      if (prop.radius <= 0) continue;
      c.fillStyle = '#020a1080'; c.beginPath();
      c.ellipse(prop.x + 3, prop.y + 4, prop.kind === 'tree' ? 24 : 15, prop.kind === 'rock' ? 6 : 9, -.2, 0, TAU); c.fill();
    }
  }

  private actorsAndProps(sim: Simulation, px: number, py: number, alpha: number, settings: RenderSettings) {
    const c = this.ctx, p = sim.player;
    const entries: Array<{ y: number; draw: () => void }> = this.cachedProps.map(prop => ({ y: prop.y, draw: () => {
      const sprite = this.environmentArt.getSprite(prop) ?? (prop.kind === 'tree' || prop.kind === 'deadTree'
        ? this.art.getTree(prop.seed, prop.kind === 'deadTree') : prop.kind === 'rock' ? this.art.getRock(prop.seed) : this.art.getShrine());
      const wind = settings.reducedMotion || prop.kind === 'rock' || prop.kind === 'shrine' ? 0 : Math.sin(sim.time * .8 + prop.seed) * .7;
      const occludes = (prop.kind === 'tree' || prop.kind === 'deadTree' || prop.kind === 'willow') && py < prop.y + 8
        && py > prop.y - sprite.height * prop.scale && Math.abs(px - prop.x) < sprite.width * prop.scale * .38;
      c.save(); if (occludes) c.globalAlpha = .35;
      c.drawImage(sprite.image, prop.x - sprite.anchorX * prop.scale + wind, prop.y - sprite.anchorY * prop.scale,
        sprite.width * prop.scale, sprite.height * prop.scale); c.restore();
    } }));
    for (const building of this.cachedBuildings) {
      for (const layer of this.settlementArt.getStructureLayers(building, this.visualTime)) {
        entries.push({ y: layer.y, draw: () => layer.draw(c) });
      }
    }
    for (const enemy of sim.enemies) {
      if (enemy.hp <= 0) continue;
      const x = lerp(enemy.prevX, enemy.x, alpha), y = lerp(enemy.prevY, enemy.y, alpha);
      entries.push({ y, draw: () => this.actor(x, y, { kind: enemy.kind, angle: enemy.angle,
        time: sim.time + enemy.id, moveAngle: Math.atan2(enemy.vy, enemy.vx),
        moving: Math.min(1, Math.hypot(enemy.vx, enemy.vy) / 70),
        attack: enemy.state === 'windup' ? -Math.max(.001, enemy.stateTime / enemy.stateDuration)
          : enemy.state === 'attack' ? Math.min(1, enemy.stateTime / enemy.stateDuration) : 0,
        attackAngle: enemy.attackAngle, hitFlash: enemy.hitFlash,
        impact: Math.min(1, enemy.hitFlash / COMBAT_TIMING.hitFlashDuration), impactAngle: enemy.hitAngle, dodging: false }) });
    }
    entries.push({ y: py, draw: () => this.actor(px, py, playerPose(p, sim.time)) });
    entries.sort((a, b) => a.y - b.y);
    for (const entry of entries) entry.draw();
  }

  private actor(x: number, y: number, pose: CharacterPose) {
    const c = this.ctx;
    c.fillStyle = '#02091190'; c.beginPath();
    c.ellipse(x, y + 2, pose.kind === 'brute' ? 17 : pose.kind === 'player' ? 11 * PLAYER_ART_SCALE : 11, pose.kind === 'brute' ? 8 : 5, 0, 0, TAU); c.fill();
    c.save(); c.translate(x, y); if (pose.dead) c.globalAlpha = .4; drawHumanoid(c, pose); c.restore();
  }

  private sceneLights(sim: Simulation, px: number, py: number, reducedMotion: boolean): PointLight[] {
    const p = sim.player;
    const lights: PointLight[] = [{ x: px, y: py - 15, radius: 185, color: '#ffcf87', power: .58, shadows: true }];
    const buildingLights = this.settlementArt.getLights(this.cachedBuildings, this.visualTime)
      .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
    lights.push(...buildingLights.slice(0, 6));
    for (const prop of this.cachedProps) if (prop.kind === 'shrine') {
      const flicker = reducedMotion ? 1 : 1 + Math.sin(sim.time * 8 + prop.seed) * .035 + Math.sin(sim.time * 17) * .018;
      lights.push({ x: prop.x - 18, y: prop.y - 31, radius: 215 * flicker, color: '#ffa64f', power: .92, shadows: true });
    }
    if (p.equipment.mainHand.visual.kind !== 'unarmed' && p.attack && p.attack.elapsed >= p.attack.activeStart && p.attack.elapsed < p.attack.activeEnd + .05) {
      const a = p.attack;
      const tip = getPlayerSwordTip(playerPose(p, sim.time));
      lights.push({ x: px + tip.x, y: py + tip.y,
        radius: 105, color: p.equipment.mainHand.visual.glow ?? '#ffbf67',
        power: .55 * Math.sin(Math.PI * Math.min(1, (a.elapsed - a.activeStart) / (a.activeEnd - a.activeStart + .05))), shadows: true });
    }
    if (p.castTime > SKILL_CAST_MOTION.releaseRemaining) lights.push({ x: px + Math.cos(p.castAngle) * 17, y: py - 17,
      radius: 110, color: p.activeSkill ? SKILL_DEFINITIONS[p.activeSkill].color : '#c0acf0', power: (SKILL_CAST_MOTION.duration - p.castTime)
        / (SKILL_CAST_MOTION.duration - SKILL_CAST_MOTION.releaseRemaining) * .8 });
    if (p.healFlash > 0) lights.push({ x: px, y: py - 8, radius: 150, color: '#54e8b8', power: p.healFlash * .8 });
    lights.push(...this.effects.getLights());
    for (const shot of sim.projectiles.slice(0, 8)) lights.push({ x: shot.x, y: shot.y, radius: shot.owner === 'player' ? 115 : 85,
      color: shot.skill ? SKILL_DEFINITIONS[shot.skill].color : '#54e8b8', power: .85, shadows: true });
    for (const enemy of sim.enemies) if (enemy.hp > 0 && enemy.kind === 'caster') lights.push({ x: enemy.x, y: enemy.y - 22,
      radius: enemy.state === 'windup' ? 100 : 53, color: '#54e8b8', power: enemy.state === 'windup' ? .65 : .28 });
    return lights;
  }

  private emitters(sim: Simulation, px: number, py: number, alpha: number, lights: PointLight[]) {
    const c = this.ctx, p = sim.player;
    for (const prop of this.cachedProps) if (prop.kind === 'shrine') {
      const x = prop.x - 18, y = prop.y - 31;
      drawGlow(c, x, y, 72, '#ffad48', .4);
      drawGlow(c, x, y, 17, '#ff643b', .8);
      c.fillStyle = '#fff0b4'; c.fillRect(x - 1.5, y - 3, 3, 6);
    }
    for (const light of lights.slice(1, 12)) drawGlow(c, light.x, light.y, light.radius * .27, light.color, light.power * .2);
    if (p.castTime > SKILL_CAST_MOTION.releaseRemaining) {
      const charge = Math.max(.1, (SKILL_CAST_MOTION.duration - p.castTime)
        / (SKILL_CAST_MOTION.duration - SKILL_CAST_MOTION.releaseRemaining));
      const x = px + Math.cos(p.castAngle) * 17, y = py - 22 + Math.sin(p.castAngle) * 12;
      drawGlow(c, x, y, 37, '#ffad48', charge * .8);
      c.fillStyle = '#fff2c0'; c.beginPath(); c.arc(x, y, 1 + charge * 3, 0, TAU); c.fill();
    }
    for (const shot of sim.projectiles) {
      const x = lerp(shot.prevX, shot.x, alpha), y = lerp(shot.prevY, shot.y, alpha);
      const friendly = shot.owner === 'player';
      const color = shot.skill ? SKILL_DEFINITIONS[shot.skill].color : '#54e8b8';
      drawGlow(c, x, y, friendly ? 40 : 27, color, .65);
      c.save(); c.translate(x, y); c.rotate(shot.angle);
      c.fillStyle = color;
      c.beginPath(); c.moveTo(shot.radius + 1, 0); c.quadraticCurveTo(-5, -7, -25, 0);
      c.quadraticCurveTo(-5, 7, shot.radius + 1, 0); c.fill();
      c.fillStyle = '#fff5c9'; c.beginPath(); c.ellipse(0, 0, shot.radius, shot.radius * .65, 0, 0, TAU); c.fill();
      c.restore();
    }
  }

  private motes(left: number, top: number, width: number, height: number, time: number, reducedMotion: boolean) {
    const c = this.ctx, cell = 140, t = reducedMotion ? 0 : time;
    // Anchoring each emitter to a world cell avoids screen-relative swimming or pop-in.
    for (let iy = Math.floor(top / cell) - 1; iy <= Math.floor((top + height) / cell) + 1; iy++) {
      for (let ix = Math.floor(left / cell) - 1; ix <= Math.floor((left + width) / cell) + 1; ix++) {
        const seed = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453, phase = (seed - Math.floor(seed)) * TAU;
        const x = ix * cell + 70 + Math.sin(t * .3 + phase) * 35;
        const y = iy * cell + 70 + Math.cos(t * .4 + phase * 2) * 25;
        const power = .2 + (Math.sin(t * 1.3 + phase) + 1) * .22;
        const color = (ix + iy) % 3 === 0 ? '#ffad48' : '#54e8b8';
        c.globalAlpha = 1;
        drawGlow(c, x, y, 12, color, power * .5);
        c.globalAlpha = power; c.fillStyle = color; c.fillRect(x, y, 1.2, 1.2);
      }
    }
    c.globalAlpha = 1;
  }

  private telegraph(enemy: Enemy, alpha: number) {
    if (enemy.state !== 'windup' && enemy.state !== 'attack') return;
    const c = this.ctx, t = enemy.state === 'attack' ? 1 : Math.min(1, enemy.stateTime / Math.max(.01, enemy.stateDuration));
    const x = lerp(enemy.prevX, enemy.x, alpha), y = lerp(enemy.prevY, enemy.y, alpha);
    c.save();
    const definition = ENEMY_DEFINITIONS[enemy.kind];
    if (definition.attack === 'projectile') {
      c.strokeStyle = `rgba(113,255,184,${.12 + t * .4})`; c.lineWidth = 1; c.setLineDash([3, 5]);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(enemy.attackAngle) * 290, y + Math.sin(enemy.attackAngle) * 290); c.stroke();
    } else {
      const { range, arc } = definition;
      c.fillStyle = `rgba(255,102,58,${.025 + t * .09})`; c.strokeStyle = `rgba(255,160,83,${.22 + t * .62})`;
      c.lineWidth = enemy.kind === 'brute' ? 1.5 : 1;
      c.beginPath(); c.moveTo(x, y); c.arc(x, y, range, enemy.attackAngle - arc / 2, enemy.attackAngle + arc / 2); c.closePath(); c.fill(); c.stroke();
      if (enemy.kind === 'brute') {
        c.strokeStyle = '#ffc579'; c.beginPath(); c.arc(x, y, range * (.4 + t * .6), enemy.attackAngle - arc / 2, enemy.attackAngle + arc / 2); c.stroke();
      }
    }
    c.restore();
  }

  private healthBars(sim: Simulation, alpha: number) {
    const c = this.ctx;
    for (const enemy of sim.enemies) {
      if (enemy.hp <= 0 || (enemy.hp >= enemy.maxHp && enemy.state !== 'windup')) continue;
      const width = enemy.kind === 'brute' ? 40 : 31;
      const x = lerp(enemy.prevX, enemy.x, alpha), y = lerp(enemy.prevY, enemy.y, alpha) - (enemy.kind === 'brute' ? 53 : 43);
      c.fillStyle = enemy.hitFlash > .1 ? '#efcea0' : '#080c12';
      c.fillRect(x - width / 2 - 1, y - 1, width + 2, 5);
      c.fillStyle = '#482a29'; c.fillRect(x - width / 2, y, width, 3);
      const trail = Math.min(enemy.maxHp, this.damageTrails.get(enemy.id)?.value ?? enemy.hp);
      c.fillStyle = '#edc582'; c.fillRect(x - width / 2, y, width * trail / enemy.maxHp, 3);
      c.fillStyle = enemy.kind === 'caster' ? '#7bb59c' : '#c45f54';
      c.fillRect(x - width / 2, y, width * enemy.hp / enemy.maxHp, 3);
    }
  }

  private damageDirection(x: number, y: number) {
    if (this.hurt < .04) return;
    const c = this.ctx, radius = 32 + (1 - this.hurt) * 12;
    const source = this.hurtAngle + Math.PI;
    c.save(); c.globalAlpha = this.hurt * .8; c.strokeStyle = '#ff8168'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(x, y - 13, radius, source - .58, source + .58); c.stroke();
    c.lineWidth = 1; c.globalAlpha *= .45;
    c.beginPath(); c.arc(x, y - 13, radius + 5, source - .38, source + .38); c.stroke();
    c.restore();
  }

  private damageVignette(reducedMotion: boolean) {
    if (this.hurt < .02) return;
    const c = this.ctx;
    const radius = Math.hypot(this.width, this.height) * .55;
    const gradient = c.createRadialGradient(this.width / 2, this.height / 2, radius * .28,
      this.width / 2, this.height / 2, radius);
    gradient.addColorStop(0, '#ac1f2700'); gradient.addColorStop(.6, '#ac1f2700'); gradient.addColorStop(1, '#df3437');
    c.save(); c.globalAlpha = this.hurt * (reducedMotion ? .13 : .25);
    c.fillStyle = gradient; c.fillRect(0, 0, this.width, this.height); c.restore();
  }

  private navigation(c: CanvasRenderingContext2D, sim: Simulation, world: World, settings: RenderSettings) {
    const p = sim.player;
    const building = world.getBuildingAt(p.x, p.y);
    const town = world.getSettlements(p.x - 1, p.y - 1, 2, 2).find(town => Math.hypot(p.x - town.x, p.y - town.y) <= town.radius);
    text(c, building?.name ?? town?.name ?? world.sampleBiome(p.x, p.y).name, 22, 22, 1.2, '#d7c99d');
    text(c, world.isSanctuary(p.x, p.y) ? 'SANCTUARY' : String(sim.kills).padStart(2, '0') + ' SLAIN',
      22, 37, 1, '#91b69e');
    if (settings.debug) text(c, `${Math.round(settings.fps)} FPS / ${sim.enemies.length} MOBS / ${Math.round(p.x)},${Math.round(p.y)}`,
      22, this.height - 18, 1, '#a3c7a7');
  }

  private pointerOverHUD() {
    return isGameUIPoint(this.pointerX, this.pointerY, this.width, this.height);
  }

  private cursor(c: CanvasRenderingContext2D) {
    if (!this.pointerActive || this.pointerOverHUD()) return;
    const x = this.pointerX, y = this.pointerY;
    c.strokeStyle = this.enemyFocus.hoveredId === null ? '#ded5a9bb' : '#efb398'; c.lineWidth = 1; c.beginPath();
    c.moveTo(x - 6, y); c.lineTo(x - 3, y); c.moveTo(x + 3, y); c.lineTo(x + 6, y);
    c.moveTo(x, y - 6); c.lineTo(x, y - 3); c.moveTo(x, y + 3); c.lineTo(x, y + 6); c.stroke();
    c.fillStyle = '#fff0bb'; c.fillRect(x, y, 1, 1);
  }
}
