import { World } from '../world.ts';
import { Simulation } from '../simulation.ts';
import { Renderer } from '../renderer.ts';
import { PostFX } from '../postfx.ts';
import { drawRiftPortal, drawRiftPortalEmission } from '../rift-art.ts';

/** Runtime town and isolated artwork; only the presentation clock advances. */
export function mountRiftPortalReview(root: HTMLElement): () => void {
  root.innerHTML = `<section style="max-width:1300px;margin:auto;padding:24px;color:#e2dccc">
    <h1>Crimson Rift · Living aperture</h1><p>Breathing light, twisting tendrils and currents inside the tear.</p>
    <button class="ui-button" data-motion>Pause motion</button>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-top:20px">
      <figure style="margin:0"><canvas data-world width="900" height="620" style="width:100%"></canvas><figcaption>Shared town renderer · frozen character</figcaption></figure>
      <figure style="margin:0"><canvas data-art width="420" height="620" style="width:100%;background:#09101a"></canvas><figcaption>Shared portal artwork · detail</figcaption></figure>
    </div><p>No gameplay or character saves. Motion pauses while this tab is hidden.</p></section>`;
  const world = new World(7319), home = world.getPortalAnchor(0);
  const portal = world.getBuildings(home.x - 900, home.y - 900, 1800, 1800).find(b => b.kind === 'rift')!;
  const x = portal.x + portal.width / 2, y = portal.y + portal.height;
  const sim = new Simulation(world, { spawn: false, startX: x + 36, startY: y + 36 });
  sim.player.angle = -Math.PI / 2;
  const renderer = new Renderer(), canvas = root.querySelector<HTMLCanvasElement>('[data-world]')!;
  const fx = new PostFX(canvas), art = root.querySelector<HTMLCanvasElement>('[data-art]')!.getContext('2d')!;
  renderer.resize(600, 414); renderer.snapTo(sim.player);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), life = new AbortController();
  let paused = reduced.matches, frame = 0, last = 0, time = 0;
  const button = root.querySelector<HTMLButtonElement>('[data-motion]')!;
  function draw(dt: number) {
    renderer.render(sim, world, dt, { phase: 'playing', reducedMotion: reduced.matches }); fx.render(renderer.canvas, dt);
    art.clearRect(0, 0, 420, 620);
    const t = reduced.matches ? 0 : time;
    drawRiftPortal(art, 210, 410, t, 1.85); drawRiftPortalEmission(art, 210, 410, t, 1.85);
    button.textContent = reduced.matches ? 'Reduced motion' : paused ? 'Animate portal' : 'Pause motion';
    button.disabled = reduced.matches;
  }
  function tick(now: number) {
    frame = 0; const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now; time += dt;
    draw(dt); if (!paused && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function restart() { cancelAnimationFrame(frame); last = 0; draw(0); if (!paused && !document.hidden) frame = requestAnimationFrame(tick); }
  button.addEventListener('click', () => { paused = !paused; restart(); }, { signal: life.signal });
  document.addEventListener('visibilitychange', restart, { signal: life.signal });
  reduced.addEventListener('change', () => { paused = reduced.matches; restart(); }, { signal: life.signal });
  restart();
  return () => { cancelAnimationFrame(frame); life.abort(); fx.dispose(); world.dispose(); };
}
