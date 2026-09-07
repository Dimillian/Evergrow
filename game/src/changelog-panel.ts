import source from '../../CHANGELOG.md?raw';
import { parseChangelog, changelogDate } from './changelog.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { GamepadMenu } from './gamepad-menu.ts';
import { PAD, type GamepadInput } from './gamepad-input.ts';
import './changelog-panel.css';

const entries = parseChangelog(source);
const inline = (text: string) => escapeUI(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

/** Read-only title-screen overlay. It never touches characters or save storage. */
export class ChangelogPanel {
  readonly element: HTMLDivElement;
  private readonly life = new AbortController();
  private focus?: { dispose(): void };
  private readonly controller = new GamepadMenu();
  private selected = 0;
  private lastPadTime = 0;
  private readonly onClose: () => void;
  constructor(mount: HTMLElement, onClose: () => void) {
    this.onClose = onClose;
    this.element = document.createElement('div');
    this.element.className = 'changelog-overlay'; this.element.hidden = true;
    this.element.innerHTML = `<section class="ui-window changelog-window" role="dialog" aria-modal="true" aria-labelledby="changelog-title">
      <header class="ui-window-header"><h2 class="ui-title" id="changelog-title">What's new</h2><button class="ui-button ui-button--quiet ui-button--icon" data-changelog-close aria-label="Close changelog">${uiIcon('close')}</button></header>
      <div class="changelog-layout"><nav class="changelog-history ui-scroll-area" aria-label="Updates">${entries.map((entry, i) => `<button class="changelog-release" data-release="${i}" aria-controls="changelog-entry"><time datetime="${entry.date}">${changelogDate(entry.date)}</time><span>v${escapeUI(entry.version)}</span>${i === 0 ? '<small>Latest</small>' : ''}</button>`).join('')}</nav>
      <article id="changelog-entry" class="changelog-entry ui-scroll-area" tabindex="0" aria-label="Update notes"></article></div>
      <footer class="ui-window-footer changelog-footer"><span>EVERGROW</span><span>Esc / B <span>Close</span></span></footer></section>`;
    mount.append(this.element);
    this.element.addEventListener('click', event => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (target?.hasAttribute('data-changelog-close') || event.target === this.element) this.close();
      else if (target?.dataset.release !== undefined) this.select(Number(target.dataset.release));
    }, { signal: this.life.signal });
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); }
      // Let keyboard arrows scroll notes; GamepadMenu respects preventDefault.
      if ((event.target as HTMLElement).id === 'changelog-entry' && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault(); (event.target as HTMLElement).scrollTop += event.key === 'ArrowDown' ? 64 : -64;
      }
    }, { signal: this.life.signal });
  }
  get opened() { return !this.element.hidden; }
  open() {
    this.element.hidden = false; this.select(0); this.controller.clear(); this.lastPadTime = 0;
    this.focus?.dispose();
    this.focus = trapDialogFocus(this.element, { signal: this.life.signal, restoreFocus: false,
      initialFocus: () => this.element.querySelector('[data-changelog-close]') });
  }
  close(notify = true) {
    if (!this.opened) return;
    this.element.hidden = true; this.focus?.dispose(); this.focus = undefined; this.controller.clear();
    if (notify) this.onClose();
  }
  private select(index: number) {
    if (!entries[index]) return;
    this.selected = index;
    for (const button of this.element.querySelectorAll<HTMLElement>('[data-release]')) button.setAttribute('aria-current', String(Number(button.dataset.release) === index));
    const entry = entries[index], body = this.element.querySelector<HTMLElement>('#changelog-entry')!;
    body.innerHTML = `<header><time datetime="${entry.date}">${changelogDate(entry.date)}</time><h3>v${escapeUI(entry.version)}</h3></header>
      ${entry.notices.map(n => `<p class="changelog-notice">${inline(n)}</p>`).join('')}
      ${entry.sections.map(section => `<section class="changelog-section" data-kind="${section.title}"><h4>${section.title}</h4><ul>${section.items.map(item => `<li>${inline(item)}</li>`).join('')}</ul></section>`).join('')}`;
    body.scrollTop = 0;
  }
  updateGamepad(pad: GamepadInput, now: number): boolean {
    if (!this.opened) return false;
    if (pad.pressed.has(PAD.dodge) || pad.pressed.has(PAD.pause)) this.close();
    else {
      this.controller.update(this.element, pad, now, { switchTab: delta => this.select(Math.max(0, Math.min(entries.length - 1, this.selected + delta))) });
      const dt = this.lastPadTime ? Math.min(.05, (now - this.lastPadTime) / 1000) : 0;
      const body = this.element.querySelector<HTMLElement>('#changelog-entry')!;
      if (Math.abs(pad.aim.y) > .2) body.scrollTop += pad.aim.y * dt * 550;
    }
    this.lastPadTime = now; return true;
  }
  dispose() { this.close(false); this.life.abort(); this.element.remove(); }
}
