import { compareCharacterStats, previewEquipmentChange } from './equipment-preview.ts';
import type { Player } from './model.ts';
import type { Item, EquipmentSlot } from './character-types.ts';
import { NPC_NAMES, NPC_COLORS, type TownNPC } from './npcs.ts';
import { npcEmblem } from './npc-art.ts';
import { vendorStock, quoteService, sourceItem, itemPrice, stockEpoch, type ServiceQuote, type ServiceRequest, type ItemSource } from './commerce.ts';
import { improveItem, type Improvement } from './item-improvement.ts';
import { updateItemSlot, itemTooltipMarkup, CHANGE_LABELS, PREVIEW_PERCENT } from './item-ui.ts';
import { ItemTooltip } from './item-tooltip.ts';
import { itemIconSVG } from './item-art.ts';
import { EQUIPMENT_SLOTS, TIER_COLORS, TIER_NAMES, STAT_LABELS, itemAffixPool, itemDisplayName, itemModifiers, formatStatValue } from './items.ts';
import { goldBalance } from './wallet.ts';
import { escapeUI, trapDialogFocus } from './ui-components.ts';
import './service-panel.css';

const OP_LABELS: Record<Improvement, string> = { enhance: 'Enhance', rarity: 'Raise rarity', rerollOne: 'Reroll one affix', rerollAll: 'Reroll all affixes', relevel: 'Raise item level' };
export class ServicePanel {
  readonly element: HTMLElement;
  private tooltip: ItemTooltip;
  private player!: Player;
  private npc!: TownNPC;
  private tab: 'shop' | 'improve' | 'buyback' = 'shop';
  private operation: Improvement = 'enhance';
  private selected: ServiceRequest | null = null;
  private quote: ServiceQuote | null = null;
  private saving = false;
  private lastConfirm = -Infinity;
  private abort = new AbortController();
  private focus: { dispose(): void } | null = null;
  private actions: { close(): void; trade(quote: ServiceQuote): Promise<{ ok: boolean; message: string }> };
  constructor(mount: HTMLElement, actions: ServicePanel['actions']) {
    this.actions = actions;
    this.element = document.createElement('section'); this.element.className = 'service-panel ui-window'; this.element.hidden = true;
    this.element.setAttribute('role', 'dialog'); this.element.setAttribute('aria-modal', 'true'); this.element.setAttribute('aria-labelledby', 'service-title');
    mount.append(this.element); this.tooltip = new ItemTooltip(mount, 'service-tooltip');
    this.element.addEventListener('click', e => this.click(e), { signal: this.abort.signal });
    this.element.addEventListener('change', e => {
      const target = e.target as HTMLSelectElement;
      if (target.dataset.operation !== undefined) { this.operation = target.value as Improvement; this.updateSelection(); this.render(); }
      if (target.dataset.affix !== undefined && this.selected?.type === 'improve') { this.selected.affix = Number(target.value); this.renderDetail(); this.element.querySelector<HTMLElement>('[data-affix]')?.focus(); }
    }, { signal: this.abort.signal });
    this.element.addEventListener('pointerover', e => this.hover(e.target), { signal: this.abort.signal });
    this.element.addEventListener('focusin', e => this.hover(e.target), { signal: this.abort.signal });
    this.element.addEventListener('pointerout', e => { if (!(e.relatedTarget instanceof Node) || !(e.target as HTMLElement).closest('[data-item]')?.contains(e.relatedTarget)) this.tooltip.hide(); }, { signal: this.abort.signal });
    this.element.addEventListener('focusout', () => this.tooltip.hide(), { signal: this.abort.signal });
    this.element.addEventListener('scroll', () => this.tooltip.hide(), { signal: this.abort.signal, capture: true });
  }
  open(player: Player, npc: TownNPC): void {
    this.player = player; this.npc = npc; this.tab = npc.role === 'enchanter' ? 'improve' : 'shop';
    this.operation = npc.role === 'blacksmith' ? 'enhance' : 'rarity'; this.selected = null; this.quote = null;
    this.element.hidden = false; this.render(); this.focus?.dispose();
    this.focus = trapDialogFocus(this.element, { initialFocus: this.element.querySelector<HTMLButtonElement>('[data-close]')!, restoreFocus: false });
  }
  inspect(source: ItemSource, operation?: Improvement): void {
    if (operation) { this.tab = 'improve'; this.operation = operation; }
    this.selected = this.tab === 'improve' ? { type: 'improve', source, operation: this.operation, affix: 0 } : { type: 'sell', source };
    this.render(); this.element.querySelector('.service-detail')?.scrollIntoView({ block: 'nearest' });
  }
  close(): void { this.focus?.dispose(); this.focus = null; this.tooltip.hide(); this.element.hidden = true; this.selected = null; this.quote = null; }
  dispose(): void { this.close(); this.abort.abort(); this.tooltip.dispose(); this.element.remove(); }
  private updateSelection(): void {
    if (this.selected && (this.selected.type === 'sell' || this.selected.type === 'improve')) this.selected = this.tab === 'improve'
      ? { type: 'improve', source: this.selected.source, operation: this.operation, affix: 0 } : { type: 'sell', source: this.selected.source };
    else this.selected = null;
  }
  private render(): void {
    this.tooltip.hide();
    const focused = this.element.querySelector<HTMLElement>(':focus');
    const active = focused?.dataset.item;
    const control = focused?.hasAttribute('data-operation') ? '[data-operation]' : focused?.dataset.tab ? `[data-tab="${focused.dataset.tab}"]`
      : focused?.hasAttribute('data-confirm') ? '[data-confirm]' : focused?.hasAttribute('data-close') ? '[data-close]' : null;
    this.element.style.setProperty('--service-color', NPC_COLORS[this.npc.role]);
    this.element.innerHTML = `<header class="ui-window-header"><span class="ui-header-emblem">${npcEmblem(this.npc.role)}</span><h2 class="ui-title" id="service-title">${NPC_NAMES[this.npc.role]}</h2><span class="service-wallet">${goldBalance(this.player.character).toLocaleString()} <small>gold</small></span><button class="ui-button ui-button--icon" data-close aria-label="Close service">×</button></header>
      <nav class="service-tabs" aria-label="Services">${this.npc.role === 'enchanter' ? '' : `<button class="ui-button ui-button--quiet" data-tab="shop" aria-pressed="${this.tab === 'shop'}">Shop</button>${this.npc.role === 'blacksmith' ? `<button class="ui-button ui-button--quiet" data-tab="improve" aria-pressed="${this.tab === 'improve'}">Enhance</button>` : ''}<button class="ui-button ui-button--quiet" data-tab="buyback" aria-pressed="${this.tab === 'buyback'}">Buyback <small>${this.player.character.commerce.buyback.length}/12</small></button>`}<span>${escapeUI(this.npc.name)} · Zone ${this.npc.level}</span></nav>
      <div class="service-body"><section class="service-offer ui-scroll-area">${this.tab === 'improve' ? `<div class="service-forge">${npcEmblem(this.npc.role)}</div>${this.npc.role === 'enchanter' ? `<select class="ui-button" data-operation aria-label="Enchantment">${(['rarity', 'rerollOne', 'rerollAll', 'relevel'] as Improvement[]).map(op => `<option value="${op}" ${op === this.operation ? 'selected' : ''}>${OP_LABELS[op]}</option>`).join('')}</select>` : '<h3>Enhance equipment</h3>'}` : `<div class="service-section-heading"><h3>${this.tab === 'shop' ? 'Stock' : 'Buyback'}</h3><span>${this.tab === 'shop' ? `Restocks at level ${(stockEpoch(this.player.level) + 1) * 3 + 1}` : 'Last 12 sales'}</span></div><div class="service-stock"></div>`}<div class="service-detail"></div></section>
      <section class="service-bag ui-scroll-area">${this.npc.role !== 'jeweler' ? '<section class="service-equipped-section" aria-label="Equipped gear"><div class="service-section-heading"><h3>Equipped</h3><span>Upgrade in place</span></div><div class="service-equipment"></div></section>' : ''}<section aria-label="Inventory"><div class="service-section-heading"><h3>Inventory</h3><span>${this.player.character.inventory.filter(Boolean).length} / 64</span></div>${this.player.character.inventory.some(Boolean) ? '<div class="service-grid"></div>' : '<p class="service-empty-bag">No items in your bag.</p>'}</section></section></div>
      <footer class="ui-window-footer"><span class="service-message" role="status"></span><button class="ui-button ui-button--primary" data-confirm disabled>Choose an item</button></footer>`;
    const bag = this.element.querySelector('.service-grid');
    this.player.character.inventory.forEach((item, index) => bag?.append(this.cell(item, `bag:${index}`)));
    const equipment = this.element.querySelector('.service-equipment');
    if (equipment) for (const slot of EQUIPMENT_SLOTS) {
      const wrap = document.createElement('div'); wrap.append(this.cell(this.player.character.equipped[slot], `equipped:${slot}`));
      const label = document.createElement('small'); label.textContent = slot === 'weapon' ? 'Main hand' : slot === 'offhand' ? 'Off hand' : slot; wrap.append(label); equipment.append(wrap);
    }
    const stock = this.element.querySelector('.service-stock');
    if (stock) {
      const entries = this.tab === 'shop' ? vendorStock(this.player.character, this.npc, this.player.level).map((item, index) => ({ item, key: `stock:${index}`, price: item ? itemPrice(item, 'buy') : 0 }))
        : this.player.character.commerce.buyback.map((b, index) => ({ ...b, key: `buyback:${index}` }));
      if (!entries.length) stock.innerHTML = '<p class="ui-muted">No items available.</p>';
      entries.forEach(entry => { const wrap = document.createElement('div'); wrap.append(this.cell(entry.item, entry.key)); const label = document.createElement('small'); label.textContent = entry.item ? `${entry.price.toLocaleString()} gold` : 'Sold'; wrap.append(label); stock.append(wrap); });
    }
    this.renderDetail();
    if (active) this.element.querySelector<HTMLElement>(`[data-item="${active}"]`)?.focus({ preventScroll: true });
    else if (control) this.element.querySelector<HTMLElement>(control)?.focus({ preventScroll: true });
  }
  private cell(item: Item | null, key: string): HTMLButtonElement {
    const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'ui-slot'; cell.dataset.item = key;
    updateItemSlot(cell, item, { level: this.player.level, emptyMarkup: '<span aria-hidden="true">·</span>', label: item ? itemDisplayName(item) : 'Empty slot' });
    cell.disabled = !item; return cell;
  }
  private resolve(key: string): { item: Item; source?: ItemSource; request: ServiceRequest } | null {
    const [type, value] = key.split(':'); let item: Item | null = null, request: ServiceRequest;
    if (type === 'stock') { item = vendorStock(this.player.character, this.npc, this.player.level)[Number(value)] ?? null; request = { type: 'buy', slot: Number(value) }; }
    else if (type === 'buyback') { item = this.player.character.commerce.buyback[Number(value)]?.item ?? null; request = { type: 'buyback', id: item?.id ?? '' }; }
    else {
      const source: ItemSource = type === 'bag' ? { bag: Number(value) } : { equipped: value as EquipmentSlot };
      item = sourceItem(this.player.character, source);
      request = this.tab === 'improve' || type === 'equipped' ? { type: 'improve', source, operation: this.operation, affix: 0 } : { type: 'sell', source };
      return item ? { item, request, source } : null;
    }
    return item ? { item, request } : null;
  }
  private hover(target: EventTarget | null): void {
    const cell = target instanceof HTMLElement ? target.closest<HTMLButtonElement>('[data-item]') : null;
    if (!cell) return;
    const value = this.resolve(cell.dataset.item!); if (!value) return;
    this.tooltip.show(value.item, { sheet: this.player.character, level: this.player.level,
      sourceIndex: value.source && 'bag' in value.source ? value.source.bag : undefined,
      equipped: Boolean(value.source && 'equipped' in value.source),
      context: value.request.type === 'buy' ? `${itemPrice(value.item, 'buy')} gold` : value.request.type === 'sell' ? `Sell · ${itemPrice(value.item, 'sell')} gold` : undefined }, cell);
  }
  private click(e: MouseEvent): void {
    if (this.saving) return;
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button) return;
    if (button.hasAttribute('data-close')) { this.actions.close(); return; }
    if (button.dataset.tab) { this.tab = button.dataset.tab as typeof this.tab; this.updateSelection(); this.render(); return; }
    if (button.dataset.item) {
      const value = this.resolve(button.dataset.item); if (!value) return;
      this.selected = value.request;
      if (value.source && 'equipped' in value.source && this.tab !== 'improve') { this.tab = 'improve'; this.render(); }
      else this.renderDetail();
      this.element.querySelector('.service-detail')?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      if (e.shiftKey && this.tab !== 'improve') this.confirm();
    }
    if (button.hasAttribute('data-confirm')) this.confirm();
  }
  private renderDetail(): void {
    this.quote = null; const selected = this.selected;
    const detail = this.element.querySelector<HTMLElement>('.service-detail')!, button = this.element.querySelector<HTMLButtonElement>('[data-confirm]')!;
    const message = this.element.querySelector<HTMLElement>('.service-message')!; message.textContent = '';
    button.disabled = true; button.textContent = 'Choose an item';
    if (!selected) { detail.innerHTML = `<p class="service-empty">${this.tab === 'improve' ? 'Choose equipment to improve.' : 'Hover to compare. Select to trade.'}</p>`; return; }
    for (const cell of this.element.querySelectorAll<HTMLElement>('[data-item]')) {
      const entry = this.resolve(cell.dataset.item!);
      cell.classList.toggle('is-selected', Boolean(entry && JSON.stringify(entry.request) === JSON.stringify(selected)));
    }
    const result = quoteService(this.player.character, this.npc, this.player.level, selected);
    if (!result.ok) { detail.innerHTML = `<p class="service-empty">${escapeUI(result.message)}</p>`; return; }
    const { item, quote } = result; this.quote = quote;
    const buying = selected.type === 'buy' || selected.type === 'buyback', improving = selected.type === 'improve';
    const label = improving ? OP_LABELS[selected.operation] : buying ? 'Buy' : 'Sell';
    button.textContent = `${label} · ${quote.price.toLocaleString()} gold`;
    button.disabled = selected.type !== 'sell' && goldBalance(this.player.character) < quote.price;
    if (button.disabled) message.textContent = 'Not enough gold.';
    detail.style.setProperty('--item-color', TIER_COLORS[item.tier]);
    detail.innerHTML = `<div class="service-selected"><div class="service-item-art">${itemIconSVG(item, 88)}</div><div><span class="ui-rarity-badge" data-tier="${item.tier}">${TIER_NAMES[item.tier]}</span><h3>${escapeUI(itemDisplayName(item))}</h3></div></div>`;
    if (!improving) {
      detail.innerHTML += itemTooltipMarkup(item, { sheet: this.player.character, level: this.player.level,
        sourceIndex: selected.type === 'sell' && 'bag' in selected.source ? selected.source.bag : undefined });
      return;
    }
    const op = selected.operation;
    if (op === 'rerollOne') detail.innerHTML += `<label class="service-affix">Affix<select class="ui-button" data-affix aria-label="Affix to replace">${item.affixes.map((a, index) => `<option value="${index}" ${index === this.selectedAffix() ? 'selected' : ''}>${escapeUI(STAT_LABELS[a.stat])} ${formatStatValue(a.stat, a.value)}</option>`).join('')}</select></label>`;
    if (op === 'rerollOne' || op === 'rerollAll') {
      detail.innerHTML += `<div class="service-changes">${item.affixes.map((a, i) => `<div class="${op === 'rerollOne' && i === this.selectedAffix() ? 'is-selected-affix' : ''}"><span>${escapeUI(STAT_LABELS[a.stat])}</span><b>${formatStatValue(a.stat, a.value)}</b></div>`).join('')}</div>`;
      const excluded = op === 'rerollOne' ? new Set(item.affixes.map(a => a.stat)) : new Set();
      const pool = itemAffixPool(item).filter(a => !excluded.has(a.stat));
      detail.innerHTML += `<p class="service-caution">Replaces ${op === 'rerollOne' ? 'this affix' : 'all affixes'}. Results can be worse.</p><details><summary>Possible affixes</summary><p class="service-pool">${pool.map(a => escapeUI(STAT_LABELS[a.stat])).join(' · ')}</p></details>`;
    } else {
      const next = improveItem(item, op, this.npc.level, 1);
      // Random new affixes are deliberately excluded from the pre-purchase preview.
      if (op === 'rarity') next.affixes = next.affixes.slice(0, item.affixes.length);
      const before = { ...itemModifiers(item), ...(item.weapon ? { baseDamage: item.weapon.damage } : {}), ...(item.shield ? { block: item.shield.blockChance, blocked: item.shield.blockReduction } : {}) };
      const after = { ...itemModifiers(next), ...(next.weapon ? { baseDamage: next.weapon.damage } : {}), ...(next.shield ? { block: next.shield.blockChance, blocked: next.shield.blockReduction } : {}) };
      detail.innerHTML += `<div class="service-result-heading">${op === 'enhance' ? `+${item.recipe.enhancement} → +${next.recipe.enhancement}` : op === 'rarity' ? `${TIER_NAMES[item.tier]} → ${TIER_NAMES[next.tier]}` : `Item level ${item.itemLevel} → ${next.itemLevel}`}</div><div class="service-changes">${Object.entries(after).filter(([key, value]) => value !== before[key as keyof typeof before]).map(([key, value]) => `<div><span>${escapeUI(({ baseDamage: 'Base damage', block: 'Block chance', blocked: 'Damage blocked', ...STAT_LABELS } as Record<string, string>)[key])}</span><span>${(before as Record<string, number>)[key] ?? 0} <b>→ ${Number(value.toFixed(1))}</b></span></div>`).join('') || '<p>No base stat change.</p>'}</div>`;
      if (selected.type === 'improve' && op !== 'rarity') {
        const source = selected.source;
        const preview = 'bag' in source ? previewEquipmentChange(this.player.character, next, this.player.level, { sourceIndex: source.bag }) : null;
        const changes = 'equipped' in source ? compareCharacterStats(this.player.character,
          { ...this.player.character, equipped: { ...this.player.character.equipped, [source.equipped]: next } }, this.player.level)
          : preview?.ok ? preview.changes : [];
        detail.innerHTML += `<div class="service-effective"><h3>${'equipped' in source ? 'Character changes' : 'If equipped'}</h3>${changes.map(change => {
          const percent = PREVIEW_PERCENT.has(change.key), delta = (change.after - change.before) * (percent ? 100 : 1);
          return `<div><span>${CHANGE_LABELS[change.key]}</span><b class="${delta < 0 ? 'is-loss' : 'is-gain'}">${delta > 0 ? '+' : ''}${Number(delta.toFixed(2))}${percent ? '%' : ''}</b></div>`;
        }).join('') || `<p class="ui-muted">${preview && !preview.ok ? escapeUI(preview.message) : 'No effective stat change.'}</p>`}</div>`;
      }
      if (op === 'rarity') detail.innerHTML += '<p class="service-caution">Adds one random affix.</p><details><summary>Possible new affixes</summary><p class="service-pool">' + itemAffixPool(item).filter(a => !item.affixes.some(b => b.stat === a.stat)).map(a => escapeUI(STAT_LABELS[a.stat])).join(' · ') + '</p></details>';
      if (op === 'relevel') detail.innerHTML += `<p class="${next.requiredLevel > this.player.level ? 'service-caution' : 'ui-muted'}">Requires level ${next.requiredLevel}</p>`;
      if (op === 'enhance') detail.innerHTML += '<p class="ui-muted">Guaranteed · maximum +10</p>';
    }
  }
  private selectedAffix() { return this.selected?.type === 'improve' ? this.selected.affix ?? 0 : 0; }
  private async confirm(): Promise<void> {
    if (this.saving || !this.quote || performance.now() - this.lastConfirm < 350) return;
    this.lastConfirm = performance.now();
    this.saving = true;
    const button = this.element.querySelector<HTMLButtonElement>('[data-confirm]')!;
    button.disabled = true; button.textContent = 'Saving…';
    let result: { ok: boolean; message: string };
    try { result = await this.actions.trade(this.quote); }
    catch { result = { ok: false, message: 'Could not complete the save. No purchase was committed.' }; }
    finally { this.saving = false; }
    if (this.element.hidden) return;
    this.renderDetail();
    this.tooltip.hide();
    if (result.ok) {
      const keep = this.selected?.type === 'improve'; if (!keep) this.selected = null;
      this.render(); this.element.classList.remove('service-success'); void this.element.offsetWidth; this.element.classList.add('service-success');
    }
    this.element.querySelector('.service-message')!.textContent = result.message;
  }
}
