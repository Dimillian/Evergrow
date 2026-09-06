import { FramePacer } from './frame-pacer.ts';
import { escapeUI, uiIcon, trapDialogFocus } from './ui-components.ts';
import { characterPower, previewCharacter } from './character-summary.ts';
import { drawCharacterPortrait } from './character-portrait.ts';
import type { SaveSlot } from './character-storage.ts';
import type { SaveMode, SaveSourceUI } from './save-hub.ts';
import type { Player } from './model.ts';
import { STARTER_LOADOUTS, createStarterLoadout, isStarterLoadoutId, type StarterLoadoutId } from './items.ts';
import { itemIconSVG } from './item-art.ts';
import { parseWorldSeed } from './world-seed.ts';
import './title-screen.css';
export interface TitleActions {
  create(index: number, name: string, weapon: StarterLoadoutId, seed: number): void;
  continue(index: number): void; remove(index: number, expected: string | null): void;
  read?(index: number): Promise<SaveSlot>; source?(mode: SaveMode): void;
  download?(index: number): void; import?(index: number, file: File): void; useCloud?(index: number, expected: string | null): void;
}
const format = (n: number) => Math.round(n).toLocaleString('en-US');
/** One compact screen; storage and validated character mutations remain outside the view. */
export class TitleScreen {
  readonly element: HTMLDivElement;
  private slots: SaveSlot[] = [];
  private selected = 0;
  private starter: StarterLoadoutId = STARTER_LOADOUTS[0].id;
  private seedDrafts = new Map<number, string>();
  private names = new Map<number, string>();
  private player: Player = previewCharacter(null);
  private canvas: HTMLCanvasElement;
  private abort = new AbortController();
  private focus?: { dispose(): void };
  private frame = 0;
  private framePacer = new FramePacer(60);
  private confirming: 'delete' | 'cloud' | null = null;
  private loading = false;
  private inspection = 0;
  private source: SaveSourceUI = { supported: false, mode: 'local', signedIn: false, status: 'Local' };
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  private actions: TitleActions;
  constructor(mount: HTMLElement, actions: TitleActions) {
    this.actions = actions;
    this.element = document.createElement('div'); this.element.className = 'title-screen'; this.element.hidden = true;
    this.element.innerHTML = `<div class="title-vignette" aria-hidden="true"></div>
      <header class="title-brand"><span aria-hidden="true">${uiIcon('skilltree')}</span><h1>EVERGROW</h1></header>
      <section class="title-hero" aria-label="Selected character"><div class="title-halo" aria-hidden="true"></div><canvas width="560" height="720" aria-label="Selected character wearing their saved equipment"></canvas><div class="title-plinth" aria-hidden="true"></div></section>
      <section class="title-roster ui-window" aria-labelledby="roster-title"><header class="title-roster-header"><h2 id="roster-title">Characters</h2><div class="title-sources" role="group" aria-label="Save location" hidden><button data-source="cloud">Cloud</button><button data-source="local">Local</button></div><span class="title-slot-count"></span></header>
      <div class="title-hall-body"><div class="title-slot-grid" role="group" aria-label="Eight character slots"></div><div class="title-selection"></div></div>
      <footer class="title-roster-footer"><span class="title-storage-status" role="status"></span><a class="title-signout" href="/signout-with-chatgpt?return_to=/" target="_top" hidden>Sign out</a><span class="title-transfer"><button data-action="import">Import</button><button data-action="download">Download</button></span></footer>
      <p class="title-save-message" role="status" hidden></p><input type="file" class="title-file" accept=".json,application/json" hidden></section>`;
    this.canvas = this.element.querySelector('canvas')!; mount.append(this.element);
    this.element.querySelector<HTMLElement>('.title-transfer')!.hidden = !actions.download && !actions.import;
    this.element.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button'); if (!button) return;
      if (button.dataset.source) { this.actions.source?.(button.dataset.source as SaveMode); return; }
      if (button.dataset.slot !== undefined) { this.choose(Number(button.dataset.slot)); return; }
      const action = button.dataset.action;
      if (action === 'retry') window.location.reload();
      if (action === 'continue') this.actions.continue(this.selected);
      if (action === 'delete' || action === 'cloud') { this.confirming = action; this.renderSelection(); this.element.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.focus(); }
      if (action === 'cancel') { this.confirming = null; this.renderSelection(); }
      if (action === 'confirm-delete') this.actions.remove(this.selected, this.slots[this.selected]?.token ?? null);
      if (action === 'confirm-cloud') this.actions.useCloud?.(this.selected, this.slots[this.selected]?.token ?? null);
      if (action === 'download') this.actions.download?.(this.selected);
      if (action === 'import') this.element.querySelector<HTMLInputElement>('.title-file')!.click();
      if (action === 'random-seed') { const input = this.element.querySelector<HTMLInputElement>('[name="world-seed"]'); if (input) { input.value = this.rollSeed(); input.setCustomValidity(''); } }
    }, { signal: this.abort.signal });
    this.element.addEventListener('input', event => {
      const input = event.target; if (!(input instanceof HTMLInputElement)) return;
      if (input.name === 'character-name') this.names.set(this.selected, input.value);
      if (input.name === 'world-seed') { this.seedDrafts.set(this.selected, input.value); this.validateSeed(input); }
    }, { signal: this.abort.signal });
    this.element.addEventListener('change', event => {
      const input = event.target;
      if (input instanceof HTMLSelectElement && input.name === 'compact-starter' && isStarterLoadoutId(input.value)) {
        this.starter = input.value; this.player = previewCharacter(null, this.starter);
        this.element.querySelectorAll<HTMLInputElement>('[name="starter-weapon"]').forEach(radio => { radio.checked = radio.value === this.starter; }); return;
      }
      if (!(input instanceof HTMLInputElement)) return;
      if (input.type === 'file' && input.files?.[0]) { this.actions.import?.(this.selected, input.files[0]); input.value = ''; }
      if (input.name === 'starter-weapon' && isStarterLoadoutId(input.value)) { this.starter = input.value; this.player = previewCharacter(null, this.starter); const select = this.element.querySelector<HTMLSelectElement>('[name="compact-starter"]'); if (select) select.value = this.starter; }
    }, { signal: this.abort.signal });
    this.element.addEventListener('submit', event => {
      event.preventDefault(); const input = this.element.querySelector<HTMLInputElement>('[name="character-name"]');
      const seedInput = this.element.querySelector<HTMLInputElement>('[name="world-seed"]'); if (!seedInput) return;
      const seed = this.validateSeed(seedInput); if (seed === null) { seedInput.reportValidity(); return; }
      const name = input?.value.trim(); if (name) this.actions.create(this.selected, name, this.starter, seed);
    }, { signal: this.abort.signal });
  }
  setBusy(busy: boolean) { this.element.inert = busy; this.element.classList.toggle('is-busy', busy); this.element.setAttribute('aria-busy', String(busy)); }
  setSource(source: SaveSourceUI) {
    this.source = source;
    this.element.querySelector<HTMLAnchorElement>('.title-signout')!.hidden = source.mode !== 'cloud' || !source.signedIn;
    this.element.querySelector<HTMLElement>('.title-sources')!.hidden = !source.supported;
    this.element.querySelectorAll<HTMLButtonElement>('[data-source]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.source === source.mode)));
    const status = this.element.querySelector<HTMLElement>('.title-storage-status')!;
    status.textContent = source.mode === 'local' ? 'On this device' : source.status;
    status.dataset.status = source.status;
  }
  open(slots: SaveSlot[], preferred?: number) {
    this.slots = slots; this.names.clear(); this.seedDrafts.clear();
    const latest = [...slots].sort((a, b) => (b.record?.updatedAt ?? b.summary?.updatedAt ?? 0) - (a.record?.updatedAt ?? a.summary?.updatedAt ?? 0))[0]?.index ?? 0;
    this.selected = preferred ?? latest; this.confirming = null; this.element.hidden = false; this.message(''); this.setSource(this.source);
    this.choose(this.selected, false);
    this.focus?.dispose(); this.focus = trapDialogFocus(this.element, { signal: this.abort.signal, restoreFocus: false,
      initialFocus: () => this.element.querySelector('[data-action="continue"]') ?? this.element.querySelector('[name="character-name"]') ?? this.element.querySelector('[data-source="local"]') });
    if (!this.frame) this.animate();
  }
  private choose(index: number, focus = true) {
    this.selected = index; this.confirming = null; this.loading = false; const ticket = ++this.inspection;
    this.render();
    if (focus) this.element.querySelector<HTMLButtonElement>(`[data-slot="${index}"]`)?.focus();
    const slot = this.slots[index];
    if (!slot || !this.actions.read || slot.record) return;
    this.loading = true; this.renderSelection();
    void this.actions.read(index).then(value => {
      if (ticket !== this.inspection || this.element.hidden) return;
      this.slots[index] = value; this.loading = false; this.render();
    }).catch(() => { if (ticket === this.inspection) { this.loading = false; this.message('Save unavailable. Please retry.'); this.renderSelection(); } });
  }
  message(text: string) { const target = this.element.querySelector<HTMLElement>('.title-save-message')!; target.textContent = text; target.hidden = !text; }
  close() { this.inspection++; this.element.hidden = true; this.focus?.dispose(); this.focus = undefined; cancelAnimationFrame(this.frame); this.frame = 0; }
  dispose() { this.close(); this.abort.abort(); this.element.remove(); }
  private rollSeed() { const value = String(crypto.getRandomValues(new Uint32Array(1))[0]); this.seedDrafts.set(this.selected, value); return value; }
  private validateSeed(input: HTMLInputElement) { const seed = parseWorldSeed(input.value); input.setCustomValidity(seed === null ? 'Use a whole number from 0 to 4294967295.' : ''); return seed; }
  private render() {
    this.element.querySelector('.title-slot-count')!.textContent = `${this.slots.filter(s => s.record || s.summary).length} / 8`;
    this.element.querySelector('.title-slot-grid')!.innerHTML = this.slots.map(slot => {
      const r = slot.record, summary = r ? { name: r.name, level: r.checkpoint.level, power: characterPower(previewCharacter(r)).power } : slot.summary;
      return `<button class="title-slot" data-slot="${slot.index}" aria-pressed="${slot.index === this.selected}" aria-label="Slot ${slot.index + 1}: ${summary ? escapeUI(summary.name) : 'New character'}"><span class="title-slot-number">${slot.index + 1}</span><span class="title-slot-copy"><strong>${summary ? escapeUI(summary.name) : slot.state === 'empty' ? '+ New' : 'Unavailable'}</strong>${summary ? `<small>Lv ${summary.level} <i>·</i> ${format(summary.power)} power</small>` : ''}</span>${slot.conflict ? '<span class="title-slot-alert" aria-label="Save conflict">!</span>' : ''}</button>`;
    }).join('');
    this.renderSelection();
  }
  private renderSelection() {
    const slot = this.slots[this.selected], record = slot?.record;
    this.player = previewCharacter(record ?? null, this.starter);
    const selection = this.element.querySelector('.title-selection')!;
    const canUse = this.source.mode === 'local' || this.source.signedIn;
    this.element.querySelector<HTMLButtonElement>('[data-action="download"]')!.disabled = !record || !this.actions.download;
    this.element.querySelector<HTMLButtonElement>('[data-action="import"]')!.disabled = !canUse || slot?.state !== 'empty' || this.loading || !this.actions.import;
    if (this.source.status === 'Loading…') { selection.innerHTML = '<p class="title-loading" role="status">Loading…</p>'; return; }
    if (!canUse) {
      if (this.source.status === 'Unavailable') { selection.innerHTML = '<div class="title-signin"><p>Cloud unavailable</p><button class="ui-button" data-action="retry">Retry</button></div>'; return; }
      selection.innerHTML = `<div class="title-signin"><span class="title-signin-crest" aria-hidden="true">${uiIcon('skilltree')}</span><a class="ui-button ui-button--primary" href="/signin-with-chatgpt?return_to=/" target="_top">Sign in with ChatGPT</a><p>Continue on any browser.</p></div>`; return;
    }
    if (this.loading) { selection.innerHTML = '<p class="title-loading" role="status">Loading…</p>'; return; }
    if (this.confirming) {
      selection.innerHTML = `<div class="title-confirm"><h3>${this.confirming === 'delete' ? 'Delete character?' : 'Use cloud version?'}</h3><p>${this.confirming === 'delete' ? 'This cannot be undone.' : 'Replaces this device’s recovery copy. Download it first to keep it.'}</p><div class="title-actions"><button class="ui-button" data-action="cancel">Cancel</button><button class="ui-button ui-button--danger" data-action="confirm-${this.confirming}">${this.confirming === 'delete' ? 'Delete' : 'Use cloud'}</button></div></div>`; return;
    }
    if (record) {
      const power = characterPower(this.player);
      selection.innerHTML = `<div class="title-selection-heading"><h3>${escapeUI(record.name)}</h3><button class="ui-button ui-button--quiet ui-button--icon" data-action="delete" aria-label="Delete character">${uiIcon('close')}</button></div>
        <div class="title-build-stats"><div><strong>${record.checkpoint.level}</strong><span>Level</span></div><div data-tooltip="Estimate from attack damage and effective life." tabindex="0"><strong>${format(power.power)}</strong><span>Power</span></div></div>
        <div class="title-save-meta"><span>${Math.floor(record.checkpoint.time / 60)} min</span><span>${new Date(record.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>
        ${slot.conflict ? '<div class="title-conflict"><span>Another device has a newer save.</span><button class="ui-button" data-action="cloud">Use cloud version</button></div>' : ''}
        <button class="ui-button ui-button--primary title-enter" data-action="continue"><span>${slot.conflict ? 'Continue recovery' : 'Continue'}</span>${uiIcon('chevron')}</button>`;
    } else if (slot?.state === 'empty') {
      selection.innerHTML = `<form class="title-create"><div class="title-create-fields"><label>Name<input name="character-name" maxlength="24" minlength="1" required autocomplete="off" value="${escapeUI(this.names.get(this.selected) ?? 'Wayfarer')}" pattern=".*\\S.*"/></label><label>World seed<span class="title-seed-controls"><input name="world-seed" inputmode="numeric" required autocomplete="off" value="${escapeUI(this.seedDrafts.get(this.selected) ?? this.rollSeed())}"/><button type="button" data-action="random-seed" aria-label="Random world seed">↻</button></span></label></div>
        <fieldset class="title-weapons"><legend>Starting gear</legend><select class="title-compact-starter" name="compact-starter" aria-label="Starting gear">${STARTER_LOADOUTS.map(option => `<option value="${option.id}" ${this.starter === option.id ? 'selected' : ''}>${escapeUI(option.label)}</option>`).join('')}</select><div class="title-weapon-grid">${STARTER_LOADOUTS.map(option => {
          const loadout = createStarterLoadout(option.id);
          return `<label class="title-weapon-choice" data-tooltip="${escapeUI(option.detail)}"><input type="radio" name="starter-weapon" value="${option.id}" ${this.starter === option.id ? 'checked' : ''}/><span class="title-weapon-icon" aria-hidden="true">${itemIconSVG(loadout.weapon, 40)}${loadout.offhand ? itemIconSVG(loadout.offhand, 32) : ''}</span><strong>${escapeUI(option.label)}</strong></label>`;
        }).join('')}</div></fieldset><button class="ui-button ui-button--primary title-enter" type="submit"><span>Create character</span>${uiIcon('chevron')}</button></form>`;
    } else selection.innerHTML = `<div class="title-confirm"><h3>Save unavailable</h3><p>${slot?.state === 'invalid' ? 'The original file is preserved.' : 'Check storage or connection, then select the slot again.'}</p>${slot?.state === 'invalid' ? '<button class="ui-button" data-action="delete">Delete unreadable save</button>' : ''}</div>`;
  }
  private animate = (): void => {
    if (this.element.hidden) return;
    if (!window.EvergrowAndroid || this.framePacer.ready(performance.now())) {
      const ctx = this.canvas.getContext('2d');
      if (ctx) drawCharacterPortrait(ctx, this.player, this.motion.matches ? 3 : performance.now() / 1000, Math.PI / 2 + .18, 560, 720);
    }
    this.frame = requestAnimationFrame(this.animate);
  };
}
