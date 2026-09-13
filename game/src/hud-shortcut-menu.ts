import { HUD_MENU_SHORTCUTS } from './hud-layout.ts';
import { trapDialogFocus } from './ui-components.ts';
import './hud-shortcut-menu.css';

type Destination = typeof HUD_MENU_SHORTCUTS[number]['id'] | 'map';
const destinations = [...HUD_MENU_SHORTCUTS, { id: 'map', label: 'World map', key: 'M' }] as const;

/** A small, focus-contained navigation drawer. GameShell owns routing and pause state. */
export class HUDShortcutMenu {
  readonly element: HTMLElement;
  private readonly backdrop: HTMLElement;
  private pointsKey = '';
  private focus?: ReturnType<typeof trapDialogFocus>;
  private readonly abort = new AbortController();
  get isOpen(): boolean { return !this.backdrop.hidden; }

  private readonly mount: HTMLElement;
  private readonly trigger: HTMLButtonElement;
  private readonly select: (destination: Destination) => void;
  private readonly changed: () => void;
  constructor(mount: HTMLElement, trigger: HTMLButtonElement,
    select: (destination: Destination) => void, changed: () => void) {
    this.mount = mount; this.trigger = trigger; this.select = select; this.changed = changed;
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'hud-menu-backdrop'; this.backdrop.hidden = true;
    this.backdrop.innerHTML = `<section class="hud-shortcut-menu" role="dialog" aria-modal="true" aria-label="Character menus">
      ${destinations.map(d => `<button type="button" data-destination="${d.id}" aria-keyshortcuts="${d.key}">
        <span>${d.label}</span><span class="hud-menu-points" data-points="${d.id}" hidden></span><kbd>${d.key}</kbd></button>`).join('')}
    </section>`;
    this.element = this.backdrop.querySelector('section')!;
    mount.append(this.backdrop);
    const signal = this.abort.signal;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', () => this.isOpen ? this.close() : this.open(), { signal });
    this.backdrop.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      if (target === this.backdrop) this.close();
      const id = target.closest<HTMLButtonElement>('[data-destination]')?.dataset.destination as Destination | undefined;
      if (id) { this.close(false); this.select(id); }
    }, { signal });
    this.backdrop.addEventListener('keydown', event => {
      // Keep navigation keys and bindings from also entering the game's input buffer.
      event.stopPropagation();
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
      const destination = destinations.find(d => event.code === `Key${d.key}`);
      if (destination) { event.preventDefault(); this.close(false); this.select(destination.id); return; }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const rows = [...this.element.querySelectorAll<HTMLButtonElement>('[data-destination]')];
        const current = rows.indexOf(document.activeElement as HTMLButtonElement);
        rows[(current + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length].focus();
      }
    }, { signal });
  }

  open(): void {
    this.backdrop.hidden = false; this.mount.classList.add('has-shortcut-menu');
    this.trigger.setAttribute('aria-expanded', 'true'); this.position();
    this.changed();
    this.focus = trapDialogFocus(this.element, { initialFocus: this.element.querySelector<HTMLButtonElement>('[data-destination]')!, restoreFocus: false });
  }
  close(restore = true): void {
    if (!this.isOpen) return;
    this.focus?.dispose(); this.focus = undefined;
    this.backdrop.hidden = true; this.mount.classList.remove('has-shortcut-menu');
    this.trigger.setAttribute('aria-expanded', 'false'); this.changed();
    if (restore) this.trigger.focus({ preventScroll: true });
  }
  position(): void {
    if (!this.isOpen) return;
    const mount = this.mount.getBoundingClientRect(), trigger = this.trigger.getBoundingClientRect();
    const width = Math.min(184, mount.width - 24);
    this.element.style.width = `${width}px`;
    this.element.style.left = `${Math.max(12, Math.min(mount.width - width - 12, trigger.left - mount.left + trigger.width / 2 - width / 2))}px`;
    const bottom = mount.bottom - trigger.top + 10;
    this.element.style.bottom = `${bottom}px`;
    this.element.style.maxHeight = `${Math.max(80, mount.height - bottom - 12)}px`;
  }
  setPoints(attributes: number, skills: number): void {
    const key = `${attributes}:${skills}`;
    if (key === this.pointsKey) return;
    this.pointsKey = key;
    for (const [id, count] of [['character', attributes], ['skilltree', skills]] as const) {
      const badge = this.element.querySelector<HTMLElement>(`[data-points="${id}"]`)!;
      badge.hidden = count <= 0;
      const label = count > 99 ? '99+' : `+${count}`;
      badge.setAttribute('aria-label', `${count} ${id === 'character' ? 'attribute' : 'skill'} points available`);
      if (badge.textContent !== label) badge.textContent = label;
    }
  }
  dispose(): void { this.close(false); this.abort.abort(); this.backdrop.remove(); }
}
