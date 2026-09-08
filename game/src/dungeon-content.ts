import type { EnemyKind } from './model.ts';
import type { WaveRules } from './wave-system.ts';
export type DungeonThemeId = 'rootbound' | 'foundry' | 'drowned';
export interface DungeonTheme {
    id: DungeonThemeId; name: string; description: string;
    ambient: string; stone: readonly [number, number, number]; floor: readonly [number, number, number];
    accent: string; light: string; map: string; wall: string;
    roster: readonly EnemyKind[];
}
export const DUNGEON_THEMES: Readonly<Record<DungeonThemeId, DungeonTheme>> = Object.freeze({
    rootbound: Object.freeze({ id: 'rootbound', name: 'Rootbound Crypt', description: 'Split tombs, root-veined masonry and green witchlights.', ambient: '#17271f', stone: [66, 75, 59] as const, floor: [58, 68, 52] as const, accent: '#91d9a5', light: '#a8e4a0', map: '#365447', wall: '#91a88b', roster: ['stalker', 'hound', 'archer', 'brute', 'caster'] as const }),
    foundry: Object.freeze({ id: 'foundry', name: 'Cinder Foundry', description: 'Basalt galleries, cold anvils and furnaces still burning below.', ambient: '#291b1d', stone: [78, 57, 50] as const, floor: [63, 49, 46] as const, accent: '#ffad64', light: '#ff9952', map: '#654238', wall: '#c89b75', roster: ['emberAcolyte', 'brute', 'archer', 'stormSentinel', 'stalker'] as const }),
    drowned: Object.freeze({ id: 'drowned', name: 'Drowned Vault', description: 'Blue limestone, shallow water channels and luminous crystals.', ambient: '#152433', stone: [54, 72, 85] as const, floor: [42, 63, 76] as const, accent: '#7ed9f2', light: '#80d2f3', map: '#324e66', wall: '#86b6c8', roster: ['frostRevenant', 'mireSpitter', 'wisp', 'stalker', 'archer'] as const }),
});
export const dungeonTheme = (seed: number): DungeonTheme => DUNGEON_THEMES[(['rootbound', 'foundry', 'drowned'] as const)[(seed >>> 0) % 3]];
export type DungeonEventKind = 'reliquary' | 'ward' | 'champion';
export interface DungeonEventRecipe { name: string; action: string; objective: string; rules: Readonly<WaveRules>; size: number }
export const DUNGEON_EVENTS: Readonly<Record<DungeonEventKind, DungeonEventRecipe>> = Object.freeze({
    reliquary: Object.freeze({ name: 'Bound Reliquary', action: 'Unseal the reliquary', objective: 'Defeat the awakened waves', size: 5, rules: Object.freeze({ count: 3, duration: 0, interval: 2, hold: 0 }) }),
    ward: Object.freeze({ name: 'Fading Ward', action: 'Rekindle the ward', objective: 'Hold the circle and defeat its guardians', size: 6, rules: Object.freeze({ count: 2, duration: 0, interval: 2, hold: 10 }) }),
    champion: Object.freeze({ name: 'Oathbound Sentinel', action: 'Challenge the sentinel', objective: 'Defeat the elite and its retinue', size: 8, rules: Object.freeze({ count: 1, duration: 0, interval: 0, hold: 0 }) }),
});
