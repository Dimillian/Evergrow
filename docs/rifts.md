# Rifts · local implementation

Approved September 14, 2026. A separate crimson, tentacled breach in each town opens rifts at character level 20. Entry defaults to the current character level; choose an offset from −10 to +10 (minimum level 1). No key is required. One optional, unlocked key is consumed atomically on entry from the normal inventory. Keys are item-sized, tiered, deterministic items; each successful boss chest guarantees another key.

A fresh seeded outdoor map reuses one of nine biomes with corrupted terrain, branching clearings and dense packs. No world events, vendors, ordinary chests or breakable rewards occur there. Kill progress is rank weighted: Normal 1, Champion 4, Elite 8, with 240 required. The authored roster contains substantial surplus so no full clear is needed. Initial target: roughly 45–65 mixed kills per minute, filling the bar in 5–7 minutes and leaving 3–5 minutes for the guardian. This is an initial tuning target for player testing, not a measured clear-time guarantee.

The full clear, including the guardian, has a 600-second active-play limit. Pause/menus and offline time do not advance the clock. Saves retain the exact run, remaining time, enemy casualties and consumed key. Reopening never rerolls an active map. Death or timeout ends the run and returns the player to town. Voluntary return abandons an unfinished run. XP, on-kill recovery and potion recharge remain active; monsters drop no equipment, gold or resource vials. All physical rewards come from the final chest after the guardian dies in time.

The final chest grants eight equipment/charm rolls, a large gold pile and one key. Rewards and claim state save together before delivery; full bags leave rewards on the ground. Exit appears after success. Results record clears, highest completed level and best time per level; keyed results identify key tier so bonuses are visible. Loot bonuses never change progression contribution or the timer.

Keys have five tiers. Each rolls distinct red hazards and green rewards. Hazards include monster health, damage, speed and greater elite presence; rewards include gold, rarity and additional item rolls. Entry previews exact values. Champion (existing internal veteran rank) and Elite identities remain deterministic across saves, with larger silhouettes, blue/gold glow and seeded combat modifiers everywhere. No random rerolls on reload.

Checkpoint implementation, runtime integration, presentation and verification separately. Local only; no publication until requested.
