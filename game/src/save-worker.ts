import { openSaveDatabase, type SaveRequest } from './save-database.ts';
const scope = globalThis as unknown as { onmessage: (event: MessageEvent<SaveRequest>) => void; postMessage(value: unknown): void };
const database = openSaveDatabase(indexedDB);
let queue = Promise.resolve();
scope.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try { scope.postMessage({ id: data.id, result: await database.execute(data) }); }
    catch { scope.postMessage({ id: data.id, error: 'Could not save: browser storage is full or unavailable. Your previous save is untouched.' }); }
  });
};
