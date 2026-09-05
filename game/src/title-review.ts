import './ui-kit.css';
import './style.css';
import './typography.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { TitleScreen } from './title-screen.ts';
import { CharacterRepository } from './character-storage.ts';
import { CharacterSession } from './character-session.ts';
import { awardCharacterExperience, refreshCharacter } from './character.ts';
import { generateItem } from './items.ts';
import { equipItem } from './inventory.ts';
import { Lifetime } from './lifetime.ts';
if (!import.meta.env.DEV) throw new Error('Local review only.');
installUITheme(); await loadGameFont();
// In-memory staged saves. No gameplay input, simulation ticks or browser storage access.
const storage = new Map<string, string>();
const repository = new CharacterRepository({ getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); } });
const life = new Lifetime(), world = life.own(new World(7319));
const sim = new Simulation(world, { spawn: false });
if (!new URLSearchParams(location.search).has('empty')) for (let i = 0; i < 3; i++) {
  const staged = new Simulation(world, { spawn: false });
  awardCharacterExperience(staged.player, [0, 2877, 22000][i]);
  if (i) { staged.player.character.inventory[0] = generateItem(989 + i, staged.player.level, 'weapon', i === 1 ? 'storm-staff' : 'longsword', 'rare'); equipItem(staged.player.character, 0, staged.player.level); refreshCharacter(staged.player); }
  staged.time = i * 3920;
  new CharacterSession(repository, world.seed, world.generationVersion).create(i, ['Rowan', 'Isolde', 'Aldric'][i], staged.captureCheckpoint(), `review-${i}`, Date.now() - i * 60000);
}
const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = '<div class="game-shell"><canvas id="title-world"></canvas><div id="title-review-mount"></div></div>';
const canvas = root.querySelector<HTMLCanvasElement>('canvas')!, renderer = new Renderer(), fx = life.own(new PostFX(canvas));
const title = life.own(new TitleScreen(root.querySelector('#title-review-mount')!, { create: () => title.message('Frozen preview — no character is saved.'), continue: () => title.message('Frozen preview — gameplay is not started.'), remove: () => title.message('Frozen preview — no character is deleted.') }));
title.open(repository.list(), new URLSearchParams(location.search).has('empty') ? 0 : 1);
let frame = 0;
const draw = () => {
  const ratio = Math.min(1.6, devicePixelRatio || 1);
  if (canvas.width !== Math.round(innerWidth * ratio) || canvas.height !== Math.round(innerHeight * ratio)) {
    canvas.width = Math.round(innerWidth * ratio); canvas.height = Math.round(innerHeight * ratio);
    renderer.resize(Math.round(600 * innerWidth / innerHeight), 600);
  }
  renderer.cameraX = -90; renderer.cameraY = -180;
  renderer.render(sim, world, 1 / 60, { phase: 'ready', reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, fps: 60, debug: false });
  fx.render(renderer.canvas, 0); frame = requestAnimationFrame(draw);
};
draw(); life.defer(() => cancelAnimationFrame(frame));
if (import.meta.hot) import.meta.hot.dispose(() => life.dispose());
