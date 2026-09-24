import { eventSite, type EventSite } from '../poi-content.ts';
import { EVENT_RECIPES, eventRecipe } from '../event-recipes.ts';
import { eventChoicePresentation, eventChoiceMarkup, type EventChoicePresentation } from '../event-choice-presentation.ts';
import { uiIcon } from '../ui-icons.ts';
import { escapeUI } from '../ui-components.ts';
import { installUITheme } from '../ui-theme.ts';
import { loadGameFont } from '../font.ts';
import { World } from '../world.ts';
import { Simulation } from '../simulation.ts';
import { Renderer } from '../renderer.ts';
import { PostFX } from '../postfx.ts';
import '../poi-panel.css';
import './event-choice-study.css';

// Selected runtime layout over frozen scenery, without gameplay or character persistence.
const kindNames: Record<string, string> = { cursedChest: 'Cursed chest', ruinedChapel: 'Chapel', beastDen: 'Den', quarry: 'Quarry', hamlet: 'Hamlet', crossing: 'Crossing', corruptedGrove: 'Grove', graveyard: 'Vigil', standingStones: 'Blessing', caravan: 'Caravan' };
const scenarios = ['cursedChest', 'caravan', 'standingStones', 'ruinedChapel', 'beastDen', 'quarry', 'hamlet', 'crossing', 'corruptedGrove', 'graveyard'].flatMap(kind =>
  (EVENT_RECIPES[kind] ?? [undefined]).map((recipe, index) => ({ id: `${kind}:${index}`, kind, index, label: `${kindNames[kind]}${recipe && (EVENT_RECIPES[kind]?.length ?? 0) > 1 ? ` · ${recipe.action}` : ''}` })));


export async function mountChoiceStudy(root: HTMLElement, signal: AbortSignal): Promise<void> {
  installUITheme(); await loadGameFont(); if (signal.aborted) return;
  const params = new URLSearchParams(location.search);
  let scenario = scenarios.find(s => s.id === params.get('scenario')) ?? scenarios[0];
  let narrow = params.get('size') === 'narrow', closed = false;
  const world = new World(7319), renderer = new Renderer();
  const canvas = document.createElement('canvas'); canvas.width = 1440; canvas.height = 960; canvas.className = 'choice-scenery'; canvas.setAttribute('aria-hidden', 'true');
  const fx = new PostFX(canvas);
  const sites = world.getWildernessSites(-8000, -8000, 16000, 16000).map(s => eventSite(s, world.seed));
  signal.addEventListener('abort', () => { fx.dispose(); world.dispose(); }, { once: true });
  root.className = 'choice-study';
  root.innerHTML = `<header class="choice-study-heading"><div><p>EVENT INTERACTIONS / ACTION ROWS</p><h1>Event choices</h1></div><a href="/events.html">Event scenes ${uiIcon('chevron')}</a></header>
    <div class="choice-study-toolbar"><label>Event <select data-scenario>${scenarios.map(s => `<option value="${s.id}">${escapeUI(s.label)}</option>`).join('')}</select></label><label>Viewport <select data-size><option value="desktop">Desktop</option><option value="narrow">Narrow · 390px</option></select></label><button type="button" data-reopen>Reset preview</button></div>
    <div class="choice-stage"><div class="choice-mount"></div></div>
    <div class="choice-study-foot"><p role="status" class="choice-status">Preview only · Choices never start an event or change a save.</p><details><summary>Consistent choice icons</summary><div class="choice-legend">${([['hourglass','Timed battle'],['sword','Clear enemies'],['shield','Hold ground'],['seal','Break seals'],['inventory','Equipment'],['gold','Gold'],['potion','Mana'],['dodge','Movement']] as const).map(([mark,label]) => `<span>${uiIcon(mark)}${label}</span>`).join('')}</div></details></div>`;
  const stage = root.querySelector<HTMLElement>('.choice-stage')!;
  stage.prepend(canvas);
  const mount = root.querySelector<HTMLElement>('.choice-mount')!;
  const status = root.querySelector<HTMLElement>('.choice-status')!;
  let content: EventChoicePresentation;
  function stageSite() {
    const found = sites.filter(s => s.kind === scenario.kind).sort((a,b) => Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y))[0];
    if (!found) throw new Error(`No staged ${scenario.kind} site`);
    const site: EventSite = { ...found, level: 12 };
    const recipes = EVENT_RECIPES[site.kind];
    if (recipes) while (eventRecipe(site) !== recipes[scenario.index]) site.seed = (site.seed + 256) >>> 0;
    const sim = new Simulation(world, { spawn: false, seed: 7319, startX: site.x+55, startY: site.y+85 }); sim.time = 12;
    renderer.reset(); renderer.resize(1440, 960); renderer.cameraX = site.x; renderer.cameraY = site.y;
    renderer.render(sim, world, 0, { phase: 'playing', fixedCamera: true, reducedMotion: true }); fx.render(renderer.canvas, sim.time);
    content = eventChoicePresentation(site);
  }
  function render() {
    params.delete('proposal'); params.set('choices', ''); params.set('scenario', scenario.id); params.set('size', narrow ? 'narrow' : 'desktop');
    history.replaceState(null, '', `${location.pathname}?${params}`);
    root.querySelector<HTMLSelectElement>('[data-scenario]')!.value = scenario.id;
    root.querySelector<HTMLSelectElement>('[data-size]')!.value = narrow ? 'narrow' : 'desktop';
    stage.classList.toggle('is-narrow', narrow);
    mount.innerHTML = closed ? '<button type="button" class="ui-button" data-reopen>Reopen interaction</button>' : eventChoiceMarkup(content, false, false);
    root.dataset.ready = 'true'; root.setAttribute('aria-busy', 'false');
  }
  function closePreview() { closed = true; render(); mount.querySelector<HTMLButtonElement>('[data-reopen]')?.focus(); }
  root.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!target) return;
    if (target.hasAttribute('data-reopen')) { closed = false; status.textContent = 'Preview only · Choices never start an event or change a save.'; render(); }
    else if (target.hasAttribute('data-close')) closePreview();
    else if (target.dataset.choice !== undefined) {
      const choice = content.choices.find(c => (c.id ?? '') === target.dataset.choice);
      if (choice) { status.textContent = `Preview: ${choice.title}. No event was started.`; closePreview(); }
    }
  }, { signal });
  root.addEventListener('change', event => {
    const target = event.target as HTMLSelectElement;
    if (target.hasAttribute('data-scenario')) { scenario = scenarios.find(s => s.id === target.value)!; closed = false; stageSite(); }
    else if (target.hasAttribute('data-size')) narrow = target.value === 'narrow';
    render(); status.textContent = 'Preview only · Choices never start an event or change a save.';
  }, { signal });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mount.contains(event.target as Node) && !closed) { event.preventDefault(); closePreview(); }
  }, { signal });
  stageSite(); render();
}
