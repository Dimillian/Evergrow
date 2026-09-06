// Browser Worker adapter: run the production worker and real IndexedDB transactions in Node.
import { parentPort } from 'node:worker_threads';
import { IDBFactory } from 'fake-indexeddb';
Object.assign(globalThis, { indexedDB: new IDBFactory(), postMessage: (data: unknown) => parentPort!.postMessage(data) });
await import('../../src/cloud-worker.ts');
parentPort!.on('message', data => (globalThis as unknown as { onmessage(event: {data:unknown}):void }).onmessage({data}));
