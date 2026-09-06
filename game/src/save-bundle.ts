import { decodeCharacterSave, type CharacterSave } from './character-save.ts';
import { decodeExploration, EXPLORATION_CELL_SIZE, type DecodedExploration } from './exploration-save.ts';
export const SAVE_BUNDLE_LIMIT = 24 * 1024 * 1024;
export interface SaveBundle { format: 'evergrow'; version: 1; character: CharacterSave; chart: string; }
export const chartKey = (r: CharacterSave) => `evergrow:exploration:1:${r.worldVersion}:${r.worldSeed}:${r.id}`;
export function encodeChart(record: CharacterSave, chart: DecodedExploration): string {
  return JSON.stringify({ schema: 1, seed: record.worldSeed, generation: String(record.worldVersion), cell: EXPLORATION_CELL_SIZE,
    chunks: chart.chunks.map(c => [c.x, c.y, [...c.words].map(n => n.toString(36)).join('.')]), pois: chart.pois });
}
export function makeSaveBundle(character: CharacterSave, chart: DecodedExploration = { chunks: [], pois: [] }): SaveBundle {
  return { format: 'evergrow', version: 1, character, chart: encodeChart(character, chart) };
}
export function decodeSaveBundle(raw: string): SaveBundle | null {
  if (raw.length > SAVE_BUNDLE_LIMIT) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.format !== 'evergrow' || value.version !== 1 || typeof value.chart !== 'string') return null;
    const character = decodeCharacterSave(JSON.stringify(value.character));
    if (!character || !decodeExploration(value.chart, { seed: character.worldSeed, generation: String(character.worldVersion) })) return null;
    return { format: 'evergrow', version: 1, character, chart: value.chart };
  } catch { return null; }
}
export function bundleChart(bundle: SaveBundle): DecodedExploration {
  return decodeExploration(bundle.chart, { seed: bundle.character.worldSeed, generation: String(bundle.character.worldVersion) })!;
}
