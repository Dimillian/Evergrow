import { CONTROL_ACTIONS, CONTROL_FILE_LIMIT, controlLabel, validControl, type ControlAction } from './control-bindings.ts';
import { controls } from './control-preferences.ts';
import { escapeUI } from './ui-components.ts';

export function controlsMarkup(): string {
  return `<section id="pause-controls" aria-label="Controls" hidden>
    <header class="pause-options-heading"><h2>Controls</h2><button type="button" data-controls-back class="ui-button ui-button--quiet">Back</button></header>
    <p class="controls-intro">Choose a binding, then press a key or mouse button. Changes save automatically on this device.</p>
    <div class="controls-devices" role="group" aria-label="Input device"><button type="button" class="ui-button" data-control-device="desktop" aria-pressed="true">Keyboard & mouse</button><button type="button" class="ui-button" data-control-device="controller" aria-pressed="false">Controller</button></div>
    <div data-controls-desktop>
      ${typeof window !== 'undefined' && window.EvergrowAndroid ? '' : `<div class="controls-transfer"><button type="button" class="ui-button" data-controls-export>Export bindings</button><button type="button" class="ui-button" data-controls-import>Import bindings</button></div>
      <p class="controls-note">Export a backup or import a JSON file to replace this device’s keyboard & mouse bindings.</p>
      <input type="file" accept=".json,application/json" data-controls-file aria-label="Import keybind configuration" hidden>`}
      <div class="controls-column-head"><span>Action</span><span>Primary</span><span>Alternate</span></div>
      ${['Movement', 'Combat', 'World & menus'].map(group => `<section class="controls-group" aria-label="${group}"><h3>${group}</h3>${CONTROL_ACTIONS.filter(a => a.group === group).map(a => `<div class="controls-row"><span>${a.label}</span>${[0, 1].map(index => `<button type="button" class="ui-button control-binding" data-binding="${a.id}" data-binding-index="${index}"></button>`).join('')}</div>`).join('')}</section>`).join('')}
      <p class="controls-note">Esc always pauses or goes back. Ctrl reveals loot names. Mouse wheel zooms; left-click also interacts with nearby objects. Bindings use physical key positions. Browser shortcuts stay reserved.</p>
      <button type="button" class="ui-button ui-button--quiet" data-controls-reset>Restore defaults</button>
    </div>
    <div data-controls-controller hidden><p class="controls-note">Standard controller layout · Xbox button positions</p><dl class="controls-pad">${CONTROL_ACTIONS.filter(a => !['left', 'right', 'down', 'debug'].includes(a.id)).map(a => `<div><dt>${a.id === 'up' ? 'Move' : a.label}</dt><dd>${a.pad}</dd></div>`).join('')}<div><dt>Aim</dt><dd>Right stick</dd></div><div><dt>Pause / back</dt><dd>Menu / B</dd></div></dl><p class="controls-note">Use D-pad or left stick to navigate menus and A to select. Controller bindings are fixed.</p></div>
    <p class="controls-status" role="status" aria-live="polite" data-controls-status></p>
    <div class="controls-capture" hidden><p data-capture-message></p><div class="controls-capture-actions"><button type="button" class="ui-button" data-capture-replace hidden>Replace binding</button><button type="button" class="ui-button" data-capture-clear>Unbind</button><button type="button" class="ui-button" data-capture-cancel>Cancel</button></div></div>
  </section>`;
}

/** Captures before menu/game hotkeys and never forwards an assignment into play. */
export class ControlsPanel {
  private readonly root: HTMLElement;
  private active: { action: ControlAction; index: 0 | 1; button: HTMLButtonElement } | null = null;
  private conflict: string | null = null;
  private swallowClick = false;
  constructor(root: HTMLElement, signal: AbortSignal) {
    this.root = root.querySelector('#pause-controls')!;
    const opts = { signal };
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-binding]')) button.addEventListener('click', () => {
      this.active = { action: button.dataset.binding as ControlAction, index: Number(button.dataset.bindingIndex) as 0 | 1, button };
      this.conflict = null;
      this.capture.hidden = false;
      this.root.querySelector<HTMLElement>('[data-capture-replace]')!.hidden = true;
      this.message(`Press a key or mouse button for ${this.name(this.active.action)}. Esc cancels.`);
      button.setAttribute('aria-pressed', 'true');
      this.root.querySelector<HTMLButtonElement>('[data-capture-cancel]')!.focus();
    }, opts);
    this.root.querySelector('[data-capture-cancel]')!.addEventListener('click', () => this.cancel(), opts);
    this.root.querySelector('[data-capture-clear]')!.addEventListener('click', () => this.assign(null), opts);
    this.root.querySelector('[data-capture-replace]')!.addEventListener('click', () => this.assign(this.conflict, true), opts);
    this.root.querySelector('[data-controls-reset]')!.addEventListener('click', () => { this.status(controls.reset(), 'Default controls restored.'); this.refresh(); }, opts);
    // The packaged WebView has no native file picker or download bridge.
    if (!window.EvergrowAndroid) this.bindFileTransfers(signal);
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-control-device]')) button.addEventListener('click', () => {
      const desktop = button.dataset.controlDevice === 'desktop';
      this.root.querySelector<HTMLElement>('[data-controls-desktop]')!.hidden = !desktop;
      this.root.querySelector<HTMLElement>('[data-controls-controller]')!.hidden = desktop;
      for (const tab of this.root.querySelectorAll('[data-control-device]')) tab.setAttribute('aria-pressed', String(tab === button));
    }, opts);
    this.root.addEventListener('keydown', event => { if (event.code !== 'Escape' && event.code !== 'Tab') event.stopPropagation(); }, opts);
    window.addEventListener('keydown', event => {
      if (!this.active || this.conflict && event.code !== 'Escape') return;
      event.stopImmediatePropagation();
      if (event.code === 'Escape') { event.preventDefault(); if (!event.repeat) this.cancel(); return; }
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) { this.message('Choose a single key without Ctrl, Alt or Command. Esc cancels.'); return; }
      event.preventDefault();
      if (event.repeat || this.conflict) return;
      if (!validControl(event.code)) { this.message('That key is reserved. Choose another key or mouse button.'); return; }
      this.assign(event.code);
    }, { signal, capture: true });
    window.addEventListener('pointerdown', event => {
      this.swallowClick = false;
      if (this.active && !this.capture.contains(event.target as Node)) event.stopImmediatePropagation();
    }, { signal, capture: true });
    window.addEventListener('mousedown', event => {
      if (!this.active || this.capture.contains(event.target as Node) && event.button === 0) return;
      event.preventDefault(); event.stopImmediatePropagation(); this.swallowClick = true;
      if (!this.conflict) this.assign(`Mouse${event.button}`);
    }, { signal, capture: true });
    const swallow = (event: Event) => {
      if (!this.swallowClick) return;
      event.preventDefault(); event.stopImmediatePropagation(); this.swallowClick = false;
    };
    window.addEventListener('click', swallow, { signal, capture: true });
    window.addEventListener('auxclick', swallow, { signal, capture: true });
    window.addEventListener('blur', () => this.cancel(false), opts);
    this.refresh();
  }
  private bindFileTransfers(signal: AbortSignal): void {
    const opts = { signal };
    this.root.querySelector('[data-controls-export]')!.addEventListener('click', () => {
      try {
        const url = URL.createObjectURL(new Blob([controls.exportConfiguration()], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url; link.download = 'evergrow-keybindings.json';
        document.body.append(link);
        try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
        this.status('saved', 'Keybind export downloaded.');
      } catch { this.status('error', 'Could not export bindings. Please try again.'); }
    }, opts);
    const fileInput = this.root.querySelector<HTMLInputElement>('[data-controls-file]')!;
    const importButton = this.root.querySelector<HTMLButtonElement>('[data-controls-import]')!;
    importButton.addEventListener('click', () => { this.cancel(false); fileInput.value = ''; fileInput.click(); }, opts);
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file || importButton.disabled) return;
      importButton.disabled = true;
      try {
        if (file.size > CONTROL_FILE_LIMIT) { this.status('error', 'File is too large. Choose an Evergrow keybind export (up to 16 KB).'); return; }
        const raw = await file.text();
        if (signal.aborted) return;
        this.cancel(false);
        const result = controls.importConfiguration(raw);
        this.status(result, result === 'invalid' ? 'Invalid or unsupported keybind file. Your bindings were not changed.' : 'Keybind configuration imported.');
        if (result !== 'invalid') this.refresh();
      } catch { if (!signal.aborted) this.status('error', 'Could not read that file. Your bindings were not changed.'); }
      finally { importButton.disabled = false; }
    }, opts);
  }
  private get capture(): HTMLElement { return this.root.querySelector('.controls-capture')!; }
  private name(action: ControlAction): string { return CONTROL_ACTIONS.find(a => a.id === action)!.label; }
  private message(message: string): void { this.root.querySelector('[data-capture-message]')!.textContent = message; }
  private status(result: string, message: string): void { this.root.querySelector('[data-controls-status]')!.textContent = result === 'session' ? `${message} Storage unavailable; applied for this session only.` : message; }
  private assign(code: string | null, replace = false): void {
    if (!this.active) return;
    const { action, index } = this.active;
    const result = controls.bind(action, index, code, replace);
    if (result === 'invalid') { this.message('That button is unavailable. Choose another binding.'); return; }
    if (result === 'conflict') {
      this.conflict = code;
      this.message(`${controlLabel(code)} is assigned to ${this.name(controls.action(code!)!)}. Replace that binding?`);
      const button = this.root.querySelector<HTMLButtonElement>('[data-capture-replace]')!; button.hidden = false;
      button.focus(); return;
    }
    this.status(result, `${this.name(action)} ${code ? `bound to ${controlLabel(code)}.` : 'binding cleared.'}`);
    this.cancel(); this.refresh();
  }
  cancel(focus = true): boolean {
    if (!this.active) return false;
    const button = this.active.button;
    this.active = null; this.conflict = null; this.capture.hidden = true;
    button.setAttribute('aria-pressed', 'false'); if (focus) button.focus(); return true;
  }
  refresh(): void {
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-binding]')) {
      const action = button.dataset.binding as ControlAction, index = Number(button.dataset.bindingIndex);
      const code = controls.get(action)[index];
      button.innerHTML = `<kbd>${escapeUI(controlLabel(code))}</kbd>`;
      button.classList.toggle('is-unbound', !code);
      button.setAttribute('aria-label', `${this.name(action)}, ${index ? 'alternate' : 'primary'}: ${code ? controlLabel(code) : 'unbound'}. Change binding`);
    }
  }
}
