import { toolPage } from './common.ts';
import { SKILL_DEFINITIONS } from '../skill-content.ts';
import { skillIconSVG } from '../skill-icon.ts';
import { drawSkillIconSheet, ICON_STUDY_SKILLS, ICON_CARD_HEIGHT } from './skill-icon-sheet.ts';
import type { SkillId } from '../character-types.ts';
import { escapeUI } from '../ui-components.ts';

const root = await toolPage('Skill icon workshop', 'Procedural metal, carved facets and elemental cores. Compare the shared artwork at inspection, hotbar and skill-tree sizes.');
root.insertAdjacentHTML('beforeend', `<div class="tool-toolbar"><label>Collection <select id="collection"><option value="study">First six</option><option value="all">All 30 skills</option><option>Might</option><option>Cunning</option><option>Arcana</option></select></label><button id="export">Export PNG</button><a class="tools-button" href="/tools/skills.html">Skill playground ↗</a></div><canvas id="icons" style="display:block;width:100%" role="img"></canvas><details><summary>SVG controls · same drawing recipe</summary><div id="svg-icons" style="display:flex;flex-wrap:wrap;gap:24px;padding:20px 0"></div></details>`);
const canvas = root.querySelector<HTMLCanvasElement>('#icons')!, context = canvas.getContext('2d')!;
const selector = root.querySelector<HTMLSelectElement>('#collection')!;
const query = new URLSearchParams(location.search).get('collection');
if ([...selector.options].some(o => o.value === query)) selector.value = query!;
let visible: readonly SkillId[] = ICON_STUDY_SKILLS;
function draw(): void {
  const width = Math.max(260, Math.floor(canvas.clientWidth));
  const columns = Math.max(1, Math.min(visible.length === 6 ? 3 : 5, Math.floor(width / 280)));
  const height = Math.ceil(visible.length / columns) * ICON_CARD_HEIGHT;
  const density = Math.min(3, window.devicePixelRatio || 1);
  canvas.style.height = `${height}px`; canvas.width = Math.round(width * density); canvas.height = Math.round(height * density);
  context.setTransform(density, 0, 0, density, 0, 0); drawSkillIconSheet(context, visible, width, columns);
}
function refresh(): void {
  visible = selector.value === 'study' ? ICON_STUDY_SKILLS : Object.values(SKILL_DEFINITIONS).filter(s => selector.value === 'all' || s.domain === selector.value).sort((a, b) => ['Might', 'Cunning', 'Arcana'].indexOf(a.domain) - ['Might', 'Cunning', 'Arcana'].indexOf(b.domain) || ['basic', 'advanced', 'ultimate'].indexOf(a.tier) - ['basic', 'advanced', 'ultimate'].indexOf(b.tier) || a.name.localeCompare(b.name)).map(s => s.id);
  canvas.setAttribute('aria-label', visible.map(id => SKILL_DEFINITIONS[id].name).join(', ') + '. Each shown at 106, 32 and 24 pixels.');
  root.querySelector('#svg-icons')!.innerHTML = visible.map(id => `<span style="display:grid;justify-items:center;gap:8px">${skillIconSVG(id, 32)}${escapeUI(SKILL_DEFINITIONS[id].name)}</span>`).join('');
  draw();
}
selector.addEventListener('change', () => { const url = new URL(location.href); url.searchParams.set('collection', selector.value); history.replaceState(null, '', url); refresh(); });
root.querySelector('#export')!.addEventListener('click', () => {
  const a = document.createElement('a'); a.download = `evergrow-skill-icons-${selector.value}.png`; a.href = canvas.toDataURL('image/png'); a.click();
});
const observer = new ResizeObserver(draw); observer.observe(root); refresh();
const dispose = () => observer.disconnect();
window.addEventListener('pagehide', dispose, { once: true }); if (import.meta.hot) import.meta.hot.dispose(dispose);
