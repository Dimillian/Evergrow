# Presentation frame-limit benchmark

This benchmark evaluates browser presentation limits independently from the fixed 120 Hz simulation contract. It must not be used to claim that simulation, input sampling or elapsed time are completely independent from the main frame loop.

## Reference machine

- MacBook Air (Mac17,3)
- Apple M5: 10 CPU cores (4 performance, 6 efficiency), 8 GPU cores
- 16 GB unified memory
- macOS power source: AC, Low Power Mode off
- Stats 3.0.16 (`eu.exelban.Stats`)

Record the browser version, macOS version, display resolution and refresh rate with every result. Close unrelated high-load applications, keep the machine on AC power and use the same browser window size and camera zoom for all runs.

## Automated evidence

The `frame-pacer.test.ts` matrix exercises 30 and 60 FPS targets against synthetic 60, 90, 120 and 144 Hz callback streams. It also covers preference validation, Android's fixed 60 FPS policy, jitter and long suspension, and demonstrates the elapsed-time loss that follows from the runtime's existing 50 ms delta ceiling. That demonstration does not exercise the `Game.frame` boundary itself.

Run:

```sh
cd game
node --experimental-strip-types --test tests/frame-pacer.test.ts
npm run typecheck
npm run build
```

These checks validate scheduling contracts and code integration. They do not measure browser CPU, GPU, energy or gameplay feel.

## Controlled browser runs

Use the same character, seed, location, camera direction and zoom for every run. Capture three five-minute samples for each mode, rotating the order between rounds to reduce warm-up and temperature bias:

1. `Display`
2. `60 FPS`
3. `30 FPS`

Use two scenes:

- Quiet: stationary wilderness with no active combat.
- Busy: a repeatable dense encounter selected by the player, without changing equipment or camera framing between modes.

Before each sample, allow two minutes for assets and temperature to settle. Reset the F3 monitor, then export its JSON at the end. Record median FPS, p95/p99 frame interval, intervals above 50 ms and the CPU breakdown. Frame interval includes browser scheduling and GPU pressure; the CPU stages do not measure GPU execution.

Stats may be used for supporting trends. Record average or stable ranges for total CPU, GPU, package power when available, memory pressure and temperature. A MacBook Air is fanless, so fan RPM is not applicable. Stats readings are observational and should be compared only across the controlled runs; they are not a replacement for the game's frame telemetry or an energy instrument.

For stronger energy evidence, repeat the three modes on battery from the same initial charge range with display brightness, audio and network activity fixed. Use macOS Activity Monitor's Energy tab or another repeatable system source alongside Stats. Report energy results as observed comparisons, not universal savings.

## Player-perception pass

The player performs this pass; automated gameplay is not part of the benchmark.

For each mode, spend at least two minutes on:

- continuous traversal and camera panning;
- rapid direction changes and dodge timing;
- melee or ranged aiming and repeated attacks;
- opening and closing the pause menu, map and inventory;
- moving between title, Options and gameplay.

Immediately after each mode, record 1–5 ratings for smoothness, input response, aiming confidence, combat readability and overall comfort, plus one short free-text observation. Use a blinded or rotated mode order when practical. The acceptance question for 30 FPS is whether its efficiency trade-off remains comfortable with the current input cadence; a lower frame count alone is not sufficient acceptance.

## Claims and decision rule

The implementation may claim that it reduces the cadence of accepted main-loop frames and preserves the existing fixed simulation timestep. Do not claim proportional CPU/GPU/energy savings, zero input impact or perfect elapsed-time conservation without matching measurements.

Keep `30 FPS` only if its pacing tests pass and the player accepts its responsiveness. Prefer `60 FPS` as the balanced option. `Display` remains the default until repeated measurements and player feedback justify a product-default change.

## Short browser checkpoint — September 19, 2026

A short Chrome run used a fresh local character in a stationary Whispering Steppe scene. These samples validate pacing and responsive layout only; they are too short for thermal, battery or percentage-savings claims.

| Viewport | Limit | FPS | p95 | p99 | >50 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop | Display | 60 | 17.7 ms | 17.7 ms | 0 |
| Desktop | 60 FPS | 60 | 18.7 ms | 18.7 ms | 0 |
| Desktop | 30 FPS | 30 | 35.3 ms | 35.4 ms | 0 |
| Mobile 390 × 844 @3× | 60 FPS | 60 | 17.1 ms | 17.6 ms | 0 |
| Mobile 390 × 844 @3× | 30 FPS | 30 | 33.9 ms | 50.0 ms | 1 |

The first desktop 30 FPS run exposed alternating approximately 16.7/50 ms intervals despite averaging 30 FPS. A deterministic jitter test reproduced it. Increasing the existing early-deadline allowance from 0.25 to 0.75 ms removed that pattern: the repeated desktop sample had no interval above 50 ms. The isolated mobile outlier remained possible during a short live session and should be compared against longer player runs before attributing it to the cap.

The Chrome device override was cleared and the saved preference returned to `Display` after the run. Stats was not sampled during this short checkpoint because its system-wide readings would not add reliable attribution at this duration.
