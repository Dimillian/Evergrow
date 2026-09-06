import type { Simulation } from './simulation.ts';
import type { ThorSnapshot, ThorItem } from './thor-protocol.ts';
import { itemTooltipMarkup } from './item-ui.ts';
import { TIER_COLORS } from './items.ts';
import { characterPower } from './character-summary.ts';
import { xpForNextLevel } from './progression.ts';
import { miniJourneys } from './journey-state.ts';
import { formatWorldDistance } from './world-distance.ts';
import type { Item } from './character-types.ts';
const entry = (item: Item, slot?: string): ThorItem => ({ id: item.id, name: item.name, color: TIER_COLORS[item.tier], art: item, level: item.itemLevel, slot });
export function thorSnapshot(sim: Pick<Simulation, 'player' | 'journeys'>, session: string, name: string, phase: string, zone: string, zoneLevel: number, selected: string | null): ThorSnapshot {
    const p = sim.player, sheet = p.character, power = characterPower(p);
    const bag = sheet.inventory.map(item => item ? entry(item) : null), equipment = Object.entries(sheet.equipped).flatMap(([slot, item]) => item ? [entry(item, slot)] : []);
    const item = [...sheet.inventory, ...Object.values(sheet.equipped)].find(i => i?.id === selected);
    const equipped = !!item && Object.values(sheet.equipped).includes(item);
    const n = (v: number) => Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—';
    return { session, name, phase, zone, zoneLevel, level: p.level, gold: sheet.gold ?? 0, hp: p.hp, maxHp: p.maxHp, mana: p.mana, maxMana: p.maxMana, xp: p.xp, nextXP: xpForNextLevel(p.level), power: power.power,
        skillPoints: sheet.skillPoints, statPoints: sheet.statPoints, bag, equipment,
        stats: [{ label: 'Power', value: n(power.power) }, { label: 'Basic DPS', value: n(power.dps) },
            { label: 'Armor', value: n(p.derived.armor) }, { label: 'Critical chance', value: `${n(p.derived.critChance * 100)}%` },
            { label: 'Life / second', value: n(p.derived.lifeRegeneration) }, { label: 'Mana / second', value: n(p.derived.manaRegeneration) },
            ...Object.entries(sheet.attributes).map(([label, value]) => ({ label: label[0].toUpperCase() + label.slice(1), value: n(value) }))],
        journeys: miniJourneys(sim.journeys, p).map(g => ({ id: g.id, name: g.name, distance: formatWorldDistance(Math.hypot(g.x - p.x, g.y - p.y)), tracked: g.id === sim.journeys.tracked })),
        detail: item ? { id: item.id, html: itemTooltipMarkup(item, { sheet, level: p.level, equipped, sourceIndex: sheet.inventory.indexOf(item) }), color: TIER_COLORS[item.tier], equipped } : undefined };
}
