# Journeys

Implemented · 2026-09-06 · initial tuning for continued player testing.

## Recommended and nearby

The compact list beneath the minimap and the **J** panel share one activity catalogue:

- **Recommended** selects one suitable next activity. In an area within two levels of the character, a suitable activity within 2,400 units takes priority over a distant alternative. In outgrown or dangerous areas, recommendations can point toward a better-fit activity or an outward/inward road destination.
- **Nearby** lists local activities by distance, including ones above or below the character's level. Level numerals subtly indicate difficulty: muted for easier, neutral for a match, warm for harder. A match means within two levels. The journal detail only spells out Easier/Harder when relevant; the mini log has no repeated status captions. This does not guarantee a boss is easy for every build.
- **Tracked** remains a deliberate choice. Track accepts and pins the destination; inspection alone does not. Up to three activities may be accepted, one tracked. The pinned lead stays fixed as recommendations change.

The mini log has at most three activity rows: pinned activity, recommendation and nearest other options as space permits. Untracked accepted activities remain in the panel. Recommendations appear above Nearby in the panel, with accepted and completed sections also available. Collapse and hiding suggestions affect presentation; the catalogue can still update.

A district change or level-up allows a quiet refresh after eight active seconds; moving 700 units or completing/losing a recommendation allows it after fifteen seconds. Refresh only runs during surface play, outside nearby combat, attacks, channels and save transactions. Menus pause the clock. Boundary crossings coalesce instead of generating announcements. Changing recommendations never rescales a source or moves a pinned objective.

## Natural completion

**Tracking is not required for credit or bonus XP.** POI completion and the final crypt chest create journal history even if the activity was never offered or was dismissed. Town arrival also counts naturally. Frontier arrival counts for generated leads in the catalogue; arbitrary walking does not invent new objectives.

- Garrisons: defeat the camp, then claim its strongbox.
- Caravans/reliquaries: finish the existing choice or treasure claim.
- Watchtowers: activate the beacon.
- Graveyards/standing stones: finish the guardians and claim the reward/blessing.
- Crypts: defeat the Warden and fully claim the final chest. Boss death alone is not completion.
- Towns/frontiers: arrive within the objective's radius on the surface.

Ground-loot capacity can postpone completion: the bonus is paid only once the full bundle has been delivered. Ordinary combat remains an independent progression path. Existing completed activities are not paid retroactively when loading this feature.

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

One pale-gold diamond links the tracked activity to maps and its visible world anchor. The minimap clamps offscreen bearings to its edge. Show on map inspects another lead without accepting it. Unknown sites expose a coarse 768-unit search cell, never hidden terrain or exact POI coordinates. Normal discovery reveals the anchor. Underground, outside objectives point toward the entrance, and crypt objectives only identify discovered rooms. Useful saved return portals become the next marker while in town.

Bearings are not walking paths. Recommendation scoring checks coarse approach danger and road access, including escape from a higher-level district, but does not solve terrain-aware routing. Geography and build suitability need player testing.

## Ownership and persistence

`journey-state.ts` owns saved metadata; `journey-director.ts` owns bounded search and ranking; `journey-rewards.ts` owns the shared bonus formula and staged completion receipts. POI/chest commands persist XP, source claim and receipt together before committing live state. Arrival XP and its receipt change together and use the normal character autosave, just like combat XP. Failed explicit claims do not alter the character, emit completion or spend a source.

A separate receipt ledger survives history trimming, so revisiting, dismissing, retracking and loading cannot repay an objective. Initial bounds: 2,048 completion receipts, three accepted activities, 12 catalogue entries, 64 displayed history records and 128 dismissed IDs. At the receipt cap, further new Journey rewards/recommendations stop; ordinary source content still works. Existing POI/expedition bounds also apply.

Search performs at most one 2,400-unit query per frame, nine cells per pass and 64 candidates. It changes no exploration, RNG or spawns. `journey-panel.ts`, `journey-marker.ts` and the shared celebration art only project state. Regional multi-site chains and personal milestone teaching remain deferred; see the [design proposal](procedural-journeys.md).

Static review: `/journeys.html?view=hud`, `view=journal`, `view=crypt`, `view=map`, `view=complete`. Real components, staged data and a frozen world; no character save access or gameplay ticks.

Activity names match across the mini log, journal and markers. Distances use metres and kilometres with one shared display scale (32 world units per metre), measured directly to the activity.
