import './style.css';
import './typography.css';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { GameAudio } from './audio.ts';
import { getHUDLayout, HUD_MENU_SHORTCUTS, isHUDPoint } from './hud.ts';
import type { HUDRect } from './hud.ts';
import type { VisualMode } from './postfx.ts';
import type { Input } from './model.ts';

type Phase = 'ready' | 'playing' | 'paused' | 'dead';
interface Preferences { mode: VisualMode; muted: boolean; reducedMotion: boolean; }

const app = document.querySelector<HTMLElement>('#app')!;
app.innerHTML = `<div class="game-shell">
  <canvas id="game" tabindex="0" aria-label="Evergrowing: Deadwood combat arena"></canvas>
  <canvas id="game-ui" aria-hidden="true"></canvas>
  <nav id="hud-controls" class="hud-controls" aria-label="Character menus" hidden>
    ${HUD_MENU_SHORTCUTS.map(shortcut => `<button type="button" class="hud-control" data-hud="${shortcut.id}"
      disabled aria-label="${shortcut.label} (unavailable)" title="${shortcut.label}"></button>`).join('')}
    <button type="button" class="hud-control" data-hud="settings" aria-label="Settings"
      aria-haspopup="dialog" title="Settings"></button>
  </nav>
  <div id="overlay" class="overlay" role="dialog" aria-modal="true" aria-labelledby="menu-title"></div>
  <div id="toast" class="toast" role="status"></div>
  <p id="state-description" class="sr-only" aria-live="polite"></p>
</div>`;

class Game {
  world = new World(7319);
  sim = new Simulation(this.world, { seed: 7319 });
  renderer = new Renderer();
  audio = new GameAudio();
  canvas = document.querySelector<HTMLCanvasElement>('#game')!;
  private uiCanvas = document.querySelector<HTMLCanvasElement>('#game-ui')!;
  private uiContext = this.uiCanvas.getContext('2d')!;
  fx: PostFX;
  phase: Phase = 'ready';
  preferences: Preferences = {
    mode: 'crt', muted: false,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, left: false, right: false };
  private pendingDodge = false;
  private pendingHeal = false;
  private pendingAttack = false;
  private pendingCast = false;
  private last = performance.now();
  private animation = 0;
  private fps = 60;
  private toastTimer = 0;
  private abort = new AbortController();
  private debug = false;

  constructor() {
    this.fx = new PostFX(this.canvas);
    try {
      const saved = JSON.parse(localStorage.getItem('evergrowing-preferences') ?? 'null');
      if (saved) {
        if (['crt', 'phosphor', 'clean'].includes(saved.mode)) this.preferences.mode = saved.mode;
        if (typeof saved.muted === 'boolean') this.preferences.muted = saved.muted;
        if (typeof saved.reducedMotion === 'boolean') this.preferences.reducedMotion = saved.reducedMotion;
      }
    } catch { /* Preferences are optional when storage is disabled. */ }
    this.audio.setEnabled(!this.preferences.muted);
    this.resize();
    this.bind();
    this.showMenu();
    this.animation = requestAnimationFrame(this.frame);
  }

  private bind() {
    const signal = this.abort.signal;
    window.addEventListener('resize', () => this.resize(), { signal });
    window.addEventListener('blur', () => {
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
          if (this.phase === 'playing') this.pause();
          else if (this.phase === 'paused') this.resume();
        }
        return;
      }
      // Native menu controls retain their ordinary keyboard behavior.
      if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement
        || event.target instanceof HTMLButtonElement) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (event.code === 'Enter' && this.phase !== 'playing') {
        event.preventDefault();
        this.phase === 'paused' ? this.resume() : this.start();
        return;
      }
      if (event.code === 'KeyV') { this.cycleMode(); return; }
      if (event.code === 'KeyM') { this.toggleSound(); return; }
      if (event.code === 'F3') { event.preventDefault(); this.debug = !this.debug; return; }
      if (event.code === 'KeyR' && this.phase === 'dead') { this.start(); return; }
      if (this.phase !== 'playing') return;
      this.keys.add(event.code);
      if (event.code === 'Space') this.pendingDodge = true;
      if (event.code === 'KeyQ') this.pendingHeal = true;
    }, { signal });
    window.addEventListener('keyup', event => this.keys.delete(event.code), { signal });
    // Window-level tracking also follows the pointer across the DOM HUD buttons.
    window.addEventListener('pointermove', event => this.updatePointer(event), { signal });
    this.canvas.addEventListener('pointerdown', event => {
      if (this.phase !== 'playing') return;
      event.preventDefault();
      this.updatePointer(event);
      if (this.pointerInHUD()) return;
      this.canvas.focus();
      this.canvas.setPointerCapture(event.pointerId);
      if (event.button === 0) { this.mouse.left = true; this.pendingAttack = true; }
      if (event.button === 2) { this.mouse.right = true; this.pendingCast = true; }
      void this.audio.unlock().catch(() => this.toast('Sound is unavailable in this browser.'));
    }, { signal });
    window.addEventListener('pointerup', event => {
      if (event.button === 0) this.mouse.left = false;
      if (event.button === 2) this.mouse.right = false;
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    }, { signal });
    this.canvas.addEventListener('pointercancel', () => this.clearInput(), { signal });
    document.querySelector('.game-shell')!.addEventListener('contextmenu', event => event.preventDefault(), { signal });
    document.querySelector('[data-hud="settings"]')!.addEventListener('click', () => {
      if (this.phase === 'playing') this.pause();
    }, { signal });
  }

  private updatePointer(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = (event.clientX - rect.left) / rect.width * this.renderer.width;
    this.mouse.y = (event.clientY - rect.top) / rect.height * this.renderer.height;
    this.canvas.classList.toggle('hud-hover', this.pointerInHUD());
  }

  private pointerInHUD() {
    return isHUDPoint(this.mouse.x, this.mouse.y, this.renderer.width, this.renderer.height);
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
    const layout = getHUDLayout(this.renderer.width, this.renderer.height);
    const place = (id: string, rect: HUDRect) => {
      const button = document.querySelector<HTMLElement>(`[data-hud="${id}"]`)!;
      button.style.left = `${rect.x / this.renderer.width * 100}%`;
      button.style.top = `${rect.y / this.renderer.height * 100}%`;
      button.style.width = `${rect.width / this.renderer.width * 100}%`;
      button.style.height = `${rect.height / this.renderer.height * 100}%`;
    };
    for (const shortcut of layout.shortcuts) place(shortcut.id, shortcut);
    place('settings', layout.settings);
  }

  clearInput() {
    this.keys.clear();
    this.mouse.left = this.mouse.right = false;
    this.pendingDodge = this.pendingHeal = this.pendingAttack = this.pendingCast = false;
    this.sim.clearInput();
  }

  start() {
    this.sim.reset();
    this.renderer.reset();
    this.clearInput();
    this.phase = 'playing';
    this.showMenu();
    this.canvas.focus();
    void this.audio.unlock().catch(() => this.toast('Sound is unavailable in this browser.'));
    this.audio.setEnabled(!this.preferences.muted);
    this.last = performance.now();
  }

  pause() {
    this.phase = 'paused';
    this.clearInput();
    this.showMenu();
  }

  resume() {
    this.clearInput();
    this.phase = 'playing';
    this.showMenu();
    this.canvas.focus();
    this.last = performance.now();
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
    const input: Input = {
      moveX: Number(this.keys.has('KeyD') || this.keys.has('ArrowRight'))
        - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')),
      moveY: Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'))
        - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')),
      aimX: aim.x, aimY: aim.y,
      attack: !blocked && (this.mouse.left || this.pendingAttack),
      cast: !blocked && (this.mouse.right || this.pendingCast),
      dodge: this.pendingDodge, heal: this.pendingHeal,
    };
    this.pendingDodge = this.pendingHeal = this.pendingAttack = this.pendingCast = false;
    return input;
  }

  private frame = (now: number) => {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.fps += (1 / Math.max(dt, 0.001) - this.fps) * 0.04;
    if (this.phase === 'playing') {
      // The simulation owns the fixed 120 Hz clock and render interpolation.
      this.sim.update(dt, this.readInput());
      const events = this.sim.drainEvents();
      this.renderer.handleEvents(events, this.preferences.reducedMotion);
      for (const event of events) {
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
    const settings = {
      ...this.preferences, phase: this.phase, fps: this.fps, debug: this.debug,
    };
    this.renderer.render(this.sim, this.world, dt, settings);
    this.fx.render(this.renderer.canvas, this.preferences.mode, this.renderer.hurt);
    const ui = this.uiContext;
    ui.setTransform(1, 0, 0, 1, 0, 0);
    ui.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);
    // Keep shared logical coordinates for drawing, aiming, and the HTML hit targets.
    ui.setTransform(this.uiCanvas.width / this.renderer.width, 0, 0,
      this.uiCanvas.height / this.renderer.height, 0, 0);
    this.renderer.renderUI(ui, this.sim, this.world, settings);
    this.animation = requestAnimationFrame(this.frame);
  };

  private showMenu() {
    const playing = this.phase === 'playing';
    const overlay = document.querySelector<HTMLElement>('#overlay')!;
    overlay.hidden = playing;
    document.querySelector<HTMLElement>('#hud-controls')!.hidden = !playing;
    document.querySelector('.game-shell')!.classList.toggle('playing', playing);
    if (playing) { overlay.innerHTML = ''; return; }
    const ready = this.phase === 'ready', dead = this.phase === 'dead';
    overlay.innerHTML = `<section class="panel">
      <p class="eyebrow">${dead ? 'DEADWOOD' : 'EVERGROWING'}</p>
      <h1 id="menu-title">${ready ? 'DEADWOOD' : dead ? 'YOU FELL' : 'PAUSED'}</h1>
      <div class="rule" aria-hidden="true"></div>
      ${dead ? `<p class="death-count">${this.sim.kills} slain · ${Math.floor(this.sim.time / 60)}:${String(Math.floor(this.sim.time % 60)).padStart(2, '0')} survived</p>` : ''}
      ${!ready && !dead ? `<div class="settings">
        <label>Display<select id="display-mode"><option value="crt">CRT</option><option value="phosphor">Phosphor</option><option value="clean">Clean</option></select></label>
        <label>Sound<input type="checkbox" id="audio-enabled" ${this.preferences.muted ? '' : 'checked'}></label>
        <label>Reduced motion<input type="checkbox" id="reduced-motion" ${this.preferences.reducedMotion ? 'checked' : ''}></label>
      </div>` : ''}
      <div class="menu-actions">
        <button class="primary" id="play-action">${ready ? 'ENTER THE WOODS' : dead ? 'TRY AGAIN' : 'RESUME'}</button>
        ${!ready && !dead ? '<button class="secondary" id="restart-action">NEW RUN</button>' : ''}
      </div>
    </section>`;
    document.querySelector('#play-action')!.addEventListener('click', () => this.phase === 'paused' ? this.resume() : this.start());
    document.querySelector('#restart-action')?.addEventListener('click', () => this.start());
    const select = document.querySelector<HTMLSelectElement>('#display-mode');
    if (select) {
      select.value = this.preferences.mode;
      select.addEventListener('change', () => {
        this.preferences.mode = select.value as VisualMode;
        this.savePreferences();
      });
    }
    document.querySelector<HTMLInputElement>('#audio-enabled')?.addEventListener('change', event => {
      this.preferences.muted = !(event.target as HTMLInputElement).checked;
      this.audio.setEnabled(!this.preferences.muted);
      this.savePreferences();
    });
    document.querySelector<HTMLInputElement>('#reduced-motion')?.addEventListener('change', event => {
      this.preferences.reducedMotion = (event.target as HTMLInputElement).checked;
      this.savePreferences();
    });
    document.querySelector<HTMLButtonElement>('#play-action')?.focus();
    document.querySelector('#state-description')!.textContent = dead
      ? `You fell after defeating ${this.sim.kills} enemies.`
      : this.phase === 'paused' ? 'Game paused.' : 'Ready to enter Deadwood.';
  }

  cycleMode() {
    this.preferences.mode = this.preferences.mode === 'crt' ? 'phosphor' : this.preferences.mode === 'phosphor' ? 'clean' : 'crt';
    this.savePreferences();
    this.toast(`Display: ${this.preferences.mode.toUpperCase()}`);
  }

  toggleSound() {
    this.preferences.muted = !this.preferences.muted;
    this.audio.setEnabled(!this.preferences.muted);
    void this.audio.unlock().catch(() => {});
    this.savePreferences();
  }

  private savePreferences() {
    try { localStorage.setItem('evergrowing-preferences', JSON.stringify(this.preferences)); } catch { /* Storage may be disabled. */ }
    const display = document.querySelector<HTMLSelectElement>('#display-mode');
    if (display) display.value = this.preferences.mode;
    const audio = document.querySelector<HTMLInputElement>('#audio-enabled');
    if (audio) audio.checked = !this.preferences.muted;
    const motion = document.querySelector<HTMLInputElement>('#reduced-motion');
    if (motion) motion.checked = this.preferences.reducedMotion;
  }

  private toast(message: string) {
    const element = document.querySelector('#toast')!;
    element.textContent = message;
    element.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => element.classList.remove('visible'), 1800);
  }

  dispose() {
    cancelAnimationFrame(this.animation);
    window.clearTimeout(this.toastTimer);
    this.abort.abort();
    this.fx.dispose();
    this.audio.dispose();
  }
}

let game: Game | undefined;
let moduleDisposed = false;
if (import.meta.hot) import.meta.hot.dispose(() => { moduleDisposed = true; game?.dispose(); });

// Wait for local font metrics before the first frame; a missing font has a readable fallback.
void loadGameFont().catch(error => console.warn('Local UI font unavailable; using fallback.', error)).then(() => {
  if (moduleDisposed) return;
  try {
    game = new Game();
    if (import.meta.env.DEV) Object.assign(window, { __evergrowing: game });
  } catch (error) {
    console.error(error);
    app.innerHTML = '<div class="error"><h1>The woods could not be drawn.</h1><p>This browser could not initialize the game display.</p></div>';
  }
});
