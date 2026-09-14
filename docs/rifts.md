# Rifts · local implementation

Approved September 14, 2026. A separate crimson, tentacled breach in each town opens rifts at character level 20. Entry defaults to the current character level; choose an offset from −10 to +10 (minimum level 1). No key is required. One optional, unlocked key is consumed atomically on entry from the normal inventory. Keys are item-sized, tiered, deterministic items; each successful boss chest guarantees another key.

A fresh seeded instance uses the real overworld landscape: natural groves, rocks, roads, lakes and blended climates, populated by large irregular packs. No world events, vendors, ordinary chests or breakable rewards occur there. Kill progress is rank weighted: Normal 1, Champion 4, Elite 8, with 600 required. The authored roster contains substantial surplus so no full clear is needed. Initial target: roughly 45–65 mixed kills per minute, filling the bar in 5–7 minutes and leaving 3–5 minutes for the guardian. This is an initial tuning target for player testing, not a measured clear-time guarantee.

The full clear, including the guardian, has a 600-second active-play limit. Pause/menus and offline time do not advance the clock. Saves retain the exact run, remaining time, enemy casualties and consumed key. Reopening never rerolls an active map. Death or timeout ends the run and returns the player to town. Voluntary return abandons an unfinished run. XP, on-kill recovery and potion recharge remain active; monsters drop no equipment, gold or resource vials. All physical rewards come from the final chest after the guardian dies in time.

The final chest grants eight equipment/charm rolls, a large gold pile and one key. Rewards and claim state save together before delivery; full bags leave rewards on the ground. Exit appears after success. Results record clears, highest completed level and best time per level; keyed results identify key tier so bonuses are visible. Loot bonuses never change progression contribution or the timer.

Keys have five strength grades, presented as Common (silver), Magic (blue), Rare (gold), Epic (purple) and Legendary (orange), without numeric tier labels. Key crystals and selection cards use shared item rarity colors. Hover or keyboard focus shows the shared item tooltip; selecting a key also keeps its exact modifiers inline. Each rolls distinct red hazards and green rewards. Hazards include monster health, damage, speed and greater elite presence; rewards include gold, rarity and additional item rolls. Entry previews exact values. Champion (existing internal veteran rank) and Elite identities remain deterministic across saves, with larger silhouettes, blue/gold glow and seeded combat modifiers everywhere. No random rerolls on reload.

Checkpoint implementation, runtime integration, presentation and verification separately. Local only; no publication until requested.

## Implementation and initial tuning

`rift-content.ts`, `rift-floor.ts`, `rift-runtime.ts` and `rift-rewards.ts` own deterministic content, pack placement, the active-play clock and final rewards. The room/corridor experiment was replaced locally on September 14. Each map now targets 28 irregular packs of 64–96 enemies (roughly 2,200 total), plus a biome raid guardian. Default rank shares are 69% normal, 21% champion and 10% elite. Keys can increase elite presence. Pack members share a dominant archetype with supporting enemies, use body-sized separation, and avoid water, trees and other solid props. A 600-unit entry exclusion gives arrival space.

`WorldLandscape` owns the existing headless geography, props, contact and collision; `World` adds canvas terrain rendering. Both ordinary worlds and `RiftWorld` use those same implementations. The wilderness-only option removes settlements, event sites, shrines, containers and ordinary encounters without repainting the climate or carving rooms. The seed determines the starting biome, which also names the rift and selects its guardian. Natural biome transitions remain present further out. No artificial room walls or arena boundary are added.

The 13×13 invisible, 640-unit discovery/streaming sectors are metadata, not level geometry. Nearby sectors reveal on the real terrain map; the guardian marker becomes visible after filling the bar. Rift admission checks run four times per second and still require offscreen coverage. Members admit within 1,500 units and inactive actors retire beyond 2,200; the gap prevents stationary despawn/respawn churn. Actor health/casualties keep their normal fixed-step ownership; no simultaneous-actor ceiling is added. Terrain workers receive the wilderness-only setting, with separate cache identities to prevent town tiles leaking into a rift. Generated layouts and terrain-map tiles have bounded caches.

This replaces the unshipped room-based rift layout; unfinished development rift snapshots from that experiment are unsupported. Normal overworld characters and ordinary dungeon/expedition layouts are unchanged.

The final chest rolls eight items at relative weights Rare 56.84 / Epic 33.16 / Legendary 5 / Unique 5 before optional fortune bonuses, plus one key. Charms use the existing boss-chest eligibility. Every completed chest guarantees one key: 65% at the used rarity and 35% one rarity higher, capped at Legendary (100% Legendary at the cap). Unkeyed runs award 65% Common / 35% Magic. Keys do not enter ordinary monster or equipment loot pools. Gold is six times the ordinary boss-chest formula before gold-find and key bonuses. All chest ownership persists before loot is delivered.

Champions have one seeded modifier and 14% larger art; elites have two distinct modifiers and 28% larger art. Swift adds 15% movement, Relentless shortens recovery by 20%, Savage adds 10% damage, and Resolute shortens control effects by 25%. Bosses keep their authored recipes. Native target plates name the traits; blue/gold glows identify the rank. Shared visible bounds keep aiming and hover detection aligned.

`DungeonEntrance.rift`, `DungeonRun.rift` and `Expeditions.rifts` are optional save fields, so existing characters retain their progress. `ItemKind.riftKey` uses canonical validation and a 1×2 normal-inventory footprint. Keys cannot be equipped or improved. Level, key lock/ownership and stale-attempt checks happen in the durable entry transaction. Failed and abandoned rifts retire on exit; normal expedition routes remain separate.

The local runtime entry UI is available in World → Crimson Rifts (`/tools/rifts.html`). It uses disposable memory, the actual panel and procedural portal art; no playable saves are accessed. `?view=map` reveals the actual terrain and roster; **View pack** uses the real renderer with frozen enemy poses and no simulation ticks.

Verification: all 1,462 headless tests and the production build passed for the first integrated checkpoint. Follow-up checks cover shared rank-aware aiming and cached key modifiers. The narrow panel keeps its frame and actions outside the scrollable body. Balance timings remain targets pending player gameplay feedback.

## September 14 implementation audit

- Spawn and save restoration share `applyEnemyModifiers`; keyed life/damage and global Savage damage survive reloading with existing wounds intact. The active clock does not advance offline or double-count a death tick.
- Guardian victory cancels hostile projectiles and closes damage intake while rewards are collected. Clear records remain exactly once.
- A full rift ground-item buffer leaves undelivered rewards in the chest, preserving player-dropped items; claim masks prevent duplicate items or gold across retries and saves.
- `RIFT_RULES`, `riftRewardItemCount` and `riftRewardMask` share reward quantities, key progression odds and completion ownership. Replacement-key RNG is isolated from equipment rolls so adding gear rewards cannot alter key progression. This rerolls the guaranteed key in an unclaimed local development rift; characters and run progress remain intact.
- Key movement penalties also affect guardian pursuit, while authored charge distances and warnings remain unchanged.
- The original fixed-biome renderer cached sample/contact objects; it has since been replaced by the shared overworld landscape. Rank traits and key modifier caches remain bounded by content or object lifetime. Roster size stays finite per floor without imposing a simultaneous-actor cap.
- Key selection retains focus and scroll position; hover and inline modifiers share content. Failed entry exceptions restore controls. Map hover targets exclude placeholder chests. The preview uses runtime-shaped canvas siblings to catch dialog placement/layer regressions.

Extension points remain separate: rules and modifier recipes (`rift-content.ts`), layout/rosters (`rift-floor.ts`), lifecycle (`rift-runtime.ts`), reward generation (`rift-rewards.ts`), shared enemy modifiers and presentation. Additional key grades or reward quantities must respect the current 31-bit claim-mask representation; moving beyond that requires replacing masks, not silently expanding counts.

Gameplay pacing and sustained frame rate with large pulled packs still require the user's device/playtest feedback; headless correctness tests do not prove either.

Audit verification: the full 1,468-test headless suite passed. All 15 rift regressions, including an explicit combined monster-life/damage save fixture, passed; TypeScript checks and the production build passed. No automated browser gameplay or player saves were used.


Open-world replacement verification: all 1,470 headless tests passed, including dense-pack offscreen admission and stationary identity retention. TypeScript and the production build passed. A 100-seed headless sample contained 2,142–2,364 non-guardian enemies; slowest measured layout generation was 65 ms on the development machine (not a combat frame-rate measurement). Comparison with the preceding checkpoint preserved ordinary-world biome/water/map/collision/movement queries across 300 points and three seeds, plus matching prop collections. Static map and frozen game-renderer captures were checked in the in-app browser; no gameplay was driven.
