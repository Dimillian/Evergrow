# Procedural graphics overhaul — 2026-09-05

The pass develops the existing gothic palette and fully code-defined artwork across all seven climates. No generated image assets, display settings, new dependencies, combat rules or character saving were introduced.

## Implemented

- Eight tree families share a new generator with three growth habits per family, varied branches, aged bark, shelf fungi, layered crown shading, grouped leaf highlights and family-specific snow/draping foliage. Superseded tree recipes were removed.
- Trunks stay rooted and opaque while two crown layers respond to coherent wind. Player occlusion fades foliage separately. Groundcover bends around its base instead of translating the whole sprite.
- World-anchored moss, soil, leaf litter, mineral and snow deposits add intermediate-scale terrain structure. Their irregular feathered edges avoid concentric rings. Fine grass density varies in patches. Wetland banks receive a restrained material edge.
- Ground stamps integrate roots, low understory, leaf beds, rock fragments, soft broken crown shade and tighter contact shadows. All dressing stays decorative. Stamps are stable across eviction and independent of instance position, scale and radius.
- Slate courses follow each roof slope, with chipped ends, repairs, moss and chimney soot. Foundations gain contact shading, damp courses and scattered weathering. Flat charcoal/straw/wax-like marks distinguish building activity without creating unmodeled yard obstacles. Windows cast shaped ground light. Cobbles have tighter joints and clearer worn edges.
- Rocks and monoliths share clipped fractures, strata and lichen. Landmark ground includes fragments around existing stone/wagon anchors.
- Localized mist sits near selected willow, crystal and moorland anchors. Lily ripples and independent crown motion have fixed budgets and obey reduced motion. Existing chimney smoke, biome particles and the CRT pass are retained.
- Shared worn/icon armor shapes gain polished bevels and chased marks. Hits shed archetype-appropriate bone, cloth, metal or spirit-colored particles; non-emissive fragments tumble as angular chips. Attack timing, damage geometry and the metal-gold blade ribbon are unchanged.

## Integration and limits

Tree/collision roots, roads, climate geography and POIs retain their identities. Larger projected crowns reserve more space around protected wilderness sites, so some trees near landmarks are omitted. No generation-version change or exploration reset is needed. Normal reload behavior still resets the run-local character.

Most new detail is cached. See [system-status](system-status.md) for the larger but bounded sprite memory budgets. The increased art complexity and two additional crown draws per living tree need gameplay performance feedback; code checks and CPU static exports are not GPU frame-rate acceptance.

## Verification

- Full `npm run check`: deterministic/code tests, strict TypeScript, headless-core compilation and production build.
- New checks cover deterministic layered tree generation, ground-stamp regeneration after eviction and differing instance radius/position, fixed LRU capacity, and protected-ground exclusion. Existing tests cover finite unclipped biome geometry, art state restoration, roads, collision, source identities and import cycles.
- Native Canvas comparison of four neighboring deposit tiles against one 512×512 render, across negative coordinates in Verdant, Frostpine and Mire: at most two channel values of raster rounding; no higher discontinuities. Snow marks use stable world-pixel placement.
- [Static exports](captures/2026-09-05/graphics-overhaul/README.md) use the actual renderer and no simulation ticks or save access. They are before the CRT pass because the Mac was locked during capture. Browser motion, final CRT presentation and gameplay feel remain for the user's local playtest.
