# Seven-biome atlas and environment studies

2026-09-05 · World generation 4.

These are **direct exports from the actual game renderers**, using a temporary CPU Canvas runtime. They are not browser screenshots: the Codex in-app browser could not be captured while the Mac was locked. No other browser was launched, no gameplay was driven, and no saved exploration was accessed or changed. The temporary export dependency was installed outside this repository; the game still has no runtime package dependencies.

## Explored maps

| Export | Generated world | Charted places |
| --- | --- | --- |
| [World 7319](world-7319.png) | Default world; broad Amberwood, Frostpine, Emberfall and northern Mire | 78 |
| [World 18427](world-18427.png) | Forest/wetland center between winter regions | 75 |
| [World 90210](world-90210.png) | Broad winter regions, mixed interior and southeastern Emberfall | 70 |
| [World 7319 at minimum zoom](world-7319-wide.png) | Same discoveries at 0.025 zoom | 78 |

All three seeds contain all seven biomes within their explored areas. Dark space is uncharted terrain, not an ocean or the edge of the world. POIs, terrain, road centerlines, discovery masking, labels and scale rails come from `WorldMap`; the small export heading/footer is presentation around that canvas. Some markers are hidden at a distance by the runtime decluttering rules. Wide map samples omit raster road colors, then draw thin cached road paths through the same conservative discovery mask.

`atlas-review-data.ts` stages the explored area through the ordinary `Exploration.reveal` API. The local `/atlas.html?seed=7319`, `/atlas.html?seed=18427`, and `/atlas.html?seed=90210` pages expose the same studies with normal map zoom/pan/hover and PNG export. The review uses memory-only discovery.

## Biomes and transitions

[Contact sheet](biomes-and-borders.png) compares the seven climates and two actual borders. Individual exports:

- [Deadwood](biome-deadwood.png)
- [Verdant Forest](biome-verdant.png)
- [The Mire](biome-swamp.png)
- [Frostpine Reach](biome-frostpine.png)
- [Emberfall](biome-emberfall.png)
- [Amberwood](biome-autumn.png)
- [Hollow Highlands](biome-highlands.png)
- [Frostpine / Highlands border](biome-frostpine-highlands.png)
- [Amberwood / Emberfall border](biome-autumn-emberfall.png)

These scenes use `biomeReviewScenes`, the normal `World`, and the actual `Renderer`: generated ground, props, sites, local lights, particles and a stationary character. Props are not rearranged for composition. **They show the Canvas world before the CRT post-processing pass**, as noted on each export. The local `/biomes.html` review applies the normal CRT/soft-phosphor pass in the browser and includes PNG export. Neither path advances simulation ticks or runs a playtest.
