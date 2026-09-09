import type { ActionResult, CharacterSheet, Item } from './character-types.ts';
import { activeCharms } from './inventory-grid.ts';

export function setItemLock(sheet: CharacterSheet, id: string, locked: boolean): ActionResult {
  if(typeof id!=='string'||typeof locked!=='boolean')return {ok:false,message:'Invalid item lock.'};
  const index=sheet.inventory.findIndex(i=>i?.id===id);
  if(index>=0){sheet.inventory[index]={...sheet.inventory[index]!,locked};return {ok:true};}
  for(const [slot,item] of Object.entries(sheet.equipped))if(item?.id===id){
    sheet.equipped[slot as keyof typeof sheet.equipped]={...item,locked};return {ok:true};
  }
  return {ok:false,message:'That item has changed.'};
}
export function bulkSaleItems(sheet: CharacterSheet, level: number, includeActiveCharms=false): Item[] {
  const active=new Set(includeActiveCharms?[]:activeCharms(sheet,level).map(i=>i.id));
  return sheet.inventory.filter((item):item is Item=>!!item&&!item.locked&&!active.has(item.id));
}
export const ITEM_LOCK_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3"/></svg>';
