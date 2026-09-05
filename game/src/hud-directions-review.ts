import './typography.css';
import './ui-kit.css';
import './hud-directions.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Simulation } from './simulation.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { Lifetime } from './lifetime.ts';
import { drawConceptControls, type ConceptMaterial } from './hud-concept-controls.ts';
import { drawReliquary } from './hud-concept-reliquary.ts';
import { drawThornbound } from './hud-concept-thornbound.ts';
import { drawAstral } from './hud-concept-astral.ts';
import { drawHUDContents } from './hud.ts';
import { HUD_ART } from './hud-layout.ts';

// Art propositions only: no Game instance, input bindings, simulation ticks or saves.
const proposals: { id: ConceptMaterial; name: string; subtitle: string; material: string; character: string;
  draw(c: CanvasRenderingContext2D, time: number): void }[] = [
  { id: 'reliquary', name: 'The Reliquary', subtitle: 'Carved stone · aged brass · cathedral tracery',
    material: 'Gothic arches cradle the glass; a ceremonial crest ties the skills together.',
    character: 'The most classical ARPG direction. Weighty, precious, and deliberately ornate.', draw: drawReliquary },
  { id: 'thornbound', name: 'Thornbound', subtitle: 'Rootwood · bronze clasps · jade patina',
    material: 'Sculpted roots and thorned shoulders grow around the resource vessels.',
    character: 'A living relic that belongs to Evergrow’s wilderness.', draw: drawThornbound },
  { id: 'astral', name: 'The Astral Instrument', subtitle: 'Blackened steel · silver · celestial engraving',
    material: 'Calibrated rings, star marks, and suspended plates make the HUD an occult instrument.',
    character: 'The most precise direction. More negative space, cooler metal, quieter ornament.', draw: drawAstral },
];
const root = document.querySelector<HTMLElement>('#hud-directions')!;
const lifetime = new Lifetime(), abort = new AbortController();
lifetime.defer(() => abort.abort());
let disposed = false, pressured = false, detail = true, scheduled = 0;
const sheets: { canvas: HTMLCanvasElement; link: HTMLAnchorElement; proposal: typeof proposals[number] }[] = [];

async function boot() {
  if (!import.meta.env.DEV) throw new Error('HUD directions are available only on the local development server.');
  installUITheme(); await loadGameFont(); if (disposed) return;
  root.innerHTML = `<header class="directions-header"><p class="ui-kicker">EVERGROW / ART DIRECTION</p>
    <h1 class="ui-title">A HUD with more character.</h1><p class="ui-body">Three procedural studies, from a gothic heirloom to a living relic.
    The selected Astral Instrument reflects the current skill bar. Compare materials and detail with the original studies.</p></header>
    <div class="directions-toolbar"><div aria-label="Resource state">
      <button type="button" class="ui-button ui-button--quiet" data-state="ready" aria-pressed="true">Ready</button>
      <button type="button" class="ui-button ui-button--quiet" data-state="pressured" aria-pressed="false">Under pressure</button>
    </div><div aria-label="Study scale"><button type="button" class="ui-button ui-button--quiet" data-scale="detail" aria-pressed="true">Detail view</button>
      <button type="button" class="ui-button ui-button--quiet" data-scale="game" aria-pressed="false">Game size</button></div></div>
    <div class="directions-studies"></div><p class="directions-note">The Astral Instrument is selected and implemented in the live HUD. These original studies share its procedural frame.
    The selected direction can carry into item frames, equipment slots, and inventory ornament.</p>
    <p class="directions-status" role="status">Preparing frozen studies…</p>`;
  const holder = root.querySelector('.directions-studies')!;
  for (const [index, proposal] of proposals.entries()) {
    const article = document.createElement('article'); article.className = `direction${proposal.id === 'astral' ? ' direction-selected' : ''}`;
    article.innerHTML = `<header><div><div class="direction-heading"><span class="direction-number">0${index + 1}</span><h2>${proposal.name}</h2></div>
      <p class="direction-subtitle">${proposal.subtitle}</p></div>${proposal.id === 'astral' ? '<span class="ui-badge">SELECTED</span>' : ''}</header>
      <canvas role="img" aria-label="${proposal.name} bottom HUD art proposition"></canvas>
      <footer><p><strong>Design.</strong> ${proposal.material}</p><div><p><strong>Character.</strong> ${proposal.character}</p>
        <a class="directions-export">Save study PNG</a></div></footer>`;
    holder.append(article);
    sheets.push({ canvas: article.querySelector('canvas')!, link: article.querySelector('a')!, proposal });
  }
  const world = lifetime.own(new World(7319)), sim = new Simulation(world, { spawn: false }), renderer = new Renderer();
  sim.player.angle = -.65;
  // Frame the forest below the stationary character so its silhouette cannot
  // be mistaken for part of a HUD crest in the comparison crop.
  renderer.resize(1000, 400); renderer.cameraX = 0; renderer.cameraY = 170;
  renderer.render(sim, world, 1, { phase: 'paused', reducedMotion: true, fps: 0, debug: false });
  const backdrop = document.createElement('canvas'); backdrop.width = 1500; backdrop.height = 600;
  const postfx = lifetime.own(new PostFX(backdrop)); postfx.render(renderer.canvas, 0);
  const draw = () => {
    scheduled = 0; if (disposed) return;
    sim.player.hp = pressured ? 39 : 100; sim.player.mana = pressured ? 68 : 94;
    sim.player.dodgeCharges = pressured ? 1 : 2; sim.player.dodgeRecharge = pressured ? 1.2 : 0;
    sim.player.flasks = pressured ? 1 : 2;
    sim.player.level = pressured ? 2 : 1; sim.player.xp = pressured ? 90 : 60;
    for (const { canvas, link, proposal } of sheets) {
      const width = canvas.clientWidth, height = 252; if (width < 1) continue;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      const c = canvas.getContext('2d', { alpha: false }); if (!c) throw new Error('Canvas rendering is unavailable.');
      c.setTransform(ratio, 0, 0, ratio, 0, 0);
      const sourceHeight = backdrop.width * height / width;
      c.drawImage(backdrop, 0, Math.max(0, (backdrop.height - sourceHeight) / 2), backdrop.width, Math.min(backdrop.height, sourceHeight), 0, 0, width, height);
      c.fillStyle = '#06101560'; c.fillRect(0, 0, width, height);
      const shade = c.createLinearGradient(0, 0, 0, height);
      shade.addColorStop(0, '#060c1120'); shade.addColorStop(1, '#040a10c9');
      c.fillStyle = shade; c.fillRect(0, 0, width, height);
      const scale = Math.min(detail ? 1.28 : .82, (width - 24) / 520);
      const artHeight = proposal.id === 'astral' ? HUD_ART.height : 156;
      c.save(); c.translate((width - 520 * scale) / 2, height - artHeight * scale - 16); c.scale(scale, scale);
      proposal.draw(c, 9.2);
      if (proposal.id === 'astral') drawHUDContents(c, sim.player, 9.2, { healthTrail: pressured ? .73 : 1 });
      else drawConceptControls(c, proposal.id, pressured, 9.2);
      c.restore();
      link.href = canvas.toDataURL('image/png'); link.download = `evergrow-${proposal.id}-${pressured ? 'pressured' : 'ready'}.png`;
    }
    root.dataset.ready = 'true'; root.setAttribute('aria-busy', 'false');
    root.querySelector('.directions-status')!.textContent = `${detail ? 'Enlarged detail' : 'Compact game size'} · ${pressured ? '39 life / 68 mana · cooldown and charge states' : '100 life / 94 mana'} · frozen world`;
  };
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-state], [data-scale]')) {
    button.addEventListener('click', () => {
      if (button.dataset.state) pressured = button.dataset.state === 'pressured';
      if (button.dataset.scale) detail = button.dataset.scale === 'detail';
      for (const choice of root.querySelectorAll<HTMLButtonElement>('[data-state]')) choice.setAttribute('aria-pressed', String((choice.dataset.state === 'pressured') === pressured));
      for (const choice of root.querySelectorAll<HTMLButtonElement>('[data-scale]')) choice.setAttribute('aria-pressed', String((choice.dataset.scale === 'detail') === detail));
      draw();
    }, { signal: abort.signal });
  }
  const observer = new ResizeObserver(() => { if (!scheduled) scheduled = requestAnimationFrame(draw); });
  observer.observe(holder); lifetime.defer(() => { observer.disconnect(); cancelAnimationFrame(scheduled); });
  backdrop.addEventListener('webglcontextrestored', () => { postfx.render(renderer.canvas, 0); draw(); }, { signal: abort.signal });
  draw();
}

void boot().catch(error => {
  if (disposed) return;
  try { lifetime.dispose(); } catch (cleanupError) { console.error(cleanupError); }
  root.textContent = error instanceof Error ? error.message : 'The HUD studies could not be drawn.';
  root.setAttribute('role', 'alert'); root.setAttribute('aria-busy', 'false');
});
function dispose() { if (disposed) return; disposed = true; lifetime.dispose(); }
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); }, { signal: abort.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
