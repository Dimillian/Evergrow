import { ControlBindings, type ControlStorage } from './control-bindings.ts';
let storage: ControlStorage | undefined;
try { if (typeof window !== 'undefined') storage = window.localStorage; } catch { /* Private/blocked storage. */ }
/** Device preference shared by input and its presentation, never a character save. */
export const controls = new ControlBindings(storage);
