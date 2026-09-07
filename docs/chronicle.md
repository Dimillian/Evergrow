# Chronicle

Local update: wilderness bosses now count toward Kingslayer and have three dedicated achievement families. The current catalog has 35 families / 100 tiers; earlier 32-family / 91-tier counts below describe the initial release. See [boss lairs](wilderness-bosses.md).

Published in v0.5.0 on 2026-09-07 with matching cloud client, API and additive D1 migration. Sites confirmed deployment success; cross-device acceptance remains a player check.

## Player flow

- **Character hall → Chronicle** opens all characters in the selected save source.
- **Esc → Chronicle** opens the current character and returns to pause when closed.
- **Character & inventory → Chronicle** opens the current character and returns to inventory.
- The character selector includes archived characters. Cloud and Local remain separate; Android uses this device's local history.
- Overview shows six totals, the closest milestones, attributed personal bests and earned badges. Achievements contains 32 families / 91 tiers and feats. Statistics contains detailed combat, survival, loot, exploration and progression tables.
- Keyboard focus, controller A/B, LB/RB tab switching and right-stick scrolling use the shared UI controls. Small screens scroll within the panel.
- No stat bonuses, currencies or rewards come from achievements, and no milestone popup feed competes with combat. Hover or focus a badge to see its requirement, progress, next milestone and recorded unlock date in a shared smoked-glass tooltip. Touch users can tap. Detailed statistics also explain their measurement rules on hover/focus; explanations no longer occupy a separate panel.

Local polish after v0.5.0 adds inset, softly highlighted tabs and cached-first cloud loading. Inventory initially focuses its dialog surface instead of highlighting Close; Tab and controller navigation remain available. These refinements are included in the v0.5.1 release source.

`/chronicle.html` is an authored sample with three characters, one archived. It never reads saves, starts gameplay or calls a server.

## Measurement

`chronicle-tracking.ts` consumes confirmed combat events once, before they reach presentation. Real damage excludes overkill; hybrid physical/elemental damage divides the actual hit proportionally. Damage-over-time, crits, skills, enemy families/ranks, blocks, actual life/mana restored, potions, basic attacks, skill activations, loot rarity/material/type and currency are counted separately. Mana and activations count only after a successful cost payment. Spellblade requires melee and magic hits on the same enemy; its transient per-enemy marks are bounded and discarded with the player instance.

Active time and distance advance with simulation ticks, never while paused. Relocation does not count as walking. Biome discovery is sampled once per active second. Distance uses the shared 32-world-units/metre scale. Longest life measures tracked active time between deaths. Dungeon bosses count when defeated. Event completion / best cursed-chest waves count when their reward is claimed; partial timed runs keep their actual cleared-wave result. First discoveries use Exploration's existing discovery callback. Journey and service counters are staged with the same durable checkpoint as their XP/gold changes.

Existing saves contribute recorded kills, playtime and current level. Previously unmeasured damage, gold earnings, deaths and similar history are unknown, shown as a dash in detailed tables. No historical combat is invented and no character reset is required. Unlock dates are checkpoint observations; account-wide dates are the first recorded aggregate observation.

## Storage ownership

- `chronicle.ts` owns validated progress, monotonic source merging and the separate account/device ledger. Every play lineage has cumulative counters; totals sum distinct sources while personal records and distinct discoveries take maxima.
- Import keeps the original source identities and adds a new active branch. Re-importing the same progress does not award its past totals twice. Future play on each imported character is separate.
- Local writes update the character, revision and Chronicle ledger in one IndexedDB transaction. Deleting a slot archives its last accepted history. Stale/failed writes cannot alter history. The initial local preview's missing achievement index is reconstructed without deleting counters.
- Cloud writes retain an account-owned history summary in the existing D1 slot row, including tombstones. Its compare-and-swap is the same publication boundary as the R2 checkpoint. A new authenticated `/api/cloud/chronicle` GET merges only that owner's accepted histories. Existing unindexed slots backfill recorded facts on read/write.
- Account-scoped IndexedDB v2 retains fetched cloud history offline. Unacknowledged conflicting recovery is not merged into permanent account totals. Download/import creates a distinct branch when the player chooses to preserve that recovery.
- No per-event network traffic. Chronicle travels with the existing 20-second local / 30-second cloud checkpoint cadence; opening it saves the current character locally, shows a compact worker-built history projection immediately, then refreshes from one server history read. It never flushes the upload queue just to view statistics. Refreshing preserves the selected tab, character, focused control and scroll position. Main-menu account history uses the same source selector as characters.
- Local bounds: 256 source branches per portable character, 768 counter keys per source, 4,096 archived sources/characters per ledger. Counters clamp at JavaScript's safe integer ceiling. A malformed ledger aborts the transaction; errors distinguish validation/interruption from actual quota failure.

## Integration / checks

`ChroniclePanel` is a shared read-only view registered with `PanelCoordinator` in game, and an owned title-screen overlay at the hall. It clears control contexts, traps focus and returns to its originating panel. The account view reads summaries, never mutates gameplay or equips items.

Headless regression coverage includes cumulative/import deduplication, earliest receipts, deleted-slot retention, stale writes, old-history recovery, cloud account isolation and conflict exclusion, overkill/element splits, deaths, Spellblade, movement/teleports, commerce, save dates, and panel return behavior. Standard type checking includes the new measurement modules in the headless boundary.

The v0.5.0 deployment packages `drizzle/0001_worthless_slipstream.sql` through the normal Sites migration workflow with matching client/server code. Do not deploy the cloud client independently of its endpoint/schema. See [release record](releases.md).
