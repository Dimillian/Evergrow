import { openSaveDatabase, type SaveRequest } from './save-database.ts';
const scope = globalThis as unknown as { onmessage: (event: MessageEvent<SaveRequest>) => void; postMessage(value: unknown): void };
const database = openSaveDatabase(indexedDB);
let queue = Promise.resolve();
scope.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try { scope.postMessage({ id: data.id, result: await database.execute(data) }); }
    catch (error) {
      const name=(error as Error)?.name;
      const message=name==='QuotaExceededError'?'Storage is full. Keep this tab open and free some space before retrying.':name==='TransactionInactiveError'||name==='AbortError'?'Storage was interrupted. Keep this tab open and retry.':(error as Error)?.message||'Storage unavailable. Keep this tab open and retry.';
      console.error('Evergrow storage operation failed',data.method,error);
      scope.postMessage({id:data.id,error:message});
    }
  });
};
