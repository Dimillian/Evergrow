# Regional progression — local, 2026-09-08

Regions now provide a level range rather than a single fixed level. Terrain, settlements, roads, climates, region names and exploration remain generation 9. Ordinary threat follows the player within each region’s bounds; returning after outgrowing its cap makes the region easier.

## Geography and levels

Existing warped districts retain their approximately 3,600-world-unit spacing (about 112 metres). The road-travel/remoteness tier advances every 6,000 route units. Ordinary ranges are **1–12**, **4–18**, **7–22**, **12–28**, **18–35**; subsequent tiers add eight to both endpoints. The home district is always 1–12. Existing hazardous districts add their seeded 3–5-level premium to both endpoints. These are road-linked irregular districts, not concentric rings; several can share one climate.

A fresh encounter captures the player level clamped to that region’s range. Its ordinary members independently roll −1, 0 or +1 from stable source seeds, clamped to the same range. Veterans use baseline +1, elites +2, bosses +3. The existing rank health/damage/XP multipliers still apply; bosses retain normal rank internally and their authored boss stats.

| Player in home region | Ordinary | Veteran | Elite | Boss |
| --- | --- | --- | --- | --- |
| 1 | 1–2 | 2 | 3 | 4 |
| 8 | 7–9 | 9 | 10 | 11 |
| 12 or higher | 11–12 | 13 | 14 | 15 |

No event family or lair has a player-level unlock. Biomes, terrain, rarity, spacing and the safe immediate arrival still govern placement. Previously existing lair anchors stay in place; formerly ineligible cells can now contain low-region lairs. Starting new low-level trials includes their full veteran/elite recipe. Existing started trials retain their original roster.

## Encounter ownership

`encounter-scaling.ts` owns pure activation and member-level formulas. World queries remain seed-only and never read the player. Roaming groups share one anchor snapshot; camps persist theirs in `encounterScales`; event records and dungeon entrances persist their scaling snapshot. Enemy stats, projectiles, wounds, later waves and source seeds do not change on a level-up, boundary crossing, return visit or reload. Sleeping healthy camp members reconstruct from the same baseline. Cleared camps, dead bosses and claimed rewards never reset.

Trials snapshot all waves when started. A dungeon snapshots once on first entry; ordinary guards, ranked guards and its boss use the same baseline with their own offsets. Floor layout and roster remain tied to the saved entrance, including older expeditions.

## Rewards and services

Enemy drops and XP use the actual snapshotted enemy level. Trial/chest rewards and completion XP use the activation baseline, with their existing challenge yields, item-level bonuses and material weights. A lair’s guaranteed Rare-or-better first item and three-item hoard use its actual boss level. New dungeon final treasure uses baseline +3; side treasure uses baseline +1. Existing expeditions and started/completed events keep their original reward levels and delivery masks.

Gold scales with source level through the existing formulas. Containers use the bounded local baseline when broken. Item counts and rarity probabilities are unchanged; progression improves item level and material weights rather than flooding the bag. XP thresholds and level-gap penalties are unchanged: the first four thresholds remain 100 / 170 / 230 / 305, with the existing slower curve afterward.

Town stock and relevel services follow the player within the town region’s ordinary bounds. Stock remains stable for its three-level refresh epoch; the shop labels the actual stock level and the improvement tab labels the current bounded service level. Relevel quotes use that service level. A home shop cannot supply level-30 gear. Existing buyback and transaction receipts remain intact.

## Guidance and map

The atlas, area notices and Thor mini map show **Lv min–max**. Activity map hovers and journal entries use a saved encounter level when available, otherwise a read-only preview for the current player. Nearby retains easier/harder activities; recommendations favor appropriate nearby activities. Bosses and dungeons are eligible at their intentional +3 challenge offset.

At the ordinary regional ceiling, Recommended favors The road ahead toward a district with a higher ceiling. The player can still pin a local boss or activity. In overlevelled danger, guidance favors safer ground. Road leads evaluate all destinations in their bounded spatial query before ranking, so early unsuitable roads cannot hide a valid onward route. They remain geographic hints, not guaranteed pathfinding. Explicit pins stay fixed; level refreshes never award rewards or instantiate encounters.

## Existing saves

Current generation-9 v4 characters remain compatible. No world reset, character deletion, lost inventory or exploration migration is needed. Saved actors retain exact levels and wounds. Active/paused events and entered dungeons without the new optional snapshot retain their fixed original levels. Already visited old camps with death/wound records retain their previous geographic difficulty; newly encountered content adopts scaling. Old full-health camps that were never retained in a checkpoint have no persisted encounter to preserve.

The existing v3 appearance migration still preserves progress. Unsupported older world generations remain unsupported; this change does not alter that rule. Cloud saves will require the matching client/server publication of the shared validators; local and Android continue using the same local save contract.

## Verification

Verified locally after the second review: all 1,023 code tests pass, along with strict type checking and the cloud-enabled client/Worker production build. The Worker exports a callable fetch handler. Onward-route regressions cover the exact regional cap and dismissed leads; a separate headless sweep checked 77 position/level cases across seven seeds, including 28 routes from overlevelled areas, with no missed eligible frontier lead inside the bounded query. Headless checks cover regional bounds/rank offsets, immutable camp/wave/dungeon snapshots, failed durable commands, old/current save decoding, reward identity, vendor stock stability and onward guidance across several seeds. Type checking includes the headless dependency boundary. Combat feel and time-to-level remain player playtesting, rather than automated gameplay acceptance.
