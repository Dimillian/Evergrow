import './ui-kit.css';
import './style.css';
import './typography.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { emptyChronicle } from './chronicle.ts';
import type { LeaderboardEntry } from './leaderboard.ts';
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
const query = new URLSearchParams(location.search);
const storage = new Map<string, string>();
const repository = new CharacterRepository({ getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); } });
const life = new Lifetime(), world = life.own(new World(7319));
const sim = new Simulation(world, { spawn: false });
if (!new URLSearchParams(location.search).has('empty')) for (let i = 0; i < (query.has('full') ? 8 : 3); i++) {
  const staged = new Simulation(world, { spawn: false });
  awardCharacterExperience(staged.player, [0, 2877, 22000][i % 3]);
  if (i) { staged.player.character.inventory[0] = generateItem(989 + i, staged.player.level, 'weapon', i === 1 ? 'storm-staff' : 'longsword', 'rare'); equipItem(staged.player.character, 0, staged.player.level); refreshCharacter(staged.player); }
  staged.time = i * 3920;
  await new CharacterSession(repository, world.generationVersion).create(i, ['Rowan', 'Isolde', 'Aldric', 'Briar', 'Morrow', 'Thorn', 'Ash', 'Ember'][i], world.seed, staged.captureCheckpoint(), `review-${i}`, Date.now() - i * 60000);
}
const history=emptyChronicle();
for (const [i,name] of ['Rowan','Isolde','Aldric'].entries()) {
 const id='review-'+i, values={kills:2478-i*800,time:16237-i*5000,highestLevel:24-i*6,goldEarned:93785-i*20000,events:36-i*10,items:531-i*150,largestHit:2874-i*700,places:74-i*20,journeys:48-i*10};
 history.sources[id]={id,name,started:Date.now()-86400000,values,unlocked:{}};
 history.characters[id]={id,name,level:24-i*6,updatedAt:Date.now(),sources:[id],deleted:false};
}
const previewRanks:LeaderboardEntry[]=['Vesper','Ironbriar','Isolde','Mossheart','Aldric','Nightjar','Ember','Hollow','Thorn','Silversong','Rowan','Ash'].map((name,i)=>({rank:i+1,name,level:68-i*3,gearPower:660-i*29+(i%3)*40,updatedAt:Date.now(),mine:[2,4,10].includes(i)}));
const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = '<div class="game-shell"><canvas id="title-world"></canvas><div id="title-review-mount"></div></div>';
const canvas = root.querySelector<HTMLCanvasElement>('canvas')!, renderer = new Renderer(), fx = life.own(new PostFX(canvas));
const title = life.own(new TitleScreen(root.querySelector('#title-review-mount')!, { create: () => title.message('Frozen preview — no character is saved.'), continue: () => title.message('Frozen preview — gameplay is not started.'), remove: () => title.message('Preview only.'), download: () => title.message('Preview only.'), import: () => title.message('Preview only.'),
  chronicle:async()=>history,
  leaderboard:async order=>{const entries=[...previewRanks].sort((a,b)=>order==='gear'?b.gearPower!-a.gearPower!:b.level-a.level).map((r,i)=>({...r,rank:i+1}));return {entries,own:entries.filter(r=>r.mine),total:entries.length,signedIn:!query.has('signedout')};},
  source: mode => { title.setSource({ supported: true, mode, signedIn: !query.has('signedout'), status: query.has('conflict') ? 'Conflict' : 'Synced' }); title.open(mode === 'cloud' && query.has('signedout') ? [] : repository.list()); } }));
if (query.has('cloud')) title.setSource({ supported: true, mode: 'cloud', signedIn: !query.has('signedout'), status: query.has('conflict') ? 'Conflict' : 'Synced' });
const slots = repository.list(); if (query.has('conflict')) slots[1].conflict = true;
title.open(query.has('signedout') ? [] : slots, query.has('empty') ? 0 : 1);
const home=query.get('home');if(home==='leaderboard'||home==='chronicle'||home==='changelog')title.selectPage(home,false);
const previewLabel=document.createElement('span');previewLabel.textContent='LOCAL PREVIEW · SAMPLE CHARACTERS';previewLabel.style.cssText='position:fixed;bottom:4px;left:50%;transform:translateX(-50%);z-index:30;font:10px system-ui;color:#91a8a7;pointer-events:none';root.append(previewLabel);
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
