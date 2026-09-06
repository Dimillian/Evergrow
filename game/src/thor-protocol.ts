import type { Item } from './character-types.ts';
import type { PadSnapshot } from './gamepad-input.ts';
export type ThorTab = 'map' | 'pack' | 'build';
export type ThorPanel = 'map' | 'character' | 'skills' | 'journeys';
export type ThorCommand = {
    type: 'resume' | 'portal' | 'closeInspect';
    session: string;
} | {
    type: 'panel';
    panel: ThorPanel;
    session: string;
} | {
    type: 'inspect' | 'equip' | 'track';
    id: string;
    session: string;
} | {
    type: 'tab';
    tab: ThorTab;
    session: string;
} | {
    type: 'zoom';
    factor: number;
    session: string;
};
export type ThorAction = ThorCommand extends infer C ? C extends ThorCommand ? Omit<C, 'session'> : never : never;
export interface ThorItem {
    id: string;
    name: string;
    color: string;
    art: Item;
    level: number;
    slot?: string;
}
export interface ThorSnapshot {
    session: string;
    phase: string;
    name: string;
    level: number;
    zone: string;
    zoneLevel: number;
    gold: number;
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
    xp: number;
    nextXP: number;
    power: number;
    skillPoints: number;
    statPoints: number;
    map?: string;
    bag: (ThorItem | null)[];
    equipment: ThorItem[];
    stats: {
        label: string;
        value: string;
    }[];
    journeys: {
        id: string;
        name: string;
        distance: string;
        tracked: boolean;
    }[];
    detail?: {
        id: string;
        html: string;
        color: string;
        equipped: boolean;
    };
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
export function parseThorCommand(raw: unknown): ThorCommand | null {
    if (typeof raw !== 'string' || raw.length > 1000)
        return null;
    try {
        const v: unknown = JSON.parse(raw);
        if (!object(v) || typeof v.session !== 'string' || v.session.length > 100)
            return null;
        if (v.type === 'resume' || v.type === 'portal' || v.type === 'closeInspect')
            return v as ThorCommand;
        if (v.type === 'tab' && ['map', 'pack', 'build'].includes(String(v.tab))) return v as ThorCommand;
        if (v.type === 'panel' && ['map', 'character', 'skills', 'journeys'].includes(String(v.panel)))
            return v as ThorCommand;
        if (['inspect', 'equip', 'track'].includes(String(v.type)) && typeof v.id === 'string' && v.id.length > 0 && v.id.length <= 200)
            return v as ThorCommand;
        if (v.type === 'zoom' && typeof v.factor === 'number' && Number.isFinite(v.factor) && v.factor >= .5 && v.factor <= 2)
            return v as ThorCommand;
    }
    catch { /* Reject malformed bridge input before it reaches game commands. */ }
    return null;
}
export function parseNativePad(raw: string): PadSnapshot | null {
    if (raw.length > 4000)
        return null;
    try {
        const v: unknown = JSON.parse(raw);
        if (!object(v) || v.connected !== true || v.mapping !== 'standard' || typeof v.id !== 'string' || v.id.length > 250 || v.index !== 0
            || !Array.isArray(v.axes) || v.axes.length !== 4 || !v.axes.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1)
            || !Array.isArray(v.buttons) || v.buttons.length !== 16 || !v.buttons.every(b => object(b) && typeof b.pressed === 'boolean' && typeof b.value === 'number' && Number.isFinite(b.value) && b.value >= 0 && b.value <= 1))
            return null;
        return v as unknown as PadSnapshot;
    }
    catch {
        return null;
    }
}
