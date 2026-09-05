# Living biomes — 2026-09-05

The Verdant motion pass now extends across all seven climates, using the existing procedural props and terrain. The traveling wind front keeps one world-space phase; material stiffness and climate strength change its response. Crowns, groundcover, local mist and drifting debris respond together. Foliage occlusion now fades smoothly in every climate while trunks and collision stay fixed.

| Climate | Reactions and atmosphere | Decorative wildlife |
| --- | --- | --- |
| Deadwood | Dry dust, sparse pale grass, faint cool dapple | Crows and pale moths |
| Verdant Forest | Green leaf litter, bending grass, warm canopy light | Crows and butterflies |
| The Mire | Reed and willow debris, wet foot splashes and expanding ripples, cool dapple | Long-necked waders and four-winged dragonflies |
| Frostpine Reach | Wind-shaken snow, pale grass, beveled snow impressions, cold light | Small pale snowfinches |
| Emberfall | Loose ash, rising sparks from ember rocks, dark impressions | Ash-colored moths |
| Amberwood | Copper and gold leaves, warm grass and canopy shafts | Crested blue jays and golden butterflies |
| Hollow Highlands | Stronger grass gusts, floating seed heads and mist | Brown moor birds and heather moths |

Wildlife lives at seeded prop anchors and reacts to player proximity. Birds flee, circle an occupied perch and return when it clears. Insects scatter and settle; dragonflies spend more time airborne. These are decorative actors with no health, collision, rewards or enemy population cost.

## Materials and transitions

`biome-life-content.ts` owns deeply frozen recipes. `biome-wind.ts` evaluates the common front, accepting either a material biome or blended weights. `biome-life.ts` owns transient state and `biome-life-art.ts` draws it through Renderer. The former forest-only implementations are removed.

`ground-material.ts` shares the terrain water function with World. When a foot lands, `World.sampleGroundContact` reads local climate weights, dampness, road and settlement paving coverage, and indoor geometry. Wet patches splash; dry Mire ground does not. Roads and paving suppress biome debris in favor of neutral dust. Interiors produce no footstep decoration. Water remains passable visual material.

Particles retain the biome, material and color chosen at emission. Footprints retain their source material and wetness. Crossing a border cannot recolor existing snow into ash or turn a footprint into a ripple. Local prop identities select wildlife, allowing neighboring species to coexist at blended borders without a screen-wide mode switch.

## Budgets and verification

The entire scene shares 40 disturbances, 48 footprints, 100 loose particles, six birds and ten insects. Ground drawing considers at most 100 anchors; light drawing emits at most five shafts. There are at most seven small cached dapple stamps and 512 transient crown fade values. State expires or leaves the nearby prop set. Reduced motion freezes reactions and wind while refreshing nearby resting wildlife; teleports clear movement trails, and renderer reset clears all transient state.

Code coverage includes every biome recipe, wet/dry/road/indoor contacts, wind continuity, source-material retention, wildlife kinds and return behavior, teleport handling, reduced motion, deterministic replay and shared caps under mixed-climate streaming. All 423 tests, strict application/core compilation and the production build pass.

The actual renderer was staged through native Canvas in all seven climates and two mixed borders without simulation ticks, gameplay controls or save access. Those snapshots precede CRT processing; the previous forest browser recording documents that original scene through the full CRT. Expanded motion and combat-load performance remain for user playtesting on the local game server.

This pass adds no raster assets, runtime dependencies, gameplay rules or save formats. World generation remains 4 and exploration progress is preserved. `/forest.html` remains the local forest motion study, and `/biomes.html` remains the frozen all-climate review.
