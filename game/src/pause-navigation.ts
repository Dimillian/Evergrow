import type { ControlAction } from './control-bindings.ts';
import type { UIIconName } from './ui-icons.ts';

export type PauseCategory = 'character' | 'adventure' | 'system';
export type PauseDestination = 'character' | 'skills' | 'appearance' | 'map' | 'journeys'
  | 'chronicle' | 'lootLog' | 'options' | 'controls' | 'leaderboard' | 'changelog';
export interface PauseEntry { id: PauseDestination; label: string; description: string; icon: UIIconName; binding?: ControlAction; }
export const PAUSE_CATEGORIES: readonly { id: PauseCategory; label: string; icon: UIIconName; entries: readonly PauseEntry[] }[] = [
  { id: 'character', label: 'Character', icon: 'sword', entries: [
    { id: 'character', label: 'Equipment & pack', description: 'Equipment, inventory, attributes and assigned skills', icon: 'inventory', binding: 'character' },
    { id: 'skills', label: 'Skill atlas', description: 'Passives, skills and Techniques', icon: 'skilltree', binding: 'skills' },
    { id: 'appearance', label: 'Appearance', description: 'Your character’s look', icon: 'character' },
    { id: 'chronicle', label: 'Chronicle', description: 'Achievements, statistics and Unique collection', icon: 'journal' },
  ] },
  { id: 'adventure', label: 'Adventure', icon: 'map', entries: [
    { id: 'map', label: 'World map', description: 'Your explored world and discovered places', icon: 'map', binding: 'map' },
    { id: 'journeys', label: 'Journeys', description: 'Goals and discoveries along your path', icon: 'journal', binding: 'journeys' },
    { id: 'lootLog', label: 'Loot log', description: 'Recent pickups, original item details and current locations', icon: 'lootBag' },
  ] },
  { id: 'system', label: 'System', icon: 'options', entries: [
    { id: 'options', label: 'Options', description: 'Sound, loot labels, camera zoom and fullscreen', icon: 'options' },
    { id: 'controls', label: 'Controls', description: 'Input help and keyboard bindings', icon: 'center' },
    { id: 'leaderboard', label: 'Leaderboard', description: 'Cloud character rankings', icon: 'shield' },
    { id: 'changelog', label: 'What’s new', description: 'The latest release notes', icon: 'journal' },
  ] },
];
/** Lives only as long as this game shell; never enters character saves. */
export interface PauseNavigation { category: PauseCategory; focus: PauseDestination | null; }
