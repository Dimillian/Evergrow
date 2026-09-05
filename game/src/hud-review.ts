import './typography.css';
import { drawFloatingHUD, getHUDLayout, type HUDOptions } from './hud.ts';
import { loadGameFont, text, textWidth } from './font.ts';
import { Simulation } from './simulation.ts';
import { scaledEnemyStats } from './zone-progression.ts';
import { drawEnemyPlate, getEnemyPlateLayout } from './enemy-plate.ts';
import type { Enemy, Player, WorldQuery } from './model.ts';

// This dev-only entry never binds gameplay input, ticks a simulation or accesses saves.
const params = new URLSearchParams(location.search);
const narrow = params.get('size') === 'narrow';
const platesOnly = params.has('plates');
const HUD_DISPLAY_SCALE = narrow ? 1 : 1.35;
const PANEL_GAP = 14;
const ENEMY_PLATE_OFFSET = 56;
const root = document.querySelector<HTMLElement>('#hud-review')!;
if (narrow) root.style.maxWidth = '390px';
const canvas = document.querySelector<HTMLCanvasElement>('#hud-sheet')!;
const status = document.querySelector<HTMLElement>('#review-status')!;
const download = document.querySelector<HTMLAnchorElement>('#save-png')!;
const abort = new AbortController();
let disposed = false;

interface Stage {
  name: string; detail: string; player: Player; time: number; options: HUDOptions;
  enemy: Pick<Enemy, 'kind' | 'hp' | 'maxHp' | 'level' | 'rank'>;
  enemyOptions?: Parameters<typeof drawEnemyPlate>[4];
}
const emptyWorld: WorldQuery = {
  blocked: () => false,
  move: (x, y, dx, dy) => ({ x: x + dx, y: y + dy }),
};

function makeStages(): Stage[] {
  const player = () => new Simulation(emptyWorld, { spawn: false }).player;
  const healthy = player(), damaged = player(), depleted = player();
  healthy.mana = 94;
  healthy.xp = 60;
  damaged.hp = 39; damaged.mana = 68; damaged.dodgeCharges = 1; damaged.dodgeRecharge = 1.2;
  damaged.level = 2; damaged.xp = 90;
  depleted.hp = 16; depleted.mana = 7; depleted.flasks = 0; depleted.dodgeCharges = 0;
  depleted.dodgeRecharge = .56; depleted.healCooldown = .65;
  depleted.level = 4; depleted.xp = 220;
  const brute = scaledEnemyStats('brute', 2, 'veteran'), caster = scaledEnemyStats('caster', 4, 'elite');
  return [
    { name: 'Healthy', detail: 'Full vitality · abilities ready', player: healthy, time: 5.7, options: {},
      enemy: { kind: 'stalker', hp: 48, maxHp: 48, level: 1, rank: 'normal' } },
    { name: 'Damaged', detail: 'Recent impact · trailing vitality · one dodge charge', player: damaged,
      time: 9.2, options: { healthTrail: .83, hitPulse: .5 }, enemy: { kind: 'brute', hp: Math.round(brute.maxHp * .62), maxHp: brute.maxHp, level: 2, rank: 'veteran' },
      enemyOptions: { healthTrail: brute.maxHp * .87, hitPulse: .5 } },
    { name: 'Depleted', detail: 'Low resources · recovery timers · empty flask', player: depleted, time: 14.4, options: {},
      enemy: { kind: 'caster', hp: Math.round(caster.maxHp * .14), maxHp: caster.maxHp, level: 4, rank: 'elite' } },
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
  const allStages = makeStages();
  const selected = allStages.find(stage => stage.name.toLowerCase() === params.get('state'));
  const stages = selected ? [selected] : allStages;
  function draw() {
    const width = canvas.getBoundingClientRect().width;
    if (width <= 0 || disposed) return;
    const logicalWidth = width / HUD_DISPLAY_SCALE;
    // Derive framing from the live layout so a taller or wider HUD needs no fixture edits.
    const layout = getHUDLayout(logicalWidth, 1000);
    // Stage the plate from a normal game viewport; this short crop has no minimap.
    const plateViewportHeight = 450;
    const plate = getEnemyPlateLayout(logicalWidth, plateViewportHeight);
    const hudBottomMargin = (1000 - layout.y - layout.height) * HUD_DISPLAY_SCALE;
    const plateOffset = platesOnly ? (plate.y >= 60 ? -30 : 28) : ENEMY_PLATE_OFFSET;
    const plateBottom = plateOffset + (plate.y + plate.height) * HUD_DISPLAY_SCALE;
    const panelHeight = platesOnly ? Math.ceil(plateBottom + 16) : Math.ceil(Math.max(layout.height * HUD_DISPLAY_SCALE + 174,
      plateBottom + 20 + layout.height * HUD_DISPLAY_SCALE + hudBottomMargin));
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
      text(c, platesOnly ? stage.enemy.rank : stage.name, 20, 15, platesOnly ? 1.2 : 1.7, '#dfd0ab');
      if (!platesOnly) text(c, stage.detail, 20, 38, Math.min(1.05, (width - 40) / Math.max(1, textWidth(stage.detail))), '#849e99');
      c.save(); c.translate(0, plateOffset); c.scale(HUD_DISPLAY_SCALE, HUD_DISPLAY_SCALE);
      drawEnemyPlate(c, stage.enemy, logicalWidth, plateViewportHeight, stage.enemyOptions);
      c.restore();
      c.save(); c.scale(HUD_DISPLAY_SCALE, HUD_DISPLAY_SCALE);
      if (!platesOnly) drawFloatingHUD(c, stage.player, logicalWidth, panelHeight / HUD_DISPLAY_SCALE, stage.time, stage.options);
      c.restore();
      c.strokeStyle = '#354642'; c.lineWidth = 1; c.strokeRect(.5, .5, width - 1, panelHeight - 1);
      c.restore();
    });
    download.href = canvas.toDataURL('image/png');
    download.download = 'evergrowing-hud-review.png'; download.hidden = false;
    status.textContent = `Frozen player HUD and enemy nameplates · PNG ${canvas.width} × ${canvas.height}`;
    root.dataset.ready = 'true'; root.setAttribute('aria-busy', 'false');
  }
  draw();
  if (platesOnly) {
    root.querySelector('h1')!.textContent = 'Enemy heraldry';
    root.querySelector('header p')!.textContent = 'Iron seal · silver pinions · gilded crown';
    canvas.setAttribute('aria-label', 'Normal, veteran, and elite target plates with distinct rank crests.');
  }
  window.addEventListener('resize', draw, { signal: abort.signal });
}

void boot().catch(error => {
  if (disposed) return;
  root.setAttribute('aria-busy', 'false'); status.setAttribute('role', 'alert');
  status.textContent = error instanceof Error ? error.message : 'The HUD could not be drawn.';
});
if (import.meta.hot) import.meta.hot.dispose(() => { disposed = true; abort.abort(); });
