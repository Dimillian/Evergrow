# Natural landscapes — generation 9

Enabled in local gameplay, 2026-09-07. New characters, terrain workers, maps and scene studies share `World` and the same nine-biome climate field. Included in the v0.4.0 release source.

## Starting worlds

Each seed chooses any of the nine home biomes with equal weight. Home has a seeded name and normal town/city layout; the player arrives on dry, clear ground to its south. Its district starts at level one and the initial town portal points home. Internal coordinates remain relative to home so road progression radiates from the correct settlement. Generation 9 changes the previous opening and requires another fresh character; old slots are preserved.

## Landscape rules

- Deadwood can form naturally in cool, relatively dry regions, independently of the starting biome.
- Forests alternate clustered trees and open glades. Low-density seams connect openings without painted paths.
- Rocks concentrate in separate geological patches. Highlands and Emberfall have more exposed ground.
- Passable cover remains richer than solid obstacles. `natural-landscape.ts` owns shared seeded grove, rock and corridor fields, prop probabilities and terrain relief; there is no separate preview world.
- Whispering Steppe has wind-combed grass, thorn scrub and solitary weathered stones.
- Sunscar Expanse has sand relief, scrub, sandstone formations and fragments. Dune shading is visual only; it does not introduce raised terrain or cliff collision.
- Steppe favors open-country enemies and roadside events. Sunscar favors desert quarry/hoard sites. All new climates participate in seeded town suitability, hydrology, loot profiles, blessings and save validation.

World generation 9 requires fresh characters. Older saves remain stored, but the character session refuses to load a different generation; portable imports also require the current version. No migration or automatic deletion is introduced. Explored charts use generation-specific namespaces.

## Review

`/biomes.html` offers all nine landscapes, another area and seeds 7319 / 18427 / 90210. `/atlas.html?view=extended&seed=7319` shows the interactive atlas. Both use actual gameplay geography with memory-only exploration and no simulation ticks. The former `natural` query parameter is unnecessary.

Code coverage checks all climates across seeds, source-climate retention and checkpoint restoration, continuous density fields, clear low-density seams, reproducible sprites and shared scene generation. Coastlines, new biome-specific monsters and physical cliffs remain future work.
