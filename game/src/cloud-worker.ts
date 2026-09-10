import { equippedGearPower } from './leaderboard.ts';
import { characterPower, previewCharacter } from './character-summary.ts';
import { bundleChart, chartKey, encodeChart, decodeSaveBundle } from './save-bundle.ts';
import { CloudSaveError } from './cloud-errors.ts';
import type { CloudRow } from './cloud-cache.ts';
import { openCloudCache, prepareCloudSave, type CacheCommand } from './cloud-cache.ts';
import type { CharacterSave } from './character-save.ts';
import type { DecodedExploration } from './exploration-save.ts';
const scope = globalThis as unknown as { onmessage: (event: MessageEvent) => void; postMessage(value: unknown): void };
let cache: ReturnType<typeof openCloudCache>;
let queue = Promise.resolve();
scope.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try {
      let result: unknown;
      if (data.method === 'init') { cache = openCloudCache(indexedDB, data.account); await cache.ready; result = true; }
      else if (data.method === 'write-bundle') {
        const old=await cache.execute({kind:'read',index:data.index}) as CloudRow|null;
        const row = await cache.execute({ kind: 'write', index: data.index, expected: data.expected, operation: data.operation,
          bundle: prepareCloudSave(old,data.record as CharacterSave,data.chart as DecodedExploration) }) as CloudRow | null;
        result = row ? { token: row.token, conflict: row.conflict } : null;
      }
      else if (data.method === 'list-info') {
        const rows = await cache.execute({ kind: 'list' }) as CloudRow[];
        result = rows.map(({ index, token, base, dirty, conflict, bundle }) => {
          const info = { index, token, base, dirty, conflict };
          if (!bundle) return info;
          try {
            const decoded = decodeSaveBundle(JSON.stringify(bundle));
            if (!decoded) throw new CloudSaveError();
            const record = decoded.character;
            return { ...info, summary: { name: record.name, level: record.checkpoint.level, updatedAt: record.updatedAt,
              power: characterPower(previewCharacter(record)).power, gearPower: equippedGearPower(record.checkpoint.character) } };
          } catch { return { ...info, invalid: true }; }
        });
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
      else result = await cache.execute(data.command as CacheCommand);
      scope.postMessage({ id: data.id, result });
    } catch (error) { scope.postMessage({ id: data.id, error: (error as Error).message, errorKind: error instanceof CloudSaveError ? 'save' : 'storage' }); }
  });
};
