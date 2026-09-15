import { sampleBiome, type BiomeId } from './biomes.ts';
import type { Expeditions } from './dungeon-state.ts';
import type { PortalAnchor, TravelState } from './travel.ts';
import { getZoneAt } from './zone-progression.ts';

export type PortalDestinationKind = 'settlement' | 'surface' | 'hazardous' | 'dungeon';
export interface PortalDestination {
  kind: PortalDestinationKind;
  name: string;
  detail: string;
  biome: BiomeId;
}
export type PortalActionMode = 'cast' | 'cancel' | 'locate' | 'return' | 'unavailable';
export interface PortalActionView { mode: PortalActionMode; progress: number | null; destination: PortalDestination; }
export function portalActionMode(channeling: boolean, inSanctuary: boolean, hasReturn: boolean, returnInReach: boolean): PortalActionMode {
  if (channeling) return 'cancel';
  if (inSanctuary) return hasReturn ? returnInReach ? 'return' : 'locate' : 'unavailable';
  return 'cast';
}

export function portalDestinationLabel(destination: PortalDestination): string {
  return `${destination.name} · ${destination.detail}`;
}

export function fitPortalWorldLabel(label: string, maxWidth: number, measure: (value: string) => number): string {
  if (measure(label) <= maxWidth) return label;
  const shortcutStart = label.lastIndexOf('  [');
  const shortcut = shortcutStart >= 0 && label.endsWith(']') ? label.slice(shortcutStart) : '';
  let body = shortcut ? label.slice(0, -shortcut.length) : label;
  while (body.length > 1 && measure(`${body}…${shortcut}`) > maxWidth) body = body.slice(0, -1).trimEnd();
  return `${body}…${shortcut}`;
}

export interface PortalDestinationContext {
  seed: number;
  home: PortalAnchor;
  travel: TravelState;
  expeditions: Expeditions;
}

const destination = (kind: PortalDestinationKind, name: string, detail: string, biome: BiomeId): PortalDestination =>
  Object.freeze({ kind, name, detail, biome });

/** Presentation-only facts derived from explicit overworld state. Dungeon-local coordinates are never sampled as surface geography. */
export function portalDestinations(context: PortalDestinationContext): { home: PortalDestination; returnTo: PortalDestination | null } {
  const { seed, home, travel, expeditions } = context;
  const homeBiome = sampleBiome(home.x, home.y, seed).id;
  const outward = destination('settlement', home.name, 'Home town', homeBiome);
  const link = travel.returnTo;
  if (!link) return { home: outward, returnTo: null };
  if (link.dungeon) {
    const run = expeditions.runs.find(candidate => candidate.entrance.id === link.dungeon);
    if (!run) return { home: outward, returnTo: destination('dungeon', 'Preserved expedition', 'Dungeon', homeBiome) };
    return { home: outward, returnTo: destination('dungeon', run.entrance.name, `Dungeon · Level ${run.entrance.level}`, run.entrance.biome) };
  }
  const zone = getZoneAt(link.x, link.y, seed), biome = sampleBiome(link.x, link.y, seed).id;
  return { home: outward, returnTo: destination(zone.hazardous ? 'hazardous' : 'surface', zone.name,
    `Region level ${zone.level}–${zone.maxLevel}`, biome) };
}
