import { isGreaterAffix, GREATER_AFFIX_SYMBOL } from './item-roll-content.ts';
import { STOCK_CATEGORIES, STOCK_CATEGORY_NAMES, stockCategory, enhancementGains, enhancementStepGains, type StockCategory } from './service-presentation.ts';
import { storageTabCount, storageTabItems, hasStorageTab, MAX_STORAGE_TABS, nextStorageTabPrice } from './storage-content.ts';
import { itemAffixCount } from './items.ts';
import { bulkSaleItems, ITEM_LOCK_ICON } from './item-protection.ts';
import { PACK_COLUMNS, PACK_ROWS, PACK_CELLS, CHARM_ROWS, resolvePackLayout, storageGridLayout, itemFootprint, canPackItem, packSpaceProblem } from './inventory-grid.ts';
import './inventory-pack.css';
import { vendorLevel } from './npcs.ts';
import type { Player } from './model.ts';
import type { Item, ItemKind, ItemTier, EquipmentSlot } from './character-types.ts';
import { NPC_NAMES, NPC_COLORS, type TownNPC } from './npcs.ts';
import { npcEmblem } from './npc-art.ts';
import { RESPEC_GOLD_PER_POINT, respecPoints, attributeResetPoints, GAMBLE_KINDS, gambleOdds, vendorRefreshPrice, gamblePrice, STASH_CAPACITY, vendorStock, vendorStockLevel, quoteService, sourceItem, itemPrice, stockEpoch, type ServiceResult, type ServiceQuote, type ServiceRequest, type ItemSource, type SaleItem } from './commerce.ts';
import { improveItem, nextEnhancementLevel, rerollPool, affixCategory, AFFIX_FOCUSES, type AffixFocus, type Improvement } from './item-improvement.ts';
import { updateItemSlot } from './item-ui.ts';
import { SLOT_NAMES, LEFT_SLOTS, RIGHT_SLOTS } from './equipment-layout.ts';
import { drawCharacterPortrait } from './character-portrait.ts';
import { emptySlotIcon } from './equipment-slot-art.ts';
import { ItemTooltip } from './item-tooltip.ts';
import { UITooltipStack } from './ui-tooltip-stack.ts';
import { itemIconSVG, itemPackIconSVG } from './item-art.ts';
import { generateItem, TIER_COLORS, TIER_NAMES, STAT_LABELS, itemAffixPool, itemDisplayName, formatStatValue } from './items.ts';
import { goldBalance } from './wallet.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { ServiceGoldFeedback } from './service-gold-feedback.ts';
import { forgeFrameSVG, forgeCoinSVG, forgeMotesMarkup } from './forge-art.ts';
import { enhancementPreference } from './control-preferences.ts';
import { ENHANCEMENT_CHARGE_MS, EnhancementSequence, type EnhancementPreference, type EnhancementPhase } from './enhancement-feedback.ts';
import './service-panel.css';

const ENCHANT_OPERATIONS = ['rarity', 'rerollOne', 'rerollAll', 'relevel'] as const;
const ENCHANT_LABELS = { rarity:'Rarity', rerollOne:'One affix', rerollAll:'All affixes', relevel:'Item level' };
const OP_LABELS: Record<Improvement, string> = { enhance: 'Enhance', rarity: 'Raise rarity', rerollOne: 'Reroll one affix', rerollAll: 'Reroll all affixes', relevel: 'Raise item level' };
export class ServicePanel {
  readonly element: HTMLElement;
  private includeActiveCharms = false;
  private storageTab = 0;
  private tooltip: ItemTooltip;
  private player!: Player;
  private npc!: TownNPC;
  private respecKind: 'skills' | 'attributes' = 'skills';
  private tab: 'shop' | 'sell' | 'improve' | 'buyback' | 'respec' = 'shop';
  private shopCategory: StockCategory = 'weapons';
  private stockCache: {key:string;available:(Item|null)[];all:(Item|null)[]}|null=null;
  private operation: Improvement = 'enhance';
  private selected: ServiceRequest | null = null;
  private quote: ServiceQuote | null = null;
  private sales = new Map<string, SaleItem>();
  private goldFeedback: ServiceGoldFeedback;
  private portrait: HTMLCanvasElement | null = null;
  private portraitFrame = 0;
  private portraitVisible = false;
  private portraitResize: ResizeObserver;
  private portraitIntersection: IntersectionObserver;
  private saving = false;
  private sessionVersion = 0;
  private enhancement: EnhancementSequence;
  private rankTips: UITooltipStack;
  private bagTab: 'equipment' | 'charms' = 'equipment';
  private renderedOffer = '';
  private offerScrollPositions = new Map<string, number>();
  private get merchantLayout(): boolean { return this.npc.role === 'blacksmith' || this.npc.role === 'jeweler'; }
  private enhancementPreference: EnhancementPreference;
  private tradeDrag: { id:string; quote:ServiceQuote|null; target:'.service-offer'|'.service-bag'; problem:string; message:string } | null = null;
  private ignoreClickUntil = 0;
  private gambleKind: ItemKind | null = null;
  private revealed:Item|null=null;
  private abort = new AbortController();
  private focus: { dispose(): void } | null = null;
  private actions: { close(): void; sort(target: 'storage' | 'inventory', tab?: number): void; trade(quote: ServiceQuote): Promise<ServiceResult>; enhancementSound?(cue: 'charge' | 'success' | 'error'): void; enhancementPreference?: EnhancementPreference };
  constructor(mount: HTMLElement, actions: ServicePanel['actions']) {
    this.actions = actions;
    this.portraitResize = new ResizeObserver(() => this.drawPortrait());
    this.portraitIntersection = new IntersectionObserver(entries => {
      const current = entries.find(entry => entry.target === this.portrait);
      if (current) { this.portraitVisible = current.isIntersecting; this.drawPortrait(); }
    });
    this.enhancementPreference = actions.enhancementPreference ?? enhancementPreference;
    this.element = document.createElement('section'); this.element.className = 'service-panel ui-window'; this.element.hidden = true;
    this.enhancement = new EnhancementSequence((done, duration) => {
      const bar = this.element.querySelector<HTMLElement>('.forge-channel > span')!;
      // The visible animation's final frame, not a parallel wall-clock timer, releases the purchase.
      const frames = [{ transform: 'scaleX(0)' }, { transform: 'scaleX(.96)' }];
      const animation = bar.animate(frames,
        { duration, easing: 'cubic-bezier(.3,.1,.65,1)', fill: 'forwards' });
      void animation.finished.then(done, () => {});
      return () => animation.cancel();
    });
    this.element.setAttribute('role', 'dialog'); this.element.setAttribute('aria-modal', 'true'); this.element.setAttribute('aria-labelledby', 'service-title');
    mount.append(this.element); this.goldFeedback = new ServiceGoldFeedback(this.element); this.tooltip = new ItemTooltip(this.element, 'service-tooltip');
    this.rankTips = new UITooltipStack(this.element, term => this.rankTooltipMarkup(term), this.element, () => !this.saving && this.tab==='improve' && this.operation==='enhance');
    this.element.addEventListener('click', e => this.click(e), { signal: this.abort.signal });
    this.element.addEventListener('keydown', e => {
      if (this.saving || !(e.target instanceof HTMLElement)) return;
      const selector = e.target.matches('[data-enhance-rank]') ? '[data-enhance-rank]' : e.target.matches('[data-bag-tab]') ? '[data-bag-tab]' : null;
      if (!selector || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation();
      const buttons = [...this.element.querySelectorAll<HTMLButtonElement>(selector)];
      const index = buttons.indexOf(e.target as HTMLButtonElement);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      if (selector === '[data-enhance-rank]') {
        for (const button of buttons) button.tabIndex = -1;
        buttons[next].tabIndex = 0; buttons[next].focus();
      } else buttons[next]?.click();
    }, { signal: this.abort.signal });
    this.installTradeDrag();
    this.element.addEventListener('pointerover', e => this.hover(e.target), { signal: this.abort.signal });
    this.element.addEventListener('focusin', e => this.hover(e.target), { signal: this.abort.signal });
    this.element.addEventListener('pointerout', e => {
      const cell = e.target instanceof Element ? e.target.closest('[data-item]') : null;
      if (cell && (!(e.relatedTarget instanceof Node) || !cell.contains(e.relatedTarget))) this.tooltip.defer();
    }, { signal: this.abort.signal });
    this.element.addEventListener('focusout', () => this.tooltip.defer(), { signal: this.abort.signal });
    this.element.addEventListener('scroll', event => { if (!(event.target instanceof Element) || !event.target.closest('.ui-tooltip')) this.hideTooltips(); }, { signal: this.abort.signal, capture: true });
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
      if (event.matches) { this.element.classList.add('forge-instant'); this.enhancement.skip(); }
      this.drawPortrait();
    }, { signal: this.abort.signal });
    document.addEventListener('visibilitychange', () => this.drawPortrait(), { signal: this.abort.signal });
  }
  open(player: Player, npc: TownNPC): void {
    this.stopPortrait();
    this.sessionVersion++; this.enhancement.dispose(); this.saving = false;
    this.bagTab = 'equipment';
    this.renderedOffer = ''; this.offerScrollPositions.clear();
    this.stockCache=null;
    this.shopCategory = npc.role === 'jeweler' ? 'accessories' : 'weapons';
    this.storageTab = 0; this.player = player; this.npc = npc; this.tab = npc.role === 'enchanter' ? 'improve' : 'shop';
    this.sales.clear(); this.goldFeedback.stop(); this.revealed=null; this.gambleKind=null;
    this.operation = npc.role === 'blacksmith' ? 'enhance' : 'rarity'; this.selected = null; this.quote = null;
    this.element.hidden = false; this.render(); this.focus?.dispose();
    this.focus = trapDialogFocus(this.element, { initialFocus: this.element, restoreFocus: false });
  }
  inspect(source: ItemSource, operation?: Improvement): void {
    if (operation) { this.tab = 'improve'; this.operation = operation; }
    const item = sourceItem(this.player.character, source);
    if (this.tab === 'improve') this.bagTab = item?.kind === 'charm' ? 'charms' : 'equipment';
    this.selected = this.tab === 'improve' ? { type: 'improve', source, operation: this.operation, affix: 0 } : { type: 'sell', source };
    this.render();
  }
  close(): void { this.stopPortrait(); this.sessionVersion++; this.enhancement.dispose(); this.saving = false; this.clearTradeDrag(); this.includeActiveCharms=false; this.goldFeedback.stop(); this.sales.clear(); this.focus?.dispose(); this.focus = null; this.hideTooltips(); this.element.hidden = true; this.selected = null; this.quote = null; }
  dispose(): void { this.close(); this.abort.abort(); this.tooltip.dispose(); this.rankTips.dispose(); this.element.remove(); }
  private updateSelection(): void {
    if (this.npc.role === 'gambler' && this.tab === 'shop') {
      this.selected = this.gambleKind ? { type: 'gamble', kind: this.gambleKind } : null;
      return;
    }
    if ((this.tab === 'sell' || this.tab === 'improve') && this.selected && (this.selected.type === 'sell' || this.selected.type === 'improve')) this.selected = this.tab === 'improve'
      ? { type: 'improve', source: this.selected.source, operation: this.operation, affix: 0 } : { type: 'sell', source: this.selected.source };
    else this.selected = null;
  }
  selectSales(tier?: ItemTier): void {
    if(this.npc.role === 'stash' || this.saving) return;
    this.tab = 'sell'; this.sales.clear();
    this.player.character.inventory.forEach((item,bag) => { if(item && (!tier || item.tier === tier)) this.sales.set(item.id,{bag,id:item.id,revision:item.recipe.revision}); });
    this.selected = null; this.render();
  }
  private render(): void {
    if (!this.merchantLayout) this.stopPortrait();
    this.clearTradeDrag();
    delete this.element.dataset.forgeState;
    this.element.classList.remove('service-success', 'forge-instant');
    const forge = this.tab === 'improve' && this.operation === 'enhance';
    this.element.classList.toggle('is-forging', forge);
    this.element.classList.toggle('is-merchant-layout', this.merchantLayout);
    this.element.removeAttribute('aria-busy');
    this.element.classList.toggle('is-storage',this.npc.role==='stash');
    this.element.classList.toggle('is-enhancing',this.tab==='improve');
    this.element.classList.toggle('is-enchanting',this.tab==='improve'&&this.npc.role==='enchanter');
    if(this.tab==='respec'){this.renderRespec();return;}
    if(this.npc.role==='stash'){this.renderStorage();return;}
    if(this.npc.role==='gambler'&&this.tab==='shop'){this.renderSpecial();return;}
    this.goldFeedback.stop();
    this.hideTooltips();
    this.element.classList.toggle('is-selling', this.tab === 'sell');
    const oldOffer=this.element.querySelector('.service-offer-content')??this.element.querySelector('.service-offer');
    if(this.renderedOffer)this.offerScrollPositions.set(this.renderedOffer,oldOffer?.scrollTop??0);
    this.renderedOffer=`${this.tab}:${this.tab==='shop'?this.shopCategory:''}`;
    const offerScroll=this.offerScrollPositions.get(this.renderedOffer)??0;
    const bagScroll=this.element.querySelector('.service-bag')?.scrollTop??0;
    const focused = this.element.querySelector<HTMLElement>(':focus');
    const active = focused?.dataset.item;
    const control = focused?.hasAttribute('data-clear-sales') ? '[data-clear-sales]' : focused?.dataset.sellTier ? `[data-sell-tier="${focused.dataset.sellTier}"]` : focused?.dataset.operation ? `[data-operation="${focused.dataset.operation}"]` : focused?.dataset.tab ? `[data-tab="${focused.dataset.tab}"]`
      : focused?.hasAttribute('data-confirm') ? '[data-confirm]' : focused?.hasAttribute('data-close') ? '[data-close]' : null;
    this.element.style.setProperty('--service-color', NPC_COLORS[this.npc.role]);
    const merchant=this.merchantLayout;
    const offerHeading=this.tab==='sell'
      ? `<div class="service-section-heading"><h3>Sell items</h3><button class="ui-button ui-button--quiet" data-clear-sales>Clear</button></div>${merchant?this.rarityControls():''}`
      : this.tab==='improve'
        ? `${this.npc.role==='enchanter'?`<nav class="enchant-operations" aria-label="Enchantment">${ENCHANT_OPERATIONS.map(op=>`<button class="ui-button ui-button--quiet" data-operation="${op}" aria-pressed="${this.operation===op}">${ENCHANT_LABELS[op]}</button>`).join('')}</nav>`:'<div class="service-section-heading"><h3>Enhance</h3></div>'}`
        : `<div class="service-section-heading"><h3>${this.tab==='shop'?`Stock · Lv ${vendorStockLevel(this.npc,this.player.level)}`:'Buyback'}</h3><span>${this.tab==='shop'?`Restocks at level ${(stockEpoch(this.player.level)+1)*3+1}`:'Last 12 sales'}</span></div>${this.tab==='shop'?'<div class="service-stock-controls"></div>':''}<div class="service-stock inventory-pack"></div>`;
    const action=forge?this.enhancementActionMarkup():merchant?`<div class="service-action"><div class="service-purchase-summary" hidden></div><div class="service-action-channel" aria-hidden="true"></div><button class="ui-button ui-button--primary enhance-confirm" data-confirm disabled>Choose an item</button><div class="service-action-options" aria-hidden="true"></div><span class="service-message" role="status" aria-live="polite"></span></div>`:'';
    const offerMarkup=`${merchant?'<div class="service-offer-content ui-scroll-area">':''}${offerHeading}<div class="service-detail"></div>${merchant?'</div>':''}${action}`;
    const inventoryMarkup=`<section aria-label="Inventory">${merchant||this.tab==='improve'?this.bagTabsMarkup():`<div class="service-section-heading"><h3>Inventory</h3></div>${this.sortMarkup('inventory')}`}${this.tab==='sell'&&!merchant?this.rarityControls():''}<div class="ui-item-grid-scroll"><div class="service-grid inventory-pack"></div></div></section>`;
    if (merchant && this.portrait?.isConnected) {
      // Keep the equipped section, canvas pixels and observers mounted between tabs.
      // Only the tab-dependent offers and inventory controls need new markup.
      this.element.querySelector('.ui-window-header')!.outerHTML=this.headerMarkup();
      this.element.querySelector('.service-tabs')!.outerHTML=this.tabsMarkup();
      this.element.querySelector('.service-offer')!.innerHTML=offerMarkup;
      const bag=this.element.querySelector<HTMLElement>('.service-bag')!;
      bag.inert=false;
      bag.querySelector(':scope > section[aria-label="Inventory"]')!.outerHTML=inventoryMarkup;
    } else {
      this.element.innerHTML = `${this.headerMarkup()}${this.tabsMarkup()}
        <div class="service-body"><section class="service-offer ${merchant?'':'ui-scroll-area'}">${offerMarkup}</section>
        <section class="service-bag ui-scroll-area">${merchant||this.tab==='improve'?'<section class="service-equipped-section" aria-label="Equipped gear"><div class="service-section-heading"><h3>Equipped</h3></div><div class="service-loadout"></div></section>':''}${inventoryMarkup}</section></div>
        ${forge||merchant?'':'<footer class="ui-window-footer"><span class="service-message" role="status"></span><button class="ui-button ui-button--primary" data-confirm disabled>Choose an item</button></footer>'}`;
    }
    this.renderInventoryPack();
    this.renderEquipment();
    this.renderStock();
    this.renderDetail();
    this.element.querySelector('.service-bag')!.scrollTop=bagScroll;
    (this.element.querySelector('.service-offer-content')??this.element.querySelector('.service-offer'))!.scrollTop=offerScroll;
    this.drawPortrait();
    if (active) this.element.querySelector<HTMLElement>(`[data-item="${active}"]`)?.focus({ preventScroll: true });
    else if (control) this.element.querySelector<HTMLElement>(control)?.focus({ preventScroll: true });
  }
  private renderSpatialItems(root: HTMLElement, entries: {item:Item;key:string;sold?:boolean}[], minimumRows: number, label: string): void {
    const layout=storageGridLayout(entries.map(entry=>entry.item));
    const rows=Math.max(minimumRows,...entries.map((entry,i)=>Math.floor(layout.cells[i]!/PACK_COLUMNS)+itemFootprint(entry.item).height));
    root.style.setProperty('--pack-columns',String(PACK_COLUMNS));
    root.innerHTML=`<div class="character-bag character-tetris" role="group" aria-label="${escapeUI(label)}" style="grid-template-rows:repeat(${rows},var(--pack-cell))">${Array.from({length:rows*PACK_COLUMNS},(_,i)=>`<span class="character-grid-cell" aria-hidden="true" style="grid-column:${i%PACK_COLUMNS+1};grid-row:${Math.floor(i/PACK_COLUMNS)+1}"></span>`).join('')}</div>`;
    const grid=root.firstElementChild!;
    entries.forEach((entry,i)=>{
      if(entry.sold)return;
      const cell=this.cell(entry.item,entry.key),size=itemFootprint(entry.item),position=layout.cells[i]!;
      cell.classList.add('character-bag-slot');
      cell.style.gridColumn=`${position%PACK_COLUMNS+1} / span ${size.width}`;
      cell.style.gridRow=`${Math.floor(position/PACK_COLUMNS)+1} / span ${size.height}`;
      cell.querySelector('svg')?.remove();cell.insertAdjacentHTML('afterbegin',itemPackIconSVG(entry.item,size.width,size.height));grid.append(cell);
    });
  }
  private currentStock(includeSold=false): (Item|null)[] {
    const key=`${this.npc.id}:${stockEpoch(this.player.level)}:${this.player.character.commerce.revision}`;
    if(this.stockCache?.key!==key)this.stockCache={key,
      available:vendorStock(this.player.character,this.npc,this.player.level),
      all:vendorStock(this.player.character,this.npc,this.player.level,true)};
    return includeSold?this.stockCache.all:this.stockCache.available;
  }
  private renderStock(): void {
    const root=this.element.querySelector<HTMLElement>('.service-stock');if(!root)return;
    if(this.tab==='buyback'){
      const entries=this.player.character.commerce.buyback.map((entry,index)=>({item:entry.item,key:`buyback:${index}`}));
      this.renderSpatialItems(root,entries,8,'Buyback items');
      if(!entries.length)this.renderStockEmpty(root,'No recent sales','Sold items appear here.');
      return;
    }
    const stock=this.currentStock(true);
    const available=this.currentStock();
    const controls=this.element.querySelector<HTMLElement>('.service-stock-controls')!;
    const refresh=quoteService(this.player.character,this.npc,this.player.level,{type:'refreshStock'});
    const price=vendorRefreshPrice(this.player.character,this.npc,this.player.level);
    controls.innerHTML=`<nav class="service-categories" aria-label="Stock categories">${STOCK_CATEGORIES.map(category=>`<button class="ui-button ui-button--quiet" data-stock-category="${category}" aria-pressed="${this.shopCategory===category}">${STOCK_CATEGORY_NAMES[category]} <small>${available.filter(item=>item&&stockCategory(item)===category).length}</small></button>`).join('')}</nav>
      <div class="service-refresh-row"><button class="ui-button ui-button--quiet" data-refresh-stock ${!refresh.ok||price>goldBalance(this.player.character)?'disabled':''} title="Replace all stock. The fee doubles each time and resets at the next level restock."><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M19 8a8 8 0 1 0 1 8M19 3v5h-5"/></svg> Refresh · ${Number.isSafeInteger(price)?price.toLocaleString()+' gold':'Unavailable'}</button></div>`;
    this.renderSpatialItems(root,stock.flatMap((item,index)=>item&&stockCategory(item)===this.shopCategory?[{item,key:`stock:${index}`,sold:!available[index]}]:[]),8,`${STOCK_CATEGORY_NAMES[this.shopCategory]} for sale`);
    if(!available.some(item=>item&&stockCategory(item)===this.shopCategory)) {
      const stocked=stock.some(item=>item&&stockCategory(item)===this.shopCategory);
      this.renderStockEmpty(root,stocked?'Sold out':`No ${STOCK_CATEGORY_NAMES[this.shopCategory].toLowerCase()} in this stock`,stocked?'Refresh for new stock.':'');
    }
  }
  private renderStockEmpty(root: HTMLElement, title: string, hint: string): void {
    // The actual tray owns its empty state, including when cell size reaches its cap.
    root.querySelector('.character-bag')!.insertAdjacentHTML('beforeend',`<div class="service-stock-empty" role="status"><strong>${escapeUI(title)}</strong>${hint?`<span>${escapeUI(hint)}</span>`:''}</div>`);
  }
  private enhancementActionMarkup(): string {
    return `<div class="enhance-action service-action">
      <div class="forge-result" role="status" hidden></div>
      <div class="enhance-receipt"><div><span data-cost-label>Cost</span><div class="enhance-price">${forgeCoinSVG()}<strong data-enhance-cost></strong></div></div><div><span data-balance-label>Remaining</span><b data-enhance-balance></b></div></div>
      <div class="forge-channel" aria-hidden="true"><span></span></div>
      <button class="ui-button ui-button--primary enhance-confirm" data-confirm disabled>Choose an item</button>
      <div class="enhance-options"><label><input type="checkbox" data-skip-enhancement ${this.enhancementPreference.skip ? 'checked' : ''}> Skip animation</label><button class="ui-button ui-button--quiet" data-cancel-charge hidden>Cancel</button></div>
      <span class="service-message" role="status" aria-live="polite"></span>
    </div>`;
  }
  private renderEnhancement(detail:HTMLElement,item:Item|null,next:Item|null,problem=''): void {
    detail.hidden=false;
    const source=this.selected?.type==='improve'?this.selected.source:null;
    const key=source?('bag' in source?`bag:${source.bag}`:`equipped:${source.equipped}`):'';
    const eligible=item && item.kind!=='riftKey';
    const gains=item&&next?enhancementGains(item,next):[];
    detail.innerHTML=`<div class="enhance-showcase forge-showcase ${item?'':'is-empty'}" style="--item-color:${item?TIER_COLORS[item.tier]:'#b6aa8c'}">
      <div class="forge-stage">${forgeFrameSVG()}
        ${item?`<button type="button" class="enhance-art" data-clear-enhance data-item="${key}" aria-label="Remove ${escapeUI(itemDisplayName(item))} from the workbench">${itemPackIconSVG(item,itemFootprint(item).width,itemFootprint(item).height)}</button>${forgeMotesMarkup()}`:`<div class="enhance-empty-emblem">${npcEmblem('blacksmith')}</div>`}
        <div class="forge-burst" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="--ray:${i * 30}deg"></i>`).join('')}</div>
      </div>
      <div class="forge-copy">${item?`<span class="enhance-kicker">${TIER_NAMES[item.tier]} · Lv ${item.itemLevel}</span>`:''}
        <h3>${item?escapeUI(itemDisplayName(item)):'Choose an item'}</h3>
        ${eligible?`<div class="enhance-ranks"><strong class="forge-current-rank"><small>Current</small>+${item.recipe.enhancement}</strong>${next?`<i aria-hidden="true">→</i><span class="forge-next-rank"><small>Next</small>+${next.recipe.enhancement}</span>`:''}</div>`:''}
      </div>
    </div>
    ${eligible?`<div class="forge-rank-track" role="group" aria-label="Enhancement ranks">${Array.from({length:11},(_,rank)=>`<button type="button" data-enhance-rank="${rank}" data-ui-term="enhancement:${rank}" aria-label="Rank +${rank}${rank===item.recipe.enhancement?', current':rank===next?.recipe.enhancement?', next upgrade':''}: stat details" ${rank===item.recipe.enhancement?'aria-current="step"':''} tabindex="${rank===item.recipe.enhancement?0:-1}" class="${rank===item.recipe.enhancement?'is-current':rank<item.recipe.enhancement?'is-earned':rank===next?.recipe.enhancement?'is-next':''}"><span class="forge-rank-mark" aria-hidden="true"></span><span>+${rank}</span></button>`).join('')}</div>`:''}
    ${gains.length?`<div class="enhance-gains" aria-label="Next upgrade"><div class="enhance-gains-heading"><span>Stats</span><span>Current</span><span>Next</span><span>Gain</span></div>${gains.map(row=>`<div><span>${escapeUI(row.label)}</span><span>${row.before}</span><strong>${row.after}</strong><em>${row.gain}</em></div>`).join('')}</div>`:''}`;
    const button = this.element.querySelector<HTMLButtonElement>('[data-confirm]')!;
    const price = this.quote?.price;
    const balance = goldBalance(this.player.character);
    const affordable = price !== undefined && balance >= price;
    this.element.querySelector<HTMLElement>('.enhance-receipt')!.hidden = price === undefined;
    this.element.querySelector('[data-cost-label]')!.textContent = 'Cost';
    this.element.querySelector('[data-enhance-cost]')!.innerHTML = `${price?.toLocaleString() ?? '—'} <small>gold</small>`;
    this.element.querySelector('[data-balance-label]')!.textContent = price !== undefined && !affordable ? 'Short by' : 'Remaining';
    const remaining = this.element.querySelector<HTMLElement>('[data-enhance-balance]')!;
    remaining.textContent = price === undefined ? '—' : `${Math.abs(balance - price).toLocaleString()} gold`;
    remaining.classList.toggle('is-short', price !== undefined && !affordable);
    button.textContent = next ? `Enhance to +${next.recipe.enhancement}` : item ? item.recipe.enhancement === 10 ? 'Fully enhanced · +10' : 'Cannot enhance' : 'Choose an item';
    button.disabled = !next || !affordable;
    this.element.querySelector('.service-message')!.textContent = item?.recipe.enhancement===10 ? '' : problem;
    this.element.querySelector<HTMLElement>('.forge-result')!.hidden = true;
    delete this.element.dataset.forgeState;
  }
  private hideTooltips(): void { this.tooltip.hide(); this.rankTips.hide(); }
  private rankTooltipMarkup(term: string): string | undefined {
    if (!/^enhancement:(10|[0-9])$/.test(term) || this.selected?.type!=='improve') return;
    const item=sourceItem(this.player.character,this.selected.source);
    if (!item || item.kind==='riftKey') return;
    const rank=Number(term.split(':')[1]), current=item.recipe.enhancement;
    const gains=enhancementStepGains(item,rank);
    const status=rank===current?'Current':rank===nextEnhancementLevel(item)?'Next upgrade':'';
    return `<div class="forge-rank-tip"><header><h3>${rank?`<small>+${rank-1} →</small> `:''}+${rank}</h3><span>${status}</span></header>
      ${rank===0?'<p class="forge-tip-empty">Base rank</p>':gains.length?`<dl>${gains.map(row=>`<div><dt>${escapeUI(row.label)}</dt><dd class="${row.gain.startsWith('-')?'is-negative':''}">${row.gain}</dd></div>`).join('')}</dl>`:'<p class="forge-tip-empty">No stat gain · skipped</p>'}
    </div>`;
  }
  private bagTabsMarkup(): string {
    return `<div class="service-bag-toolbar"><div class="service-bag-tabs" role="tablist" aria-label="Inventory category">${(['equipment','charms'] as const).map(tab=>`<button type="button" role="tab" id="service-bag-${tab}" data-bag-tab="${tab}" aria-controls="service-bag-items" aria-selected="${tab===this.bagTab}" tabindex="${tab===this.bagTab?0:-1}">${tab==='equipment'?'Inventory':'Charms'}</button>`).join('')}</div><button type="button" class="ui-button ui-button--quiet ui-button--icon" data-sort-pack="inventory" aria-label="Auto-sort inventory">${uiIcon('sortFilter')}</button></div>`;
  }
  private renderEquipment(): void {
    const root=this.element.querySelector<HTMLElement>('.service-loadout');
    if (!root) return;
    const sheet=this.player.character;
    if (this.merchantLayout && !this.portrait) {
      const stage=document.createElement('div'); stage.className='service-portrait-stage';
      stage.innerHTML='<div class="service-portrait-niche" aria-hidden="true"></div><canvas class="service-portrait" role="img" aria-label="Your character wearing the current equipment"></canvas>';
      root.append(stage);
      this.portrait=stage.querySelector('canvas')!;
      this.portraitResize.observe(this.portrait);
      this.portraitIntersection.observe(this.portrait);
    }
    const slots: {slot:EquipmentSlot;column:number;row:number}[]=[{slot:'head',column:2,row:1},
      ...LEFT_SLOTS.map((slot,i)=>({slot,column:1,row:i+1})), ...RIGHT_SLOTS.map((slot,i)=>({slot,column:3,row:i+1}))];
    for (const {slot,column,row} of slots) {
      const item=sheet.equipped[slot];
      const reserved=slot==='offhand'&&sheet.equipped.weapon?.weapon?.hands===2;
      const cell: HTMLButtonElement=root.querySelector<HTMLButtonElement>(`[data-equipment-slot="${slot}"]`)??document.createElement('button');
      cell.type='button'; cell.className='ui-slot service-equipped-slot'; cell.dataset.equipmentSlot=slot;
      cell.removeAttribute('aria-pressed');
      cell.dataset.item=`equipped:${reserved?'weapon':slot}`;
      cell.style.gridColumn=String(column); cell.style.gridRow=String(row);
      const label=reserved?'Off hand reserved by two-handed weapon':`${SLOT_NAMES[slot]}${item?`: ${itemDisplayName(item)}`:''}`;
      updateItemSlot(cell,item,{level:this.player.level,draggable:false,label,
        emptyMarkup:reserved?`<span class="service-reserved-glyph">${emptySlotIcon('weapon')}</span><span class="service-reserved-label">2H</span>`:emptySlotIcon(slot)});
      cell.classList.toggle('is-twohand-reserved',reserved); cell.disabled=!item&&!reserved; cell.title=label;
      if (cell.parentElement!==root) root.append(cell);
    }
  }
  private stopPortrait(): void {
    cancelAnimationFrame(this.portraitFrame); this.portraitFrame=0;
    this.portraitResize.disconnect(); this.portraitIntersection.disconnect();
    this.portrait=null; this.portraitVisible=false;
  }
  private drawPortrait = (): void => {
    cancelAnimationFrame(this.portraitFrame); this.portraitFrame=0;
    const canvas=this.portrait;
    if (!canvas || !this.portraitVisible || this.element.hidden || document.hidden) return;
    const density=Math.min(2,window.devicePixelRatio||1);
    const width=Math.round(canvas.clientWidth*density), height=Math.round(canvas.clientHeight*density);
    if (!width || !height) return;
    if (canvas.width!==width || canvas.height!==height) { canvas.width=width; canvas.height=height; }
    const ctx=canvas.getContext('2d'); if (!ctx) return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    drawCharacterPortrait(ctx,this.player,reduced?3:performance.now()/1000,Math.PI/2,width,height);
    if (!reduced) this.portraitFrame=requestAnimationFrame(this.drawPortrait);
  };
  private headerMarkup(): string {
    return `<header class="ui-window-header"><span class="ui-header-emblem">${npcEmblem(this.npc.role)}</span><h2 class="ui-title" id="service-title">${NPC_NAMES[this.npc.role]}</h2><span class="service-wallet"><b data-wallet-total>${goldBalance(this.player.character).toLocaleString()}</b> <small>gold</small></span><button class="ui-button ui-button--icon" data-close aria-label="Close service">×</button></header>`;
  }
  private tabsMarkup(): string {
    if (this.npc.role === 'stash') return '';
    const tabs: Array<[typeof this.tab, string]> = this.npc.role === 'enchanter'
      ? [['improve', 'Enchant'], ['respec', 'Respec']] : [['shop', this.npc.role === 'gambler' ? 'Gamble' : 'Shop']];
    if (this.npc.role === 'blacksmith') tabs.push(['improve', 'Enhance']);
    tabs.push(['sell', 'Sell'], ['buyback', `Buyback <small>${this.player.character.commerce.buyback.length}/12</small>`]);
    return `<nav class="service-tabs" aria-label="Services">${tabs.map(([tab, label]) => `<button class="ui-button ui-button--quiet" data-tab="${tab}" aria-pressed="${this.tab === tab}">${label}</button>`).join('')}<span>${escapeUI(this.npc.name)}${this.merchantLayout||this.tab === 'improve' ? ` · Services Lv ${vendorLevel(this.npc, this.player.level)}` : ''}</span></nav>`;
  }
  showRespec(): void { if(this.npc.role!=='enchanter')return; this.tab='respec'; this.render(); }
  private renderRespec(): void {
    this.goldFeedback.stop();this.hideTooltips();this.element.classList.remove('is-selling');
    const attributes = this.respecKind === 'attributes', sheet = this.player.character;
    const request: ServiceRequest = {type:attributes?'resetAttributes':'respec'};
    const points = attributes ? attributeResetPoints(sheet) : respecPoints(sheet);
    const result = quoteService(sheet,this.npc,this.player.level,request), price = attributes ? 0 : points*RESPEC_GOLD_PER_POINT;
    this.quote=result.ok?result.quote:null;this.selected=request;
    this.element.style.setProperty('--service-color',NPC_COLORS.enchanter);
    this.element.innerHTML=`${this.headerMarkup()}${this.tabsMarkup()}<div class="service-respec ui-scroll-area">
      <nav class="service-tabs" aria-label="Reset type">${(['skills','attributes'] as const).map(kind=>`<button class="ui-button ui-button--quiet" data-respec-kind="${kind}" aria-pressed="${this.respecKind===kind}">${kind==='skills'?'Skills':'Attributes'}</button>`).join('')}</nav>
      <div class="service-respec-sigil">${npcEmblem('enchanter')}</div><h3>Choose a new path</h3>
      <p>${attributes?'Redistribute your assigned attributes. One free reset per character.':'Return every spent skill point, including purchased ranks.'}</p>
      <div class="service-respec-values"><div><strong>${points}</strong><span>Points refunded</span></div><div><strong>${attributes?'Free':price.toLocaleString()}</strong><span>${attributes?'Once per character':`Gold · ${RESPEC_GOLD_PER_POINT} per point`}</span></div></div>
      <p class="ui-muted">${attributes?'Returns all four attributes to 10 and refunds their assigned points.':'Clears your skill tree, ranks, specializations and skill bindings.<br>Attributes and equipment stay yours.'}</p>
      </div><footer class="ui-window-footer"><span class="service-message" role="status">${!result.ok?escapeUI(result.message):goldBalance(sheet)<price?'Not enough gold.':''}</span><button class="ui-button ui-button--primary" data-confirm ${!result.ok||goldBalance(sheet)<price?'disabled':''}>${attributes?'Reset attributes · Free':`Reset skills · ${price.toLocaleString()} gold`}</button></footer>`;
  }

  private renderStorage(): void {
    this.goldFeedback.stop(); this.hideTooltips(); this.element.classList.remove('is-selling');
    const sheet = this.player.character, count = storageTabCount(sheet), owned = hasStorageTab(sheet,this.storageTab);
    const storageScroll = this.element.dataset.storageView === String(this.storageTab)
      ? this.element.querySelector('.service-storage-pane')?.scrollTop ?? 0 : 0;
    const bagScroll = this.element.querySelector('.service-bag')?.scrollTop ?? 0;
    this.element.dataset.storageView = String(this.storageTab);
    this.element.style.setProperty('--service-color',NPC_COLORS.stash);
    this.element.innerHTML = `${this.headerMarkup()}
      <div class="service-body"><section class="service-offer service-storage-pane ui-scroll-area">
        <nav class="storage-tabs" aria-label="Storage tabs">${Array.from({length:MAX_STORAGE_TABS},(_,tab)=>`<button type="button" class="ui-button ui-button--quiet" data-storage-tab="${tab}" aria-pressed="${this.storageTab===tab}" ${tab>count?'disabled':''} aria-label="${tab<count?'Open':'Unlock'} storage tab ${tab+1}">${tab>=count?ITEM_LOCK_ICON:''}<span>Tab ${tab+1}</span></button>`).join('')}</nav>
        ${owned?`<div class="service-storage-toolbar">${this.sortMarkup('storage')}<span>${storageTabItems(sheet,this.storageTab).filter(Boolean).length} / ${STASH_CAPACITY}</span></div><div class="ui-item-grid-scroll"><div class="service-storage inventory-pack"></div></div>`:
          `<div class="storage-unlock"><span class="storage-unlock-icon">${ITEM_LOCK_ICON}</span><h3>Storage tab ${this.storageTab+1}</h3><p>${STASH_CAPACITY} more items</p><strong>${nextStorageTabPrice(sheet)?.toLocaleString()} <small>gold</small></strong></div>`}
      </section><section class="service-bag ui-scroll-area"><div class="service-section-heading"><h3>Inventory</h3></div>${this.sortMarkup('inventory')}<div class="ui-item-grid-scroll"><div class="service-grid inventory-pack"></div></div></section></div>
      <footer class="ui-window-footer"><span class="service-message" role="status"></span><button class="ui-button ui-button--primary" data-confirm disabled>Select an item</button></footer>`;
    this.renderInventoryPack();
    if (owned) this.renderStoragePack();
    else this.selected = {type:'unlockStorage',tab:this.storageTab};
    this.storageDetail();
    this.element.querySelector('.service-storage-pane')!.scrollTop = storageScroll;
    this.element.querySelector('.service-bag')!.scrollTop = bagScroll;
  }
  private storageDetail(): void {
    this.quote = null;
    const button=this.element.querySelector<HTMLButtonElement>('[data-confirm]')!, message=this.element.querySelector<HTMLElement>('.service-message')!;
    button.disabled=true; button.textContent='Select an item'; message.textContent='';
    for (const cell of this.element.querySelectorAll<HTMLElement>('[data-item]')) {
      const entry = this.resolve(cell.dataset.item!);
      cell.classList.toggle('is-selected',Boolean(entry && JSON.stringify(entry.request)===JSON.stringify(this.selected)));
    }
    if (!this.selected) return;
    const result=quoteService(this.player.character,this.npc,this.player.level,this.selected);
    if (!result.ok) {message.textContent=result.message;return;}
    if (this.selected.type==='unlockStorage') {
      this.quote=result.quote; button.textContent=`Unlock tab ${this.storageTab+1} · ${result.quote.price.toLocaleString()} gold`;
      button.disabled=goldBalance(this.player.character)<result.quote.price;
      if(button.disabled)message.textContent='Not enough gold.';
      return;
    }
    if (!result.item || (this.selected.type!=='store' && this.selected.type!=='retrieve')) return;
    this.quote=result.quote;
    const storing=this.selected.type==='store';
    const full=storing?storageTabItems(this.player.character,this.storageTab).filter(Boolean).length>=STASH_CAPACITY:!canPackItem(this.player.character,result.item);
    button.textContent=storing?`Store in tab ${this.storageTab+1}`:'Take item'; button.disabled=full;
    message.textContent=full?storing?'Storage tab full.':packSpaceProblem(this.player.character,result.item):itemDisplayName(result.item);
  }
  private renderSpecial():void {
    this.goldFeedback.stop(); this.hideTooltips(); this.element.classList.remove('is-selling');
    const active=document.activeElement as HTMLElement|null;
    const control=active?.dataset.tab?`[data-tab="${active.dataset.tab}"]`:active?.dataset.gamble?`[data-gamble="${active.dataset.gamble}"]`:active?.hasAttribute('data-confirm')?'[data-confirm]':active?.hasAttribute('data-close')?'[data-close]':null;
    this.element.style.setProperty('--service-color',NPC_COLORS[this.npc.role]);
    this.element.innerHTML=`${this.headerMarkup()}${this.tabsMarkup()}
      <div class="service-body"><section class="service-offer ui-scroll-area"><div class="service-section-heading"><h3>Choose an item type</h3><span>${this.npc.settlementTier??'settlement'} · Lv ${vendorLevel(this.npc,this.player.level)}</span></div>
      <div class="gamble-choices">${GAMBLE_KINDS.map((kind,i)=>`<button class="gamble-choice" data-gamble="${kind}" aria-pressed="${this.selected?.type==='gamble'&&this.selected.kind===kind}"><span>${itemIconSVG(generateItem(i+71,1,kind,undefined,'common'),44)}</span><b>${kind==='head'?'Helmet':kind[0].toUpperCase()+kind.slice(1)}</b><small>${gamblePrice(this.npc,this.player.level,kind).toLocaleString()} gold</small></button>`).join('')}</div><details class="gamble-odds"><summary>Rarity odds</summary><p>${gambleOdds(this.npc).map((w,i)=>`${['Common','Magic','Rare','Epic','Legendary'][i]} ${w}%`).join(' · ')}</p></details>
      <div class="service-detail"></div></section><section class="service-bag ui-scroll-area"><div class="service-section-heading"><h3>Inventory</h3></div>${this.sortMarkup('inventory')}<div class="ui-item-grid-scroll"><div class="service-grid inventory-pack"></div></div></section></div>
      <footer class="ui-window-footer"><span class="service-message" role="status"></span><button class="ui-button ui-button--primary" data-confirm disabled>Choose an item type</button></footer>`;
    this.renderInventoryPack(); this.renderDetail();
    if(control)this.element.querySelector<HTMLElement>(control)?.focus({preventScroll:true});
  }
  private specialDetail():void {
    this.quote=null;const detail=this.element.querySelector<HTMLElement>('.service-detail')!,button=this.element.querySelector<HTMLButtonElement>('[data-confirm]')!;
    button.disabled=true; button.textContent='Choose an item type';
    this.element.querySelector('.service-message')!.textContent='';
    detail.replaceChildren();
    const revealedIndex=this.revealed?this.player.character.inventory.findIndex(item=>item?.id===this.revealed!.id):-1;
    detail.hidden=revealedIndex<0;
    if (revealedIndex>=0) {
      const item=this.player.character.inventory[revealedIndex]!, row=document.createElement('div');
      row.className='gamble-reveal';row.style.setProperty('--item-color',TIER_COLORS[item.tier]);
      row.append(this.cell(item,`bag:${revealedIndex}`));
      const name=document.createElement('span');name.textContent=itemDisplayName(item);name.dataset.item=`bag:${revealedIndex}`;row.append(name);detail.append(row);
    }
    if(!this.selected)return;
    const result=quoteService(this.player.character,this.npc,this.player.level,this.selected);
    if(!result.ok){this.element.querySelector('.service-message')!.textContent=result.message;return;}
    if(!result.item)return;
    this.quote=result.quote;
    button.textContent=`Gamble · ${result.quote.price.toLocaleString()} gold`;
    const full=!canPackItem(this.player.character,result.item);
    button.disabled=full||goldBalance(this.player.character)<result.quote.price;
    if(button.disabled)this.element.querySelector('.service-message')!.textContent=full?packSpaceProblem(this.player.character,result.item):'Not enough gold.';
  }
  private rarityControls(): string {
    return `<div class="service-rarities" aria-label="Select items by rarity">${(['common','magic','rare','epic','legendary','unique'] as ItemTier[]).map(tier=>{
      const items=bulkSaleItems(this.player.character,this.player.level,this.includeActiveCharms).filter(item=>item.tier===tier);
      const selected=items.length>0&&items.every(item=>this.sales.has(item.id));
      return `<button type="button" data-sell-tier="${tier}" aria-pressed="${selected}" ${items.length?'':'disabled'} style="--rarity-color:${TIER_COLORS[tier]}">${TIER_NAMES[tier]} <small>${items.length}</small></button>`;
    }).join('')}<label class="service-include-charms"><input type="checkbox" data-include-charms ${this.includeActiveCharms?'checked':''}> Include active charms</label></div>`;
  }
  /** Mirror the carried pack; empty space and overflow retain their actual positions. */
  private renderInventoryPack(): void {
    const root = this.element.querySelector<HTMLElement>('.service-grid')!;
    root.style.setProperty('--pack-columns', String(PACK_COLUMNS));
    const tabbed=this.merchantLayout||this.tab==='improve';
    if (tabbed) { root.id='service-bag-items'; root.setAttribute('role','tabpanel'); root.setAttribute('aria-labelledby',`service-bag-${this.bagTab}`); }
    const sheet = this.player.character, layout = resolvePackLayout(sheet);
    root.innerHTML = `<div class="character-bag character-tetris" ${tabbed&&this.bagTab==='charms'?'hidden':''} role="group" aria-label="Inventory, ${PACK_COLUMNS} columns by ${PACK_ROWS} rows">
      ${Array.from({length:PACK_CELLS},(_,cell)=>`<span class="character-grid-cell" aria-hidden="true" style="grid-column:${cell%PACK_COLUMNS+1};grid-row:${Math.floor(cell/PACK_COLUMNS)+1}"></span>`).join('')}</div>
      <section class="character-charms" ${tabbed&&this.bagTab==='equipment'?'hidden':''} aria-label="Active charms">${tabbed?'':`<header><span>${uiIcon('diamond')} Charms</span></header>`}<div class="character-charm-grid character-tetris">${Array.from({length:PACK_COLUMNS*CHARM_ROWS},(_,i)=>`<span class="character-grid-cell" aria-hidden="true" style="grid-column:${i%PACK_COLUMNS+1};grid-row:${Math.floor(i/PACK_COLUMNS)+1}"></span>`).join('')}</div></section>
      <section class="character-overflow" hidden><header>Pack overflow <small>Make space to carry these items</small></header><div class="character-overflow-items"></div></section>`;
    const bag = root.querySelector<HTMLElement>('.character-bag')!, overflow = root.querySelector<HTMLElement>('.character-overflow-items')!;
    sheet.inventory.forEach((item,index)=>{
      if (!item || tabbed && (item.kind==='charm') !== (this.bagTab==='charms')) return;
      const cell = this.cell(item, `bag:${index}`), position = layout[item.id], size = itemFootprint(item);
      cell.classList.add('character-bag-slot');
      cell.style.gridColumn = position === undefined ? `span ${size.width}` : `${position % PACK_COLUMNS + 1} / span ${size.width}`;
      cell.style.gridRow = position === undefined ? `span ${size.height}` : `${Math.floor((position >= PACK_CELLS ? position-PACK_CELLS : position) / PACK_COLUMNS) + 1} / span ${size.height}`;
      cell.querySelector('svg')?.remove(); cell.insertAdjacentHTML('afterbegin', itemPackIconSVG(item,size.width,size.height));
      (position === undefined ? overflow : position>=PACK_CELLS ? root.querySelector<HTMLElement>('.character-charm-grid')! : bag).append(cell);
    });
    root.querySelector<HTMLElement>('.character-overflow')!.hidden = !overflow.childElementCount;
  }

  private sortMarkup(target: 'storage' | 'inventory'): string {
    return `<div class="character-pack-toolbar"><button type="button" class="ui-button character-auto-sort" data-sort-pack="${target}" aria-label="Auto-sort ${target === 'storage' ? 'chest' : 'inventory'}">${uiIcon('sortFilter')} Auto-sort</button></div>`;
  }

  private renderStoragePack(): void {
    const root = this.element.querySelector<HTMLElement>('.service-storage')!;
    const items = storageTabItems(this.player.character,this.storageTab), layout = storageGridLayout(items);
    layout.rows = Math.max(12,layout.rows);
    root.style.setProperty('--pack-columns', String(PACK_COLUMNS));
    root.innerHTML = `<div class="character-bag character-tetris" role="group" aria-label="Stored items, ${PACK_COLUMNS} columns" style="grid-template-rows:repeat(${layout.rows},var(--pack-cell))">
      ${Array.from({length:layout.rows*PACK_COLUMNS},(_,cell)=>`<span class="character-grid-cell" aria-hidden="true" style="grid-column:${cell%PACK_COLUMNS+1};grid-row:${Math.floor(cell/PACK_COLUMNS)+1}"></span>`).join('')}</div>`;
    const grid = root.firstElementChild!;
    items.forEach((item, slot) => {
      const position = layout.cells[slot];
      if (!item || position === null) return;
      const cell = this.cell(item, `stash:${this.storageTab * STASH_CAPACITY + slot}`), size = itemFootprint(item);
      cell.classList.add('character-bag-slot');
      cell.style.gridColumn = `${position % PACK_COLUMNS + 1} / span ${size.width}`;
      cell.style.gridRow = `${Math.floor(position / PACK_COLUMNS) + 1} / span ${size.height}`;
      cell.querySelector('svg')?.remove();
      cell.insertAdjacentHTML('afterbegin', itemPackIconSVG(item, size.width, size.height));
      grid.append(cell);
    });
  }

  private cell(item: Item | null, key: string): HTMLButtonElement {
    const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'ui-slot'; cell.dataset.item = key;
    updateItemSlot(cell, item, { level: this.player.level, draggable: this.canDragTrade(key), emptyMarkup: '', label: item ? itemDisplayName(item) : 'Empty slot' });
    cell.disabled = !item; return cell;
  }
  private canDragTrade(key:string): boolean {
    return this.npc.role!=='stash' && (this.tab==='sell'||this.tab==='buyback'||this.tab==='shop'&&this.npc.role!=='gambler')
      && /^(bag|stock|buyback):/.test(key);
  }
  private directTrade(key:string): {item:Item;quote:ServiceQuote|null;problem:string}|null {
    if(!this.canDragTrade(key))return null;
    const value=this.resolve(key);if(!value)return null;
    const request:ServiceRequest=key.startsWith('bag:')?{type:'sell',source:{bag:Number(key.split(':')[1])}}:value.request;
    const result=quoteService(this.player.character,this.npc,this.player.level,request);
    const buying=request.type==='buy'||request.type==='buyback';
    const problem=!result.ok?result.message:buying&&goldBalance(this.player.character)<result.quote.price?'Not enough gold.':buying&&!canPackItem(this.player.character,value.item)?packSpaceProblem(this.player.character,value.item):'';
    return {item:value.item,quote:result.ok?result.quote:null,problem};
  }
  private clearTradeDrag(): void {
    if(this.tradeDrag){const message=this.element.querySelector('.service-message');if(message)message.textContent=this.tradeDrag.message;}
    this.tradeDrag=null;
    this.element.classList.remove('is-trade-dragging');
    for(const node of this.element.querySelectorAll<HTMLElement>('.is-trade-source,.is-trade-destination')){
      node.classList.remove('is-trade-source','is-trade-destination','is-trade-over','is-trade-invalid');
      delete node.dataset.dropCaption;
    }
  }
  private installTradeDrag(): void {
    const options={signal:this.abort.signal};
    this.element.addEventListener('dragstart',event=>{
      this.clearTradeDrag();
      const cell=event.target instanceof Element?event.target.closest<HTMLElement>('[data-item]'):null;
      const trade=cell&&!this.saving?this.directTrade(cell.dataset.item!):null;
      if(!trade||!event.dataTransfer){event.preventDefault();return;}
      const selling=cell!.dataset.item!.startsWith('bag:');
      const target=selling?'.service-offer':'.service-bag';
      const destination=this.element.querySelector<HTMLElement>(target);
      if(!destination){event.preventDefault();return;}
      const message=this.element.querySelector('.service-message')!;
      this.tradeDrag={id:trade.item.id,quote:trade.quote,target,problem:trade.problem,message:message.textContent??''};
      this.hideTooltips();
      event.dataTransfer.setData('application/x-evergrow-trade',trade.item.id);
      event.dataTransfer.effectAllowed='move';
      cell!.classList.add('is-trade-source');this.element.classList.add('is-trade-dragging');
      destination.classList.add('is-trade-destination');
      destination.classList.toggle('is-trade-invalid',!!trade.problem);
      destination.dataset.dropCaption=trade.problem||`Drop to ${selling?'sell':'buy'} · ${trade.quote!.price.toLocaleString()} gold`;
      message.textContent=`${itemDisplayName(trade.item)} · ${destination.dataset.dropCaption}`;
    },options);
    this.element.addEventListener('dragover',event=>{
      const drag=this.tradeDrag;if(!drag)return;
      const destination=this.element.querySelector(drag.target)!;
      const over=event.target instanceof Node&&destination.contains(event.target);
      destination.classList.toggle('is-trade-over',over);
      const valid=over&&!drag.problem&&!this.saving;
      if(event.dataTransfer)event.dataTransfer.dropEffect=valid?'move':'none';
      if(valid)event.preventDefault();
    },options);
    this.element.addEventListener('dragleave',event=>{
      if(!this.tradeDrag)return;
      const destination=this.element.querySelector(this.tradeDrag.target);
      if(!(event.relatedTarget instanceof Node)||!destination?.contains(event.relatedTarget))destination?.classList.remove('is-trade-over');
    },options);
    this.element.addEventListener('drop',event=>{
      const drag=this.tradeDrag;if(!drag)return;
      event.preventDefault();
      const destination=this.element.querySelector(drag.target);
      const valid=!this.saving&&!drag.problem&&drag.quote&&event.target instanceof Node&&destination?.contains(event.target)
        &&event.dataTransfer?.getData('application/x-evergrow-trade')===drag.id;
      this.clearTradeDrag();this.ignoreClickUntil=Date.now()+200;
      if(valid){this.selected=drag.quote!.request;this.quote=drag.quote;void this.confirm();}
    },options);
    this.element.addEventListener('dragend',()=>{this.clearTradeDrag();this.ignoreClickUntil=Date.now()+200;},options);
    // A quick purchase also works without dragging. Single click remains inspection.
    this.element.addEventListener('dblclick',event=>{
      if(this.saving||this.tradeDrag||Date.now()<this.ignoreClickUntil)return;
      const cell=event.target instanceof Element?event.target.closest<HTMLElement>('[data-item]'):null;
      if(!cell||! /^(stock|buyback):/.test(cell.dataset.item!))return;
      const trade=this.directTrade(cell.dataset.item!);if(!trade)return;
      event.preventDefault();this.hideTooltips();
      if(trade.problem){this.element.querySelector('.service-message')!.textContent=trade.problem;return;}
      this.selected=trade.quote!.request;this.quote=trade.quote;void this.confirm();
    },options);
  }
  private resolve(key: string): { item: Item; source?: ItemSource; request: ServiceRequest } | null {
    const [type, value] = key.split(':'); let item: Item | null = null, request: ServiceRequest;
    if(type==='stash'){item=this.player.character.stash?.[Number(value)]??null;request={type:'retrieve',slot:Number(value)};}
    else if (type === 'stock') { item = this.currentStock()[Number(value)] ?? null; request = { type: 'buy', slot: Number(value) }; }
    else if (type === 'buyback') { item = this.player.character.commerce.buyback[Number(value)]?.item ?? null; request = { type: 'buyback', id: item?.id ?? '' }; }
    else {
      const source: ItemSource = type === 'bag' ? { bag: Number(value) } : { equipped: value as EquipmentSlot };
      item = sourceItem(this.player.character, source);
      request = this.npc.role==='stash'&&type==='bag'?{type:'store',bag:Number(value),tab:this.storageTab}:this.tab === 'improve' || type === 'equipped' ? { type: 'improve', source, operation: this.operation, affix: 0 } : { type: 'sell', source };
      return item ? { item, request, source } : null;
    }
    return item ? { item, request } : null;
  }
  private hover(target: EventTarget | null): void {
    if(this.tradeDrag||this.saving)return;
    if (target instanceof Element && target.closest('[data-enhance-rank]')) { this.tooltip.hide(); return; }
    if(document.documentElement.classList.contains('touch-mode')) return;
    const cell = target instanceof HTMLElement ? target.closest<HTMLButtonElement>('[data-item]') : null;
    if (!cell) return;
    this.rankTips.hide();
    const value = this.resolve(cell.dataset.item!); if (!value) return;
    this.tooltip.show(value.item, { sheet: this.player.character, level: this.player.level,
      sourceIndex: value.source && 'bag' in value.source ? value.source.bag : undefined,
      equipped: Boolean(value.source && 'equipped' in value.source),
      context: value.request.type === 'buyback' ? `Buy back · ${this.player.character.commerce.buyback.find(b=>b.item.id===value.item.id)?.price??0} gold` : value.request.type === 'buy' ? `Buy · ${itemPrice(value.item, 'buy')} gold` : undefined }, cell);
  }
  private click(e: MouseEvent): void {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('[data-skip-enhancement]')) {
      const saved = this.enhancementPreference.setSkip((target as HTMLInputElement).checked);
      if (this.enhancementPreference.skip) {
        this.element.classList.add('forge-instant');
        this.enhancement.skip();
      }
      if (!saved) this.element.querySelector('.service-message')!.textContent = 'Animation preference applies for this session.';
      return;
    }
    if (target?.closest('[data-cancel-charge]')) { this.enhancement.cancel(); return; }
    if (target?.closest('[data-close]')) { this.actions.close(); return; }
    if (this.saving || this.tradeDrag || Date.now()<this.ignoreClickUntil) return;
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button, input[data-include-charms]'); if (!button) return;
    if (button.hasAttribute('data-clear-enhance') && this.tab==='improve' && this.operation==='enhance') {
      // Don't let render restore pointer focus to an item and reopen its tooltip.
      this.element.focus({preventScroll:true});
      this.selected=null; this.quote=null;
      this.render();
      if (e.detail===0) {
        // Keyboard activation keeps a useful navigation position, without inspecting.
        this.element.querySelector<HTMLElement>(`.service-bag [data-item="${button.dataset.item}"]`)?.focus({preventScroll:true});
      }
      this.hideTooltips();
      return;
    }
    if (button.dataset.bagTab==='equipment'||button.dataset.bagTab==='charms') {
      this.bagTab=button.dataset.bagTab; this.render();
      this.element.querySelector<HTMLElement>(`[data-bag-tab="${this.bagTab}"]`)?.focus({preventScroll:true}); return;
    }
    if(button.dataset.operation && ENCHANT_OPERATIONS.includes(button.dataset.operation as typeof ENCHANT_OPERATIONS[number])) {
      this.operation=button.dataset.operation as Improvement; this.updateSelection(); this.render(); return;
    }
    if(button.dataset.affix !== undefined && this.selected?.type==='improve') {
      this.selected.affix=Number(button.dataset.affix); this.renderDetail();
      this.element.querySelector<HTMLElement>(`[data-affix="${this.selected.affix}"]`)?.focus({preventScroll:true}); return;
    }
    if(button.dataset.affixFocus && AFFIX_FOCUSES.includes(button.dataset.affixFocus as AffixFocus) && this.selected?.type==='improve') {
      this.selected.focus=button.dataset.affixFocus as AffixFocus; this.renderDetail();
      this.element.querySelector<HTMLElement>(`[data-affix-focus="${this.selected.focus}"]`)?.focus({preventScroll:true}); return;
    }
    if(button.dataset.stockCategory&&STOCK_CATEGORIES.includes(button.dataset.stockCategory as StockCategory)){
      this.shopCategory=button.dataset.stockCategory as StockCategory;this.selected=null;this.render();
      this.element.querySelector<HTMLElement>(`[data-stock-category="${this.shopCategory}"]`)?.focus({preventScroll:true});return;
    }
    if(button.hasAttribute('data-refresh-stock')){
      const result=quoteService(this.player.character,this.npc,this.player.level,{type:'refreshStock'});
      if(result.ok){this.quote=result.quote;void this.confirm();}return;
    }
    if (button.hasAttribute('data-close')) { this.actions.close(); return; }
    if (button.dataset.storageTab !== undefined) {
      const tab=Number(button.dataset.storageTab);
      if (!Number.isInteger(tab)||tab<0||tab>=MAX_STORAGE_TABS||tab>storageTabCount(this.player.character)) return;
      this.storageTab=tab; this.selected=null; this.quote=null; this.render();
      this.element.querySelector<HTMLElement>(`[data-storage-tab="${tab}"]`)?.focus({preventScroll:true});
      return;
    }
    if (button.dataset.sortPack === 'storage' || button.dataset.sortPack === 'inventory') {
      const target = button.dataset.sortPack;
      this.hideTooltips();
      if (this.selected?.type !== 'gamble') this.selected = null;
      this.quote = null; this.sales.clear();
      this.actions.sort(target,this.storageTab);
      this.render();
      this.element.querySelector<HTMLElement>(`[data-sort-pack="${target}"]`)?.focus({preventScroll:true});
      return;
    }
    if(button.dataset.gamble){
      this.gambleKind=button.dataset.gamble as ItemKind;
      this.selected={type:'gamble',kind:this.gambleKind};
      this.element.querySelectorAll<HTMLButtonElement>('[data-gamble]').forEach(choice=>choice.setAttribute('aria-pressed',String(choice.dataset.gamble===this.gambleKind)));
      this.renderDetail(); return;
    }
    if(button.hasAttribute('data-clear-sales')) { this.sales.clear(); this.render(); return; }
    if(button.hasAttribute('data-include-charms')) { this.includeActiveCharms=(button as unknown as HTMLInputElement).checked; this.sales.clear(); this.render(); return; }
    if(button.dataset.sellTier) {
      const eligible=new Set(bulkSaleItems(this.player.character,this.player.level,this.includeActiveCharms).map(i=>i.id));
      const items=this.player.character.inventory.flatMap((item,bag)=>item&&eligible.has(item.id)&&item.tier===button.dataset.sellTier?[{item,bag}]:[]);
      const remove=items.every(({item})=>this.sales.has(item.id));
      for(const {item,bag} of items) { if(remove)this.sales.delete(item.id); else this.sales.set(item.id,{bag,id:item.id,revision:item.recipe.revision}); }
      this.render(); return;
    }
    if (button.dataset.respecKind === 'skills' || button.dataset.respecKind === 'attributes') { this.respecKind = button.dataset.respecKind; this.renderRespec(); this.element.querySelector<HTMLButtonElement>(`[data-respec-kind="${this.respecKind}"]`)?.focus(); return; }
    if (button.dataset.tab) { this.tab = button.dataset.tab as typeof this.tab; this.updateSelection(); this.render(); return; }
    if (button.dataset.item) {
      if(this.npc.role==='stash'&&!hasStorageTab(this.player.character,this.storageTab))return;
      const value = this.resolve(button.dataset.item); if (!value) return;
      if(this.npc.role==='gambler'&&this.tab==='shop')return;
      if(this.merchantLayout&&this.tab!=='improve'&&value.source&&'equipped' in value.source) {
        this.tooltip.show(value.item,{sheet:this.player.character,level:this.player.level,equipped:true},button);return;
      }
      if(this.tab === 'sell' && value.item.locked){this.element.querySelector('.service-message')!.textContent='Unlock this item in your inventory before selling it.';return;}
      if(this.tab === 'sell' && value.source && 'bag' in value.source) {
        if(this.sales.has(value.item.id)) this.sales.delete(value.item.id);
        else this.sales.set(value.item.id,{bag:value.source.bag,id:value.item.id,revision:value.item.recipe.revision});
        this.renderDetail(); this.syncRarities();
        if(!button.isConnected)this.element.querySelector<HTMLElement>(`.service-grid [data-item="bag:${value.source.bag}"]`)?.focus({preventScroll:true});
        return;
      }
      this.selected = value.request;
      if (value.source && 'equipped' in value.source && this.tab !== 'improve') { this.tab = 'improve'; this.render(); }
      else this.renderDetail();
      if (e.shiftKey && this.tab !== 'improve') this.confirm();
    }
    if (button.hasAttribute('data-confirm')) this.confirm();
  }
  private renderDetail(): void {
    this.hideTooltips();
    if(this.tab==='respec'){this.renderRespec();return;}
    if(this.npc.role==='stash'){this.storageDetail();return;}
    if(this.npc.role==='gambler'&&this.tab==='shop'){this.specialDetail();return;}
    this.quote = null; const selected = this.selected;
    const detail = this.element.querySelector<HTMLElement>('.service-detail')!, button = this.element.querySelector<HTMLButtonElement>('[data-confirm]')!;
    const message = this.element.querySelector<HTMLElement>('.service-message')!; message.textContent = '';
    const purchase=this.element.querySelector<HTMLElement>('.service-purchase-summary');if(purchase){purchase.hidden=true;purchase.replaceChildren();}
    detail.replaceChildren(); detail.hidden=this.tab!=='sell'&&this.tab!=='improve';
    button.disabled = true; button.textContent = 'Choose an item';
    if (this.tab === 'sell') { this.renderSales(detail, button, message); return; }
    if (selected?.type === 'sellMany') return;
    if (!selected) { detail.hidden=true; if(this.tab==='improve'&&this.operation==='enhance')this.renderEnhancement(detail,null,null); else if(this.tab==='improve')this.renderEnchantment(detail,null,false); return; }
    for (const cell of this.element.querySelectorAll<HTMLElement>('[data-item]')) {
      const entry = this.resolve(cell.dataset.item!);
      cell.classList.toggle('is-selected', Boolean(entry && (entry.request.type==='improve'&&selected.type==='improve' ? JSON.stringify(entry.request.source)===JSON.stringify(selected.source) : JSON.stringify(entry.request)===JSON.stringify(selected))));
    }
    const result = quoteService(this.player.character, this.npc, this.player.level, selected);
    if (!result.ok) { detail.hidden=true; message.textContent=result.message; if(selected.type==='improve'&&selected.operation==='enhance')this.renderEnhancement(detail,sourceItem(this.player.character,selected.source),null,result.message); else if(selected.type==='improve')this.renderEnchantment(detail,sourceItem(this.player.character,selected.source),false,result.message); return; }
    const { item, quote } = result; if(!item)return; this.quote = quote;
    const buying = selected.type === 'buy' || selected.type === 'buyback', improving = selected.type === 'improve';
    const label = improving ? OP_LABELS[selected.operation] : buying ? 'Buy' : 'Sell';
    button.textContent = `${label} · ${quote.price.toLocaleString()} gold`;
    button.disabled = selected.type !== 'sell' && goldBalance(this.player.character) < quote.price;
    message.textContent = button.disabled ? 'Not enough gold.' : purchase ? '' : itemDisplayName(item);
    if(buying&&!canPackItem(this.player.character,item)){button.disabled=true;message.textContent=packSpaceProblem(this.player.character,item);}
    if (!improving) {
      if(purchase){
        const balance=goldBalance(this.player.character)+(buying?-quote.price:quote.price);
        purchase.hidden=false;
        purchase.innerHTML=`<span style="color:${TIER_COLORS[item.tier]}">${escapeUI(itemDisplayName(item))}</span><span>${balance<0?'Short by':buying?'Remaining':'After sale'} <b class="${balance<0?'is-short':''}">${Math.abs(balance).toLocaleString()} gold</b></span>`;
      }
      return;
    }
    const op = selected.operation;
    if(op==='enhance'){this.renderEnhancement(detail,item,improveItem(item,op,vendorLevel(this.npc,this.player.level),1));return;}
    this.renderEnchantment(detail,item,true);
  }
  private renderEnchantment(detail:HTMLElement,item:Item|null,valid:boolean,problem=''): void {
    detail.hidden=false;
    const op=this.operation, selected=this.selected?.type==='improve'?this.selected:null;
    const source=selected?.source, key=source?('bag' in source?`bag:${source.bag}`:`equipped:${source.equipped}`):'';
    const reroll=op==='rerollOne'||op==='rerollAll';
    const next=item&&valid&&!reroll?improveItem(item,op,vendorLevel(this.npc,this.player.level),1):null;
    const added=item&&next?itemAffixCount(next)-item.affixes.length:0;
    const transition=item&&next?(op==='rarity'?`${TIER_NAMES[item.tier]} <i>→</i> <strong style="color:${TIER_COLORS[next.tier]}">${TIER_NAMES[next.tier]}</strong>`:`Lv ${item.itemLevel} <i>→</i> <strong>Lv ${next.itemLevel}</strong>`):reroll?'Reshape its magic':'';
    detail.innerHTML=`<div class="enhance-showcase enchant-showcase" style="--item-color:${item?TIER_COLORS[item.tier]:'#a6b6ca'}">
      <div class="enhance-halo" aria-hidden="true"></div>
      ${item?`<button class="enhance-art" data-item="${key}" aria-label="Inspect ${escapeUI(itemDisplayName(item))}">${itemPackIconSVG(item,itemFootprint(item).width,itemFootprint(item).height)}</button>`:`<div class="enhance-empty-emblem">${npcEmblem('enchanter')}</div>`}
      <span class="enhance-kicker">${item?`${TIER_NAMES[item.tier]} · Item level ${item.itemLevel}`:'The enchanting table'}</span>
      <h3>${item?escapeUI(itemDisplayName(item)):'Choose an item'}</h3>
      ${item?`<div class="enchant-transition">${transition}</div>`:'<p>Select equipped gear or a piece from your inventory.</p>'}
    </div>`;
    if(!item)return;
    if(problem)detail.innerHTML+=`<p class="enchant-note">${escapeUI(problem)}</p>`;
    if(op==='relevel') {
      if(next){const gains=enhancementGains(item,next);detail.innerHTML+=`<div class="enhance-gains"><div class="enhance-gains-heading"><span>Item improvement</span><span>Current</span><span>After</span><span>Gain</span></div>${gains.map(row=>`<div><span>${escapeUI(row.label)}</span><span>${row.before}</span><strong>${row.after}</strong><em>${row.gain}</em></div>`).join('')}</div><p class="enchant-note">Requires level ${next.requiredLevel}. Affix types and roll quality stay the same.</p>`;}
      return;
    }
    detail.innerHTML+=`<div class="enchant-affix-heading"><span>${op==='rerollOne'?'Choose an affix to replace':'Affixes'}</span><small>${reroll?'Random result':'Existing rolls retained'}</small></div><div class="enchant-affixes">${item.affixes.map((affix,index)=>{
      const replacing=op==='rerollAll'||op==='rerollOne'&&index===this.selectedAffix();
      const tag=op==='rerollOne'?'button':'div';
      const after=next?.affixes[index];
      return `<${tag} class="enchant-affix ${replacing?'is-replacing':''}" ${tag==='button'?`type="button" data-affix="${index}" aria-pressed="${replacing}"`:''}><span class="enchant-affix-mark" aria-hidden="true">${replacing?'↻':'◇'}</span><span>${isGreaterAffix(item,index)?GREATER_AFFIX_SYMBOL+' ':''}${escapeUI(STAT_LABELS[affix.stat])}<small>${replacing?'Will be replaced':reroll?'Kept':'Retained'}</small></span><b>${formatStatValue(affix.stat,affix.value)}${after&&after.value!==affix.value?` <i>→</i> ${formatStatValue(after.stat,after.value)}`:''}</b></${tag}>`;
    }).join('')}${added>0?Array.from({length:added},()=>'<div class="enchant-affix enchant-new-affix"><span class="enchant-affix-mark">+</span><span>New random affix<small>Revealed after enchanting</small></span><b>?</b></div>').join(''):!item.affixes.length?'<p class="enchant-note">No affixes on this item.</p>':''}</div>`;
    if(reroll&&item.affixes.length){
      const pool=rerollPool(item,op==='rerollOne'?this.selectedAffix():undefined,selected?.focus);
      const focusPool=op==='rerollAll'&&item.affixes.length>1?itemAffixPool(item):pool;
      const total=pool.reduce((sum,a)=>sum+(a.weight??1),0);
      if(this.npc.settlementTier==='city')detail.innerHTML+=`<div class="enchant-affix-heading"><span>Favor a group</span><small>3× weight · +75% cost</small></div><nav class="enchant-focus" aria-label="Affix preference">${AFFIX_FOCUSES.map(f=>`<button class="ui-button ui-button--quiet" data-affix-focus="${f}" aria-pressed="${f===(selected?.focus??'any')}" ${f!=='any'&&(!focusPool.some(a=>affixCategory(a.stat)===f)||!focusPool.some(a=>affixCategory(a.stat)!==f))?'disabled':''}>${f==='any'?'Any':f[0].toUpperCase()+f.slice(1)}</button>`).join('')}</nav>`;
      detail.innerHTML+=`<p class="enchant-note">${op==='rerollOne'?'Only the selected affix changes.':'All affixes are replaced.'} Rolls can be better or worse.${item.kind==='charm'?' The first affix keeps the stone’s theme.':''}</p><details class="enchant-pool"><summary>Possible affixes & odds</summary>${op==='rerollAll'?'<p class="enchant-note">First roll odds; later rolls exclude conflicts.</p>':''}<div class="service-pool-odds">${pool.map(a=>`<div><span>${escapeUI(STAT_LABELS[a.stat])}</span><b>${((a.weight??1)/total*100).toFixed(1)}%</b></div>`).join('')}</div></details>`;
    } else if(op==='rarity'&&added>0) {
      detail.innerHTML+=`<details class="enchant-pool"><summary>Possible new affixes</summary><div class="enchant-pool-tags">${rerollPool(item,item.affixes.length).map(a=>`<span>${escapeUI(STAT_LABELS[a.stat])}</span>`).join('')}</div></details>`;
    }
  }
  private syncRarities(): void {
    for(const button of this.element.querySelectorAll<HTMLButtonElement>('[data-sell-tier]')) {
      const items=bulkSaleItems(this.player.character,this.player.level,this.includeActiveCharms).filter(item=>item.tier===button.dataset.sellTier);
      button.setAttribute('aria-pressed',String(items.length>0&&items.every(item=>this.sales.has(item!.id))));
    }
  }
  private renderSales(detail:HTMLElement, button:HTMLButtonElement, message:HTMLElement): void {
    const items=[...this.sales.values()].sort((a,b)=>a.bag-b.bag);
    for(const cell of this.element.querySelectorAll<HTMLButtonElement>('[data-item]')) {
      const entry=this.resolve(cell.dataset.item!);const selected=!!entry&&this.sales.has(entry.item.id);
      cell.classList.toggle('is-selected',selected);cell.setAttribute('aria-pressed',String(selected));
    }
    const clear=this.element.querySelector<HTMLButtonElement>('[data-clear-sales]');if(clear)clear.disabled=!items.length;
    if(!items.length){detail.innerHTML='<div class="service-sale-empty"><strong>No items selected</strong><span>Select from your inventory or use a rarity filter.</span></div>';button.textContent='Select items';return;}
    const result=quoteService(this.player.character,this.npc,this.player.level,{type:'sellMany',items,includeActiveCharms:true});
    if(!result.ok){detail.innerHTML=`<p class="service-empty">${escapeUI(result.message)}</p>`;return;}
    this.quote=result.quote;
    button.disabled=false;button.textContent=`Sell ${items.length} · ${result.quote.price.toLocaleString()} gold`;
    detail.innerHTML=`<div class="service-sale-total"><span>${items.length} ${items.length===1?'item':'items'}</span><strong>+${result.quote.price.toLocaleString()} <small>gold</small></strong></div><div class="service-sale-list">${items.map(({bag})=>{
      const item=this.player.character.inventory[bag]!;
      return `<button class="service-sale-row" data-item="bag:${bag}" aria-label="Remove ${escapeUI(itemDisplayName(item))} from sale"><span class="service-sale-icon">${itemIconSVG(item,36)}</span><span style="color:${TIER_COLORS[item.tier]}">${escapeUI(itemDisplayName(item))}</span><small>${itemPrice(item,'sell').toLocaleString()}</small><i aria-hidden="true">×</i></button>`;
    }).join('')}</div>`;
    message.textContent=items.length>12?'Only the last 12 items remain in Buyback.':'Items remain available in Buyback.';
  }
  private selectedAffix() { return this.selected?.type === 'improve' ? this.selected.affix ?? 0 : 0; }
  private setForgePhase(phase: EnhancementPhase): void {
    this.element.dataset.forgeState = phase;
    const button = this.element.querySelector<HTMLButtonElement>('[data-confirm]')!;
    button.disabled = true;
    button.textContent = phase === 'charging' ? 'Enhancing…' : 'Finishing…';
    const cancel=this.element.querySelector<HTMLButtonElement>('[data-cancel-charge]')!;
    cancel.hidden=phase!=='charging';
    if (phase==='charging') cancel.focus({preventScroll:true});
    this.element.querySelector('.service-message')!.textContent='';
  }
  private async confirmEnhancement(quote: ServiceQuote): Promise<void> {
    if (quote.request.type !== 'improve') return;
    const before = sourceItem(this.player.character, quote.request.source);
    if (!before || goldBalance(this.player.character) < quote.price) return;
    const session = this.sessionVersion;
    const source = quote.request.source;
    const animate = !this.enhancementPreference.skip && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderDetail();
    this.saving = true;
    this.hideTooltips();
    this.element.classList.toggle('forge-instant', !animate);
    const duration = ENHANCEMENT_CHARGE_MS;
    this.element.style.setProperty('--forge-duration', `${duration}ms`);
    this.element.setAttribute('aria-busy', 'true');
    for (const pane of this.element.querySelectorAll<HTMLElement>('.service-tabs, .service-bag, .service-detail')) pane.inert = true;
    this.element.querySelector<HTMLElement>('.forge-result')!.hidden = true;
    if (animate) this.actions.enhancementSound?.('charge');
    const result = await this.enhancement.run(() => this.actions.trade(quote), animate, phase => this.setForgePhase(phase), duration);
    if (session !== this.sessionVersion || this.element.hidden) return;
    const instant = this.element.classList.contains('forge-instant');
    this.saving = false;
    this.render();
    this.element.classList.toggle('forge-instant', instant);
    if (!result) { this.element.querySelector<HTMLButtonElement>('[data-confirm]')?.focus({preventScroll:true}); return; }
    const receipt = this.element.querySelector<HTMLElement>('.forge-result')!;
    receipt.hidden = false;
    receipt.tabIndex = -1;
    if (result.ok) {
      const after = sourceItem(this.player.character, source)!;
      const gains = enhancementGains(before, after);
      receipt.innerHTML = `<span class="forge-result-mark" aria-hidden="true">✦</span><div><strong>${after.recipe.enhancement === 10 ? 'Fully enhanced' : 'Enhancement complete'} <b>+${after.recipe.enhancement}</b></strong><p>${gains.map(row => `${escapeUI(row.label)} <b>${row.gain}</b>`).join(' · ')}</p></div>`;
      this.element.dataset.forgeState = 'success';
      this.element.querySelector('.service-message')!.textContent = '';
      this.actions.enhancementSound?.('success');
    } else {
      receipt.innerHTML = '<span class="forge-result-mark" aria-hidden="true">!</span><div><strong>Enhancement not completed</strong><p>Your item and gold are unchanged.</p></div>';
      this.element.dataset.forgeState = 'error';
      this.element.querySelector('.service-message')!.textContent = result.message;
      this.actions.enhancementSound?.('error');
    }
    const button = this.element.querySelector<HTMLButtonElement>('[data-confirm]')!;
    (button.disabled ? receipt : button).focus({ preventScroll: true });
  }
  private async confirm(): Promise<void> {
    if (this.saving || !this.quote) return;
    if (this.quote.request.type === 'improve' && this.quote.request.operation === 'enhance') {
      await this.confirmEnhancement(this.quote); return;
    }
    const refreshing=this.quote.request.type==='refreshStock';
    const gamble=this.quote.request.type==='gamble',revealedId=this.quote.itemId;
    const sale = this.quote.request.type === 'sell' || this.quote.request.type === 'sellMany';
    const soldItems = this.quote.request.type === 'sellMany' ? this.quote.request.items : this.quote.request.type === 'sell' && 'bag' in this.quote.request.source ? [{bag:this.quote.request.source.bag}] : [];
    const origins = soldItems.map(({bag})=>this.element.querySelector(`.service-grid [data-item="bag:${bag}"]`)?.getBoundingClientRect()).filter((r):r is DOMRect=>!!r&&r.width>0&&r.height>0).map(r=>({x:r.x+r.width/2,y:r.y+r.height/2}));
    const proceeds = sale ? this.quote.price : 0;
    this.saving = true;
    const button = this.element.querySelector<HTMLButtonElement>('[data-confirm]')!;
    button.disabled = true; button.textContent = 'Saving…';
    let result: { ok: boolean; message: string };
    try { result = await this.actions.trade(this.quote); }
    catch { result = { ok: false, message: 'Could not complete the save. No purchase was committed.' }; }
    finally { this.saving = false; }
    if (this.element.hidden) return;
    this.hideTooltips();
    if (result.ok) {
      if(gamble)this.revealed=this.player.character.inventory.find(i=>i?.id===revealedId)??null;
      this.sales.clear(); const keep = gamble || this.selected?.type === 'improve'; if (!keep) this.selected = null;
      if (gamble) {
        // Keep the choices and action button mounted for rapid repeat purchases.
        this.renderInventoryPack();
        this.element.querySelector('[data-wallet-total]')!.textContent=goldBalance(this.player.character).toLocaleString();
        this.renderDetail();
      } else this.render();
      this.element.classList.remove('service-success'); void this.element.offsetWidth; this.element.classList.add('service-success');
      if(refreshing)this.element.querySelector<HTMLElement>('[data-refresh-stock]')?.focus({preventScroll:true});
      if(proceeds>0)this.goldFeedback.play(proceeds,goldBalance(this.player.character),origins);
    } else this.renderDetail();
    const message=this.element.querySelector('.service-message')!;
    if(!result.ok || !message.textContent) message.textContent = result.message;
  }
}
