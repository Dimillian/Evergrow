# Local soundtrack auditions

`/music.html` is a save-free listening page for original AI-generated gothic game soundtrack studies covering the home, five wilderness moods, towns, dungeons and major encounters. It has one active player, replay, seeking, volume and MP3 downloads. The approved recordings and longer companion cues are now integrated locally; see [dynamic soundtrack](dynamic-soundtrack.md) for runtime selection and mix controls. No Site publication is implied.

## Current direction: second pass

The first soft acoustic/cello set was rejected in listening feedback. The replacement uses entirely new prompts and seeds:

- Home: raw twelve-string guitar duet, descending minor motif, dissonant harmonics and sparse bass answers.
- Wilderness: irregular hand percussion, oud/guitar figures, low reed phrases and a faster exploration pulse.
- Dungeon: electroacoustic horror with unstable drones, prepared piano, scraping metal and isolated ritual thuds.

The turbo timestep shift is now explicitly `3.0`, as recommended by ACE-Step, with a separate language-model negative prompt to discourage vocals, lush orchestration, relaxation music and polished pop arrangements. This is a new generation pass, not a remix of the rejected audio. Rejected MP3s and their prompts are preserved outside the repository at `~/.local/share/evergrow-music/auditions-v1`.

## Forest variations

The second pass was preferred in listening feedback. Its wilderness recording is retained unchanged as **Arid Wilds**. Two additional one-minute cues broaden the outdoor palette:

- **Dark Forest** (Deadwood / Mire): slower baritone guitar, hanging harmonics, long rests and very little percussion.
- **Verdant Forest** (Verdant / Amberwood): warmer nylon guitar, occasional wooden flute answers and a gentle six-eight pulse, with some mystery retained.

These are audition labels and intended environments, not live biome routing. Home, Arid Wilds and Dungeon audio are preserved.

## Installed generator

- ACE-Step 1.5: `~/.local/share/evergrow-music/ACE-Step-1.5`, source revision `ca1e85fe9430179831e6bc6be790c332190a3866`.
- Isolated Python 3.12 environment managed by Homebrew `uv`.
- Homebrew FFmpeg for audition mastering and MP3 encoding.
- The downloaded model bundle is approximately 9.4 GB, outside the game repository. It contains the turbo diffusion model, VAE, text encoder and 1.7B music language model.
- The official project and license are at <https://github.com/ace-step/ACE-Step-1.5>. These are original text-prompt generations, with no uploaded reference recordings.

## Reproduce or iterate

Edit `scripts/music-auditions.json` to adjust instrumentation, atmosphere, tempo, key and seed. From the game repository root:

```sh
~/.local/share/evergrow-music/ACE-Step-1.5/.venv/bin/python scripts/generate-music.py
```

Use `--track menu`, `--track wilderness`, `--track dungeon`, `--track dark-forest` or `--track verdant-forest` to regenerate one audition. Multiple IDs, such as `--track dark-forest verdant-forest`, render together after loading the models once; `--seed-offset 1` produces another variation. `--duration 30` makes a shorter benchmark. `--no-thinking` skips the music language model for a quicker diffusion-only experiment. `--model-root` supports another local installation. `--output-dir` stages a full replacement set outside the game before publishing it to the local listening page.

The script selects Apple Silicon MPS with native MLX diffusion/VAE and the MLX language model backend. It renders sequentially, writes lossless originals under `~/.local/share/evergrow-music/masters`, then exports MP3s and per-track provenance to `game/src/assets/music-auditions`. Regenerating a track replaces its audition MP3/JSON; the raw masters remain separate. Models unload when the process exits; there is no persistent inference server.

Exports target -20 LUFS with a -2 dB true-peak ceiling, short fade-in and three-second fade-out. These are complete cues, not seamless source loops. The runtime now handles deliberate crossfades and rests; the approved originals remain alongside longer companion compositions. Listening feedback decides further refinements.

The review is a separate Vite entrypoint. The runtime imports the music URL catalogue and requests tracks on demand. Model weights, Python packages and lossless masters never enter the game build.
