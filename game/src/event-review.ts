import './typography.css';
import './ui-kit.css';
import './layout-review.css';
import { installUITheme } from './ui-theme.ts';
import { loadGameFont } from './font.ts';
import { World } from './world.ts';
import { Renderer } from './renderer.ts';
import { PostFX } from './postfx.ts';
import { Simulation } from './simulation.ts';
import { eventLabel, eventSite, type EventKind, type EventRecord, type EventSite } from './poi-content.ts';
import { eventRewards } from './poi-rewards.ts';
import { treasureLanding } from './treasure-flight.ts';
import { EventPanel } from './poi-panel.ts';
import { EVENT_RECIPES, eventRecipe, isTrialKind } from './event-recipes.ts';
import { eventStudyProfile, stageEventProgress } from './tools/event-progress-study.ts';
import { eventProgress } from './event-progress.ts';
import { EVENT_CARD_MOTION } from './event-progress-presentation.ts';
import './tools/event-review.css';
// Frozen, memory-only scenes. Only presentation time advances; no combat, inputs or storage.
const views: readonly [EventKind, string][] = [
  ['cursedChest', 'Cursed chest'], ['ruinedChapel', 'Chapel'], ['beastDen', 'Den'], ['quarry', 'Quarry'],
  ['hamlet', 'Hamlet'], ['crossing', 'Crossing'], ['corruptedGrove', 'Grove'], ['camp', 'Strongbox'],
  ['caravan', 'Caravan'], ['watchtower', 'Beacon'], ['graveyard', 'Vigil'], ['standingStones', 'Blessing'], ['reliquary', 'Reliquary'],
];
const root = document.querySelector<HTMLElement>('#event-review')!;
const lifetime = new AbortController();
type PreviewState = 'available' | 'progress' | 'opening' | 'completed' | 'claimed';
let disposed = false, frame = 0, world: World | undefined, fx: PostFX | undefined, panel: EventPanel | undefined;
async function boot() {
  if (!import.meta.env.DEV) throw new Error('Local review only.');
  installUITheme(); await loadGameFont(); if (disposed) return;
  world = new World(7319); const scene = world;
  const landmarks = scene.getWildernessSites(-8000, -8000, 16000, 16000);
  const sites = landmarks.map(s => eventSite(s, scene.seed));
  const relic = scene.getEventSites(-2000, -16000, 4000, 32000).find(s => s.kind === 'reliquary');
  if (relic) sites.push(relic);
  const renderer = new Renderer(), display = document.createElement('canvas'), canvas = document.createElement('canvas');
  for (const c of [display, canvas]) { c.width = 1920; c.height = 1280; }
  canvas.className = 'layout-review-scene'; canvas.setAttribute('role', 'img');
  root.innerHTML = `<header class="layout-review-header"><h1>World events</h1></header>
    <nav class="layout-review-views event-review-events" aria-label="World event"></nav>
    <div class="event-review-settings">
      <div class="event-review-state"><span class="event-review-label">Preview state</span><div class="event-review-segments" role="group" aria-label="Preview state"><button data-preview-state="available" aria-pressed="true">Available</button><button data-preview-state="progress" aria-pressed="false">In progress</button><button data-preview-state="opening" aria-pressed="false">Opening</button><button data-preview-state="completed" aria-pressed="false">Completed</button><button data-preview-state="claimed" aria-pressed="false">Claimed</button></div></div>
      <label class="event-review-recipe" hidden><span class="event-review-label">Encounter recipe</span><select class="progress-recipe"></select></label>
      <button class="choice-button">View choices ↗</button>
    </div>
    <div class="event-review-progress" hidden><button class="progress-play">Pause</button><label class="event-review-timeline">Timeline <input class="progress-time" type="range" min="0" step="0.1" value="0"></label><label>Speed <select class="progress-speed"><option value="1">1×</option><option value="5">5×</option><option value="10">10×</option></select></label><button class="progress-restart">Restart</button><output class="progress-readout"></output></div>
    <div class="event-review-progress card-motion-controls" hidden role="group" aria-label="HUD card animation"><span class="event-review-label">HUD card</span><button class="card-enter">Replay entrance</button><button class="card-exit">Replay exit</button><label class="event-review-timeline">Animation <input class="card-time" type="range" min="0" max="${EVENT_CARD_MOTION.duration}" step="0.01" value="0"></label><label>Motion speed <select class="card-speed"><option value="1">1×</option><option value="0.5">0.5×</option><option value="0.25">0.25×</option></select></label><output class="card-readout">Replay or scrub the card animation; event time stays paused.</output></div>
    <p class="layout-review-static progress-note">Disposable visual preview · No combat or saves.</p>
    <figure class="layout-review-figure"><div class="layout-review-frame"></div></figure>`;
  root.querySelector('.layout-review-frame')!.append(canvas);
  panel = new EventPanel(document.body, { close: () => panel!.close(), choose: () => panel!.close() });
  const params = new URLSearchParams(location.search);
  let kind = views.find(([k]) => k === params.get('view'))?.[0] ?? 'cursedChest';
  let previewState: PreviewState = 'available';
  let sim: Simulation, selected: EventSite;
  let paused = false, previous = 0, studyTime = 0, recipeIndex = -1;
  let cardMotion: { direction: 'enter' | 'exit'; elapsed: number; finishEvent: boolean } | null = null;
  let cardPlaying = false;
  const progressControls = root.querySelector<HTMLElement>('.event-review-progress')!;
  const timeline = root.querySelector<HTMLInputElement>('.progress-time')!;
  const playButton = root.querySelector<HTMLButtonElement>('.progress-play')!;
  const speed = root.querySelector<HTMLSelectElement>('.progress-speed')!;
  const readout = root.querySelector<HTMLOutputElement>('.progress-readout')!;
  const recipeSelect = root.querySelector<HTMLSelectElement>('.progress-recipe')!;
  const note = root.querySelector<HTMLElement>('.progress-note')!;
  const cardControls = root.querySelector<HTMLElement>('.card-motion-controls')!;
  const cardTime = root.querySelector<HTMLInputElement>('.card-time')!;
  const cardSpeed = root.querySelector<HTMLSelectElement>('.card-speed')!;
  const cardReadout = root.querySelector<HTMLOutputElement>('.card-readout')!;
  const buttons = new Map<EventKind, HTMLButtonElement>();
  const reviewRecord = (phase: EventRecord['phase']): EventRecord => ({ ...selected, phase, choice: kind === 'caravan' ? 'goods' : kind === 'standingStones' ? 'haste' : null, wavesCleared: kind === 'cursedChest' ? 6 : 0, delivered: 0, bonusGranted: phase === 'claimed' });
  function paint(animated = false, dt = 0) {
    const settings = { phase: 'playing' as const, reducedMotion: !animated || matchMedia('(prefers-reduced-motion: reduce)').matches };
    renderer.render(sim, scene, dt, settings); fx ??= new PostFX(display); fx.render(renderer.canvas, sim.time);
    const c = canvas.getContext('2d')!; c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(display, 0, 0);
    c.save(); c.scale(2, 2); renderer.renderUI(c, sim, scene, settings); c.restore();
    canvas.setAttribute('aria-label', `${selected.name}, ${previewState === 'progress' ? readout.value : previewState}`);
  }
  function draw() {
    cancelAnimationFrame(frame);
    progressControls.hidden = cardControls.hidden = true; cardMotion = null; cardPlaying = false; panel?.close();
    selected = sites.filter(s => s.kind === kind).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0];
    if (!selected) return;
    const recipes = EVENT_RECIPES[kind] ?? [];
    if (recipeIndex >= 0 && recipes.length > 1) {
      selected = { ...selected };
      while (eventRecipe(selected) !== recipes[recipeIndex]) selected.seed = (selected.seed + 256) >>> 0;
    }
    root.querySelector<HTMLElement>('.event-review-recipe')!.hidden = recipes.length < 2;
    recipeSelect.replaceChildren(...recipes.map((recipe, index) => {
      const option = document.createElement('option'); option.value = String(index);
      option.textContent = `${recipe.action} · ${recipe.mode}`; option.selected = recipe === eventRecipe(selected); return option;
    }));
    note.textContent = 'Disposable visual preview · No combat or saves.';
    sim = new Simulation(scene, { spawn: false, seed: 7319, startX: selected.x + 42, startY: selected.y + 35 });
    sim.time = 12; sim.player.angle = -Math.PI / 2;
    if (previewState === 'completed') {
      if (kind === 'camp') {
        const checkpoint = sim.captureCheckpoint(); checkpoint.clearedCamps = [selected.id]; sim.restoreCheckpoint(checkpoint);
      } else sim.eventState.sites[selected.id] = reviewRecord('completed');
    } else if (previewState === 'claimed') {
      if (kind === 'camp') {
        const checkpoint = sim.captureCheckpoint(); checkpoint.clearedCamps = [selected.id]; sim.restoreCheckpoint(checkpoint);
      }
      sim.eventState.sites[selected.id] = reviewRecord('claimed');
    }
    const landmark = ['cursedChest','reliquary'].includes(kind)?undefined:landmarks.find(s => s.id === selected.id);
    renderer.reset(); renderer.resize(960, 640); renderer.cameraX = landmark?.x ?? selected.x; renderer.cameraY = (landmark?.y ?? selected.y) - 40;
    paint();
    for (const [id, b] of buttons) b.setAttribute('aria-current', String(id === kind));
    root.querySelector<HTMLButtonElement>('.choice-button')!.hidden = ['reliquary', 'camp', 'watchtower'].includes(kind);
    root.querySelector<HTMLButtonElement>('[data-preview-state="opening"]')!.disabled = ['watchtower', 'standingStones'].includes(kind);
    root.querySelector<HTMLButtonElement>('[data-preview-state="completed"]')!.disabled = kind !== 'camp' && !isTrialKind(kind);
    syncState();
    root.dataset.ready = 'true'; root.setAttribute('aria-busy', 'false');
  }
  for (const [id, name] of views) {
    const b = document.createElement('button'); b.textContent = name; b.disabled = !sites.some(s => s.kind === id);
    b.addEventListener('click', () => { kind = id; recipeIndex = -1; showState(previewState); }, { signal: lifetime.signal });
    buttons.set(id, b); root.querySelector('nav')!.append(b);
  }
  function syncState() {
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-preview-state]')) button.setAttribute('aria-pressed', String(button.dataset.previewState === previewState));
    params.set('state', previewState); params.set('view', kind);
    history.replaceState(null, '', `${location.pathname}?${params}`);
  }
  function showState(state: PreviewState) {
    if (state === 'opening' && ['watchtower', 'standingStones'].includes(kind)) state = 'claimed';
    if (state === 'completed' && kind !== 'camp' && !isTrialKind(kind)) state = 'claimed';
    previewState = state;
    if (state === 'progress') startProgress();
    else if (state === 'opening') startOpening();
    else draw();
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-preview-state]')) button.addEventListener('click', () => showState(button.dataset.previewState as PreviewState), { signal: lifetime.signal });
  root.querySelector('.choice-button')!.addEventListener('click', () => panel!.open(selected), { signal: lifetime.signal });
  recipeSelect.addEventListener('change', () => { recipeIndex = Number(recipeSelect.value); showState(previewState); }, { signal: lifetime.signal });
  function updateProgress() {
    const staged = stageEventProgress(selected, studyTime);
    sim.eventState = staged.state;
    sim.eventChannel.cancel();
    if (staged.profile.mode === 'channel') { sim.eventChannel.start(selected, null); sim.eventChannel.elapsed = staged.elapsed; }
    timeline.value = String(staged.elapsed);
    readout.value = staged.profile.mode === 'instant' ? 'Instant interaction' : staged.profile.mode === 'channel' ? `${(staged.profile.duration - staged.elapsed).toFixed(1)}s channel remaining` : eventLabel(selected, staged.state, false);
    timeline.setAttribute('aria-valuetext', `${staged.elapsed.toFixed(1)} preview seconds, ${readout.value}`);
    playButton.textContent = paused ? 'Play' : 'Pause';
  }
  function animateProgress(now: number) {
    if (disposed || previewState !== 'progress' || paused || document.hidden) return;
    if (!previous) previous = now;
    const dt = Math.min(.1, (now - previous) / 1000);
    if (dt >= 1 / 30) {
      previous = now;
      const duration = Number(timeline.max);
      studyTime = Math.min(duration, studyTime + dt * Number(speed.value));
      sim.time += dt;
      updateProgress(); paint(true, dt);
      if (studyTime >= duration) {
        if (eventProgress(sim.eventState)) replayCard('exit', true);
        else showState('opening');
        return;
      }
    }
    frame = requestAnimationFrame(animateProgress);
  }
  function startProgress() {
    draw();
    const profile = eventStudyProfile(selected);
    studyTime = 0; timeline.max = String(profile.duration); progressControls.hidden = false;
    timeline.disabled = playButton.disabled = speed.disabled = profile.duration === 0;
    note.textContent = `${profile.note} Disposable state; no playable saves.`;
    paused = profile.duration === 0 || matchMedia('(prefers-reduced-motion: reduce)').matches; previous = 0;
    updateProgress();
    cardControls.hidden = !eventProgress(sim.eventState);
    cardTime.value = '0'; cardReadout.value = 'Replay or scrub the card animation; event time stays paused.';
    renderer.eventProgressPresentation.reset();
    paint(true);
    if (!paused) frame = requestAnimationFrame(animateProgress);
  }
  function paintCard() {
    if (!cardMotion) return;
    updateProgress();
    const progress = eventProgress(sim.eventState), presentation = renderer.eventProgressPresentation;
    presentation.reset();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (cardMotion.direction === 'enter') presentation.update(progress, cardMotion.elapsed, reduced);
    else {
      presentation.update(progress, EVENT_CARD_MOTION.duration, reduced);
      presentation.update(null, cardMotion.elapsed, reduced);
      sim.eventState.trial = null;
      sim.eventState.sites[selected.id].phase = 'completed';
    }
    cardTime.value = String(cardMotion.elapsed);
    const phase = cardMotion.direction === 'enter' ? 'Entrance' : 'Exit';
    cardReadout.value = reduced ? `${phase} · Instant (reduced motion)` : `${phase} · ${cardMotion.elapsed.toFixed(2)} / ${EVENT_CARD_MOTION.duration.toFixed(2)}s · Event time paused`;
    cardTime.setAttribute('aria-valuetext', cardReadout.value);
    paint(true);
  }
  function animateCard(now: number) {
    if (disposed || !cardMotion || document.hidden) return;
    if (!previous) previous = now;
    const dt = Math.min(.1, (now - previous) / 1000); previous = now;
    cardMotion.elapsed = matchMedia('(prefers-reduced-motion: reduce)').matches ? EVENT_CARD_MOTION.duration
      : Math.min(EVENT_CARD_MOTION.duration, cardMotion.elapsed + dt * Number(cardSpeed.value));
    paintCard();
    if (cardMotion.elapsed < EVENT_CARD_MOTION.duration) frame = requestAnimationFrame(animateCard);
    else { cardPlaying = false; if (cardMotion.finishEvent) showState('opening'); }
  }
  function replayCard(direction: 'enter' | 'exit', finishEvent = false) {
    cancelAnimationFrame(frame); paused = true; cardPlaying = true; previous = 0;
    cardMotion = { direction, elapsed: 0, finishEvent };
    paintCard(); frame = requestAnimationFrame(animateCard);
  }
  root.querySelector('.card-enter')!.addEventListener('click', () => replayCard('enter'), { signal: lifetime.signal });
  root.querySelector('.card-exit')!.addEventListener('click', () => replayCard('exit'), { signal: lifetime.signal });
  cardTime.addEventListener('input', () => {
    cancelAnimationFrame(frame); paused = true; cardPlaying = false;
    cardMotion = { direction: cardMotion?.direction ?? 'enter', elapsed: Number(cardTime.value), finishEvent: false };
    paintCard();
  }, { signal: lifetime.signal });
  root.querySelector('.progress-restart')!.addEventListener('click', startProgress, { signal: lifetime.signal });
  playButton.addEventListener('click', () => {
    cardMotion = null; cardPlaying = false; paused = !paused; previous = 0; cancelAnimationFrame(frame); updateProgress();
    cardReadout.value = 'Replay or scrub the card animation; event time stays paused.';
    if (!paused) frame = requestAnimationFrame(animateProgress);
  }, { signal: lifetime.signal });
  timeline.addEventListener('input', () => {
    if (previewState !== 'progress') return;
    cardMotion = null; cardPlaying = false; paused = true; cancelAnimationFrame(frame);
    cardReadout.value = 'Replay or scrub the card animation; event time stays paused.';
    studyTime = Number(timeline.value);
    updateProgress(); paint();
  }, { signal: lifetime.signal });
  document.addEventListener('visibilitychange', () => {
    if (previewState !== 'progress') return;
    cancelAnimationFrame(frame); previous = 0;
    if (!document.hidden) {
      if (cardPlaying) frame = requestAnimationFrame(animateCard);
      else if (!paused) frame = requestAnimationFrame(animateProgress);
    }
  }, { signal: lifetime.signal });
  function startOpening() {
    draw();
    let previous = performance.now(), elapsed = 0, opened = false;
    function animate(now: number) {
      if (disposed) return;
      const dt = Math.min(.05, (now - previous) / 1000); previous = now;
      if (document.hidden) { frame = requestAnimationFrame(animate); return; }
      elapsed += dt; sim.time = 12 + elapsed;
      if (!opened) {
        opened = true;
        sim.eventChannel.cancel(); const record = reviewRecord('claimed');
        sim.eventState.sites[selected.id] = record; const bundle = eventRewards(record);
        sim.groundItems = bundle.items.map((item, i) => ({ id: i + 1, item, ...treasureLanding(scene, selected.x, selected.y, i, selected.seed), flight: { x: selected.x, y: selected.y, at: 12, delay: i * .11 } }));
        if (bundle.gold) sim.groundGold = [{ id: 100, amount: bundle.gold, age: 0, ...treasureLanding(scene, selected.x, selected.y, 12, selected.seed), flight: { x: selected.x, y: selected.y, at: 12, delay: .1 } }];
      }
      for (const pile of sim.groundGold) pile.age = elapsed;
      paint(true, dt);
      if (elapsed < 4) frame = requestAnimationFrame(animate);
      else { previewState = 'claimed'; syncState(); paint(); }
    }
    frame = requestAnimationFrame(animate);
  }
  const initialState = params.get('state');
  showState(initialState === 'progress' || initialState === 'opening' || initialState === 'completed' || initialState === 'claimed' ? initialState : 'available');
}
void boot().catch(e => { root.textContent = String(e); root.dataset.ready = 'error'; });
function dispose() { disposed = true; cancelAnimationFrame(frame); lifetime.abort(); panel?.dispose(); fx?.dispose(); world?.dispose(); }
window.addEventListener('pagehide', e => { if (!e.persisted) dispose(); }, { signal: lifetime.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
