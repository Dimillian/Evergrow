import { isGreaterAffix, GREATER_AFFIX_SYMBOL } from './item-roll-content.ts';
import { STOCK_CATEGORIES, STOCK_CATEGORY_NAMES, stockCategory, enhancementGains, type StockCategory } from './service-presentation.ts';
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
import { RESPEC_GOLD_PER_POINT, respecPoints, attributeResetPoints, GAMBLE_KINDS, gambleOdds, vendorRefreshPrice, gamblePrice, STASH_CAPACITY, vendorStock, vendorStockLevel, quoteService, sourceItem, itemPrice, stockEpoch, type ServiceQuote, type ServiceRequest, type ItemSource, type SaleItem } from './commerce.ts';
import { improveItem, rerollPool, affixCategory, AFFIX_FOCUSES, type AffixFocus, type Improvement } from './item-improvement.ts';
import { updateItemSlot } from './item-ui.ts';
import { ItemTooltip } from './item-tooltip.ts';
import { itemIconSVG, itemPackIconSVG } from './item-art.ts';
import { generateItem, EQUIPMENT_SLOTS, TIER_COLORS, TIER_NAMES, STAT_LABELS, itemAffixPool, itemDisplayName, formatStatValue } from './items.ts';
import { goldBalance } from './wallet.ts';
import { escapeUI, trapDialogFocus, uiIcon } from './ui-components.ts';
import { ServiceGoldFeedback } from './service-gold-feedback.ts';
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
  private saving = false;
  private gambleKind: ItemKind | null = null;
  private revealed:Item|null=null;
  private abort = new AbortController();
  private focus: { dispose(): void } | null = null;
  private actions: { close(): void; sort(target: 'storage' | 'inventory', tab?: number): void; trade(quote: ServiceQuote): Promise<{ ok: boolean; message: string }> };
  constructor(mount: HTMLElement, actions: ServicePanel['actions']) {
    this.actions = actions;
    this.element = document.createElement('section'); this.element.className = 'service-panel ui-window'; this.element.hidden = true;
    this.element.setAttribute('role', 'dialog'); this.element.setAttribute('aria-modal', 'true'); this.element.setAttribute('aria-labelledby', 'service-title');
    mount.append(this.element); this.goldFeedback = new ServiceGoldFeedback(this.element); this.tooltip = new ItemTooltip(mount, 'service-tooltip');
    this.element.addEventListener('click', e => this.click(e), { signal: this.abort.signal });
    this.element.addEventListener('pointerover', e => this.hover(e.target), { signal: this.abort.signal });
    this.element.addEventListener('focusin', e => this.hover(e.target), { signal: this.abort.signal });
    this.element.addEventListener('pointerout', e => { if (!(e.relatedTarget instanceof Node) || !(e.target as HTMLElement).closest('[data-item]')?.contains(e.relatedTarget)) this.tooltip.hide(); }, { signal: this.abort.signal });
    this.element.addEventListener('focusout', () => this.tooltip.hide(), { signal: this.abort.signal });
    this.element.addEventListener('scroll', () => this.tooltip.hide(), { signal: this.abort.signal, capture: true });
  }
  open(player: Player, npc: TownNPC): void {
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
    this.selected = this.tab === 'improve' ? { type: 'improve', source, operation: this.operation, affix: 0 } : { type: 'sell', source };
    this.render();
  }
  close(): void { this.includeActiveCharms=false; this.goldFeedback.stop(); this.sales.clear(); this.focus?.dispose(); this.focus = null; this.tooltip.hide(); this.element.hidden = true; this.selected = null; this.quote = null; }
  dispose(): void { this.close(); this.abort.abort(); this.tooltip.dispose(); this.element.remove(); }
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
    this.element.classList.toggle('is-storage',this.npc.role==='stash');
    this.element.classList.toggle('is-enhancing',this.tab==='improve');
    this.element.classList.toggle('is-enchanting',this.tab==='improve'&&this.npc.role==='enchanter');
    if(this.tab==='respec'){this.renderRespec();return;}
    if(this.npc.role==='stash'){this.renderStorage();return;}
    if(this.npc.role==='gambler'&&this.tab==='shop'){this.renderSpecial();return;}
    this.goldFeedback.stop();
    this.tooltip.hide();
    this.element.classList.toggle('is-selling', this.tab === 'sell');
    const offerScroll=this.element.querySelector('.service-offer')?.scrollTop??0;
    const bagScroll=this.element.querySelector('.service-bag')?.scrollTop??0;
    const focused = this.element.querySelector<HTMLElement>(':focus');
    const active = focused?.dataset.item;
    const control = focused?.hasAttribute('data-clear-sales') ? '[data-clear-sales]' : focused?.dataset.sellTier ? `[data-sell-tier="${focused.dataset.sellTier}"]` : focused?.dataset.operation ? `[data-operation="${focused.dataset.operation}"]` : focused?.dataset.tab ? `[data-tab="${focused.dataset.tab}"]`
      : focused?.hasAttribute('data-confirm') ? '[data-confirm]' : focused?.hasAttribute('data-close') ? '[data-close]' : null;
    this.element.style.setProperty('--service-color', NPC_COLORS[this.npc.role]);
    this.element.innerHTML = `${this.headerMarkup()}
      ${this.tabsMarkup()}
      <div class="service-body"><section class="service-offer ui-scroll-area">${this.tab === 'sell' ? '<div class="service-section-heading"><h3>Selected items</h3><button class="ui-button ui-button--quiet" data-clear-sales>Clear</button></div>' : this.tab === 'improve' ? `${this.npc.role === 'enchanter' ? `<nav class="enchant-operations" aria-label="Enchantment">${ENCHANT_OPERATIONS.map(op=>`<button class="ui-button ui-button--quiet" data-operation="${op}" aria-pressed="${this.operation===op}">${ENCHANT_LABELS[op]}</button>`).join('')}</nav>` : '<div class="service-section-heading"><h3>The workbench</h3><span>Guaranteed enhancement</span></div>'}` : `<div class="service-section-heading"><h3>${this.tab === 'shop' ? `Stock · Lv ${vendorStockLevel(this.npc, this.player.level)}` : 'Buyback'}</h3><span>${this.tab === 'shop' ? `Restocks at level ${(stockEpoch(this.player.level) + 1) * 3 + 1}` : 'Last 12 sales'}</span></div>${this.tab==='shop'?'<div class="service-stock-controls"></div>':''}<div class="service-stock inventory-pack"></div>`}<div class="service-detail"></div></section>
      <section class="service-bag ui-scroll-area">${this.tab === 'improve' ? '<section class="service-equipped-section" aria-label="Equipped gear"><div class="service-section-heading"><h3>Equipped</h3><span>Upgrade in place</span></div><div class="service-equipment inventory-pack"></div></section>' : ''}<section aria-label="Inventory"><div class="service-section-heading"><h3>Inventory</h3></div>${this.sortMarkup('inventory')}${this.tab === 'sell' ? this.rarityControls() : ''}<div class="ui-item-grid-scroll"><div class="service-grid inventory-pack"></div></div></section></section></div>
      <footer class="ui-window-footer"><span class="service-message" role="status"></span><button class="ui-button ui-button--primary" data-confirm disabled>Choose an item</button></footer>`;
    this.renderInventoryPack();
    const equipment = this.element.querySelector<HTMLElement>('.service-equipment');
    if (equipment) this.renderSpatialItems(equipment, EQUIPMENT_SLOTS.flatMap(slot => {
      const item=this.player.character.equipped[slot];
      return item ? [{item,key:`equipped:${slot}`}] : [];
    }), 3, 'Equipped gear');
    this.renderStock();
    this.renderDetail();
    this.element.querySelector('.service-bag')!.scrollTop=bagScroll;
    this.element.querySelector('.service-offer')!.scrollTop=offerScroll;
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
      this.renderSpatialItems(root,this.player.character.commerce.buyback.map((entry,index)=>({item:entry.item,key:`buyback:${index}`})),8,'Buyback items');return;
    }
    const stock=this.currentStock(true);
    const available=this.currentStock();
    const controls=this.element.querySelector<HTMLElement>('.service-stock-controls')!;
    const refresh=quoteService(this.player.character,this.npc,this.player.level,{type:'refreshStock'});
    const price=vendorRefreshPrice(this.player.character,this.npc,this.player.level);
    controls.innerHTML=`<nav class="service-categories" aria-label="Stock categories">${STOCK_CATEGORIES.map(category=>`<button class="ui-button ui-button--quiet" data-stock-category="${category}" aria-pressed="${this.shopCategory===category}">${STOCK_CATEGORY_NAMES[category]} <small>${available.filter(item=>item&&stockCategory(item)===category).length}</small></button>`).join('')}</nav>
      <div class="service-refresh-row"><span>Merchant stock</span><button class="ui-button ui-button--quiet" data-refresh-stock ${!refresh.ok||price>goldBalance(this.player.character)?'disabled':''} title="Replace all stock. The fee doubles each time and resets at the next level restock."><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M19 8a8 8 0 1 0 1 8M19 3v5h-5"/></svg> Refresh · ${Number.isSafeInteger(price)?price.toLocaleString()+' gold':'Unavailable'}</button></div>`;
    this.renderSpatialItems(root,stock.flatMap((item,index)=>item&&stockCategory(item)===this.shopCategory?[{item,key:`stock:${index}`,sold:!available[index]}]:[]),8,`${STOCK_CATEGORY_NAMES[this.shopCategory]} for sale`);
    if(!available.some(item=>item&&stockCategory(item)===this.shopCategory))root.insertAdjacentHTML('beforeend','<p class="service-stock-empty">No items in this category.</p>');
  }
  private renderEnhancement(detail:HTMLElement,item:Item|null,next:Item|null): void {
    detail.hidden=false;
    const source=this.selected?.type==='improve'?this.selected.source:null;
    const key=source?('bag' in source?`bag:${source.bag}`:`equipped:${source.equipped}`):'';
    const gains=item&&next?enhancementGains(item,next):[];
    detail.innerHTML=`<div class="enhance-showcase" style="--item-color:${item?TIER_COLORS[item.tier]:'#92a9b4'}">
      <div class="enhance-halo" aria-hidden="true"></div>
      ${item?`<button class="enhance-art" data-item="${key}" aria-label="Inspect ${escapeUI(itemDisplayName(item))}">${itemPackIconSVG(item,itemFootprint(item).width,itemFootprint(item).height)}</button>`:`<div class="enhance-empty-emblem">${npcEmblem('blacksmith')}</div>`}
      <span class="enhance-kicker">${item?`${TIER_NAMES[item.tier]} · Item level ${item.itemLevel}`:'The forge awaits'}</span>
      <h3>${item?escapeUI(itemDisplayName(item)):'Choose your equipment'}</h3>
      ${item?`<div class="enhance-ranks"><span>+${item.recipe.enhancement}</span><i aria-hidden="true">→</i><strong>+${next?.recipe.enhancement??item.recipe.enhancement}</strong></div>`:'<p>Select an item from your equipment or inventory.</p>'}
      <div class="enhance-progress" aria-label="Enhancement ${item?.recipe.enhancement??0} of 10">${Array.from({length:10},(_,i)=>`<span class="${i<(item?.recipe.enhancement??0)?'is-earned':i<(next?.recipe.enhancement??0)?'is-next':''}"></span>`).join('')}</div>
    </div>
    ${gains.length?`<div class="enhance-gains"><div class="enhance-gains-heading"><span>Item improvement</span><span>Current</span><span>After</span><span>Gain</span></div>${gains.map(row=>`<div><span>${escapeUI(row.label)}</span><span>${row.before}</span><strong>${row.after}</strong><em>${row.gain}</em></div>`).join('')}</div><p class="enhance-footnote">Only changed item stats shown. Character caps still apply.${next!.recipe.enhancement>item!.recipe.enhancement+1?' Empty steps skipped at no extra cost.':''}</p>`:item?'<p class="enhance-footnote">No further enhancement available.</p>':''}`;
  }
  private headerMarkup(): string {
    return `<header class="ui-window-header"><span class="ui-header-emblem">${npcEmblem(this.npc.role)}</span><h2 class="ui-title" id="service-title">${NPC_NAMES[this.npc.role]}</h2><span class="service-wallet"><b data-wallet-total>${goldBalance(this.player.character).toLocaleString()}</b> <small>gold</small></span><button class="ui-button ui-button--icon" data-close aria-label="Close service">×</button></header>`;
  }
  private tabsMarkup(): string {
    if (this.npc.role === 'stash') return '';
    const tabs: Array<[typeof this.tab, string]> = this.npc.role === 'enchanter'
      ? [['improve', 'Enchant'], ['respec', 'Respec']] : [['shop', this.npc.role === 'gambler' ? 'Gamble' : 'Shop']];
    if (this.npc.role === 'blacksmith') tabs.push(['improve', 'Enhance']);
    tabs.push(['sell', 'Sell'], ['buyback', `Buyback <small>${this.player.character.commerce.buyback.length}/12</small>`]);
    return `<nav class="service-tabs" aria-label="Services">${tabs.map(([tab, label]) => `<button class="ui-button ui-button--quiet" data-tab="${tab}" aria-pressed="${this.tab === tab}">${label}</button>`).join('')}<span>${escapeUI(this.npc.name)}${this.tab === 'improve' ? ` · Services Lv ${vendorLevel(this.npc, this.player.level)}` : ''}</span></nav>`;
  }
  showRespec(): void { if(this.npc.role!=='enchanter')return; this.tab='respec'; this.render(); }
  private renderRespec(): void {
    this.goldFeedback.stop();this.tooltip.hide();this.element.classList.remove('is-selling');
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
    this.goldFeedback.stop(); this.tooltip.hide(); this.element.classList.remove('is-selling');
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
    this.goldFeedback.stop(); this.tooltip.hide(); this.element.classList.remove('is-selling');
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
    return `<div class="service-rarities" aria-label="Select items by rarity">${(['common','magic','rare','epic','legendary'] as ItemTier[]).map(tier=>{
      const items=bulkSaleItems(this.player.character,this.player.level,this.includeActiveCharms).filter(item=>item.tier===tier);
      const selected=items.length>0&&items.every(item=>this.sales.has(item.id));
      return `<button type="button" data-sell-tier="${tier}" aria-pressed="${selected}" ${items.length?'':'disabled'} style="--rarity-color:${TIER_COLORS[tier]}">${TIER_NAMES[tier]} <small>${items.length}</small></button>`;
    }).join('')}<label class="service-include-charms"><input type="checkbox" data-include-charms ${this.includeActiveCharms?'checked':''}> Include active charms</label></div>`;
  }
  /** Mirror the carried pack; empty space and overflow retain their actual positions. */
  private renderInventoryPack(): void {
    const root = this.element.querySelector<HTMLElement>('.service-grid')!;
    root.style.setProperty('--pack-columns', String(PACK_COLUMNS));
    const sheet = this.player.character, layout = resolvePackLayout(sheet);
    root.innerHTML = `<div class="character-bag character-tetris" role="group" aria-label="Inventory, ${PACK_COLUMNS} columns by ${PACK_ROWS} rows">
      ${Array.from({length:PACK_CELLS},(_,cell)=>`<span class="character-grid-cell" aria-hidden="true" style="grid-column:${cell%PACK_COLUMNS+1};grid-row:${Math.floor(cell/PACK_COLUMNS)+1}"></span>`).join('')}</div>
      <section class="character-charms" aria-label="Active charms"><header><span>${uiIcon('diamond')} Charms</span></header><div class="character-charm-grid character-tetris">${Array.from({length:PACK_COLUMNS*CHARM_ROWS},(_,i)=>`<span class="character-grid-cell" aria-hidden="true" style="grid-column:${i%PACK_COLUMNS+1};grid-row:${Math.floor(i/PACK_COLUMNS)+1}"></span>`).join('')}</div></section>
      <section class="character-overflow" hidden><header>Pack overflow <small>Make space to carry these items</small></header><div class="character-overflow-items"></div></section>`;
    const bag = root.querySelector<HTMLElement>('.character-bag')!, overflow = root.querySelector<HTMLElement>('.character-overflow-items')!;
    sheet.inventory.forEach((item,index)=>{
      if (!item) return;
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
    updateItemSlot(cell, item, { level: this.player.level, emptyMarkup: '', label: item ? itemDisplayName(item) : 'Empty slot' });
    cell.disabled = !item; return cell;
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
    if(document.documentElement.classList.contains('touch-mode')) return;
    const cell = target instanceof HTMLElement ? target.closest<HTMLButtonElement>('[data-item]') : null;
    if (!cell) return;
    const value = this.resolve(cell.dataset.item!); if (!value) return;
    this.tooltip.show(value.item, { sheet: this.player.character, level: this.player.level,
      sourceIndex: value.source && 'bag' in value.source ? value.source.bag : undefined,
      equipped: Boolean(value.source && 'equipped' in value.source),
      context: value.request.type === 'buyback' ? `${this.player.character.commerce.buyback.find(b=>b.item.id===value.item.id)?.price??0} gold` : value.request.type === 'buy' ? `${itemPrice(value.item, 'buy')} gold` : value.request.type === 'sell' ? `Sell · ${itemPrice(value.item, 'sell')} gold` : undefined }, cell);
  }
  private click(e: MouseEvent): void {
    if (this.saving) return;
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button, input[data-include-charms]'); if (!button) return;
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
      this.element.querySelector('.service-offer')!.scrollTop=0;
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
      this.tooltip.hide();
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
    if(this.tab==='respec'){this.renderRespec();return;}
    if(this.npc.role==='stash'){this.storageDetail();return;}
    if(this.npc.role==='gambler'&&this.tab==='shop'){this.specialDetail();return;}
    this.quote = null; const selected = this.selected;
    const detail = this.element.querySelector<HTMLElement>('.service-detail')!, button = this.element.querySelector<HTMLButtonElement>('[data-confirm]')!;
    const message = this.element.querySelector<HTMLElement>('.service-message')!; message.textContent = '';
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
    if (!result.ok) { detail.hidden=true; message.textContent=result.message; if(selected.type==='improve'&&selected.operation==='enhance')this.renderEnhancement(detail,sourceItem(this.player.character,selected.source),null); else if(selected.type==='improve')this.renderEnchantment(detail,sourceItem(this.player.character,selected.source),false,result.message); return; }
    const { item, quote } = result; if(!item)return; this.quote = quote;
    const buying = selected.type === 'buy' || selected.type === 'buyback', improving = selected.type === 'improve';
    const label = improving ? OP_LABELS[selected.operation] : buying ? 'Buy' : 'Sell';
    button.textContent = `${label} · ${quote.price.toLocaleString()} gold`;
    button.disabled = selected.type !== 'sell' && goldBalance(this.player.character) < quote.price;
    message.textContent = button.disabled ? 'Not enough gold.' : itemDisplayName(item);
    if(buying&&!canPackItem(this.player.character,item)){button.disabled=true;message.textContent=packSpaceProblem(this.player.character,item);}
    if (!improving) return;
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
    if(!items.length){detail.innerHTML='<p class="service-empty">Select items or a rarity.</p>';button.textContent='Select items';return;}
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
  private async confirm(): Promise<void> {
    if (this.saving || !this.quote) return;
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
    this.tooltip.hide();
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
