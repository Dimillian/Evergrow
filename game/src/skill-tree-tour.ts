import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { SKILL_NODES } from './skill-tree.ts';
import { skillNodeIconSVG } from './skill-tree-glyphs.ts';
import { SKILL_TOUR_STEPS, type SkillTourStep } from './skill-tree-tour-content.ts';
import './skill-tree-tour.css';

interface TourActions {
  stage(step: SkillTourStep): void;
  bounds(step: SkillTourStep): { x: number; y: number; width: number; height: number } | undefined;
  finish(): void;
}

/** Read-only tour chrome. Only the host can change atlas presentation. */
export class SkillTreeTour {
  readonly dialog = document.createElement('dialog');
  private readonly card = document.createElement('section');
  private readonly spotlight = document.createElement('div');
  private readonly life = new AbortController();
  private readonly observer: ResizeObserver;
  private focus?: { dispose(): void };
  private frame = 0;
  private index = 0;
  private readonly actions: TourActions;

  constructor(mount: HTMLElement, actions: TourActions) {
    this.actions = actions;
    this.dialog.className = 'skill-tour';
    this.dialog.setAttribute('aria-labelledby', 'skill-tour-title');
    this.dialog.setAttribute('aria-describedby', 'skill-tour-body');
    this.card.className = 'ui-window skill-tour-card';
    this.spotlight.className = 'skill-tour-spotlight'; this.spotlight.setAttribute('aria-hidden', 'true');
    this.dialog.append(this.spotlight, this.card); mount.append(this.dialog);
    this.dialog.addEventListener('click', event => {
      const action = (event.target as Element).closest<HTMLElement>('[data-tour]')?.dataset.tour;
      if (action === 'exit' || action === 'next' && this.index === SKILL_TOUR_STEPS.length - 1) actions.finish();
      else if (action === 'next') this.show(this.index + 1);
      else if (action === 'back') this.show(this.index - 1);
    }, { signal: this.life.signal });
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); actions.finish(); }, { signal: this.life.signal });
    this.dialog.addEventListener('keydown', event => {
      // Keep tree/game shortcuts out of the guide, including Escape's second close.
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); actions.finish(); }
    }, { signal: this.life.signal });
    window.addEventListener('resize', () => this.refreshLayout(), { signal: this.life.signal });
    this.dialog.addEventListener('scroll', () => this.refreshLayout(), { signal: this.life.signal, capture: true });
    this.observer = new ResizeObserver(() => this.refreshLayout());
    this.observer.observe(mount); this.observer.observe(this.card);
    this.dialog.showModal(); this.show(0);
    this.focus = trapDialogFocus(this.dialog, { restoreFocus: false, initialFocus: this.card.querySelector<HTMLElement>('[data-tour="next"]')! });
  }

  private show(index: number): void {
    this.index = Math.max(0, Math.min(SKILL_TOUR_STEPS.length - 1, index));
    const step = SKILL_TOUR_STEPS[this.index], last = this.index === SKILL_TOUR_STEPS.length - 1;
    this.card.innerHTML = `<header class="skill-tour-heading"><span class="ui-kicker">ATLAS GUIDE <span>${this.index + 1} / ${SKILL_TOUR_STEPS.length}</span></span>
      <button class="ui-button ui-button--quiet ui-button--icon" data-tour="exit" aria-label="Skip guide" title="Skip guide">${uiIcon('close')}</button></header>
      <div class="skill-tour-progress" role="progressbar" aria-label="Guide progress" aria-valuemin="1" aria-valuemax="${SKILL_TOUR_STEPS.length}" aria-valuenow="${this.index + 1}">${SKILL_TOUR_STEPS.map((_, i) => `<i class="${i <= this.index ? 'is-done' : ''}"></i>`).join('')}</div>
      <div class="skill-tour-copy ui-scroll-area" tabindex="0" aria-label="Guide text" aria-live="polite" aria-atomic="true"><h3 id="skill-tour-title">${escapeUI(step.title)}</h3>
      <p id="skill-tour-body">${escapeUI(step.body)}</p>
      ${step.id === 'passives' ? '<div class="skill-tour-legend"><span class="is-invested">● Invested</span><span class="is-planned">○ Planned route</span><span>○ Unspent</span></div>' : ''}
      ${step.examples ? `<div class="skill-tour-examples">${step.examples.map(example => {
        const node = SKILL_NODES.get(example.node)!;
        return `<div class="skill-tour-example"><span class="skill-tour-lens is-${node.kind}${node.doctrine ? ' is-doctrine' : ''}${node.keystone ? ' is-keystone' : ''}">${skillNodeIconSVG(node, 30)}</span><div><strong>${escapeUI(example.label)}</strong><small>${escapeUI(example.description)}</small></div></div>`;
      }).join('')}</div>` : ''}
      <p class="skill-tour-hint">${escapeUI(step.hint)}</p></div>
      <footer class="skill-tour-actions"><button class="ui-button ui-button--quiet" data-tour="exit">Skip guide</button><span></span><button class="ui-button" data-tour="back" ${this.index === 0 ? 'disabled' : ''}>Back</button><button class="ui-button ui-button--primary" data-tour="next">${last ? 'Explore the tree' : this.index === 0 ? 'Show me' : 'Next'} ${last ? '' : '→'}</button></footer>`;
    this.actions.stage(step);
    this.card.querySelector<HTMLElement>('[data-tour="next"]')!.focus({ preventScroll: true });
    this.refreshLayout();
  }

  scroll(top: number): void { this.card.querySelector('.skill-tour-copy')?.scrollBy({ top }); }
  refreshLayout(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.layout(); });
  }
  private layout(): void {
    const bounds = this.actions.bounds(SKILL_TOUR_STEPS[this.index]);
    const width = this.dialog.clientWidth, height = this.dialog.clientHeight;
    const chart = this.dialog.parentElement?.querySelector('.skill-atlas-chart')?.getBoundingClientRect();
    const left = width <= 620 ? 12 : Math.max(16, chart?.left ?? 16) + 16;
    this.card.style.left = `${Math.min(left, Math.max(12, width - this.card.offsetWidth - 12))}px`;
    // Lower map space leaves the inspected node, toolbar and sidebar in view.
    this.card.style.bottom = `${width <= 620 ? 12 : 84}px`;
    const card = this.card.getBoundingClientRect();
    const x = Math.max(6, (bounds?.x ?? 0) - 6), y = Math.max(6, (bounds?.y ?? 0) - 6);
    const right = Math.min(width - 6, (bounds?.x ?? 0) + (bounds?.width ?? 0) + 6);
    const bottom = Math.min(width <= 620 ? card.top - 12 : height - 6, (bounds?.y ?? 0) + (bounds?.height ?? 0) + 6);
    const overlaps = x < card.right && right > card.left && y < card.bottom && bottom > card.top;
    const visible = !!bounds && right > x && bottom > y && !overlaps;
    this.spotlight.hidden = !visible;
    this.dialog.classList.toggle('without-spotlight', !visible);
    if (visible) Object.assign(this.spotlight.style, { left: `${x}px`, top: `${y}px`, width: `${right - x}px`, height: `${bottom - y}px` });
  }
  dispose(): void {
    this.life.abort(); this.observer.disconnect(); this.focus?.dispose();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.dialog.close(); this.dialog.remove();
  }
}
