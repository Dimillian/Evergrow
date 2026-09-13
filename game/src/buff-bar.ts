import type { ActiveBuff } from './active-buffs.ts';
import { skillIconSVG } from './skill-icon.ts';
import { escapeUI } from './ui-components.ts';
import { effectExplanation, effectTerm } from './effect-terms.ts';
import { UITooltipStack } from './ui-tooltip-stack.ts';
import './buff-bar.css';

export function buffIcon(icon: ActiveBuff['icon']): string {
  if (icon !== 'weave-melee' && icon !== 'weave-spell') return skillIconSVG(icon, 36);
  return `<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M8 28C32 23 4 10 28 7M8 7C32 12 4 25 28 28" fill="none" stroke="currentColor" stroke-width="2"/>${icon === 'weave-melee' ? '<path d="m17 8 4 3-2 13-3 3-2-3 3-13Zm-5 14 12 2m-6 1-1 6" fill="#e5bd80" stroke="#fff0c8"/>' : '<path d="m18 6 4 9 8 3-8 3-4 9-4-9-8-3 8-3Z" fill="#9270c0" stroke="#ead6ff"/>'}</svg>`;
}
/** Stable keyed buttons; only countdown/fill change as the simulation advances. */
export class BuffBar {
  readonly element = document.createElement('div');
  private readonly tips: UITooltipStack;
  private readonly life = new AbortController();
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private buffs: readonly ActiveBuff[] = [];
  constructor(mount: HTMLElement) {
    this.element.className = 'buff-bar'; this.element.setAttribute('role', 'group'); this.element.setAttribute('aria-label', 'Active effects');
    mount.append(this.element); this.tips = new UITooltipStack(mount, effectExplanation);
    const show = (event: Event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-buff]');
      const buff = this.buffs.find(b => b.id === button?.dataset.buff);
      if (button && buff) this.tips.show(`<h3>${escapeUI(buff.name)}</h3><p data-buff-summary>${escapeUI(buff.summary)}</p>${buff.term ? `<p>${effectTerm(buff.term, buff.term === 'spellweave' ? 'Spellweave' : 'How it works')}</p>` : ''}`, button);
    };
    const opts = { signal: this.life.signal };
    this.element.addEventListener('pointerover', show, opts); this.element.addEventListener('focusin', show, opts);
    this.element.addEventListener('click', show, opts);
    this.element.addEventListener('keydown', event => { if (event.key === 'Tab') event.stopPropagation(); }, opts);
    this.element.addEventListener('pointerleave', () => this.tips.defer(), opts);
    // Never let buff inspection become an attack, dodge or camera gesture.
    for (const type of ['pointerdown', 'contextmenu', 'dblclick']) this.element.addEventListener(type, event => event.stopPropagation(), opts);
  }
  update(buffs: readonly ActiveBuff[]): void {
    this.buffs = buffs;
    const ids = new Set(buffs.map(b => b.id));
    for (const [id, button] of this.buttons) if (!ids.has(id)) { this.tips.hide(); button.remove(); this.buttons.delete(id); }
    for (const buff of buffs) {
      this.tips.refreshSummary(buff.id, buff.summary);
      let button = this.buttons.get(buff.id);
      if (!button) {
        button = document.createElement('button'); button.type = 'button'; button.dataset.buff = buff.id;
        button.innerHTML = `${buffIcon(buff.icon)}<i class="buff-shade" aria-hidden="true"></i><b class="buff-time" aria-hidden="true"></b><small class="buff-charges" aria-hidden="true"></small>`;
        button.style.setProperty('--buff-color', buff.color); this.buttons.set(buff.id, button); this.element.append(button);
      }
      button.style.setProperty('--buff-spent', `${(1 - Math.min(1, buff.progress ?? (buff.persistent?1:buff.remaining / Math.max(.001, buff.duration)))) * 100}%`);
      const label = `${buff.name}. ${buff.summary} ${buff.persistent?'Active while assigned.':`${Math.ceil(buff.remaining)} seconds remaining.`}`;
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      const time = buff.persistent ? (buff.reservation!==undefined?`${Number(buff.reservation.toFixed(1))}%`:buff.progress===1?'Ready':'Focus') : buff.remaining < 10 ? buff.remaining.toFixed(1) : String(Math.ceil(buff.remaining));
      const readout = button.querySelector('.buff-time')!; if (readout.textContent !== time) readout.textContent = time;
      const charges = button.querySelector('.buff-charges')!, value = buff.charges ? String(buff.charges) : '';
      if (charges.textContent !== value) charges.textContent = value;
    }
    this.element.hidden = !buffs.length;
  }
  hide(): void { this.update([]); this.tips.hide(); }
  dispose(): void { this.life.abort(); this.tips.dispose(); this.element.remove(); }
}
