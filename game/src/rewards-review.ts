import './ui-kit.css';
import './typography.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { GameAudio } from './audio.ts';
import { REWARD_SCENES, REWARD_SCENE_LABELS, resetRewardScene, rewardSceneEvents, type RewardScene } from './reward-review-scene.ts';
if (!import.meta.env.DEV) throw new Error('Local review only');
installUITheme(); await loadGameFont();
const canvas = document.querySelector<HTMLCanvasElement>('#review')!;
const world = new World(7319), sim = new Simulation(world, { spawn: false }), renderer = new Renderer();
const stage = document.createElement('canvas'), fx = new PostFX(stage), audio = new GameAudio();
const requested = new URLSearchParams(location.search).get('scene');
let scene: RewardScene = REWARD_SCENES.find(s => s === requested) ?? 'level';
let elapsed = 0, last = performance.now(), frame = 0, paused = false, sound = false;
const abort = new AbortController(), motion = matchMedia('(prefers-reduced-motion: reduce)');
const controls = document.querySelector<HTMLElement>('#controls')!;
controls.innerHTML = `<div class="review-heading"><span>EVERGROW / REWARDS</span><small>Save-free animation study</small></div><div class="review-actions">${REWARD_SCENES.map(s => `<button class="ui-button" data-scene="${s}" aria-pressed="${s === scene}">${REWARD_SCENE_LABELS[s]}</button>`).join('')}<button class="ui-button" data-action="replay">Replay</button><button class="ui-button" data-action="pause">Pause</button><button class="ui-button" data-action="sound" aria-pressed="false">Sound off</button></div>`;
const restart = () => { resetRewardScene(sim, scene); renderer.reset(); renderer.snapTo(sim.player); elapsed = 0; last = performance.now(); };
controls.addEventListener('click', async event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button'); if (!button) return;
  if (button.dataset.scene) {
    scene = button.dataset.scene as RewardScene;
    for (const b of controls.querySelectorAll<HTMLButtonElement>('[data-scene]')) b.setAttribute('aria-pressed', String(b.dataset.scene === scene));
    history.replaceState(null, '', `?scene=${scene}`); restart();
  }
  if (button.dataset.action === 'replay') restart();
  if (button.dataset.action === 'pause') { paused = !paused; button.textContent = paused ? 'Play' : 'Pause'; }
  if (button.dataset.action === 'sound') {
    try { await audio.unlock(); sound = !sound; audio.setEnabled(sound); button.textContent = sound ? 'Sound on' : 'Sound off'; button.setAttribute('aria-pressed', String(sound)); }
    catch { button.textContent = 'Sound unavailable'; }
  }
}, { signal: abort.signal });
restart();
const draw = (now: number) => {
  const dt = paused || document.hidden ? 0 : Math.min(.05, (now - last) / 1000); last = now;
  const ratio = devicePixelRatio || 1;
  if (canvas.width !== Math.round(innerWidth * ratio) || canvas.height !== Math.round(innerHeight * ratio)) {
    canvas.width = Math.round(innerWidth * ratio); canvas.height = Math.round(innerHeight * ratio);
    stage.width = canvas.width; stage.height = canvas.height;
    renderer.resize(600 * innerWidth / innerHeight, 600);
  }
  const settings = { phase: 'playing' as const, reducedMotion: motion.matches, debug: false, fps: 60 };
  // Initialize the visual balances before this loop's first authored reward.
  if (elapsed === 0) renderer.render(sim, world, 0, settings);
  const events = rewardSceneEvents(sim, scene, elapsed, elapsed + dt); elapsed += dt;
  renderer.handleEvents(events, motion.matches);
  if (sound) for (const event of events) audio.play(event);
  renderer.render(sim, world, dt, settings); fx.render(renderer.canvas, elapsed);
  const c = canvas.getContext('2d')!; c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(stage, 0, 0);
  c.setTransform(canvas.width / renderer.width, 0, 0, canvas.height / renderer.height, 0, 0);
  renderer.renderUI(c, sim, world, settings);
  if (elapsed > 7) restart();
  frame = requestAnimationFrame(draw);
};
frame = requestAnimationFrame(draw);
if (import.meta.hot) import.meta.hot.dispose(() => { cancelAnimationFrame(frame); abort.abort(); fx.dispose(); audio.dispose(); world.dispose(); });
