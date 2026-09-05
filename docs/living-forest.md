# Living forest — 2026-09-05

This records the original Verdant pass and its browser recording. Runtime ownership now lives in the shared [living biomes](living-biomes.md) system; the forest motion study remains available.

The Verdant Forest now shares a traveling wind field across crown layers, groundcover, falling leaves and patches of canopy light. Heavy foliage lags the front, and obstructing crowns fade smoothly as the player passes behind them. Added grass tufts bend away from recent player footsteps and settle, while footsteps lift a small amount of leaf litter and leave short-lived impressions.

Seeded rocks, stumps and dead branches host up to six crows. They look around while perched, flee from an approaching moving player, circle while their perch is occupied, and return once it is clear. Up to ten butterflies wander and settle around fern/flower anchors, briefly scattering on approach. Wildlife is decorative: it cannot be attacked, block movement, award rewards or consume enemy population slots.

`biome-wind.ts` owns the common world-space gust function. `biome-life.ts` owns bounded, ephemeral presentation state, and `biome-life-art.ts` draws it. The renderer consumes interpolated player positions; these systems never write to the simulation, props, world generation, exploration or gameplay RNG. Terrain/collision and save namespaces are unchanged.

## Budgets and accessibility

- At most 40 grass disturbances, 48 foot impressions and 100 loose leaves; all expire.
- At most six crows and ten butterflies, tied to nearby seeded prop identities.
- At most 100 contextual grass/light anchors and five restrained shafts of light per frame.
- Up to seven 64×32 cached biome dapple stamps and at most 512 transient crown-opacity values. Trees retain their existing sprite caches.
- Teleports do not draw a trail across the jump. Renderer reset clears all transient forest state.
- Reduced motion freezes the wind and reactions; initially visible wildlife uses a resting pose. Ambient motion follows the existing renderer clock; no new display setting was added.

## Motion review and recording

The local development page `/forest.html` uses the actual World, Renderer and fixed PostFX CRT. `forest-review-scene.ts` selects a collision-checked path in generated seed-7319 forest. The player follows staged poses: stand, walk past a perch, pause, return, settle. No simulation ticks, spawns, exploration or save access occur.

The page can record its 960×640 output through the browser's MediaRecorder and export a 14-second video. The local development server also accepts an explicit “Export to project” action for this one named recording, with a 24 MiB upload limit. The recording is silent; sound design was not part of this visual pass. The accompanying GIF is converted from that browser recording, not a synthetic animation or a CPU approximation of the CRT.

Code tests cover wind continuity, disturbance recovery, teleport discontinuities, crow flight/return, deterministic replay, fixed effect caps, indoor exclusion and biome material selection and reduced-motion freezing. Full code checks, strict application/core compilation and production build pass. The staged scene verifies the visual presentation, not gameplay performance under combat load.
