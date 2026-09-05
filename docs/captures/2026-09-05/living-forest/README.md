# The living forest — motion capture

[Animated GIF](living-forest.gif) · [MP4](living-forest.mp4) · [Original browser recording](living-forest.webm)

Captured in the Codex in-app browser from the local `/forest.html` review. This is the actual procedural World, Renderer and fixed CRT PostFX, with staged movement along a collision-checked path. No simulation ticks, enemy spawning or save access occurred.

The 14-second scene shows a quiet start, a walk past a crow perch, a pause, a return walk and a quiet finish. Watch the moving crowns, grass and litter near the feet, scattering crows, butterflies and shifting light. The GIF is 720×480 at 15 fps, using a 128-color palette; the 960×640 MP4 preserves more detail and smoother motion. There is no audio.

The local review can record again and export the clip into this folder. Conversion uses a standalone FFmpeg executable; no video tool is added to the game's dependencies:

```sh
ffmpeg -i living-forest.webm -filter_complex '[0:v]fps=15,scale=720:480:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle' -loop 0 living-forest.gif
ffmpeg -i living-forest.webm -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -movflags +faststart -an living-forest.mp4
```

See [implementation and verification](../../../living-forest.md).
