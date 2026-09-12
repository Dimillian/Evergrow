import { emptyChronicle, parseChronicleLedger, recordChronicle, validChronicle, type ChronicleLedger, type ChronicleRecord } from '../src/chronicle.ts';
import { SAVE_BUNDLE_LIMIT } from '../src/save-bundle.ts';

/** Read historical facts independently of today's equipment, world and map rules. */
export function checkpointHistory(raw: string): ChronicleLedger | null {
  if (raw.length > SAVE_BUNDLE_LIMIT) return null;
  try {
    const value = JSON.parse(raw), record = value?.character, checkpoint = record?.checkpoint;
    const count = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
    if (value?.format !== 'evergrow' || value.version !== 1 || !record || !checkpoint
      || typeof record.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(record.id)
      || ['constructor', 'prototype', '__proto__'].includes(record.id)
      || typeof record.name !== 'string' || !record.name.trim() || record.name.length > 24
      || !Number.isSafeInteger(record.createdAt) || record.createdAt < 0
      || !Number.isSafeInteger(record.updatedAt) || record.updatedAt < record.createdAt
      || !Number.isSafeInteger(checkpoint.level) || checkpoint.level < 1
      || !count(checkpoint.kills) || !Number.isSafeInteger(checkpoint.kills) || !count(checkpoint.time)
      || checkpoint.chronicle !== undefined && !validChronicle(checkpoint.chronicle)) return null;
    const history: ChronicleRecord = { id: record.id, name: record.name, createdAt: record.createdAt, updatedAt: record.updatedAt,
      checkpoint: { level: checkpoint.level, kills: checkpoint.kills, time: checkpoint.time, chronicle: checkpoint.chronicle } };
    return parseChronicleLedger(JSON.stringify(recordChronicle(emptyChronicle(), history)));
  } catch { return null; }
}
