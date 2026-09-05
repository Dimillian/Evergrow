import './typography.css';
import './layout-review.css';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { Simulation } from './simulation.ts';
import { forestReviewScene, stageForestPlayer } from './forest-review-scene.ts';

const root = document.querySelector<HTMLElement>('#forest-review')!;
const lifetime = new AbortController();
let disposed = false, request = 0, world: World | undefined, post: PostFX | undefined;
let recorder: MediaRecorder | undefined, stream: MediaStream | undefined, download: string | undefined;
async function boot() {
  if (!import.meta.env.DEV) throw new Error('Forest motion review is local development only.');
  await loadGameFont(); if (disposed) return;
  world = new World(7319); const sceneWorld = world, scene = forestReviewScene(world);
  const renderer = new Renderer(); renderer.resize(scene.width, scene.height);
  const simulation = new Simulation(world, { seed: 7319, spawn: false, startX: scene.x - 90, startY: scene.y });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const display = document.createElement('canvas'); display.width = 960; display.height = 587; post = new PostFX(display);
  const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 640;
  canvas.className = 'layout-review-scene'; canvas.style.aspectRatio = '3 / 2';
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Animated Verdant Forest: gusts, reactive grass, falling leaves and startled birds.');
  const c = canvas.getContext('2d', { alpha: false })!;
  root.innerHTML = `<header class="layout-review-header"><div><p class="layout-review-eyebrow">EVERGROWING / MOTION STUDY</p><h1>The living forest</h1></div><p>Seed 7319 · Actual renderer + CRT</p></header>
    <div class="layout-review-toolbar"><button type="button" id="forest-record">Record 14-second clip</button><button type="button" id="forest-restart">Restart scene</button><a id="forest-download" hidden>Save recording</a><button type="button" id="forest-export" hidden>Export to project</button></div>
    <figure class="layout-review-figure"><div class="layout-review-frame"></div><figcaption>Traveling gusts · Parting grass · Footstep litter · Crows and butterflies · Shifting canopy light</figcaption></figure>
    <p role="status" id="forest-status">Staged animation. No gameplay ticks or save access.</p>
    <video id="forest-recording" controls hidden style="width:100%;max-width:960px" aria-label="Recorded forest clip"></video>`;
  root.querySelector('.layout-review-frame')!.append(canvas);
  const button = root.querySelector<HTMLButtonElement>('#forest-record')!, status = root.querySelector<HTMLElement>('#forest-status')!;
  const save = root.querySelector<HTMLAnchorElement>('#forest-download')!;
  const exportButton = root.querySelector<HTMLButtonElement>('#forest-export')!;
  let recorded: Blob | undefined;
  let time = 0, previous = performance.now();
  function reset() { time = 0; renderer.reset(); renderer.cameraX = scene.x; renderer.cameraY = scene.y - 60; previous = performance.now(); }
  reset();
  function draw(now: number) {
    if (disposed) return;
    const dt = Math.min(.05, Math.max(0, (now - previous) / 1000)); previous = now;
    if (!reduced.matches) time += dt;
    if (time >= scene.duration) {
      if (recorder?.state === 'recording') recorder.stop();
      reset();
    }
    stageForestPlayer(simulation.player, scene, time); simulation.time = time;
    renderer.render(simulation, sceneWorld, dt, { phase: 'paused', reducedMotion: reduced.matches, fps: 0, debug: false });
    post!.render(renderer.canvas, time);
    c.fillStyle = '#091318'; c.fillRect(0, 0, 960, 640); c.drawImage(display, 0, 32);
    c.font = '18px "Pixelify Sans"'; c.fillStyle = '#d8d8ab'; c.fillText('EVERGROWING / THE LIVING FOREST', 16, 23);
    c.font = '12px "Pixelify Sans"'; c.fillStyle = '#9eb9a4';
    c.fillText('ACTUAL RENDERER + CRT · STAGED MOVEMENT · SEED 7319 · NO GAMEPLAY OR SAVE ACCESS', 16, 634);
    if (recorder?.state === 'recording') status.textContent = `Recording ${Math.floor(time)} / ${scene.duration} seconds…`;
    request = requestAnimationFrame(draw);
  }
  root.querySelector('#forest-restart')!.addEventListener('click', () => { if (recorder?.state !== 'recording') reset(); }, { signal: lifetime.signal });
  button.addEventListener('click', () => {
    if (recorder?.state === 'recording') return;
    if (reduced.matches) { status.textContent = 'Reduced motion is enabled; the scene stays still.'; return; }
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) { status.textContent = 'Recording is unavailable in this browser.'; return; }
    reset(); stream = canvas.captureStream(30); const chunks: BlobPart[] = [];
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 }); button.disabled = true;
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      stream?.getTracks().forEach(track => track.stop()); stream = undefined;
      if (disposed) return;
      if (download) URL.revokeObjectURL(download);
      recorded = new Blob(chunks, { type: mimeType }); download = URL.createObjectURL(recorded);
      save.href = download; save.download = `evergrowing-living-forest.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`; save.hidden = false;
      const video = root.querySelector<HTMLVideoElement>('#forest-recording')!; video.src = download; video.hidden = false;
      exportButton.hidden = false;
      button.disabled = false; status.textContent = 'Recording ready. Save the clip.';
    };
    recorder.start();
  }, { signal: lifetime.signal });
  exportButton.addEventListener('click', () => {
    if (!recorded) return;
    exportButton.disabled = true;
    void fetch('/__forest-recording', { method: 'POST', headers: { 'Content-Type': recorded.type }, body: recorded })
      .then(async response => { if (!response.ok) throw new Error('Local export failed.'); await response.text(); status.textContent = 'Clip exported to the project capture folder.'; })
      .catch(error => { status.textContent = String(error); })
      .finally(() => { exportButton.disabled = false; });
  }, { signal: lifetime.signal });
  root.dataset.ready = 'true'; root.setAttribute('aria-busy', 'false'); request = requestAnimationFrame(draw);
}
void boot().catch(error => { root.textContent = String(error); root.dataset.ready = 'error'; });
function dispose() {
  disposed = true; lifetime.abort(); cancelAnimationFrame(request);
  if (recorder?.state === 'recording') recorder.stop();
  stream?.getTracks().forEach(track => track.stop()); if (download) URL.revokeObjectURL(download);
  post?.dispose(); world?.dispose();
}
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); }, { signal: lifetime.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
