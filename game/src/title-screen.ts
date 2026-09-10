import { GamepadMenu } from './gamepad-menu.ts';
import { audioControlsMarkup, bindAudioControls, type AudioControlActions } from './audio-controls.ts';
import { LeaderboardPanel, type LeaderboardLoader } from './leaderboard-panel.ts';
import { equippedGearPower } from './leaderboard.ts';
import { ChroniclePanel } from './chronicle-panel.ts';
import { emptyChronicle, type ChronicleLedger } from './chronicle.ts';
import { ChangelogPanel, latestChangelogVersion } from './changelog-panel.ts';
import { PAD, type GamepadInput } from './gamepad-input.ts';
import { directionalControl } from './ui-navigation.ts';
import { titleSlotAction } from './title-slot-action.ts';
import { FramePacer } from './frame-pacer.ts';
import { escapeUI, uiIcon, trapDialogFocus } from './ui-components.ts';
import { previewCharacter } from './character-summary.ts';
import { drawCharacterPortrait } from './character-portrait.ts';
import type { CharacterSave } from './character-save.ts';
import type { SaveSlot } from './character-storage.ts';
import type { SaveMode, SaveSourceUI } from './save-hub.ts';
import type { Player } from './model.ts';
import { STARTER_LOADOUTS, createStarterLoadout, isStarterLoadoutId, type StarterLoadoutId } from './items.ts';
import { itemIconSVG } from './item-art.ts';
import { parseWorldSeed } from './world-seed.ts';
import './title-screen.css';
import './home-screen.css';
export interface TitleActions extends AudioControlActions {
  leaderboard?: LeaderboardLoader;
  chronicle?(onCached?:(ledger:ChronicleLedger)=>void): Promise<ChronicleLedger>;
  create(index: number, name: string, weapon: StarterLoadoutId, seed: number): void;
  continueRecovery?(index: number, token: string): void;
  continue(index: number): void; remove(index: number, expected: string | null): void;
  read?(index: number): Promise<SaveSlot>; source?(mode: SaveMode): void;
  retry?(): void;
  download?(index: number): void; import?(index: number, file: File): void; useCloud?(index: number, expected: string | null): void;
}
export type HomePage = 'characters' | 'chronicle' | 'leaderboard' | 'changelog';
const homePages: readonly HomePage[] = ['characters','chronicle','leaderboard','changelog'];
const homeLabels = { characters: 'Characters', chronicle: 'Chronicle', leaderboard: 'Leaderboard', changelog: 'What’s new' };
const format = (n: number) => Math.round(n).toLocaleString('en-US');
/** One compact screen; storage and validated character mutations remain outside the view. */
export class TitleScreen {
  readonly element: HTMLDivElement;
  private readonly changelog: ChangelogPanel;
  private readonly leaderboard: LeaderboardPanel;
  private page: HomePage = 'characters';
  private audioPad = new GamepadMenu();
  private refreshAudio?: () => void;
  refreshSound() { this.refreshAudio?.(); }
  private readonly chronicle: ChroniclePanel;
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
    this.element.innerHTML = `<details class="title-audio"><summary aria-label="Audio options">Sound <kbd class="audio-pad-key">Y</kbd></summary>${audioControlsMarkup(true)}</details><div class="title-vignette" aria-hidden="true"></div>
      <header class="title-brand"><span aria-hidden="true">${uiIcon('skilltree')}</span><h1>EVERGROW</h1><nav class="title-home-nav" aria-label="Home">${homePages.map(page=>`<button data-home-page="${page}" aria-current="${page==='characters'?'page':'false'}">${homeLabels[page]}${page==='changelog'?'<i class="home-unread" aria-label="Unread update" hidden></i>':''}</button>`).join('')}</nav><span class="home-pad-hint">LB / RB</span></header>
      <section class="title-hero" aria-label="Selected character"><div class="title-halo" aria-hidden="true"></div><canvas width="560" height="720" aria-label="Selected character wearing their saved equipment"></canvas><div class="title-plinth" aria-hidden="true"></div></section>
      <section class="title-roster ui-window" aria-labelledby="roster-title"><header class="title-roster-header"><h2 id="roster-title">Characters</h2><div class="title-sources" role="group" aria-label="Save location" hidden><button data-source="cloud">Cloud</button><button data-source="local">Local</button></div><span class="title-controller-hint"><kbd>A</kbd> Continue</span><span class="title-slot-count"></span></header>
      <div class="title-hall-body"><div class="title-slot-grid" role="group" aria-label="Eight character slots"></div><div class="title-selection"></div></div>
      <footer class="title-roster-footer"><span class="title-storage-status" role="status"></span><a class="title-signout" href="/signout-with-chatgpt?return_to=/" target="_top" hidden>Sign out</a><span class="title-transfer"><button data-action="import">Import</button><button data-action="download">Download</button></span></footer>
      <div class="title-cloud-recovery" hidden><p class="title-cloud-message" role="status"></p><button class="ui-button" data-action="retry">Retry</button><a class="ui-button" href="/signin-with-chatgpt?return_to=/" target="_top" hidden>Sign in again</a></div>
      <p class="title-save-message" role="status" hidden></p><input type="file" class="title-file" accept=".json,application/json" hidden></section><section class="title-library ui-window" hidden aria-label="Home content"></section>`;
    const refreshAudio = this.refreshAudio = bindAudioControls(this.element, actions, this.abort.signal);
    this.element.querySelector('details.title-audio')!.addEventListener('toggle', event => {
      refreshAudio(); actions.panelSound?.((event.target as HTMLDetailsElement).open);
    }, { signal: this.abort.signal });
    this.canvas = this.element.querySelector('canvas')!; mount.append(this.element);
    const library=this.element.querySelector<HTMLElement>('.title-library')!;
    this.changelog = new ChangelogPanel(library, () => this.selectPage('characters'), true);
    this.chronicle = new ChroniclePanel(library, () => this.selectPage('characters'), true);
    this.leaderboard = new LeaderboardPanel(library, order => actions.leaderboard?.(order) ?? Promise.reject(new Error('The leaderboard is available in the online game.')), () => this.selectPage('characters'));
    try { this.element.querySelector<HTMLElement>('.home-unread')!.hidden = localStorage.getItem('evergrow:last-update-seen') === latestChangelogVersion; } catch { /* Optional read marker. */ }
    this.element.querySelector<HTMLElement>('.title-transfer')!.hidden = !actions.download && !actions.import;
    this.element.addEventListener('pointerdown', () => this.element.classList.remove('is-controller'), { signal: this.abort.signal });
    this.element.addEventListener('keydown', event => {
      const target = event.target as HTMLElement;
      if(event.key==='Escape'&&this.dismissOverlay()){event.preventDefault();event.stopPropagation();return;}
      if(target.matches('[data-home-page]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
        event.preventDefault();const pages=this.availablePages(),index=pages.indexOf(this.page);
        this.selectPage(event.key==='Home'?pages[0]:event.key==='End'?pages.at(-1)!:pages[(index+(event.key==='ArrowLeft'?-1:1)+pages.length)%pages.length]);return;
      }
      if (!target.matches('[data-slot]') || !event.key.startsWith('Arrow')) return;
      const slots = [...this.element.querySelectorAll<HTMLButtonElement>('[data-slot]')];
      const next = directionalControl(slots.map(slot => slot.getBoundingClientRect()), slots.indexOf(target as HTMLButtonElement), event.key);
      event.preventDefault(); slots[next]?.focus({ preventScroll: true });
    }, { signal: this.abort.signal });
    this.element.addEventListener('focusin', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-slot]');
      if (button && Number(button.dataset.slot) !== this.selected && !this.confirming) this.choose(Number(button.dataset.slot));
    }, { signal: this.abort.signal });
    this.element.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button'); if (!button) return;
      if (button.dataset.homePage) { this.selectPage(button.dataset.homePage as HomePage); return; }
      if (button.dataset.source) { this.actions.source?.(button.dataset.source as SaveMode); return; }
      if (button.dataset.slot !== undefined) { this.choose(Number(button.dataset.slot)); return; }
      const action = button.dataset.action;
      if (action === 'retry') { if (this.source.status === 'Reload required' || !this.actions.retry) window.location.reload(); else this.actions.retry(); }
      if (action === 'continue') this.actions.continue(this.selected);
      if (action === 'recovery') { const slot = this.slots[this.selected]; if (slot?.token && slot.recovery?.record) this.actions.continueRecovery?.(this.selected, slot.token); }
      if (action === 'delete' || action === 'cloud') { this.confirming = action; this.renderSelection(); this.element.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.focus(); }
      if (action === 'cancel') { this.confirming = null; this.renderSelection(); }
      if (action === 'confirm-delete') this.actions.remove(this.selected, this.slots[this.selected]?.token ?? null);
      if (action === 'confirm-cloud') this.actions.useCloud?.(this.selected, this.slots[this.selected]?.token ?? null);
      if (action === 'download' && this.source.mode === 'local') this.actions.download?.(this.selected);
      if (action === 'import' && this.source.mode === 'local') this.element.querySelector<HTMLInputElement>('.title-file')!.click();
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
      if (this.source.mode === 'local' && input.type === 'file' && input.files?.[0]) { this.actions.import?.(this.selected, input.files[0]); input.value = ''; }
      if (input.name === 'starter-weapon' && isStarterLoadoutId(input.value)) { this.starter = input.value; this.player = previewCharacter(null, this.starter); const select = this.element.querySelector<HTMLSelectElement>('[name="compact-starter"]'); if (select) select.value = this.starter; }
    }, { signal: this.abort.signal });
    this.element.addEventListener('submit', event => {
      event.preventDefault(); const input = this.element.querySelector<HTMLInputElement>('[name="character-name"]');
      const seedInput = this.element.querySelector<HTMLInputElement>('[name="world-seed"]'); if (!seedInput) return;
      const seed = this.validateSeed(seedInput); if (seed === null) { seedInput.reportValidity(); return; }
      const name = input?.value.trim(); if (name) this.actions.create(this.selected, name, this.starter, seed);
    }, { signal: this.abort.signal });
  }
  activateGamepad(target: HTMLElement): boolean {
    const button = target.closest<HTMLElement>('[data-slot]');
    if (!button) return false;
    const index = Number(button.dataset.slot);
    const action = titleSlotAction(this.slots[index], this.source.mode === 'local' || this.source.signedIn,
      this.element.inert || this.source.status === 'Loading…', !!this.confirming);
    if (action === 'continue') this.actions.continue(index);
    else if (action === 'create') {
      this.choose(index); this.element.querySelector<HTMLInputElement>('[name="character-name"]')?.focus();
    }
    return true;
  }
  setBusy(busy: boolean) { this.element.inert = busy; this.element.classList.toggle('is-busy', busy); this.element.setAttribute('aria-busy', String(busy)); }
  setSource(source: SaveSourceUI) {
    const refresh = source.mode === 'cloud' && this.source.mode === 'cloud' && source.status !== this.source.status
      && (source.status === 'Conflict' || source.status === 'Synced')
      && !this.element.hidden && !this.loading && !this.confirming;
    this.source = source;
    this.element.querySelector<HTMLElement>('[data-home-page=leaderboard]')!.hidden = !source.supported;
    if (!source.supported && this.page === 'leaderboard') this.selectPage('characters');
    this.element.querySelector<HTMLElement>('.title-transfer')!.hidden = source.mode !== 'local' || (!this.actions.download && !this.actions.import);
    if (source.mode !== 'local') this.element.querySelector<HTMLInputElement>('.title-file')!.value = '';
    this.element.querySelector<HTMLAnchorElement>('.title-signout')!.hidden = source.mode !== 'cloud' || !source.signedIn;
    this.element.querySelector<HTMLElement>('.title-sources')!.hidden = !source.supported;
    this.element.querySelectorAll<HTMLButtonElement>('[data-source]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.source === source.mode)));
    const status = this.element.querySelector<HTMLElement>('.title-storage-status')!;
    status.textContent = source.mode === 'local' ? 'On this device' : source.status;
    status.dataset.status = source.status;
    const recovery = this.element.querySelector<HTMLElement>('.title-cloud-recovery')!;
    recovery.hidden = source.mode !== 'cloud' || !['Offline', 'Cloud unavailable', 'Save needs attention', 'Storage unavailable', 'Reload required', 'Sign in again', 'Unavailable'].includes(source.status);
    recovery.querySelector('p')!.textContent = source.message || (source.status === 'Save needs attention' ? 'A saved character needs attention. Other slots are still available.' : 'Cloud saves could not be reached. Retry to reconnect.');
    const retry = recovery.querySelector('button')!;
    retry.textContent = source.status === 'Reload required' ? 'Reload game' : 'Retry';
    retry.hidden = source.status === 'Sign in again';
    recovery.querySelector('a')!.hidden = source.status !== 'Sign in again';
    if (refresh) { this.slots[this.selected] = { ...this.slots[this.selected], record: null }; this.choose(this.selected, false); }
  }
  open(slots: SaveSlot[], preferred?: number) {
    this.selectPage('characters', false); this.element.inert = false;
    this.slots = slots; this.names.clear(); this.seedDrafts.clear();
    const latest = [...slots].sort((a, b) => (b.record?.updatedAt ?? b.summary?.updatedAt ?? 0) - (a.record?.updatedAt ?? a.summary?.updatedAt ?? 0))[0]?.index ?? 0;
    this.selected = preferred ?? latest; this.confirming = null; this.element.hidden = false; this.message(''); this.setSource(this.source);
    this.choose(this.selected, false);
    this.focus?.dispose(); this.focus = trapDialogFocus(this.element, { signal: this.abort.signal, restoreFocus: false,
      initialFocus: () => this.element.querySelector(`[data-slot="${this.selected}"]`) ?? this.element.querySelector('[data-source="local"]') });
    if (!this.frame) this.animate();
  }
  setEditorOpen(open:boolean) {
    this.focus?.dispose();this.focus=undefined;
    this.element.inert=open;this.element.style.visibility=open?'hidden':'';
    if(!open&&!this.element.hidden)this.focus=trapDialogFocus(this.element,{signal:this.abort.signal,restoreFocus:false,initialFocus:()=>this.element.querySelector(`[data-slot="${this.selected}"]`)});
  }
  private availablePages() { return homePages.filter(page=>page!=='leaderboard'||this.source.supported); }
  selectPage(page: HomePage, focus=true) {
    if(page==='leaderboard'&&!this.source.supported)return;
    this.changelog.close(false);this.chronicle.close(false);this.leaderboard.close();
    if (this.page !== page) this.actions.panelSound?.(page !== 'characters');
    this.page=page;this.element.dataset.homePage=page;
    this.element.querySelector<HTMLElement>('.title-roster')!.hidden=page!=='characters';
    this.element.querySelector<HTMLElement>('.title-library')!.hidden=page==='characters';
    this.element.querySelectorAll<HTMLElement>('[data-home-page]').forEach(b=>b.setAttribute('aria-current',b.dataset.homePage===page?'page':'false'));
    if(page==='chronicle')void this.chronicle.open(onCached=>this.actions.chronicle?.(onCached)??Promise.resolve(emptyChronicle()));
    if(page==='leaderboard')this.leaderboard.open();
    if(page==='changelog') {
      this.changelog.open();this.element.querySelector<HTMLElement>('.home-unread')!.hidden=true;
      try{localStorage.setItem('evergrow:last-update-seen',latestChangelogVersion);}catch{/* Optional read marker. */}
    }
    if(focus)this.element.querySelector<HTMLElement>(`[data-home-page="${page}"]`)?.focus({preventScroll:true});
  }
  dismissOverlay(): boolean {
    const audio = this.element.querySelector<HTMLDetailsElement>('.title-audio')!;
    if (audio.open) { audio.open = false; audio.querySelector('summary')!.focus(); return true; }
    if(this.page==='characters')return false;this.selectPage('characters');return true; }
  updateOverlayGamepad(pad: GamepadInput, now: number): boolean {
    if(this.element.inert)return true;
    if(pad.active)this.element.classList.add('is-controller');
    const audio = this.element.querySelector<HTMLDetailsElement>('.title-audio')!;
    if (pad.pressed.has(PAD.skill4)) {
      audio.open = !audio.open; this.audioPad.clear();
      audio.querySelector<HTMLElement>(audio.open ? 'input' : 'summary')!.focus(); return true;
    }
    if (audio.open) {
      if (pad.pressed.has(PAD.dodge) || pad.pressed.has(PAD.pause)) this.dismissOverlay();
      else this.audioPad.update(audio, pad, now);
      return true;
    }
    if(pad.pressed.has(PAD.potion)||pad.pressed.has(PAD.skill2)) {
      const pages=this.availablePages(),delta=pad.pressed.has(PAD.potion)?-1:1;
      this.selectPage(pages[(pages.indexOf(this.page)+delta+pages.length)%pages.length]);return true;
    }
    return this.chronicle.updateGamepad(pad,now)||this.changelog.updateGamepad(pad,now)||this.leaderboard.updateGamepad(pad,now);
  }
  private choose(index: number, focus = true) {
    this.selected = index; this.confirming = null; this.loading = false; const ticket = ++this.inspection;
    this.render();
    if (focus) this.element.querySelector<HTMLButtonElement>(`[data-slot="${index}"]`)?.focus();
    const slot = this.slots[index];
    if (!slot || !this.actions.read || slot.record && this.source.mode !== 'cloud') return;
    this.loading = true; this.renderSelection();
    void this.actions.read(index).then(value => {
      if (ticket !== this.inspection || this.element.hidden) return;
      const restoreSlot = (document.activeElement as HTMLElement | null)?.dataset.slot === String(index);
      this.slots[index] = value; this.loading = false; this.render();
      if (restoreSlot) this.element.querySelector<HTMLButtonElement>(`[data-slot="${index}"]`)?.focus({ preventScroll: true });
    }).catch(() => { if (ticket === this.inspection) { this.loading = false; this.message('Save unavailable. Please retry.'); this.renderSelection(); } });
  }
  message(text: string) { const target = this.element.querySelector<HTMLElement>('.title-save-message')!; target.textContent = text; target.hidden = !text; }
  close() { this.changelog.close(false); this.chronicle.close(false); this.leaderboard.close(); this.element.inert = false; this.inspection++; this.element.hidden = true; this.focus?.dispose(); this.focus = undefined; cancelAnimationFrame(this.frame); this.frame = 0; }
  dispose() { this.close(); this.changelog.dispose(); this.chronicle.dispose(); this.leaderboard.dispose(); this.abort.abort(); this.element.remove(); }
  private rollSeed() { const value = String(crypto.getRandomValues(new Uint32Array(1))[0]); this.seedDrafts.set(this.selected, value); return value; }
  private validateSeed(input: HTMLInputElement) { const seed = parseWorldSeed(input.value); input.setCustomValidity(seed === null ? 'Use a whole number from 0 to 4294967295.' : ''); return seed; }
  private render() {
    this.element.querySelector('.title-slot-count')!.textContent = `${this.slots.filter(s => s.record || s.summary).length} / 8`;
    this.element.querySelector('.title-slot-grid')!.innerHTML = this.slots.map(slot => {
      const r = slot.record, summary = r ? { name: r.name, level: r.checkpoint.level, gearPower: equippedGearPower(r.checkpoint.character) } : slot.summary;
      return `<button class="title-slot" data-slot="${slot.index}" aria-pressed="${slot.index === this.selected}" aria-label="Slot ${slot.index + 1}: ${summary ? escapeUI(summary.name) : 'New character'}"><span class="title-slot-number">${slot.index + 1}</span><span class="title-slot-copy"><strong>${summary ? escapeUI(summary.name) : slot.state === 'empty' ? '+ New' : 'Unavailable'}</strong>${summary ? `<small>Lv ${summary.level} ${summary.gearPower!==undefined?`<i>·</i> ${format(summary.gearPower)} gear`:''}</small>` : ''}</span>${slot.conflict ? '<span class="title-slot-alert" aria-label="Save conflict">!</span>' : ''}</button>`;
    }).join('');
    this.renderSelection();
  }
  private renderSelection() {
    const slot = this.slots[this.selected], record = slot?.record;
    this.player = previewCharacter(record ?? null, this.starter);
    const selection = this.element.querySelector('.title-selection')!;
    const canUse = this.source.mode === 'local' || this.source.signedIn;
    this.element.querySelector<HTMLButtonElement>('[data-action="download"]')!.disabled = this.source.mode !== 'local' || !record || !this.actions.download;
    this.element.querySelector<HTMLButtonElement>('[data-action="import"]')!.disabled = this.source.mode !== 'local' || !canUse || slot?.state !== 'empty' || this.loading || !this.actions.import;
    if (this.source.status === 'Loading…') { selection.innerHTML = '<p class="title-loading" role="status">Loading…</p>'; return; }
    if (!canUse) {
      if (this.source.status === 'Unavailable') { selection.innerHTML = '<div class="title-signin"><p>Cloud unavailable</p><button class="ui-button" data-action="retry">Retry</button></div>'; return; }
      selection.innerHTML = `<div class="title-signin"><span class="title-signin-crest" aria-hidden="true">${uiIcon('skilltree')}</span><a class="ui-button ui-button--primary" href="/signin-with-chatgpt?return_to=/" target="_top">Sign in with ChatGPT</a><p>Continue on any browser.</p></div>`; return;
    }
    if (this.loading) { selection.innerHTML = '<p class="title-loading" role="status">Loading…</p>'; return; }
    if (this.confirming) {
      const deleteMessage = slot?.conflict
        ? 'Deletes the cloud save and this device’s recovery copy. This cannot be undone.'
        : 'This cannot be undone.';
      selection.innerHTML = `<div class="title-confirm"><h3>${this.confirming === 'delete' ? 'Delete character?' : 'Use cloud version?'}</h3><p>${this.confirming === 'delete' ? deleteMessage : 'Replaces this device’s recovery copy with the saved cloud version. This cannot be undone.'}</p><div class="title-actions"><button class="ui-button" data-action="cancel">Cancel</button><button class="ui-button ui-button--danger" data-action="confirm-${this.confirming}">${this.confirming === 'delete' ? 'Delete' : 'Use cloud'}</button></div></div>`; return;
    }
    if (slot?.conflict && slot.recovery) {
      const describe = (save: CharacterSave) => `<strong>${escapeUI(save.name)}</strong><div class="title-branch-stats">Level ${save.checkpoint.level} · ${format(equippedGearPower(save.checkpoint.character))} gear · ${Math.floor(save.checkpoint.time / 60)} min played</div><time datetime="${new Date(save.updatedAt).toISOString()}">${escapeUI(new Date(save.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</time>`;
      selection.innerHTML = `<div class="title-save-branches">
        <section class="title-save-branch"><h3>Cloud save</h3>${record ? describe(record) : `<p>${slot.cloudState === 'offline' ? 'Cannot check the cloud save. Reconnect and retry.' : 'This slot is empty in the cloud.'}</p>`}
          <button class="ui-button ui-button--primary" data-action="cloud" ${slot.cloudState === 'offline' ? 'disabled' : ''}>Use cloud version</button></section>
        <section class="title-save-branch title-save-branch--recovery"><h3>This device’s recovery</h3>${slot.recovery.record ? describe(slot.recovery.record) : `<p>${slot.recovery.invalid ? 'This copy requires a compatible game version.' : 'This device has a pending deletion.'}</p>`}
          <p>Unsent changes. Kept separately from the cloud save.</p>
          ${slot.recovery.record && this.actions.continueRecovery ? '<button class="ui-button" data-action="recovery">Continue recovery</button>' : ''}</section>
        <button class="ui-button ui-button--quiet" data-action="delete">Delete character</button>
      </div>`; return;
    }
    if (record) {
      const power = equippedGearPower(record.checkpoint.character);
      selection.innerHTML = `<div class="title-selection-heading"><h3>${escapeUI(record.name)}</h3><button class="ui-button ui-button--quiet ui-button--icon" data-action="delete" aria-label="Delete character">${uiIcon('close')}</button></div>
        <div class="title-build-stats"><div><strong>${record.checkpoint.level}</strong><span>Level</span></div><div data-tooltip="Average equipped item power. Two-handed weapons count for both hands." tabindex="0"><strong>${format(power)}</strong><span>Gear power</span></div></div>
        <div class="title-save-meta">${slot.cloudState ? `<span>${slot.cloudState === 'offline' ? 'Device copy · cloud unavailable' : slot.cloudState === 'pending' ? 'This device · awaiting upload' : 'Cloud save'}</span>` : ''}<span>${Math.floor(record.checkpoint.time / 60)} min</span><span>${new Date(record.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>
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
