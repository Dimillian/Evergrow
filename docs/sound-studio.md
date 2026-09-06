# Sound studio

Implemented 2026-09-06 as a **local audition tool**, available at `/sounds.html`. The current pass replaces the initial oscillator-led palette with recorded material textures and performed creature voices. The candidate sounds are not yet wired into gameplay; the existing `GameAudio` remains the live event adapter until the palette is reviewed.

## Listening and iteration

Click a sound to select and play it. The 26 candidates cover eight weapon/material actions, five magic actions, five creature vocalizations/movements, six rewards and two utilities. Each has six deterministic variations. Variation alternates source takes where available and changes subtle pitch, timing and layer balance without modifying gameplay RNG.

- **Weight** changes low-frequency body and pitch.
- **Brightness** changes the recording low-pass filters.
- **Tail** shortens recording tails below 1 and adjusts room-reflection length. Above 1 it extends the selected environment’s reflections; dry playback preserves the source’s natural duration.
- **Dry / Woodland / Crypt** compare the same sound with short outdoor reflections or longer stone reverberation.
- **Loop** repeats the selected variation after its full tail plus a half-second gap. Stop, Escape and hiding the tab cancel playback and pending playback requests.
- **Volume** controls the studio only; sound starts after a user gesture.
- **Export WAV** downloads the selected recipe, variation, tuning and environment as interleaved stereo 16-bit PCM.
- **Copy settings** copies the exact selection and tuning as JSON for feedback. Per-sound tuning is retained while the page remains open; it does not write character saves or persist through reloads.

Use the name and variation number when discussing feedback. Approve representative sword/flesh, bow, fire, creature and reward sounds before expanding and integrating every action. Creature voices now use performed human growls/grunts, processed by size; the hound is a vocal creature interpretation rather than a real dog recording. Their quality still needs listening feedback.

## Ownership

`sound-library.ts` holds browser-independent sample recipes and deterministic variation/tuning. `sound-samples.ts` lists the finite set of 32 local PCM recordings (1.77 MB). `sound-engine.ts` compiles them through Web Audio's offline renderer, preserving recorded attacks and natural decay with short boundary fades. Physical sounds, rewards and voices contain no oscillators; a low sine pressure layer supports only a few large magical events. Reversed bell/gong recordings provide arcane motion. Generated stereo reflections supply the audition environments. Source downloads/decode requests are shared and lazy, failed loads are retryable, and each fetch has a ten-second timeout. No external audio service or runtime package dependency is used. See [audio sources and licenses](../game/src/assets/audio/CREDITS.md) for authors, source pages, exact filename mappings and preparation steps.

`SoundPlayer` handles gesture unlock, smooth volume, cancellation, sample caching and teardown. Its cache holds 24 stereo samples and playback retains at most eight voices including short fade-outs. Compiled samples are attenuated if their peaks exceed 0.85; intentionally quieter rewards are not normalized upward. The playback bus includes compression. Offline rendering is asynchronous; superseded results cannot unexpectedly start playback.

`sound-studio.ts` owns audition selection and controls; `sound-studio.css` uses the shared UI kit, local display/numeric fonts and native range controls. The waveform reflects the compiled sample; reduced motion freezes its progress animation. This route is development-only and excluded from the production game's entry graph.

## Next integration

After palette approval, replace the generic runtime recipes with the selected catalog and one shared playback owner. Typed presentation cues must carry weapon/action, spell element, target material, creature identity and committed contact timing. Add distance/panning, wall muffling and priority mixing there; the studio's listening environments currently demonstrate reverb, not world-aware occlusion. Enemy warnings and player damage should remain prominent above incidental crowd and reward sounds. Keep all audio downstream of simulation; it must never drive damage, spawning, rewards or progression.

## Validation

Code tests validate every bundled PCM source and duration, and cover all variations at tuning extremes, finite bounded recipes, deterministic regeneration, cancellation during compilation, stale request suppression, repeat caching, voice limits, teardown and PCM export. Architecture checks and strict/core compilation pass. These checks do not establish listening quality or browser audio performance; those are reviewed by the user in the studio.

Level-up revision: the heavy gong/bell pairing was rejected in listening feedback. Its replacement is a short reversed-cloth gather, filtered flame body and two quiet glass accents; no gong or bell layer. It remains an audition candidate.

Rare-item revision: removed the bell and coin-handling overlay after listening feedback. Rare pickup now retains the common equipment/leather identity with a short reversed-cloth gather and quiet glass accent.
