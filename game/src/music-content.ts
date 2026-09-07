import type { MusicCue } from './music-director.ts';
import type { MusicTrack } from './music-composer.ts';

/** Guarded WebM/Opus loops; frame counts exclude the two 250 ms guards. */
export const MUSIC_TRACKS: Readonly<Record<MusicCue, MusicTrack>> = Object.freeze({
  town: Object.freeze({ url: new URL('../../music/evergrow-loops/loops/01-lanterns-in-the-ash.webm', import.meta.url).href, frames48k: 2560000 }),
  field: Object.freeze({ url: new URL('../../music/evergrow-loops/loops/02-under-the-black-canopy.webm', import.meta.url).href, frames48k: 2425264 }),
  crypt: Object.freeze({ url: new URL('../../music/evergrow-loops/loops/03-rootbound-vigil.webm', import.meta.url).href, frames48k: 3072000 }),
  encounter: Object.freeze({ url: new URL('../../music/evergrow-loops/loops/04-embers-at-the-gate.webm', import.meta.url).href, frames48k: 1920000 }),
});
