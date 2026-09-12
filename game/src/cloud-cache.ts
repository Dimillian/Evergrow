import { canUpgradeWorld, upgradeWorldChart } from './world-save-upgrade.ts';
import type { CharacterSave } from './character-save.ts';
import type { DecodedExploration } from './exploration-save.ts';
import { emptyChronicle, mergeChronicles, parseChronicleLedger, recordChronicle, type ChronicleLedger } from './chronicle.ts';
import { decodeSaveBundle, makeSaveBundle, bundleChart, type SaveBundle } from './save-bundle.ts';
import { CloudSaveError } from './cloud-errors.ts';
export interface CloudUpload { operation: string; base: number; bundle: SaveBundle | null; }
export interface CloudRow { history?:ChronicleLedger; upload?: CloudUpload; index: number; token: string; base: number; bundle: SaveBundle | null; dirty: boolean; operation: string; conflict: boolean; }
/** Called by the save worker before its revision-checked bundle transaction. */
export function prepareCloudSave(old:CloudRow|null,record:CharacterSave,chart?:DecodedExploration):SaveBundle{
  const previous=old?.bundle;
  if(previous&&previous.character.id===record.id&&previous.character.worldSeed===record.worldSeed&&canUpgradeWorld(previous.character.worldVersion,record.worldVersion))
    chart=upgradeWorldChart(bundleChart(previous),record.worldSeed);
  return makeSaveBundle(record,chart);
}
/** Validate the live read projection without rewriting cached bytes or an immutable upload retry. */
function currentRow(row:CloudRow):CloudRow {
  if(row.bundle){
    const bundle=decodeSaveBundle(JSON.stringify(row.bundle));
    if(!bundle)throw new CloudSaveError('This saved character cannot be read by this version. Its recovery copy is preserved.');
    return {...row,bundle};
  }
  return row;
}
export type CacheCommand =
  | {kind:'chronicle'} | {kind:'read-history'} | {kind:'history'; ledger:ChronicleLedger}
  | { kind: 'list' } | { kind: 'read'; index: number }
  | { kind: 'inspect'; index: number }
  | { kind: 'write'; index: number; expected: string | null; bundle: SaveBundle | null; operation: string }
  | { kind: 'upload'; index: number }
  | { kind: 'resolve'; index: number; expected: string; bundle: SaveBundle | null; base: number }
  | { kind: 'delete'; index: number; expected: string | null; base: number }
  | { kind: 'adopt'; index: number; expected: string | null; bundle: SaveBundle | null; base: number }
  | { kind: 'ack'; index: number; operation: string; base: number; revision: number }
  | { kind: 'conflict'; index: number; base: number };
/** One account-scoped transaction owns checkpoint, chart and pending upload. */
export function openCloudCache(factory: IDBFactory, account: string) {
  const opened = new Promise<IDBDatabase>((resolve, reject) => {
    const r = factory.open(`evergrow-cloud:${account}`, 2);
    r.onupgradeneeded = () => {if(!r.result.objectStoreNames.contains('slots'))r.result.createObjectStore('slots', {keyPath:'index'});if(!r.result.objectStoreNames.contains('history'))r.result.createObjectStore('history');};
    r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); resolve(r.result); };
    r.onerror = () => reject(r.error); r.onblocked = () => reject(new Error('Close other Evergrow tabs.'));
  });
  return { ready: opened.then(() => {}), close: async () => (await opened).close(), execute: async (command: CacheCommand): Promise<CloudRow | CloudRow[] | ChronicleLedger | null> => {
    if ('index' in command && (!Number.isInteger(command.index) || command.index < 0 || command.index > 7)) throw new Error('Invalid slot.');
    if ((command.kind === 'write' || command.kind === 'adopt' || command.kind === 'resolve') && command.bundle && !decodeSaveBundle(JSON.stringify(command.bundle))) throw new CloudSaveError('This saved character cannot be read by this version. The original save is preserved.');
    const db = await opened;
    if(command.kind==='chronicle')return new Promise<ChronicleLedger>((resolve,reject)=>{
      const tx=db.transaction(['slots','history'],'readonly');
      const rows=tx.objectStore('slots').getAll(), stored=tx.objectStore('history').get('account');
      tx.oncomplete=()=>{try{
        const entries=(rows.result as CloudRow[]).map(currentRow);
        let ledger=mergeChronicles(parseChronicleLedger(stored.result),...entries.map(row=>row.history??emptyChronicle()));
        for(const row of entries)if(row.bundle&&!row.conflict)ledger=recordChronicle(ledger,row.bundle.character);
        resolve(ledger);
      }catch(error){reject(error);}};
      tx.onerror=tx.onabort=()=>reject(tx.error??new Error('Chronicle unavailable.'));
    });
    if(command.kind==='read-history'||command.kind==='history')return new Promise<ChronicleLedger>((resolve,reject)=>{
      const tx=db.transaction('history',command.kind==='history'?'readwrite':'readonly'),store=tx.objectStore('history'),read=store.get('account');let ledger:ChronicleLedger;
      read.onsuccess=()=>{try{ledger=parseChronicleLedger(read.result);if(command.kind==='history'){ledger=mergeChronicles(ledger,parseChronicleLedger(JSON.stringify(command.ledger)));store.put(JSON.stringify(ledger),'account');}}catch(error){tx.abort();reject(error);}};
      tx.oncomplete=()=>resolve(ledger);tx.onerror=tx.onabort=()=>reject(tx.error??new Error('Chronicle unavailable.'));
    });
    return new Promise((resolve, reject) => {
      const tx = db.transaction('slots', command.kind === 'list' || command.kind === 'read' || command.kind === 'inspect' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('slots');
      const request = command.kind === 'list' ? store.getAll() : store.get(command.index);
      let result: CloudRow | CloudRow[] | null = null;
      request.onsuccess = () => {
        if (command.kind === 'list') { result = request.result; return; }
        const row: CloudRow | null = request.result ?? null;
        result = row;
        if (command.kind === 'read' || command.kind === 'inspect') return;
        if (command.kind === 'write' || command.kind === 'adopt' || command.kind === 'resolve' || command.kind === 'delete') {
          if ((row?.token ?? null) !== command.expected || command.kind === 'adopt' && row?.dirty || command.kind === 'resolve' && !row?.conflict) { result = null; return; }
          // Recovery play may save the same character. Never let a replacement inherit
          // unresolved upload/deletion state, including a race after the hall read.
          if (command.kind === 'write' && command.bundle && row && (row.conflict || row.dirty)
            && row.bundle?.character.id !== command.bundle.character.id) { result = null; return; }
          result = { index: command.index, token: String(Number(row?.token ?? 0) + 1),
            base: command.kind !== 'write' ? command.base : row?.base ?? 0,
            upload: command.kind === 'write' ? row?.upload : undefined,
            bundle: command.kind === 'delete' ? null : command.bundle, dirty: command.kind === 'write',
            operation: command.kind === 'write' ? command.operation : '', conflict: command.kind === 'write' && !!row?.conflict };
        } else if (command.kind === 'upload') {
          if (row?.dirty && !row.conflict && !row.upload) result = { ...row, upload: { operation: row.operation, base: row.base, bundle: row.bundle } };
        } else if (row && row.base === command.base) {
          if (command.kind === 'ack') result = { ...row, base: command.revision, dirty: row.operation !== command.operation, conflict: false, upload: undefined };
          else if (row.dirty) result = { ...row, conflict: true };
        }
        if (result && !Array.isArray(result)) {
          let history=row?.history??emptyChronicle();
          if(row?.bundle&&!row.dirty&&!row.conflict) {
            const previous = decodeSaveBundle(JSON.stringify(row.bundle));
            if (previous) history=recordChronicle(history,previous.character,!result.bundle);
          }
          // Only acknowledged history is permanent. Divergent recovery never pollutes account totals.
          if(command.kind==='ack'&&row?.upload?.bundle)history=recordChronicle(history,row.upload.bundle.character);
          if((command.kind==='adopt'||command.kind==='resolve')&&command.bundle)history=recordChronicle(history,command.bundle.character);
          if(command.kind==='delete'||command.kind==='ack'&&row?.upload?.bundle===null){history=mergeChronicles(history);for(const c of Object.values(history.characters))c.deleted=true;}
          result.history=history;store.put(result);
        }
      };
      tx.oncomplete = () => {
        // Listing raw rows must not let one incompatible character hide all other slots.
        try { resolve(Array.isArray(result)||command.kind==='inspect'||command.kind==='conflict'?result:result?currentRow(result):null); }
        catch(error){reject(error);}
      };
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Save storage unavailable.'));
    });
  } };
}
