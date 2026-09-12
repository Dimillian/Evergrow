# Character hall and checkpoints

Local settlement rework · generation 10 (2026-09-09): three settlement tiers, outdoor starting refuges without houses, families, gambling and personal storage. Generation-9 characters upgrade on Continue, preserving progression and exploration. The original save is retained until the upgrade commits. See [Settlements](settlements.md). Earlier generation/layout statements below describe the prior checkpoint.
Evergrow opens in a procedural forest character hall. Eight slots show name, level and power beside a compact Continue/Create panel. Larger displays retain the equipped portrait; handheld layouts keep the controls together. Sites offers separate cloud and local rosters; ordinary local and Android builds retain their browser-local slots. Select an empty slot, name a character, choose Sword + Shield, Two-handed Sword, Wand + Grimoire, Fire Staff, Shortbow or Longbow, then select Create character to customize appearance before saving and entering the world. See [Character appearance editor](character-editor.md). The equipped portrait updates immediately when choosing. Select an existing character to continue. Deletion requires an explicit confirmation inside the hall.

Every character starts at level 1 with the same attributes, worn leather outfit, the selected level-one common weapon, no allocated passives beyond the origin, empty skill-rank/specialization selections, Overload disabled, five empty skill bindings and an empty 64-cell inventory. Each character has an independently chosen world seed: creation supplies a random value from 0 through 4294967295, with an editable field and Randomize button. The seed remains visible in saved-character selection. Continuing reconstructs the saved world before restoring progress; exploration remains scoped to both the seed and character. Saved characters keep their chosen seed. The September 6 asynchronous-storage checkpoint starts fresh local slots; previous localStorage test characters are not imported.

## Local spatial pack

The local inventory prototype preserves older 64-entry bags and stores optional item-ID-to-cell positions in `inventoryLayout`. New bags allow 72 item records for a 12×6 physical grid; larger items consume multiple cells. Unfitted old items remain accessible as overflow, and the four charm rows are reserved. Geometry is validated with the save, including ownership, bounds and overlaps. See the local spatial inventory section in `character-systems.md`. This prototype has not been published.

## Checkpoint contents

- Name/identity, level, current-level XP, attributes, unspent points and allocated nodes.
- Required character appearance, per-part armor tint IDs and helmet visibility.
- All equipment and inventory item properties, appearances, source recipes, normalized affix rolls, enhancement/reroll counters and five skill assignments; purchased ranks, chosen casting ranks, selected specializations and Overload.
- Gold wallet, ground coins, current stock epoch/purchase masks, last 12 buyback items and transaction revisions.
- Home town and optional expedition return point, scoped to this character.
- Position/facing, health/mana, flask charges, dodge charges and recharge, potion and skill cooldowns.
- Play time, kills, loot random state/ordinal, flask kill-recharge progress and ground gear.
- Cleared camps and defeated members of partially cleared camps.
- Explored terrain and discovered points of interest in a separate character-scoped chart.

Derived stats and held equipment are rebuilt from the character sheet on load. In-flight attacks and projectiles are not serialized. Living actor recipes/health and wounded sleeping camp members are retained; restored actions restart safely. Timed POI blessings retain their remaining duration. New room/camp admission still follows offscreen rules; killed camp members stay dead, preventing duplicate deterministic camp loot. Loading a blocked position searches nearby clear ground and falls back to the starting refuge. Defeat preserves progression; returning to the refuge restores resources and clears combat transients.

## When saving happens

The optional `recentItems` character field records newest-first acquired item IDs, bounded to 75 unique entries (bag plus equipment capacity). Pickups, purchases and buyback record acquisitions; sorting and equipment swaps preserve the history. That historical sorting checkpoint did not require a progress reset; earlier pickup chronology was unknown. The current appearance schema v4 migrates pre-editor v3 characters as described below. The separate asynchronous-storage checkpoint starts fresh slots as described above. Sort commands persist the resulting bag order through the ordinary character-command checkpoint.

A new character must be saved successfully before entering the world. Checkpoints are written every twenty seconds during play, after successful equipment/attribute/tree/assignment/appearance commands, when opening a panel or map, on pause/defeat, on document hiding/page exit, and during application teardown. **Save & Character Hall** saves before switching characters. If that write fails, the character stays open and the error is shown. Browser exit hooks are best effort; periodic checkpoints bound loss if a process is killed without delivering an exit event.

Town-portal travel and home-anchor activation persist their proposed position/travel state before publishing it. Cast progress and arrival protection are transient. Absent travel state defaults to Briarwatch/no link, within the current format.

Successful NPC transactions persist the entire proposed checkpoint before changing the live player. Storage errors and stale writers leave the wallet, gear, stock and random-operation counter unchanged.

## Storage integrity

Current payload version is **4**. Explicit item recipes, commerce state, skill progression and the appearance recipe are required. Valid pre-editor v3 saves migrate on read: missing appearance receives the editor default (warm skin, chestnut swept hair, no beard/accessory, original armor colors and helmet hidden). All other fields, character identity and explored-chart ownership stay unchanged. The next successful save writes v4 through the existing atomic revision checks; reads do not rewrite storage. Existing valid appearance is preserved, while malformed appearance or progression is rejected. Version-1/2 slots remain preserved and incompatible because they lack earlier required systems; this migration covers the appearance change only.

`character-save.ts` validates a versioned, size-bounded payload before any runtime state is changed. It checks item types/materials, inventory bounds, unique identities, valid connected node allocations, point budgets including purchased ranks, owned mastery/specialization constraints, unlocked skill bindings and finite resources/coordinates. Shared `item-validation.ts` and `commerce-validation.ts` validate recipes, affix uniqueness, tier counts, counter/record limits and stock issuance. Ownership checks also cover buyback and available stock. Commerce retains at most 2,048 current-epoch vendor masks and 12 buyback items within the 8,388,608-code-unit payload safety limit. Unknown/incompatible data is preserved rather than partially repaired.

`save-worker.ts` owns serialization and validation away from the gameplay thread. `save-database.ts` stores character slots and explored charts in the `evergrow-local` IndexedDB database. The headless `character-storage.ts` record logic runs inside one database transaction, retaining a last-good predecessor and using small revision tokens for atomic compare-and-write across tabs. Damaged primaries can recover from a valid backup; deletion writes a tombstone and clears the backup in the same transaction. Failed transactions retain the previous checkpoint. `character-session.ts` serializes saves so each write uses the preceding committed token. Memory-only reviews and headless tests use the same validation logic without browser storage.

Character maps include character identity in the existing exploration namespace. Deleting a readable character also removes its chart. The Site-enabled build adds account-owned cloud saves and separate Cloud / Local tabs. Browser builds support validated character-and-chart Download / Import into empty slots; Android remains local-only. See [Cloud saves](cloud-saves-sites.md). Clearing browser site data removes local saves. Schema/world changes can invalidate saves during prototype development; incompatible slots are never silently overwritten.

## Power

Power is a comparative estimate: `round(sqrt(expected basic-attack DPS × effective life))`. DPS includes attack/cast cadence and expected critical damage, and averages alternating hands for dual wielding. Effective life includes same-level armor reduction and average shield mitigation. It is recomputed from the actual saved gear and nodes, never stored as authoritative gameplay data. Active-skill potency, mana sustainability and encounter-specific mechanics are outside this estimate.

## Review and tests

`/title.html` stages three characters in memory; `/title.html?empty` shows the new-character flow. Both use the real UI, character rig and world renderer, without gameplay ticks or browser storage. `/ui.html` also uses the real title component for its ready view. Headless tests cover slot limits, complete round trips, identical empty starters, malformed data, quota failures, backup recovery, stale writers, deletion, world mismatch, separate charts, death recovery and persistent camp casualties. Gameplay and save/resume acceptance remain for the user to test.

Starter choices share `STARTER_LOADOUTS` and `createStarterLoadout` in `items.ts`. The choices are Longsword + Iron Buckler, Weathered Sword, Cinder Wand + Ember Codex, Ember Staff, Thorn Shortbow and Warden Longbow. New-game selection defaults to Sword + Shield. New gear has no affixes. The entire selected loadout is equipped, with full life and mana, before the first checkpoint; continuing a save always uses its saved equipment. The creation form uses a six-option native radio group with keyboard focus styling, in three rows of two or two rows of three on short landscape screens.


Gold lives on the character wallet and saves atomically with the bounded `groundGold` list (identity, position, amount, settling age). An absent balance/list is empty. Present balances and pile amounts must be safe whole integers, pile identities must be unique across ground equipment and currency, and restore resumes from the largest saved identity. Currency is per character; new characters start with zero gold.

The responsive hall keeps eight slots beside the create/continue panel, moving them into two rows on narrow portrait screens. Starter cards show actual weapon/off-hand icons, a brief name and selected state; handling details live in tooltips. Selecting a card updates the shared equipped portrait without erasing the entered name. Existing saves retain their own equipment; this expanded catalog does not require a save reset.

## POI state (2026-09-06)

Save v3 optionally carries `events`: active/partial site records, beacon projections and compact exact completed-site receipts, their committed choices and reward delivery masks, a fixed beacon target, and one active trial with up to six guardian identities/health/casualties. `character.blessing` stores one timed bonus. Absent fields mean no interactions or blessing; current v3 slots continue without a reset. Event commands persist a complete checkpoint before publishing rewards. Trial actors resume from recorded locations only when offscreen; missing actors do not count as defeated. Beacon discovery is an idempotent projection replayed into the character chart on load.

## Dungeon checkpoints

Optional v3 expedition state stores the active location, retained seeded floors plus exact exhausted-floor receipts, exact roster wounds/deaths and boss thresholds, chest-delivery masks, room discovery and suspended ground contents. Only one unfinished floor is permitted. The active location owns the checkpoint's top-level actors/loot; suspended locations own their separate contents, preventing duplicate item ownership. Travel return links can name an exact dungeon instance.

Entering, leaving, town return and chest claims persist before live commitment. No location switch refills resources. Death recovery preserves dungeon progress. Surface roaming warmup and wounded sleeping camp state survive transitions; unloading grants no rewards. Validation checks floor membership, bounded collections, finite stats and item uniqueness across every retained location. The 8,388,608-code-unit payload safety ceiling remains; storage failures leave live progress untouched. See [Dungeons](dungeons.md).


## Asynchronous storage checkpoint

The runtime uses a worker for both character and exploration JSON work and IndexedDB for disk writes. Character snapshots use native structured cloning instead of a JSON encode/decode round trip. Autosaves coalesce while a previous write is outstanding. Purchases, POI claims and travel await a durable write before publishing their staged state; the simulation and new commands are held during that transaction, while rendering continues. Failures do not grant rewards, move the player or consume a purchase. Chart transactions merge other tabs' discoveries before writing and retain the dirty state of discoveries made during an in-flight write.

Periodic saves, focus loss, panel transitions and explicit return-to-hall requests remain save triggers. The page-hide request is best effort: a browser can terminate a page before asynchronous work completes, so the last completed checkpoint is authoritative. Returning to the character hall waits for a completed save. HMR teardown drains pending transactions before terminating its save worker. Browser storage failure is surfaced in the save status; there is no synchronous localStorage fallback.

This prototype storage replacement deliberately starts a fresh set of eight slots and charts. Old localStorage test progress is not migrated. The database is local to the browser and origin; this is not cloud saving.

Current world-state retirement preserves exact receipts and pending loot without lifetime camp/expedition/Journey count gates; see [world-state longevity](world-state-longevity.md). [Cloud saving on Sites](cloud-saves-sites.md) is researched only and has no effect on existing local storage.

Cloud publication is asynchronous after the durable local checkpoint. Each cloud checkpoint captures its explored chart in the same outbox transaction; only an acknowledged server revision is Synced. Existing local saves remain in `evergrow-local`, with no automatic copying or deletion.

### Save cadence — September 6

Routine active-play checkpoints run every 20 seconds. Gear/skill changes, panel transitions, death, travel and vendor transactions retain their existing immediate local checkpoints. Checkpoint serialization/validation and IndexedDB writes run in a worker; snapshot capture remains bounded main-thread work. Concurrent requests coalesce and remain serialized.

The Sites cloud outbox publishes the latest durable checkpoint every 30 seconds instead of uploading each gear/point change. Clean slots send no upload. Returning to the hall, deletion and backgrounding request an immediate flush; browser exit remains best effort. Failed uploads stay in local recovery and retry. Wait for **Synced** before moving to another device. Android/local saves make no cloud requests.

## Generation 9 → 10 settlement upgrade

Continue prepares a copy through `world-save-upgrade.ts`, then commits it before entering gameplay. Only generation 9 → 10 is supported. Older invalid save schemas or obsolete dungeon-layout payloads are not made compatible by this upgrade. No original slot is deleted.

Level, XP, attributes, skill allocations, equipment, gold, buyback, Chronicle sources, wilderness event/camp receipts, regional difficulty snapshots and supported dungeon runs remain. Already-owned shop items receive deterministic owned-item IDs, including items in buyback, on the ground and in stored dungeon contents; their stats/recipes do not change. Recent-item references follow the new IDs. Vendor sold masks refresh once so the redesigned shops can offer their new stock. Old town furniture-break references are cleared; wilderness destruction is retained. Town journal markers refresh without dropping unrelated journeys.

Clear surface positions remain unchanged. Blocked character positions and surface return portals relocate to a checked town arrival. Blocked surface loot and actors move to nearby free ground without changing rewards or enemy identity/stats. Active dungeon positions, enemies and event progress stay in the dungeon; its surface return is checked separately.

The local worker copies the generation-9 chart into generation 10 in the same IndexedDB transaction as the upgraded character and revision. Explored cells remain; known town/service markers refresh from current geometry. Original chart bytes remain under the old key and the prior character is the last-good backup. Invalid chart data, failed writes or stale tokens abort entry and preserve the prior save.

The cloud worker similarly builds one upgraded character/chart bundle and commits it to the normal account-scoped recovery/outbox transaction. Pending immutable generation-9 uploads finish before the upgraded bundle is sent. The matching server accepts generation 9 and 10 payloads during this transition, retaining all normal ownership, revision and validation checks. Local imports may contain generation 9 and upgrade on Continue; Cloud import/export remains disabled. No D1 schema change is needed. Deploy the matching client and Worker together when publication is requested.

## Local skill-tree refund · 2026-09-12

Version-4 payloads now carry `character.treeVersion: 2`. Saves without it pass the finite pre-redesign graph/rank/variant/point-ledger validator before receiving all node/rank points back. Assignments and skill cooldowns clear. Continue opens the tree at its root with the refund explanation visible and gameplay paused. Level, XP, attributes, gear, world state and exploration remain. Invalid or unsupported trees remain stored and are not silently repaired. Conversion modifies only a parsed copy. See [the exact refund rules](skill-progression.md#existing-characters).
