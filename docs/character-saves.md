# Character hall and local checkpoints

Evergrow opens in a procedural forest character hall. Eight independent browser-local slots show name, level, power, last save time and equipped appearance. Select an empty slot, name a character, and begin. Select an existing character to continue. Deletion requires an explicit confirmation inside the hall.

Every character starts at level 1 with the same attributes, worn leather outfit, weathered sword, no allocated passives beyond the origin, five empty skill bindings and an empty 64-cell inventory. The world seed is 7319 for all slots; geography and starting conditions are identical, while exploration belongs to each character.

## Checkpoint contents

- Name/identity, level, current-level XP, attributes, unspent points and allocated nodes.
- All equipment and inventory item properties, appearances and five skill assignments.
- Position/facing, health/mana, flask charges, dodge charges and recharge, potion and skill cooldowns.
- Play time, kills, loot random state/ordinal, flask kill-recharge progress and ground gear.
- Cleared camps and defeated members of partially cleared camps.
- Explored terrain and discovered points of interest in a separate character-scoped chart.

Derived stats and held equipment are rebuilt from the character sheet on load. In-flight attacks, projectiles, temporary buffs and live encounters are not serialized. Surviving enemies repopulate through the normal offscreen spawn rules; killed camp members stay dead, preventing duplicate deterministic camp loot. Loading a blocked position searches nearby clear ground and falls back to the starting refuge. Defeat preserves progression; returning to the refuge restores resources and clears combat transients.

## When saving happens

A new character must be saved successfully before entering the world. Checkpoints are written every ten seconds during play, after successful equipment/attribute/tree/assignment commands, when opening a panel or map, on pause/defeat, on document hiding/page exit, and during application teardown. **Save & Character Hall** saves before switching characters. If that write fails, the character stays open and the error is shown. Browser exit hooks are best effort; periodic checkpoints bound loss if a process is killed without delivering an exit event.

## Storage integrity

`character-save.ts` validates a versioned, size-bounded payload before any runtime state is changed. It checks item types/materials, inventory bounds, unique identities, valid connected node allocations, point budgets, unlocked skill bindings and finite resources/coordinates. Unknown/incompatible data is preserved rather than partially repaired.

`character-storage.ts` stores each slot independently in one atomic localStorage value, retaining its last valid predecessor in a backup key. A damaged primary can recover from that backup; the hall explicitly marks this case. Unreadable slots remain reserved. Deletion writes a tombstone first so an old backup cannot resurrect the deleted character. Per-session raw-value tokens reject overwrites from a stale tab. `character-session.ts` owns the active slot, world compatibility and save results; simulation owns checkpoint capture/restore.

Character maps include character identity in the existing exploration namespace. Deleting a readable character also removes its chart. There is no cloud sync, account, export/import or save migration yet. Clearing browser site data removes local saves. Schema/world changes can invalidate saves during prototype development; incompatible slots are never silently overwritten.

## Power

Power is a comparative estimate: `round(sqrt(expected basic-attack DPS × effective life))`. DPS includes attack/cast cadence and expected critical damage, and averages alternating hands for dual wielding. Effective life includes same-level armor reduction and average shield mitigation. It is recomputed from the actual saved gear and nodes, never stored as authoritative gameplay data. Active-skill potency, mana sustainability and encounter-specific mechanics are outside this estimate.

## Review and tests

`/title.html` stages three characters in memory; `/title.html?empty` shows the new-character flow. Both use the real UI, character rig and world renderer, without gameplay ticks or browser storage. `/ui.html` also uses the real title component for its ready view. Headless tests cover slot limits, complete round trips, identical empty starters, malformed data, quota failures, backup recovery, stale writers, deletion, world mismatch, separate charts, death recovery and persistent camp casualties. Gameplay and save/resume acceptance remain for the user to test.
