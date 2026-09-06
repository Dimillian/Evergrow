# World-state longevity

Implemented locally, 2026-09-06. This pass removes lifetime activity-count gates and separates disposable actors from exact reward history. It does not claim unlimited storage.

## Retention policy

| State | Retained | Safe compaction |
| --- | --- | --- |
| Camp actors | Up to 32 cached garrisons; active/visible actors cannot be evicted | Detached, pristine members reconstruct from stable source IDs and geography. Injured members keep their stored source, rank, level, seed and life; dead members keep exact IDs. |
| Cleared camps | One exact camp ID | Replaces redundant member-death lists and full enemy objects. Never respawns or generates unloading rewards. |
| Dungeon expeditions | Every unfinished or reward-bearing floor, and any floor owning a return portal | Only a floor with every member dead, all three chest masks complete, no loose equipment/gold/pickups or living stored actor, and no active/return ownership becomes one cleared-entrance ID. |
| Retired crypt entrance | Exact ID, shown as cleared on the map | Reentry reports that the crypt is cleared. It cannot create a fresh roster or chest. |
| Interactive sites | Active trials, partial delivery masks, beacon projections, 32 recent non-beacon claims | Older fully claimed non-beacon sites become exact IDs. Opening state, availability, Journey completion and repeat-claim rejection consume those receipts. Beacons retain their location/target for chart recovery. |
| Journeys | Exact completion IDs independent of the visible log | The UI keeps three accepted activities, 12 offers, 64 history entries and 128 dismissals. Trimming that UI never permits a second XP payment. |

The old eight-expedition, 1,024-camp, 256-interaction and 2,048-Journey lifetime gates are removed. The one-live-Warden expedition rule and one guardian trial at a time remain gameplay constraints. Population, visibility, actor and ground-drop bounds remain unchanged.

Compaction does not abandon optional rewards. A boss-dead dungeon with an unopened side chest or dropped sword remains revisitable. Exhausted floors retire during a staged location transaction; a failed save leaves the live floor/return link untouched. POI compaction shares the reward transaction. Camp cache retirement changes representation only, with durable capture retaining exact deaths and wounds.

## Storage boundary

The serialized character safety limit is now **8,388,608 UTF-16 code units** (`SAVE_MAX_CODE_UNITS`, matching JavaScript string length). The worker validates the entire record before atomic IndexedDB replacement; a size-limit error explicitly preserves the previous save. Current version-3 IndexedDB characters continue; this change does not reset test progress.

This is a bounded prototype, not infinite persistence. Exact history still grows. The explored chart retains its separate 8,192-chunk / 4,096-POI and serialized-size limits; commerce retains its current-epoch vendor-mask bound. Large histories still incur snapshot/validation work, although sleeping actor memory is bounded. Region-paged archives and incremental checkpoint uploads are the next storage step, described in the [cloud-save study](cloud-saves-sites.md). Never remove exact receipts merely to make a save fit.

## Code ownership

- `camp-population.ts`: active actor cache, compact deaths/wounds, offscreen retirement and deterministic restoration.
- `dungeon-state.ts`: pure exhausted-floor compaction; `dungeon-command.ts`: staged travel and chest persistence.
- `poi-content.ts`: compact claims and shared claim lookup; `poi-command.ts`: atomic rewards plus retirement.
- `journey-rewards.ts`: exactly-once XP receipts without a lifetime reward quota.
- `journey-controller.ts`: runtime search cadence, journal lifecycle, mini-log and location-aware marker projection. Source commands/simulation still own rewards.
- `location-controller.ts`: dungeon/portal orchestration after durable writes; Game supplies world replacement and one shared input/camera/coverage arrival boundary.

## Evidence

Headless regressions cover 1,050 successive camps with a bounded actor cache; cache-evicted injuries/deaths after reconstruction; 4,096 cleared camps, 8,192 Journey receipts and 1,000 retired floors in a decoded checkpoint; 20 exhausted floors followed by a new crypt; all reward/portal retirement exclusions; POI receipt compaction and replay rejection; deferred/failed location writes before world changes.

The user retains gameplay testing. Code checks do not establish Safari memory limits or long-session frame time.

Consolidation verification: **713 code tests passed**, strict application/headless TypeScript passed, production build passed. No automated gameplay or browser playtest was run.
