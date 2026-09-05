import './typography.css';
import { drawHumanoid } from './art.ts';
import type { CharacterPose } from './art.ts';
import { loadGameFont, text } from './font.ts';

const directions = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const mount = document.querySelector<HTMLElement>('#poses')!;
const abort = new AbortController();
let disposed = false;

async function boot() {
  if (!import.meta.env.DEV) throw new Error('Rig review is available only on the local development server.');
  await loadGameFont();
  if (disposed) return;
  const sheets = directions.map((direction, index) => {
    const section = document.createElement('section'), title = document.createElement('h2');
    title.textContent = direction;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${direction}-facing equipped character: idle above, walking below, frozen at half-stride.`);
    section.append(title, canvas); mount.append(section);
    return { canvas, angle: index * Math.PI / 4 };
  });
  function draw() {
    for (const { canvas, angle } of sheets) {
      const pixels = canvas.getBoundingClientRect().width * (devicePixelRatio || 1);
      canvas.width = Math.round(pixels); canvas.height = Math.round(pixels * 600 / 320);
      const c = canvas.getContext('2d')!;
      c.setTransform(canvas.width / 320, 0, 0, canvas.height / 600, 0, 0);
      c.fillStyle = '#111c23'; c.fillRect(0, 0, 320, 600);
      c.strokeStyle = '#2a3b3e'; c.beginPath(); c.moveTo(12, 300); c.lineTo(308, 300); c.stroke();
      for (const [row, moving] of [0, 1].entries()) {
        const anchor = 228 + row * 300;
        text(c, moving ? 'WALK' : 'IDLE', 14, row * 300 + 12, 1.5, '#a5b3a5');
        c.strokeStyle = '#48615b'; c.beginPath(); c.moveTo(150, anchor); c.lineTo(170, anchor);
        c.moveTo(160, anchor - 4); c.lineTo(160, anchor + 4); c.stroke();
        const pose: CharacterPose = { kind: 'player', angle, time: 1.25, moving,
          gaitPhase: Math.PI / 2, moveAngle: angle, attack: 0, attackAngle: angle, hitFlash: 0, dodging: false };
        c.save(); c.translate(160, anchor); c.scale(2.8, 2.8); drawHumanoid(c, pose); c.restore();
      }
    }
    mount.dataset.ready = 'true'; mount.setAttribute('aria-busy', 'false');
  }
  draw();
  window.addEventListener('resize', draw, { signal: abort.signal });
}
void boot().catch(error => {
  if (disposed) return;
  mount.setAttribute('aria-busy', 'false'); mount.setAttribute('role', 'alert');
  mount.textContent = error instanceof Error ? error.message : 'The character rig could not be drawn.';
});
if (import.meta.hot) import.meta.hot.dispose(() => { disposed = true; abort.abort(); });
