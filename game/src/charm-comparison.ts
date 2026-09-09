import type { CharacterSheet, Item } from './character-types.ts';
import { activeCharms, compactPackLayout, findPackSpace, packOccupancy, packSpaceProblem, resolvePackLayout } from './inventory-grid.ts';
import { compareCharacterStats } from './equipment-preview.ts';

/** A read-only build comparison. Storage transfers still require a storage chest. */
export function previewCharmReplacement(sheet: CharacterSheet, level: number, candidateId: string, removeIds: readonly string[]) {
  const fail=(message:string)=>({ok:false as const,message});
  const item=[...sheet.inventory,...sheet.stash??[]].find(i=>i?.id===candidateId);
  if(!item||item.kind!=='charm')return fail('Choose a charm to compare.');
  if(item.requiredLevel>level)return fail(`Requires level ${item.requiredLevel}.`);
  const active=activeCharms(sheet,level),activeIds=new Set(active.map(i=>i.id));
  if(activeIds.has(item.id))return fail('Choose a stored or inactive charm.');
  if(new Set(removeIds).size!==removeIds.length||removeIds.some(id=>!activeIds.has(id)))return fail('That charm selection has changed.');
  const removed=new Set([...removeIds,item.id]);
  const inventory=sheet.inventory.map(i=>i&&removed.has(i.id)?null:i);
  const layout=resolvePackLayout({...sheet,inventory});
  const index=inventory.indexOf(null);
  if(index<0)return fail('Make room in the charm grid.');
  const cell=findPackSpace(item,packOccupancy(inventory,layout));
  inventory[index]=item;
  let nextLayout=cell===null?compactPackLayout(inventory):{...layout,[item.id]:cell};
  if(inventory.some(i=>i?.kind==='charm'&&nextLayout[i.id]===undefined))return fail(packSpaceProblem({...sheet,inventory:inventory.map(i=>i?.id===item.id?null:i)},item));
  // Keep the equipment bag fixed; the fallback only proposes rearranging charms.
  nextLayout={...Object.fromEntries(Object.entries(layout).filter(([id])=>inventory.find(i=>i?.id===id)?.kind!=='charm')),
    ...Object.fromEntries(Object.entries(nextLayout).filter(([id])=>inventory.find(i=>i?.id===id)?.kind==='charm'))};
  const after={...sheet,inventory,inventoryLayout:nextLayout};
  return {ok:true as const,item,removed:active.filter(i=>removeIds.includes(i.id)),layout:nextLayout,
    changes:compareCharacterStats(sheet,after,level)};
}
export function charmComparisonCandidates(sheet:CharacterSheet,level:number):Item[]{
  const active=new Set(activeCharms(sheet,level).map(i=>i.id));
  return [...sheet.stash??[],...sheet.inventory].filter((i):i is Item=>!!i&&i.kind==='charm'&&!active.has(i.id));
}
