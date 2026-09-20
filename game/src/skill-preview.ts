import { SkillStudy, studyWeapons } from './skill-showcase.ts';
import { Renderer } from './renderer.ts';
import { World } from './world.ts';
import { PostFX } from './postfx.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { SKILL_SPECIALIZATIONS } from './skill-progression.ts';
import { escapeUI } from './ui-components.ts';
import type { SkillId } from './character-types.ts';

/** Inline, user-started demonstration. Owns no playable character, storage or audio. */
export class SkillPreview {
  readonly element = document.createElement('section');
  private readonly world = new World(7319);
  private readonly renderer = new Renderer();
  private fx?: PostFX;
  private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly life = new AbortController();
  private observer?: ResizeObserver;
  private visibility?: IntersectionObserver;
  private study!: SkillStudy;
  private canvas: HTMLCanvasElement;
  private frame = 0;
  private playing = false;
  private inView = true;
  private disposed = false;
  private last = 0;
  private accumulator = 0;
  private drawAccumulator = 0;
  private anchor = { x: 0, y: 0 };
  private readonly skill: SkillId;
  private readonly rank: number;
  private readonly specialization: string;

  constructor(mount: HTMLElement, skill: SkillId, rank: number,
    specialization: string) {
    this.skill = skill; this.rank = rank; this.specialization = specialization;
    const definition = SKILL_DEFINITIONS[skill], variant = SKILL_SPECIALIZATIONS.find(v => v.id === specialization);
    this.element.className = 'skill-preview';
    this.element.setAttribute('aria-label', `${variant?.name ?? definition.name} preview`);
    this.element.innerHTML = `<canvas aria-label="${escapeUI(variant?.name ?? definition.name)} demonstration against training targets"></canvas>
      <div class="skill-preview-controls"><button class="ui-button" data-preview="play">Replay</button><button class="ui-button" data-preview="pause">Pause</button><output data-preview-time aria-label="Playback progress" aria-live="off">0 / 12s</output></div>
      <p class="skill-preview-caption">Example gear · Rank ${rank}</p>`;
    this.canvas = this.element.querySelector('canvas')!;
    mount.append(this.element);
    try {
      this.fx = new PostFX(this.canvas);
      // Choose one open patch in the runtime world for the isolated demonstration.
      let best = -1;
      for (let i = 0; i < 49; i++) {
        const x = (i % 7 - 3) * 220, y = (Math.floor(i / 7) - 3) * 220;
        if (this.world.blocked(x, y, 16)) continue;
        let score = 0;
        for (let j = 0; j < 12; j++) if (!this.world.blocked(x + Math.cos(j * Math.PI / 6) * 140, y + Math.sin(j * Math.PI / 6) * 140, 20)) score++;
        if (score > best) { best = score; this.anchor = { x, y }; }
        if (best === 12) break;
      }
      this.element.addEventListener('click', event => {
        const action = (event.target as Element).closest<HTMLElement>('[data-preview]')?.dataset.preview;
        if (action === 'play') { this.reset(); this.playing = true; this.schedule(); }
        if (action === 'pause') { this.playing = !this.playing; this.schedule(); }
        this.buttons();
      }, { signal: this.life.signal });
      document.addEventListener('visibilitychange', () => this.suspendOrResume(), { signal: this.life.signal });
      window.addEventListener('resize', () => this.resize(), { signal: this.life.signal });
      this.motion.addEventListener('change', () => this.draw(0), { signal: this.life.signal });
      this.reset();
      this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(this.canvas);
      this.visibility = new IntersectionObserver(entries => {
        this.inView = entries.some(entry => entry.isIntersecting); this.suspendOrResume();
      });
      this.visibility.observe(this.element);
      // Expanding the Preview accordion is the explicit playback action.
      this.playing = true; this.buttons(); this.schedule();
    } catch (error) {
      this.dispose(); throw error;
    }
  }
  private reset(): void {
    this.playing = false; cancelAnimationFrame(this.frame); this.frame = 0; this.last = 0; this.accumulator = 0; this.drawAccumulator = 0;
    const defense = ['brace', 'bulwark', 'runicWard', 'ironCitadel'].includes(this.skill);
    this.study = new SkillStudy(this.world, { skill: this.skill, rank: this.rank, specialization: this.specialization,
      weapon: studyWeapons(this.skill)[0].id, facing: 0, targets: ['whirlwind', 'iceNova', 'absoluteZero', 'nightReaping'].includes(this.skill) ? 'ring' : ['piercingShot', 'frostLance'].includes(this.skill) ? 'line' : 'fan',
      enemy: 'brute', ...this.anchor, scenario: defense ? 'defense' : ['rallyOfIron', 'ghostHunt'].includes(this.skill) ? 'followup' : 'showcase' });
    this.renderer.reset(); this.resize(); this.draw(0); this.buttons();
  }
  private resize(): void {
    if (this.disposed) return;
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const density = Math.min(3, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(bounds.width * density)), height = Math.max(1, Math.round(bounds.height * density));
    if (this.canvas.width === width && this.canvas.height === height) return;
    // Both world rendering and CRT output use real display pixels, never a stretched default canvas.
    this.canvas.width = width; this.canvas.height = height;
    this.renderer.resize(width, height); this.draw(0);
  }
  private buttons(): void {
    const pause = this.element.querySelector<HTMLButtonElement>('[data-preview="pause"]')!;
    pause.disabled = !this.playing && this.study.elapsed === 0 || this.study.elapsed >= this.study.duration;
    pause.textContent = this.playing ? 'Pause' : 'Resume';
  }
  private suspendOrResume(): void {
    cancelAnimationFrame(this.frame); this.frame = 0; this.last = 0; this.accumulator = 0;
    this.schedule();
  }
  private schedule(): void {
    if (this.disposed || !this.playing || document.hidden || !this.inView || this.frame) return;
    this.last = 0;
    this.frame = requestAnimationFrame(now => this.tick(now));
  }
  private tick(now: number): void {
    this.frame = 0;
    if (this.disposed || !this.playing || document.hidden || !this.inView) { this.last = 0; return; }
    this.accumulator += this.last ? Math.min(.05, (now - this.last) / 1000) : 0; this.last = now;
    let steps = 0;
    while (this.accumulator >= 1 / 120 && steps < 6) {
      this.renderer.handleEvents(this.study.step(), this.motion.matches); this.accumulator -= 1 / 120; steps++;
    }
    this.drawAccumulator += steps / 120;
    if (this.drawAccumulator >= 1 / 30 || this.study.elapsed >= this.study.duration) {
      this.draw(this.drawAccumulator); this.drawAccumulator = 0;
    }
    if (this.study.elapsed >= this.study.duration) { this.playing = false; this.buttons(); }
    if (this.playing) this.frame = requestAnimationFrame(time => this.tick(time));
  }
  private draw(dt: number): void {
    if (this.disposed) return;
    const recipe = this.study.resolved.recipe;
    const radius = recipe.kind === 'ground' || recipe.kind === 'radial' ? recipe.radius : 0;
    const aspect = this.canvas.width / this.canvas.height;
    const worldWidth = Math.max(480, (radius * 2 + 100) * aspect);
    this.renderer.cameraX = (this.anchor.x + this.study.input.aimX) / 2;
    this.renderer.cameraY = this.anchor.y - 15;
    this.renderer.render(this.study.simulation, this.world, dt, { phase: 'playing', reducedMotion: this.motion.matches,
      fixedCamera: true, fixedCameraZoom: this.canvas.width / worldWidth });
    this.fx!.render(this.renderer.canvas, this.renderer.hurt, this.renderer.emission);
    this.element.querySelector('[data-preview-time]')!.textContent = `${this.study.elapsed.toFixed(1)} / ${this.study.duration}s`;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.playing = false; cancelAnimationFrame(this.frame); this.life.abort();
    this.observer?.disconnect(); this.visibility?.disconnect();
    this.element.remove(); this.renderer.reset(); this.fx?.dispose(); this.world.dispose();
  }
}
