import { STASH_CAPACITY, storageTabCount, hasStorageTab, nextStorageTabPrice } from './storage-content.ts';
export { STASH_CAPACITY } from './storage-content.ts';
import { bulkSaleItems } from './item-protection.ts';
import { normalizePackLayout, canPackItem, packSpaceProblem } from './inventory-grid.ts';
import { servicePolicy } from './settlement-services.ts';
import { itemMaterialValue, itemMaterialService } from './item-materials.ts';
import type { CharacterSheet, Item, ItemTier, ItemKind, EquipmentSlot } from './character-types.ts';
import { generateItem, randomSource, itemDisplayName, itemAffixPool } from './items.ts';
import { addInventoryItem } from './inventory.ts';
import { creditGold, spendGold, goldBalance } from './wallet.ts';
import { hashService, vendorLevel, type TownNPC } from './npcs.ts';
import { nextRarityTier, improveItem, improvementProblem, ITEM_TIERS, AFFIX_FOCUSES, rerollPool, affixCategory, type AffixFocus, type Improvement } from './item-improvement.ts';

export const COMMERCE_LIMITS = { vendors: 2048, buyback: 12 } as const;
const RARITY_COST: Record<ItemTier, number> = { common: 1, magic: 2, rare: 5, epic: 12, legendary: 30, unique: 30 };
export const stockEpoch = (level: number) => Math.floor((level - 1) / 3);
/** Stock and its UI label share the same stable three-level refresh bracket. */
export const vendorStockLevel = (npc: TownNPC, playerLevel: number) => vendorLevel(npc, stockEpoch(playerLevel) * 3 + 1);
const budget = (level: number) => 30 + 3 * (level - 1);
export function itemPrice(item: Item, mode: 'buy' | 'sell'): number {
  return mode === 'sell' ? Math.floor(.15 * budget(item.itemLevel) * RARITY_COST[item.tier] * itemMaterialValue(item))
    : Math.ceil(budget(item.itemLevel) * RARITY_COST[item.tier] * itemMaterialValue(item) * (item.kind === 'ring' || item.kind === 'amulet' ? 2.5 : 1));
}
export function improvementPrice(item: Item, operation: Improvement, zoneLevel: number): number {
  const r = item.recipe, base = budget(item.itemLevel) * RARITY_COST[item.tier] * itemMaterialService(item), h = 1 + .1 * r.enhancement;
  switch (operation) {
    case 'enhance': return Math.ceil(3 * base * 1.65 ** r.enhancement);
    case 'rarity': { const tier=nextRarityTier(item); return Math.ceil(8 * budget(item.itemLevel) * itemMaterialService(item) * (tier?RARITY_COST[tier]:Infinity) * h); }
    case 'rerollOne': return Math.ceil(15 * base * h * 1.25 ** r.targetedRolls);
    case 'rerollAll': return Math.ceil(5 * base * h * 1.2 ** r.fullRolls);
    case 'relevel': return Math.ceil(3 * RARITY_COST[item.tier] * itemMaterialService(item) * h * (zoneLevel - item.itemLevel)
      * (budget(item.itemLevel + 1) + budget(zoneLevel)) / 2);
  }
}
export const vendorRefreshCount = (sheet: CharacterSheet, npc: TownNPC, level: number) =>
  sheet.commerce.epoch === stockEpoch(level) ? sheet.commerce.refreshes?.[npc.id] ?? 0 : 0;
/** The whole shop refreshes. Price doubles each time, resetting with the free level restock. */
export const vendorRefreshPrice = (sheet: CharacterSheet, npc: TownNPC, level: number) =>
  Math.ceil(budget(vendorStockLevel(npc, level)) * 5 * 2 ** vendorRefreshCount(sheet, npc, level));
export function vendorStock(sheet: CharacterSheet, npc: TownNPC, level: number, includeSold = false): Array<Item | null> {
  if (npc.role === 'enchanter' || npc.role === 'gambler' || npc.role === 'stash') return [];
  const epoch = stockEpoch(level), state = sheet.commerce;
  const sold = state.epoch === epoch ? state.sold : {};
  if (!Object.hasOwn(sold, npc.id) && Object.keys(sold).length >= COMMERCE_LIMITS.vendors) return [];
  const policy=servicePolicy(npc),count=npc.role==='jeweler'?policy.jewelerStock:policy.smithStock;
  return Array.from({ length: count }, (_, slot) => {
    if (!includeSold && ((sold[npc.id] ?? 0) & 1 << slot)) return null;
    const generation = vendorRefreshCount(sheet, npc, level);
    const id = `stock:${npc.id}:${epoch}:${slot}${generation ? `:refresh:${generation}` : ''}`, seed = hashService(id), random = randomSource(seed ^ 0x674af7c1), roll = random() * 100;
    const premium=slot>=count-policy.premium;
    const weights=premium?[0,0,90,9.5,.5]:npc.settlementTier==='city'?(npc.role==='jeweler'?[0,42,52,5.7,.3]:[10,55,31,3.8,.2]):npc.settlementTier==='village'?(npc.role==='jeweler'?[0,52,44,3.8,.2]:[25,52,21,1.9,.1]):npc.role==='jeweler'?[0,60,35,4.8,.2]:[55,35,9,1,0];
    let total = 0; const tier = ITEM_TIERS[weights.findIndex(weight => { total += weight; return roll < total; })];
    const kind = npc.role === 'jeweler' ? slot%8 < 4 ? 'ring' : slot%8 < 6 ? 'amulet' : slot%8 === 6 ? 'grimoire' : 'orb'
      : (['weapon', 'weapon', 'weapon', 'shield', 'head', 'chest', 'gloves', 'legs', 'boots', 'cloak', 'weapon', 'shield', 'weapon','weapon','weapon','weapon','weapon','chest','shield','boots','chest','weapon','weapon','weapon'] as const)[slot];
    const profile = npc.role === 'blacksmith' ? ({ 0: 'longsword', 1: 'thorn-shortbow', 2: 'ember-staff', 10: 'cinder-wand',12:'hand-axe',13:'flanged-mace',14:'rondel-dagger',15:'greatblade',16:'crescent-recurve',21:'greatblade',22:'warden-longbow',23:'rime-staff' } as Record<number, string>)[slot] : undefined;
    const item = generateItem(seed, vendorStockLevel(npc, level), kind, profile, tier,undefined,{level:vendorStockLevel(npc,level),merchantBonus:policy.materialBonus}); item.id = id;
    if (item.weapon) item.weapon.id = id;
    if (item.focus) item.focus.id = id;
    if (item.shield) item.shield.id = id;
    return item;
  });
}
export const premiumStockSlot=(npc:TownNPC,slot:number)=>{const p=servicePolicy(npc);return slot>=(npc.role==='jeweler'?p.jewelerStock:p.smithStock)-p.premium;};
export type ItemSource = { bag: number } | { equipped: EquipmentSlot };
export interface SaleItem { bag: number; id: string; revision: number; }
export const GAMBLE_KINDS: readonly ItemKind[] = ['weapon','shield','head','chest','gloves','legs','boots','cloak','ring','amulet','grimoire','orb'];
export const gambleOdds=(npc:TownNPC)=>servicePolicy(npc).gambleOdds;
export const gamblePrice=(npc:TownNPC,level:number,kind:ItemKind)=>Math.ceil(budget(vendorLevel(npc,level))*4*servicePolicy(npc).gamblePrice*(kind==='ring'||kind==='amulet'?1.5:1));
function gambleItem(sheet:CharacterSheet,npc:TownNPC,level:number,kind:ItemKind):Item {
  const id=`gamble:${npc.id}:${sheet.commerce.operations}`,seed=hashService(id),roll=randomSource(seed^0xcafefade)()*100;
  let sum=0; const tier=ITEM_TIERS[gambleOdds(npc).findIndex(w=>{sum+=w;return roll<sum;})];
  const item=generateItem(seed,vendorLevel(npc,level),kind,undefined,tier,undefined,{level:vendorLevel(npc,level),merchantBonus:servicePolicy(npc).materialBonus});item.id=id;
  if(item.weapon)item.weapon.id=id;if(item.shield)item.shield.id=id;if(item.focus)item.focus.id=id;return item;
}
export const RESPEC_GOLD_PER_POINT = 25;
export const respecPoints = (sheet: CharacterSheet) => sheet.allocatedNodes.length - 1 + Object.values(sheet.skillRanks).reduce((sum, rank) => sum + rank - 1, 0);
export const attributeResetPoints = (sheet: CharacterSheet) => Object.values(sheet.attributes).reduce((sum, value) => sum + value - 10, 0);
export type ServiceRequest = {type:'refreshStock'} | {type:'resetAttributes'} | {type:'respec'} | {type:'gamble';kind:ItemKind} | {type:'store';bag:number;tab?:number} | {type:'unlockStorage';tab:number} | {type:'retrieve';slot:number} | { type: 'buy'; slot: number } | { type: 'sell'; source: ItemSource }
  | { type: 'sellMany'; items: SaleItem[]; includeActiveCharms?: boolean }
  | { type: 'buyback'; id: string } | { type: 'improve'; source: ItemSource; operation: Improvement; affix?: number; focus?:AffixFocus };
export interface ServiceQuote { npcId: string; revision: number; epoch: number; itemId: string; itemRevision: number; price: number; request: ServiceRequest; }
export type QuoteResult = { ok: false; message: string } | { ok: true; quote: ServiceQuote; item: Item | null };
export function sourceItem(sheet: CharacterSheet, source: ItemSource): Item | null {
  return 'bag' in source ? Number.isInteger(source.bag) ? sheet.inventory[source.bag] ?? null : null : sheet.equipped[source.equipped] ?? null;
}
export function quoteService(sheet: CharacterSheet, npc: TownNPC, level: number, request: ServiceRequest): QuoteResult {
  let item: Item | null = null, price = 0;
  const fail = (message: string): QuoteResult => ({ ok: false, message });
  if (request.type === 'refreshStock') {
    if (npc.role !== 'blacksmith' && npc.role !== 'jeweler') return fail('This merchant does not sell stock.');
    const sold = sheet.commerce.epoch === stockEpoch(level) ? sheet.commerce.sold : {};
    if (!Object.hasOwn(sold, npc.id) && Object.keys(sold).length >= COMMERCE_LIMITS.vendors) return fail('Visit a known merchant until the next level restock.');
    price = vendorRefreshPrice(sheet, npc, level);
    if (!Number.isSafeInteger(price) || price < 0 || sheet.commerce.revision >= Number.MAX_SAFE_INTEGER || sheet.commerce.operations >= Number.MAX_SAFE_INTEGER)
      return fail('This refresh exceeds the supported limit.');
    return {ok:true,item:null,quote:{npcId:npc.id,revision:sheet.commerce.revision,epoch:stockEpoch(level),
      itemId:`refresh:${vendorRefreshCount(sheet,npc,level)}`,itemRevision:0,price,request:{type:'refreshStock'}}};
  }
  if (request.type === 'resetAttributes') {
    if (npc.role !== 'enchanter') return fail('Visit an enchanter to reset attributes.');
    if (sheet.attributeResetUsed) return fail('Your free attribute reset has been used.');
    if (attributeResetPoints(sheet) <= 0) return fail('No spent attribute points to refund.');
    if (sheet.commerce.revision >= Number.MAX_SAFE_INTEGER || sheet.commerce.operations >= Number.MAX_SAFE_INTEGER) return fail('This transaction exceeds the supported limit.');
    const signature = JSON.stringify([sheet.attributes, sheet.statPoints]);
    return {ok:true,item:null,quote:{npcId:npc.id,revision:sheet.commerce.revision,epoch:stockEpoch(level),itemId:signature,itemRevision:0,price:0,request:{type:'resetAttributes'}}};
  }
  if (request.type === 'respec') {
    if (npc.role !== 'enchanter') return fail('Visit an enchanter to reset skills.');
    if (sheet.commerce.revision >= Number.MAX_SAFE_INTEGER || sheet.commerce.operations >= Number.MAX_SAFE_INTEGER) return fail('This transaction exceeds the supported limit.');
    const points = respecPoints(sheet);
    if (points <= 0) return fail('No spent skill points to refund.');
    const signature = JSON.stringify([sheet.allocatedNodes, sheet.skillRanks, sheet.skillPoints]);
    return {ok:true,item:null,quote:{npcId:npc.id,revision:sheet.commerce.revision,epoch:stockEpoch(level),itemId:signature,itemRevision:0,price:points*RESPEC_GOLD_PER_POINT,request:{type:'respec'}}};
  }
  if (request.type === 'unlockStorage') {
    if (npc.role !== 'stash') return fail('Visit a storage chest.');
    const price = nextStorageTabPrice(sheet), count = storageTabCount(sheet);
    if (price === null) return fail('All five storage tabs are unlocked.');
    if (request.tab !== count) return fail('Unlock storage tabs in order.');
    if (sheet.commerce.revision >= Number.MAX_SAFE_INTEGER || sheet.commerce.operations >= Number.MAX_SAFE_INTEGER) return fail('This transaction exceeds the supported limit.');
    return {ok:true,item:null,quote:{npcId:npc.id,revision:sheet.commerce.revision,epoch:stockEpoch(level),
      itemId:`storage-tab:${count}`,itemRevision:0,price,request:{...request}}};
  }
  if (request.type === 'gamble') {
    if(npc.role!=='gambler'||!GAMBLE_KINDS.includes(request.kind))return fail('Choose an item type at the gambler.');
    item=gambleItem(sheet,npc,level,request.kind);price=gamblePrice(npc,level,request.kind);
  } else if(request.type==='store'||request.type==='retrieve') {
    if(npc.role!=='stash')return fail('Visit a storage chest.');
    if(request.type==='store'&&!hasStorageTab(sheet,request.tab??0))return fail('This storage tab is locked.');
    const index=request.type==='store'?request.bag:request.slot;
    if(!Number.isInteger(index)||index<0)return fail('Invalid storage slot.');
    item=(request.type==='store'?sheet.inventory:sheet.stash??[])[index]??null;
  } else if(npc.role==='stash')return fail('This service is not available here.');
  else if (request.type === 'sellMany') {
    if (!Array.isArray(request.items) || !request.items.length || request.items.length > sheet.inventory.length) return fail('Select items to sell.');
    if(request.includeActiveCharms!==undefined&&typeof request.includeActiveCharms!=='boolean')return fail('Invalid charm selection.');
    const eligible=new Set(bulkSaleItems(sheet,level,request.includeActiveCharms).map(i=>i.id));
    const slots = new Set<number>(), ids = new Set<string>();
    for (const selected of request.items) {
      if (!selected || !Number.isInteger(selected.bag) || selected.bag < 0 || selected.bag >= sheet.inventory.length || slots.has(selected.bag) || ids.has(selected.id)) return fail('Invalid item selection.');
      const owned = sheet.inventory[selected.bag];
      if (!owned || owned.id !== selected.id || owned.recipe.revision !== selected.revision) return fail('The selection changed. Select the items again.');
      if(!eligible.has(owned.id))return fail(owned.locked?'Unlock this item before selling it.':'Enable active charms to include them in a bulk sale.');
      slots.add(selected.bag); ids.add(selected.id); item ??= owned; price += itemPrice(owned, 'sell');
    }
  } else if (request.type === 'buy' || request.type === 'sell' || request.type === 'buyback') {
    if (request.type === 'buy') { if (npc.role !== 'blacksmith' && npc.role !== 'jeweler') return fail('This service is not available here.'); item = vendorStock(sheet, npc, level)[request.slot] ?? null; if (item) price = itemPrice(item, 'buy'); }
    else if (request.type === 'buyback') { const entry = sheet.commerce.buyback.find(b => b.item.id === request.id); item = entry?.item ?? null; price = entry?.price ?? 0; }
    else { if ('equipped' in request.source) return fail('Unequip this item before selling.'); item = sourceItem(sheet, request.source); if (item) price = itemPrice(item, 'sell'); }
  } else {
    if ((npc.role !== 'blacksmith' && npc.role !== 'enchanter') || (request.operation === 'enhance') !== (npc.role === 'blacksmith')) return fail('This service is not available here.');
    item = sourceItem(sheet, request.source);
    if (item) {
      if(request.focus!==undefined&&(!AFFIX_FOCUSES.includes(request.focus)||request.focus!=='any'&&(npc.settlementTier!=='city'||npc.role!=='enchanter'||!['rerollOne','rerollAll'].includes(request.operation))))return fail('Focused rerolls are available from city enchanters.');
      const problem = improvementProblem(item, request.operation, vendorLevel(npc, level), request.affix); if (problem) return fail(problem);
      if (request.operation === 'relevel' && 'equipped' in request.source && vendorLevel(npc, level) - 2 > level) return fail('Unequip first: the new level requirement exceeds your level.');
      if(request.focus&&request.focus!=='any'){
        const pool=request.operation==='rerollAll'&&item.affixes.length>1?itemAffixPool(item):rerollPool(item,request.operation==='rerollOne'?request.affix:undefined);
        if(!pool.some(a=>affixCategory(a.stat)===request.focus)||!pool.some(a=>affixCategory(a.stat)!==request.focus))return fail('This preference would not change the available affix odds.');
      }
      price = Math.ceil(improvementPrice(item, request.operation, vendorLevel(npc, level))*(request.focus&&request.focus!=='any'?1.75:1));
    }
  }
  if (!item) return fail('This item is no longer available.');
  if(request.type==='sell'&&item.locked)return fail('Unlock this item before selling it.');
  if (!Number.isSafeInteger(price) || price < 0 || sheet.commerce.revision >= Number.MAX_SAFE_INTEGER || sheet.commerce.operations >= Number.MAX_SAFE_INTEGER) return fail('This transaction exceeds the supported limit.');
  return { ok: true, item, quote: { npcId: npc.id, revision: sheet.commerce.revision, epoch: stockEpoch(level), itemId: item.id,
    itemRevision: item.recipe.revision, price, request: request.type === 'sellMany' ? { type: 'sellMany', items: request.items.map(i => ({ ...i })), ...(request.includeActiveCharms===undefined?{}:{includeActiveCharms:request.includeActiveCharms}) } : { ...request } } };
}
export type TradePlan = { ok: false; message: string } | { ok: true; character: CharacterSheet; message: string; item: Item | null };
/** No live mutation: the caller persists this complete sheet before publishing it. */
export function planService(sheet: CharacterSheet, npc: TownNPC, level: number, quote: ServiceQuote): TradePlan {
  const current = quoteService(sheet, npc, level, quote.request);
  if (!current.ok) return current;
  if (JSON.stringify(current.quote) !== JSON.stringify(quote)) return { ok: false, message: 'The offer changed. Select the item again.' };
  const character: CharacterSheet = { ...sheet, stash: [...(sheet.stash??Array(STASH_CAPACITY).fill(null))], inventory: [...sheet.inventory], equipped: { ...sheet.equipped }, commerce: {
    ...sheet.commerce, refreshes: sheet.commerce.epoch === stockEpoch(level) ? { ...sheet.commerce.refreshes } : {},
    sold: sheet.commerce.epoch === stockEpoch(level) ? { ...sheet.commerce.sold } : {},
    epoch: stockEpoch(level), revision: sheet.commerce.revision + 1, operations: sheet.commerce.operations + 1, buyback: [...sheet.commerce.buyback],
  } };
  const { request, price } = quote; let item = current.item, message = '';
  if (request.type !== 'sell' && request.type !== 'sellMany' && goldBalance(sheet) < price) return { ok: false, message: 'Not enough gold.' };
  if (request.type === 'refreshStock') {
    if (!spendGold(character, price)) return {ok:false,message:'Not enough gold.'};
    character.commerce.refreshes![npc.id] = vendorRefreshCount(sheet,npc,level) + 1;
    character.commerce.sold[npc.id] = 0;
    return {ok:true,character,item:null,message:'New stock has arrived.'};
  }
  if (request.type === 'unlockStorage') {
    if (!spendGold(character,price)) return {ok:false,message:'Not enough gold.'};
    character.stash!.push(...Array(STASH_CAPACITY).fill(null));
    return {ok:true,character,item:null,message:`Storage tab ${request.tab+1} unlocked.`};
  }
  if (request.type === 'resetAttributes') {
    const points = attributeResetPoints(character);
    character.statPoints += points;
    character.attributes = {strength:10,dexterity:10,intelligence:10,vitality:10};
    character.attributeResetUsed = true;
    return {ok:true,character,item:null,message:`${points} attribute points refunded.`};
  }
  if (request.type === 'respec') {
    if (!spendGold(character,price)) return {ok:false,message:'Not enough gold.'};
    const points=respecPoints(character);
    character.skillPoints += points;
    character.allocatedNodes=['origin']; character.skillRanks={}; character.activeSkillRanks={};
    character.skillSpecializations={}; character.skillSlots=Array(5).fill(null); character.arcaneOverload=false;
    return {ok:true,character,item:null,message:`${points} skill points refunded.`};
  }
  if (!item) return {ok:false,message:'This item is no longer available.'};
  if ((request.type === 'buy' || request.type === 'buyback' || request.type === 'gamble' || request.type === 'retrieve') && !canPackItem(character, item)) return { ok: false, message: packSpaceProblem(character,item) };
  if(request.type==='store'||request.type==='retrieve') {
    if(request.type==='store'){
      const start=(request.tab??0)*STASH_CAPACITY,slot=character.stash!.indexOf(null,start);
      if(slot<0||slot>=start+STASH_CAPACITY)return {ok:false,message:'Storage tab full.'};
      character.stash![slot]=item;character.inventory[request.bag]=null;
    }else{if(!addInventoryItem(character,item))return {ok:false,message:packSpaceProblem(character,item)};character.stash![request.slot]=null;}
    normalizePackLayout(character);
    return {ok:true,character,message:request.type==='store'?'Item stored.':'Item retrieved.',item};
  }
  if (request.type === 'sellMany') {
    if (!creditGold(character, price)) return { ok: false, message: 'Gold limit reached.' };
    for (const selected of request.items) {
      const sold = character.inventory[selected.bag]!;
      character.inventory[selected.bag] = null;
      character.commerce.buyback.unshift({ item: sold, price: itemPrice(sold, 'sell') });
    }
    character.commerce.buyback.length = Math.min(COMMERCE_LIMITS.buyback, character.commerce.buyback.length);
    message = `Sold ${request.items.length} items · +${price.toLocaleString()} gold`;
  } else if (request.type === 'sell') {
    if (!creditGold(character, price)) return { ok: false, message: 'Gold limit reached.' };
    if ('bag' in request.source) character.inventory[request.source.bag] = null;
    character.commerce.buyback.unshift({ item, price }); character.commerce.buyback.length = Math.min(COMMERCE_LIMITS.buyback, character.commerce.buyback.length);
    message = `Sold ${itemDisplayName(item)} · +${price} gold`;
  } else {
    if (!spendGold(character, price)) return { ok: false, message: 'Not enough gold.' };
    if (request.type === 'buy' || request.type === 'buyback' || request.type === 'gamble') {
      const purchasedId = item.id;
      if ([...character.inventory, ...Object.values(character.equipped)].some(i => i?.id === purchasedId)) return { ok: false, message: 'This item is already owned.' };
      if (!addInventoryItem(character, item)) return { ok: false, message: 'Cannot add this item to your inventory.' };
      if (request.type === 'buy') character.commerce.sold[npc.id] = (character.commerce.sold[npc.id] ?? 0) | 1 << request.slot;
      else if(request.type==='buyback') character.commerce.buyback = character.commerce.buyback.filter(b => b.item.id !== purchasedId);
      message = `${request.type==='gamble'?'Revealed':'Bought'} ${itemDisplayName(item)}`;
    } else {
      item = improveItem(item, request.operation, vendorLevel(npc, level), hashService(`${item.id}:${character.commerce.operations}:${item.recipe.revision}`), request.affix,request.focus);
      if ('bag' in request.source) character.inventory[request.source.bag] = item; else character.equipped[request.source.equipped] = item;
      message = `${itemDisplayName(item)} improved`;
    }
  }
  normalizePackLayout(character);
  return { ok: true, character, message, item };
}
