# Sculpted surface lighting — local art pass

The procedural stained-glass style now uses broad surface planes to make tree crowns, trunks and stone faces read as volumes. This is a local rendering experiment, not a published release.

`surface-relief.ts` records planes alongside the original procedural geometry. Independent tree crown layers retain their movement and player-occlusion fading. Eight tree families, ordinary rocks, limestone, basalt, ember basalt, ice crystals and open-biome stones provide authored planes. Other scenery retains its existing material path.

The renderer samples the existing directional and nearby scene lights. `surface-lighting.ts` supplies three broad diffuse bands with smooth shoulders. Opaque plane masks follow the asset's overlap order, then multiply the original pigment; overlapping crown planes do not repeatedly darken the same surface. Recessed undersides, thin lit edges and restrained distant contrast create depth without adding particles or geometry to the simulation.

Metal armor uses the same diffuse response with narrow inward bevels and recessed shadow pigments. Scenery receives a cached contact shade at the ground. Actor shadows keep their single continuous footprint.

## Rendering budget

- Two reusable lit rasters per source layer, one shared scratch canvas and at most six rebakes per frame.
- Light direction, power and color are quantized. Warm surfaces are ordinary image draws, without pixel readback or per-frame blur.
- Scenery memory reserves include the two additional rasters; existing cache byte limits remain unchanged.
- Lights reuse the existing scene budget. No additional light sources or gameplay effects are introduced.

The paired native Canvas forest check used seed 18427, 132 visible props, 1× zoom, 25 warmup frames and 35 measured frames. Median prop drawing was 5.44 ms before and 3.86 ms after; character drawing remained 0.71 ms. Conservative reserved sprite memory rose from 130.6 to 152.4 MiB, with no measured cache misses or evictions. These are CPU renderer samples without browser GPU, terrain workers or simulation; they are not gameplay FPS claims.

## Review and extension

World → Surface volume (`/biomes.html?sculpted`) compares identical runtime assets before/after under daylight, a moving lantern and violet light. The view is disposable, honors reduced motion and pauses animation while hidden. `/biomes.html?lighting&view=verdant&hour=10` includes a **Volume** comparison toggle in the real generated world.

New procedural props can call `beginRelief` once per source canvas and register `reliefFacet` geometry in painting order. Use a small number of broad planes, retain the original sprite silhouette, and avoid tiny tessellation. Buildings and terrain are not converted by this pass.
