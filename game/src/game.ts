import { ServicePanel } from './service-panel.ts';
import { buildingNPC, focusNPC, canInteractNPC, type TownNPC } from './npcs.ts';
import type { ServiceQuote } from './commerce.ts';
import { executeService } from './commerce-command.ts';
import { PanelCoordinator } from './panel-coordinator.ts';
import { bindGameKeyboard } from './game-keyboard.ts';
import { createCharacterSheet, type StarterWeaponId } from './items.ts';
import { refreshCharacter } from './character.ts';
import { AreaNoticeTracker } from './notification-queue.ts';
import { getZoneAt } from './zone-progression.ts';
import { CharacterRepository } from './character-storage.ts';
import { CharacterSession } from './character-session.ts';
import { TitleScreen } from './title-screen.ts';
import { cameraFollowTarget } from './camera.ts';
import { InventoryPanel } from './inventory-panel.ts';
import { SkillTreePanel } from './skill-tree-panel.ts';
import { executeCharacterCommand, type CharacterCommand } from './character-commands.ts';
import { Lifetime } from './lifetime.ts';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { GameAudio } from './audio.ts';
import { Exploration } from './exploration.ts';
import { WorldMap } from './world-map.ts';
import { GameInput } from './game-input.ts';
import { GameShell } from './game-shell.ts';
import { isGameUIPoint } from './ui-hit-test.ts';
import type { GamePhase } from './game-phase.ts';
import type { Input } from './model.ts';

/** Coordinates browser lifecycle, simulation and presentation; system rules live in their owners. */
export class Game {
  private lifetime = new Lifetime();
  world = this.lifetime.own(new World(7319));
  sim = new Simulation(this.world, { seed: 7319 });
  renderer: Renderer;
  audio: GameAudio;
  private exploration: Exploration;
  private titleScreen: TitleScreen;
  private session: CharacterSession;
  private nextAutosave = 0;
  private areaNotices = new AreaNoticeTracker();
  private saveError = '';
  private worldMap: WorldMap;
  private shell: GameShell;
  private inventoryPanel: InventoryPanel;
  private skillPanel: SkillTreePanel;
  private servicePanel: ServicePanel;
  private activeNPC: TownNPC | null = null;
  readonly canvas: HTMLCanvasElement;
  private uiCanvas: HTMLCanvasElement;
  private uiContext: CanvasRenderingContext2D;
  fx: PostFX;
  private panels: PanelCoordinator;
  get phase(): GamePhase { return this.panels?.phase ?? 'ready'; }
  private muted = false;
  private readonly motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  private get reducedMotion() { return this.motionPreference.matches; }
  private input = new GameInput();
  private mouse = this.input.pointer;
  private last = performance.now();
  private animation = 0;
  private fps = 60;
  private abort = new AbortController();
  private debug = false;
  private disposed = false;

  constructor(root: HTMLElement) {
    this.lifetime.defer(() => this.abort.abort());
    this.lifetime.defer(() => cancelAnimationFrame(this.animation));
    try {
      this.renderer = new Renderer();
      this.audio = this.lifetime.own(new GameAudio());
      this.exploration = new Exploration(this.world, { storage: null });
      this.lifetime.defer(() => this.exploration.dispose());
      let storage: Storage | null = null;
      try { storage = localStorage; } catch { /* The title screen explains unavailable storage. */ }
      this.session = new CharacterSession(new CharacterRepository(storage), this.world.seed, this.world.generationVersion);
      this.shell = this.lifetime.own(new GameShell(root, {
        play: () => this.phase === 'paused' ? this.resume() : this.start(),
        returnToTitle: () => this.returnToTitle(), openMap: () => this.openMap(),
        openCharacter: () => this.openCharacterPanel('character'), openSkills: () => this.openCharacterPanel('skills'),
      }));
      this.canvas = this.shell.canvas;
      this.uiCanvas = this.shell.uiCanvas;
      const uiContext = this.uiCanvas.getContext('2d');
      if (!uiContext) throw new Error('The HUD requires a 2D canvas context.');
      this.uiContext = uiContext;
      this.worldMap = new WorldMap(this.world, this.exploration, this.shell.mapMount, () => this.closeMap());
      this.lifetime.defer(() => this.worldMap.dispose());
      this.worldMap.setCampStateReader(id => this.sim.getCampState(id));
      this.inventoryPanel = this.lifetime.own(new InventoryPanel(this.shell.panelMount, {
        close: () => this.closeCharacterPanel(),
        equip: (index, slot) => this.characterAction({ type: 'equip', index, slot }),
        unequip: (slot, index) => this.characterAction({ type: 'unequip', slot, index }),
        move: (from, to) => this.characterAction({ type: 'moveItem', from, to }),
        allocate: attribute => this.characterAction({ type: 'allocateAttribute', attribute }),
      }));
      this.skillPanel = this.lifetime.own(new SkillTreePanel(this.shell.panelMount, {
        close: () => this.closeCharacterPanel(),
        allocate: id => this.characterAction({ type: 'allocateNode', id }),
        assign: (slot, skill) => this.characterAction({ type: 'assignSkill', slot, skill }),
      }));
      this.titleScreen = this.lifetime.own(new TitleScreen(this.shell.titleMount, {
        create: (index, name, weapon) => this.createCharacter(index, name, weapon),
        continue: index => this.continueCharacter(index), remove: index => this.deleteCharacter(index),
      }));
      this.servicePanel = this.lifetime.own(new ServicePanel(this.shell.panelMount, {
        close: () => this.resume(), trade: quote => this.trade(quote),
      }));
      this.panels = new PanelCoordinator({
        service: { open: () => { if (this.activeNPC) this.servicePanel.open(this.sim.player, this.activeNPC); }, close: () => { this.servicePanel.close(); this.activeNPC = null; } },
        map: { open: () => { this.worldMap.open(this.sim.player); this.shell.setStatus('World map open. Game paused.'); }, close: () => this.worldMap.close() },
        character: { open: () => { this.inventoryPanel.open(this.sim.player); this.shell.setStatus('Character and inventory open. Game paused.'); }, close: () => this.inventoryPanel.close() },
        skills: { open: () => { this.skillPanel.open(this.sim.player); this.shell.setStatus('Skill tree open. Game paused.'); }, close: () => this.skillPanel.close() },
      }, {
        clearInput: () => this.clearInput(), changed: () => this.showMenu(),
        resumeGameplay: () => { this.canvas.focus(); this.last = performance.now(); },
        save: () => { this.saveCharacter(); },
      });
      this.fx = this.lifetime.own(new PostFX(this.canvas));
      try {
        const saved = JSON.parse(localStorage.getItem('evergrow-preferences') ?? 'null');
        if (typeof saved?.muted === 'boolean') this.muted = saved.muted;
      } catch { /* Preferences are optional when storage is disabled. */ }
      // Presentation is fixed and motion follows the OS.
      this.savePreferences();
      this.audio.setEnabled(!this.muted);
      this.resize();
      this.bind();
      this.showMenu();
      this.titleScreen.open(this.session.repository.list());
      this.animation = requestAnimationFrame(this.frame);
    } catch (error) {
      try { this.lifetime.dispose(); } catch (cleanupError) { console.error(cleanupError); }
      throw error;
    }
  }

  private bind() {
    const signal = this.abort.signal;
    window.addEventListener('pagehide', () => { this.clearInput(); this.saveCharacter(); }, { signal });
    window.addEventListener('focus', () => this.clearInput(), { signal });
    this.canvas.addEventListener('blur', () => this.clearInput(), { signal });
    window.addEventListener('resize', () => this.resize(), { signal });
    window.addEventListener('blur', () => {
      this.mouse.present = false;
      this.clearInput();
      if (this.phase === 'playing') this.pause();
    }, { signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clearInput();
        if (this.phase === 'playing') this.pause();
        else this.saveCharacter();
      }
      this.last = performance.now();
    }, { signal });
    bindGameKeyboard(window, {
      clear: () => this.clearInput(),
      release: code => this.input.keyUp(code),
      press: event => {
        if (event.code === 'Escape') {
          event.preventDefault();
          if (!event.repeat) {
            if (this.panels.activePanel) this.resume();
            else if (this.phase === 'playing') this.pause();
            else if (this.phase === 'paused') this.resume();
          }
          return;
        }
        const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
          || event.target instanceof HTMLSelectElement || (event.target instanceof HTMLElement && event.target.isContentEditable);
        if (!typing && ['KeyC', 'KeyI', 'KeyT'].includes(event.code)
          && this.panels.canOpen(event.code === 'KeyT' ? 'skills' : 'character')) {
          event.preventDefault();
          if (!event.repeat) {
            const panel = event.code === 'KeyT' ? 'skills' : 'character';
            this.panels.toggle(panel);
          }
          return;
        }
        if (typing) return;
        if (event.code === 'KeyM' && (this.panels.canOpen('map') || this.phase === 'map')) {
          event.preventDefault();
          if (!event.repeat) this.panels.toggle('map');
          return;
        }
        if (event.code === 'Tab' && this.phase === 'playing') {
          event.preventDefault();
          if (!event.repeat) this.openMap();
          return;
        }
        if (event.code === 'KeyN') {
          if (!event.repeat) this.toggleSound();
          return;
        }
        // Native menu controls retain their ordinary keyboard behavior.
        if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement
          || event.target instanceof HTMLButtonElement) return;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
        if (event.repeat) return;
        if (event.code === 'Enter' && (this.phase === 'dead' || this.phase === 'paused')) {
          event.preventDefault();
          this.phase === 'paused' ? this.resume() : this.start();
          return;
        }
        if (event.code === 'F3') { event.preventDefault(); this.debug = !this.debug; return; }
        if (event.code === 'KeyR' && this.phase === 'dead') { this.start(); return; }
        if (this.phase !== 'playing') return;
        if (event.code === 'KeyE') { event.preventDefault(); this.interact(); return; }
        this.input.keyDown(event.code);
      },
    }, signal);
    // Window-level tracking also follows the pointer across the DOM HUD buttons.
    window.addEventListener('pointermove', event => this.updatePointer(event), { signal });
    this.canvas.addEventListener('pointerleave', () => { this.mouse.present = false; }, { signal });
    this.canvas.addEventListener('wheel', event => {
      if (this.phase !== 'playing' || event.ctrlKey || event.metaKey) return;
      this.updatePointer(event);
      if (this.pointerInHUD()) return;
      event.preventDefault();
      this.renderer.zoomByWheel(event.deltaY, event.deltaMode, this.canvas.getBoundingClientRect().height);
    }, { signal, passive: false });
    this.canvas.addEventListener('pointerdown', event => {
      if (this.phase !== 'playing') return;
      event.preventDefault();
      this.updatePointer(event);
      if (this.pointerInHUD()) return;
      if (event.button === 0 && this.interact(this.renderer.screenToWorld(this.mouse.x, this.mouse.y))) return;
      this.canvas.focus();
      this.canvas.setPointerCapture(event.pointerId);
      this.input.pointerDown(event.button);
      void this.audio.unlock().catch(() => this.notify('Sound is unavailable in this browser.'));
    }, { signal });
    window.addEventListener('pointerup', event => {
      this.input.pointerUp(event.button);
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    }, { signal });
    this.canvas.addEventListener('pointercancel', () => this.clearInput(), { signal });
  }

  private updatePointer(event: { clientX: number; clientY: number }) {
    this.input.movePointer(event.clientX, event.clientY, this.canvas.getBoundingClientRect(),
      this.renderer.width, this.renderer.height);
    this.canvas.classList.toggle('hud-hover', this.pointerInHUD());
    this.worldMap.setMinimapPointer({ x: this.mouse.x, y: this.mouse.y });
  }

  private pointerInHUD() {
    return isGameUIPoint(this.mouse.x, this.mouse.y, this.renderer.width, this.renderer.height);
  }

  private resize() {
    const width = window.innerWidth, height = window.innerHeight;
    const ratio = Math.min(1.6, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    // UI is rasterized at the display's native density, independently of the world buffer.
    const uiRatio = window.devicePixelRatio || 1;
    this.uiCanvas.width = Math.round(width * uiRatio);
    this.uiCanvas.height = Math.round(height * uiRatio);
    const logicalHeight = Math.min(680, Math.max(450, Math.round(height / 1.35)));
    this.renderer.resize(Math.max(540, Math.round(logicalHeight * width / height)), logicalHeight);
    this.sim.setSpawnExclusion(this.renderer.spawnExclusionBounds(this.sim.player));
    this.mouse.x = this.renderer.width * 0.6;
    this.mouse.y = this.renderer.height * 0.43;
    this.shell.resizeControls(this.renderer.width, this.renderer.height);
    this.worldMap.resize();
  }

  clearInput() {
    this.input.clear();
    this.sim.clearInput();
  }

  /** Defeat recovery keeps the character, allocations and loot; it never creates a new run. */
  start() {
    if (this.disposed || this.phase !== 'dead' || !this.session.active) return;
    this.sim.revive(); this.enterWorld(); this.saveCharacter();
  }

  private createCharacter(index: number, name: string, weapon: StarterWeaponId) {
    if (this.phase !== 'ready') return;
    const fresh = new Simulation(this.world, { seed: this.world.seed, spawn: false });
    fresh.player.character = createCharacterSheet(weapon); refreshCharacter(fresh.player);
    if (!this.session.create(index, name, fresh.captureCheckpoint(), crypto.randomUUID(), Date.now())) {
      this.titleScreen.message(this.session.error); return;
    }
    this.continueCharacter(index);
  }

  private continueCharacter(index: number) {
    if (this.phase !== 'ready') return;
    const record = this.session.load(index);
    if (!record) { this.titleScreen.message(this.session.error); return; }
    this.sim.restoreCheckpoint(record.checkpoint);
    if (this.sim.player.dead) this.sim.revive();
    this.sim.player.name = record.name;
    this.worldMap.dispose(); this.exploration.dispose();
    this.exploration = new Exploration(this.world, { characterId: record.id,
      onDiscover: poi => {
        // Shops share their settlement announcement; landmarks deserve their own.
        if (!['blacksmith', 'merchant', 'inn', 'chapel', 'jeweler', 'enchanter'].includes(poi.kind))
          this.shell.notifications.push({ kind: 'discovery', poi });
      },
    });
    this.worldMap = new WorldMap(this.world, this.exploration, this.shell.mapMount, () => this.closeMap());
    this.worldMap.setCampStateReader(id => this.sim.getCampState(id));
    this.worldMap.resize(); this.titleScreen.close(); this.saveError = '';
    this.enterWorld(); this.saveCharacter();
  }

  private deleteCharacter(index: number) {
    if (this.phase !== 'ready') return;
    const slot = this.session.repository.read(index);
    const result = this.session.repository.remove(index, slot.token);
    if (!result.ok) { this.titleScreen.message(result.message); return; }
    if (slot.record) {
      try { localStorage.removeItem(`evergrow:exploration:1:${slot.record.worldVersion}:${slot.record.worldSeed}:${slot.record.id}`); } catch { /* Character deletion already committed; chart cleanup is best effort. */ }
    }
    this.shell.notifications.clear();
    this.titleScreen.open(this.session.repository.list(), index);
  }

  private enterWorld() {
    this.shell.notifications.clear();
    this.areaNotices.reset(this.world.sampleBiome(this.sim.player.x, this.sim.player.y).id);
    this.sim.player.name = this.session.active?.record.name;
    this.renderer.reset();
    const camera = cameraFollowTarget(this.sim.player);
    this.renderer.cameraX = camera.x; this.renderer.cameraY = camera.y;
    this.sim.setSpawnExclusion(this.renderer.spawnExclusionBounds(this.sim.player));
    this.panels.transition('playing');
    void this.audio.unlock().catch(() => this.notify('Sound is unavailable in this browser.'));
    this.audio.setEnabled(!this.muted); this.last = performance.now(); this.nextAutosave = this.last + 10_000;
  }

  private saveCharacter(): boolean {
    if (!this.session?.active) return true;
    const saved = this.session.save(this.sim.captureCheckpoint(), Date.now());
    const message = saved ? '' : this.session.error;
    if (message && message !== this.saveError) this.notify(message);
    this.saveError = message;
    this.shell.setSaveStatus(message || 'Character saved locally.', !saved);
    this.exploration.save();
    return saved;
  }

  private returnToTitle() {
    if (!this.session.active || !this.saveCharacter()) return;
    const index = this.session.active.index;
    this.session.active = null;
    this.shell.notifications.clear();
    this.sim.reset(); this.renderer.reset();
    this.panels.transition('ready'); this.titleScreen.open(this.session.repository.list(), index);
  }

  pause() { if (!this.disposed) this.panels.pause(); }

  resume() { if (!this.disposed) this.panels.resume(); }

  private openMap() { this.panels.open('map'); }

  private closeMap() { if (this.phase === 'map') this.resume(); }

  private openCharacterPanel(panel: 'character' | 'skills') { this.panels.open(panel); }

  private closeCharacterPanel() {
    if (this.phase === 'character' || this.phase === 'skills') this.resume();
  }

  private interact(pointer?: { x: number; y: number }): boolean {
    if (this.phase !== 'playing') return false;
    const p = this.sim.player;
    const npcs = this.world.getBuildings(p.x - 220, p.y - 220, 440, 440).map(buildingNPC).filter((npc): npc is TownNPC => npc !== null);
    const npc = focusNPC(npcs, p, this.world, pointer);
    if (!npc) return false;
    this.activeNPC = npc; this.panels.open('service'); return true;
  }

  private trade(quote: ServiceQuote): { ok: boolean; message: string } {
    const npc = this.activeNPC, p = this.sim.player;
    if (this.phase !== 'service' || !npc || !this.session.active || !canInteractNPC(npc, p, this.world))
      return { ok: false, message: 'This service is no longer in reach.' };
    const result = executeService(p, npc, this.world, quote, (character, hp, mana) => {
      const saved = this.session.save({ ...this.sim.captureCheckpoint(), character, hp, mana }, Date.now());
      if (!saved) this.shell.setSaveStatus(this.session.error, true);
      return { ok: saved, message: this.session.error };
    });
    if (result.ok) { this.saveError = ''; this.shell.setSaveStatus('Character saved locally.'); this.notify(result.message); }
    return result;
  }

  private characterAction(command: CharacterCommand) {
    const result = executeCharacterCommand(this.sim.player, command);
    if (!result.ok) { this.notify(result.message ?? 'Action unavailable.'); return; }
    if (this.phase === 'character') this.inventoryPanel.refresh(this.sim.player);
    if (this.phase === 'skills') this.skillPanel.refresh(this.sim.player);
    this.saveCharacter();
  }

  private readInput(): Input {
    const blocked = this.pointerInHUD();
    const p = this.sim.player;
    const aim = blocked
      ? { x: p.x + Math.cos(p.angle) * 100, y: p.y + Math.sin(p.angle) * 100 }
      : this.renderer.screenToWorld(this.mouse.x, this.mouse.y);
    // A captured pointer still belongs to the canvas over a menu button.
    // Clear queued weapon inputs as well as suppressing the held buttons.
    if (blocked) this.sim.clearCombatInput();
    const input = this.input.consume(aim, blocked);
    const rangedAim = this.renderer.resolvePointerAim(this.sim, this.world, this.mouse.x, this.mouse.y, !blocked && this.mouse.present);
    return rangedAim ? { ...input, rangedAim: { x: rangedAim.x, y: rangedAim.y } } : input;
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.fps += (1 / Math.max(dt, 0.001) - this.fps) * 0.04;
    if (this.phase === 'playing') {
      // The simulation owns the fixed 120 Hz clock and render interpolation.
      this.sim.setSpawnExclusion(this.renderer.spawnExclusionBounds(this.sim.player));
      this.sim.update(dt, this.readInput());
      const events = this.sim.drainEvents();
      this.renderer.handleEvents(events, this.reducedMotion);
      for (const event of events) {
        if (event.type === 'gold' || event.type === 'experience') this.shell.notifications.push({
          kind: 'rewards', gold: event.type === 'gold' ? event.amount : 0, xp: event.type === 'experience' ? event.amount : 0,
        });
        else if (event.type === 'loot') this.shell.notifications.push({ kind: 'loot', item: event.item });
        else if (event.type === 'level') this.shell.notifications.push({ kind: 'level', level: event.level, skillPoints: event.skillPoints, statPoints: event.statPoints });
        else if (event.type === 'notice') this.notify(event.message);
        if (!(event.type === 'cast' && event.enemyKind)) this.audio.play(event);
      }
      const biome = this.world.sampleBiome(this.sim.player.x, this.sim.player.y);
      if (this.areaNotices.update(biome.id, dt)) this.shell.notifications.push({ kind: 'area', id: biome.id, name: biome.name, level: getZoneAt(this.sim.player.x, this.sim.player.y).level });
      if (this.sim.player.dead) {
        this.panels.transition('dead', true);
      }
      if (now >= this.nextAutosave) { this.saveCharacter(); this.nextAutosave = now + 10_000; }
    }
    this.renderer.pointerX = this.mouse.x;
    this.renderer.pointerY = this.mouse.y;
    this.renderer.pointerActive = this.mouse.present;
    const settings = {
      reducedMotion: this.reducedMotion, phase: this.phase, fps: this.fps, debug: this.debug,
    };
    if (this.phase === 'ready') {
      this.renderer.cameraX = -90 + (this.reducedMotion ? 0 : Math.sin(now / 24000) * 45);
      this.renderer.cameraY = -180 + (this.reducedMotion ? 0 : Math.cos(now / 31000) * 25);
    }
    this.renderer.render(this.sim, this.world, dt, settings);
    this.fx.render(this.renderer.canvas, this.renderer.hurt);
    const ui = this.uiContext;
    ui.setTransform(1, 0, 0, 1, 0, 0);
    ui.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);
    // Keep shared logical coordinates for drawing, aiming, and the HTML hit targets.
    ui.setTransform(this.uiCanvas.width / this.renderer.width, 0, 0,
      this.uiCanvas.height / this.renderer.height, 0, 0);
    if (this.phase !== 'ready') this.renderer.renderUI(ui, this.sim, this.world, settings);
    const p = this.sim.player, alpha = this.sim.interpolationAlpha;
    const mapPlayer = { x: p.prevX + (p.x - p.prevX) * alpha,
      y: p.prevY + (p.y - p.prevY) * alpha, angle: p.angle };
    if (this.phase !== 'ready') this.worldMap.update(mapPlayer, dt);
    if (this.phase !== 'ready') this.worldMap.drawMinimap(ui, mapPlayer, this.renderer.width, this.renderer.height, now / 1000,
      this.sim.enemies.filter(enemy => enemy.hp > 0).map(enemy => ({
        x: enemy.prevX + (enemy.x - enemy.prevX) * alpha,
        y: enemy.prevY + (enemy.y - enemy.prevY) * alpha, kind: enemy.kind,
      })));
    this.animation = requestAnimationFrame(this.frame);
  };

  private showMenu() {
    const p = this.sim.player;
    const building = this.world.getBuildingAt(p.x, p.y);
    const town = this.world.getSettlements(p.x - 1, p.y - 1, 2, 2)
      .find(place => Math.hypot(p.x - place.x, p.y - place.y) <= place.radius);
    const location = building?.name ?? town?.name ?? this.world.sampleBiome(p.x, p.y).name;
    this.shell.showMenu(this.phase, this.sim.kills, this.sim.time, location);
  }

  toggleSound() {
    if (this.disposed) return;
    this.muted = !this.muted;
    this.audio.setEnabled(!this.muted);
    void this.audio.unlock().catch(() => {});
    this.savePreferences();
  }

  private savePreferences() {
    try { localStorage.setItem('evergrow-preferences', JSON.stringify({ muted: this.muted })); } catch { /* Storage may be disabled. */ }
  }

  private notify(message: string) {
    if (this.disposed) return;
    this.shell.notifications.info(message);
  }

  dispose() {
    if (this.disposed) return;
    this.saveCharacter();
    this.disposed = true;
    this.clearInput();
    this.renderer.reset();
    this.lifetime.dispose();
  }
}
