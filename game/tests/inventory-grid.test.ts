import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterSheet, generateItem } from '../src/items.ts';
import { itemFootprint, storageGridLayout, PACK_CELLS, PACK_COLUMNS, resolvePackLayout, footprintCells, validPackLayout, canPackItem } from '../src/inventory-grid.ts';
import { addInventoryItem, moveInventoryItem, equipItem, unequipItem } from '../src/inventory.ts';
import { sortInventory } from '../src/inventory-tools.ts';

const gear=(seed:number,kind:Parameters<typeof generateItem>[2],profile?:string)=>generateItem(seed,1,kind,profile,'common');
test('physical equipment sizes are stable across rarity and match one/two-handed silhouettes',()=>{
  assert.deepEqual(itemFootprint(gear(1,'weapon','greatblade')),{width:2,height:4});
  assert.deepEqual(itemFootprint(gear(2,'weapon','rondel-dagger')),{width:1,height:2});
  assert.deepEqual(itemFootprint(gear(3,'weapon','star-wand')),{width:1,height:2});
  assert.deepEqual(itemFootprint(gear(4,'chest')),{width:2,height:3});
  assert.deepEqual(itemFootprint(gear(5,'ring')),{width:1,height:1});
});
test('footprints never wrap rows or enter the four reserved charm rows',()=>{
  const chest=gear(6,'chest');
  assert.equal(footprintCells(chest,PACK_COLUMNS-1),null);
  assert.equal(footprintCells(chest,PACK_CELLS-PACK_COLUMNS),null);
  assert.equal(footprintCells(chest,PACK_CELLS),null);
  assert.equal(footprintCells(chest,NaN),null);
});
test('placing and swapping uses all occupied cells, preserves records and rejects collisions atomically',()=>{
  const s=createCharacterSheet(),a=gear(10,'chest'),b=gear(11,'chest'),ring=gear(12,'ring');
  assert.ok(addInventoryItem(s,a));assert.ok(addInventoryItem(s,b));assert.ok(addInventoryItem(s,ring));
  const before=resolvePackLayout(s), inventory=[...s.inventory];
  assert.ok(moveInventoryItem(s,0,before[b.id]).ok);
  assert.equal(s.inventoryLayout![b.id],before[a.id]);assert.deepEqual(s.inventory,inventory);
  assert.ok(moveInventoryItem(s,2,PACK_CELLS-1).ok);
  const snapshot=structuredClone(s);
  assert.equal(moveInventoryItem(s,0,PACK_COLUMNS-1).ok,false);assert.deepEqual(s,snapshot);
  assert.equal(moveInventoryItem(s,2,1).ok,false,'a tiny ring cannot swap a chest into its occupied origin');
  assert.deepEqual(s,snapshot);
});
test('old crowded bags keep overflow, block new loot and can recover by equipping or storing items',()=>{
  const s=createCharacterSheet(); s.inventory=Array.from({length:64},(_,i)=>gear(100+i,'chest'));
  const before=structuredClone(s),layout=resolvePackLayout(s);
  assert.equal(Object.keys(layout).length,12);assert.deepEqual(s,before,'projection never mutates saves');
  assert.equal(addInventoryItem(s,gear(500,'ring')),false);assert.deepEqual(s,before);
  const overflow=s.inventory[63]!;s.equipped.chest=null;
  assert.ok(equipItem(s,63,1).ok);assert.equal(s.equipped.chest,overflow);
  assert.ok(validPackLayout(s.inventory,s.inventoryLayout));
});
test('all 72 cells are usable for jewelry, with no invisible item-count limit',()=>{
  const s=createCharacterSheet();s.inventory=Array(64).fill(null);
  for(let i=0;i<PACK_CELLS;i++)assert.ok(addInventoryItem(s,gear(600+i,'ring')));
  assert.equal(Object.keys(resolvePackLayout(s)).length,PACK_CELLS);
  assert.equal(addInventoryItem(s,gear(800,'ring')),false);
  assert.equal(canPackItem(s,gear(801,'ring')),false);
});
test('one-click packing is deterministic, preserves acquisition order, and never increases overflow',()=>{
  const s=createCharacterSheet();const all=[gear(901,'ring'),gear(902,'weapon','greatblade'),gear(903,'chest'),gear(904,'weapon','star-wand')];
  for(const i of all)assert.ok(addInventoryItem(s,i));
  assert.ok(moveInventoryItem(s,0,PACK_CELLS-1).ok);const recent=[...s.recentItems!];
  assert.ok(sortInventory(s,'compact').ok);const sorted=structuredClone(s);
  assert.ok(sortInventory(s,'compact').ok);assert.deepEqual(s,sorted);assert.deepEqual(s.recentItems,recent);
  assert.equal(Object.keys(s.inventoryLayout!).length,all.length);assert.ok(validPackLayout(s.inventory,s.inventoryLayout));
});
test('unequip obeys physical placement and save validation rejects overlaps, non-owned IDs and charm cells',()=>{
  const s=createCharacterSheet();const helm=s.equipped.head!;
  const snapshot=structuredClone(s);assert.equal(unequipItem(s,'head',PACK_CELLS-1).ok,false);assert.deepEqual(s,snapshot);
  assert.ok(unequipItem(s,'head',0).ok);assert.equal(s.inventoryLayout![helm.id],0);
  const ring=gear(990,'ring');assert.ok(addInventoryItem(s,ring));
  assert.ok(validPackLayout(s.inventory,s.inventoryLayout));
  assert.equal(validPackLayout(s.inventory,{...s.inventoryLayout,[ring.id]:0}),false);
  assert.equal(validPackLayout(s.inventory,{...s.inventoryLayout,[ring.id]:PACK_CELLS}),false);
  assert.equal(validPackLayout(s.inventory,{...s.inventoryLayout,missing:50}),false);
});


test('storage keeps saved slot identities and fits a full stash of large gear and charms without overlap', () => {
  const stored = Array.from({length:96}, (_,i) => i % 3 === 0
    ? gear(900+i,'charm','jade-monolith') : gear(900+i,'weapon','greatblade'));
  const before = JSON.stringify(stored), layout = storageGridLayout(stored), occupied = new Set<number>();
  assert.equal(layout.cells.length,96);
  assert.ok(layout.rows > 8, 'large gear extends storage instead of hiding or rejecting owned items');
  stored.forEach((item,slot) => {
    const cell = layout.cells[slot]! , size = itemFootprint(item);
    assert.equal(typeof cell,'number');
    assert.ok(cell % PACK_COLUMNS + size.width <= PACK_COLUMNS);
    assert.ok(Math.floor(cell/PACK_COLUMNS) + size.height <= layout.rows);
    for(let y=0;y<size.height;y++)for(let x=0;x<size.width;x++) {
      const at = cell+y*PACK_COLUMNS+x;
      assert.ok(!occupied.has(at), `stored slot ${slot} overlaps another item`);
      occupied.add(at);
    }
  });
  assert.equal(JSON.stringify(stored),before);
  assert.deepEqual(storageGridLayout(stored),layout);
  const sparse = [null,stored[0],null,stored[1]];
  const repacked = storageGridLayout(sparse);
  assert.equal(repacked.cells[0],null); assert.equal(repacked.cells[2],null);
  assert.equal(typeof repacked.cells[1],'number'); assert.equal(typeof repacked.cells[3],'number');
  assert.deepEqual(storageGridLayout([]),{cells:[],rows:8});
});
