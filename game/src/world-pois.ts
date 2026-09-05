/** One kind registry serves generated places, saved discovery validation and map presentation. */
export const POI_DEFINITIONS = {
  town: { label: 'Settlement', color: '#e0c38b' },
  blacksmith: { label: 'Blacksmith', color: '#ee9861' },
  merchant: { label: 'Merchant', color: '#9dcfa4' },
  inn: { label: 'Inn', color: '#c2bc9a' },
  chapel: { label: 'Chapel', color: '#b6d5ed' },
  shrine: { label: 'Shrine', color: '#85ded1' },
  landmark: { label: 'Landmark', color: '#9bb8a8' },
  camp: { label: 'Enemy camp', color: '#e7936f' },
  watchtower: { label: 'Ruined watchtower', color: '#c1c6a7' },
  graveyard: { label: 'Graveyard', color: '#aba7c9' },
  standingStones: { label: 'Standing stones', color: '#8ddbd0' },
  caravan: { label: 'Abandoned caravan', color: '#d1ae77' },
} as const;

export type POIKind = keyof typeof POI_DEFINITIONS;
export interface WorldPOI {
  id: string; name: string; kind: POIKind; x: number; y: number; description: string;
}

export function isPOIKind(value: unknown): value is POIKind {
  return typeof value === 'string' && Object.hasOwn(POI_DEFINITIONS, value);
}
