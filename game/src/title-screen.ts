import { escapeUI, uiIcon, trapDialogFocus } from './ui-components.ts';
import { characterPower, previewCharacter } from './character-summary.ts';
import { drawCharacterPortrait } from './character-portrait.ts';
import type { SaveSlot } from './character-storage.ts';
import type { Player } from './model.ts';
import './title-screen.css';

export interface TitleActions { create(index: number, name: string): void; continue(index: number): void; remove(index: number): void; }
const format = (n: number) => Math.round(n).toLocaleString('en-US');
const powerHint = 'Build estimate from basic-attack DPS and effective life. Active skills, mana sustain and enemy mechanics are not included.';

/** Character selection is presentation only. Storage and session changes belong to Game. */
export class TitleScreen {
  readonly element: HTMLDivElement;
  private slots: SaveSlot[] = [];
  private selected = 0;
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
      <header class="title-brand"><div class="title-crest" aria-hidden="true">${uiIcon('skilltree')}</div><div><p class="ui-kicker">Beyond the last light</p><h1>EVERGROW</h1><div class="title-brand-rule" aria-hidden="true"><i></i>✦<i></i></div><p class="title-tagline">A world without an edge. A path of your own.</p></div></header>
      <section class="title-hero" aria-label="Selected character"><div class="title-halo" aria-hidden="true"></div><canvas width="560" height="720" aria-label="Selected character wearing their saved equipment"></canvas><div class="title-plinth" aria-hidden="true"></div><div class="title-character-caption"></div></section>
      <section class="title-roster ui-window" aria-labelledby="roster-title"><header class="ui-window-header"><div><p class="ui-kicker">Your journeys</p><h2 class="ui-title" id="roster-title">The character hall</h2></div><span class="title-slot-count"></span></header>
      <div class="title-slot-grid" role="group" aria-label="Eight character slots"></div>
      <div class="title-selection"></div><p class="title-save-message" role="status" hidden></p>
      <footer class="title-roster-footer"><span class="title-save-dot"></span>Saved on this browser<span>8 character slots</span></footer></section>
      <footer class="title-footer"><span>LOCAL PROTOTYPE <i>·</i> AUTOSAVE ENABLED</span><span>THE WILDERNESS AWAITS</span></footer>`;
    this.canvas = this.element.querySelector('canvas')!; mount.append(this.element);
    this.element.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button'); if (!button) return;
      if (button.dataset.slot !== undefined) { this.selected = Number(button.dataset.slot); this.confirming = false; this.render(); this.element.querySelector<HTMLButtonElement>(`[data-slot="${this.selected}"]`)?.focus(); }
      if (button.dataset.action === 'continue') this.actions.continue(this.selected);
      if (button.dataset.action === 'delete') { this.confirming = true; this.render(); this.element.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.focus(); }
      if (button.dataset.action === 'cancel') { this.confirming = false; this.render(); }
      if (button.dataset.action === 'confirm-delete') this.actions.remove(this.selected);
    }, { signal: this.abort.signal });
    this.element.addEventListener('submit', event => {
      event.preventDefault(); const input = this.element.querySelector<HTMLInputElement>('[name="character-name"]');
      const name = input?.value.trim(); if (name) this.actions.create(this.selected, name);
    }, { signal: this.abort.signal });
  }
  open(slots: SaveSlot[], preferred?: number): void {
    this.slots = slots;
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
  private render(): void {
    const selected = this.slots[this.selected], record = selected?.record;
    this.player = previewCharacter(record ?? null);
    this.element.querySelector('.title-slot-count')!.textContent = `${this.slots.filter(s => s.record).length} / 8`;
    this.element.querySelector('.title-slot-grid')!.innerHTML = this.slots.map(slot => {
      const r = slot.record, p = r ? characterPower(previewCharacter(r)) : null;
      return `<button type="button" class="title-slot" data-slot="${slot.index}" aria-pressed="${slot.index === this.selected}" aria-label="Slot ${slot.index + 1}: ${r ? escapeUI(r.name) : slot.state === 'empty' ? 'New character' : 'Save unavailable'}">
        <span class="title-slot-number">0${slot.index + 1}</span><span class="title-slot-emblem" aria-hidden="true">${uiIcon(r ? 'character' : 'plus')}</span><span class="title-slot-copy"><strong>${r ? escapeUI(r.name) : slot.state === 'empty' ? 'New journey' : 'Unreadable save'}</strong><small>${r ? `Level ${r.checkpoint.level} <i>·</i> ${format(p!.power)} power` : slot.state === 'empty' ? 'Empty character slot' : 'Your data is preserved'}</small></span></button>`;
    }).join('');
    const power = characterPower(this.player), name = record?.name ?? 'A new wayfarer';
    this.element.querySelector('.title-character-caption')!.innerHTML = `<p class="ui-kicker">${record ? `LEVEL ${record.checkpoint.level} · ${record.checkpoint.dead ? 'RETURNING TO THE REFUGE' : 'WAYFARER'}` : 'EVERY JOURNEY BEGINS HERE'}</p><h2>${escapeUI(name)}</h2><span>${record ? escapeUI(record.checkpoint.character.equipped.weapon?.name ?? 'Unarmed') : 'A sword, worn leather, and an open road.'}</span>`;
    const selection = this.element.querySelector('.title-selection')!;
    if (this.confirming) {
      selection.innerHTML = `<h3>Delete ${record ? escapeUI(record.name) : 'this unreadable save'}?</h3><p>This permanently removes the character from this browser.</p><div class="title-actions"><button class="ui-button" data-action="cancel">Keep character</button><button class="ui-button ui-button--danger" data-action="confirm-delete">Delete character</button></div>`;
    } else if (record) {
      selection.innerHTML = `<div class="title-selection-heading"><div><p class="ui-kicker">${selected.state === 'recovered' ? 'BACKUP RECOVERED' : 'READY TO CONTINUE'}</p><h3>${escapeUI(name)}</h3></div><button class="ui-button ui-button--quiet ui-button--icon" data-action="delete" aria-label="Delete ${escapeUI(name)}" data-tooltip="Delete character" data-tooltip-align="end">${uiIcon('close')}</button></div>
        <div class="title-build-stats"><div data-tooltip="${powerHint}" tabindex="0"><strong>${format(power.power)}</strong><span>Power ⓘ</span></div><div><strong>${format(this.player.maxHp)}</strong><span>Life</span></div><div><strong>${format(this.player.derived.armor)}</strong><span>Armor</span></div><div><strong>${record.checkpoint.character.allocatedNodes.length - 1}</strong><span>Passives</span></div></div>
        <div class="title-save-meta"><span>${Math.floor(record.checkpoint.time / 60)} min played</span><span>Saved ${new Date(record.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${new Date(record.updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span></div>
        <button class="ui-button ui-button--primary title-enter" data-action="continue"><span>${record.checkpoint.dead ? 'RETURN TO THE REFUGE' : 'CONTINUE JOURNEY'}</span>${uiIcon('chevron')}</button>`;
    } else if (selected?.state === 'empty') {
      selection.innerHTML = `<form class="title-create"><label for="character-name">Name your wayfarer</label><input id="character-name" name="character-name" maxlength="24" minlength="1" required autocomplete="off" placeholder="Wayfarer" value="Wayfarer" pattern=".*\\S.*"/><p>Level 1 · Basic leather armor · Sword · Empty inventory</p><button class="ui-button ui-button--primary title-enter" type="submit"><span>BEGIN JOURNEY</span>${uiIcon('chevron')}</button></form>`;
    } else {
      selection.innerHTML = `<h3>${selected?.state === 'unavailable' ? 'Storage unavailable' : 'Save could not be read'}</h3><p>${selected?.state === 'unavailable' ? 'Allow local browser storage to save your journeys.' : 'This slot has been preserved. Try another slot, or delete this save to reclaim it.'}</p>${selected?.state === 'invalid' ? '<button class="ui-button ui-button--danger" data-action="delete">Delete unreadable save</button>' : ''}`;
    }
    this.message(this.slots.some(slot => slot.state === 'unavailable') ? 'Local saving is unavailable in this browser. Enable storage before starting a journey.' : '');
  }
  private animate = (): void => {
    if (this.element.hidden) return;
    const ctx = this.canvas.getContext('2d');
    if (ctx) drawCharacterPortrait(ctx, this.player, this.motion.matches ? 3 : performance.now() / 1000, Math.PI / 2 + .18, 560, 720);
    this.frame = requestAnimationFrame(this.animate);
  };
}
