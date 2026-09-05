import { BiomeLife } from './biome-life.ts';
import { BiomeLifeArt } from './biome-life-art.ts';
import { biomeWind } from './biome-wind.ts';
import { AtmosphereArt } from './atmosphere-art.ts';
import { GroundDressing } from './ground-art.ts';
import { SKILL_CAST_MOTION } from './combat-content.ts';
import { drawGroundLoot, drawLootLabels } from './loot-art.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { ArtLibrary, drawHumanoid, getPlayerSwordTip, PLAYER_ART_SCALE } from './art.ts';
import type { CharacterPose } from './art.ts';
import { World } from './world.ts';
import { GroundLayer } from './ground-layer.ts';
import type { Simulation } from './simulation.ts';
import type { CombatEvent, Enemy, Player } from './model.ts';
import { text } from './font.ts';
import { drawFloatingHUD } from './hud.ts';
import { ExperienceFeedback, type ExperienceDisplay } from './hud-experience.ts';
import { Lighting, drawGlow } from './lighting.ts';
import type { PointLight } from './lighting.ts';
import { CombatEffects } from './effects.ts';
import { playerPose } from './character-pose.ts';
import { drawProjectile, projectileLight } from './projectile-art.ts';
import { drawCharacterStatus } from './status-art.ts';
import { SettlementArt } from './settlement-art.ts';
import { EnvironmentArt } from './environment-art.ts';
import { biomeAmbient } from './biomes.ts';
import { propDefinition } from './biome-props.ts';
import { SceneVisibility } from './scene-visibility.ts';
import { isGameUIPoint } from './ui-hit-test.ts';
import type { GamePhase } from './game-phase.ts';
import { COMBAT_TIMING, ENEMY_DEFINITIONS, PLAYER_ABILITIES, PLAYER_MOVEMENT } from './combat-content.ts';
import { CAMERA_FOLLOW, CameraZoom, cameraFollowTarget, cameraSpawnExclusion,
  cameraView, screenToWorld, worldToScreen } from './camera.ts';
import { EnemyFocus, ENEMY_BODY_BOUNDS } from './enemy-focus.ts';
import { drawEnemyPlate } from './enemy-plate.ts';
import { drawRankCrest } from './enemy-rank-art.ts';
import { drawSiteGround, drawSiteDecor, wildernessLights } from './wilderness-art.ts';

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
  private lastDisplayedView = this.view;
  private hurtAngle = 0;
  private damageTrails = new Map<number, { value: number; hold: number }>();
  private playerHealthTrail = 100;
  private playerHealthHold = 0;
  private experienceFeedback = new ExperienceFeedback();
  private experienceDisplay: ExperienceDisplay | undefined;
  private effects = new CombatEffects();
  private groundLayer = new GroundLayer();
  private groundDressing = new GroundDressing();
  private settlementArt = new SettlementArt();
  private environmentArt = new EnvironmentArt();
  private atmosphere = new AtmosphereArt();
  private biomeLife = new BiomeLife();
  private biomeArt = new BiomeLifeArt();
  private crownOpacity = new Map<string, number>();
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
  get worldBounds() { return { x: this.view.left, y: this.view.top, width: this.view.width, height: this.view.height }; }
  spawnExclusionBounds(player: Player) {
    const speed = Math.max(PLAYER_MOVEMENT.speed * player.derived.moveSpeedMultiplier,
      PLAYER_ABILITIES.dodge.speed, player.dash?.speed ?? 0);
    // Skill dashes move positions directly while regular velocity is zero.
    const subject = player.dash ? { x: player.x, y: player.y,
      vx: Math.cos(player.dash.angle) * player.dash.speed,
      vy: Math.sin(player.dash.angle) * player.dash.speed } : player;
    return cameraSpawnExclusion(this.width, this.height, this.cameraX, this.cameraY,
      this.cameraZoom.value, this.cameraZoom.target, this.lastDisplayedView, subject, speed);
  }
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
    this.lastDisplayedView = this.view;
    this.groundLayer.reset(); this.groundDressing.reset(); this.biomeLife.reset(); this.crownOpacity.clear(); this.visualTime = 0;
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
      if (e.type === 'hit') {
        const previous = this.damageTrails.get(e.targetId)?.value ?? 0;
        this.damageTrails.set(e.targetId, { value: Math.max(previous, e.remainingHp + e.value), hold: .18 });
      }
      if (e.type === 'hurt') {
        this.hurt = reducedMotion ? .4 : .95; this.hurtAngle = e.angle;
        this.playerHealthHold = .22;
        this.playerHealthTrail = Math.max(this.playerHealthTrail, e.remainingHp + e.value);
      }
      if (!reducedMotion && (e.type === 'hit' || e.type === 'hurt' || e.type === 'kill')) {
        const strength = e.type === 'hurt' ? 5 : e.type === 'kill' ? 2 : 2.6;
        this.kickX = Math.max(-6, Math.min(6, this.kickX - Math.cos(e.angle) * strength));
        this.kickY = Math.max(-5, Math.min(5, this.kickY - Math.sin(e.angle) * strength * .7));
        this.shake = Math.max(this.shake, e.type === 'hurt' ? 1.6 : .65);
      }
      if (e.type === 'kill') this.corpses.push({ x: e.x, y: e.y, angle: e.angle,
        kind: e.enemyKind, life: 18, seed: Math.random() * 100 });
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
      const follow = 1 - Math.exp(-dt * CAMERA_FOLLOW.response);
      const target = cameraFollowTarget({ x: px, y: py, vx: p.vx, vy: p.vy });
      this.cameraX += (target.x - this.cameraX) * follow;
      this.cameraY += (target.y - this.cameraY) * follow;
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
    this.lastDisplayedView = this.view;
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
    this.biomeLife.update(dt, this.visualTime, this.cachedProps, { x: px, y: py, vx: p.vx, vy: p.vy },
      settings.reducedMotion, (x, y) => world.sampleGroundContact(x, y));
    c.fillStyle = '#101c22'; c.fillRect(0, 0, this.width, this.height);
    c.save(); c.translate(offsetX, offsetY); c.scale(zoom, zoom);
    this.groundLayer.draw(c, world, left, top, worldWidth, worldHeight);
    for (const site of this.visibility.sites) drawSiteGround(c, site, settings.reducedMotion ? 0 : this.visualTime);
    this.settlementArt.drawGround(c, this.cachedBuildings, this.visualTime);
    this.remains();
    this.groundDressing.draw(c, this.cachedProps, this.view);
    this.biomeArt.drawGround(c, this.biomeLife, this.cachedProps, this.visualTime, settings.reducedMotion, this.view);
    this.atmosphere.drawWater(c, this.cachedProps, this.visualTime, settings.reducedMotion);
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
    this.actorsAndProps(sim, px, py, alpha, dt, settings);
    this.settlementArt.drawRoofs(c, this.cachedBuildings, this.visualTime);
    c.restore();

    const lights = this.sceneLights(sim, px, py, settings.reducedMotion);
    const weights = biome.weights, inside = this.indoorBlend;
    const ambientChannels = biomeAmbient(weights).map((value, channel) =>
      Math.round(value * (1 - inside) + [116, 119, 141][channel] * inside));
    const ambient = `rgb(${ambientChannels.join(',')})`;
    this.lighting.apply(c, this.width, this.height, left, top, lights, this.cachedProps, ambient, zoom);
    c.save(); c.translate(offsetX, offsetY); c.scale(zoom, zoom);
    this.biomeArt.drawLight(c, this.cachedProps, this.visualTime, settings.reducedMotion, px, py);
    this.biomeArt.drawAir(c, this.biomeLife, this.visualTime, settings.reducedMotion);
    this.atmosphere.drawMist(c, this.cachedProps, this.visualTime, settings.reducedMotion, px, py);
    // Emission is composed after surface illumination, so a hot core stays luminous.
    this.emitters(sim, px, py, alpha, lights);
    drawGroundLoot(c, sim.groundItems, sim.time);
    this.effects.drawSword(c);
    this.effects.draw(c);
    this.damageDirection(px, py);
    this.motes(world, left, top, worldWidth, worldHeight, sim.time, settings.reducedMotion);
    this.environmentArt.drawAmbient(c, (x, y) => world.sampleBiome(x, y).weights, { x: left, y: top, width: worldWidth, height: worldHeight },
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

  private actorsAndProps(sim: Simulation, px: number, py: number, alpha: number, dt: number, settings: RenderSettings) {
    const c = this.ctx, p = sim.player;
    const entries: Array<{ y: number; draw: () => void }> = this.cachedProps.map(prop => ({ y: prop.y, draw: () => {
      // Prefetched offscreen props retain collision/light coverage without generating unseen sprites.
      if (prop.x + 115 < this.view.left || prop.x - 115 > this.view.left + this.view.width
        || prop.y + 10 < this.view.top || prop.y - 230 > this.view.top + this.view.height) return;
      const sprite = this.environmentArt.getSprite(prop) ?? (prop.kind === 'tree' || prop.kind === 'deadTree'
        ? this.art.getTree(prop.seed, prop.kind === 'deadTree') : prop.kind === 'rock' ? this.art.getRock(prop.seed) : this.art.getShrine());
      const definition = propDefinition(prop.kind);
      const crown = definition.canopy;
      const occludes = crown && py < prop.y + 8 && py > prop.y - (crown.height + crown.radius) * prop.scale
        && Math.abs(px - prop.x - crown.offsetX * prop.scale) < crown.radius * prop.scale;
      let foliageOpacity = occludes ? .24 : 1;
      if (sprite.foliage && !settings.reducedMotion) {
        foliageOpacity += ((this.crownOpacity.get(prop.id) ?? 1) - foliageOpacity) * Math.exp(-dt * 13);
        if (!occludes && foliageOpacity > .995) this.crownOpacity.delete(prop.id);
        else this.crownOpacity.set(prop.id, foliageOpacity);
        if (this.crownOpacity.size > 512) this.crownOpacity.delete(this.crownOpacity.keys().next().value!);
      }
      c.save(); c.translate(prop.x, prop.y); c.scale(prop.scale, prop.scale);
      // Trunks stay rooted and opaque. Only the obstructing canopy becomes translucent.
      if (!sprite.foliage && definition.radius[1] === 0) {
        const wind = biomeWind(prop.x, prop.y, this.visualTime, prop.biome ?? 'deadwood', settings.reducedMotion).x * definition.sway;
        const bend = settings.reducedMotion ? 0 : this.biomeLife.bend(prop.x, prop.y);
        c.transform(1, 0, -bend * .35, 1 - Math.abs(bend) * .18, 0, 0);
        c.transform(1, 0, wind * -.012, 1, 0, 0);
      }
      c.drawImage(sprite.image, -sprite.anchorX, -sprite.anchorY, sprite.width, sprite.height);
      for (const [layer, foliage] of (sprite.foliage ?? []).entries()) {
        c.save();
        const gust = biomeWind(prop.x, prop.y, this.visualTime - layer * .18, prop.biome ?? 'deadwood', settings.reducedMotion).x * definition.sway * 2.2;
        c.transform(1, 0, gust * (layer ? -.009 : -.005), 1, 0, 0);
        c.globalAlpha *= foliageOpacity;
        c.drawImage(foliage, -sprite.anchorX, -sprite.anchorY, sprite.width, sprite.height);
        c.restore();
      }
      c.restore();
    } }));
    for (const bird of this.biomeLife.birds) entries.push({ y: bird.y + (bird.state === 'perched' ? 1 : 130),
      draw: () => this.biomeArt.drawBird(c, bird, this.visualTime, settings.reducedMotion) });
    for (const building of this.cachedBuildings) {
      for (const layer of this.settlementArt.getStructureLayers(building, this.visualTime)) {
        entries.push({ y: layer.y, draw: () => layer.draw(c) });
      }
    }
    for (const site of this.visibility.sites) for (const decor of site.decor) {
      entries.push({ y: decor.y, draw: () => drawSiteDecor(c, site, decor, settings.reducedMotion ? 0 : this.visualTime) });
    }
    for (const enemy of sim.enemies) {
      if (enemy.hp <= 0) continue;
      const x = lerp(enemy.prevX, enemy.x, alpha), y = lerp(enemy.prevY, enemy.y, alpha);
      entries.push({ y, draw: () => this.actor(x, y, { kind: enemy.kind, angle: enemy.angle,
        time: sim.time + enemy.id, moveAngle: Math.atan2(enemy.vy, enemy.vx),
        moving: Math.min(1, Math.hypot(enemy.vx, enemy.vy) / 70),
        attack: enemy.state === 'windup' ? -Math.max(.001, enemy.stateTime / enemy.stateDuration)
          : enemy.state === 'attack' ? Math.min(1, enemy.stateTime / enemy.stateDuration) : 0,
        attackAngle: enemy.attackAngle, hitFlash: enemy.hitFlash, slow: enemy.slowTime, burning: enemy.burnTime,
        impact: Math.min(1, enemy.hitFlash / COMBAT_TIMING.hitFlashDuration), impactAngle: enemy.hitAngle, dodging: false }) });
    }
    if (settings.phase !== 'ready') entries.push({ y: py, draw: () => this.actor(px, py, playerPose(p, sim.time)) });
    entries.sort((a, b) => a.y - b.y);
    for (const entry of entries) entry.draw();
  }

  private actor(x: number, y: number, pose: CharacterPose) {
    const c = this.ctx;
    c.fillStyle = '#02091190'; c.beginPath();
    c.ellipse(x, y + 2, pose.kind === 'brute' ? 17 : pose.kind === 'player' ? 11 * PLAYER_ART_SCALE : 11, pose.kind === 'brute' ? 8 : 5, 0, 0, TAU); c.fill();
    c.save(); c.translate(x, y); if (pose.dead) c.globalAlpha = .4; drawHumanoid(c, pose); drawCharacterStatus(c, pose); c.restore();
  }

  private sceneLights(sim: Simulation, px: number, py: number, reducedMotion: boolean): PointLight[] {
    const p = sim.player;
    const lights: PointLight[] = [{ x: px, y: py - 15, radius: 185, color: '#ffcf87', power: .58, shadows: true }];
    const environmentLights: PointLight[] = [];
    const buildingLights = this.settlementArt.getLights(this.cachedBuildings, this.visualTime)
      .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
    environmentLights.push(...buildingLights.slice(0, 6));
    const siteLights = this.visibility.sites.flatMap(site => wildernessLights(site, reducedMotion ? 0 : this.visualTime))
      .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
    environmentLights.push(...siteLights.slice(0, 6));
    for (const prop of this.cachedProps) {
      const emission = propDefinition(prop.kind).emissive;
      if (!emission) continue;
      const flicker = reducedMotion ? 1 : 1 + Math.sin(sim.time * 8 + prop.seed) * .035 + Math.sin(sim.time * 17) * .018;
      environmentLights.push({ x: prop.x + emission.offsetX * prop.scale, y: prop.y + emission.offsetY * prop.scale,
        radius: emission.radius * prop.scale * flicker, color: emission.color, power: emission.power, shadows: emission.power > .2 });
    }
    if (p.attack?.kind === 'melee' && p.attack.weapon.visual.kind !== 'unarmed' && p.attack.elapsed >= p.attack.activeStart && p.attack.elapsed < p.attack.activeEnd + .05) {
      const a = p.attack;
      const tip = getPlayerSwordTip(playerPose(p, sim.time));
      lights.push({ x: px + tip.x, y: py + tip.y,
        radius: 105, color: a.weapon.visual.glow ?? '#ffbf67',
        power: .55 * Math.sin(Math.PI * Math.min(1, (a.elapsed - a.activeStart) / (a.activeEnd - a.activeStart + .05))), shadows: true });
    }
    if (p.equipment.mainHand.family === 'staff' && p.castTime > (p.castDuration * SKILL_CAST_MOTION.releaseRemainingFraction)) lights.push({ x: px + Math.cos(p.castAngle) * 17, y: py - 17,
      radius: 110, color: p.activeSkill ? SKILL_DEFINITIONS[p.activeSkill].color : '#c0acf0', power: (p.castDuration - p.castTime)
        / (p.castDuration - (p.castDuration * SKILL_CAST_MOTION.releaseRemainingFraction)) * .8 });
    if (p.healFlash > 0) lights.push({ x: px, y: py - 8, radius: 150, color: '#54e8b8', power: p.healFlash * .8 });
    lights.push(...this.effects.getLights());
    if (p.equipment.mainHand.family === 'staff') {
      const tip = getPlayerSwordTip(playerPose(p, sim.time));
      lights.push({ x: px + tip.x, y: py + tip.y, radius: 64, color: p.equipment.mainHand.visual.glow ?? '#c0acf0', power: .3 });
    }
    for (const shot of sim.projectiles.slice(0, 8)) lights.push(projectileLight(shot));
    for (const enemy of sim.enemies) if (enemy.hp > 0 && (enemy.kind === 'caster' || enemy.kind === 'wisp')) {
      lights.push({ x: enemy.x, y: enemy.y - 22, radius: enemy.state === 'windup' ? 100 : 53,
        color: enemy.kind === 'wisp' ? '#93c6ff' : '#54e8b8', power: enemy.state === 'windup' ? .65 : .28 });
    }
    // Combat illumination gets the finite light budget before distant lanterns.
    environmentLights.sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
    const view = this.view;
    return [...lights, ...environmentLights].filter(light => light.x + light.radius >= view.left
      && light.x - light.radius <= view.left + view.width && light.y + light.radius >= view.top
      && light.y - light.radius <= view.top + view.height);
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
    if (p.equipment.mainHand.family === 'staff' && p.castTime > (p.castDuration * SKILL_CAST_MOTION.releaseRemainingFraction)) {
      const charge = Math.max(.1, (p.castDuration - p.castTime)
        / (p.castDuration - (p.castDuration * SKILL_CAST_MOTION.releaseRemainingFraction)));
      const tip = getPlayerSwordTip(playerPose(p, sim.time));
      const x = px + tip.x, y = py + tip.y;
      drawGlow(c, x, y, 37, p.activeSkill ? SKILL_DEFINITIONS[p.activeSkill].color : p.equipment.mainHand.visual.glow ?? '#c0acf0', charge * .8);
      c.fillStyle = '#fff2c0'; c.beginPath(); c.arc(x, y, 1 + charge * 3, 0, TAU); c.fill();
    }
    for (const shot of sim.projectiles) {
      const x = lerp(shot.prevX, shot.x, alpha), y = lerp(shot.prevY, shot.y, alpha);
      drawProjectile(c, shot, x, y - 16, this.visualTime);
    }
  }

  private motes(world: World, left: number, top: number, width: number, height: number, time: number, reducedMotion: boolean) {
    const c = this.ctx, cell = 140, t = reducedMotion ? 0 : time;
    // Anchoring each emitter to a world cell avoids screen-relative swimming or pop-in.
    for (let iy = Math.floor(top / cell) - 1; iy <= Math.floor((top + height) / cell) + 1; iy++) {
      for (let ix = Math.floor(left / cell) - 1; ix <= Math.floor((left + width) / cell) + 1; ix++) {
        const seed = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453, phase = (seed - Math.floor(seed)) * TAU;
        const x = ix * cell + 70 + Math.sin(t * .3 + phase) * 35;
        const y = iy * cell + 70 + Math.cos(t * .4 + phase * 2) * 25;
        const weights = world.sampleBiome(ix * cell + 70, iy * cell + 70).weights;
        const abundance = weights.deadwood + weights.verdant * .35 + weights.swamp * .25 + weights.autumn * .22;
        const power = (.2 + (Math.sin(t * 1.3 + phase) + 1) * .22) * abundance;
        if (power < .01) continue;
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
    const locked = enemy.stateTime >= definition.aimLock || enemy.state === 'attack';
    if (definition.attack === 'ground') {
      const { blastRadius } = definition;
      c.translate(enemy.attackTargetX, enemy.attackTargetY);
      c.fillStyle = `rgba(117,144,240,${.035 + t * .1})`;
      c.beginPath(); c.arc(0, 0, blastRadius, 0, TAU); c.fill();
      c.strokeStyle = `rgba(163,206,255,${.35 + t * .5})`; c.lineWidth = 1.2;
      c.setLineDash(locked ? [] : [4, 4]); c.stroke(); c.setLineDash([]);
      c.lineWidth = 2; c.beginPath(); c.arc(0, 0, blastRadius - 4, -Math.PI / 2, -Math.PI / 2 + TAU * t); c.stroke();
      c.globalAlpha = .35 + t * .4;
      for (let i = 0; i < 4; i++) {
        c.save(); c.rotate(i * TAU / 4); c.beginPath(); c.moveTo(blastRadius - 10, -3);
        c.lineTo(blastRadius - 14, 0); c.lineTo(blastRadius - 10, 3); c.stroke(); c.restore();
      }
      drawGlow(c, 0, 0, 16 + t * 15, '#b6caff', .12 + t * .25);
    } else if (definition.attack === 'projectile') {
      const color = definition.projectileStyle === 'arrow' ? '255,183,117' : '113,255,184';
      c.strokeStyle = `rgba(${color},${.12 + t * .4})`; c.lineWidth = locked ? 1 : .75;
      c.setLineDash(locked ? [8, 5] : [2, 6]);
      for (const offset of definition.shotOffsets) {
        const aim = enemy.attackAngle + offset;
        c.beginPath(); c.moveTo(x + Math.cos(aim) * 15, y + Math.sin(aim) * 15);
        c.lineTo(x + Math.cos(aim) * definition.range, y + Math.sin(aim) * definition.range); c.stroke();
      }
    } else if (definition.engageDistance) {
      // A pounce is a committed travel lane; its warning spans the actual lunge distance.
      c.translate(x, y); c.rotate(enemy.attackAngle);
      const remaining = Math.max(0, definition.active - (enemy.state === 'attack' ? enemy.stateTime : 0));
      const reach = definition.lungeSpeed * remaining + definition.range;
      c.fillStyle = `rgba(255,141,78,${.025 + t * .07})`; c.strokeStyle = `rgba(255,181,119,${.2 + t * .55})`;
      c.lineWidth = 1; c.beginPath(); c.moveTo(8, -11); c.lineTo(reach - 15, -11);
      c.lineTo(reach, 0); c.lineTo(reach - 15, 11); c.lineTo(8, 11); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(12 + (reach - 30) * t, -5); c.lineTo(18 + (reach - 30) * t, 0);
      c.lineTo(12 + (reach - 30) * t, 5); c.stroke();
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
      if (enemy.hp <= 0) continue;
      const width = enemy.kind === 'brute' ? 40 : 31;
      const x = lerp(enemy.prevX, enemy.x, alpha), y = lerp(enemy.prevY, enemy.y, alpha) + ENEMY_BODY_BOUNDS[enemy.kind].top - 5;
      if (enemy.rank !== 'normal') drawRankCrest(c, enemy.rank, x, y - 10, .5);
      if (enemy.hp >= enemy.maxHp && enemy.state !== 'windup') continue;
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
