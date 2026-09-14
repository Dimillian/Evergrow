# Rift crowd performance

Measured September 14, 2026 on the development machine. These are CPU timings, not a guaranteed gameplay frame rate.

## Reproduce

```sh
node --experimental-strip-types game/scripts/benchmark-rift-crowds.ts
node --experimental-strip-types game/scripts/benchmark-rift-crowds.ts --density
node --cpu-prof --experimental-strip-types game/scripts/benchmark-rift-crowds.ts --profile
```

The benchmark uses the actual seed-7342 open-world rift, level-30 roster, simulation and AI. It engages the nearest 128, 256 or 512 actors at the first pack, keeps a stationary player alive, and samples 360 fixed ticks after 60 warmup ticks. No player saves or browser gameplay are involved. The density variant uses a Legendary Teeming key (+65%); its layout/composition differs, so it is additional coverage, not a paired baseline.

## Results

Median simulation CPU per 60 Hz frame (two 120 Hz ticks):

| Active enemies | Before | After |
| --- | ---: | ---: |
| 128 | 2.07 ms | 0.39 ms |
| 256 | 7.26 ms | 1.14 ms |
| 512 | 29.76 ms | 8.23 ms |

At 512 actors this removes roughly 72% of the simulation cost. The +65% density fixture measured 5.09 ms at 512 actors. Differences between fixtures reflect archetypes, obstacles and positioning.

The initial CPU profile concentrated in repeated landscape collision queries, movement/navigation, and all-enemy separation scans. Changes:

- Query neighboring spatial cells for separation, retaining original iteration order and immediate position updates. No enemy cap, reduced tick rate or delayed attacks.
- Batch walking/visibility rays: query collision regions once, then test the nearest existing discrete sample per circular obstacle. Buildings, authored sites and overridden collision implementations use the original path.
- Skip per-sample sanctuary queries when a segment cannot reach a settlement; rifts use the same discrete samples against their circular arrival sanctuary.

A 100-seed Legendary Teeming generation audit produced 3,542–3,799 non-guardian monsters; all 46 packs reached at least 64 members. Slowest layout generation was 76 ms on the development machine, outside combat ticks.

Regression coverage compares accelerated and original queries across ordinary/rift worlds and custom walls, checks spatial neighbors after cell crossings, and validates density placement at all five key rarities.

## Rendering and limits

The rift map tool's **Profile rendering** action repeats the actual renderer and post-processing on a frozen pack at 1100×900 for 150 frames, discarding 30 warmup frames. It displays median/p95 CPU and stores stage timings on the result element. No AI ticks or save access occur.

The frozen seed-7342 Verdant scene staged 127 enemies and measured **4.5 ms median / 5.1 ms p95** render CPU in the in-app browser at 1100×900. The actor/prop pass accounted for 2.5 ms median, scenery 0.6 ms, lighting 0.6 ms and post-processing 0.1 ms (nested stage timings are not additive). This check did not reveal a rendering bottleneck comparable to the original 29.8 ms simulation cost.

Headless timings exclude drawing, GPU scheduling, effects from a long fight, save serialization and device thermal limits. Static render timings exclude moving combat/effect creation. Both are useful diagnostics; sustained gameplay FPS still needs the user's playtest.
