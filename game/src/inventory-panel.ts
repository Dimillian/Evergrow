import { itemDisplayName } from './items.ts';
import { updateItemSlot } from './item-ui.ts';
import { ItemTooltip } from './item-tooltip.ts';
import { goldBalance } from './wallet.ts';
import { formatGold } from './currency-format.ts';
import type { Player } from './model.ts';
import type { Attribute, EquipmentSlot, Item } from './character-types.ts';
import { INVENTORY_CAPACITY, EQUIPMENT_SLOTS, TIER_NAMES } from './items.ts';
import { planEquipmentChange } from './inventory.ts';
import { drawCharacterPortrait } from './character-portrait.ts';
import { deriveAttackStats } from './equipment.ts';
import { xpForNextLevel } from './progression.ts';
import { uiIcon, trapDialogFocus } from './ui-components.ts';
import './inventory-panel.css';

export interface InventoryPanelActions {
  close(): void;
  equip(index: number, slot?: EquipmentSlot): void;
  unequip(slot: EquipmentSlot, index?: number): void;
  move(from: number, to: number): void;
  allocate(attribute: Attribute): void;
}


type ItemLocation = { type: 'bag'; index: number } | { type: 'equipment'; slot: EquipmentSlot };
type ItemReference = ItemLocation & { id: string };
const ATTRIBUTE_NAMES: Record<Attribute, string> = { strength: 'Strength', dexterity: 'Dexterity', intelligence: 'Intelligence', vitality: 'Vitality' };
const ATTRIBUTE_DESCRIPTIONS: Record<Attribute, string> = {
  strength: 'Physical attack damage', dexterity: 'Attack speed and critical chance',
  intelligence: 'Spell damage and maximum mana', vitality: 'Maximum life',
};
const SLOT_NAMES: Record<EquipmentSlot, string> = {
  weapon: 'Main hand', offhand: 'Off hand', head: 'Head', chest: 'Chest', gloves: 'Gloves', legs: 'Legs', boots: 'Boots',
  cloak: 'Cloak', amulet: 'Amulet', ring1: 'Ring I', ring2: 'Ring II',
};
const LEFT_SLOTS: EquipmentSlot[] = ['chest', 'gloves', 'legs', 'boots', 'cloak'];
const RIGHT_SLOTS: EquipmentSlot[] = ['weapon', 'offhand', 'amulet', 'ring1', 'ring2'];
const number = (value: number, decimals = 0) => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: decimals }) : '—';
const percent = (value: number) => `${number(value * 100, 1)}%`;
const locationKey = (location: ItemLocation) => location.type === 'bag' ? `bag-${location.index}` : `equipment-${location.slot}`;

function emptySlotIcon(slot: EquipmentSlot): string {
  const glyphs: Record<EquipmentSlot, string> = {
    weapon: '<path d="m10 30 20-20 3-1-1 4-20 19m-4-8 9 9m-9-4-4 4 3 3 4-4"/>',
    offhand: '<path d="M21 7 34 12v11c0 8-7 13-13 16C15 36 8 31 8 23V12ZM21 13v19M14 21h14"/>',
    head: '<path d="M12 28V16l5-7h8l5 7v12l-6 3v-9h-6v9Zm1-8h16m-8-10v9"/>',
    chest: '<path d="m14 10 7 3 7-3 7 9-7 4v11H14V23l-7-4Zm0 13 7 4 7-4"/>',
    gloves: '<path d="m13 31-4-12 2-2 5 6V10h3v10-12h3v12-10h3v11-8h3v16l-5 5h-7Z"/>',
    legs: '<path d="M12 9h19l-2 25h-8l-1-16-1 16h-9Zm0 5h18"/>',
    boots: '<path d="M14 9h13v15l6 6v4H12V23Zm1 15h11M15 14h10"/>',
    cloak: '<path d="m17 9 4 3 4-3 8 26-12-4-12 4Zm4 3v19"/>',
    amulet: '<path d="M12 9v9a9 9 0 0 0 18 0V9m-9 17-5 6 5 6 5-6Z"/>',
    ring1: '<circle cx="21" cy="25" r="9"/><path d="m16 13 5-5 5 5-5 5Z"/>',
    ring2: '<circle cx="21" cy="25" r="9"/><path d="m16 13 5-5 5 5-5 5Z"/>',
  };
  return `<svg viewBox="0 0 42 42" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">${glyphs[slot]}</svg>`;
}

/** Inventory presents one authoritative character sheet; all mutations go through simulation actions. */
export class InventoryPanel {
  readonly element: HTMLDivElement;
  private readonly window: HTMLElement;
  private readonly lifetime = new AbortController();
  private readonly actions: InventoryPanelActions;
  private focus: ReturnType<typeof trapDialogFocus> | null = null;
  private player: Player | null = null;
  private hovered: ItemLocation | null = null;
  private drag: ItemReference | null = null;
  private animation = 0;
  private facing = Math.PI / 2;
  private readonly tooltip: ItemTooltip;
  private readonly canvas: HTMLCanvasElement;
  private readonly cells = new Map<string, HTMLButtonElement>();

  constructor(mount: HTMLElement, actions: InventoryPanelActions) {
    this.actions = actions;
    this.element = document.createElement('div');
    this.element.className = 'character-overlay';
    this.element.hidden = true;
    this.element.innerHTML = `<section class="ui-window character-window" role="dialog" aria-modal="true" aria-labelledby="character-title">
      <header class="ui-window-header character-header">
        <div class="character-heading"><span class="character-sigil ui-header-emblem" aria-hidden="true">${uiIcon('star')}</span><h2 class="ui-title" id="character-title">Character &amp; inventory</h2></div>
        <div class="character-header-right"><span class="character-level" data-level></span><button type="button" class="ui-button ui-button--icon" data-close aria-label="Close character">${uiIcon('close')}</button></div>
      </header>
      <div class="character-columns ui-scroll-area">
        <section class="character-equipment" aria-labelledby="equipment-title">
          <div class="character-section-title"><h3 id="equipment-title">Equipment</h3><span data-equipped-count></span></div>
          <div class="character-doll-stage"><div class="character-orbit" aria-hidden="true"></div><canvas class="character-doll" width="560" height="720" aria-label="Your character wearing the current equipment"></canvas>
            <div class="character-equipment-rail character-equipment-rail--crown">${this.equipmentMarkup('head')}</div>
            <div class="character-equipment-rail character-equipment-rail--left">${LEFT_SLOTS.map(slot => this.equipmentMarkup(slot)).join('')}</div>
            <div class="character-equipment-rail character-equipment-rail--right">${RIGHT_SLOTS.map(slot => this.equipmentMarkup(slot)).join('')}</div>
          </div>
          <div class="character-portrait-footer"><button class="ui-button ui-button--quiet ui-button--icon" data-turn="-1" aria-label="Turn character left">‹</button><div><span class="character-portrait-label">Equipped weapon</span><strong data-weapon-name></strong></div><button class="ui-button ui-button--quiet ui-button--icon" data-turn="1" aria-label="Turn character right">›</button></div>
          <div class="character-points"><span>${uiIcon('skilltree')}Skill points <strong data-skill-points></strong></span><span>${uiIcon('plus')}Attribute points <strong data-stat-points></strong></span></div>
        </section>
        <section class="character-inventory" aria-labelledby="inventory-title">
          <div class="character-section-title"><h3 id="inventory-title">Inventory</h3><div class="character-inventory-counts"><span class="character-gold" data-gold></span><span data-capacity></span></div></div>
          <div class="character-grid-scroll"><div class="character-bag" role="group" aria-label="Inventory, ${INVENTORY_CAPACITY} slots">${Array.from({ length: INVENTORY_CAPACITY }, (_, index) => `<button type="button" class="ui-slot ui-item-slot character-bag-slot" data-bag="${index}" data-location="bag-${index}" aria-label="Empty inventory slot ${index + 1}"></button>`).join('')}</div></div>
        </section>
        <section class="character-details" aria-labelledby="attributes-title">
          <div class="character-attributes"><div class="character-section-title"><h3 id="attributes-title">Attributes</h3><span class="character-points-available" data-points-label></span></div>
            <div class="character-attribute-list">${(Object.keys(ATTRIBUTE_NAMES) as Attribute[]).map(attribute => `<div class="character-attribute"><div><span>${ATTRIBUTE_NAMES[attribute]}</span><small>${ATTRIBUTE_DESCRIPTIONS[attribute]}</small></div><strong data-attribute-value="${attribute}"></strong><button type="button" class="ui-button ui-button--icon character-attribute-add" data-allocate="${attribute}" aria-label="Increase ${ATTRIBUTE_NAMES[attribute]}">${uiIcon('plus')}</button></div>`).join('')}</div>
          </div>
          <div class="character-statistics"><div class="character-section-title character-section-title--secondary"><h3>Combat details</h3><span>Effective</span></div><div data-combat-stats></div></div>
        </section>
      </div>
      <footer class="ui-window-footer character-footer"><div class="character-experience"><div><span data-xp-label></span><span data-xp-total></span></div><div class="character-experience-track"><i data-xp-fill></i></div></div><span class="character-footer-status">${uiIcon('diamond')}<span data-allocated-label></span></span></footer>
    </section>`;
    this.window = this.element.querySelector('.character-window')!;
    this.tooltip = new ItemTooltip(this.window, 'character-item-tooltip');
    this.canvas = this.element.querySelector('.character-doll')!;
    this.element.querySelectorAll<HTMLButtonElement>('[data-location]').forEach(cell => this.cells.set(cell.dataset.location!, cell));
    mount.append(this.element);
    this.bind();
  }

  private equipmentMarkup(slot: EquipmentSlot): string {
    return `<div class="character-equipment-cell"><button type="button" class="ui-slot ui-item-slot character-equipment-slot" data-equipment="${slot}" data-location="equipment-${slot}" aria-label="${SLOT_NAMES[slot]}, empty">${emptySlotIcon(slot)}</button><span>${SLOT_NAMES[slot]}</span></div>`;
  }

  open(player: Player): void {
    this.player = player;
    const wasOpen = !this.element.hidden;
    this.element.hidden = false;
    this.refresh(player);
    if (!wasOpen) {
      this.focus = trapDialogFocus(this.window, { signal: this.lifetime.signal, restoreFocus: false, initialFocus: () => this.element.querySelector('[data-close]') });
      this.animate();
    }
  }

  refresh(player: Player): void {
    this.player = player;
    if (this.element.hidden) return;
    for (const cell of this.cells.values()) {
      const location = this.locationFrom(cell)!;
      const item = this.itemAt(location);
      updateItemSlot(cell, item, { level: player.level, draggable: true,
        emptyMarkup: location.type === 'equipment' ? emptySlotIcon(location.slot) : '<span class="ui-empty-item-mark">·</span>',
        label: item ? `${itemDisplayName(item)}, ${TIER_NAMES[item.tier]}, item level ${item.itemLevel}${location.type === 'equipment' ? `, equipped in ${SLOT_NAMES[location.slot]}` : ''}${item.requiredLevel > player.level ? `, requires level ${item.requiredLevel}` : ''}` : location.type === 'equipment' ? `${SLOT_NAMES[location.slot]}, empty` : `Empty inventory slot ${location.index + 1}`,
      });
    }
    const sheet = player.character, stats = player.derived;
    this.text('[data-level]', `Level ${player.level}`);
    this.text('[data-equipped-count]', `${EQUIPMENT_SLOTS.filter(slot => sheet.equipped[slot]).length} / ${EQUIPMENT_SLOTS.length}`);
    this.text('[data-gold]', `${formatGold(goldBalance(sheet))} Gold`);
    this.text('[data-capacity]', `${sheet.inventory.filter(Boolean).length} / ${sheet.inventory.length}`);
    this.text('[data-weapon-name]', sheet.equipped.weapon?.name ?? 'Unarmed');
    this.text('[data-skill-points]', number(sheet.skillPoints));
    this.text('[data-stat-points]', number(sheet.statPoints));
    this.text('[data-points-label]', sheet.statPoints ? `${number(sheet.statPoints)} to assign` : 'All assigned');
    this.text('[data-allocated-label]', `${number(sheet.allocatedNodes.length)} nodes attuned`);
    this.text('[data-xp-label]', `Level ${player.level} → ${player.level + 1}`);
    this.text('[data-xp-total]', `${number(player.xp)} / ${number(xpForNextLevel(player.level))} XP`);
    this.element.querySelector<HTMLElement>('[data-xp-fill]')!.style.width = `${Math.min(100, 100 * player.xp / xpForNextLevel(player.level))}%`;
    for (const attribute of Object.keys(ATTRIBUTE_NAMES) as Attribute[]) {
      this.text(`[data-attribute-value="${attribute}"]`, number(stats.attributes[attribute], 1));
      const button = this.element.querySelector<HTMLButtonElement>(`[data-allocate="${attribute}"]`)!;
      button.disabled = sheet.statPoints <= 0;
      button.dataset.tooltipAlign = 'end';
      button.dataset.tooltip = `Spend 1 attribute point on ${ATTRIBUTE_NAMES[attribute]}`;
    }
    const attack = deriveAttackStats(player.stats, player.equipment.mainHand);
    const offense: Array<[string, string]> = [
      [player.equipment.mainHand.family === 'staff' ? 'Staff damage' : 'Attack damage', number(attack.damage)],
      [player.equipment.mainHand.family === 'staff' ? 'Casts per second' : 'Attacks per second', number(attack.attacksPerSecond, 2)],
      ['Attack speed bonus', percent(stats.attackSpeedMultiplier - 1)],
      ['Spell damage', percent(stats.spellDamageMultiplier)], ['Cast speed bonus', percent(stats.castSpeedMultiplier - 1)],
      ['Critical chance', percent(stats.critChance)], ['Critical damage', percent(stats.critMultiplier)],
    ];
    if (player.equipment.offHand?.kind === 'weapon') {
      const off = deriveAttackStats(player.stats, player.equipment.offHand.weapon);
      offense.splice(2, 0, ['Off-hand damage', number(off.damage)], ['Off-hand attacks / s', number(off.attacksPerSecond, 2)]);
    }
    const groups: Array<{ title: string; tone: string; rows: Array<[string, string]> }> = [
      { title: 'Offense', tone: 'offense', rows: offense },
      { title: 'Defense', tone: 'defense', rows: [
        ['Armor', number(stats.armor)], [`Reduction vs level ${player.level}`, percent(stats.damageReduction)],
        ['Block chance', percent(stats.blockChance)], ['Blocked damage reduction', percent(stats.blockReduction)],
      ] },
      { title: 'Life & mana', tone: 'resources', rows: [
        ['Maximum life', number(stats.maxHp)], ['Life regeneration', `${number(stats.lifeRegeneration, 2)} / s`],
        ['Life on hit', number(stats.lifeOnHit, 1)], ['Maximum mana', number(stats.maxMana)],
        ['Mana regeneration', `${number(stats.manaRegeneration, 2)} / s`],
      ] },
      { title: 'Utility & efficiency', tone: 'utility', rows: [
        ['Movement speed', percent(stats.moveSpeedMultiplier)], ['Mana cost reduction', percent(1 - stats.manaCostMultiplier)],
        ['Cooldown reduction', percent(1 - stats.cooldownMultiplier)],
      ] },
    ];
    const markup = groups.map(group => `<section class="character-stat-group character-stat-group--${group.tone}" aria-labelledby="stats-${group.tone}">
      <h4 id="stats-${group.tone}">${group.title}</h4><dl>${group.rows.map(([label, value]) => `<div class="ui-stat"><dt class="ui-stat-label">${label}</dt><dd class="ui-stat-value">${value}</dd></div>`).join('')}</dl></section>`).join('');
    const statContainer = this.element.querySelector('[data-combat-stats]')!;
    if (statContainer.innerHTML !== markup) statContainer.innerHTML = markup;
    if (this.hovered) this.showTooltip(this.hovered);
  }

  close(): void {
    this.focus?.dispose();
    this.focus = null;
    this.element.hidden = true;
    this.clearDrag();
    this.hideTooltip();
    cancelAnimationFrame(this.animation);
    this.animation = 0;
  }

  dispose(): void { this.close(); this.tooltip.dispose(); this.lifetime.abort(); this.element.remove(); this.player = null; }

  private text(selector: string, value: string): void {
    const element = this.element.querySelector(selector)!;
    if (element.textContent !== value) element.textContent = value;
  }

  private itemAt(location: ItemLocation): Item | null {
    if (!this.player) return null;
    return location.type === 'bag' ? this.player.character.inventory[location.index] ?? null : this.player.character.equipped[location.slot];
  }

  private locationFrom(target: EventTarget | null): ItemLocation | null {
    if (!(target instanceof Element)) return null;
    const cell = target.closest<HTMLElement>('[data-location]');
    if (!cell || !this.element.contains(cell)) return null;
    if (cell.dataset.bag !== undefined) return { type: 'bag', index: Number(cell.dataset.bag) };
    const slot = cell.dataset.equipment as EquipmentSlot;
    return EQUIPMENT_SLOTS.includes(slot) ? { type: 'equipment', slot } : null;
  }

  private activate(location: ItemLocation): void {
    if (location.type === 'bag') this.actions.equip(location.index);
    else this.actions.unequip(location.slot);
  }

  private bind(): void {
    const options = { signal: this.lifetime.signal };
    this.element.addEventListener('click', event => {
      const target = event.target as Element;
      if (target.closest('[data-close]')) { this.actions.close(); return; }
      const turn = target.closest<HTMLElement>('[data-turn]');
      if (turn) { this.facing += Number(turn.dataset.turn) * Math.PI / 4; return; }
      const attribute = target.closest<HTMLElement>('[data-allocate]')?.dataset.allocate as Attribute | undefined;
      if (attribute && Object.hasOwn(ATTRIBUTE_NAMES, attribute)) { this.actions.allocate(attribute); return; }
      const location = this.locationFrom(target);
      if (!location) return;
      const item = this.itemAt(location);
      if (item && event.shiftKey) { this.hideTooltip(); this.activate(location); return; }
      if (item) this.showTooltip(location);
      else this.hideTooltip();
    }, options);
    this.element.addEventListener('pointerover', event => {
      if (event.pointerType === 'touch' || this.drag) return;
      const location = this.locationFrom(event.target);
      if (location) this.showTooltip(location);
    }, options);
    this.element.addEventListener('pointerout', event => {
      const from = this.locationFrom(event.target), to = this.locationFrom(event.relatedTarget);
      if (from && (!to || locationKey(from) !== locationKey(to))) this.hideTooltip();
    }, options);
    this.element.addEventListener('focusin', event => {
      const location = this.locationFrom(event.target);
      if (location) this.showTooltip(location);
      else this.hideTooltip();
    }, options);
    this.element.addEventListener('focusout', event => {
      if (!this.locationFrom(event.relatedTarget)) this.hideTooltip();
    }, options);
    this.element.addEventListener('keydown', event => {
      const location = this.locationFrom(event.target);
      if (!location || location.type !== 'bag' || event.altKey || event.ctrlKey || event.metaKey) return;
      let next = location.index;
      if (event.key === 'ArrowRight') next = Math.min(INVENTORY_CAPACITY - 1, next + 1);
      else if (event.key === 'ArrowLeft') next = Math.max(0, next - 1);
      else if (event.key === 'ArrowDown') next = Math.min(INVENTORY_CAPACITY - 1, next + 8);
      else if (event.key === 'ArrowUp') next = Math.max(0, next - 8);
      else if (event.key === 'Home') next -= next % 8;
      else if (event.key === 'End') next += 7 - next % 8;
      else return;
      event.preventDefault();
      this.cells.get(`bag-${next}`)?.focus();
    }, options);
    this.element.addEventListener('dragstart', event => {
      this.clearDrag();
      const location = this.locationFrom(event.target), item = location && this.itemAt(location);
      if (!location || !item || !event.dataTransfer) { event.preventDefault(); return; }
      this.drag = { ...location, id: item.id };
      event.dataTransfer.setData('application/x-evergrow-item', item.id);
      event.dataTransfer.effectAllowed = 'move';
      this.hideTooltip();
      this.cells.get(locationKey(location))?.classList.add('is-dragging');
    }, options);
    this.element.addEventListener('dragover', event => {
      const target = this.locationFrom(event.target);
      if (!target || !this.canDrop(target)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      this.clearDropHighlight();
      this.cells.get(locationKey(target))?.classList.add('is-drop-target');
    }, options);
    this.element.addEventListener('dragleave', event => {
      const cell = (event.target as Element).closest('[data-location]');
      if (cell && !cell.contains(event.relatedTarget as Node | null)) cell.classList.remove('is-drop-target');
    }, options);
    this.element.addEventListener('drop', event => {
      const target = this.locationFrom(event.target), source = this.drag;
      const valid = Boolean(source && target && this.canDrop(target) && event.dataTransfer?.getData('application/x-evergrow-item') === source.id);
      this.clearDrag();
      if (!valid || !source || !target) return;
      event.preventDefault();
      if (source.type === 'bag' && target.type === 'equipment') this.actions.equip(source.index, target.slot);
      else if (source.type === 'bag' && target.type === 'bag') this.actions.move(source.index, target.index);
      else if (source.type === 'equipment' && target.type === 'bag') this.actions.unequip(source.slot, target.index);
    }, options);
    this.element.addEventListener('dragend', () => this.clearDrag(), options);
    this.window.addEventListener('scroll', () => this.hideTooltip(), { ...options, capture: true });
    window.addEventListener('resize', () => this.hideTooltip(), options);
    window.addEventListener('blur', () => this.clearDrag(), options);
  }

  private canDrop(target: ItemLocation): boolean {
    const source = this.drag;
    if (!source || locationKey(source) === locationKey(target)) return false;
    const item = this.itemAt(source);
    if (!item || item.id !== source.id) return false;
    if (target.type === 'equipment') return source.type === 'bag' && planEquipmentChange(this.player!.character, item, this.player!.level, { sourceIndex: source.index, slot: target.slot }).ok;
    if (source.type === 'equipment') return !this.itemAt(target);
    return true;
  }

  private clearDropHighlight(): void { for (const cell of this.cells.values()) cell.classList.remove('is-drop-target'); }
  private clearDrag(): void { this.drag = null; for (const cell of this.cells.values()) cell.classList.remove('is-drop-target', 'is-dragging'); }

  private showTooltip(location: ItemLocation): void {
    if (this.drag) return;
    const item = this.itemAt(location), cell = this.cells.get(locationKey(location));
    if (!item || !cell || !this.player) { this.hideTooltip(); return; }
    this.hovered = location;
    this.tooltip.show(item, { sheet: this.player.character, level: this.player.level,
      equipped: location.type === 'equipment', sourceIndex: location.type === 'bag' ? location.index : undefined }, cell);
  }

  private hideTooltip(): void { this.hovered = null; this.tooltip.hide(); }

  private animate = (): void => {
    if (this.element.hidden || !this.player) return;
    const ctx = this.canvas.getContext('2d');
    if (ctx) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const time = reduced ? 3 : performance.now() / 1000;
      drawCharacterPortrait(ctx, this.player, time, this.facing, this.canvas.width, this.canvas.height);
    }
    this.animation = requestAnimationFrame(this.animate);
  };
}
