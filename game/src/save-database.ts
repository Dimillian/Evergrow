import { CharacterRepository, type SaveSlot } from './character-storage.ts';
import type { CharacterSave } from './character-save.ts';
import { Exploration, type ChartResult } from './exploration.ts';
import { decodeExploration, type DecodedExploration } from './exploration-save.ts';

export type SaveRequest = { id: number } & (
  { method: 'read' | 'list' | 'write' | 'remove'; index?: number; record?: CharacterSave; expected?: string | null }
  | { method: 'chart-read' | 'chart-write' | 'chart-remove'; key: string; seed: number; generation: string; data?: DecodedExploration });

export function openSaveDatabase(factory: IDBFactory) {
const opened = new Promise<IDBDatabase>((resolve, reject) => {
  const request = factory.open('evergrow-local', 1);
  request.onupgradeneeded = () => { request.result.createObjectStore('characters'); request.result.createObjectStore('charts'); };
  request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error('Close other game tabs to open local storage.'));
});

/** JSON work lives here. A single read/write transaction makes compare-and-write atomic across tabs. */
async function execute(message: SaveRequest) {
  const db = await opened;
  if ('key' in message) return chartTransaction(db, message);
  return new Promise<unknown>((resolve, reject) => {
    const writing = message.method === 'write' || message.method === 'remove';
    const tx = db.transaction('characters', writing ? 'readwrite' : 'readonly');
    const store = tx.objectStore('characters'), request = store.getAll();
    let result: unknown;
    request.onsuccess = () => {
      try {
        const values = new Map<string, string>(request.result as [string, string][]);
        const repository = new CharacterRepository({ getItem: key => values.get(key) ?? null,
          setItem: (key, value) => { values.set(key, value); store.put([key, value], key); } });
        const token = (index: number) => values.get(`revision:${index}`) ?? null;
        const publicSlot = (slot: SaveSlot): SaveSlot => ({ ...slot, token: token(slot.index) });
        if (message.method === 'list') result = repository.list().map(publicSlot);
        else if (message.method === 'read') result = publicSlot(repository.read(message.index!));
        else {
          const index = message.index!, current = token(index);
          if ((message.expected ?? null) !== current) {
            result = { ok: false, message: 'This character changed in another tab. Return to the character hall and reload it before saving.' };
          } else {
            const slot = repository.read(index);
            const saved = message.method === 'write' ? repository.write(index, message.record!, slot.token) : repository.remove(index, slot.token);
            result = saved;
            if (saved.ok) {
              // Return a tiny revision token, never the serialized character, to the game thread.
              const next = String(Number(current ?? 0) + 1), key = `revision:${index}`;
              store.put([key, next], key); result = { ok: true, token: next };
            }
          }
        }
      } catch (error) { tx.abort(); reject(error); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Local storage transaction failed.'));
  });
}
  return { execute, close: async () => { (await opened).close(); } };
}

function chartTransaction(db: IDBDatabase, message: Extract<SaveRequest, { key: string }>): Promise<ChartResult> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('charts', message.method === 'chart-read' ? 'readonly' : 'readwrite');
    const store = tx.objectStore('charts'), request = store.get(message.key);
    let result: ChartResult = { status: 'session' };
    request.onsuccess = () => {
      try {
        const raw: string | null = request.result ?? null;
        if (message.method === 'chart-remove') { store.delete(message.key); result = { status: 'saved' }; return; }
        if (message.method === 'chart-read') {
          const data = raw === null ? undefined : decodeExploration(raw, message) ?? undefined;
          result = { status: raw !== null && !data ? 'invalid' : 'saved', data }; return;
        }
        let staged = raw;
        const chart = new Exploration({ seed: message.seed, generationVersion: message.generation, getPOIs: () => [] }, {
          storage: { getItem: () => staged, setItem: (_key, value) => { staged = value; } },
        });
        if (chart.storageStatus === 'invalid') { result = { status: 'invalid' }; chart.dispose(); return; }
        if (!message.data || !chart.importSnapshot(message.data)) { result = { status: 'full' }; chart.dispose(); return; }
        if (!chart.save()) { result = { status: chart.storageStatus === 'full' ? 'full' : 'invalid' }; chart.dispose(); return; }
        if (!staged || !decodeExploration(staged, message)) { result = { status: 'invalid' }; chart.dispose(); return; }
        store.put(staged, message.key);
        result = { status: 'saved', data: chart.snapshot() }; chart.dispose();
      } catch (error) { tx.abort(); reject(error); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Chart storage transaction failed.'));
  });
}
