import { InventoryPanel } from './inventory-panel.ts';
import { SkillTreePanel } from './skill-tree-panel.ts';
import { equipItem, unequipItem, moveInventoryItem, allocateAttribute } from './inventory.ts';
import { allocateNode } from './skill-tree.ts';
import { refreshCharacter, assignSkill } from './character.ts';
import type { ActionResult } from './character-types.ts';
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
  private worldMap: WorldMap;
  private shell: GameShell;
  private inventoryPanel: InventoryPanel;
  private skillPanel: SkillTreePanel;
  readonly canvas: HTMLCanvasElement;
  private uiCanvas: HTMLCanvasElement;
  private uiContext: CanvasRenderingContext2D;
  fx: PostFX;
  phase: GamePhase = 'ready';
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
      this.exploration = this.lifetime.own(new Exploration(this.world));
      this.shell = this.lifetime.own(new GameShell(root, {
        play: () => this.phase === 'paused' ? this.resume() : this.start(),
        restart: () => this.start(), openMap: () => this.openMap(),
        openCharacter: () => this.openCharacterPanel('character'), openSkills: () => this.openCharacterPanel('skills'),
      }));
      this.canvas = this.shell.canvas;
      this.uiCanvas = this.shell.uiCanvas;
      const uiContext = this.uiCanvas.getContext('2d');
      if (!uiContext) throw new Error('The HUD requires a 2D canvas context.');
      this.uiContext = uiContext;
      this.worldMap = this.lifetime.own(new WorldMap(this.world, this.exploration, this.shell.mapMount, () => this.closeMap()));
      this.inventoryPanel = this.lifetime.own(new InventoryPanel(this.shell.panelMount, {
        close: () => this.closeCharacterPanel(),
        equip: (index, slot) => this.characterAction(equipItem(this.sim.player.character, index, this.sim.player.level, slot)),
        unequip: (slot, index) => this.characterAction(unequipItem(this.sim.player.character, slot, index)),
        move: (from, to) => this.characterAction(moveInventoryItem(this.sim.player.character, from, to)),
        allocate: attribute => this.characterAction(allocateAttribute(this.sim.player.character, attribute)),
      }));
      this.skillPanel = this.lifetime.own(new SkillTreePanel(this.shell.panelMount, {
        close: () => this.closeCharacterPanel(),
        allocate: id => this.characterAction(allocateNode(this.sim.player.character, id)),
        assign: (slot, skill) => this.characterAction(assignSkill(this.sim.player, slot, skill)),
      }));
      this.fx = this.lifetime.own(new PostFX(this.canvas));
      try {
        const saved = JSON.parse(localStorage.getItem('evergrowing-preferences') ?? 'null');
        if (typeof saved?.muted === 'boolean') this.muted = saved.muted;
      } catch { /* Preferences are optional when storage is disabled. */ }
      // Presentation is fixed and motion follows the OS.
      this.savePreferences();
      this.audio.setEnabled(!this.muted);
      this.resize();
      this.bind();
      this.showMenu();
      this.animation = requestAnimationFrame(this.frame);
    } catch (error) {
      try { this.lifetime.dispose(); } catch (cleanupError) { console.error(cleanupError); }
      throw error;
    }
  }

  private bind() {
    const signal = this.abort.signal;
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
      }
      this.last = performance.now();
    }, { signal });
    window.addEventListener('keydown', event => {
      if (event.code === 'Escape') {
        event.preventDefault();
        if (!event.repeat) {
          if (this.phase === 'character' || this.phase === 'skills') this.closeCharacterPanel();
          else if (this.phase === 'map') this.closeMap();
          else if (this.phase === 'playing') this.pause();
          else if (this.phase === 'paused') this.resume();
        }
        return;
      }
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
        || event.target instanceof HTMLSelectElement || (event.target instanceof HTMLElement && event.target.isContentEditable);
      if (!typing && ['KeyC', 'KeyI', 'KeyT'].includes(event.code)
        && ['playing', 'character', 'skills'].includes(this.phase)) {
        event.preventDefault();
        if (!event.repeat) {
          const panel = event.code === 'KeyT' ? 'skills' : 'character';
          this.phase === panel ? this.closeCharacterPanel() : this.openCharacterPanel(panel);
        }
        return;
      }
      if (typing) return;
      if (event.code === 'KeyM' && (this.phase === 'playing' || this.phase === 'map')) {
        event.preventDefault();
        if (!event.repeat) this.phase === 'map' ? this.closeMap() : this.openMap();
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
      if (event.code === 'Enter' && (this.phase === 'ready' || this.phase === 'dead' || this.phase === 'paused')) {
        event.preventDefault();
        this.phase === 'paused' ? this.resume() : this.start();
        return;
      }
      if (event.code === 'F3') { event.preventDefault(); this.debug = !this.debug; return; }
      if (event.code === 'KeyR' && this.phase === 'dead') { this.start(); return; }
      if (this.phase !== 'playing') return;
      this.input.keyDown(event.code);
    }, { signal });
    window.addEventListener('keyup', event => this.input.keyUp(event.code), { signal });
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
      this.canvas.focus();
      this.canvas.setPointerCapture(event.pointerId);
      this.input.pointerDown(event.button);
      void this.audio.unlock().catch(() => this.toast('Sound is unavailable in this browser.'));
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
    this.mouse.x = this.renderer.width * 0.6;
    this.mouse.y = this.renderer.height * 0.43;
    this.shell.resizeControls(this.renderer.width, this.renderer.height);
    this.worldMap.resize();
  }

  clearInput() {
    this.input.clear();
    this.sim.clearInput();
  }

  start() {
    if (this.disposed) return;
    this.worldMap.close();
    this.inventoryPanel.close(); this.skillPanel.close();
    this.sim.reset();
    this.renderer.reset();
    this.clearInput();
    this.phase = 'playing';
    this.showMenu();
    this.canvas.focus();
    void this.audio.unlock().catch(() => this.toast('Sound is unavailable in this browser.'));
    this.audio.setEnabled(!this.muted);
    this.last = performance.now();
  }

  pause() {
    if (this.disposed || this.phase !== 'playing') return;
    this.phase = 'paused';
    this.clearInput();
    this.showMenu();
  }

  resume() {
    if (this.disposed || !['paused', 'map', 'character', 'skills'].includes(this.phase)) return;
    this.clearInput();
    this.phase = 'playing';
    this.showMenu();
    this.canvas.focus();
    this.last = performance.now();
  }

  private openMap() {
    if (this.phase !== 'playing') return;
    this.clearInput();
    this.phase = 'map';
    this.showMenu();
    this.worldMap.open(this.sim.player);
    this.shell.setStatus('World map open. Game paused.');
  }

  private closeMap() {
    if (this.phase !== 'map') return;
    this.worldMap.close();
    this.resume();
  }

  private openCharacterPanel(panel: 'character' | 'skills') {
    if (!['playing', 'character', 'skills'].includes(this.phase)) return;
    this.clearInput(); this.inventoryPanel.close(); this.skillPanel.close();
    this.phase = panel; this.showMenu();
    if (panel === 'character') this.inventoryPanel.open(this.sim.player);
    else this.skillPanel.open(this.sim.player);
    this.shell.setStatus(`${panel === 'character' ? 'Character and inventory' : 'Skill tree'} open. Game paused.`);
  }

  private closeCharacterPanel() {
    if (this.phase !== 'character' && this.phase !== 'skills') return;
    this.inventoryPanel.close(); this.skillPanel.close(); this.resume();
  }

  private characterAction(result: ActionResult) {
    if (!result.ok) { this.toast(result.message ?? 'Action unavailable.'); return; }
    refreshCharacter(this.sim.player);
    if (this.phase === 'character') this.inventoryPanel.refresh(this.sim.player);
    if (this.phase === 'skills') this.skillPanel.refresh(this.sim.player);
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
    return this.input.consume(aim, blocked);
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.fps += (1 / Math.max(dt, 0.001) - this.fps) * 0.04;
    if (this.phase === 'playing') {
      // The simulation owns the fixed 120 Hz clock and render interpolation.
      this.sim.update(dt, this.readInput());
      const events = this.sim.drainEvents();
      this.renderer.handleEvents(events, this.reducedMotion);
      for (const event of events) {
        if (event.text) this.toast(event.text);
        if (!(event.type === 'cast' && event.enemyKind)) this.audio.play(event);
      }
      if (this.sim.player.dead) {
        this.phase = 'dead';
        this.clearInput();
        this.showMenu();
      }
    }
    this.renderer.pointerX = this.mouse.x;
    this.renderer.pointerY = this.mouse.y;
    this.renderer.pointerActive = this.mouse.present;
    const settings = {
      reducedMotion: this.reducedMotion, phase: this.phase, fps: this.fps, debug: this.debug,
    };
    this.renderer.render(this.sim, this.world, dt, settings);
    this.fx.render(this.renderer.canvas, this.renderer.hurt);
    const ui = this.uiContext;
    ui.setTransform(1, 0, 0, 1, 0, 0);
    ui.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);
    // Keep shared logical coordinates for drawing, aiming, and the HTML hit targets.
    ui.setTransform(this.uiCanvas.width / this.renderer.width, 0, 0,
      this.uiCanvas.height / this.renderer.height, 0, 0);
    this.renderer.renderUI(ui, this.sim, this.world, settings);
    const p = this.sim.player, alpha = this.sim.interpolationAlpha;
    const mapPlayer = { x: p.prevX + (p.x - p.prevX) * alpha,
      y: p.prevY + (p.y - p.prevY) * alpha, angle: p.angle };
    if (this.phase !== 'ready') this.worldMap.update(mapPlayer, dt);
    this.worldMap.drawMinimap(ui, mapPlayer, this.renderer.width, this.renderer.height, now / 1000,
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
    try { localStorage.setItem('evergrowing-preferences', JSON.stringify({ muted: this.muted })); } catch { /* Storage may be disabled. */ }
  }

  private toast(message: string) {
    if (this.disposed) return;
    this.shell.toast(message);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clearInput();
    this.renderer.reset();
    this.lifetime.dispose();
  }
}
