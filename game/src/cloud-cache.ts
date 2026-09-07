import { emptyChronicle, mergeChronicles, parseChronicleLedger, recordChronicle, type ChronicleLedger } from './chronicle.ts';
import { decodeSaveBundle, type SaveBundle } from './save-bundle.ts';
export interface CloudUpload { operation: string; base: number; bundle: SaveBundle | null; }
export interface CloudRow { history?:ChronicleLedger; upload?: CloudUpload; index: number; token: string; base: number; bundle: SaveBundle | null; dirty: boolean; operation: string; conflict: boolean; }
/** Migrate the live read projection without rewriting cached bytes or an immutable upload retry. */
function currentRow(row:CloudRow):CloudRow {
  if(row.bundle && Number(row.bundle.character.version)===3){
    const bundle=decodeSaveBundle(JSON.stringify(row.bundle));
    if(!bundle)throw new Error('Invalid save file.');
    return {...row,bundle};
  }
  return row;
}
export type CacheCommand =
  | {kind:'read-history'} | {kind:'history'; ledger:ChronicleLedger}
  | { kind: 'list' } | { kind: 'read'; index: number }
  | { kind: 'write'; index: number; expected: string | null; bundle: SaveBundle | null; operation: string }
  | { kind: 'upload'; index: number }
  | { kind: 'resolve'; index: number; expected: string; bundle: SaveBundle | null; base: number }
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
  return { close: async () => (await opened).close(), execute: async (command: CacheCommand): Promise<CloudRow | CloudRow[] | ChronicleLedger | null> => {
    if ('index' in command && (!Number.isInteger(command.index) || command.index < 0 || command.index > 7)) throw new Error('Invalid slot.');
    if ((command.kind === 'write' || command.kind === 'adopt' || command.kind === 'resolve') && command.bundle && !decodeSaveBundle(JSON.stringify(command.bundle))) throw new Error('Invalid save file.');
    const db = await opened;
    if(command.kind==='read-history'||command.kind==='history')return new Promise<ChronicleLedger>((resolve,reject)=>{
      const tx=db.transaction('history',command.kind==='history'?'readwrite':'readonly'),store=tx.objectStore('history'),read=store.get('account');let ledger:ChronicleLedger;
      read.onsuccess=()=>{try{ledger=parseChronicleLedger(read.result);if(command.kind==='history'){ledger=mergeChronicles(ledger,parseChronicleLedger(JSON.stringify(command.ledger)));store.put(JSON.stringify(ledger),'account');}}catch(error){tx.abort();reject(error);}};
      tx.oncomplete=()=>resolve(ledger);tx.onerror=tx.onabort=()=>reject(tx.error??new Error('Chronicle unavailable.'));
    });
    return new Promise((resolve, reject) => {
      const tx = db.transaction('slots', command.kind === 'list' || command.kind === 'read' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('slots');
      const request = command.kind === 'list' ? store.getAll() : store.get(command.index);
      let result: CloudRow | CloudRow[] | null = null;
      request.onsuccess = () => {
        if (command.kind === 'list') { result = request.result; return; }
        const row: CloudRow | null = request.result ?? null;
        result = row;
        if (command.kind === 'read') return;
        if (command.kind === 'write' || command.kind === 'adopt' || command.kind === 'resolve') {
          if ((row?.token ?? null) !== command.expected || command.kind === 'adopt' && row?.dirty || command.kind === 'resolve' && !row?.conflict) { result = null; return; }
          result = { index: command.index, token: String(Number(row?.token ?? 0) + 1),
            base: command.kind !== 'write' ? command.base : row?.base ?? 0,
            upload: command.kind === 'write' ? row?.upload : undefined,
            bundle: command.bundle, dirty: command.kind === 'write',
            operation: command.kind === 'write' ? command.operation : '', conflict: command.kind === 'write' && !!row?.conflict };
        } else if (command.kind === 'upload') {
          if (row?.dirty && !row.conflict && !row.upload) result = { ...row, upload: { operation: row.operation, base: row.base, bundle: row.bundle } };
        } else if (row && row.base === command.base) {
          if (command.kind === 'ack') result = { ...row, base: command.revision, dirty: row.operation !== command.operation, conflict: false, upload: undefined };
          else result = { ...row, conflict: true };
        }
        if (result && !Array.isArray(result)) {
          let history=row?.history??emptyChronicle();
          if(row?.bundle&&!row.dirty&&!row.conflict)history=recordChronicle(history,row.bundle.character,!result.bundle);
          // Only acknowledged history is permanent. Divergent recovery never pollutes account totals.
          if(command.kind==='ack'&&row?.upload?.bundle)history=recordChronicle(history,row.upload.bundle.character);
          if((command.kind==='adopt'||command.kind==='resolve')&&command.bundle)history=recordChronicle(history,command.bundle.character);
          if(command.kind==='ack'&&row?.upload?.bundle===null){history=mergeChronicles(history);for(const c of Object.values(history.characters))c.deleted=true;}
          result.history=history;store.put(result);
        }
      };
      tx.oncomplete = () => {
        try { resolve(Array.isArray(result)?result.map(currentRow):result?currentRow(result):null); }
        catch(error){reject(error);}
      };
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Save storage unavailable.'));
    });
  } };
}
