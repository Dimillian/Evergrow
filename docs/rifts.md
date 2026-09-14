# Rifts

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

## Density and crowd performance (September 14)

Teeming is a possible harmful key modifier: +25 / 35 / 45 / 55 / 65% monster density from Common through Legendary. It increases the baseline 28 packs to 35 / 38 / 41 / 43 / 46 in the same area. Pack size remains 64–96, and placement checks neighboring packs as well as terrain to prevent overlapping bodies. It does not raise the completion threshold or award extra loot during the run. Like the other key modifiers, it appears in both hover and selected-key details. Adding it changes seeded modifier selections in this unshipped key pool.

Dungeon and rift minimaps, full maps and the Thor companion now receive live enemy positions. Markers respect exploration and view bounds; dead enemies disappear. Champions are blue and elites gold. Ordinary dungeon passages also retain markers between revealed rooms.

Dense-crowd optimization preserves the 120 Hz simulation, attack timing, collision rules and actor population. A spatial index supplies nearby separation candidates in the original actor order and updates after each actor moves. Landscape visibility/walking rays batch the existing discrete collision samples against nearby circles; authored buildings, sites and custom dungeon geometry retain their original checks. See [rift-performance.md](rift-performance.md) for reproducible measurements and limits.

## Guardian arrival and rank readability

At full progress, the remaining roster and hostile projectiles dissolve immediately without XP, drops or kill credit. A safe point near the player is selected with guardian-sized collision clearance and line of sight. A 2.4-second red/pink lightning seal announces the guardian before a deliberate visible spawn; this is separate from ordinary offscreen pack streaming. The arrival position/time survive saves and pause with the rift clock. Timeout/death cancels the arrival. The guardian remains the sole live encounter.

On victory, the chest appears at the actual kill location and automatically requests the existing durable reward transaction, regardless of player distance. Rewards scatter from the chest; failed persistence delivers nothing, and a full ground-loot buffer retains outstanding rewards for retries. The exit appears nearby on clear ground. Shared runtime destination helpers keep rendering, map markers, Journeys, interaction and saved exit validation aligned without mutating generated floor geometry.

Champions and elites use a soft blue/gold glow and narrow rim following the actual character silhouette, with no floating world symbols or ground rings. Rank health bars remain visible at full life. Target plates separate the colored modifier names from the monster name, and persistent modifier icons share the existing hoverable effect strip with exact mechanical descriptions. Bosses retain their own authored appearance. A reusable sprite/mask paints each ranked rig once, preserving character depth ordering; no particles or additional dynamic lights are introduced. Reduced motion replaces animated arrival bolts with the static seal/glow.


The map/pack study has a **Guardian arrival** frozen-scene view (`?view=map&arrival`). Pack previews also show the shared target nameplate. The whole-map preview no longer reveals a fictitious fixed guardian destination.


## Rift map and Chronicle follow-up

Atlas, minimap and held-Tab maps draw non-overlapping terrain tile destinations. Cached sample borders still support filtering, but no longer darken grid seams when the map is translucent. Discovery fades inward over 192 world units at the unexplored frontier; edges between discovered sectors stay continuous. Unknown sectors remain hidden. Fog is cached with terrain tiles and rebuilt only when discovery changes, using local sector neighbors. The finite sector lattice remains streaming metadata, with no map lines or visible walls added.

Rift history and six achievement families now use the shared Chronicle. See [Chronicle](chronicle.md) for counters, historical recovery and exactly-once ownership. Existing attempts/clears/best records are retained; no player progress resets.

## Connected rift encounters · September 14

Approved for publication after local playtesting on September 14. New rifts carry `layout: 'clearings'`. The published open layout remains selectable in the same preview for an A/B comparison and reconstructs already-saved active rifts. The user approved this layout and encounter pass for v0.6.1; characters and active rifts are preserved. The timer, progress threshold, XP and chest rewards are unchanged.

`rift-shape.ts` creates 28 irregularly spaced combat clearings, a connected trail tree and short reconnecting routes. Trails have broad 310–370-unit cores with slight bends; clearings vary in size. Shared `WorldLandscape` queries clear their ground and water, darken the surrounding relief and add biome-specific rock/wooded ridges. Rendering, terrain workers, navigation/collision and exploration maps consume the same profile. Ordinary world generation is unchanged. Discovery sectors remain invisible streaming metadata.

`rift-encounters.ts` owns four recurring encounters: guarded batteries (front-line brutes/stalkers, archers behind), flanking hunting packs, ritual gatherings and large fragile swarms. Groups vary from 34–130 enemies and rotate through these recipes. Density keys add 24-member reinforcements to existing clearings. Normal packs still die quickly; difficulty comes from composition, approach and selected leaders. Every original clearing has one special leader, with one mechanic; ordinary rank traits remain intact.

A **Rift Cantor** protects allies within 300 units for 30% less damage. It does not protect itself or other encounter leaders; protection never stacks. A pale jade silhouette and a quiet radius boundary identify the source. Death, crowd control, range and line of sight break protection immediately. The target's effect strip explains the ward.

**Stormbound** leaders place a locked 95-unit lightning warning at the player's position; **Cinder** leaders telegraph a 230-unit forward fire sweep. Both wait 1.4 seconds, deal 85% of the leader's base damage through ordinary elemental mitigation, and have a seven-second cooldown. A per-rift director spaces special starts at least 2.1 seconds apart. Warnings can be interrupted, and end with the hunt. Normal attacks are not queued or capped. Ward candidate searches reuse the enemy spatial index at five updates per second; immediate hit-time checks stop stale protection. These temporary states do not change saved monster identity, health or rewards.

The World → Crimson Rifts map review defaults to the experiment. **Compare open layout** switches to the published layout using the same seed; **View pack** uses frozen runtime actors, with no gameplay or saved-character access. `/tools/rifts.html?view=map&seed=7342&biome=verdant&layout=clearings` opens the study. Gameplay feel remains for manual local testing.

Experiment verification: 1,512 of 1,513 full-suite checks passed initially; the remaining architecture check identified the missing explicit core-compiler entries for the new modules. Those entries were added and all 37 affected architecture/rift/map/terrain checks passed. The additional same-seed terrain-profile regression and final encounter checks passed (10 checks), as did application/core type checking and the production build. Static map/pack inspection used the in-app browser; no automated gameplay or saved-character mutation was performed.

Terrain detail correction: clearing/trail wear no longer suppresses biome ground patches in rifts. These cached patches restore soil, leaf, stone and snow marks across the fighting area, using the existing world-space artwork in both the terrain worker and synchronous renderer. Water/building exclusions, ordinary road treatment, collision and creature density are unchanged.
