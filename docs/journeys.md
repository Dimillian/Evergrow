# Journeys

Local regional scaling, 2026-09-08: Activity levels now preview bounded scaling or show the saved encounter level. Recommendations remain local while the region is useful, then favor a higher-ceiling road lead at its ordinary cap. Bosses and dungeons can be recommended at +3. Manual pins remain fixed. See [regional scaling](region-scaling.md).

Implemented · 2026-09-06 · initial tuning for continued player testing.

## Area journal

Local September 19, 2026: proposal 1 is implemented as a two-column Area journal. The left list groups **Accepted**, **Nearby**, and **Completed**; the right keeps the selected activity's objective, location, distance, reward and actions. The area picker browses activities within 2,400 world units, any known region, or all known areas. Completion counts describe **known** activities in the selected area, not every undiscovered objective in the world. Town navigation is a separate section. Lists and details scroll independently on desktop and stack on narrow screens. Sidebar category headers use tinted bands, a slim accent edge and count badges: gold for Accepted, blue for Nearby and green for Completed. Quest details show Level as the quest level followed by its relative difficulty in parentheses, using the same Easier, Good level and Harder colors as the quest lists.

- **Accept** adds an activity to Accepted without pinning it. There is no gameplay acceptance cap. **Accept all nearby** accepts the unaccepted entries shown in the selected area in one durable transaction.
- **Dismiss** only unaccepts an activity: it goes back to Nearby and remains in the known catalogue. It does not suppress discovery, discard progress, or silently change a separate pin.
- **Pin / Unpin** sets or clears one navigation destination independently of acceptance. A nearby activity can be pinned without accepting it. Inspection does neither.
- **Completed** retains full known activity records instead of trimming to the last 64 or showing only eight. Natural completion works without accepting or pinning. Moving away does not delete known activities; use the area picker to revisit them.
- **Show on Map** opens the selected activity, including completed records. X, Escape, M, and controller Back return to those quest details before returning to play (or the original pause menu). Inspecting a surface activity underground opens its surface map.

Acceptance is a checklist decision: another active trial or expedition does not stop the player from collecting future work. Existing encounter-start restrictions still apply when actually starting those activities. Failed saves leave acceptance and pins unchanged.

## Compact HUD and suggestions

The Light & Open list remains independently below the minimap on the right. Collapsing it removes its header divider. It shows three unfinished accepted activities by default, with a pinned accepted activity first. Recommendations and unaccepted pins never fill spare rows. When no unfinished accepted activities remain, it shows “Accept quests in the Journal <J> to track them.” The empty-state text is hidden when the HUD list is collapsed. The configured display count does not limit the journal or acceptance. The list scrolls within the available screen height when needed.

Each side-list row exposes Pin on hover or keyboard focus (always visible on touch). Only an explicit pin keeps a gold active pin icon visible. The gold row/diamond marks only an explicitly pinned quest. Accepting a quest or receiving a recommendation never automatically sets navigation; unpinning or completing the pinned quest clears its destination instead of selecting another quest. Pinning from the side list never accepts the activity. HUD pin, unpin and collapse actions release button focus before saving so movement keys return to gameplay.

Recommendations favor suitable local content while the region remains useful; otherwise they can suggest a road toward a better region. Nearby entries in the full journal are geographic and may be harder or easier than the player. Recommendations do not appear in the HUD checklist; there is no suggestions toggle. Town and unaccepted activity pins still control map navigation independently of the HUD checklist.

A district change or level-up allows a quiet refresh after eight active seconds; moving 700 units or losing a recommendation allows it after fifteen seconds. Completing an activity allows a fresh search after a two-second completion beat. Refresh only runs during surface play, outside nearby combat, attacks, channels and save transactions. Menus pause the clock. Boundary crossings coalesce instead of generating announcements. Changing recommendations never rescales a source or moves a pinned objective.

## HUD Settings

The **HUD Settings** button sits beside **Accept all nearby** in the journal. Opening its compact popup reveals a live, noninteractive preview of the actual quest HUD while gameplay stays paused. On wider screens the journal makes room for the HUD at its normal right-side position; on narrow screens the same HUD moves into the popup. Count, sorting and visibility update immediately. A collapsed HUD temporarily expands for preview without changing its saved state, and closing settings hides the preview until gameplay resumes:

- **Show quest HUD** hides or restores the whole quest tracker, including dungeon objectives. The minimap, navigation pins and Journal shortcut remain available; reopen the journal to restore the HUD.
- **Quests shown** selects 1–8 rows (default 3).
- **Sort quests by** offers acceptance order (default), level from low to high, or distance from nearest to farthest. The pinned accepted quest always stays first and counts toward the chosen limit. Equal values retain acceptance order. Distance order follows movement, measured from the surface entrance while underground.

Changes save as device preferences, across characters and reloads; they do not modify character saves, acceptance or pinning. Blocked storage keeps the selection for the current session and reports that in the popup. Escape, the popup X or clicking outside closes the popup; Escape then closes the journal normally. The static review uses disposable preferences, and the Thor companion retains its independent three-row journal projection.

## Nearest city

The journal always includes the nearest settlement, including visited towns and cities, with its name, level, distance and a Pin action. This navigation entry is independent of activity acceptance and completion records. It updates with the player's location (or the surface entrance while underground); a city already pinned stays fixed when a different city becomes nearest. City pins use the existing map/return-portal navigation, survive saving, and clear on arrival. Town markers name the actual destination without revealing map terrain. Returning to a visited town grants no repeat arrival XP.

Nearest settlement lookup checks nine seeded geography anchors, then loads only the closest town layout through the existing cache. It does not scan the whole map or generate encounters.

## Natural completion

**Tracking is not required for credit or bonus XP.** POI completion and the final crypt chest create journal history even if the activity was never offered or was dismissed. Town arrival also counts naturally. Frontier arrival counts for generated leads in the catalogue; arbitrary walking does not invent new objectives.

- Garrisons: defeat the camp, then claim its strongbox.
- Caravans/reliquaries: finish the existing choice or treasure claim.
- Watchtowers: activate the beacon.
- Graveyards/standing stones: finish the guardians and claim the reward/blessing.
- Wilderness bosses: defeat the boss, then wait for the complete physical hoard to be delivered. Guidance reports the pending delivery instead of asking for another kill.
- Crypts: defeat the Warden and fully claim the final chest. Boss death alone is not completion.
- Towns/frontiers: arrive within the objective's radius on the surface.

Full gold-pile capacity can postpone completion: the bonus is paid only once the full bundle has been delivered. Ordinary combat remains an independent progression path. Existing completed activities are not paid retroactively when loading this feature.

## Completion XP and presentation

Bonuses use fixed source level and the normal pre-award player/source level factor. They are measured in normal same-level Stalker kills, not a percentage of the XP bar:

| Activity | Kill equivalents | Level-one, equal-level bonus |
| --- | ---: | ---: |
| Reliquary | 0.25 | 5 XP |
| Caravan, beacon, town, frontier | 0.5 | 10 XP |
| Standing stones | 1 | 20 XP |
| Camp, graveyard | 1.5 | 30 XP |
| Final crypt chest | 3 | 60 XP |

These are additional completion bonuses; existing encounter, chest and trial rewards remain. No extra gear, gold or passive points are created. Crossing a level threshold grants the normal one skill/five attribute points without healing. Site XP and completion XP use the same pre-award level when awarded together.

A brief **Journey complete** celebration shows the activity name and actual bonus XP, sharing the level-up's native-resolution framing and fade. If the reward levels the character, level-up displays first and completion waits. Existing XP flights and the experience bar respond normally; no second completion feed card or new sound theme is added. Presentation is bounded and obeys reduced motion.

## Navigation

One pale-gold destination flag links an explicitly pinned activity to maps and its visible world anchor. Unpinned accepted quests and recommendations create no surface navigation marker. The minimap clamps offscreen bearings to its edge. Show on map inspects another lead without accepting it. On the surface, the map opens on the player, holds briefly, then eases to the objective and marks arrival with gold rings, preserving zoom. Direct pan/zoom input cancels the motion; reduced motion centers immediately with a stationary highlight. Unknown sites expose a coarse 768-unit search cell, never hidden terrain or exact POI coordinates. Normal discovery reveals the anchor. Underground, outside objectives point toward the entrance, and crypt objectives only identify discovered rooms. Useful saved return portals become the next marker while in town.

Bearings are not walking paths. Recommendation scoring checks coarse approach danger and road access, including escape from a higher-level district, but does not solve terrain-aware routing. Geography and build suitability need player testing.

## Ownership and persistence

`journey-state.ts` owns saved metadata; `journey-director.ts` owns bounded search and ranking; `journey-rewards.ts` owns the shared bonus formula and staged completion receipts. POI/chest commands persist XP, source claim and receipt together before committing live state. Arrival XP and its receipt change together and use the normal character autosave, just like combat XP. Failed explicit claims do not alter the character, emit completion or spend a source.

Exact completion receipts and full known history are retained together; revisiting, dismissing, repinning and loading cannot repay an objective. There are no accepted/known/history count caps or dismissal suppression list. Refresh merges new local discoveries into the catalogue rather than replacing it. Existing saves keep accepted activities and pins; old dismissed IDs no longer suppress rediscovery, and the obsolete suggestions preference is discarded on load. Historical details already trimmed by older builds are reconstructed from exact receipts when their source is encountered again, with no repeated XP. The shared character payload size bound remains; no test-progress reset. See [world-state longevity](world-state-longevity.md).

Search performs at most one 2,400-unit query per frame and nine cells per pass. Candidate discovery retains every activity returned by those bounded queries; recommendation scoring does not truncate the journal. It changes no exploration, RNG or spawns. `journey-panel.ts`, `journey-marker.ts` and the shared celebration art only project state. Regional multi-site chains and personal milestone teaching remain deferred; see the [design proposal](procedural-journeys.md).

Static review: `/journeys.html?view=hud`, `view=journal`, `view=crypt`, `view=map`, `view=complete`. Real components, staged data and a frozen world; no character save access or gameplay ticks.

Activity names match across the mini log, journal and markers. Distances use metres and kilometres with one shared display scale (32 world units per metre), measured directly to the activity.

`journey-controller.ts` owns runtime scheduling and presentation orchestration; the director remains pure and rewards remain source-owned.

## Dungeon objectives

Inside either a wilderness dungeon or an expedition stage, the HUD shows the current dungeon objective and the journal adds a Current expedition row alongside its retained area catalogue: defeat its named boss, claim the final chest, then return to the surface. The dungeon-map marker uses the actual generated boss room; unexplored chambers are approached through the revealed route. Grand-chest guidance waits for all reward receipts. This is a temporary presentation derived from the active run, so outdoor pins and offers are not replaced or lost.

Map search areas use a magnifying glass inside the approximate dashed circle; offscreen guidance uses a bold direction chevron. The shared Canvas silhouettes live in `map-symbol-art.ts`. This changes presentation only; guidance, discovery and pin ownership are unchanged.
