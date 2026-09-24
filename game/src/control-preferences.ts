import { ControlBindings, type ControlStorage } from './control-bindings.ts';
import { CursorPreference } from './cursor-content.ts';
import { JourneyHUDPreferences } from './journey-hud-settings.ts';
import { SkillTourProgress } from './skill-tree-tour-progress.ts';
let storage: ControlStorage | undefined;
try { if (typeof window !== 'undefined') storage = window.localStorage; } catch { /* Private/blocked storage. */ }
/** Device preference shared by input and its presentation, never a character save. */
export const controls = new ControlBindings(storage);
export const cursorPreference = new CursorPreference(storage);
export const journeyHUDPreferences = new JourneyHUDPreferences(storage);
export const skillTourProgress = new SkillTourProgress(storage);
