# Adaptive music

**Music attribution: all four tracks were composed by GPT6-Astra using GarageBand
on a Mac.** These are precomposed recordings; the game selects and blends them,
rather than generating new music during play.

Implemented locally on `codex/adaptive-music`, 2026-09-08. The four original
cues now play in the game. Only the four final `.webm` assets live
under `music/evergrow-loops/loops/`. Authoring projects, MIDI, WAV/MP3 copies,
render intermediates, generation scripts and measurement reports stay outside
the repository. The music branch contains the controller, tests, documentation
and final WebMs only.

## Track themes

The four cues give each part of the journey a distinct emotional role:

| Track | Theme |
| --- | --- |
| Lanterns in the Ash | A small refuge in a damaged world: warmth, shelter and a moment to recover before returning to danger. It gives the main menu and towns a shared sense of home. |
| Under the Black Canopy | Curiosity mixed with unease beneath an ancient forest. It supports wandering and discovery while keeping the wilderness faintly threatening. |
| Rootbound Vigil | A solemn watch among buried ruins and encroaching roots. The crypt keeps this atmosphere through both exploration and fighting, without switching to the surface battle cue. |
| Embers at the Gate | The refuge's warmth turning into urgency as danger closes in. It marks an active surface encounter and the need to stand, fight or retreat. |

## In-game selection

| Situation | Cue | Transition |
| --- | --- | --- |
| Character hall or protected town, including interiors/vendors | Lanterns in the Ash | Three-second crossfade |
| Surface wilderness | Under the Black Canopy | Three-second crossfade after 1.25 seconds outside town |
| Rootbound Crypt, including combat | Rootbound Vigil | Three-second crossfade on entry; keep the same track throughout combat |
| Surface wilderness with a living enemy chasing, winding up, attacking or recovering | Embers at the Gate | 1.2-second crossfade; hold for six seconds after engagement ends |
| Pause, map, inventory, skills, Journeys and other panels | Keep the current cue | Lower music to 40%; freeze the combat-release timer |
| Death | Silence | Two-second fade |

Sanctuary arrival takes priority over enemies pursuing outside town. Crypt combat
never switches to the encounter cue. Crypt or
surface location changes discard the previous location's combat hold. A real
engagement bypasses the short town-departure delay. Standing near an idle camp
does not trigger battle music; dead, returning and patrolling actors do not
keep it playing. Music reads the existing `enemyEngaged` predicate, independently
of random battle barks or camera visibility. It never changes AI or simulation.

## Playback and lifecycle

The main menu/character hall uses the town cue, even when the selected character
is saved in the wilderness or crypt. The first click/key interaction unlocks
the shared Web Audio context. Before that gesture, no music downloads or autoplay
are attempted. Audio is also
unlocked through existing touch/controller entry paths. N and Options > Sound
control both music and effects. Browser visibility and native Android background
events suppress both without changing the saved sound preference. Foregrounding
preserves that preference; normal browser autoplay restrictions still apply.

`music-director.ts` owns the headless situation policy. `music-composer.ts` owns
lazy fetching/decoding, native looping buffer sources, crossfades, a small cache,
remembered cue positions and teardown. Game passes current phase, sanctuary/crypt
location and actor engagement once per frame. The director has no save state.
`GameAudio` owns the context and common mute/background lifecycle; music connects
to a clean output bus, bypassing combat's compressor and wave distortion.
Default music gain is 0.49, 70% of the previous 0.70 level. Panel ducking remains
40% of that music level; sound-effect volume is unchanged.

`music-loop.ts` prepares each decoded WebM once: trim the 250 ms circular guards
and blend the last 120 ms toward the matching audio immediately before the loop
start. This reconciles Opus reconstruction differences without inserting silence.
Exact musical frame counts are converted to the AudioContext's sample rate.
The resulting buffer repeats through `AudioBufferSourceNode.loop`, with no timer
restarts or codec startup/tail inside the musical loop. Crossfades interpolate
from the current gain when interrupted, and a returning active cue reuses its voice. Once a silent
voice is released, its next playback resumes from its remembered loop position.
The outgoing cue remains audible while the incoming file loads. Late results
cannot switch to an outdated selection. Failed requests retry at most once per
thirty audio-clock seconds and never block gameplay or effects.

Resource bounds: four possible voices, two retained decoded-cache entries, one
in-flight load/decode, and one cleanup timer. Cleanup reschedules while a fade
remains pending, including when backgrounding starts a later fade or the audio
clock is suspended; it does not require animation frames. In ordinary steady
playback only one source runs. All gains/sources, pending fetches and caches are released on
teardown. Temporary memory can include all four cues during rapid transitions
(about 74 MB of stereo float PCM at 44.1 kHz, plus temporary decode data; the
browser's output sample rate may increase that, with guarded/cropped buffers
overlapping briefly during preparation). Runtime WebM compression reduces
download and bundle size without reducing decoded audio memory. Only requested
cues are downloaded/decoded; the WAV masters and MP3 listening previews are not
shipped in the game bundle.

Vite's development allowlist includes only the shared loop directory alongside
its normal workspace root, so local music URLs can be served. Vite emits the
compressed WebMs as local build assets, including the offline
Android bundle. There is no CDN or music service. No native installation, Sites
publication, save reset or migration is part of this change.

## Verification

Code tests cover main-menu town playback with a receiver-sensitive browser fetch,
location/engagement priority, town-boundary grace, combat hold,
menu ducking, interrupted fades, guard trimming and musical frame counts at
44.1/48 kHz, remembered positions,
stale loads, mute during decode, retry throttling, background preference
preservation, overlapping background cleanup deadlines and disposal during
asynchronous work. Build checks cover local asset emission. Gameplay listening,
transition feel and final balance against
effects remain user-tested.

## 128 kbps WebM checkpoint · 2026-09-08

The four runtime loops now total **3,766,060 bytes**, down from 5,509,923 bytes:
**1,743,863 bytes saved (31.65% smaller)**. They use stereo 48 kHz Opus with a
128 kbps VBR target, 20 ms packets, encoder effort 10 and the audio application.
Actual average bitrate varies with each cue.

At the user's request, these were transcoded from the existing 192 kbps WebMs;
lossless masters were not used. This adds a lossy encoding generation, so final
quality remains a listening check. The 250 ms circular guards, musical lengths,
runtime seam preparation, music gain and cue-selection rules are unchanged.
Decoded memory use is unchanged; this reduces downloaded and bundled bytes.

Offline decoding verified unchanged frame counts and finite, non-silent PCM for
all four outputs at both 44.1 and 48 kHz. The actual runtime preparation function
produced the expected musical frame counts and continuous adjacent seam samples.
Tests pin the new file sizes and SHA-256 hashes. Encoding scripts and measurement
outputs remain outside the repository; only the final four WebMs are shipped.
All 913 code tests, application/headless type checks and the production build
passed. The build emits all four smaller WebMs, and their development URLs
return the verified bytes. No gameplay automation or native install was run.

## Historical 192 kbps WebM checkpoint · 2026-09-08

This checkpoint shipped **5,509,923 bytes** of audio-only WebM instead of 55,000,074
bytes of WAV: **89.98% smaller**. Authoring files are retained separately on
the authoring machine, outside the repository and branch history.

Those assets used stereo Opus at 48 kHz, 192 kbps VBR,
20 ms packets and maximum encoder effort (10), with the music/audio application
setting. These are high-quality lossy copies, not bit-identical masters; an
inaudible difference cannot be guaranteed without listening comparison. The
bitrate preserves room for plucked transients and sustained reverb instead of
chasing the smallest possible file at any quality. See
[FFmpeg's libopus options](https://ffmpeg.org/ffmpeg-codecs.html#libopus).

Each file contains 250 ms of circular audio before and after the musical loop.
Playing the entire WebM on repeat in a generic media player includes these guards;
the game uses its explicit musical length and prepares the seamless buffer.
Before delivery, offline decoding checked complete frame counts, finite PCM and
seam steps. Code tests pin the final WebM sizes and SHA-256 hashes, verify musical
frame counts, and exercise loop preparation at both output rates and playback
lifecycle. They require neither authoring files nor an installed audio encoder.
Music failure remains isolated from
sound effects. Physical Thor/WebView playback and subjective audio quality
remain user listening checks.

WebM checkpoint validation: all **911 tests** passed, including ten music tests;
application/headless type checks, production build and Android web-bundle build
passed. Both builds contain exactly the four verified WebMs and no WAV/MP3
assets. All four development URLs return the encoded bytes. Offline FFmpeg
decoding plus the actual runtime preparation function verified musical lengths
and continuous seam steps for every cue at both 44.1 and 48 kHz. No gameplay
automation or native installation was performed.

Web Audio reference: [native buffer looping](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/loop)
and [loop end boundaries](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/loopEnd).
