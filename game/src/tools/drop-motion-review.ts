import '../typography.css';
import './tools.css';
import { loadGameFont, text } from '../font.ts';
import { drawGroundGold } from '../reward-art.ts';
import { drawResourcePickups } from '../loot-art.ts';
import { PostFX } from '../postfx.ts';

if (!import.meta.env.DEV) throw new Error('Local review only');
await loadGameFont();
document.querySelector('#review')?.remove();
const page = document.createElement('main');
page.className = 'tool-page';
page.innerHTML = `<h1>Coins & mana drops</h1>
  <p>Small, staggered hops with quiet blue mana and red health halos. Shared game artwork; disposable preview.</p>
  <div class="tool-toolbar">
    <button id="play">Pause</button><button id="restart">Restart</button>
    <label>Timeline <input id="time" type="range" min="0" max="20" step="0.01" value="0" style="width:220px"></label>
    <output id="elapsed">0.0 s</output>
    <label>Backdrop <select id="backdrop"><option value="#263b30">Moss</option><option value="#35383e">Stone</option><option value="#625440">Sand</option><option value="#111923">Dark</option></select></label>
    <label><span>Motion</span><select id="motion"><option value="normal">Follow system</option><option value="reduced">Reduced motion preview</option></select></label>
  </div><canvas id="drops" style="width:100%;max-width:1000px;display:block" aria-label="Animated coin piles and mana potions, enlarged above and actual size below"></canvas>
  <p>Upper row: 4× detail · Lower row: 1× world art. Health vial included for comparison. No pickup, combat or saves.</p>`;
document.body.append(page);
const canvas = page.querySelector<HTMLCanvasElement>('#drops')!;
const source = document.createElement('canvas'), scene = document.createElement('canvas');
source.width = 1000; source.height = 460;
const c = source.getContext('2d')!, fx = new PostFX(scene);
const output = canvas.getContext('2d')!;
const play = page.querySelector<HTMLButtonElement>('#play')!;
const slider = page.querySelector<HTMLInputElement>('#time')!;
const elapsed = page.querySelector<HTMLOutputElement>('#elapsed')!;
const backdrop = page.querySelector<HTMLSelectElement>('#backdrop')!;
const motion = page.querySelector<HTMLSelectElement>('#motion')!;
const media = matchMedia('(prefers-reduced-motion: reduce)');
let time = 0, playing = !media.matches, frame = 0, last = 0;
const reduced = () => media.matches || motion.value === 'reduced';
const sync = () => { play.textContent = playing ? 'Pause' : 'Play'; slider.value = String(time); elapsed.value = `${time.toFixed(1)} s`; };
function draw() {
  c.fillStyle = backdrop.value; c.fillRect(0, 0, 1000, 460);
  c.fillStyle = '#ffffff06';
  for (let i = 0; i < 700; i++) c.fillRect((i * 137) % 1000, (i * 73) % 460, 2, 1);
  for (const [row, scale] of [4, 1].entries()) {
    const y = row ? 367 : 190;
    for (let col = 0; col < 4; col++) {
      c.save(); c.translate(135 + col * 245, y); c.scale(scale, scale);
      if (col < 2) drawGroundGold(c, [{ id: col ? 29 : 11, x: 0, y: 0, amount: col ? 300 : 8, age: 10 }], time, reduced());
      else drawResourcePickups(c, [{ id: col === 2 ? 43 : 44, x: 0, y: 0, kind: col === 2 ? 'mana' : 'health', life: 10, radius: 4, restoreFraction: .1 }], time, reduced());
      c.restore();
    }
  }
  fx.render(source, 0);
  const density = devicePixelRatio;
  const width = Math.round(Math.min(1000, canvas.clientWidth) * density), height = Math.round(width * .46);
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  output.setTransform(1, 0, 0, 1, 0, 0); output.drawImage(scene, 0, 0, width, height);
  output.setTransform(width / 1000, 0, 0, height / 460, 0, 0);
  ['Small pile', 'Large pile', 'Mana', 'Health'].forEach((label, i) => text(output, label, 135 + i * 245, 35, 1.4, '#e2e7da', 'center'));
  text(output, '4×', 28, 175, 1.2, '#c7d4cd'); text(output, '1×', 28, 355, 1.2, '#c7d4cd');
  sync();
}
function tick(now: number) {
  if (!document.hidden && playing && now - last >= 1000 / 30) {
    time = (time + Math.min(.1, (now - last) / 1000)) % 20; last = now; draw();
  } else if (document.hidden || !playing) last = now;
  frame = requestAnimationFrame(tick);
}
play.onclick = () => { playing = !playing; last = performance.now(); sync(); };
page.querySelector<HTMLButtonElement>('#restart')!.onclick = () => { time = 0; draw(); };
slider.oninput = () => { playing = false; time = Number(slider.value); draw(); };
backdrop.onchange = draw;
motion.onchange = () => { if (reduced()) playing = false; draw(); };
const systemMotion = () => { if (media.matches) playing = false; draw(); };
media.addEventListener('change', systemMotion);
window.addEventListener('resize', draw);
draw(); frame = requestAnimationFrame(tick);
if (import.meta.hot) import.meta.hot.dispose(() => {
  cancelAnimationFrame(frame); window.removeEventListener('resize', draw);
  media.removeEventListener('change', systemMotion); fx.dispose(); page.remove();
});
