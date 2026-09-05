import type { Player } from './model.ts';
import type { Attribute, EquipmentSlot, Item, ItemTier, StatKey } from './character-types.ts';
import { INVENTORY_CAPACITY, EQUIPMENT_SLOTS, TIER_COLORS, TIER_NAMES, STAT_LABELS, itemModifiers, formatStatValue } from './items.ts';
import { itemFitsSlot } from './inventory.ts';
import { itemIconSVG, outfitFromEquipment } from './item-art.ts';
import { drawHumanoid, getPlayerSwordTip } from './art.ts';
import { playerPose } from './character-pose.ts';
import { deriveAttackStats } from './equipment.ts';
import { xpForNextLevel } from './progression.ts';
import { escapeUI, uiIcon, trapDialogFocus } from './ui-components.ts';
import './inventory-panel.css';

export interface InventoryPanelActions {
  close(): void;
  equip(index: number, slot?: EquipmentSlot): void;
  unequip(slot: EquipmentSlot, index?: number): void;
  move(from: number, to: number): void;
  allocate(attribute: Attribute): void;
}

const TIER_RANK: Readonly<Record<ItemTier, number>> = { common: 1, magic: 2, rare: 3, epic: 4, legendary: 5 };

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
const statValue = formatStatValue;
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
  private readonly tooltip: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly cells = new Map<string, HTMLButtonElement>();

  constructor(mount: HTMLElement, actions: InventoryPanelActions) {
    this.actions = actions;
    this.element = document.createElement('div');
    this.element.className = 'character-overlay';
    this.element.hidden = true;
    this.element.innerHTML = `<section class="ui-window character-window" role="dialog" aria-modal="true" aria-labelledby="character-title">
      <header class="ui-window-header character-header">
        <div class="character-heading"><span class="character-sigil" aria-hidden="true">✧</span><div><p class="ui-kicker">Character & inventory</p><h2 class="ui-title" id="character-title">Wayfarer</h2></div></div>
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
          <div class="character-section-title"><h3 id="inventory-title">Inventory</h3><span data-capacity></span></div>
          <div class="character-grid-scroll"><div class="character-bag" role="group" aria-label="Inventory, ${INVENTORY_CAPACITY} slots">${Array.from({ length: INVENTORY_CAPACITY }, (_, index) => `<button type="button" class="ui-slot character-item-slot character-bag-slot" data-bag="${index}" data-location="bag-${index}" aria-label="Empty inventory slot ${index + 1}"></button>`).join('')}</div></div>
        </section>
        <section class="character-details" aria-labelledby="attributes-title">
          <div class="character-attributes"><div class="character-section-title"><h3 id="attributes-title">Attributes</h3><span class="character-points-available" data-points-label></span></div>
            <div class="character-attribute-list">${(Object.keys(ATTRIBUTE_NAMES) as Attribute[]).map(attribute => `<div class="character-attribute"><div><span>${ATTRIBUTE_NAMES[attribute]}</span><small>${ATTRIBUTE_DESCRIPTIONS[attribute]}</small></div><strong data-attribute-value="${attribute}"></strong><button type="button" class="ui-button ui-button--icon character-attribute-add" data-allocate="${attribute}" aria-label="Increase ${ATTRIBUTE_NAMES[attribute]}">${uiIcon('plus')}</button></div>`).join('')}</div>
          </div>
          <div class="character-statistics"><div class="character-section-title character-section-title--secondary"><h3>Combat details</h3><span>Effective</span></div><div data-combat-stats></div></div>
        </section>
      </div>
      <footer class="ui-window-footer character-footer"><div class="character-experience"><div><span data-xp-label></span><span data-xp-total></span></div><div class="character-experience-track"><i data-xp-fill></i></div></div><span class="character-footer-status">${uiIcon('diamond')}<span data-allocated-label></span></span></footer>
      <div class="ui-tooltip character-item-tooltip" role="tooltip" id="character-item-tooltip" hidden></div>
    </section>`;
    this.window = this.element.querySelector('.character-window')!;
    this.tooltip = this.element.querySelector('.character-item-tooltip')!;
    this.canvas = this.element.querySelector('.character-doll')!;
    this.element.querySelectorAll<HTMLButtonElement>('[data-location]').forEach(cell => this.cells.set(cell.dataset.location!, cell));
    mount.append(this.element);
    this.bind();
  }

  private equipmentMarkup(slot: EquipmentSlot): string {
    return `<div class="character-equipment-cell"><button type="button" class="ui-slot character-item-slot character-equipment-slot" data-equipment="${slot}" data-location="equipment-${slot}" aria-label="${SLOT_NAMES[slot]}, empty">${emptySlotIcon(slot)}</button><span>${SLOT_NAMES[slot]}</span></div>`;
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
      const signature = item ? JSON.stringify(item) : '';
      if (cell.dataset.signature !== signature) {
        cell.dataset.signature = signature;
        cell.innerHTML = item ? `${itemIconSVG(item, 44)}<span class="character-item-level">${item.itemLevel}</span><span class="character-item-tier" aria-hidden="true">${'<i></i>'.repeat(TIER_RANK[item.tier])}</span>` : location.type === 'equipment' ? emptySlotIcon(location.slot) : '<span class="character-empty-mark" aria-hidden="true">·</span>';
        cell.style.setProperty('--item-color', item ? TIER_COLORS[item.tier] : 'var(--ui-silver-dim)');
        cell.dataset.filled = String(Boolean(item));
        cell.dataset.tier = item?.tier ?? '';
        cell.draggable = Boolean(item);
      }
      cell.classList.toggle('is-locked', Boolean(item && item.requiredLevel > player.level));
      cell.setAttribute('aria-label', item ? `${item.name}, ${TIER_NAMES[item.tier]}, item level ${item.itemLevel}${location.type === 'equipment' ? `, equipped in ${SLOT_NAMES[location.slot]}` : ''}${item.requiredLevel > player.level ? `, requires level ${item.requiredLevel}` : ''}` : location.type === 'equipment' ? `${SLOT_NAMES[location.slot]}, empty` : `Empty inventory slot ${location.index + 1}`);
    }
    const sheet = player.character, stats = player.derived;
    this.text('[data-level]', `Level ${player.level}`);
    this.text('[data-equipped-count]', `${EQUIPMENT_SLOTS.filter(slot => sheet.equipped[slot]).length} / ${EQUIPMENT_SLOTS.length}`);
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

  dispose(): void { this.close(); this.lifetime.abort(); this.element.remove(); this.player = null; }

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
    if (target.type === 'equipment') return source.type === 'bag' && itemFitsSlot(item, target.slot) && item.requiredLevel <= this.player!.level;
    if (source.type === 'equipment') return !this.itemAt(target);
    return true;
  }

  private clearDropHighlight(): void { for (const cell of this.cells.values()) cell.classList.remove('is-drop-target'); }
  private clearDrag(): void { this.drag = null; for (const cell of this.cells.values()) cell.classList.remove('is-drop-target', 'is-dragging'); }

  private comparison(item: Item): { slot: EquipmentSlot; item: Item | null } {
    const sheet = this.player!.character;
    const slot = item.kind === 'ring' ? (!sheet.equipped.ring1 ? 'ring1' : !sheet.equipped.ring2 ? 'ring2' : 'ring1') : item.kind === 'shield' ? 'offhand' : item.kind;
    return { slot, item: sheet.equipped[slot] };
  }

  private itemTooltipMarkup(item: Item, location: ItemLocation): string {
    const equipped = location.type === 'equipment';
    const compare = this.comparison(item);
    const requirements = item.requiredLevel > this.player!.level;
    const mods = itemModifiers(item), previous = compare.item ? itemModifiers(compare.item) : {};
    const rows = (Object.entries(mods) as Array<[StatKey, number]>).map(([key, value]) => {
      const delta = value - (previous[key] ?? 0);
      return `<div class="character-item-property"><span>${escapeUI(STAT_LABELS[key])}</span><strong>${statValue(key, value)}</strong>${!equipped && delta ? `<em class="${delta > 0 ? 'is-gain' : 'is-loss'}">${statValue(key, delta)}</em>` : '<em></em>'}</div>`;
    });
    if (!equipped) {
      for (const [key, value] of Object.entries(previous) as Array<[StatKey, number]>) {
        if (mods[key] === undefined && value) rows.push(`<div class="character-item-property is-removed"><span>${escapeUI(STAT_LABELS[key])}</span><strong>—</strong><em class="is-loss">${statValue(key, -value)}</em></div>`);
      }
    }
    let weapon = '';
    if (item.weapon) {
      const delta = item.weapon.damage - (compare.item?.weapon?.damage ?? 0);
      const speedDelta = item.weapon.baseAttacksPerSecond - (compare.item?.weapon?.baseAttacksPerSecond ?? 0);
      const damageLabel = item.weapon.damageType[0].toUpperCase() + item.weapon.damageType.slice(1);
      weapon = `<div class="character-item-weapon"><div><strong>${number(item.weapon.damage)}</strong><span>${damageLabel} damage</span>${!equipped && delta ? `<em class="${delta > 0 ? 'is-gain' : 'is-loss'}">${delta > 0 ? '+' : ''}${number(delta)}</em>` : ''}</div><div><strong>${number(item.weapon.baseAttacksPerSecond, 2)}</strong><span>${item.weapon.family === 'staff' ? 'Casts' : 'Attacks'} / second</span>${!equipped && Math.abs(speedDelta) > .001 ? `<em class="${speedDelta > 0 ? 'is-gain' : 'is-loss'}">${speedDelta > 0 ? '+' : ''}${number(speedDelta, 2)}</em>` : ''}</div></div><p class="character-item-comparison">${item.weapon.hands === 2 ? 'Two-handed' : 'One-handed'} · ${escapeUI(item.weapon.family)} · ${item.weapon.attackKind === 'melee' ? 'Melee sweep' : item.weapon.attackKind === 'arrow' ? 'Arrow shot' : 'Elemental bolt'} · ${number(item.weapon.reach)} reach</p>`;
    }
    if (item.shield) weapon = `<div class="character-item-weapon"><div><strong>${number(item.shield.blockChance)}%</strong><span>Block chance</span></div><div><strong>${number(item.shield.blockReduction)}%</strong><span>Damage blocked</span></div></div><p class="character-item-comparison">Off hand · Shield · Pairs with a one-handed weapon</p>`;
    return `<div class="character-item-heading" style="--item-color:${TIER_COLORS[item.tier]}"><div><span class="character-item-class"><span class="character-rarity-badge" data-tier="${item.tier}"><span aria-hidden="true">${['I', 'II', 'III', 'IV', 'V'][TIER_RANK[item.tier] - 1]}</span>${escapeUI(TIER_NAMES[item.tier])}</span><span>${escapeUI(item.baseName)}</span></span><h4>${escapeUI(item.name)}</h4></div></div>
      <div class="character-item-meta"><span>Item level ${number(item.itemLevel)}</span><span class="${requirements ? 'is-loss' : ''}">Requires level ${number(item.requiredLevel)}</span>${equipped ? '<span class="character-item-equipped">Equipped</span>' : ''}</div>
      ${weapon}<div class="character-item-properties">${rows.join('')}</div>
      ${item.affixes.length ? `<div class="character-item-affixes">${item.affixes.map(affix => escapeUI(affix.name)).join(' · ')}</div>` : ''}
      ${!equipped ? `<div class="character-item-comparison">${compare.item ? `Compared with <span>${escapeUI(compare.item.name)}</span>` : `Empty ${SLOT_NAMES[compare.slot].toLowerCase()} slot`}</div>` : ''}`;
  }

  private showTooltip(location: ItemLocation): void {
    if (this.drag) return;
    const item = this.itemAt(location), cell = this.cells.get(locationKey(location));
    if (!item || !cell) { this.hideTooltip(); return; }
    this.hovered = location;
    this.tooltip.innerHTML = this.itemTooltipMarkup(item, location);
    this.tooltip.hidden = false;
    this.tooltip.style.setProperty('--item-color', TIER_COLORS[item.tier]);
    this.tooltip.dataset.tier = item.tier;
    for (const other of this.cells.values()) other.removeAttribute('aria-describedby');
    cell.setAttribute('aria-describedby', 'character-item-tooltip');
    const bounds = cell.getBoundingClientRect(), viewportWidth = document.documentElement.clientWidth, viewportHeight = document.documentElement.clientHeight;
    const width = this.tooltip.offsetWidth, height = this.tooltip.offsetHeight;
    let left = bounds.right + 12;
    if (left + width > viewportWidth - 12) left = bounds.left - width - 12;
    this.tooltip.style.left = `${Math.max(8, Math.min(viewportWidth - width - 8, left))}px`;
    this.tooltip.style.top = `${Math.max(8, Math.min(viewportHeight - height - 8, bounds.top - 12))}px`;
  }

  private hideTooltip(): void {
    this.hovered = null;
    this.tooltip.hidden = true;
    for (const cell of this.cells.values()) cell.removeAttribute('aria-describedby');
  }

  private animate = (): void => {
    if (this.element.hidden || !this.player) return;
    const ctx = this.canvas.getContext('2d');
    if (ctx) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const time = reduced ? 3 : performance.now() / 1000;
      const pose = playerPose(this.player, time, null, 0);
      pose.angle = this.facing; pose.attackAngle = this.facing; pose.moving = 0;
      pose.hitFlash = 0; pose.impact = 0; pose.cast = 0; pose.dodging = false; pose.dead = false;
      pose.outfit = outfitFromEquipment(this.player.character);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.save(); ctx.translate(280, 500);
      const glow = ctx.createRadialGradient(0, -135, 10, 0, -135, 225);
      glow.addColorStop(0, '#83adc917'); glow.addColorStop(1, '#83adc900');
      ctx.fillStyle = glow; ctx.fillRect(-240, -430, 480, 540);
      ctx.fillStyle = '#02070cb0'; ctx.beginPath(); ctx.ellipse(0, 12, 77, 16, 0, 0, Math.PI * 2); ctx.fill();
      const tip = getPlayerSwordTip(pose);
      // A closer portrait keeps the full blade visible through all eight facings.
      const scale = Math.min(6.8, 240 / Math.max(22, Math.abs(tip.x) + 6),
        460 / Math.max(50, -tip.y + 6), 160 / Math.max(20, tip.y + 6));
      ctx.scale(scale, scale); drawHumanoid(ctx, pose); ctx.restore();
    }
    this.animation = requestAnimationFrame(this.animate);
  };
}
