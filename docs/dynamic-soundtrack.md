# Dynamic soundtrack

The runtime plays original locally generated music alongside the existing procedural SFX. This is a local integration; publishing and installing an APK are separate actions. No generator, model weights or remote audio service runs inside the game.

## Music library

Five approved one-minute recordings remain unchanged. Twelve new two-minute pieces add longer companion arrangements for those five, two cold-region pieces, two Emberfall pieces, a town cue, an event cue and a boss cue: 17 tracks, approximately 29 minutes total.

| Situation | Pool |
| --- | --- |
| Character hall | Home I / II |
| Deadwood, Mire | Dark Forest I / II |
| Verdant, Amberwood | Verdant Forest I / II |
| Sunscar, Whispering Steppe | Arid Wilds I / II |
| Frostpine, Hollow Highlands | Cold Wilds / Northern Stones |
| Emberfall | Emberfall / Ashen Road |
| Settlements | Hearth / Home II |
| Dungeons | Dungeon I / II |
| Active nearby wave trial | The Gathering |
| Engaged nearby wilderness boss or dungeon warden | Ancient Hunger |

These are complete arranged cues, not tempo-synchronized stems. Dynamics come from scene selection, crossfades, volume ducking, restraint and silence. Do not randomly layer independently generated compositions as if they shared harmony or downbeats. `music.html` lists all recordings for listening feedback.

## Runtime rules

- `music-policy.ts`: pure presentation policy. Stable regional change takes 15 seconds; entry from home, town entry and dungeon entry take 3 seconds. A major event takes 1 second; engaged bosses have priority immediately. Brief phase gaps do not end boss music; encounter release holds for at least 12 seconds. Ordinary ambient fights never request an encounter cue.
- Pause, inventory, skill atlas, maps, services and Chronicle retain the current mood at 60% of its chosen music volume. Death returns to the location mood at 25%. Home has its own mood.
- `music-playlist.ts`: explicit biome/situation pools. Do not repeat the previous recording in a pool with alternatives. Exploration cues have randomized 15–30-second quiet gaps; home/town/dungeon cues use shorter 3–7-second rests. Major event/boss cues crossfade into their next cycle before the recording ends, keeping sustained encounters covered.
- `music-player.ts`: at most two streamed media elements, connected to gain nodes. Transitions use 8-second fades (3 seconds into danger). A third requested mood waits for the outgoing deck to finish fading. Stream errors preserve the old music where possible, skip unavailable tracks and back off retries. Autoplay refusal waits for another user interaction.
- Music does not advance the simulation or use gameplay RNG. `Game` samples context four times per second. Only source URLs are bundled in JS; media is requested on demand. No large decoded music buffers or audio visualization analysis.

## Mix and controls

Default SFX is 75%; music is 35%. They are independent gain channels feeding the existing master mute. SFX retain their compressor/peak guard; mastered music bypasses that effects compressor with an additional 0.85 headroom gain. Tracks target -20 LUFS, -2 dB true peak, 44.1 kHz / 192 kbps MP3.

Home has a small **Sound** drawer; Escape → **Options** exposes the same sliders in game. Changes are immediate and stored as device preferences (`evergrow-preferences`), separate from character/cloud saves. Zero remains zero on reload. N and the pause Sound toggle mute both channels without losing their levels. Slider release previews SFX using the quiet panel-opening sound.

Controller: Y opens/closes Sound at home; left/right adjust a focused slider in 5% steps, up/down move focus, B closes the drawer. The existing pause controller navigation exposes the sliders too. Mouse and keyboard use native range controls.

Panel transitions use a short filtered leather/paper movement and a soft low wooden closure; no bells or hover-click spam. They share the SFX level and master mute, and are throttled across rapid nested changes. Validated Thor companion tab/inspection changes return their panel sounds to the primary audio owner. Existing combat, pickup and level-up sound designs are preserved.

## Lifecycle

Audio starts after an accepted pointer/key/controller interaction. Both persistent stream elements are primed with a tiny local silent sample during that gesture because [WebKit grants autoplay permission per element](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/). A hidden page or Android background callback pauses streams and suspends the shared context; returning resumes rather than restarting the song. The primary game owns all audio; the Thor companion imports neither the game audio engine nor music assets. Game teardown immediately silences playback and subsequently releases both decks, connections and the context. Music volume zero pauses stream playback.

## Reproduction and validation

`scripts/music-score.json` records the production prompts. Generate with the installed ACE-Step Python:

```sh
~/.local/share/evergrow-music/ACE-Step-1.5/.venv/bin/python scripts/generate-music.py --catalog scripts/music-score.json --output-dir game/src/assets/music --skip-existing
```

Each MP3 has matching provenance JSON. Lossless masters and models remain outside the repository. These extended pieces are new companion compositions in the approved directions, not edits or seamless continuations of the original recordings.

Headless checks cover region hysteresis, panel ducking, boss priority/release, non-repetition, range validation, controller sliders, the two-stream limit, late playback promises, background/mute behavior, autoplay refusal and network retry bounds. Typechecking and the production build validate integration. Listening, subjective balance, Safari/device acceptance and real gameplay remain user-tested.
