import type { Player } from '../model.ts';
import type { TownNPC } from '../npcs.ts';
import type { ServicePanel } from '../service-panel.ts';
import { quoteService, planService, vendorStock, stockEpoch } from '../commerce.ts';
import { refreshCharacter } from '../character.ts';
import './service-layout-study.css';

const SCENARIOS = [
  ['stock', 'Shop'], ['empty-stock', 'Empty accessories'], ['sold-out', 'Sold-out stock'],
  ['enhance', 'Enhance'], ['sell', 'Sell selection'], ['empty-sell', 'Empty inventory'],
  ['buyback', 'Buyback'], ['empty-buyback', 'Empty buyback'],
] as const;

/** Disposable fixtures for the production panel; no simulation ticks or save access. */
export class ServiceLayoutStudy {
  private readonly panel: ServicePanel;
  private readonly player: Player;
  private readonly npc: TownNPC;
  private readonly toolbar = document.createElement('aside');
  private readonly abort = new AbortController();
  private readonly resize: ResizeObserver;
  private readonly observer: MutationObserver;
  private readonly baseline: Player['character'];
  private readonly scenario: HTMLSelectElement;

  constructor(panel: ServicePanel, player: Player, npc: TownNPC, params: URLSearchParams) {
    if (!import.meta.env.DEV) throw new Error('Local study only');
    this.panel=panel; this.player=player; this.npc=npc;
    this.baseline = structuredClone(player.character);
    document.documentElement.classList.add('service-layout-study');
    this.toolbar.className = 'service-layout-controls';
    this.toolbar.setAttribute('aria-label', 'Merchant layout preview');
    this.toolbar.innerHTML = `<strong>Merchant layout</strong><label>Fixture <select>${SCENARIOS.map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><button type="button">Reset</button><span>Disposable preview</span>`;
    this.scenario = this.toolbar.querySelector('select')!;
    const requested = params.get('layout');
    if (SCENARIOS.some(([key])=>key===requested)) this.scenario.value = requested!;
    const options = {signal:this.abort.signal};
    this.scenario.addEventListener('change',()=>{
      this.reset();
      const url = new URL(location.href); url.searchParams.set('layout',this.scenario.value);
      history.replaceState(null,'',url); this.scenario.focus();
    },options);
    this.toolbar.querySelector('button')!.addEventListener('click',()=>this.reset(),options);
    this.observer=new MutationObserver(()=>this.attach());
    this.observer.observe(panel.element,{childList:true,attributes:true,attributeFilter:['hidden']});
    this.resize = new ResizeObserver(()=>document.documentElement.style.setProperty('--service-layout-top',`${this.toolbar.getBoundingClientRect().height+12}px`));
    this.resize.observe(this.toolbar);
    this.reset();
  }
  private attach(): void {
    // Keep the controls in the active dialog's focus scope, or reachable after closing it.
    const mount=this.panel.element.hidden?document.body:this.panel.element;
    if (this.toolbar.parentElement!==mount) mount.prepend(this.toolbar);
  }
  private reset(): void {
    const focused=this.toolbar.contains(document.activeElement)?document.activeElement as HTMLElement:null;
    // Close first so resetting a fixture cancels any pending presentation charge.
    this.panel.close();
    this.player.character = structuredClone(this.baseline);
    const sheet = this.player.character, scenario = this.scenario.value;
    if (scenario==='empty-sell') { sheet.inventory.fill(null); delete sheet.inventoryLayout; }
    if (scenario==='sold-out') {
      sheet.commerce.epoch = stockEpoch(this.player.level);
      sheet.commerce.sold[this.npc.id] = vendorStock(sheet,this.npc,this.player.level,true).reduce((mask,item,index)=>item?mask|1<<index:mask,0);
    }
    if (scenario==='buyback') {
      // Use normal validated sales so prices and records match the real window.
      for (let bag=0;bag<8;bag++) {
        const quote=quoteService(this.player.character,this.npc,this.player.level,{type:'sell',source:{bag}});
        if (!quote.ok) continue;
        const plan=planService(this.player.character,this.npc,this.player.level,quote.quote);
        if (plan.ok) this.player.character=plan.character;
      }
    }
    refreshCharacter(this.player);
    this.panel.open(this.player,this.npc);
    if (scenario==='enhance') this.panel.inspect({bag:1},'enhance');
    else if (scenario==='sell') this.panel.selectSales('common');
    else if (scenario==='empty-sell') this.activate('[data-tab="sell"]');
    else if (scenario==='buyback'||scenario==='empty-buyback') this.activate('[data-tab="buyback"]');
    else if (scenario==='empty-stock') this.activate('[data-stock-category="accessories"]');
    this.attach();
    focused?.focus({preventScroll:true});
  }
  private activate(selector: string): void { this.panel.element.querySelector<HTMLButtonElement>(selector)?.click(); }
  dispose(): void {
    this.abort.abort(); this.observer.disconnect(); this.resize.disconnect(); this.toolbar.remove();
    document.documentElement.classList.remove('service-layout-study');
    document.documentElement.style.removeProperty('--service-layout-top');
  }
}
