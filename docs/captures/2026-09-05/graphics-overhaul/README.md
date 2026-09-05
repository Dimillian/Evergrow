# Procedural graphics overhaul captures

Frozen exports from the actual World and Renderer, seed 7319. These are Canvas renders **before the CRT pass**, not concept art. The Mac was locked during capture, so final browser/CRT appearance and animation still need local visual review. No simulation ticks, gameplay input or save access were used.

[Forest before/after](forest-before-after.png) compares the previous Git checkpoint `cf708a2` with this pass. Both versions were rendered through the same exporter; camera and player positions match. Exact staging is recorded in [scenes.json](scenes.json).

## Gallery

- [Verdant Forest](verdant.png)
- [The Mire](swamp.png)
- [Frostpine Reach](frostpine.png)
- [Amberwood](autumn.png)
- [Deadwood](deadwood.png)
- [Emberfall](emberfall.png)
- [Hollow Highlands](highlands.png)
- [Frostpine–Highlands transition](frostpine-highlands.png)
- [Amberwood–Emberfall transition](autumn-emberfall.png)
- [Town street and blacksmith](town-street.png)
- [Standing stones](standing-stones.png)

## Reproduce

From the repository root, supply an already-installed native Canvas package; it is not a runtime dependency:

```sh
node --experimental-strip-types game/scripts/render-art-review.mjs /path/to/@napi-rs/canvas /output/directory
```

An optional third argument selects another extracted `game/src` directory for baseline comparisons. See [the implementation report](../../../graphics-overhaul.md) for changes and verification.
