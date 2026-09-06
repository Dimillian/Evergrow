# Character hall and local checkpoints

Evergrow opens in a procedural forest character hall. Eight independent browser-local slots show name, level, power, last save time and equipped appearance. Select an empty slot, name a character, choose Sword + Shield, Two-handed Sword, Wand + Grimoire, Fire Staff, Shortbow or Longbow, and begin. The equipped portrait updates immediately when choosing. Select an existing character to continue. Deletion requires an explicit confirmation inside the hall.

Every character starts at level 1 with the same attributes, worn leather outfit, the selected level-one common weapon, no allocated passives beyond the origin, empty skill-rank/specialization selections, Overload disabled, five empty skill bindings and an empty 64-cell inventory. The world seed is 7319 for all slots; geography and starting conditions are identical, while exploration belongs to each character.

## Checkpoint contents

- Name/identity, level, current-level XP, attributes, unspent points and allocated nodes.
- All equipment and inventory item properties, appearances, source recipes, normalized affix rolls, enhancement/reroll counters and five skill assignments; purchased ranks, chosen casting ranks, selected specializations and Overload.
- Gold wallet, ground coins, current stock epoch/purchase masks, last 12 buyback items and transaction revisions.
- Home town and optional expedition return point, scoped to this character.
- Position/facing, health/mana, flask charges, dodge charges and recharge, potion and skill cooldowns.
- Play time, kills, loot random state/ordinal, flask kill-recharge progress and ground gear.
- Cleared camps and defeated members of partially cleared camps.
- Explored terrain and discovered points of interest in a separate character-scoped chart.

Derived stats and held equipment are rebuilt from the character sheet on load. In-flight attacks, projectiles, temporary buffs and live encounters are not serialized. Surviving enemies repopulate through the normal offscreen spawn rules; killed camp members stay dead, preventing duplicate deterministic camp loot. Loading a blocked position searches nearby clear ground and falls back to the starting refuge. Defeat preserves progression; returning to the refuge restores resources and clears combat transients.

## When saving happens

A new character must be saved successfully before entering the world. Checkpoints are written every ten seconds during play, after successful equipment/attribute/tree/assignment commands, when opening a panel or map, on pause/defeat, on document hiding/page exit, and during application teardown. **Save & Character Hall** saves before switching characters. If that write fails, the character stays open and the error is shown. Browser exit hooks are best effort; periodic checkpoints bound loss if a process is killed without delivering an exit event.

Town-portal travel and home-anchor activation persist their proposed position/travel state before publishing it. Cast progress and arrival protection are transient. Absent travel state defaults to Briarwatch/no link, within the current format.

Successful NPC transactions persist the entire proposed checkpoint before changing the live player. Storage errors and stale writers leave the wallet, gear, stock and random-operation counter unchanged.

## Storage integrity

Current payload version is **3**. Explicit item recipes, commerce state and skill progression are required. Previous version-1/2 slots remain stored and visible as incompatible; start a new character. This prototype intentionally has no save migration.

`character-save.ts` validates a versioned, size-bounded payload before any runtime state is changed. It checks item types/materials, inventory bounds, unique identities, valid connected node allocations, point budgets including purchased ranks, owned mastery/specialization constraints, unlocked skill bindings and finite resources/coordinates. Shared `item-validation.ts` and `commerce-validation.ts` validate recipes, affix uniqueness, tier counts, counter/record limits and stock issuance. Ownership checks also cover buyback and available stock. Commerce retains at most 2,048 current-epoch vendor masks and 12 buyback items within the existing 700,000-character payload limit. Unknown/incompatible data is preserved rather than partially repaired.

`character-storage.ts` stores each slot independently in one atomic localStorage value, retaining its last valid predecessor in a backup key. A damaged primary can recover from that backup; the hall explicitly marks this case. Unreadable slots remain reserved. Deletion writes a tombstone first so an old backup cannot resurrect the deleted character. Per-session raw-value tokens reject overwrites from a stale tab. `character-session.ts` owns the active slot, world compatibility and save results; simulation owns checkpoint capture/restore.

Character maps include character identity in the existing exploration namespace. Deleting a readable character also removes its chart. There is no cloud sync, account, export/import or save migration yet. Clearing browser site data removes local saves. Schema/world changes can invalidate saves during prototype development; incompatible slots are never silently overwritten.

## Power

Power is a comparative estimate: `round(sqrt(expected basic-attack DPS × effective life))`. DPS includes attack/cast cadence and expected critical damage, and averages alternating hands for dual wielding. Effective life includes same-level armor reduction and average shield mitigation. It is recomputed from the actual saved gear and nodes, never stored as authoritative gameplay data. Active-skill potency, mana sustainability and encounter-specific mechanics are outside this estimate.

## Review and tests

`/title.html` stages three characters in memory; `/title.html?empty` shows the new-character flow. Both use the real UI, character rig and world renderer, without gameplay ticks or browser storage. `/ui.html` also uses the real title component for its ready view. Headless tests cover slot limits, complete round trips, identical empty starters, malformed data, quota failures, backup recovery, stale writers, deletion, world mismatch, separate charts, death recovery and persistent camp casualties. Gameplay and save/resume acceptance remain for the user to test.

Starter choices share `STARTER_LOADOUTS` and `createStarterLoadout` in `items.ts`. The choices are Longsword + Iron Buckler, Weathered Sword, Cinder Wand + Ember Codex, Ember Staff, Thorn Shortbow and Warden Longbow. New-game selection defaults to Sword + Shield. New gear has no affixes. The entire selected loadout is equipped, with full life and mana, before the first checkpoint; continuing a save always uses its saved equipment. The creation form uses a six-option native radio group arranged in three rows of two with keyboard focus styling.


Gold lives on the character wallet and saves atomically with the bounded `groundGold` list (identity, position, amount, settling age). An absent balance/list is empty. Present balances and pile amounts must be safe whole integers, pile identities must be unique across ground equipment and currency, and restore resumes from the largest saved identity. Currency is per character; new characters start with zero gold.

The creation layout compacts the eight save slots into two rows above the starter grid. Each starter card shows its actual weapon and off-hand icons, a concise handling description and a visible selected state. Selecting a card updates the shared equipped portrait without erasing the entered name. Existing saves retain their own equipment; this expanded catalog does not require a save reset.

## POI state (2026-09-06)

Save v3 optionally carries `events`: up to 256 interacted sites, their committed choices and reward delivery masks, a fixed beacon target, and one active trial with up to six guardian identities/health/casualties. `character.blessing` stores one timed bonus. Absent fields mean no interactions or blessing; current v3 slots continue without a reset. Event commands persist a complete checkpoint before publishing rewards. Trial actors resume from recorded locations only when offscreen; missing actors do not count as defeated. Beacon discovery is an idempotent projection replayed into the character chart on load.
