/** Presentation recipes for the character-editor study. Not part of saved sheets yet. */
export interface AppearancePalette { readonly id: string; readonly name: string; readonly base: string; readonly shadow: string; readonly light: string; }
export const SKIN_PALETTES: readonly AppearancePalette[] = [
  { id: 'porcelain', name: 'Porcelain', base: '#ecd0b5', shadow: '#b08c7c', light: '#ffe6c9' },
  { id: 'sand', name: 'Sand', base: '#d7b08a', shadow: '#94705a', light: '#f1d1a5' },
  { id: 'warm', name: 'Warm', base: '#b89a7d', shadow: '#755f51', light: '#e0c39c' },
  { id: 'olive', name: 'Olive', base: '#b19868', shadow: '#74664b', light: '#d8bd8b' },
  { id: 'copper', name: 'Copper', base: '#ac7552', shadow: '#724a3d', light: '#d59d72' },
  { id: 'umber', name: 'Umber', base: '#87593f', shadow: '#503b32', light: '#b27d58' },
  { id: 'mahogany', name: 'Mahogany', base: '#684638', shadow: '#392c29', light: '#986950' },
  { id: 'ebony', name: 'Ebony', base: '#49372f', shadow: '#292426', light: '#79594a' },
];
export const HAIR_PALETTES: readonly AppearancePalette[] = [
  { id: 'chestnut', name: 'Chestnut', base: '#4c3b32', shadow: '#282527', light: '#8f7457' },
  { id: 'raven', name: 'Raven', base: '#252c32', shadow: '#151c23', light: '#54616b' },
  { id: 'walnut', name: 'Walnut', base: '#6d4830', shadow: '#342a26', light: '#a77950' },
  { id: 'copper', name: 'Copper', base: '#ad5e37', shadow: '#66382c', light: '#e1a363' },
  { id: 'golden', name: 'Golden', base: '#bea269', shadow: '#796344', light: '#edcf89' },
  { id: 'silver', name: 'Silver', base: '#a6b4b3', shadow: '#637677', light: '#e2e1cb' },
  { id: 'wine', name: 'Wine', base: '#743e51', shadow: '#3d2939', light: '#b47688' },
  { id: 'sage', name: 'Sage', base: '#697e68', shadow: '#344c45', light: '#a5b68a' },
];
export const HAIR_STYLES = [
  { id: 'swept', name: 'Windswept' }, { id: 'crop', name: 'Cropped' },
  { id: 'bob', name: 'Bob' }, { id: 'long', name: 'Long' },
  { id: 'braid', name: 'Braid' }, { id: 'bun', name: 'High bun' },
  { id: 'curls', name: 'Curls' }, { id: 'bald', name: 'Shaved' },
] as const;
export const FACIAL_HAIR = [
  { id: 'none', name: 'None' }, { id: 'stubble', name: 'Stubble' },
  { id: 'moustache', name: 'Moustache' }, { id: 'beard', name: 'Short beard' },
] as const;
export const ACCESSORIES = [
  { id: 'none', name: 'None' }, { id: 'hoop', name: 'Gold hoop' },
  { id: 'circlet', name: 'Moon circlet' }, { id: 'eyepatch', name: 'Eyepatch' },
] as const;
export interface CharacterAppearance {
  skin: string; hairColor: string;
  hair: typeof HAIR_STYLES[number]['id'];
  facialHair: typeof FACIAL_HAIR[number]['id'];
  accessory: typeof ACCESSORIES[number]['id'];
}
export const DEFAULT_APPEARANCE: Readonly<CharacterAppearance> = Object.freeze({
  skin: 'warm', hairColor: 'chestnut', hair: 'swept', facialHair: 'none', accessory: 'none',
});
export function appearancePalette(catalog: readonly AppearancePalette[], id: string): AppearancePalette {
  return catalog.find(palette => palette.id === id) ?? catalog[0];
}
