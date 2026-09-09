/** One kind registry serves generated places, saved discovery validation and map presentation. */
export const POI_DEFINITIONS = {
  bossLair: {label:'Wilderness boss',color:'#e8788f'},
  cursedChest:{label:'Cursed chest',color:'#d696c3'}, ruinedChapel:{label:'Ruined chapel',color:'#b8add6'}, beastDen:{label:'Beast den',color:'#c7a57c'}, quarry:{label:'Quarry',color:'#9ebed2'}, hamlet:{label:'Occupied hamlet',color:'#c89776'}, crossing:{label:'Contested crossing',color:'#b8aa84'}, corruptedGrove:{label:'Corrupted grove',color:'#98be9a'},
  dungeon: { label: 'Dungeon', color: '#a8c6ad' },
  reliquary: { label: 'Reliquary', color: '#d1bc8c' },
  portal: { label: 'Portal', color: '#bfade8' },
  town: { label: 'Settlement', color: '#e0c38b' },
  gambler: {label:'Gambler',color:'#d9b878'},
  stash: {label:'Storage',color:'#b2b9ad'},
  blacksmith: { label: 'Blacksmith', color: '#ee9861' },
  jeweler: { label: 'Jeweler', color: '#8fdbc8' },
  enchanter: { label: 'Enchanter', color: '#baa2eb' },
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
  sighted?: boolean;
  id: string; name: string; kind: POIKind; x: number; y: number; description: string;
}

export function isPOIKind(value: unknown): value is POIKind {
  return typeof value === 'string' && Object.hasOwn(POI_DEFINITIONS, value);
}
