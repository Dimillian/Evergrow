# Biome generation

Evergrowing now has seven recurring biomes. All terrain, props and atmosphere remain generated in code; no biome artwork is loaded from image files.

| Biome | Visual identity | Main props and details |
| --- | --- | --- |
| Deadwood | Blue-grey burial woods | Bare trees, conifers, stumps, pale fungi, tussocks and shrines |
| Verdant Forest | Layered green woodland | Broad canopies, ferns, flowers, mushrooms and old roots |
| The Mire | Cool teal wetlands | Draping willows, reeds, lily pads, shallow pools and fireflies |
| Frostpine Reach | Pale blue winter forest | Snow-covered pines, faceted ice crystals, frost traces and drifting snow |
| Emberfall | Charcoal and muted copper | Burnt trunks, columnar basalt, ember-veined rocks, ash and rising sparks |
| Amberwood | Copper and gold woodland | Scalloped autumn crowns, leaf piles, mushrooms and drifting leaves |
| Hollow Highlands | Heather and weathered stone | Wind-bent trees, limestone outcrops, heather, grasses and windborne seeds |

## Regions and transitions

`biomes.ts` evaluates seeded temperature, moisture and elevation fields over jittered region centers, spaced approximately 2,400 world units apart. A coordinate warp bends the region outlines. Adjacent cells can share a climate, producing larger regions; every climate can recur in either direction. This replaces the original three broad geographic strips.

Smooth compact kernels blend nearby region influences. All seven weights always sum to one. Ground color, map color and ambient light interpolate these weights. Props and small ground details sample their species from the weights at each object's world coordinate, so two kinds of vegetation coexist at a border. Snow, embers, pollen and leaves use local world anchors rather than following the camera's current biome.

The dominant biome ID supplies a location name and enemy/loot content bias. It never selects the whole screen's terrain or vegetation. Enemy spawn snapshots retain their original biome if the enemy later crosses a border.

A warped starting area remains Deadwood. Region queries are independent of terrain tiles and travel order, with a bounded 512-entry climate cache. Rendering uses the existing world-aligned ground surface, including across negative coordinates and tile edges.

## Procedural art contract

`biome-props.ts` owns 23 named prop families and immutable weighted species tables. Each family defines collision radius, scale, projected canopy bounds, shadow, wind sway and optional emitted light. World generation and rendering consume the same metadata. Decorative groundcover remains passable. Roads, settlements, shrines and wilderness approaches keep their existing clearance rules; foreground crowns also avoid obscuring protected sites.

`biome-prop-art.ts` draws fourteen new explicit geometry families. `environment-art.ts` supplies the older foliage families and caches a bounded set of sprite variants. Base trees, rocks and shrines stay in `ArtLibrary`. Ice crystals, ember stones and fungi add restrained emitted light within the existing light budget.

## Local review

- `/biomes.html` shows seven frozen generated environments and two real mixed borders through the game renderer and CRT pass. Props are neither moved nor replaced for the preview; no gameplay advances or exploration is saved.
- `/atlas.html?seed=7319`, `18427`, or `90210` opens a large explored example using the real world map and memory-only discovery. See [explored atlas](explored-atlas.md).

Generation version is now **4**. Earlier exploration charts are invalidated because their geography no longer matches. The current prototype has no character save or save migrations.

Biome-specific enemies and loot biases extend the existing tables; level, XP, rank, rarity and item scaling formulas remain unchanged. Water, snow and ash are visual terrain materials in this iteration. Navigation hazards, biome bosses, weather gameplay and biome-specific town architecture are future work.
