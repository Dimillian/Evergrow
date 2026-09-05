import './typography.css';
import { drawFloatingHUD, getHUDLayout, type HUDOptions } from './hud.ts';
import { loadGameFont, text } from './font.ts';
import { Simulation } from './simulation.ts';
import type { Player, WorldQuery } from './model.ts';

// This dev-only entry never binds gameplay input, ticks a simulation or accesses saves.
const HUD_DISPLAY_SCALE = 1.35;
const PANEL_GAP = 14;
const root = document.querySelector<HTMLElement>('#hud-review')!;
const canvas = document.querySelector<HTMLCanvasElement>('#hud-sheet')!;
const status = document.querySelector<HTMLElement>('#review-status')!;
const download = document.querySelector<HTMLAnchorElement>('#save-png')!;
const abort = new AbortController();
let disposed = false;

interface Stage { name: string; detail: string; player: Player; time: number; options: HUDOptions; }
const emptyWorld: WorldQuery = {
  blocked: () => false,
  move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }),
};

function makeStages(): Stage[] {
  const player = () => new Simulation(emptyWorld, { spawn: false }).player;
  const healthy = player(), damaged = player(), depleted = player();
  healthy.mana = 94;
  damaged.hp = 39; damaged.mana = 68; damaged.dodgeCharges = 1; damaged.dodgeRecharge = 1.2;
  depleted.hp = 16; depleted.mana = 7; depleted.flasks = 0; depleted.dodgeCharges = 0;
  depleted.dodgeRecharge = .56; depleted.castCooldown = .32; depleted.healCooldown = .65;
  return [
    { name: 'Healthy', detail: 'Full vitality · abilities ready', player: healthy, time: 5.7, options: {} },
    { name: 'Damaged', detail: 'Recent impact · trailing vitality · one dodge charge', player: damaged,
      time: 9.2, options: { healthTrail: .83, hitPulse: .5 } },
    { name: 'Depleted', detail: 'Low resources · recovery timers · empty flask', player: depleted, time: 14.4, options: {} },
  ];
}

/** A subdued procedural floor gives transparent metalwork and orb glass context. */
function ground(c: CanvasRenderingContext2D, width: number, height: number) {
  const base = c.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, '#111e22'); base.addColorStop(.5, '#172323'); base.addColorStop(1, '#0c161c');
  c.fillStyle = base; c.fillRect(0, 0, width, height);
  const random = (seed: number) => {
    const n = Math.sin(seed * 127.1 + 27.4) * 43758.5453;
    return n - Math.floor(n);
  };
  for (let i = 0; i < Math.ceil(width * height / 270); i++) {
    const x = random(i * 3) * width, y = random(i * 3 + 1) * height;
    c.fillStyle = i % 3 ? '#6280600d' : '#8590820c';
    c.fillRect(x, y, 1 + random(i * 3 + 2) * 4, 1 + random(i * 3 + 4) * 2);
  }
  for (const side of [-1, 1]) {
    const x = side < 0 ? 15 : width - 15;
    c.strokeStyle = '#080f1480'; c.lineWidth = 11;
    c.beginPath(); c.moveTo(x, height + 15); c.lineTo(x - side * 8, height * .5);
    c.lineTo(x + side * 18, height * .25); c.stroke();
    c.lineWidth = 4;
    c.beginPath(); c.moveTo(x - side * 7, height * .62); c.lineTo(x - side * 44, height * .4);
    c.lineTo(x - side * 58, height * .12); c.stroke();
  }
  const glow = c.createRadialGradient(width * .6, height * .78, 0, width * .6, height * .78, width * .45);
  glow.addColorStop(0, '#7881560b'); glow.addColorStop(1, '#78815600');
  c.fillStyle = glow; c.fillRect(0, 0, width, height);
  const shade = c.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, '#0710148c'); shade.addColorStop(.42, '#07101400'); shade.addColorStop(1, '#07101430');
  c.fillStyle = shade; c.fillRect(0, 0, width, height);
}

async function boot() {
  if (!import.meta.env.DEV) throw new Error('HUD review is available only on the local development server.');
  await loadGameFont();
  if (disposed) return;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas rendering is unavailable.');
  const stages = makeStages();
  function draw() {
    const width = canvas.getBoundingClientRect().width;
    if (width <= 0 || disposed) return;
    const logicalWidth = width / HUD_DISPLAY_SCALE;
    // Derive framing from the live layout so a taller or wider HUD needs no fixture edits.
    const layout = getHUDLayout(logicalWidth, 1000);
    const panelHeight = Math.ceil(layout.height * HUD_DISPLAY_SCALE + 84);
    const height = panelHeight * stages.length + PANEL_GAP * (stages.length - 1);
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    canvas.style.height = `${height}px`;
    const c = context!;
    c.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    c.fillStyle = '#090f14'; c.fillRect(0, 0, width, height);
    stages.forEach((stage, index) => {
      c.save(); c.translate(0, index * (panelHeight + PANEL_GAP));
      c.beginPath(); c.rect(0, 0, width, panelHeight); c.clip();
      ground(c, width, panelHeight);
      text(c, stage.name, 20, 15, 1.7, '#dfd0ab');
      text(c, stage.detail, 20, 38, 1.05, '#849e99');
      c.save(); c.scale(HUD_DISPLAY_SCALE, HUD_DISPLAY_SCALE);
      drawFloatingHUD(c, stage.player, logicalWidth, panelHeight / HUD_DISPLAY_SCALE, stage.time, stage.options);
      c.restore();
      c.strokeStyle = '#354642'; c.lineWidth = 1; c.strokeRect(.5, .5, width - 1, panelHeight - 1);
      c.restore();
    });
    download.href = canvas.toDataURL('image/png');
    download.download = 'evergrowing-hud-review.png'; download.hidden = false;
    status.textContent = `Frozen procedural HUD · PNG ${canvas.width} × ${canvas.height}`;
    root.dataset.ready = 'true'; root.setAttribute('aria-busy', 'false');
  }
  draw();
  window.addEventListener('resize', draw, { signal: abort.signal });
}

void boot().catch(error => {
  if (disposed) return;
  root.setAttribute('aria-busy', 'false'); status.setAttribute('role', 'alert');
  status.textContent = error instanceof Error ? error.message : 'The HUD could not be drawn.';
});
if (import.meta.hot) import.meta.hot.dispose(() => { disposed = true; abort.abort(); });
