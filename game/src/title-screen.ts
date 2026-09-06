import { escapeUI, uiIcon, trapDialogFocus } from './ui-components.ts';
import { characterPower, previewCharacter } from './character-summary.ts';
import { drawCharacterPortrait } from './character-portrait.ts';
import type { SaveSlot } from './character-storage.ts';
import type { Player } from './model.ts';
import { STARTER_LOADOUTS, createStarterLoadout, isStarterLoadoutId, type StarterLoadoutId } from './items.ts';
import { itemIconSVG } from './item-art.ts';
import { parseWorldSeed } from './world-seed.ts';
import './title-screen.css';

export interface TitleActions { create(index: number, name: string, weapon: StarterLoadoutId, seed: number): void; continue(index: number): void; remove(index: number): void; }
const format = (n: number) => Math.round(n).toLocaleString('en-US');
const powerHint = 'Build estimate from basic-attack DPS and effective life. Active skills, mana sustain and enemy mechanics are not included.';

/** Character selection is presentation only. Storage and session changes belong to Game. */
export class TitleScreen {
  readonly element: HTMLDivElement;
  private slots: SaveSlot[] = [];
  private selected = 0;
  private starter: StarterLoadoutId = STARTER_LOADOUTS[0].id;
  private seedDrafts = new Map<number, string>();
  private player: Player = previewCharacter(null);
  private canvas: HTMLCanvasElement;
  private abort = new AbortController();
  private focus?: { dispose(): void };
  private frame = 0;
  private confirming = false;
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  private actions: TitleActions;
  constructor(mount: HTMLElement, actions: TitleActions) {
    this.actions = actions;
    this.element = document.createElement('div'); this.element.className = 'title-screen'; this.element.hidden = true;
    this.element.innerHTML = `<div class="title-vignette" aria-hidden="true"></div>
      <header class="title-brand"><div class="title-crest" aria-hidden="true">${uiIcon('skilltree')}</div><div><h1>EVERGROW</h1><div class="title-brand-rule" aria-hidden="true"><i></i>✦<i></i></div></div></header>
      <section class="title-hero" aria-label="Selected character"><div class="title-halo" aria-hidden="true"></div><canvas width="560" height="720" aria-label="Selected character wearing their saved equipment"></canvas><div class="title-plinth" aria-hidden="true"></div></section>
      <section class="title-roster ui-window" aria-labelledby="roster-title"><header class="ui-window-header"><div><h2 class="ui-title" id="roster-title">Characters</h2></div><span class="title-slot-count"></span></header>
      <div class="title-slot-grid" role="group" aria-label="Eight character slots"></div>
      <div class="title-selection"></div><p class="title-save-message" role="status" hidden></p>
      <footer class="title-roster-footer"><span class="title-save-dot"></span>Saved locally</footer></section>`;
    this.canvas = this.element.querySelector('canvas')!; mount.append(this.element);
    this.element.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button'); if (!button) return;
      if (button.dataset.slot !== undefined) { this.selected = Number(button.dataset.slot); this.confirming = false; this.render(); this.element.querySelector<HTMLButtonElement>(`[data-slot="${this.selected}"]`)?.focus(); }
      if (button.dataset.action === 'continue') this.actions.continue(this.selected);
      if (button.dataset.action === 'delete') { this.confirming = true; this.render(); this.element.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.focus(); }
      if (button.dataset.action === 'cancel') { this.confirming = false; this.render(); }
      if (button.dataset.action === 'confirm-delete') this.actions.remove(this.selected);
      if (button.dataset.action === 'random-seed') {
        const input = this.element.querySelector<HTMLInputElement>('[name="world-seed"]');
        if (input) { input.value = this.rollSeed(); input.setCustomValidity(''); }
      }
    }, { signal: this.abort.signal });
    this.element.addEventListener('input', event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.name !== 'world-seed') return;
      this.seedDrafts.set(this.selected, input.value);
      this.validateSeed(input);
    }, { signal: this.abort.signal });
    this.element.addEventListener('change', event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.name !== 'starter-weapon' || !isStarterLoadoutId(input.value)) return;
      this.starter = input.value; this.player = previewCharacter(null, this.starter);
    }, { signal: this.abort.signal });
    this.element.addEventListener('submit', event => {
      event.preventDefault(); const input = this.element.querySelector<HTMLInputElement>('[name="character-name"]');
      const seedInput = this.element.querySelector<HTMLInputElement>('[name="world-seed"]');
      if (!seedInput) return;
      const seed = this.validateSeed(seedInput);
      if (seed === null) { seedInput.reportValidity(); return; }
      const name = input?.value.trim(); if (name) this.actions.create(this.selected, name, this.starter, seed);
    }, { signal: this.abort.signal });
  }
  open(slots: SaveSlot[], preferred?: number): void {
    this.slots = slots;
    this.seedDrafts.clear();
    if (preferred !== undefined) this.selected = preferred;
    else this.selected = slots.filter(s => s.record).sort((a, b) => b.record!.updatedAt - a.record!.updatedAt)[0]?.index ?? 0;
    this.confirming = false; this.element.hidden = false; this.render();
    this.focus?.dispose(); this.focus = trapDialogFocus(this.element, { signal: this.abort.signal, restoreFocus: false,
      initialFocus: () => this.element.querySelector('[data-action="continue"]') ?? this.element.querySelector('[name="character-name"]') });
    this.element.querySelector<HTMLInputElement>('[name="character-name"]')?.select();
    if (!this.frame) this.animate();
  }
  message(text: string): void { const target = this.element.querySelector<HTMLElement>('.title-save-message')!; target.textContent = text; target.hidden = !text; }
  close(): void { this.element.hidden = true; this.focus?.dispose(); this.focus = undefined; cancelAnimationFrame(this.frame); this.frame = 0; }
  dispose(): void { this.close(); this.abort.abort(); this.element.remove(); }
  private rollSeed(): string {
    let seed = crypto.getRandomValues(new Uint32Array(1))[0];
    if (seed === parseWorldSeed(this.seedDrafts.get(this.selected) ?? '')) seed = (seed + 1) >>> 0;
    const value = String(seed); this.seedDrafts.set(this.selected, value); return value;
  }
  private validateSeed(input: HTMLInputElement): number | null {
    const seed = parseWorldSeed(input.value);
    input.setCustomValidity(seed === null ? 'Enter a whole number from 0 to 4294967295.' : '');
    return seed;
  }
  private render(): void {
    const selected = this.slots[this.selected], record = selected?.record;
    this.element.classList.toggle('is-creating', selected?.state === 'empty' && !this.confirming);
    this.player = previewCharacter(record ?? null, this.starter);
    this.element.querySelector('.title-slot-count')!.textContent = `${this.slots.filter(s => s.record).length} / 8`;
    this.element.querySelector('.title-slot-grid')!.innerHTML = this.slots.map(slot => {
      const r = slot.record, p = r ? characterPower(previewCharacter(r)) : null;
      return `<button type="button" class="title-slot" data-slot="${slot.index}" aria-pressed="${slot.index === this.selected}" aria-label="Slot ${slot.index + 1}: ${r ? escapeUI(r.name) : slot.state === 'empty' ? 'New character' : 'Save unavailable'}">
        <span class="title-slot-number">0${slot.index + 1}</span><span class="title-slot-emblem" aria-hidden="true">${uiIcon(r ? 'character' : 'plus')}</span><span class="title-slot-copy"><strong>${r ? escapeUI(r.name) : slot.state === 'empty' ? 'New character' : 'Unreadable save'}</strong>${r ? `<small>Level ${r.checkpoint.level} <i>·</i> ${format(p!.power)} power</small>` : ''}</span></button>`;
    }).join('');
    const power = characterPower(this.player), name = record?.name ?? 'New character';
    const selection = this.element.querySelector('.title-selection')!;
    if (this.confirming) {
      selection.innerHTML = `<h3>Delete ${record ? escapeUI(record.name) : 'this unreadable save'}?</h3><p>This permanently removes the character from this browser.</p><div class="title-actions"><button class="ui-button" data-action="cancel">Keep character</button><button class="ui-button ui-button--danger" data-action="confirm-delete">Delete character</button></div>`;
    } else if (record) {
      selection.innerHTML = `<div class="title-selection-heading"><div>${selected.state === 'recovered' ? '<p class="ui-kicker">Backup recovered</p>' : ''}<h3>${escapeUI(name)}</h3></div><button class="ui-button ui-button--quiet ui-button--icon" data-action="delete" aria-label="Delete ${escapeUI(name)}" data-tooltip="Delete character" data-tooltip-align="end">${uiIcon('close')}</button></div>
        <div class="title-build-stats"><div data-tooltip="${powerHint}" tabindex="0"><strong>${format(power.power)}</strong><span>Power ⓘ</span></div><div><strong>${format(this.player.maxHp)}</strong><span>Life</span></div><div><strong>${format(this.player.derived.armor)}</strong><span>Armor</span></div><div><strong>${record.checkpoint.character.allocatedNodes.length - 1}</strong><span>Passives</span></div></div>
        <div class="title-save-meta"><span>${Math.floor(record.checkpoint.time / 60)} min played</span><span>Saved ${new Date(record.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${new Date(record.updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span></div>
        <div class="title-world-seed"><span>World seed</span><span>${record.worldSeed}</span></div>
        <button class="ui-button ui-button--primary title-enter" data-action="continue"><span>Continue</span>${uiIcon('chevron')}</button>`;
    } else if (selected?.state === 'empty') {
      selection.innerHTML = `<form class="title-create"><label for="character-name">Name</label><input id="character-name" name="character-name" maxlength="24" minlength="1" required autocomplete="off" placeholder="Wayfarer" value="Wayfarer" pattern=".*\\S.*"/><fieldset class="title-weapons"><legend>Choose your starting gear</legend><div class="title-weapon-grid">${STARTER_LOADOUTS.map(option => {
          const loadout = createStarterLoadout(option.id);
          return `<label class="title-weapon-choice"><input type="radio" name="starter-weapon" value="${option.id}" ${this.starter === option.id ? 'checked' : ''}/><span class="title-weapon-icon ${loadout.offhand ? 'has-offhand' : ''}" aria-hidden="true">${itemIconSVG(loadout.weapon, 48)}${loadout.offhand ? itemIconSVG(loadout.offhand, 40) : ''}</span><span class="title-weapon-copy"><strong>${option.label}</strong><small>${option.detail}</small></span><span class="title-weapon-selected" aria-hidden="true">✦</span></label>`;
        }).join('')}</div></fieldset><div class="title-seed-field"><label for="world-seed">World seed</label><div class="title-seed-controls"><input id="world-seed" name="world-seed" type="text" inputmode="numeric" required autocomplete="off" spellcheck="false" value="${escapeUI(this.seedDrafts.get(this.selected) ?? this.rollSeed())}"/><button type="button" class="ui-button" data-action="random-seed" aria-label="Generate a new random world seed">Randomize</button></div></div><button class="ui-button ui-button--primary title-enter" type="submit"><span>Create character</span>${uiIcon('chevron')}</button></form>`;
      this.validateSeed(selection.querySelector<HTMLInputElement>('[name="world-seed"]')!);
    } else {
      selection.innerHTML = `<h3>${selected?.state === 'unavailable' ? 'Storage unavailable' : 'Save could not be read'}</h3><p>${selected?.state === 'unavailable' ? 'Enable browser storage to save characters.' : 'This slot has been preserved. Try another slot, or delete this save to reclaim it.'}</p>${selected?.state === 'invalid' ? '<button class="ui-button ui-button--danger" data-action="delete">Delete unreadable save</button>' : ''}`;
    }
    this.message(this.slots.some(slot => slot.state === 'unavailable') ? 'Enable browser storage to create a character.' : '');
  }
  private animate = (): void => {
    if (this.element.hidden) return;
    const ctx = this.canvas.getContext('2d');
    if (ctx) drawCharacterPortrait(ctx, this.player, this.motion.matches ? 3 : performance.now() / 1000, Math.PI / 2 + .18, 560, 720);
    this.frame = requestAnimationFrame(this.animate);
  };
}
