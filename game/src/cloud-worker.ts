import { characterPower, previewCharacter } from './character-summary.ts';
import { bundleChart, chartKey, encodeChart } from './save-bundle.ts';
import type { CloudRow } from './cloud-cache.ts';
import { openCloudCache, type CacheCommand } from './cloud-cache.ts';
import { makeSaveBundle, decodeSaveBundle, type SaveBundle } from './save-bundle.ts';
import type { CharacterSave } from './character-save.ts';
import type { DecodedExploration } from './exploration-save.ts';
const scope = globalThis as unknown as { onmessage: (event: MessageEvent) => void; postMessage(value: unknown): void };
let cache: ReturnType<typeof openCloudCache>;
let queue = Promise.resolve();
scope.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try {
      let result: unknown;
      if (data.method === 'init') { cache = openCloudCache(indexedDB, data.account); result = true; }
      else if (data.method === 'write-bundle') {
        const row = await cache.execute({ kind: 'write', index: data.index, expected: data.expected, operation: data.operation,
          bundle: makeSaveBundle(data.record as CharacterSave, data.chart as DecodedExploration) }) as CloudRow | null;
        result = row ? { token: row.token, conflict: row.conflict } : null;
      }
      else if (data.method === 'list-info') {
        const rows = await cache.execute({ kind: 'list' }) as CloudRow[];
        result = rows.map(({ index, token, base, dirty, conflict, bundle }) => ({ index, token, base, dirty, conflict,
          summary: bundle ? { name: bundle.character.name, level: bundle.character.checkpoint.level, updatedAt: bundle.character.updatedAt,
            power: characterPower(previewCharacter(bundle.character)).power } : undefined }));
      }
      else if (data.method === 'chart-status') {
        const rows = await cache.execute({ kind: 'list' }) as CloudRow[];
        const bundle = rows.find(row => row.bundle && chartKey(row.bundle.character) === data.key)?.bundle;
        result = { status: bundle && bundle.chart === encodeChart(bundle.character, data.chart) ? 'saved' : 'session' };
      }
      else if (data.method === 'read-chart') {
        const rows = await cache.execute({ kind: 'list' }) as CloudRow[];
        const bundle = rows.find(row => row.bundle && chartKey(row.bundle.character) === data.key)?.bundle;
        result = bundle ? bundleChart(bundle) : undefined;
      }
      else if (data.method === 'encode-request') result = JSON.stringify(data.body);
      else if (data.method === 'encode') result = JSON.stringify(data.bundle as SaveBundle);
      else if (data.method === 'decode') result = decodeSaveBundle(data.raw);
      else result = await cache.execute(data.command as CacheCommand);
      scope.postMessage({ id: data.id, result });
    } catch (error) { scope.postMessage({ id: data.id, error: (error as Error).message }); }
  });
};
