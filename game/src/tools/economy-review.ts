import './economy-review.css';
import { BIOMES } from '../biomes.ts';
import { ENEMY_DEFINITIONS } from '../combat-content.ts';
import { WORLD_DIFFICULTIES } from '../world-difficulty.ts';
import { ITEM_MATERIALS, itemMaterialPool } from '../item-materials.ts';
import { TIER_NAMES } from '../items.ts';
import { escapeUI } from '../ui-components.ts';
import { itemIconSVG } from '../item-art.ts';
import { DEFAULT_ECONOMY, ECONOMY_ACTIVITIES, ECONOMY_KINDS, economyConfig, economyItem, estimateEconomy, enhancementCosts, type EconomyConfig, type EconomyEstimate } from './economy-model.ts';

const number=new Intl.NumberFormat('en-US',{maximumFractionDigits:1});
const fmt=(value:number|null)=>value===null?'—':number.format(value);
const duration=(minutes:number|null)=>minutes===null?'No income':minutes<60?`${fmt(minutes)} min`:`${fmt(minutes/60)} hr`;
const total=(value:{coins:number;sales:number})=>value.coins+value.sales;
const select=(key:keyof EconomyConfig,label:string,entries:readonly (readonly [string,string])[],value:unknown)=>`<label>${label}<select name="${key}" class="ui-well">${entries.map(([id,name])=>`<option value="${escapeUI(id)}"${id===String(value)?' selected':''}>${escapeUI(name)}</option>`).join('')}</select></label>`;
const input=(key:keyof EconomyConfig,label:string,value:number,min:number,max:number,step=1)=>`<label>${label}<input class="ui-well" name="${key}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" required></label>`;
const section=(title:string,body:string)=>`<fieldset class="ui-window economy-controls"><legend>${title}</legend>${body}</fieldset>`;

export function mountEconomyReview(root:HTMLElement,signal:AbortSignal):void {
  let initial:EconomyConfig,initialError='';
  try {initial=economyConfig(new URLSearchParams(location.search));}catch(error){initial={...DEFAULT_ECONOMY};initialError=`Invalid URL settings; using defaults. ${String(error)}`;}
  let version=0,report:unknown=null;
  const c=initial;
  root.innerHTML=`<header class="study-heading"><div><p class="ui-kicker">Evergrow · Progression</p><h1>Economy</h1><p>What you earn. What an upgrade asks of you.</p></div><div class="study-heading-tools"><nav><a class="ui-button ui-button--quiet" href="/progression.html">Progression & loot</a><button class="ui-button" data-export disabled>Export report</button></nav></div></header>
  <form class="economy-form">
    ${section('Play session',input('player','Character level',c.player,1,1e6)+input('area','Enemy / activity level',c.area,1,1e6)+input('minutes','Session minutes',c.minutes,1,120)+input('killsPerMinute','Kills / minute',c.killsPerMinute,0,60,.1)
      +select('difficulty','Difficulty',WORLD_DIFFICULTIES.map(d=>[d.id,d.name]),c.difficulty)+select('biome','Loot biome',Object.entries(BIOMES).map(([id,b])=>[id,b.name]),c.biome))}
    ${section('Enemy mix',select('kind','Base enemy',ECONOMY_KINDS.map(kind=>[kind,ENEMY_DEFINITIONS[kind].name]),c.kind)+input('goblins','Scrap Goblin share %',c.goblins,0,100)+input('champion','Champion share %',c.champion,0,100)+input('elite','Elite share %',c.elite,0,100))}
    ${section('Rewards',input('goldFind','Gold find bonus %',c.goldFind,0,100)+input('xpBonus','XP bonus %',c.xpBonus,0,50)+input('collect','Coins collected %',c.collect,0,100)+input('sell','Dropped items sold %',c.sell,0,100)
      +select('activity','Completion reward',Object.entries(ECONOMY_ACTIVITIES),c.activity)+input('activitiesPerHour','Completions / hour',c.activitiesPerHour,0,60,.1)+input('waves','Cursed chest waves',c.waves,1,20))}
    ${section('Enhancement target',input('itemLevel','Item level',c.itemLevel,1,1e6)+select('itemKind','Item', [['weapon','Longsword'],['shield','Shield'],['chest','Chest armor'],['charm','Charm']],c.itemKind)
      +select('tier','Rarity',(['common','magic','rare','epic','legendary'] as const).map(t=>[t,TIER_NAMES[t]]),c.tier)+select('material','Material',[],c.material)+input('rank','Current rank',c.rank,0,10)+input('seed','Sample / item seed',c.seed,0,4294967295))}
    <div class="economy-actions"><button class="ui-button" type="submit">Calculate</button><button class="ui-button ui-button--quiet" type="button" data-baseline>Reset baseline</button><span class="ui-muted" data-status role="status" aria-live="polite"></span></div>
  </form>
  <p class="study-note economy-assumptions">Kills/minute includes travel and downtime. Normal enemies fill the remaining rank share; goblin share applies across all ranks. All enemies use the selected source level. Completion rewards add only the cache / trial payout: include their enemy kills in your kill rate. Sales assume an unbiased share of drops, valued at the vendor; coins collected does not affect sales.</p>
  <div data-results></div>
  <footer class="study-page-footer">Local reward model · deterministic samples · no combat or playable saves · no balance changes</footer>`;
  const form=root.querySelector<HTMLFormElement>('form')!,results=root.querySelector<HTMLElement>('[data-results]')!,status=root.querySelector<HTMLElement>('[data-status]')!,exportButton=root.querySelector<HTMLButtonElement>('[data-export]')!;
  const control=(key:string)=>form.elements.namedItem(key) as HTMLInputElement|HTMLSelectElement;
  function updateMaterials(preferred?:string) {
    const kind=control('itemKind').value as EconomyConfig['itemKind'],material=control('material') as HTMLSelectElement;
    const value=preferred??material.value;
    material.innerHTML=kind==='charm'?'<option value="iron">Not applicable</option>':itemMaterialPool(kind,'sword').map(m=>`<option value="${m.id}">${ITEM_MATERIALS[m.id].name}</option>`).join('');
    material.disabled=kind==='charm';
    if([...material.options].some(o=>o.value===value))material.value=value;
    control('waves').disabled=control('activity').value!=='cursedChest';
  }
  function read():EconomyConfig {
    const params=new URLSearchParams();
    for(const key of Object.keys(DEFAULT_ECONOMY))params.set(key,control(key).value);
    return economyConfig(params);
  }
  async function calculate():Promise<void> {
    const own=++version;report=null;exportButton.disabled=true;results.replaceChildren();root.setAttribute('aria-busy','true');
    try {
      const config=read();status.textContent='Sampling current reward rules…';
      const params=new URLSearchParams({view:'economy'});for(const [key,value] of Object.entries(config))params.set(key,String(value));
      history.replaceState(null,'',`${location.pathname}?${params}`);
      // Yield between bounded batches so edits and navigation can cancel stale results.
      await new Promise(resolve=>setTimeout(resolve,0));if(signal.aborted||own!==version)return;
      const estimate=estimateEconomy(config),item=economyItem(config),costs=enhancementCosts(item,total(estimate.perMinute));
      const curves:{level:number;estimate:EconomyEstimate}[]=[];
      for(const level of [1,5,10,20,50]) {
        await new Promise(resolve=>setTimeout(resolve,0));if(signal.aborted||own!==version)return;
        curves.push({level,estimate:estimateEconomy({...config,player:level,area:level},1024)});
      }
      const incomes=[['Enemy coins',estimate.kill.coins*config.killsPerMinute],['Enemy item sales',estimate.kill.sales*config.killsPerMinute],['Completion coins',estimate.activity.coins*config.activitiesPerHour/60],['Completion item sales',estimate.activity.sales*config.activitiesPerHour/60]] as const;
      results.innerHTML=`<div class="study-summary">
        <section class="ui-window study-card"><h2>${config.minutes}-minute income</h2><div class="study-big">${fmt(total(estimate.session))}<span>gold</span></div><div class="study-pair"><span>Coins / sales</span><b>${fmt(estimate.session.coins)} / ${fmt(estimate.session.sales)}</b></div><p class="study-note">${fmt(config.killsPerMinute*config.minutes)} kills · ${fmt(config.activitiesPerHour*config.minutes/60)} completions on average</p></section>
        <section class="ui-window study-card"><h2>Income rate</h2><div class="study-big">${fmt(total(estimate.perMinute)*60)}<span>gold / hour</span></div><div class="study-pair"><span>Per minute</span><b>${fmt(total(estimate.perMinute))} gold</b></div><p class="study-note">Gross income before purchases and upgrades. Assumes drops are collected and sold at the selected rates.</p></section>
        <section class="ui-window study-card"><h2>To the next level</h2><div class="study-big">${fmt(estimate.goldPerLevel)}<span>gold earned</span></div><div class="study-pair"><span>From zero XP</span><b>${estimate.minutesPerLevel===null?'No XP income':duration(estimate.minutesPerLevel)}</b></div><p class="study-note">${fmt(estimate.perMinute.xp)} XP / minute at character ${config.player}, source ${config.area}. Local estimate; levels do not advance within this session.</p></section>
      </div>
      <section class="ui-window study-card economy-sources"><h2>Where the gold comes from</h2>${incomes.map(([name,value],i)=>`<div class="economy-source"><span>${name}</span><div><i style="width:${total(estimate.perMinute)>0?value/total(estimate.perMinute)*100:0}%;--source:${i%2?'var(--ui-jade)':'var(--ui-gold)'}"></i></div><b>${fmt(value*config.minutes)} gold</b></div>`).join('')}</section>
      <section class="ui-window study-comparison"><header class="study-section-header"><div><p class="ui-kicker">Affordability</p><h2>Enhancing ${escapeUI(item.name)} +${config.rank}</h2></div><div class="economy-target">${itemIconSVG(item,48)}<p>${escapeUI(TIER_NAMES[item.tier])} · item level ${config.itemLevel}<br>${costs.length?`${fmt(costs.at(-1)!.cumulative)} gold to reach +${costs.at(-1)!.to}`:'No further useful upgrades'}</p></div></header>
      <div class="study-table-scroll"><table><thead><tr><th>Step</th><th>Upgrade cost</th><th>Time / step</th><th>Total cost</th></tr></thead><tbody>${costs.map(row=>`<tr><th>+${row.from} → +${row.to}</th><td>${fmt(row.fee)}</td><td>${duration(row.minutes)}</td><td>${fmt(row.cumulative)}</td></tr>`).join('')}</tbody></table></div>
      <p class="study-footnote">All enhancements are guaranteed. Free no-gain ranks use the real skip rule. Costs are exact for this item; earning times are estimates and assume all income goes to this item at the current rate.</p></section>
      <section class="ui-window study-comparison"><header class="study-section-header"><div><p class="ui-kicker">Level curve</p><h2>The same play style at different levels</h2></div></header><div class="study-table-scroll"><table><thead><tr><th>Character / source level</th><th>Coins / session</th><th>Sales / session</th><th>Gold / hour</th><th>Gold / level</th><th>Time / level</th></tr></thead><tbody>${curves.map(({level,estimate:e})=>`<tr><th>${level}</th><td>${fmt(e.session.coins)}</td><td>${fmt(e.session.sales)}</td><td>${fmt(total(e.perMinute)*60)}</td><td>${fmt(e.goldPerLevel)}</td><td>${e.minutesPerLevel===null?'No XP income':duration(e.minutesPerLevel)}</td></tr>`).join('')}</tbody></table></div><p class="study-footnote">Matching character and source levels; all other income assumptions stay fixed. This is a comparison of local rates, not a simulated journey through geography or cumulative income from level 1.</p></section>
      <details class="ui-window study-card"><summary>Model scope & sampling</summary><p class="study-note">Runtime enemy gold, equipment generation, sale values, difficulty, XP, completion rewards and enhancement rules are shared with the game. Selected income uses 2,048 seeds per nonzero enemy/rank group and up to 512 activity samples; curve rows use 1,024. Fixed seeds make comparisons repeatable, but rare item sales can vary substantially in real sessions. No first-kill guarantee, inventory limits, selective rarity selling, container loot, Journeys, dungeon/rift/boss rewards, combat speed simulation, or other spending is included. No historical character data is read.</p></details>`;
      report={version:1,config,estimate,enhancement:{item,costs},curves,assumptions:'Fixed source and character levels; gross income; unbiased sale fraction; activity kills included in kill rate; excludes containers, Journeys, dungeon/rift/boss rewards and expenses. Deterministic sampled expectations, not guaranteed outcomes.'};
      exportButton.disabled=false;status.textContent=`Calculated · ${estimate.killSamples.toLocaleString()} enemy samples`;root.dataset.ready='true';
    }catch(error){if(own===version){status.textContent=error instanceof Error?error.message:String(error);root.dataset.ready='error';}}
    finally{if(own===version)root.setAttribute('aria-busy','false');}
  }
  form.addEventListener('submit',event=>{event.preventDefault();void calculate();},{signal});
  form.addEventListener('change',()=>{version++;report=null;exportButton.disabled=true;root.setAttribute('aria-busy','false');results.replaceChildren();updateMaterials();status.textContent='Settings changed · Calculate to update';},{signal});
  root.querySelector('[data-baseline]')!.addEventListener('click',()=>{
    for(const [key,value] of Object.entries(DEFAULT_ECONOMY))if(key!=='material')control(key).value=String(value);
    updateMaterials(DEFAULT_ECONOMY.material);void calculate();
  },{signal});
  exportButton.addEventListener('click',()=>{
    if(!report)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='evergrow-economy.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);
  },{signal});
  signal.addEventListener('abort',()=>{version++;},{once:true});
  updateMaterials(c.material);void calculate();if(initialError)status.textContent=initialError;
}
