# Reward presentation

Gold, XP and level-ups now have separate visual destinations. The bottom feed retains named equipment, discoveries, region entries and warnings. Its obsolete gold/XP/level card variants have been removed. Level-ups still announce earned points through the screen-reader status region.

## Simulation and presentation

Simulation credits XP and gold immediately and persists the exact values. Presentation never awards, spends, moves or deletes actual rewards. Ground coin art scatters around each existing pickup anchor; collision, magnet radius, collection time and currency RNG are unchanged.

`RewardCounter` holds a visual total and pending amount. Incoming rewards wait for a nominal 0.8-second flight and a quiet period (0.5 seconds for gold, 0.6 for XP). The wait is capped at two seconds from the beginning of a batch. Once filling starts, further gains retarget the same continuous drain instead of restarting it. The final fraction converges exponentially and snaps at a small numeric tolerance. Purchases, vendor income and restored balances reconcile directly rather than replaying pickup effects.

`ExperienceFeedback` consumes the exact XP events, keeps an independent visual level, draws solid/ghost fill and a pending +XP label, and completes a full rail for at least 0.12 seconds before carrying the remaining amount into the next level. Extreme rewards spanning more than four remaining levels compress the intermediate visual sequence. Actual levels and earned points are never delayed. Reduced motion shows exact resource values immediately.

`RewardFeedback` retains at most 72 flight sprites, admitting at most four three-sprite bundles of each resource per frame. Suppressing decorative sprites never discards reward values. Flight origins are projected once into normalized screen coordinates; subsequent camera motion cannot drag the trails around. Gold targets the counter coin; XP targets the left end of the shared responsive XP rail. All flight drawing and text use the native-resolution UI pass. Pauses freeze the presentation clock; renderer reset drops all pending effects.

## Art and sound

Ground coins are 35% larger with compact outward scatter, rotation and diminishing bounces. Pickup flights use short golden wakes and the top-left readout shows a fixed-position pending +amount. The pending value counts down as the displayed balance rises, then the coin gives a restrained glint. XP uses violet-white energy and a translucent earned segment ahead of the solid rail.

Level-up uses a warm expanding foot-ring, translucent pillar and rising filaments for 2.4 seconds. A native-resolution Level Up announcement shows the new level and exact earned points. Rapid level events merge into one presentation. Reduced motion keeps the art stationary with a short fade; there is no camera shake or full-screen flash from leveling.

`GameAudio` synthesizes a dedicated low impact and ascending/resolving chime for level-up. Gold uses metallic partials with a five-note pickup phrase; XP has a quiet rising tone and arrival accent. Gold sounds are admitted at most once per 75 ms, XP once per 120 ms, and level phrases once per 700 ms. Existing voice limits, priority, compressor, mute and teardown still apply. No sound files or network assets are required.

## Review and validation

`/rewards.html?scene=level` offers Level up, XP stream, Gold spill & pickup, Rapid rewards and Multiple levels, plus Replay, Pause and opt-in Sound controls. Every seven-second scene loops an authored timeline using the actual Renderer/PostFX/HUD. It never advances simulation, drives gameplay or accesses saves. The operating-system reduced-motion preference is honored.

`game/scripts/render-reward-animations.mjs` exports the same presentation scenes with an optional installed native Canvas implementation (`CANVAS_MODULE`). These CPU captures are before CRT and omit sound; the browser preview provides the real post-processing and synthesized sound.

Code tests cover quiet-time accumulation, burst limits, frame-rate independence, monotonic settling, overflow, exact reduced-motion values, debit/reset reconciliation, merged level-point announcements, bounded audio scheduling and existing exactly-once wallet rewards.
