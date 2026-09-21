import { emptySlotIcon } from './equipment-slot-art.ts';
import { UITooltipStack } from './ui-tooltip-stack.ts';
import type { HUDOptions } from './hud.ts';
import { InventoryHUD } from './inventory-hud.ts';
import { InventoryStats } from './inventory-stats.ts';
import { previewCharmReplacement, charmComparisonCandidates } from './charm-comparison.ts';
import { ITEM_LOCK_ICON } from './item-protection.ts';
import type { DropItemSource } from './drop-item-command.ts';
import { activeCharms, PACK_COLUMNS, PACK_ROWS, PACK_CELLS, INVENTORY_CELLS, CHARM_ROWS, itemFootprint, resolvePackLayout, packOccupancy, footprintCells } from './inventory-grid.ts';
import { itemPackIconSVG, itemIconSVG } from './item-art.ts';
import { itemDisplayName } from './items.ts';
import { itemTooltipMarkup, updateItemSlot, CHANGE_LABELS, PREVIEW_PERCENT } from './item-ui.ts';
import { ItemTooltip } from './item-tooltip.ts';
import { goldBalance } from './wallet.ts';
import { equippedGearPower } from './leaderboard.ts';
import { formatGold } from './currency-format.ts';
import type { Player } from './model.ts';
import type { Attribute, EquipmentSlot, Item, ItemTier, SkillId } from './character-types.ts';
import { matchesInventoryFilter, planBestEquipment, type EquipBestChoice, type InventorySort, type InventoryFilter } from './inventory-tools.ts';
import { GamepadMenu } from './gamepad-menu.ts';
import type { GamepadInput } from './gamepad-input.ts';
import { directionalControl } from './ui-navigation.ts';
import { INVENTORY_CAPACITY, EQUIPMENT_SLOTS, TIER_NAMES, TIER_COLORS } from './items.ts';
import { planEquipmentChange, planInventoryMove } from './inventory.ts';
import { drawCharacterPortrait } from './character-portrait.ts';
import { effectExplanation } from './effect-terms.ts';
import { uiIcon, trapDialogFocus, escapeUI } from './ui-components.ts';
import './inventory-panel.css';

export interface InventoryPanelActions {
  close(): void;
  assignSkill?(slot: number, skill: SkillId | null): void;
  openSkills?(skill?: SkillId | null): void;
  hudOptions?(): HUDOptions;
  editAppearance?():void;
  openCharacter?(): void;
  allocate?(attribute: Attribute, amount: number): void;
  equip(index: number, slot?: EquipmentSlot): void;
  unequip(slot: EquipmentSlot, index?: number): void;
  move(from: number, to: number): void;
  lock?(id: string, locked: boolean): void;
  drop?(source: DropItemSource): void;
  equipBest(choice?: EquipBestChoice): void;
  sort(mode: InventorySort): void;
}


type ItemLocation = { type: 'bag'; index: number; cell?: number } | { type: 'equipment'; slot: EquipmentSlot };
type ItemReference = ItemLocation & { id: string };
const SLOT_NAMES: Record<EquipmentSlot, string> = {
  weapon: 'Main hand', offhand: 'Off hand', head: 'Head', chest: 'Chest', gloves: 'Gloves', legs: 'Legs', boots: 'Boots',
  cloak: 'Cloak', amulet: 'Amulet', ring1: 'Ring I', ring2: 'Ring II',
};
const LEFT_SLOTS: EquipmentSlot[] = ['chest', 'gloves', 'legs', 'boots', 'cloak'];
const RIGHT_SLOTS: EquipmentSlot[] = ['weapon', 'offhand', 'amulet', 'ring1', 'ring2'];
const number = (value: number, decimals = 0) => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: decimals }) : '—';
const locationKey = (location: ItemLocation) => location.type === 'bag' ? location.index < 0 ? `cell-${location.cell}` : `bag-${location.index}` : `equipment-${location.slot}`;


/** Inventory presents one authoritative character sheet; all mutations go through simulation actions. */
export class InventoryPanel {
  readonly element: HTMLDivElement;
  private readonly window: HTMLElement;
  private readonly lifetime = new AbortController();
  private readonly actions: InventoryPanelActions;
  private readonly hud: InventoryHUD | null;
  private readonly stats: InventoryStats;
  private statsVisible = false;
  private focus: ReturnType<typeof trapDialogFocus> | null = null;
  private popupFocus: ReturnType<typeof trapDialogFocus> | null = null;
  private popup: 'sort' | 'weapon' | 'charms' | null = null;
  private comparisonId = '';
  private comparisonRemoved = new Set<string>();
  private popupReturn: HTMLElement | null = null;
  private readonly popupLayer: HTMLElement;
  private player: Player | null = null;
  private hovered: ItemLocation | null = null;
  private drag: ItemReference | null = null;
  private locking = false;
  private dragOffset = { x: 0, y: 0 };
  private dragGrids: Array<{ bounds: DOMRect; first: DOMRect; gap: number; charms: boolean }> | null = null;
  private dropHighlightKey = '';
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
  private readonly inlineExplanations: UITooltipStack;
  private readonly canvas: HTMLCanvasElement;
  private readonly cells = new Map<string, HTMLButtonElement>();

  constructor(mount: HTMLElement, actions: InventoryPanelActions) {
    this.actions = actions;
    this.element = document.createElement('div');
    this.element.className = 'character-overlay inventory-overlay';
    this.element.hidden = true;
    this.element.innerHTML = `<section class="ui-window character-window inventory-window" role="dialog" aria-modal="true" aria-labelledby="character-title">
      <header class="ui-window-header character-header">
        <div class="character-heading"><span class="character-sigil ui-header-emblem" aria-hidden="true">${uiIcon('shield')}</span><h2 class="ui-title" id="character-title">Equipment &amp; inventory</h2></div>
        <div class="character-header-right">${actions.editAppearance?`<button type="button" class="ui-button ui-button--quiet ui-button--icon" data-edit-appearance aria-label="Edit appearance" data-tooltip="Edit appearance" data-tooltip-placement="below" data-tooltip-align="end">${uiIcon('palette')}</button>`:''}<button type="button" class="ui-button ui-button--icon" data-close aria-label="Close inventory">${uiIcon('close')}</button></div>
      </header>
      <nav class="character-controller-nav" aria-label="Controller sections"><kbd>LB</kbd><span data-pad-section="2" hidden>Stats</span><span data-pad-section="0">Equipment</span><span data-pad-section="1">Inventory</span><kbd>RB</kbd><small>A Select · B Back</small></nav>
      <div class="character-columns ui-scroll-area">
        <section class="character-equipment" id="character-section-0" data-section="0" aria-label="Character and equipment">
          <div class="character-doll-stage"><div class="character-orbit" aria-hidden="true"></div><canvas class="character-doll" width="560" height="720" aria-label="Your character wearing the current equipment"></canvas>
            <div class="character-equipment-rail character-equipment-rail--crown">${this.equipmentMarkup('head')}</div>
            <div class="character-equipment-rail character-equipment-rail--left">${LEFT_SLOTS.map(slot => this.equipmentMarkup(slot)).join('')}</div>
            <div class="character-equipment-rail character-equipment-rail--right">${RIGHT_SLOTS.map(slot => this.equipmentMarkup(slot)).join('')}</div>
          </div>
          <dl class="character-portrait-metrics" aria-label="Character level and gear power">
            <div><dt>Level</dt><dd data-level></dd></div>
            <div title="Gear quality from level, base stats, enhancement and affix rolls. Not build DPS or Unique skill power."><dt>Gear power</dt><dd data-gear-power></dd></div>
          </dl>
          <div class="character-portrait-footer"><button class="ui-button ui-button--quiet ui-button--icon" data-turn="-1" aria-label="Turn character left">‹</button><div><span class="character-portrait-label">Equipped weapon</span><strong data-weapon-name></strong></div><button class="ui-button ui-button--quiet ui-button--icon" data-turn="1" aria-label="Turn character right">›</button></div>
        </section>
        <section class="character-inventory inventory-pack" id="character-section-1" data-section="1" aria-labelledby="inventory-title">
          <div class="character-section-title character-inventory-heading"><h3 id="inventory-title">Inventory</h3><div class="character-heading-actions">
            <button type="button" class="ui-button ui-button--quiet ui-button--icon character-tool-icon" data-sort-filter aria-label="Filter inventory" aria-haspopup="dialog" aria-expanded="false" aria-controls="inventory-sort-dialog" data-tooltip="Filter inventory" data-tooltip-placement="below">${uiIcon('sortFilter')}</button>
            <button type="button" class="ui-button ui-button--quiet ui-button--icon character-tool-icon" data-equip-best aria-label="Equip best items" data-tooltip="Equip best items" data-tooltip-placement="below">${uiIcon('equipBest')}</button>
            ${actions.lock ? `<button type="button" class="ui-button ui-button--quiet ui-button--icon character-tool-icon" data-lock-mode aria-pressed="false" aria-label="Lock items" data-tooltip="Lock items: click a piece to protect it from selling or dropping. L on a focused item also toggles its lock." data-tooltip-placement="below">${ITEM_LOCK_ICON}</button>` : ''}
            ${actions.drop ? `<span class="character-ground-drop" data-ground-drop role="img" tabindex="0" aria-label="Drag an item here to drop it on the ground" data-tooltip="Drag an item here to drop it on the ground." data-tooltip-placement="below">${uiIcon('dropItem')}</span>` : ''}
          </div><div class="character-inventory-counts"><span class="character-gold" data-gold></span></div></div>
          <div class="character-pack-toolbar"><button type="button" class="ui-button character-auto-sort" data-sort="compact">${uiIcon('sortFilter')} Auto-sort</button><div class="character-sort-options" role="group" aria-label="Sort inventory">${(['type', 'rarity', 'recent'] as const).map(mode => `<button type="button" class="ui-button ui-button--quiet" data-sort="${mode}">${mode === 'type' ? 'Type' : mode === 'rarity' ? 'Rarity' : 'Recent'}</button>`).join('')}</div></div>
          <div class="character-grid-scroll ui-item-grid-scroll">
            <div class="character-bag character-tetris" role="group" aria-label="Inventory, ${PACK_COLUMNS} columns by ${PACK_ROWS} rows">
              ${Array.from({ length: PACK_CELLS }, (_, cell) => `<button type="button" class="character-grid-cell" data-cell="${cell}" data-location="cell-${cell}" style="grid-column:${cell % PACK_COLUMNS + 1};grid-row:${Math.floor(cell / PACK_COLUMNS) + 1}" aria-label="Pack row ${Math.floor(cell / PACK_COLUMNS) + 1}, column ${cell % PACK_COLUMNS + 1}"></button>`).join('')}
              ${Array.from({ length: INVENTORY_CAPACITY }, (_, index) => `<button type="button" class="ui-slot ui-item-slot character-bag-slot" data-bag="${index}" data-location="bag-${index}" hidden></button>`).join('')}
              <div class="character-pack-placement" hidden aria-hidden="true"></div>
            </div>
            <section class="character-charms" aria-label="Active charms"><header><span>${uiIcon('diamond')} Charms<button type="button" class="ui-help-icon" aria-label="About charms" aria-expanded="false" data-ui-term="charms">?</button></span><button type="button" class="ui-button ui-button--quiet" data-compare-charms>Compare</button></header><div class="character-charm-grid character-tetris" role="group" aria-label="Active charms, ${PACK_COLUMNS} columns by ${CHARM_ROWS} rows">${Array.from({length: PACK_COLUMNS * CHARM_ROWS}, (_,i) => `<button type="button" class="character-grid-cell" data-cell="${PACK_CELLS+i}" data-location="cell-${PACK_CELLS+i}" style="grid-column:${i%PACK_COLUMNS+1};grid-row:${Math.floor(i/PACK_COLUMNS)+1}" aria-label="Charm row ${Math.floor(i/PACK_COLUMNS)+1}, column ${i%PACK_COLUMNS+1}"></button>`).join('')}</div></section>
            <section class="character-overflow" hidden><header>Pack overflow <small>Make space to carry these items</small></header><div class="character-overflow-items"></div></section>
          </div>
          <p class="character-filter-status" data-filter-status role="status" hidden></p>
        </section>
      </div>
      <footer class="ui-window-footer character-footer">${actions.openCharacter ? `<button type="button" class="ui-button ui-button--quiet" data-open-character>${uiIcon('character')} Character stats</button>` : ''}</footer>
      <div class="character-popup-layer" data-popup-layer hidden>
        <section class="character-mini-dialog character-filter-dialog ui-window" id="inventory-sort-dialog" data-mini="sort" role="dialog" aria-modal="true" aria-labelledby="inventory-sort-title" hidden>
          <header class="ui-window-header"><div class="character-filter-title">${uiIcon('sortFilter')}<h3 id="inventory-sort-title">Filter inventory</h3></div><button type="button" class="ui-button ui-button--quiet ui-button--icon" data-popup-close aria-label="Close filters">${uiIcon('close')}</button></header>
          <div class="character-filter-body ui-scroll-area">
            <fieldset class="character-filter-group"><legend>Item type</legend><div class="character-filter-grid">
              ${(['all', 'weapons', 'armor', 'jewelry', 'offhand', 'charms'] as const).map(filter => `<button type="button" class="ui-button ui-button--quiet character-filter-choice" data-filter="${filter}" aria-pressed="${filter === 'all'}">${uiIcon(({all:'inventory',weapons:'sword',armor:'armor',jewelry:'jewelry',offhand:'shield',charms:'diamond'} as const)[filter])}<span>${filter === 'offhand' ? 'Off-hand' : filter[0].toUpperCase() + filter.slice(1)}</span><span class="character-filter-check">${uiIcon('check')}</span></button>`).join('')}
            </div></fieldset>
            <fieldset class="character-filter-group"><legend>Rarity</legend><div class="character-filter-grid">
              <button type="button" class="ui-button ui-button--quiet character-filter-choice character-filter-all" data-rarity="all" aria-pressed="true">All rarities<span class="character-filter-check">${uiIcon('check')}</span></button>
              ${Object.entries(TIER_NAMES).map(([tier, name]) => `<button type="button" class="ui-button ui-button--quiet character-filter-choice" data-rarity="${tier}" aria-pressed="false" style="--filter-color:${TIER_COLORS[tier as ItemTier]}"><i class="character-filter-gem" aria-hidden="true"></i><span>${name}</span><span class="character-filter-check">${uiIcon('check')}</span></button>`).join('')}
            </div></fieldset>
          </div>
          <footer class="ui-window-footer"><button type="button" class="ui-button ui-button--quiet" data-clear-filters>Clear filters</button><button type="button" class="ui-button" data-popup-close>Done</button></footer>
        </section>
        <section class="character-mini-dialog ui-well" data-mini="weapon" role="alertdialog" aria-modal="true" aria-labelledby="inventory-weapon-title" aria-describedby="inventory-weapon-warning" hidden>
          <header><h3 id="inventory-weapon-title">Change weapon type?</h3></header>
          <p data-weapon-comparison></p><p id="inventory-weapon-warning">Some skills require a specific weapon type. Changing weapons may disable them.</p>
          <div class="character-weapon-choices"><button type="button" class="ui-button ui-button--primary" data-best-choice="replace">Equip anyway</button><button type="button" class="ui-button" data-best-choice="keep">Keep current weapon only</button><button type="button" class="ui-button ui-button--quiet" data-popup-close>Cancel</button></div>
        </section>
        <section class="character-mini-dialog character-charm-dialog ui-well" data-mini="charms" role="dialog" aria-modal="true" aria-labelledby="charm-comparison-title" hidden>
          <header><h3 id="charm-comparison-title">Compare charms</h3><button type="button" class="ui-button ui-button--quiet ui-button--icon" data-popup-close aria-label="Close comparison">${uiIcon('close')}</button></header>
          <div data-charm-comparison></div>
        </section>
      </div>
    </section>`;
    this.element.style.setProperty('--pack-columns', String(PACK_COLUMNS));
    this.window = this.element.querySelector('.character-window')!;
    this.stats = new InventoryStats(this.window.querySelector('.character-columns')!, this.window, actions.allocate, () => this.hideTooltip());
    const statsToggle = document.createElement('button');
    statsToggle.type = 'button'; statsToggle.className = 'inventory-stats-toggle';
    statsToggle.dataset.toggleStats = ''; statsToggle.setAttribute('aria-expanded', 'false');
    statsToggle.setAttribute('aria-controls', 'inventory-stats');
    statsToggle.innerHTML = '<span class="inventory-stats-toggle-arrow" aria-hidden="true">‹</span><span class="inventory-stats-toggle-label">Stats</span>';
    this.window.prepend(statsToggle);
    statsToggle.addEventListener('click', () => this.toggleStats(), { signal: this.lifetime.signal });
    this.element.querySelector('[data-open-character]')?.addEventListener('click', () => actions.openCharacter?.(), { signal: this.lifetime.signal });
    this.popupLayer = this.element.querySelector('[data-popup-layer]')!;
    this.window.dataset.touchTab = 'bag';
    const tabs = document.createElement('nav'); tabs.className = 'character-tabs touch-only'; tabs.setAttribute('aria-label','Character sections');
    tabs.innerHTML = '<button class="ui-button" data-touch-tab="bag" aria-pressed="true">Bag</button><button class="ui-button" data-touch-tab="equipment" aria-pressed="false">Equipment</button>';
    this.window.querySelector('.character-header-right')!.before(tabs);
    this.sheet = document.createElement('section'); this.sheet.className = 'touch-item-sheet'; this.sheet.hidden = true;
    this.sheet.setAttribute('aria-label','Selected item'); this.window.append(this.sheet);
    this.inlineExplanations = new UITooltipStack(this.window, effectExplanation, this.window, anchor => !anchor.closest('.ui-tooltip'));
    this.tooltip = new ItemTooltip(this.window, 'character-item-tooltip');
    this.element.querySelector('[data-edit-appearance]')?.addEventListener('click',()=>actions.editAppearance?.());
    this.canvas = this.element.querySelector('.character-doll')!;
    this.element.querySelectorAll<HTMLButtonElement>('[data-location]').forEach(cell => this.cells.set(cell.dataset.location!, cell));
    mount.append(this.element);
    this.hud = actions.assignSkill && actions.openSkills ? new InventoryHUD(this.element, this.window.querySelector('.character-footer')!, {
      options: actions.hudOptions, assign: actions.assignSkill, details: actions.openSkills,
      suspend: () => { this.focus?.dispose(); this.focus = null; this.window.inert = true; this.hideTooltip(); },
      restore: anchor => { this.window.inert = false; if (!this.element.hidden) this.focus = trapDialogFocus(this.element, {
        signal: this.lifetime.signal, restoreFocus: false, initialFocus: anchor,
      }); },
    }) : null;
    if (this.hud) {
      this.element.setAttribute('role', 'dialog'); this.element.setAttribute('aria-modal', 'true');
      this.element.setAttribute('aria-labelledby', 'character-title');
      this.window.removeAttribute('role'); this.window.removeAttribute('aria-modal');
    }
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
      this.focus = trapDialogFocus(this.hud ? this.element : this.window, { signal: this.lifetime.signal, restoreFocus: false,
        initialFocus: () => this.window.querySelector<HTMLButtonElement>('[data-close]') });
      this.animate();
    }
  }

  openTouchTab(tab:'bag'|'equipment'):void {
    this.section=tab==='equipment'?0:1;
    this.window.dataset.touchTab=tab;
    this.updateSectionHighlight();
    for(const button of this.window.querySelectorAll<HTMLElement>('[data-touch-tab]'))
      button.setAttribute('aria-pressed',String(button.dataset.touchTab===tab));
  }

  private toggleStats(): void {
    this.statsVisible = !this.statsVisible;
    this.hideTooltip(); this.controller.clear();
    this.window.classList.toggle('has-stats', this.statsVisible);
    const toggle = this.window.querySelector<HTMLButtonElement>('[data-toggle-stats]')!;
    toggle.setAttribute('aria-expanded', String(this.statsVisible));
    this.element.querySelector<HTMLElement>('[data-pad-section="2"]')!.hidden = !this.statsVisible;
    this.stats.setVisible(this.statsVisible);
    if (this.statsVisible && this.element.classList.contains('is-controller')) this.selectSection(2);
    else if (!this.statsVisible && this.section === 2) { this.section = 1; toggle.focus({ preventScroll: true }); }
    this.updateSectionHighlight(); this.updateScrollFades();
  }

  refresh(player: Player): void {
    this.player = player;
    if (this.element.hidden) return;
    if(this.touchItem && this.itemAt(this.touchItem)?.id !== this.touchItem.id) this.closeTouchItem();
    const layout = resolvePackLayout(player.character), occupied = packOccupancy(player.character.inventory, layout);
    const bag = this.element.querySelector<HTMLElement>('.character-bag')!;
    const overflow = this.element.querySelector<HTMLElement>('.character-overflow-items')!;
    let overflowCount = 0;
    this.cells.clear();
    this.element.querySelectorAll<HTMLButtonElement>('.character-bag-slot').forEach(cell => {
      const index = Number(cell.dataset.bag), item = player.character.inventory[index];
      cell.hidden = !item;
      if (!item) { delete cell.dataset.cell; return; }
      const position = layout[item.id], size = itemFootprint(item);
      const parent = position === undefined ? overflow : position >= PACK_CELLS ? this.element.querySelector<HTMLElement>('.character-charm-grid')! : bag;
      if (cell.parentElement !== parent) parent.append(cell);
      if (position === undefined) { delete cell.dataset.cell; cell.style.gridColumn = `span ${size.width}`; cell.style.gridRow = `span ${size.height}`; overflowCount++; }
      else { cell.dataset.cell = String(position); cell.style.gridColumn = `${position % PACK_COLUMNS + 1} / span ${size.width}`; cell.style.gridRow = `${Math.floor((position >= PACK_CELLS ? position-PACK_CELLS : position) / PACK_COLUMNS) + 1} / span ${size.height}`; }
      cell.style.setProperty('--pack-width', String(size.width)); cell.style.setProperty('--pack-height', String(size.height));
      cell.classList.toggle('is-filtered-out', !matchesInventoryFilter(item, this.filters, this.rarities));
    });
    this.element.querySelector<HTMLElement>('.character-overflow')!.hidden = !overflowCount;
    for (const cell of this.element.querySelectorAll<HTMLButtonElement>('.character-grid-cell')) {
      cell.tabIndex = occupied.has(Number(cell.dataset.cell)) ? -1 : 0;
    }
    this.element.querySelectorAll<HTMLButtonElement>('[data-location]').forEach(cell => {
      if (!cell.hidden) this.cells.set(cell.dataset.location!, cell);
    });
    for (const cell of this.cells.values()) {
      const location = this.locationFrom(cell);
      if (!location) {
        updateItemSlot(cell, null, { level: player.level, emptyMarkup: '<span class="ui-empty-item-mark">·</span>', label: 'Filtered inventory cell' });
        continue;
      }
      if (location.type === 'bag' && location.index < 0) continue;
      const item = this.itemAt(location);
      const reserved = location.type === 'equipment' && location.slot === 'offhand' && player.character.equipped.weapon?.weapon?.hands === 2;
      cell.classList.toggle('is-twohand-reserved', reserved);
      if (reserved) cell.dataset.tooltip = `Both hands hold ${player.character.equipped.weapon!.name}. Equipping an off-hand will stow it.`;
      else delete cell.dataset.tooltip;
      updateItemSlot(cell, item, { level: player.level, draggable: true,
        emptyMarkup: reserved ? `<span class="character-reserved-glyph" aria-hidden="true">${emptySlotIcon('weapon')}</span><span class="character-reserved-label">2H</span>` : location.type === 'equipment' ? emptySlotIcon(location.slot) : '<span class="ui-empty-item-mark">·</span>',
        label: reserved ? `Off-hand reserved by two-handed ${player.character.equipped.weapon!.name}` : item ? `${itemDisplayName(item)}, ${TIER_NAMES[item.tier]}, item level ${item.itemLevel}${location.type === 'equipment' ? `, equipped in ${SLOT_NAMES[location.slot]}` : ''}${item.requiredLevel > player.level ? `, requires level ${item.requiredLevel}` : ''}` : location.type === 'equipment' ? `${SLOT_NAMES[location.slot]}, empty` : `Empty inventory slot ${location.index + 1}`,
      });
      if (item && location.type === 'bag' && cell.dataset.packSignature !== cell.dataset.signature) {
        const size = itemFootprint(item);
        cell.querySelector('svg')?.remove();
        cell.insertAdjacentHTML('afterbegin', itemPackIconSVG(item, size.width, size.height));
        cell.dataset.packSignature = cell.dataset.signature;
      }
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
    const sheet = player.character;
    this.text('[data-level]', number(player.level));
    this.text('[data-gear-power]', number(equippedGearPower(sheet)));
    this.text('[data-gold]', `${formatGold(goldBalance(sheet))} Gold`);
    this.text('[data-weapon-name]', sheet.equipped.weapon?.name ?? 'Unarmed');
    this.stats.refresh(player);
    this.hud?.refresh(player);
    if (this.drag) this.highlightEquipmentTargets();
    if (this.hovered) this.showTooltip(this.hovered);
    this.updateScrollFades();
  }

  private updateScrollFades(): void {
    for (const pane of this.window.querySelectorAll<HTMLElement>('.character-columns')) {
      const remaining = pane.scrollHeight - pane.clientHeight - pane.scrollTop;
      const scrollable = /^(auto|scroll)$/.test(getComputedStyle(pane).overflowY);
      pane.classList.toggle('has-scroll-below', pane.clientHeight > 0 && scrollable && remaining > 2);
    }
  }

  close(): void {
    this.hud?.dismiss(false); this.window.inert = false;
    this.locking=false;this.element.classList.remove('is-locking-items');this.element.querySelector('[data-lock-mode]')?.setAttribute('aria-pressed','false');
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

  dispose(): void { this.close(); this.hud?.dispose(); this.stats.dispose(); this.tooltip.dispose(); this.inlineExplanations.dispose(); this.lifetime.abort(); this.element.remove(); this.player = null; }

  private renderCharmComparison(): void {
    if(!this.player)return;
    const {character:sheet,level}=this.player,candidates=charmComparisonCandidates(sheet,level),active=activeCharms(sheet,level);
    if(!candidates.some(i=>i.id===this.comparisonId))this.comparisonId=candidates[0]?.id??'';
    const root=this.element.querySelector<HTMLElement>('[data-charm-comparison]')!;
    if(!candidates.length){root.innerHTML='<p class="ui-muted">Store a spare charm at a storage chest to compare it with your active stones.</p>';return;}
    const candidate=candidates.find(i=>i.id===this.comparisonId)!;
    const preview=previewCharmReplacement(sheet,level,this.comparisonId,[...this.comparisonRemoved]);
    root.innerHTML=`<label class="charm-candidate-label">Incoming stone<select class="ui-button" data-charm-candidate>${candidates.map(i=>`<option value="${escapeUI(i.id)}" ${i.id===this.comparisonId?'selected':''}>${escapeUI(itemDisplayName(i))} · Lv ${i.itemLevel}</option>`).join('')}</select></label>
      <div class="charm-candidate-summary">${itemIconSVG(candidate,64)}<div>${itemTooltipMarkup(candidate,{sheet,level,sourceIndex:sheet.inventory.findIndex(i=>i?.id===candidate.id)})}</div></div>
      <p class="ui-muted">Select active stones to replace. Exchange stored stones at a storage chest.</p>
      <div class="charm-compare-stones">${active.map(i=>`<button type="button" class="ui-button" data-compare-remove="${escapeUI(i.id)}" aria-pressed="${this.comparisonRemoved.has(i.id)}" aria-label="Replace ${escapeUI(itemDisplayName(i))}">${itemIconSVG(i,32)}<span>${escapeUI(itemDisplayName(i))}</span></button>`).join('')}</div>
      <div class="charm-net-changes" aria-live="polite">${preview.ok?`<h4>Net change</h4>${preview.changes.length?`<table>${preview.changes.map(c=>{const delta=(c.after-c.before)*(PREVIEW_PERCENT.has(c.key)?100:1);return `<tr><th>${escapeUI(CHANGE_LABELS[c.key])}</th><td class="${delta>0?'is-gain':'is-loss'}">${delta>0?'+':''}${number(delta,2)}${PREVIEW_PERCENT.has(c.key)?'%':''}</td></tr>`;}).join('')}</table>`:'<p>No stat change.</p>'}`:`<p class="is-loss">${escapeUI(preview.message)}</p>`}</div>`;
  }

  private popupPanel(): HTMLElement { return this.popupLayer.querySelector<HTMLElement>(`[data-mini="${this.popup}"]`)!; }

  private openPopup(kind: 'sort' | 'weapon' | 'charms', anchor: HTMLElement): void {
    this.hud?.dismiss();
    this.hud?.setInert(true);
    this.closeTouchItem(); this.hideTooltip(); this.clearDrag(); this.controller.clear();
    this.focus?.dispose(); this.focus = null;
    this.popup = kind; this.popupReturn = anchor;
    this.popupLayer.hidden = false;
    this.popupLayer.classList.toggle('is-confirmation', kind !== 'sort');
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
      initialFocus: () => panel.querySelector(kind === 'weapon' ? '[data-best-choice="keep"]' : kind === 'charms' ? '[data-charm-candidate]' : '[data-filter]') });
  }

  dismissPopup(restoreFocus = true): boolean {
    if (this.hud?.dismiss(restoreFocus)) return true;
    if (!this.popup) return false;
    this.hud?.setInert(false);
    this.popupFocus?.dispose(); this.popupFocus = null;
    this.popup = null; this.popupLayer.hidden = true; this.controller.clear();
    for (const child of this.window.children) if (child instanceof HTMLElement && child !== this.popupLayer) child.inert = false;
    this.element.querySelector('[data-sort-filter]')!.setAttribute('aria-expanded', 'false');
    if (restoreFocus && !this.element.hidden) this.focus = trapDialogFocus(this.hud ? this.element : this.window, {
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
    if (this.hud?.pickerOpen) { this.controller.update(this.hud.picker, pad, now); return; }
    if (this.popup) { this.controller.update(this.popupPanel(), pad, now); return; }
    this.controller.update(this.window, pad, now, {
      includeControl: target => this.inNavigationSection(target),
      switchTab: delta => {
        const sections = this.statsVisible ? [2, 0, 1] : [0, 1];
        this.selectSection(sections[(sections.indexOf(this.section) + delta + sections.length) % sections.length]);
      },
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
      : root.querySelector<HTMLElement>('[data-bag]:not([hidden]), [data-equipment="weapon"]')
        ?? root.querySelector<HTMLElement>('button:not(:disabled), [tabindex="0"]');
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
    const owner = target.closest<HTMLElement>('[data-mini], [data-section], .character-header-right, .character-footer, .inventory-stats-toggle');
    if (!owner) return false;
    const popup = owner.hasAttribute('data-mini');
    const root = popup ? owner : this.window;
    const controls = [...root.querySelectorAll<HTMLElement>('button, [tabindex]')]
      .filter(control => control.tabIndex >= 0 && !control.closest('[hidden], [inert]') && !control.matches(':disabled') && control.getClientRects().length > 0
        && (popup || this.inNavigationSection(control)));
    const current = controls.indexOf(target);
    if (current < 0) return false;
    const next = directionalControl(controls.map(control => control.getBoundingClientRect()), current, key);
    { controls[next].focus({ preventScroll: true }); controls[next].scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    return true;
  }

  private inNavigationSection(target: HTMLElement): boolean {
    return !!target.closest('.character-header-right, .character-footer, .inventory-stats-toggle') || target.closest<HTMLElement>('[data-section]')?.dataset.section === String(this.section);
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
    if (cell.dataset.bag !== undefined) return { type: 'bag', index: Number(cell.dataset.bag), cell: cell.dataset.cell === undefined ? undefined : Number(cell.dataset.cell) };
    if (cell.dataset.cell !== undefined) return { type: 'bag', index: -1, cell: Number(cell.dataset.cell) };
    const slot = cell.dataset.equipment as EquipmentSlot;
    return EQUIPMENT_SLOTS.includes(slot) ? { type: 'equipment', slot } : null;
  }

  private activate(location: ItemLocation): void {
    const item=this.itemAt(location);
    if(this.locking&&item&&this.actions.lock){this.actions.lock(item.id,!item.locked);return;}
    if (this.itemAt(location)?.kind === 'charm') return;
    if (location.type === 'bag') this.actions.equip(location.index);
    else this.actions.unequip(location.slot);
  }

  private bind(): void {
    const options = { signal: this.lifetime.signal };
    // Pane sizes change with responsive tabs; content sizes change with gear and fonts.
    const scrollFadeObserver = new ResizeObserver(() => this.updateScrollFades());
    this.window.querySelectorAll('.character-columns, .character-equipment, .character-inventory')
      .forEach(element => scrollFadeObserver.observe(element));
    this.lifetime.signal.addEventListener('abort', () => scrollFadeObserver.disconnect(), { once: true });
    document.addEventListener('evergrow-input-mode',()=>{this.closeTouchItem();this.hideTooltip();},options);
    this.element.addEventListener('change',event=>{const select=event.target as HTMLSelectElement;if(select.matches('[data-charm-candidate]')){this.comparisonId=select.value;this.renderCharmComparison();this.popupPanel().querySelector<HTMLElement>('[data-charm-candidate]')?.focus();}},options);
    this.element.addEventListener('click', event => {
      const target = event.target as Element;
      // The window also carries data-touch-tab as layout state; only buttons are actions.
      const tab = target.closest<HTMLButtonElement>('button[data-touch-tab]')?.dataset.touchTab;
      if(tab) { this.section = tab==='equipment'?0:1; this.updateSectionHighlight(); this.window.dataset.touchTab = tab; for(const b of this.window.querySelectorAll('[data-touch-tab]')) b.setAttribute('aria-pressed',String((b as HTMLElement).dataset.touchTab===tab)); return; }
      if(target.closest('[data-compare-charms]')) { this.comparisonRemoved.clear(); this.renderCharmComparison(); this.openPopup('charms',target.closest<HTMLElement>('[data-compare-charms]')!); return; }
      const remove=target.closest<HTMLElement>('[data-compare-remove]')?.dataset.compareRemove;
      if(remove){if(this.comparisonRemoved.has(remove))this.comparisonRemoved.delete(remove);else this.comparisonRemoved.add(remove);this.renderCharmComparison();this.popupPanel().querySelectorAll<HTMLElement>('[data-compare-remove]').forEach(b=>{if(b.dataset.compareRemove===remove)b.focus();});return;}
      if(target.closest('[data-lock-mode]')) { this.locking=!this.locking; target.closest('[data-lock-mode]')!.setAttribute('aria-pressed',String(this.locking)); this.element.classList.toggle('is-locking-items',this.locking); this.hideTooltip(); return; }
      const lockLocation=this.locationFrom(target),lockItem=lockLocation&&this.itemAt(lockLocation);
      if(this.locking&&lockItem&&this.actions.lock){this.actions.lock(lockItem.id,!lockItem.locked);return;}
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
      const location = this.locationFrom(target);
      if (!location) return;
      if(document.documentElement.classList.contains('touch-mode')) {
        if(this.touchMoving && this.touchItem) {
          this.drag = this.touchItem;
          if(this.canDrop(location)) {
            const source = this.touchItem; this.closeTouchItem(); this.clearDrag();
            if(source.type==='bag' && location.type==='bag') this.actions.move(source.index,location.cell!);
            else if(source.type==='bag' && location.type==='equipment') this.actions.equip(source.index,location.slot);
            else if(source.type==='equipment' && location.type==='bag') this.actions.unequip(source.slot,location.cell!);
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
      if(this.locking||document.documentElement.classList.contains('touch-mode')) return;
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
      if (from && (!to || locationKey(from) !== locationKey(to))) { this.hovered = null; this.tooltip.defer(); }
    }, options);
    this.element.addEventListener('focusin', event => {
      const section = (event.target as Element).closest<HTMLElement>('[data-section]');
      if (section) {
        this.section = Number(section.dataset.section); this.sectionFocus.set(this.section, event.target as HTMLElement); this.updateSectionHighlight();
      }
      const location = this.locationFrom(event.target);
      if (location) this.showTooltip(location);
      else { this.tooltip.defer(); }
    }, options);
    this.element.addEventListener('focusout', event => {

      if (!this.locationFrom(event.relatedTarget)) { this.hovered = null; this.tooltip.defer(); }
    }, options);
    this.element.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.dismissPopup()) { event.preventDefault(); event.stopPropagation(); return; }
      if (event.isTrusted) this.element.classList.remove('is-controller');
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const location = this.locationFrom(event.target);
      if(location&&event.key.toLowerCase()==='l'&&this.actions.lock){const item=this.itemAt(location);if(item&&!event.repeat)this.actions.lock(item.id,!item.locked);event.preventDefault();return;}
      if (location && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault(); if (!event.repeat && this.itemAt(location)) { this.hideTooltip(); this.activate(location); } return;
      }
      if (location?.type === 'bag' && (event.key === 'Home' || event.key === 'End')) {
        const cells = [...this.cells.values()].filter(cell => cell.dataset.bag !== undefined && !cell.hidden);
        const index = cells.indexOf(event.target as HTMLButtonElement), start = index - index % PACK_COLUMNS;
        event.preventDefault(); cells[event.key === 'Home' ? start : Math.min(start + PACK_COLUMNS - 1, cells.length - 1)]?.focus(); return;
      }
      if (event.key.startsWith('Arrow') && this.navigate(event.key, event.target as HTMLElement)) event.preventDefault();
    }, options);
    this.element.addEventListener('dragstart', event => {
      this.clearDrag();
      const location = this.locationFrom(event.target), item = location && this.itemAt(location);
      if (!location || !item || !event.dataTransfer) { event.preventDefault(); return; }
      this.drag = { ...location, id: item.id };
      const sourceCell = this.cells.get(locationKey(location))!;
      if (location.type === 'bag') {
        const bounds = sourceCell.getBoundingClientRect(), size = itemFootprint(item);
        this.dragOffset = { x: Math.min(size.width - 1, Math.max(0, Math.floor((event.clientX - bounds.left) / (bounds.width / size.width)))),
          y: Math.min(size.height - 1, Math.max(0, Math.floor((event.clientY - bounds.top) / (bounds.height / size.height)))) };
      }
      event.dataTransfer.setData('application/x-evergrow-item', item.id);
      event.dataTransfer.effectAllowed = 'move';
      this.hideTooltip();
      this.cells.get(locationKey(location))?.classList.add('is-dragging');
      this.highlightEquipmentTargets();
      this.prepareDragGrids();
      this.element.classList.add('is-item-dragging');
    }, options);
    const updateDropPreview = (event: DragEvent) => {
      if ((event.target as Element).closest('[data-ground-drop]')) {
        const valid = !!this.actions.drop && !!this.drag && this.itemAt(this.drag)?.id === this.drag.id && !this.itemAt(this.drag)?.locked;
        if (event.dataTransfer) event.dataTransfer.dropEffect = valid ? 'move' : 'none';
        if (valid) event.preventDefault();
        const key = `ground:${valid}`;
        if (this.dropHighlightKey === key) return;
        this.clearDropHighlight(); this.dropHighlightKey = key;
        if (valid) this.element.querySelector('[data-ground-drop]')?.classList.add('is-drop-target');
        return;
      }
      const target = this.dragLocation(event);
      const valid = !!target && this.canDrop(target);
      if (event.dataTransfer) event.dataTransfer.dropEffect = valid ? 'move' : 'none';
      if (valid) event.preventDefault();
      // Native dragover also repeats over the same cell. Keep its preview in place
      // instead of hiding/reinserting it and forcing layout on every event.
      const key = target ? `${locationKey(target)}:${valid}` : '';
      if (this.dropHighlightKey === key) return;
      this.clearDropHighlight(); this.dropHighlightKey = key;
      if (target?.type === 'bag' && target.cell !== undefined && target.cell >= 0 && this.drag) {
        const item = this.itemAt(this.drag);
        if (item) {
          const preview = this.element.querySelector<HTMLElement>('.character-pack-placement')!, size = itemFootprint(item);
          const grid = target.cell >= PACK_CELLS ? this.element.querySelector<HTMLElement>('.character-charm-grid')! : this.element.querySelector<HTMLElement>('.character-bag')!;
          if (preview.parentElement !== grid) grid.append(preview);
          preview.hidden = false; preview.classList.toggle('is-invalid', !valid);
          preview.style.left = `calc(3px + ${target.cell % PACK_COLUMNS} * (var(--pack-cell) + var(--pack-gap)))`;
          preview.style.top = `calc(3px + ${Math.floor((target.cell >= PACK_CELLS ? target.cell-PACK_CELLS : target.cell) / PACK_COLUMNS)} * (var(--pack-cell) + var(--pack-gap)))`;
          preview.style.width = `calc(${size.width} * (var(--pack-cell) + var(--pack-gap)) - var(--pack-gap))`;
          preview.style.height = `calc(${size.height} * (var(--pack-cell) + var(--pack-gap)) - var(--pack-gap))`;
        }
      }
      if (!target || !valid) return;
      if (target.type === 'equipment') this.cells.get(locationKey(target))?.classList.add('is-drop-target');
    };
    this.element.addEventListener('dragenter', updateDropPreview, options);
    this.element.addEventListener('dragover', updateDropPreview, options);
    this.element.addEventListener('dragleave', event => {
      if (!(event.relatedTarget instanceof Node) || !this.element.contains(event.relatedTarget)) this.clearDropHighlight();
    }, options);
    this.element.addEventListener('drop', event => {
      if ((event.target as Element).closest('[data-ground-drop]')) {
        const source = this.drag;
        const valid = source && this.itemAt(source)?.id === source.id && event.dataTransfer?.getData('application/x-evergrow-item') === source.id;
        event.preventDefault(); this.clearDrag();
        if (valid && source) this.actions.drop?.(source);
        return;
      }
      const target = this.dragLocation(event), source = this.drag;
      const valid = Boolean(source && target && this.canDrop(target) && event.dataTransfer?.getData('application/x-evergrow-item') === source.id);
      this.clearDrag();
      if (!valid || !source || !target) return;
      event.preventDefault();
      if (source.type === 'bag' && target.type === 'equipment') this.actions.equip(source.index, target.slot);
      else if (source.type === 'bag' && target.type === 'bag') this.actions.move(source.index, target.cell!);
      else if (source.type === 'equipment' && target.type === 'bag') this.actions.unequip(source.slot, target.cell!);
    }, options);
    this.element.addEventListener('dragend', () => this.clearDrag(), options);
    this.window.addEventListener('scroll', event => {
      if (!(event.target instanceof Element) || !event.target.closest('.ui-tooltip')) { this.hideTooltip(); this.updateScrollFades(); }
    }, { ...options, capture: true, passive: true });
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
    const buttons = item.kind==='charm'||item.kind==='riftKey' ? '' : location.type === 'equipment' ? '<button class="ui-button" data-touch-item="unequip">Unequip</button>' :
      EQUIPMENT_SLOTS.filter(slot=>planEquipmentChange(this.player!.character,item,this.player!.level,{sourceIndex:location.index,slot}).ok)
      .map(slot=>`<button class="ui-button" data-touch-item="equip:${slot}">Equip · ${SLOT_NAMES[slot]}</button>`).join('');
    this.sheet.innerHTML = `<header><strong>Item details</strong><button class="ui-button" data-touch-item="close">Close</button></header><div class="ui-item-tooltip">${itemTooltipMarkup(item,{sheet:this.player.character,level:this.player.level,equipped:location.type==='equipment',sourceIndex:location.type==='bag'?location.index:undefined})}</div><nav>${buttons}<button class="ui-button" data-touch-item="move">Move to slot…</button>${this.actions.drop ? `<button class="ui-button" data-touch-item="drop">${uiIcon('dropItem')} Drop on ground</button>` : ''}</nav>`;
    this.sheet.hidden = false; this.sheet.scrollTop = 0;
  }
  private closeTouchItem() { this.inlineExplanations.hide(); this.window.classList.remove('touch-moving'); this.sheet.hidden = true; this.touchItem = null; this.touchMoving = false; this.clearDrag(); }
  private touchItemAction(action: string) {
    if(action==='close') { this.closeTouchItem(); return; }
    const source = this.touchItem; if(!source || this.itemAt(source)?.id!==source.id) { this.closeTouchItem(); return; }
    if(action==='move') {
      this.touchMoving = true; this.window.classList.add('touch-moving'); this.sheet.innerHTML = '<header><strong>Tap a destination slot</strong><button class="ui-button" data-touch-item="close">Cancel</button></header>';
      this.drag = source; for(const [key,cell] of this.cells) { const location = this.locationFrom(cell); if(location && this.canDrop(location)) this.cells.get(key)?.classList.add('is-drop-target'); } this.drag = null;
      return;
    }
    this.closeTouchItem();
    if(action==='drop') this.actions.drop?.(source);
    if(action==='unequip' && source.type==='equipment') this.actions.unequip(source.slot);
    if(action.startsWith('equip:') && source.type==='bag') this.actions.equip(source.index,action.slice(6) as EquipmentSlot);
  }

  private canDrop(target: ItemLocation): boolean {
    const source = this.drag;
    if (!source || locationKey(source) === locationKey(target)) return false;
    const item = this.itemAt(source);
    if (!item || item.id !== source.id) return false;
    if (target.type === 'equipment') return source.type === 'bag' && planEquipmentChange(this.player!.character, item, this.player!.level, { sourceIndex: source.index, slot: target.slot }).ok;
    if (target.cell === undefined) return false;
    if (source.type === 'equipment') {
      const occupied = packOccupancy(this.player!.character.inventory, resolvePackLayout(this.player!.character));
      return (this.player!.character.inventory.includes(null) || this.player!.character.inventory.length < INVENTORY_CELLS) && (footprintCells(item, target.cell)?.every(n => !occupied.has(n)) ?? false);
    }
    return planInventoryMove(this.player!.character, source.index, target.cell) !== null;
  }

  private prepareDragGrids(): void {
    this.dragGrids = [...this.element.querySelectorAll<HTMLElement>('.character-bag, .character-charm-grid')].map(grid => {
      const charms = grid.classList.contains('character-charm-grid');
      const first = grid.querySelector<HTMLElement>('.character-grid-cell')?.getBoundingClientRect() ?? new DOMRect();
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      return { bounds: grid.getBoundingClientRect(), first, gap, charms };
    });
  }

  private dragLocation(event: DragEvent): ItemLocation | null {
    const target = this.locationFrom(event.target);
    if (target?.type === 'equipment') return target;
    if (!this.dragGrids) this.prepareDragGrids();
    const bag = this.dragGrids?.find(grid =>
      event.clientX >= grid.bounds.left && event.clientX < grid.bounds.right
      && event.clientY >= grid.bounds.top && event.clientY < grid.bounds.bottom
    );
    if (!bag) return null;
    const x = Math.floor((event.clientX - bag.first.left) / (bag.first.width + bag.gap)) - this.dragOffset.x;
    const y = Math.floor((event.clientY - bag.first.top) / (bag.first.height + bag.gap)) - this.dragOffset.y;
    return { type: 'bag', index: -1, cell: x < 0 || y < 0 || x >= PACK_COLUMNS || y >= (bag.charms ? CHARM_ROWS : PACK_ROWS) ? -1 : (bag.charms ? PACK_CELLS : 0) + y * PACK_COLUMNS + x };
  }

  private highlightEquipmentTargets(): void {
    for (const slot of EQUIPMENT_SLOTS) {
      const target: ItemLocation = { type: 'equipment', slot };
      this.cells.get(locationKey(target))?.classList.toggle('is-equip-target', this.canDrop(target));
    }
  }

  private clearDropHighlight(): void {
    this.dropHighlightKey = '';
    this.element.querySelector('[data-ground-drop]')?.classList.remove('is-drop-target');
    for (const cell of this.cells.values()) cell.classList.remove('is-drop-target');
    this.element.querySelector<HTMLElement>('.character-pack-placement')!.hidden = true;
  }
  private clearDrag(): void { this.element.classList.remove('is-item-dragging'); this.clearDropHighlight(); this.drag = null; this.dragOffset = { x: 0, y: 0 }; this.dragGrids = null; for (const cell of this.cells.values()) cell.classList.remove('is-drop-target', 'is-dragging', 'is-equip-target'); }

  private showTooltip(location: ItemLocation): void {
    if (this.drag || document.documentElement.classList.contains('touch-mode')) return;
    const item = this.itemAt(location), cell = this.cells.get(locationKey(location));
    if (!item || !cell || cell.hidden || !this.player) { this.hideTooltip(); return; }
    this.hovered = location;
    this.stats.hideTooltip();
    this.tooltip.show(item, { sheet: this.player.character, level: this.player.level,
      equipped: location.type === 'equipment', sourceIndex: location.type === 'bag' ? location.index : undefined }, cell);
  }

  private hideTooltip(): void { this.stats.hideTooltip(); this.inlineExplanations.hide(); this.hovered = null; this.tooltip.hide(); }

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
    this.hud?.draw(performance.now());
    this.animation = requestAnimationFrame(this.animate);
  };
}
