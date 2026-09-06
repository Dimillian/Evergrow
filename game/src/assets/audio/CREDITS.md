# Evergrow audition recordings

All source packs below are offered under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Retrieved 2026-09-06. Audio is bundled locally; the studio makes no third-party requests. These assets are for the sample-led audition palette, not yet the runtime game mix.

| Source | Author | Included recordings |
| --- | --- | --- |
| [RPG Audio](https://kenney.nl/assets/rpg-audio) | Kenney Vleugels | Blade passes, steel draw, leather, cloth, wood flex, coin handling, latch |
| [Impact Sounds](https://kenney.nl/assets/impact-sounds) | Kenney | Punch, wood, plate and metal impacts |
| [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx) | [rubberduck](https://opengameart.org/users/rubberduck) | Glass, bell, gong, water and blast; the author describes recording this pack on an Android device |
| [16 Monster Growls](https://opengameart.org/content/16-monster-growls) | [StarNinjas](https://opengameart.org/users/starninjas) | Eight performed mouth growls/grunts; these are human performances, not animal field recordings |
| [Catching fire](https://opengameart.org/content/catching-fire) | themightyglider, derived from qubodup | Flame; original source linked by its author: [qubodup 159725](https://freesound.org/people/qubodup/sounds/159725/) |

`sources.json` maps each bundled WAV to its exact filename within the original pack. Kenney's original license notices are preserved alongside this file.

Preparation: decode Ogg, fold to mono, remove DC offset, trim leading/trailing near-silence with 12 ms/80 ms margins, cap peak gain at 0.8 with at most 4× amplification, apply 6 ms boundary fades and export 16-bit PCM WAV at original sample rate. WAV avoids dependence on Ogg support in Safari. Runtime recipes apply modest playback-rate changes, low-pass filtering, layering, optional reversal and room reflections. No generative audio service or imitation of a specific game's audio assets is used.
