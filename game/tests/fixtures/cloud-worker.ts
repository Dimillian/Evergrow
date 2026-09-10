// Browser Worker adapter: run the production worker and real IndexedDB transactions in Node.
import { parentPort, workerData } from 'node:worker_threads';
import { IDBFactory } from 'fake-indexeddb';
Object.assign(globalThis, { indexedDB: new IDBFactory(), postMessage: (data: unknown) => parentPort!.postMessage(data) });
await import('../../src/cloud-worker.ts');
parentPort!.on('message', async data => {
  if (data.method === 'init' && workerData?.seedRows?.length) {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(`evergrow-cloud:${data.account}`, 2);
      request.onupgradeneeded = () => { request.result.createObjectStore('slots', { keyPath: 'index' }); request.result.createObjectStore('history'); };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const tx = request.result.transaction('slots', 'readwrite');
        for (const row of workerData.seedRows) tx.objectStore('slots').put(row);
        tx.oncomplete = () => { request.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }
  (globalThis as unknown as { onmessage(event: {data:unknown}):void }).onmessage({data});
});
