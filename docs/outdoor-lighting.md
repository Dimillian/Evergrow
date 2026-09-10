# Outdoor lighting and world time

Local presentation pass, 2026-09-10. Every climate receives smoothly blended outdoor effects. The camera remains 2D; this is an artistic lighting model, not volumetric geometry or a physics weather system.

## World clock

`world-time.ts` owns a 36-minute full day starting at 09:00. Both minimaps use the same clock as the renderer. Time derives from persisted `Simulation.time`, so it stops when simulation pauses, resumes across saves and continues through travel and dungeons without a new save format. Existing characters use their already-saved elapsed time; nothing is reset. There is no real-world/offline time advancement or server-global clock.

A continuous sky state controls ambient brightness/color, sunrise/sunset warmth, material key direction/power, water sky tint/specular direction, canopy shafts, and cast shadows. Tree, rock, actor and settlement/fortification shadows lengthen at low light angles and change direction through the day. Two cached scenery highlight directions blend rather than switching at noon. Moonlit nights preserve navigation contrast; physical torches and equipment lights remain independent. The invisible player visibility fill does not influence gear material or actor shadow direction. Interiors fade toward a separate fixed material key; dungeons keep their authored lighting. This is presentation only: enemy vision, spawns, damage and rewards do not change with time.

## Climate treatments

- Deadwood: cool drifting ground mist and faint shafts among bare trunks.
- Verdant Forest: warm canopy-filtered rays, backlit leaves and gentle damp highlights.
- The Mire: broad, slow blue-green fog banks with reduced lamp scattering and shafts. Soft, restrained wet-ground highlights replace granular glints; fog fades gently around the player to preserve combat readability.
- Frostpine Reach: blue-white shafts, sparse snow glints and windblown powder ribbons.
- Emberfall: warm smoky air and sparse rising sparks near actual warm emissive props/fixtures.
- Amberwood: copper canopy edges and broad golden shafts.
- Hollow Highlands: cool mist in seeded sheltered patches and stronger cloud shade.
- Whispering Steppe: moving grass-light bands, light dust and broad cloud shadows.
- Sunscar Expanse: warm ground haze and low blowing-sand ribbons, with lighter cloud cover.

Biome weights blend at each geographic field sample rather than switching with the player's current biome. Heat refraction, terrain-height volumetrics and dynamic normals for every painted building face are not implemented.

## Rendering and budgets

`outdoor-light-effects.ts` renders three small WebGL passes: ground highlights before actors, broad cloud shade over world surfaces before lighting, and air scattering after lighting but before emissive effects and the native-resolution HUD. Cloud shade and the loss of shaft intensity use the same world-anchored moving noise field. Clouds do not scroll with the camera.

Three small geographic textures pack all nine biome weights, dampness, indoor exclusion and seeded mist pockets. `outdoor-light-content.ts` samples existing biome/ground-contact APIs into a cached 48-unit field. Rivers/lakes retain their own water optics rather than receiving duplicate land gloss. Indoor samples suppress the outdoor passes; entering a building fades them globally as well.

A two-channel 512×512 canopy atlas contains real foliage silhouettes: red follows the shared sky-shadow projection; green follows the standing canopy and its wind deformation. The shaft shader samples along the current sky direction. `prop-surface-light.ts` adds cached silhouette-clipped leaf edges and stone sheen while retaining the painted facets and original wind/occlusion transforms.

Limits: half world-render resolution capped at 640 pixels on either axis, four physical local lights, 80 canopy props, a 10 Hz wind upload cadence and 4,096 cached ground cells. Sun changes also invalidate canopy projection at bounded time increments, including when wind motion is disabled. Geographic texture uploads happen only when coverage changes, reusing overlapping cells. No per-frame pixel readback. Context loss/unsupported WebGL retains the established atmosphere, shared day/night ambient lighting and Canvas shadows. Reduced motion freezes decorative wind, dust, glints, cloud drift and fog; the slow world clock still follows active play.

## Preview and verification

World workspace → Outdoor lighting (`/biomes.html?lighting&view=verdant&variant=1`). All nine climates have buttons. The time slider and Dawn/Noon/Dusk/Midnight buttons override the sky in this disposable study only. Play day cycle advances a full day in one minute; hidden/reduced-motion studies do not auto-advance. Save PNG captures the current rendered scene. No playable save reads or writes occur.

Headless tests cover saved-clock continuity, midnight wrapping, lighting/shadow continuity, indoor isolation, all climate channels, texture/cache budgets, reduced motion and context recovery. Static screenshots and CPU timings do not establish crowded gameplay or Android performance.

## Local performance audit — 2026-09-10

A live Wrencross village study (seed 406135043, 22:00, 2131×1480 world buffer, 1440×1000 output) identified procedural fortification drawing as avoidable work. Before/after 600-frame samples on the local machine put median structure drawing at 3.9 → 0.9 ms (p95 4.5 → 1.3 ms) after caching the static wall artwork. Whole-frame CPU changed from 21.4 → 15.4 ms; browser contention and warmup can affect these numbers, so this is diagnostic evidence rather than a controlled gameplay FPS claim. Other preview tabs were open. Median lighting was about 0.9–1 ms and post-processing submission about 0.2 ms; these CPU timings exclude GPU completion.

Environment light flicker now changes power instead of radius. This preserves stationary shadow cookies across frames instead of invalidating them on every tick; the lighting regression test checks reuse while brightness varies. The scene still shares its existing light limits.

Remaining prominent costs in this village were characters (~3.5 ms), props (~2.1 ms), and ground/scenery (~5 ms, partly overlapping water/lighting). A future pass could profile civilian rigs and transparent scenery overdraw on the target device. Do not infer Android, Safari, travel-streaming or crowded-combat results from this frozen overview. No gameplay/browser playtest was driven during this audit.
