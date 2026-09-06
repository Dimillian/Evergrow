import { itemDisplayName } from './items.ts';
import { itemTooltipMarkup, updateItemSlot } from './item-ui.ts';
import { ItemTooltip } from './item-tooltip.ts';
import { goldBalance } from './wallet.ts';
import { formatGold } from './currency-format.ts';
import type { Player } from './model.ts';
import type { Attribute, EquipmentSlot, Item, ItemTier } from './character-types.ts';
import { matchesInventoryFilter, inventoryGridSources, planBestEquipment, type EquipBestChoice, type InventorySort, type InventoryFilter } from './inventory-tools.ts';
import { GamepadMenu } from './gamepad-menu.ts';
import type { GamepadInput } from './gamepad-input.ts';
import { directionalControl } from './ui-navigation.ts';
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
  equipBest(choice?: EquipBestChoice): void;
  sort(mode: InventorySort): void;
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
  private popupFocus: ReturnType<typeof trapDialogFocus> | null = null;
  private popup: 'sort' | 'weapon' | null = null;
  private popupReturn: HTMLElement | null = null;
  private readonly popupLayer: HTMLElement;
  private player: Player | null = null;
  private hovered: ItemLocation | null = null;
  private drag: ItemReference | null = null;
  private touchItem: ItemReference | null = null;
  private touchMoving = false;
  private sheet!: HTMLElement;
  private animation = 0;
  private facing = Math.PI / 2;
  private readonly filters = new Set<InventoryFilter>();
  private readonly rarities = new Set<ItemTier>();
  private section = 1;
  private readonly controller = new GamepadMenu();
  private readonly sectionFocus = new Map<number, HTMLElement>();
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
      <nav class="character-controller-nav" aria-label="Controller sections"><kbd>LB</kbd><span data-pad-section="0">Equipment</span><span data-pad-section="1">Inventory</span><span data-pad-section="2">Stats</span><kbd>RB</kbd><small>A Select · B Back</small></nav>
      <div class="character-columns ui-scroll-area">
        <section class="character-equipment" id="character-section-0" data-section="0" aria-labelledby="equipment-title">
          <div class="character-section-title"><h3 id="equipment-title">Equipment</h3><span data-equipped-count></span></div>
          <div class="character-doll-stage"><div class="character-orbit" aria-hidden="true"></div><canvas class="character-doll" width="560" height="720" aria-label="Your character wearing the current equipment"></canvas>
            <div class="character-equipment-rail character-equipment-rail--crown">${this.equipmentMarkup('head')}</div>
            <div class="character-equipment-rail character-equipment-rail--left">${LEFT_SLOTS.map(slot => this.equipmentMarkup(slot)).join('')}</div>
            <div class="character-equipment-rail character-equipment-rail--right">${RIGHT_SLOTS.map(slot => this.equipmentMarkup(slot)).join('')}</div>
          </div>
          <div class="character-portrait-footer"><button class="ui-button ui-button--quiet ui-button--icon" data-turn="-1" aria-label="Turn character left">‹</button><div><span class="character-portrait-label">Equipped weapon</span><strong data-weapon-name></strong></div><button class="ui-button ui-button--quiet ui-button--icon" data-turn="1" aria-label="Turn character right">›</button></div>
          <div class="character-points"><span>${uiIcon('skilltree')}Skill points <strong data-skill-points></strong></span><span>${uiIcon('plus')}Attribute points <strong data-stat-points></strong></span></div>
        </section>
        <section class="character-inventory" id="character-section-1" data-section="1" aria-labelledby="inventory-title">
          <div class="character-section-title character-inventory-heading"><h3 id="inventory-title">Inventory</h3><div class="character-heading-actions">
            <button type="button" class="ui-button ui-button--quiet ui-button--icon character-tool-icon" data-sort-filter aria-label="Sort & filter inventory" aria-haspopup="dialog" aria-expanded="false" aria-controls="inventory-sort-dialog" data-tooltip="Sort & filter" data-tooltip-placement="below">${uiIcon('sortFilter')}</button>
            <button type="button" class="ui-button ui-button--quiet ui-button--icon character-tool-icon" data-equip-best aria-label="Equip best items" data-tooltip="Equip best items" data-tooltip-placement="below">${uiIcon('equipBest')}</button>
          </div><div class="character-inventory-counts"><span class="character-gold" data-gold></span><span data-capacity></span></div></div>
          <div class="character-grid-scroll"><div class="character-bag" role="group" aria-label="Inventory, ${INVENTORY_CAPACITY} slots">${Array.from({ length: INVENTORY_CAPACITY }, (_, index) => `<button type="button" class="ui-slot ui-item-slot character-bag-slot" data-bag="${index}" data-location="bag-${index}" aria-label="Empty inventory slot ${index + 1}"></button>`).join('')}</div></div>
          <p class="character-filter-status" data-filter-status role="status" hidden></p>
        </section>
        <section class="character-details" id="character-section-2" data-section="2" tabindex="0" aria-labelledby="attributes-title">
          <div class="character-attributes"><div class="character-section-title"><h3 id="attributes-title">Attributes</h3><span class="character-points-available" data-points-label></span></div>
            <div class="character-attribute-list">${(Object.keys(ATTRIBUTE_NAMES) as Attribute[]).map(attribute => `<div class="character-attribute"><div><span>${ATTRIBUTE_NAMES[attribute]}</span><small>${ATTRIBUTE_DESCRIPTIONS[attribute]}</small></div><strong data-attribute-value="${attribute}"></strong><button type="button" class="ui-button ui-button--icon character-attribute-add" data-allocate="${attribute}" aria-label="Increase ${ATTRIBUTE_NAMES[attribute]}">${uiIcon('plus')}</button></div>`).join('')}</div>
          </div>
          <div class="character-statistics"><div class="character-section-title character-section-title--secondary"><h3 tabindex="0">Combat details</h3><span>Effective</span></div><div data-combat-stats></div></div>
        </section>
      </div>
      <footer class="ui-window-footer character-footer"><div class="character-experience"><div><span data-xp-label></span><span data-xp-total></span></div><div class="character-experience-track"><i data-xp-fill></i></div></div><span class="character-footer-status">${uiIcon('diamond')}<span data-allocated-label></span></span></footer>
      <div class="character-popup-layer" data-popup-layer hidden>
        <section class="character-mini-dialog ui-well" id="inventory-sort-dialog" data-mini="sort" role="dialog" aria-modal="true" aria-labelledby="inventory-sort-title" hidden>
          <header><h3 id="inventory-sort-title">Sort &amp; filter</h3><button type="button" class="ui-button ui-button--quiet ui-button--icon" data-popup-close aria-label="Close sort and filter">${uiIcon('close')}</button></header>
          <div class="character-tool-row" role="group" aria-label="Sort inventory"><span>Sort</span>${(['rarity', 'type', 'recent'] as const).map(mode => `<button type="button" class="ui-button ui-button--quiet" data-sort="${mode}">${mode === 'rarity' ? 'Rarity' : mode === 'type' ? 'Type' : 'Recent pickup'}</button>`).join('')}</div>
          <div class="character-tool-row" role="group" aria-label="Filter item type"><span>Type</span>${(['all', 'weapons', 'armor', 'jewelry', 'offhand'] as const).map(filter => `<button type="button" class="ui-button ui-button--quiet" data-filter="${filter}" aria-pressed="${filter === 'all'}">${filter === 'offhand' ? 'Off-hand' : filter[0].toUpperCase() + filter.slice(1)}</button>`).join('')}</div>
          <div class="character-tool-row" role="group" aria-label="Filter item rarity"><span>Rarity</span><button type="button" class="ui-button ui-button--quiet" data-rarity="all" aria-pressed="true">All</button>${Object.entries(TIER_NAMES).map(([tier, name]) => `<button type="button" class="ui-button ui-button--quiet" data-rarity="${tier}" aria-pressed="false">${name}</button>`).join('')}</div>
          <button type="button" class="ui-button ui-button--quiet" data-clear-filters>Clear filters</button>
        </section>
        <section class="character-mini-dialog ui-well" data-mini="weapon" role="alertdialog" aria-modal="true" aria-labelledby="inventory-weapon-title" aria-describedby="inventory-weapon-warning" hidden>
          <header><h3 id="inventory-weapon-title">Change weapon type?</h3></header>
          <p data-weapon-comparison></p><p id="inventory-weapon-warning">Some skills require a specific weapon type. Changing weapons may disable them.</p>
          <div class="character-weapon-choices"><button type="button" class="ui-button ui-button--primary" data-best-choice="replace">Equip anyway</button><button type="button" class="ui-button" data-best-choice="keep">Keep current weapon only</button><button type="button" class="ui-button ui-button--quiet" data-popup-close>Cancel</button></div>
        </section>
      </div>
    </section>`;
    this.window = this.element.querySelector('.character-window')!;
    this.popupLayer = this.element.querySelector('[data-popup-layer]')!;
    this.window.dataset.touchTab = 'bag';
    const tabs = document.createElement('nav'); tabs.className = 'character-tabs touch-only'; tabs.setAttribute('aria-label','Character sections');
    tabs.innerHTML = '<button class="ui-button" data-touch-tab="bag" aria-pressed="true">Bag</button><button class="ui-button" data-touch-tab="equipment" aria-pressed="false">Equipment</button><button class="ui-button" data-touch-tab="stats" aria-pressed="false">Stats</button>';
    this.window.querySelector('.character-header-right')!.before(tabs);
    this.sheet = document.createElement('section'); this.sheet.className = 'touch-item-sheet'; this.sheet.hidden = true;
    this.sheet.setAttribute('aria-label','Selected item'); this.window.append(this.sheet);
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
    if(this.touchItem && this.itemAt(this.touchItem)?.id !== this.touchItem.id) this.closeTouchItem();
    const sources = inventoryGridSources(player.character.inventory, this.filters, this.rarities);
    this.cells.clear();
    this.element.querySelectorAll<HTMLButtonElement>('.character-bag-slot').forEach((cell, index) => {
      const source = sources[index];
      cell.disabled = source === null;
      if (source === null) delete cell.dataset.bag;
      else cell.dataset.bag = String(source);
      cell.dataset.location = source === null ? `filtered-${index}` : `bag-${source}`;
    });
    this.element.querySelectorAll<HTMLButtonElement>('[data-location]').forEach(cell => this.cells.set(cell.dataset.location!, cell));
    for (const cell of this.cells.values()) {
      const location = this.locationFrom(cell);
      if (!location) {
        updateItemSlot(cell, null, { level: player.level, emptyMarkup: '<span class="ui-empty-item-mark">·</span>', label: 'Filtered inventory cell' });
        continue;
      }
      const item = this.itemAt(location);
      const reserved = location.type === 'equipment' && location.slot === 'offhand' && player.character.equipped.weapon?.weapon?.hands === 2;
      cell.classList.toggle('is-twohand-reserved', reserved);
      if (reserved) cell.dataset.tooltip = `Both hands hold ${player.character.equipped.weapon!.name}. Equipping an off-hand will stow it.`;
      else delete cell.dataset.tooltip;
      updateItemSlot(cell, item, { level: player.level, draggable: true,
        emptyMarkup: reserved ? `<span class="character-reserved-glyph" aria-hidden="true">${emptySlotIcon('weapon')}</span><span class="character-reserved-label">2H</span>` : location.type === 'equipment' ? emptySlotIcon(location.slot) : '<span class="ui-empty-item-mark">·</span>',
        label: reserved ? `Off-hand reserved by two-handed ${player.character.equipped.weapon!.name}` : item ? `${itemDisplayName(item)}, ${TIER_NAMES[item.tier]}, item level ${item.itemLevel}${location.type === 'equipment' ? `, equipped in ${SLOT_NAMES[location.slot]}` : ''}${item.requiredLevel > player.level ? `, requires level ${item.requiredLevel}` : ''}` : location.type === 'equipment' ? `${SLOT_NAMES[location.slot]}, empty` : `Empty inventory slot ${location.index + 1}`,
      });
    }
    const filtered = this.filters.size > 0 || this.rarities.size > 0;
    const matching = player.character.inventory.filter(item => matchesInventoryFilter(item, this.filters, this.rarities)).length;
    this.text('[data-filter-status]', matching ? `${matching} matching ${matching === 1 ? 'item' : 'items'}` : 'No matching items. Choose All to clear each filter.');
    this.element.querySelector<HTMLElement>('[data-filter-status]')!.hidden = !filtered;
    this.element.querySelector('[data-sort-filter]')!.classList.toggle('has-filter', filtered);
    for (const button of this.element.querySelectorAll<HTMLElement>('[data-filter]'))
      button.setAttribute('aria-pressed', String(button.dataset.filter === 'all' ? !this.filters.size : this.filters.has(button.dataset.filter as InventoryFilter)));
    for (const button of this.element.querySelectorAll<HTMLElement>('[data-rarity]'))
      button.setAttribute('aria-pressed', String(button.dataset.rarity === 'all' ? !this.rarities.size : this.rarities.has(button.dataset.rarity as ItemTier)));
    const active = document.activeElement;
    if (active instanceof HTMLElement && this.element.contains(active) && (active.hidden || active.matches(':disabled'))) this.selectSection(this.section);
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
      [player.equipment.mainHand.attackKind === 'bolt' ? 'Bolt damage' : 'Attack damage', number(attack.damage)],
      [player.equipment.mainHand.attackKind === 'bolt' ? 'Casts per second' : 'Attacks per second', number(attack.attacksPerSecond, 2)],
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
    this.dismissPopup(false);
    this.focus?.dispose();
    this.focus = null;
    this.element.hidden = true;
    this.element.classList.remove('is-controller'); this.controller.clear(); this.sectionFocus.clear();
    this.closeTouchItem();
    this.clearDrag();
    this.hideTooltip();
    cancelAnimationFrame(this.animation);
    this.animation = 0;
  }

  dispose(): void { this.close(); this.tooltip.dispose(); this.lifetime.abort(); this.element.remove(); this.player = null; }

  private popupPanel(): HTMLElement { return this.popupLayer.querySelector<HTMLElement>(`[data-mini="${this.popup}"]`)!; }

  private openPopup(kind: 'sort' | 'weapon', anchor: HTMLElement): void {
    this.closeTouchItem(); this.hideTooltip(); this.clearDrag(); this.controller.clear();
    this.focus?.dispose(); this.focus = null;
    this.popup = kind; this.popupReturn = anchor;
    this.popupLayer.hidden = false;
    this.popupLayer.classList.toggle('is-confirmation', kind === 'weapon');
    for (const child of this.window.children) if (child instanceof HTMLElement && child !== this.popupLayer) child.inert = true;
    for (const panel of this.popupLayer.querySelectorAll<HTMLElement>('[data-mini]')) panel.hidden = panel.dataset.mini !== kind;
    this.element.querySelector('[data-sort-filter]')!.setAttribute('aria-expanded', String(kind === 'sort'));
    const panel = this.popupPanel(), bounds = this.popupLayer.getBoundingClientRect(), button = anchor.getBoundingClientRect();
    const width = panel.offsetWidth, height = panel.offsetHeight;
    const left = kind === 'sort' ? button.right - bounds.left - width : (bounds.width - width) / 2;
    const top = kind === 'sort' ? button.bottom - bounds.top + 6 : (bounds.height - height) / 2;
    panel.style.left = `${Math.max(12, Math.min(left, bounds.width - width - 12))}px`;
    panel.style.top = `${Math.max(12, Math.min(top, bounds.height - height - 12))}px`;
    this.popupFocus = trapDialogFocus(panel, { signal: this.lifetime.signal, restoreFocus: false,
      initialFocus: () => panel.querySelector(kind === 'weapon' ? '[data-best-choice="keep"]' : '[data-sort]') });
  }

  dismissPopup(restoreFocus = true): boolean {
    if (!this.popup) return false;
    this.popupFocus?.dispose(); this.popupFocus = null;
    this.popup = null; this.popupLayer.hidden = true; this.controller.clear();
    for (const child of this.window.children) if (child instanceof HTMLElement && child !== this.popupLayer) child.inert = false;
    this.element.querySelector('[data-sort-filter]')!.setAttribute('aria-expanded', 'false');
    if (restoreFocus && !this.element.hidden) this.focus = trapDialogFocus(this.window, {
      signal: this.lifetime.signal, restoreFocus: false, initialFocus: this.popupReturn ?? undefined,
    });
    this.popupReturn = null;
    return true;
  }

  private requestEquipBest(): void {
    if (!this.player) return;
    this.closeTouchItem();
    this.hideTooltip();
    const plan = planBestEquipment(this.player.character, this.player.level);
    if (!plan.ok || !plan.weaponChange) { this.actions.equipBest(); return; }
    const { current, next } = plan.weaponChange;
    const type = (item: Item) => `${item.weapon!.hands}H ${item.weapon!.family}`;
    this.text('[data-weapon-comparison]', `${itemDisplayName(current)} (${type(current)}) → ${itemDisplayName(next)} (${type(next)})`);
    this.openPopup('weapon', this.element.querySelector('[data-equip-best]')!);
  }

  updateGamepad(pad: GamepadInput, now: number): void {
    if (this.element.hidden) return;
    if (!pad.active) { this.controller.clear(); return; }
    if (!this.element.classList.contains('is-controller')) {
      this.element.classList.add('is-controller'); if (!this.popup) this.selectSection(this.section);
    }
    if (this.popup) { this.controller.update(this.popupPanel(), pad, now); return; }
    const root = this.element.querySelector<HTMLElement>(`[data-section="${this.section}"]`)!;
    this.controller.update(root, pad, now, {
      switchTab: delta => this.selectSection((this.section + delta + 3) % 3),
      activate: target => {
        const location = this.locationFrom(target);
        if (!location) return false;
        if (this.itemAt(location)) { this.hideTooltip(); this.activate(location); }
        return true;
      },
    });
  }

  private selectSection(index: number): void {
    this.section = index;
    const root = this.element.querySelector<HTMLElement>(`[data-section="${index}"]`)!;
    this.updateSectionHighlight();
    const previous = this.sectionFocus.get(index);
    const target = previous && !previous.closest('[hidden], [inert]') && !previous.matches(':disabled') ? previous
      : root.querySelector<HTMLElement>('[data-bag]:not([hidden]), [data-equipment="weapon"], [data-allocate]:not(:disabled), h3[tabindex]')
        ?? root.querySelector<HTMLElement>('button:not(:disabled)');
    target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.updateSectionHighlight();
  }

  private updateSectionHighlight(): void {
    for (const label of this.element.querySelectorAll<HTMLElement>('[data-pad-section]'))
      label.setAttribute('aria-current', String(Number(label.dataset.padSection) === this.section));
    for (const section of this.element.querySelectorAll<HTMLElement>('[data-section]'))
      section.classList.toggle('is-selected-section', Number(section.dataset.section) === this.section);
  }

  private navigate(key: string, target: HTMLElement): boolean {
    const root = target.closest<HTMLElement>('[data-mini], [data-section]');
    if (!root) return false;
    const controls = [...root.querySelectorAll<HTMLElement>('button, [tabindex]')]
      .filter(control => !control.closest('[hidden], [inert]') && !control.matches(':disabled') && control.getClientRects().length > 0);
    const current = controls.indexOf(target);
    if (current < 0) return false;
    const next = directionalControl(controls.map(control => control.getBoundingClientRect()), current, key);
    if (next === current && root.dataset.section === '2' && (key === 'ArrowDown' || key === 'ArrowUp'))
      root.scrollBy({ top: key === 'ArrowDown' ? 100 : -100 });
    else { controls[next].focus({ preventScroll: true }); controls[next].scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    return true;
  }

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
    document.addEventListener('evergrow-input-mode',()=>{this.closeTouchItem();this.hideTooltip();},options);
    this.element.addEventListener('click', event => {
      const target = event.target as Element;
      // The window also carries data-touch-tab as layout state; only buttons are actions.
      const tab = target.closest<HTMLButtonElement>('button[data-touch-tab]')?.dataset.touchTab;
      if(tab) { this.section = tab==='equipment'?0:tab==='stats'?2:1; this.updateSectionHighlight(); this.window.dataset.touchTab = tab; for(const b of this.window.querySelectorAll('[data-touch-tab]')) b.setAttribute('aria-pressed',String((b as HTMLElement).dataset.touchTab===tab)); return; }
      const itemAction = target.closest<HTMLElement>('[data-touch-item]');
      if(itemAction) { this.touchItemAction(itemAction.dataset.touchItem!); return; }
      if (target.closest('[data-close]')) { this.actions.close(); return; }
      if (target === this.popupLayer || target.closest('[data-popup-close]')) { this.dismissPopup(); return; }
      if (target.closest('[data-sort-filter]')) { this.openPopup('sort', target.closest<HTMLElement>('[data-sort-filter]')!); return; }
      if (target.closest('[data-equip-best]')) { this.requestEquipBest(); return; }
      const choice = target.closest<HTMLElement>('[data-best-choice]')?.dataset.bestChoice as EquipBestChoice | undefined;
      if (choice) { this.dismissPopup(); this.actions.equipBest(choice); return; }
      if (target.closest('[data-clear-filters]')) { this.filters.clear(); this.rarities.clear(); if (this.player) this.refresh(this.player); return; }
      const sort = target.closest<HTMLElement>('[data-sort]')?.dataset.sort as InventorySort | undefined;
      if (sort) { this.hideTooltip(); this.actions.sort(sort); return; }
      const filter = target.closest<HTMLElement>('[data-filter]')?.dataset.filter as InventoryFilter | 'all' | undefined;
      const rarity = target.closest<HTMLElement>('[data-rarity]')?.dataset.rarity as ItemTier | 'all' | undefined;
      if (filter || rarity) {
        if (filter === 'all') this.filters.clear();
        else if (filter) { if (this.filters.has(filter)) this.filters.delete(filter); else this.filters.add(filter); }
        if (rarity === 'all') this.rarities.clear();
        else if (rarity) { if (this.rarities.has(rarity)) this.rarities.delete(rarity); else this.rarities.add(rarity); }
        this.hideTooltip(); if (this.player) this.refresh(this.player); return;
      }
      const turn = target.closest<HTMLElement>('[data-turn]');
      if (turn) { this.facing += Number(turn.dataset.turn) * Math.PI / 4; return; }
      const attribute = target.closest<HTMLElement>('[data-allocate]')?.dataset.allocate as Attribute | undefined;
      if (attribute && Object.hasOwn(ATTRIBUTE_NAMES, attribute)) { this.actions.allocate(attribute); return; }
      const location = this.locationFrom(target);
      if (!location) return;
      if(document.documentElement.classList.contains('touch-mode')) {
        if(this.touchMoving && this.touchItem) {
          this.drag = this.touchItem;
          if(this.canDrop(location)) {
            const source = this.touchItem; this.closeTouchItem(); this.clearDrag();
            if(source.type==='bag' && location.type==='bag') this.actions.move(source.index,location.index);
            else if(source.type==='bag' && location.type==='equipment') this.actions.equip(source.index,location.slot);
            else if(source.type==='equipment' && location.type==='bag') this.actions.unequip(source.slot,location.index);
          }
          this.drag = null; return;
        }
        this.openTouchItem(location); return;
      }
      const item = this.itemAt(location);
      if (item && event.shiftKey) { this.hideTooltip(); this.activate(location); return; }
      if (item) this.showTooltip(location);
      else this.hideTooltip();
    }, options);
    this.element.addEventListener('dblclick', event => {
      if(document.documentElement.classList.contains('touch-mode')) return;
      const location = this.locationFrom(event.target);
      if (!event.shiftKey && location?.type === 'bag' && this.itemAt(location)) { this.hideTooltip(); this.activate(location); }
    }, options);
    this.element.addEventListener('pointerdown', () => this.element.classList.remove('is-controller'), options);
    this.element.addEventListener('pointerover', event => {
      if (event.pointerType === 'touch' || this.drag || this.element.classList.contains('is-controller')) return;
      const location = this.locationFrom(event.target);
      if (location) this.showTooltip(location);
    }, options);
    this.element.addEventListener('pointerout', event => {
      if (this.element.classList.contains('is-controller')) return;
      const from = this.locationFrom(event.target), to = this.locationFrom(event.relatedTarget);
      if (from && (!to || locationKey(from) !== locationKey(to))) this.hideTooltip();
    }, options);
    this.element.addEventListener('focusin', event => {
      const section = (event.target as Element).closest<HTMLElement>('[data-section]');
      if (section) {
        this.section = Number(section.dataset.section); this.sectionFocus.set(this.section, event.target as HTMLElement); this.updateSectionHighlight();
      }
      const location = this.locationFrom(event.target);
      if (location) this.showTooltip(location);
      else this.hideTooltip();
    }, options);
    this.element.addEventListener('focusout', event => {
      if (!this.locationFrom(event.relatedTarget)) this.hideTooltip();
    }, options);
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.dismissPopup()) { event.preventDefault(); event.stopPropagation(); return; }
      if (event.isTrusted) this.element.classList.remove('is-controller');
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const location = this.locationFrom(event.target);
      if (location && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault(); if (!event.repeat && this.itemAt(location)) { this.hideTooltip(); this.activate(location); } return;
      }
      if (location?.type === 'bag' && (event.key === 'Home' || event.key === 'End')) {
        const cells = [...this.cells.values()].filter(cell => cell.dataset.bag !== undefined && !cell.hidden);
        const index = cells.indexOf(event.target as HTMLButtonElement), start = index - index % 8;
        event.preventDefault(); cells[event.key === 'Home' ? start : Math.min(start + 7, cells.length - 1)]?.focus(); return;
      }
      if (event.key.startsWith('Arrow') && this.navigate(event.key, event.target as HTMLElement)) event.preventDefault();
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
    window.addEventListener('resize', () => { this.hideTooltip(); this.dismissPopup(); }, options);
    window.addEventListener('blur', () => this.clearDrag(), options);
  }

  private openTouchItem(location: ItemLocation) {
    const item = this.itemAt(location); if(!this.player) return;
    this.hideTooltip();
    if(!item) {
      if(location.type === 'equipment' && location.slot === 'offhand' && this.player.equipment.mainHand.hands === 2) {
        this.sheet.innerHTML = '<header><strong>Both hands occupied</strong><button class="ui-button" data-touch-item="close">Close</button></header><p>Your two-handed weapon reserves this hand. Equipping an off-hand item from the bag safely stows the two-handed weapon when there is space.</p>';
        this.sheet.hidden = false;
      }
      return;
    }
    this.touchItem = {...location,id:item.id}; this.touchMoving = false;
    const buttons = location.type === 'equipment' ? '<button class="ui-button" data-touch-item="unequip">Unequip</button>' :
      EQUIPMENT_SLOTS.filter(slot=>planEquipmentChange(this.player!.character,item,this.player!.level,{sourceIndex:location.index,slot}).ok)
      .map(slot=>`<button class="ui-button" data-touch-item="equip:${slot}">Equip · ${SLOT_NAMES[slot]}</button>`).join('');
    this.sheet.innerHTML = `<header><strong>Item details</strong><button class="ui-button" data-touch-item="close">Close</button></header><div class="ui-item-tooltip">${itemTooltipMarkup(item,{sheet:this.player.character,level:this.player.level,equipped:location.type==='equipment',sourceIndex:location.type==='bag'?location.index:undefined})}</div><nav>${buttons}<button class="ui-button" data-touch-item="move">Move to slot…</button></nav>`;
    this.sheet.hidden = false; this.sheet.scrollTop = 0;
  }
  private closeTouchItem() { this.window.classList.remove('touch-moving'); this.sheet.hidden = true; this.touchItem = null; this.touchMoving = false; this.clearDrag(); }
  private touchItemAction(action: string) {
    if(action==='close') { this.closeTouchItem(); return; }
    const source = this.touchItem; if(!source || this.itemAt(source)?.id!==source.id) { this.closeTouchItem(); return; }
    if(action==='move') {
      this.touchMoving = true; this.window.classList.add('touch-moving'); this.sheet.innerHTML = '<header><strong>Tap a destination slot</strong><button class="ui-button" data-touch-item="close">Cancel</button></header>';
      this.drag = source; for(const [key,cell] of this.cells) { const location = this.locationFrom(cell); if(location && this.canDrop(location)) this.cells.get(key)?.classList.add('is-drop-target'); } this.drag = null;
      return;
    }
    this.closeTouchItem();
    if(action==='unequip' && source.type==='equipment') this.actions.unequip(source.slot);
    if(action.startsWith('equip:') && source.type==='bag') this.actions.equip(source.index,action.slice(6) as EquipmentSlot);
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
    if (this.drag || document.documentElement.classList.contains('touch-mode')) return;
    const item = this.itemAt(location), cell = this.cells.get(locationKey(location));
    if (!item || !cell || cell.hidden || !this.player) { this.hideTooltip(); return; }
    this.hovered = location;
    this.tooltip.show(item, { sheet: this.player.character, level: this.player.level,
      equipped: location.type === 'equipment', sourceIndex: location.type === 'bag' ? location.index : undefined }, cell);
  }

  private hideTooltip(): void { this.hovered = null; this.tooltip.hide(); }

  private animate = (): void => {
    if (this.element.hidden || !this.player) return;
    // Scrolling a focused cell hides its old tooltip; place it again after layout settles.
    if (this.element.classList.contains('is-controller') && !this.hovered) {
      const location = this.locationFrom(document.activeElement);
      if (location && this.itemAt(location)) this.showTooltip(location);
    }
    const ctx = this.canvas.getContext('2d');
    if (ctx) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const time = reduced ? 3 : performance.now() / 1000;
      drawCharacterPortrait(ctx, this.player, time, this.facing, this.canvas.width, this.canvas.height);
    }
    this.animation = requestAnimationFrame(this.animate);
  };
}
