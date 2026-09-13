import { drawFloatingHUD, type HUDOptions } from './hud.ts';
import type { Player } from './model.ts';
import type { SkillId } from './character-types.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';
import { INVENTORY_SKILL_BINDINGS, inventoryHUDLayout, inventorySkillPickerMarkup } from './inventory-skills.ts';
import { trapDialogFocus, uiIcon } from './ui-components.ts';
import './inventory-hud.css';

interface InventoryHUDActions {
  options?(): HUDOptions;
  assign(slot: number, skill: SkillId | null): void;
  details(skill?: SkillId | null): void;
  suspend(): void;
  restore(anchor: HTMLElement): void;
}

/** The shared runtime HUD docked into inventory; transparent controls use its exact transform. */
export class InventoryHUD {
  readonly picker: HTMLElement;
  private readonly controls: HTMLElement;
  private readonly dock: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private lastDraw = 0;
  private readonly lifetime = new AbortController();
  private readonly observer: ResizeObserver;
  private focus: ReturnType<typeof trapDialogFocus> | null = null;
  private player: Player | null = null;
  private slot = 0;
  get pickerOpen(): boolean { return !this.picker.hidden; }

  private readonly root: HTMLElement;
  private readonly actions: InventoryHUDActions;

  constructor(root: HTMLElement, footer: HTMLElement, actions: InventoryHUDActions) {
    this.root = root; this.actions = actions;
    root.classList.add('has-inventory-hud');
    this.dock = document.createElement('div'); this.dock.className = 'inventory-hud-dock';
    this.canvas = document.createElement('canvas'); this.canvas.setAttribute('aria-hidden', 'true');
    this.dock.append(this.canvas); footer.prepend(this.dock);
    this.controls = document.createElement('div'); this.controls.className = 'inventory-hud-targets';
    this.controls.setAttribute('aria-label', 'Skill hotkeys');
    this.controls.innerHTML = INVENTORY_SKILL_BINDINGS.map((binding, slot) => `<button type="button" class="inventory-hud-slot" data-skill-slot="${slot}" aria-label="${binding.key}: skill details" aria-haspopup="dialog" aria-expanded="false" aria-controls="inventory-quick-skills"></button>`).join('');
    this.picker = document.createElement('section'); this.picker.className = 'inventory-quick-skills';
    this.picker.id = 'inventory-quick-skills'; this.picker.hidden = true;
    this.picker.setAttribute('role', 'dialog'); this.picker.setAttribute('aria-modal', 'true');
    this.picker.setAttribute('aria-labelledby', 'inventory-quick-skills-title');
    root.append(this.controls, this.picker);
    const options = { signal: this.lifetime.signal };
    this.controls.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLElement>('[data-skill-slot]');
      if (button) this.details(Number(button.dataset.skillSlot));
    }, options);
    this.controls.addEventListener('contextmenu', event => {
      const button = (event.target as Element).closest<HTMLElement>('[data-skill-slot]');
      if (!button) return;
      event.preventDefault(); event.stopPropagation(); this.open(Number(button.dataset.skillSlot));
    }, options);
    this.controls.addEventListener('keydown', event => {
      if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
      const button = (event.target as Element).closest<HTMLElement>('[data-skill-slot]');
      if (button) { event.preventDefault(); event.stopPropagation(); this.open(Number(button.dataset.skillSlot)); }
    }, options);
    this.picker.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!button || button.disabled) return;
      if (button.hasAttribute('data-assign-skill')) {
        const slot = this.slot, skill = button.dataset.assignSkill as SkillId | '';
        this.dismiss(); this.actions.assign(slot, skill || null);
      } else if (button.hasAttribute('data-skill-details')) this.details(this.slot);
      else if (button.hasAttribute('data-picker-close')) this.dismiss();
    }, options);
    root.addEventListener('click', event => {
      if (this.pickerOpen && !this.picker.contains(event.target as Node) && !this.controls.contains(event.target as Node)) {
        event.preventDefault(); event.stopPropagation(); this.dismiss();
      }
    }, { ...options, capture: true });
    this.observer = new ResizeObserver(() => { this.layout(); if (this.pickerOpen) this.positionPicker(); });
    this.observer.observe(root); this.observer.observe(this.dock);
  }

  refresh(player: Player): void {
    this.player = player;
    for (const [slot, button] of [...this.controls.querySelectorAll<HTMLButtonElement>('button')].entries()) {
      const id = player.character.skillSlots[slot], key = INVENTORY_SKILL_BINDINGS[slot].key;
      const label = `${key}: ${id ? SKILL_DEFINITIONS[id].name : 'Empty slot'}. Click for skill details. Right-click to assign.`;
      button.setAttribute('aria-label', label); button.title = label;
    }
    this.layout();
  }

  private layout(): void {
    if (this.root.hidden || !this.dock.clientWidth) return;
    const root = this.root.getBoundingClientRect(), dock = this.dock.getBoundingClientRect();
    const layout = inventoryHUDLayout(dock.width, dock.height);
    this.controls.querySelectorAll<HTMLElement>('button').forEach((button, slot) => {
      const rect = layout.slots[slot];
      Object.assign(button.style, { left: `${dock.left - root.left + rect.x}px`, top: `${dock.top - root.top + rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    });
    this.draw(0);
  }

  draw(now: number): void {
    if (!this.player || this.root.hidden || !this.dock.clientWidth || (now && now - this.lastDraw < 1000 / 30)) return;
    this.lastDraw = now;
    const width = this.dock.clientWidth, height = this.dock.clientHeight, density = window.devicePixelRatio || 1;
    const w = Math.round(width * density), h = Math.round(height * density);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    const context = this.canvas.getContext('2d');
    if (!context) return;
    context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, w, h);
    context.setTransform(w / width, 0, 0, h / height, 0, 0);
    drawFloatingHUD(context, this.player, width, height, now / 1000, {
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      ...this.actions.options?.(), layout: inventoryHUDLayout(width, height).hud, inventory: true, touch: false,
    });
  }

  private details(slot: number): void {
    const skill = this.player?.character.skillSlots[slot];
    this.dismiss(); this.actions.details(skill);
  }

  private open(slot: number): void {
    if (!this.player) return;
    this.dismiss(false); this.slot = slot;
    this.actions.suspend(); this.picker.hidden = false;
    this.picker.innerHTML = `<header><h3 id="inventory-quick-skills-title">Assign to ${INVENTORY_SKILL_BINDINGS[slot].key}</h3><button type="button" class="ui-button ui-button--quiet ui-button--icon" data-picker-close aria-label="Close quick picker">${uiIcon('close')}</button></header>${inventorySkillPickerMarkup(this.player, slot)}`;
    this.controls.querySelectorAll('button').forEach((button, index) => button.setAttribute('aria-expanded', String(index === slot)));
    this.positionPicker();
    this.focus = trapDialogFocus(this.picker, { signal: this.lifetime.signal, restoreFocus: false,
      initialFocus: () => this.picker.querySelector('[aria-pressed="true"]') ?? this.picker.querySelector('[data-assign-skill]:not(:disabled), [data-skill-details]'),
    });
  }

  private positionPicker(): void {
    const anchor = this.controls.querySelectorAll<HTMLElement>('button')[this.slot];
    this.picker.style.maxHeight = `${Math.max(100, anchor.offsetTop - 24)}px`;
    const left = Math.max(12, Math.min(this.root.clientWidth - this.picker.offsetWidth - 12, anchor.offsetLeft + anchor.offsetWidth / 2 - this.picker.offsetWidth / 2));
    this.picker.style.left = `${left}px`;
    this.picker.style.top = `${Math.max(12, anchor.offsetTop - this.picker.offsetHeight - 10)}px`;
  }

  dismiss(restore = true): boolean {
    if (!this.pickerOpen) return false;
    this.focus?.dispose(); this.focus = null; this.picker.hidden = true;
    this.controls.querySelectorAll('button').forEach(button => button.setAttribute('aria-expanded', 'false'));
    if (restore) this.actions.restore(this.controls.querySelectorAll<HTMLElement>('button')[this.slot]);
    return true;
  }

  setInert(inert: boolean): void { this.controls.inert = inert; }
  dispose(): void { this.dismiss(false); this.observer.disconnect(); this.lifetime.abort(); this.controls.remove(); this.picker.remove(); this.dock.remove(); }
}
