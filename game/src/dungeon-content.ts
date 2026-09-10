import type { EnemyKind } from './model.ts';
import type { WaveRules } from './wave-system.ts';
export type DungeonThemeId = 'rootbound' | 'foundry' | 'drowned' | 'rime' | 'ossuary' | 'astral';
export interface DungeonTheme {
    id: DungeonThemeId; name: string; description: string;
    ambient: string; stone: readonly [number, number, number]; floor: readonly [number, number, number];
    accent: string; light: string; map: string; wall: string;
    roster: readonly EnemyKind[];
    boss?: EnemyKind; bossName?: string;
}
export const DUNGEON_THEMES: Readonly<Record<DungeonThemeId, DungeonTheme>> = Object.freeze({
    rootbound: Object.freeze({ id: 'rootbound', name: 'Rootbound Crypt', description: 'Split tombs, root-veined masonry and green witchlights.', ambient: '#17271f', stone: [66, 75, 59] as const, floor: [58, 68, 52] as const, accent: '#91d9a5', light: '#a8e4a0', map: '#365447', wall: '#91a88b', roster: ['stalker', 'hound', 'archer', 'brute', 'caster'] as const }),
    foundry: Object.freeze({ id: 'foundry', name: 'Cinder Foundry', bossName:'Furnace Sovereign', description: 'Basalt galleries, cold anvils and furnaces still burning below.', ambient: '#291b1d', stone: [78, 57, 50] as const, floor: [63, 49, 46] as const, accent: '#ffad64', light: '#ff9952', map: '#654238', wall: '#c89b75', roster: ['emberAcolyte', 'brute', 'archer', 'stormSentinel', 'stalker'] as const }),
    drowned: Object.freeze({ id: 'drowned', name: 'Drowned Vault', bossName:'The Drowned Matron', description: 'Blue limestone, shallow water channels and luminous crystals.', ambient: '#152433', stone: [54, 72, 85] as const, floor: [42, 63, 76] as const, accent: '#7ed9f2', light: '#80d2f3', map: '#324e66', wall: '#86b6c8', roster: ['frostRevenant', 'mireSpitter', 'wisp', 'stalker', 'archer'] as const }),
    rime: Object.freeze({id:'rime',name:'Rime Cathedral',description:'Frozen nave, shattered rose windows and hoarfrost reliquaries.',ambient:'#172435',stone:[69,87,105] as const,floor:[57,73,91] as const,accent:'#b5e8ff',light:'#9bd7ff',map:'#425d74',wall:'#b4d4df',roster:['frostRevenant','wisp','archer','brute'] as const,boss:'warden',bossName:'The Rime Prelate'}),
    ossuary: Object.freeze({id:'ossuary',name:'Sunken Ossuary',description:'Ochre burial halls, bone niches and fallen sandstone idols.',ambient:'#30241f',stone:[112,89,60] as const,floor:[88,69,48] as const,accent:'#e6c18a',light:'#f5c87f',map:'#756047',wall:'#ceb78b',roster:['stalker','archer','brute','caster'] as const,boss:'graveMarshal',bossName:'The Sepulchral King'}),
    astral: Object.freeze({id:'astral',name:'Astral Archive',description:'Violet marble, bronze orreries and sealed star charts.',ambient:'#221a34',stone:[76,63,99] as const,floor:[55,48,75] as const,accent:'#ceadff',light:'#bda1ff',map:'#55446b',wall:'#c4addd',roster:['stormSentinel','wisp','caster','archer'] as const,boss:'warden',bossName:'The Astral Custodian'}),
});
export const DUNGEON_THEME_IDS = Object.freeze(Object.keys(DUNGEON_THEMES) as DungeonThemeId[]);
export const dungeonTheme = (seed: number, theme?: DungeonThemeId): DungeonTheme => DUNGEON_THEMES[theme ?? (['rootbound', 'foundry', 'drowned'] as const)[(seed >>> 0) % 3]];
export type DungeonEventKind = 'reliquary' | 'ward' | 'champion';
export interface DungeonEventRecipe { name: string; action: string; objective: string; rules: Readonly<WaveRules>; size: number }
export const DUNGEON_EVENTS: Readonly<Record<DungeonEventKind, DungeonEventRecipe>> = Object.freeze({
    reliquary: Object.freeze({ name: 'Bound Reliquary', action: 'Unseal the reliquary', objective: 'Defeat the awakened waves', size: 5, rules: Object.freeze({ count: 3, duration: 0, interval: 2, hold: 0 }) }),
    ward: Object.freeze({ name: 'Fading Ward', action: 'Rekindle the ward', objective: 'Hold the circle and defeat its guardians', size: 6, rules: Object.freeze({ count: 2, duration: 0, interval: 2, hold: 10 }) }),
    champion: Object.freeze({ name: 'Oathbound Sentinel', action: 'Challenge the sentinel', objective: 'Defeat the elite and its retinue', size: 8, rules: Object.freeze({ count: 1, duration: 0, interval: 0, hold: 0 }) }),
});
